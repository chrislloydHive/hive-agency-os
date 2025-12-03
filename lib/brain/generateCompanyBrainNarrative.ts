// lib/brain/generateCompanyBrainNarrative.ts
// ============================================================================
// Company Brain Narrative Generator
// ============================================================================
//
// Uses OpenAI to generate a cohesive, AI-powered narrative about a company
// based on all the data collected in the system.

import { getOpenAI } from '@/lib/openai';
import type { CompanyBrainData } from './getCompanyBrainData';
import { getDataAvailabilitySummary } from './getCompanyBrainData';

// ============================================================================
// Types
// ============================================================================

/**
 * Structured sections of the Brain narrative
 */
export interface BrainNarrativeSections {
  companySnapshot: string;
  brandSummary: string;
  messagingSummary: string;
  productServiceSummary: string;
  websiteSummary: string;
  seoSummary: string;
  contentSummary: string;
  opsSummary: string;
  demandSummary: string;
  mediaSummary?: string | null;
  risks: string;
  opportunities: string;
  missingInfo: string;
}

/**
 * Data confidence assessment
 */
export interface DataConfidence {
  score: number; // 0-100
  level: 'low' | 'medium' | 'high';
  reasons: string[];
}

/**
 * Complete Brain narrative output
 */
export interface CompanyBrainNarrative {
  narrativeMarkdown: string;
  sections: BrainNarrativeSections;
  dataConfidence: DataConfidence;
  generatedAt: string;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI strategist embedded in a marketing operations platform. You have access to the complete intelligence the system has collected about a single company.

Your job is to synthesize ALL available data into a cohesive "Company Brain" - a unified strategic narrative that serves as the company's institutional memory.

You will receive a JSON object called companyBrainData that includes:
- Company record (name, domain, type, stage, industry, ICP, markets)
- Diagnostic lab outputs: Brand Lab, Website Lab, SEO Lab, Content Lab, Ops Lab, Demand Lab
- GAP runs: GAP Snapshot (initial assessment), GAP Plan (full plan), GAP Heavy (deep analysis)
- Client insights: Strategic observations and learnings
- Client documents: Uploaded files and their context
- Data availability summary: What data exists vs. what's missing

IMPORTANT GUIDELINES:

1. **Narrative Style**:
   - Write like a senior strategist briefing a colleague
   - Use clear, direct language - no jargon or filler
   - Structure with clear headings and bullet points where helpful
   - Be specific - reference actual data points when available
   - If data is missing for a section, acknowledge it explicitly

2. **Data Handling**:
   - NEVER invent data that isn't provided
   - If a lab hasn't been run, say "No [Lab Name] data available yet"
   - If a lab was run but failed, note that
   - Use actual scores and summaries from lab results

3. **Structure Requirements**:
   - Each section should be 1-3 paragraphs max
   - Risks and Opportunities should be bullet lists
   - Missing Info should clearly state what data would help

4. **Confidence Assessment**:
   - Score 0-100 based on data completeness and quality
   - High (75-100): Most key data available, recent, consistent
   - Medium (40-74): Some data available but gaps exist
   - Low (0-39): Minimal data, can only make basic observations

Return valid JSON ONLY with this exact shape:
{
  "narrativeMarkdown": "Full narrative as markdown string",
  "sections": {
    "companySnapshot": "Brief company overview",
    "brandSummary": "Brand positioning and identity",
    "messagingSummary": "Messaging and value proposition",
    "productServiceSummary": "Products/services and differentiation",
    "websiteSummary": "Website effectiveness and UX",
    "seoSummary": "Search visibility and technical SEO",
    "contentSummary": "Content strategy and execution",
    "opsSummary": "Marketing operations and systems",
    "demandSummary": "Demand generation and lead flow",
    "mediaSummary": "Paid media performance (null if no data)",
    "risks": "Key risks and red flags",
    "opportunities": "Strategic opportunities",
    "missingInfo": "What data is missing"
  },
  "dataConfidence": {
    "score": 0-100,
    "level": "low" | "medium" | "high",
    "reasons": ["reason1", "reason2", ...]
  }
}`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Prepare the data payload for the LLM
 * Strips out very large fields and formats for readability
 */
function prepareDataForLLM(data: CompanyBrainData): Record<string, unknown> {
  // Get data availability summary
  const availability = getDataAvailabilitySummary(data);

  // Format insights for context (limit to most relevant)
  const insightsSummary = data.insights.slice(0, 20).map((insight) => ({
    title: insight.title,
    body: insight.body.slice(0, 500), // Truncate long bodies
    category: insight.category,
    severity: insight.severity,
    createdAt: insight.createdAt,
  }));

  // Format lab results (extract key info, skip huge rawJson)
  const formatLabResult = (lab: typeof data.brandLab) => {
    if (!lab) return null;
    return {
      status: lab.status,
      summary: lab.summary,
      score: lab.score,
      createdAt: lab.createdAt,
      // Only include rawJson if it's not too large
      rawJson:
        lab.rawJson && JSON.stringify(lab.rawJson).length < 10000
          ? lab.rawJson
          : '[Data too large - see summary]',
    };
  };

  return {
    company: data.company,
    dataAvailability: availability,
    labs: {
      brand: formatLabResult(data.brandLab),
      website: formatLabResult(data.websiteLab),
      seo: formatLabResult(data.seoLab),
      content: formatLabResult(data.contentLab),
      ops: formatLabResult(data.opsLab),
      demand: formatLabResult(data.demandLab),
    },
    gap: {
      snapshot: formatLabResult(data.gapSnapshot),
      plan: formatLabResult(data.gapPlan),
      heavy: formatLabResult(data.gapHeavy),
    },
    insights: insightsSummary,
    insightsSummary: data.insightsSummary,
    documentsCount: data.documents.length,
    documentsList: data.documents.slice(0, 10).map((d) => ({
      name: d.name,
      type: d.type,
      uploadedAt: d.uploadedAt,
    })),
    dataFetchedAt: data.dataFetchedAt,
  };
}

/**
 * Parse the LLM response safely
 */
function parseNarrativeResponse(
  content: string
): Omit<CompanyBrainNarrative, 'generatedAt'> {
  // Try to extract JSON from the response
  let jsonStr = content;

  // Handle markdown code blocks
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.narrativeMarkdown || typeof parsed.narrativeMarkdown !== 'string') {
      throw new Error('Missing or invalid narrativeMarkdown');
    }
    if (!parsed.sections || typeof parsed.sections !== 'object') {
      throw new Error('Missing or invalid sections');
    }
    if (!parsed.dataConfidence || typeof parsed.dataConfidence !== 'object') {
      throw new Error('Missing or invalid dataConfidence');
    }

    return {
      narrativeMarkdown: parsed.narrativeMarkdown,
      sections: {
        companySnapshot: parsed.sections.companySnapshot || '',
        brandSummary: parsed.sections.brandSummary || '',
        messagingSummary: parsed.sections.messagingSummary || '',
        productServiceSummary: parsed.sections.productServiceSummary || '',
        websiteSummary: parsed.sections.websiteSummary || '',
        seoSummary: parsed.sections.seoSummary || '',
        contentSummary: parsed.sections.contentSummary || '',
        opsSummary: parsed.sections.opsSummary || '',
        demandSummary: parsed.sections.demandSummary || '',
        mediaSummary: parsed.sections.mediaSummary || null,
        risks: parsed.sections.risks || '',
        opportunities: parsed.sections.opportunities || '',
        missingInfo: parsed.sections.missingInfo || '',
      },
      dataConfidence: {
        score: typeof parsed.dataConfidence.score === 'number'
          ? parsed.dataConfidence.score
          : 0,
        level: ['low', 'medium', 'high'].includes(parsed.dataConfidence.level)
          ? parsed.dataConfidence.level
          : 'low',
        reasons: Array.isArray(parsed.dataConfidence.reasons)
          ? parsed.dataConfidence.reasons
          : [],
      },
    };
  } catch (error) {
    console.error('[BrainNarrative] Failed to parse LLM response:', error);
    console.error('[BrainNarrative] Raw content:', content.slice(0, 500));
    throw new Error('Failed to parse narrative from AI response');
  }
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a comprehensive Company Brain narrative using AI
 *
 * @param data - Aggregated company data from getCompanyBrainData
 * @returns Complete narrative with sections and confidence assessment
 */
export async function generateCompanyBrainNarrative(
  data: CompanyBrainData
): Promise<CompanyBrainNarrative> {
  console.log('[BrainNarrative] Generating narrative for:', data.company.name);

  const openai = getOpenAI();

  // Prepare data payload
  const payload = prepareDataForLLM(data);

  // Build user message
  const userMessage = `Generate the Company Brain narrative for this company.

Here is the companyBrainData:

${JSON.stringify(payload, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from AI');
    }

    const narrative = parseNarrativeResponse(content);

    console.log('[BrainNarrative] Generated narrative:', {
      company: data.company.name,
      confidenceScore: narrative.dataConfidence.score,
      confidenceLevel: narrative.dataConfidence.level,
      narrativeLength: narrative.narrativeMarkdown.length,
    });

    return {
      ...narrative,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[BrainNarrative] Failed to generate narrative:', error);
    throw error;
  }
}

/**
 * Generate a fallback narrative when AI is unavailable
 * Uses available data to create a basic summary
 */
export function generateFallbackNarrative(
  data: CompanyBrainData
): CompanyBrainNarrative {
  const availability = getDataAvailabilitySummary(data);

  const narrativeMarkdown = `# Company Brain: ${data.company.name}

## Overview

This is an automatically generated summary based on available data. AI-powered narrative generation is currently unavailable.

**Company:** ${data.company.name}
**Domain:** ${data.company.domain || 'Not specified'}
**Type:** ${data.company.type || 'Not specified'}
**Stage:** ${data.company.stage || 'Not specified'}
**Industry:** ${data.company.industry || 'Not specified'}

## Data Availability

- **Available:** ${availability.available.join(', ') || 'None'}
- **Missing:** ${availability.missing.join(', ') || 'None'}

## Insights

${data.insights.length > 0
  ? data.insights.slice(0, 5).map(i => `- **${i.title}**: ${i.body.slice(0, 200)}...`).join('\n')
  : 'No insights recorded yet.'}

## Next Steps

Run diagnostic labs to gather more data and enable AI-powered narrative generation.
`;

  return {
    narrativeMarkdown,
    sections: {
      companySnapshot: `${data.company.name} is a ${data.company.type || 'company'} in ${data.company.industry || 'an unspecified industry'}.`,
      brandSummary: data.brandLab?.summary || 'No Brand Lab data available.',
      messagingSummary: 'Not enough data to assess messaging.',
      productServiceSummary: 'Not enough data to assess products/services.',
      websiteSummary: data.websiteLab?.summary || 'No Website Lab data available.',
      seoSummary: data.seoLab?.summary || 'No SEO Lab data available.',
      contentSummary: data.contentLab?.summary || 'No Content Lab data available.',
      opsSummary: data.opsLab?.summary || 'No Ops Lab data available.',
      demandSummary: data.demandLab?.summary || 'No Demand Lab data available.',
      mediaSummary: null,
      risks: 'Unable to assess risks without complete data.',
      opportunities: 'Run diagnostic labs to identify opportunities.',
      missingInfo: availability.missing.join(', '),
    },
    dataConfidence: {
      score: availability.percentage,
      level: availability.percentage >= 75 ? 'high' : availability.percentage >= 40 ? 'medium' : 'low',
      reasons: [
        `${availability.availableCount} of ${availability.totalPossible} data sources available`,
        ...availability.missing.slice(0, 3).map(m => `Missing: ${m}`),
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}
