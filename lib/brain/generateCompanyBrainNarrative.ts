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

const SYSTEM_PROMPT = `You are Hive OS, an AI strategist creating a comprehensive Company Intelligence Narrative.

INPUT: JSON with company profile (including ga4Connected, gscConnected flags), diagnostic labs, GAP assessments, insights, and documents.

CRITICAL DATA PRIORITY RULES:
1. **company.ga4Connected** and **company.gscConnected** are the SOURCE OF TRUTH for analytics status
   - If ga4Connected=true, GA4 IS working - ignore any lab data saying otherwise
   - If gscConnected=true, Google Search Console IS working
2. Lab data may be STALE - always prefer current company profile data
3. For content/blog status, check insights array for actual content data before claiming "no blog"
4. NEVER claim GA4/GSC is missing if ga4Connected/gscConnected is true

WRITING STYLE:
- Write in full, detailed prose - not bullet points (except for strengths/risks/opportunities)
- Be thorough and insightful, providing real strategic value
- Include specific numbers, scores, and data points inline
- Use professional but accessible language
- Each section should be 2-4 sentences of substantive analysis

CRITICAL FORMATTING RULES:
- Add TWO blank lines before each ## heading
- Add ONE blank line before each ### heading
- Add ONE blank line between paragraphs within a section
- Never write multiple paragraphs run together - always separate with blank lines
- The markdown must have clear visual breathing room throughout

NARRATIVE STRUCTURE (use exactly these markdown headers):

# Company Intelligence Narrative

## Executive Summary
A comprehensive 3-4 sentence overview of the company: who they are, what they do, their current stage, and the overall health of their digital presence. Include key metrics like overall scores if available.

## Company Profile

### Industry & Positioning
Describe their market position, target audience, and competitive landscape in 2-3 sentences.

### Business Stage
Current growth phase, team size, and operational maturity in 2-3 sentences.

### Analytics Status
State clearly: GA4 is [connected/not connected]. Google Search Console is [connected/not connected]. Add context about what data is available.

## Brand & Messaging
Analyze their brand strength, messaging clarity, and market positioning. Reference Brand Lab scores and findings. Discuss voice, differentiation, and how well their messaging resonates with their ICP.

## Digital Presence

### Website Performance
Evaluate their website effectiveness including UX, conversion optimization, technical performance, and mobile experience. Include Website Lab scores and specific findings.

### SEO & Search Visibility
Assess their organic search presence, keyword rankings, technical SEO health, and content discoverability. Include SEO Lab scores and key metrics.

### Content Strategy
Analyze their content marketing efforts including blog quality, publishing frequency, topic coverage, and content gaps. Include Content Lab scores and insights.

## Demand Generation
Evaluate their lead generation, marketing channels, funnel performance, and conversion metrics. Include Demand Lab findings and any analytics insights.

## Operations & Infrastructure
Assess their marketing operations maturity, tool stack, automation capabilities, and process efficiency. Include Ops Lab scores.

## Strategic Assessment

### Key Strengths
Identify 3-5 major strengths. Format each as a bullet point with the strength name in bold, then explanation:
- **Strength Name** — Explanation with evidence.

### Critical Risks
Identify 3-5 significant risks or gaps. Format each as a bullet point with the risk name in bold, then explanation:
- **Risk Name** — Explanation with specific impact. Be accurate - verify claims against actual data.

### Growth Opportunities
Identify 3-5 actionable opportunities. Format each as a bullet point with the opportunity name in bold, then explanation:
- **Opportunity Name** — Explanation with expected impact.

## Recommended Actions
Provide 3-5 prioritized recommendations as a numbered list. Each should include the action, rationale, and expected impact.

END OF NARRATIVE - Do not include anything below this line in the narrativeMarkdown output.

=== SEPARATE JSON FIELDS (not part of narrativeMarkdown) ===

For the "sections" object in the JSON response, write 2-3 concise sentences per field summarizing that topic. Focus on key score, top finding, and one recommended action. If no lab data exists for a section, return empty string.

CONFIDENCE SCORING:
- 75-100 (High): 5+ labs complete with recent data
- 40-74 (Medium): 2-4 labs, some gaps
- 0-39 (Low): Minimal diagnostic data

Return valid JSON:
{
  "narrativeMarkdown": "full markdown narrative with all headers and prose content",
  "sections": {
    "companySnapshot": "2-3 sentence company overview",
    "brandSummary": "2-3 sentences on brand/messaging or empty string",
    "messagingSummary": "2-3 sentences on messaging clarity or empty string",
    "productServiceSummary": "2-3 sentences on product/service offering or empty string",
    "websiteSummary": "2-3 sentences on website performance or empty string",
    "seoSummary": "2-3 sentences on SEO health or empty string",
    "contentSummary": "2-3 sentences on content strategy or empty string",
    "opsSummary": "2-3 sentences on operations or empty string",
    "demandSummary": "2-3 sentences on demand generation or empty string",
    "mediaSummary": "2-3 sentences on media/advertising or null if no data",
    "risks": "3-5 risks with **bold** labels and explanations",
    "opportunities": "3-5 opportunities with **bold** labels and explanations",
    "missingInfo": "comma-separated list of missing labs/data"
  },
  "dataConfidence": {
    "score": 0-100,
    "level": "low" | "medium" | "high",
    "reasons": ["reason 1", "reason 2"]
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
 * Calculate data confidence based on actual diagnostic run confidence
 * Falls back to data availability percentage if no diagnostic confidence available
 */
function calculateDataConfidence(
  data: CompanyBrainData,
  availability: { availableCount: number; totalPossible: number; percentage: number; missing: string[] }
): DataConfidence {
  // Try to extract confidence from the most recent diagnostic run with confidence data
  // Priority: GAP Plan > GAP Snapshot > Individual Labs
  const confidenceSources: Array<{ level?: string; score?: number; source: string }> = [];

  // Check GAP Plan rawJson for dataConfidence
  if (data.gapPlan?.rawJson && data.gapPlan.status === 'complete') {
    const raw = data.gapPlan.rawJson as any;
    const dc = raw.dataConfidence || raw.fullGap?.dataConfidence || raw.dataConfidenceScore;
    if (dc) {
      const level = typeof dc === 'string' ? dc : dc.level;
      const score = typeof dc === 'string' ? (dc === 'high' ? 85 : dc === 'medium' ? 60 : 35) : dc.score;
      confidenceSources.push({ level, score, source: 'GAP Plan' });
    }
  }

  // Check GAP Snapshot rawJson for dataConfidence
  if (data.gapSnapshot?.rawJson && data.gapSnapshot.status === 'complete') {
    const raw = data.gapSnapshot.rawJson as any;
    const dc = raw.dataConfidence || raw.initialAssessment?.dataConfidence;
    if (dc) {
      const level = typeof dc === 'string' ? dc : dc.level;
      const score = typeof dc === 'string' ? (dc === 'high' ? 85 : dc === 'medium' ? 60 : 35) : dc.score;
      confidenceSources.push({ level, score, source: 'GAP Snapshot' });
    }
  }

  // Check individual labs for confidence
  const labs = [
    { lab: data.brandLab, name: 'Brand Lab' },
    { lab: data.websiteLab, name: 'Website Lab' },
    { lab: data.seoLab, name: 'SEO Lab' },
    { lab: data.contentLab, name: 'Content Lab' },
    { lab: data.opsLab, name: 'Ops Lab' },
    { lab: data.demandLab, name: 'Demand Lab' },
  ];

  for (const { lab, name } of labs) {
    if (lab?.rawJson && lab.status === 'complete') {
      const raw = lab.rawJson as any;
      const dc = raw.dataConfidence || raw.confidence;
      if (dc) {
        const level = typeof dc === 'string' ? dc : dc.level;
        const score = typeof dc === 'string' ? (dc === 'high' ? 85 : dc === 'medium' ? 60 : 35) : dc.score;
        confidenceSources.push({ level, score, source: name });
      }
    }
  }

  // If we have confidence data from diagnostics, use the average
  if (confidenceSources.length > 0) {
    const validScores = confidenceSources.filter(s => s.score != null).map(s => s.score!);
    const avgScore = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 60;

    const level: 'low' | 'medium' | 'high' = avgScore >= 70 ? 'high' : avgScore >= 40 ? 'medium' : 'low';

    return {
      score: avgScore,
      level,
      reasons: [
        `Based on ${confidenceSources.length} diagnostic${confidenceSources.length > 1 ? 's' : ''}: ${confidenceSources.map(s => s.source).join(', ')}`,
        ...availability.missing.slice(0, 1),
      ],
    };
  }

  // Fallback to data availability percentage
  return {
    score: availability.percentage,
    level: availability.percentage >= 75 ? 'high' : availability.percentage >= 40 ? 'medium' : 'low',
    reasons: [
      `${availability.availableCount}/${availability.totalPossible} data sources available`,
      ...availability.missing.slice(0, 2),
    ],
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

    // Log what we got for debugging
    console.log('[BrainNarrative] Parsed response keys:', Object.keys(parsed));

    // Get narrative - required field
    const narrativeMarkdown = parsed.narrativeMarkdown || parsed.narrative || '';
    if (!narrativeMarkdown) {
      console.warn('[BrainNarrative] Missing narrativeMarkdown, using empty string');
    }

    // Get sections - use fallbacks if missing
    const sections = parsed.sections || {};
    if (!parsed.sections) {
      console.warn('[BrainNarrative] Missing sections object, using empty defaults');
    }

    // Get dataConfidence - use fallbacks if missing
    const dataConfidence = parsed.dataConfidence || {};
    if (!parsed.dataConfidence) {
      console.warn('[BrainNarrative] Missing dataConfidence object, using defaults');
    }

    return {
      narrativeMarkdown,
      sections: {
        companySnapshot: sections.companySnapshot || '',
        brandSummary: sections.brandSummary || '',
        messagingSummary: sections.messagingSummary || '',
        productServiceSummary: sections.productServiceSummary || '',
        websiteSummary: sections.websiteSummary || '',
        seoSummary: sections.seoSummary || '',
        contentSummary: sections.contentSummary || '',
        opsSummary: sections.opsSummary || '',
        demandSummary: sections.demandSummary || '',
        mediaSummary: sections.mediaSummary || null,
        risks: sections.risks || '',
        opportunities: sections.opportunities || '',
        missingInfo: sections.missingInfo || '',
      },
      dataConfidence: {
        score: typeof dataConfidence.score === 'number'
          ? dataConfidence.score
          : 0,
        level: ['low', 'medium', 'high'].includes(dataConfidence.level)
          ? dataConfidence.level
          : 'low',
        reasons: Array.isArray(dataConfidence.reasons)
          ? dataConfidence.reasons
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
    dataConfidence: calculateDataConfidence(data, availability),
    generatedAt: new Date().toISOString(),
  };
}
