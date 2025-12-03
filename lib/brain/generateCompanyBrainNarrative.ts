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

const SYSTEM_PROMPT = `You are Hive OS, an AI strategist. Synthesize company data into a scannable executive brief.

INPUT: JSON with company profile (including ga4Connected, gscConnected flags), diagnostic labs, GAP assessments, insights, and documents.

CRITICAL DATA PRIORITY RULES:
1. **company.ga4Connected** and **company.gscConnected** are the SOURCE OF TRUTH for analytics status
   - If ga4Connected=true, GA4 IS working - ignore any lab data saying otherwise
   - If gscConnected=true, Google Search Console IS working
2. Lab data may be STALE - always prefer current company profile data
3. For content/blog status, check insights array for actual content data before claiming "no blog"

FORMATTING RULES:
1. Use bullet points (•) for ALL content - no paragraphs
2. Each bullet = one key point, max 15 words
3. Lead with the insight, not filler words
4. Include scores where available: "Content: 30/100"
5. Skip sections entirely if no data (don't say "no data available")
6. Risks/Opportunities: exactly 3-5 bullets each, action-oriented
7. NEVER claim GA4/GSC is missing if ga4Connected/gscConnected is true

NARRATIVE STRUCTURE (use exactly these headers):
## At a Glance
• [Industry] [Type] | [Stage] | Team: [Size]
• [One-line positioning or what they do]
• GA4: [Connected/Not connected] | GSC: [Connected/Not connected]

## What's Working
• [Strength 1 with score if available]
• [Strength 2]

## Critical Gaps
• [Gap 1 with score/impact]
• [Gap 2]
• [Gap 3]

## Priority Actions
1. [Most urgent action] - [why]
2. [Second priority] - [expected impact]
3. [Third priority]

SECTION SUMMARIES (for sidebar cards):
- Max 2 bullets each, 12 words per bullet
- Focus on: score + top finding + recommended action
- If no lab data, skip that section entirely (return empty string)

RISKS/OPPORTUNITIES:
- Exactly 3-5 bullets each
- Format: "• **[Issue]**: [Impact/Action]"
- Be specific and accurate - verify claims against actual data
- DO NOT list GA4/GSC as missing if company profile shows they're connected

CONFIDENCE SCORING:
- 75-100 (High): 5+ labs complete with recent data
- 40-74 (Medium): 2-4 labs, some gaps
- 0-39 (Low): Minimal diagnostic data

Return valid JSON:
{
  "narrativeMarkdown": "markdown string with headers and bullets",
  "sections": {
    "companySnapshot": "1-2 bullets only",
    "brandSummary": "2 bullets max or empty string",
    "messagingSummary": "2 bullets max or empty string",
    "productServiceSummary": "2 bullets max or empty string",
    "websiteSummary": "2 bullets max or empty string",
    "seoSummary": "2 bullets max or empty string",
    "contentSummary": "2 bullets max or empty string",
    "opsSummary": "2 bullets max or empty string",
    "demandSummary": "2 bullets max or empty string",
    "mediaSummary": "2 bullets or null if no data",
    "risks": "3-5 bullets with **bold** labels",
    "opportunities": "3-5 bullets with **bold** labels",
    "missingInfo": "comma-separated list of missing labs"
  },
  "dataConfidence": {
    "score": 0-100,
    "level": "low" | "medium" | "high",
    "reasons": ["short reason 1", "short reason 2"]
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

  // Build available labs list
  const availableLabs: string[] = [];
  if (data.brandLab?.status === 'complete') availableLabs.push(`Brand Lab: ${data.brandLab.score}/100`);
  if (data.websiteLab?.status === 'complete') availableLabs.push(`Website Lab: ${data.websiteLab.score}/100`);
  if (data.seoLab?.status === 'complete') availableLabs.push(`SEO Lab: ${data.seoLab.score}/100`);
  if (data.contentLab?.status === 'complete') availableLabs.push(`Content Lab: ${data.contentLab.score}/100`);
  if (data.opsLab?.status === 'complete') availableLabs.push(`Ops Lab: ${data.opsLab.score}/100`);
  if (data.demandLab?.status === 'complete') availableLabs.push(`Demand Lab: ${data.demandLab.score}/100`);

  const narrativeMarkdown = `## At a Glance
• ${data.company.industry || 'Unknown'} ${data.company.type || 'Company'} | ${data.company.stage || 'Unknown Stage'} | Team: ${data.company.sizeBand || 'Unknown'}
• ${data.company.domain ? `Domain: ${data.company.domain}` : 'No domain specified'}

## Data Status
${availableLabs.length > 0 ? availableLabs.map(l => `• ${l}`).join('\n') : '• No diagnostic labs completed yet'}

## Priority Actions
1. **Run diagnostic labs** - gather data for AI analysis
2. **Complete Brand Lab** - understand positioning
3. **Run Website Lab** - assess digital presence

*AI narrative generation unavailable - showing basic summary*
`;

  // Build section summaries from lab data
  const buildSectionSummary = (lab: typeof data.brandLab, name: string): string => {
    if (!lab || lab.status !== 'complete') return '';
    return `• ${name}: ${lab.score}/100\n• ${lab.summary?.slice(0, 80) || 'See full report'}`;
  };

  return {
    narrativeMarkdown,
    sections: {
      companySnapshot: `• ${data.company.type || 'Company'} in ${data.company.industry || 'unknown industry'}\n• ${data.company.stage || 'Unknown'} stage`,
      brandSummary: buildSectionSummary(data.brandLab, 'Brand'),
      messagingSummary: '',
      productServiceSummary: '',
      websiteSummary: buildSectionSummary(data.websiteLab, 'Website'),
      seoSummary: buildSectionSummary(data.seoLab, 'SEO'),
      contentSummary: buildSectionSummary(data.contentLab, 'Content'),
      opsSummary: buildSectionSummary(data.opsLab, 'Ops'),
      demandSummary: buildSectionSummary(data.demandLab, 'Demand'),
      mediaSummary: null,
      risks: '• **Limited data**: Run labs for accurate risk assessment\n• **Unknown gaps**: Complete diagnostics to identify issues',
      opportunities: '• **Run labs**: Enable AI-powered insights\n• **Add documents**: Improve context for analysis',
      missingInfo: availability.missing.join(', '),
    },
    dataConfidence: {
      score: availability.percentage,
      level: availability.percentage >= 75 ? 'high' : availability.percentage >= 40 ? 'medium' : 'low',
      reasons: [
        `${availability.availableCount}/${availability.totalPossible} data sources`,
        ...availability.missing.slice(0, 2),
      ],
    },
    generatedAt: new Date().toISOString(),
  };
}
