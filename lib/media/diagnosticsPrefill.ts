// lib/media/diagnosticsPrefill.ts
// AI-powered fusion of diagnostics data into MediaPlanningInputs
//
// This module uses AI to intelligently map diagnostic findings from GAP,
// Website Lab, Brand Lab, etc. into the canonical MediaPlanningInputs schema.

import type { DiagnosticsBundle } from './diagnosticsInputs';
import type { MediaPlanningInputs } from './planningInput';
import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticsPrefillResult {
  /** Partial planning inputs derived from diagnostics */
  inputs: Partial<MediaPlanningInputs>;
  /** Confidence scores for each field (path like 'businessBrand.positioning' -> 0..1) */
  confidenceByField: Record<string, number>;
  /** Which diagnostic sources contributed to each field */
  sourceByField: Record<string, string>;
  /** Raw AI reasoning (for debugging) */
  aiReasoning?: string;
}

// ============================================================================
// AI Client
// ============================================================================

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ============================================================================
// Main Fusion Function
// ============================================================================

/**
 * Use AI to derive MediaPlanningInputs from diagnostic findings
 *
 * This function takes the assembled diagnostics bundle and intelligently
 * maps the findings into the MediaPlanningInputs schema, providing
 * confidence scores for each extracted field.
 */
export async function deriveMediaPlanningInputsFromDiagnostics(
  diagnostics: DiagnosticsBundle
): Promise<DiagnosticsPrefillResult> {
  console.log('[diagnosticsPrefill] Starting AI fusion for:', diagnostics.companyId);
  console.log('[diagnosticsPrefill] Available sources:', diagnostics.availableSources);

  // Check if we have any diagnostic data to work with
  const hasAnyData = Object.values(diagnostics.availableSources).some(Boolean);
  if (!hasAnyData) {
    console.log('[diagnosticsPrefill] No diagnostic data available');
    return {
      inputs: {},
      confidenceByField: {},
      sourceByField: {},
    };
  }

  // Build the diagnostic context for AI
  const diagnosticContext = buildDiagnosticContext(diagnostics);

  // Call AI to extract structured data
  try {
    const result = await callAIForExtraction(diagnosticContext);
    console.log('[diagnosticsPrefill] AI extraction complete:', {
      fieldsExtracted: Object.keys(result.inputs).length,
      confidenceScores: Object.keys(result.confidenceByField).length,
    });
    return result;
  } catch (error) {
    console.error('[diagnosticsPrefill] AI extraction failed:', error);
    // Return empty result on failure - don't block prefill
    return {
      inputs: {},
      confidenceByField: {},
      sourceByField: {},
    };
  }
}

// ============================================================================
// Context Building
// ============================================================================

interface DiagnosticContext {
  hasGap: boolean;
  hasWebsite: boolean;
  hasBrand: boolean;
  hasContent: boolean;
  hasSeo: boolean;
  hasDemand: boolean;
  hasOps: boolean;
  summaries: Record<string, string>;
  structuredData: Record<string, any>;
}

function buildDiagnosticContext(diagnostics: DiagnosticsBundle): DiagnosticContext {
  const context: DiagnosticContext = {
    hasGap: diagnostics.availableSources.gap,
    hasWebsite: diagnostics.availableSources.website,
    hasBrand: diagnostics.availableSources.brand,
    hasContent: diagnostics.availableSources.content,
    hasSeo: diagnostics.availableSources.seo,
    hasDemand: diagnostics.availableSources.demand,
    hasOps: diagnostics.availableSources.ops,
    summaries: {},
    structuredData: {},
  };

  // Extract summaries for AI context
  if (diagnostics.gap) {
    context.summaries.gap = diagnostics.gap.strategistView || diagnostics.gap.executiveSummary || '';
    context.structuredData.gap = {
      overallScore: diagnostics.gap.overallScore,
      maturityStage: diagnostics.gap.maturityStage,
      keyFindings: diagnostics.gap.keyFindings,
      quickWins: diagnostics.gap.quickWins,
      priorityAreas: diagnostics.gap.priorityAreas,
      dimensionScores: diagnostics.gap.dimensionScores,
      businessContext: diagnostics.gap.businessContext,
    };
  }

  if (diagnostics.website) {
    context.summaries.website = diagnostics.website.strategistView || diagnostics.website.executiveSummary || '';
    context.structuredData.website = {
      score: diagnostics.website.score,
      funnelIssues: diagnostics.website.funnelIssues,
      conversionBlocks: diagnostics.website.conversionBlocks,
      infraNotes: diagnostics.website.infraNotes,
      recommendations: diagnostics.website.recommendations,
      coreWebVitals: diagnostics.website.coreWebVitals,
    };
  }

  if (diagnostics.brand) {
    context.summaries.brand = diagnostics.brand.strategistView || diagnostics.brand.positioningSummary || '';
    context.structuredData.brand = {
      score: diagnostics.brand.score,
      positioningSummary: diagnostics.brand.positioningSummary,
      valueProps: diagnostics.brand.valueProps,
      differentiators: diagnostics.brand.differentiators,
      brandPerception: diagnostics.brand.brandPerception,
      strengths: diagnostics.brand.strengths,
      weaknesses: diagnostics.brand.weaknesses,
    };
  }

  if (diagnostics.content) {
    context.summaries.content = diagnostics.content.strategistView || '';
    context.structuredData.content = {
      score: diagnostics.content.score,
      keyTopics: diagnostics.content.keyTopics,
      contentGaps: diagnostics.content.contentGaps,
      audienceNeeds: diagnostics.content.audienceNeeds,
      topPerformingThemes: diagnostics.content.topPerformingThemes,
    };
  }

  if (diagnostics.seo) {
    context.summaries.seo = diagnostics.seo.strategistView || '';
    context.structuredData.seo = {
      score: diagnostics.seo.score,
      keywordThemes: diagnostics.seo.keywordThemes,
      organicCompetitors: diagnostics.seo.organicCompetitors,
      searchDemandNotes: diagnostics.seo.searchDemandNotes,
      domainAuthority: diagnostics.seo.domainAuthority,
      keywordOpportunities: diagnostics.seo.keywordOpportunities,
    };
  }

  if (diagnostics.demand) {
    context.summaries.demand = diagnostics.demand.strategistView || '';
    context.structuredData.demand = {
      score: diagnostics.demand.score,
      channelPerformanceSummary: diagnostics.demand.channelPerformanceSummary,
      bestChannels: diagnostics.demand.bestChannels,
      weakChannels: diagnostics.demand.weakChannels,
      demandSources: diagnostics.demand.demandSources,
      cacTrends: diagnostics.demand.cacTrends,
    };
  }

  if (diagnostics.ops) {
    context.summaries.ops = diagnostics.ops.strategistView || '';
    context.structuredData.ops = {
      score: diagnostics.ops.score,
      trackingStackNotes: diagnostics.ops.trackingStackNotes,
      ga4Health: diagnostics.ops.ga4Health,
      gscHealth: diagnostics.ops.gscHealth,
      gbpHealth: diagnostics.ops.gbpHealth,
      callTracking: diagnostics.ops.callTracking,
      crmNotes: diagnostics.ops.crmNotes,
      measurementLimitations: diagnostics.ops.measurementLimitations,
    };
  }

  return context;
}

// ============================================================================
// AI Extraction
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an expert media strategist assistant that extracts structured media planning inputs from diagnostic marketing reports.

You will receive diagnostic findings from various marketing assessment tools:
- GAP Assessment (overall marketing health)
- Website Lab (website UX/conversion analysis)
- Brand Lab (brand positioning and perception)
- Content Lab (content strategy analysis)
- SEO Lab (search optimization analysis)
- Demand Lab (demand generation analysis)
- Ops Lab (marketing operations/tracking)

Your job is to map these findings into a structured media planning schema. The schema has 13 categories:

1. businessBrand: Business model, positioning, brand context
2. objectivesKpis: Marketing goals, KPIs, targets
3. audience: Target segments, demographics, behaviors
4. productOffer: Products, pricing, promotions
5. historical: Past performance, channel history
6. digitalInfra: Tracking, GA4, CRM setup
7. competitive: Competitors, market share
8. creativeContent: Creative assets, messaging, content gaps
9. operational: Constraints, limitations, restrictions
10. budget: Budget information (rarely available from diagnostics)
11. channels: Channel preferences, restrictions
12. storeLocation: Multi-location info (if applicable)
13. risk: Risk tolerance indicators

RULES:
1. Only fill fields where you have strong evidence from the diagnostics
2. For each field you fill, provide a confidence score (0.0-1.0) based on evidence strength
3. Note which diagnostic source provided the data
4. Keep values concise and actionable
5. Use null for fields without sufficient evidence
6. Infer risk appetite from the tone of recommendations and current state

OUTPUT FORMAT (JSON):
{
  "inputs": {
    "businessBrand": {
      "positioning": "...",
      "valueProps": ["..."],
      "differentiators": ["..."],
      "brandPerception": "..."
    },
    "audience": {
      "coreSegments": ["..."],
      "geos": "..."
    },
    ...other categories with evidence...
  },
  "confidenceByField": {
    "businessBrand.positioning": 0.85,
    "businessBrand.valueProps": 0.9,
    "audience.coreSegments": 0.7,
    ...
  },
  "sourceByField": {
    "businessBrand.positioning": "brand_lab",
    "businessBrand.valueProps": "brand_lab",
    "audience.coreSegments": "gap",
    "digitalInfra.ga4Health": "ops_lab",
    ...
  },
  "reasoning": "Brief explanation of key extractions and confidence levels"
}`;

async function callAIForExtraction(context: DiagnosticContext): Promise<DiagnosticsPrefillResult> {
  const openai = getOpenAI();

  // Build user message with diagnostic data
  const userMessage = buildExtractionPrompt(context);

  console.log('[diagnosticsPrefill] Calling OpenAI for extraction...');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  // Parse response
  try {
    const parsed = JSON.parse(content);
    return {
      inputs: parsed.inputs || {},
      confidenceByField: parsed.confidenceByField || {},
      sourceByField: parsed.sourceByField || {},
      aiReasoning: parsed.reasoning,
    };
  } catch (error) {
    console.error('[diagnosticsPrefill] Failed to parse AI response:', content);
    throw new Error('Invalid AI response format');
  }
}

function buildExtractionPrompt(context: DiagnosticContext): string {
  const sections: string[] = [];

  sections.push('# Diagnostic Data for Media Planning Input Extraction\n');

  // Add available sources summary
  const sources: string[] = [];
  if (context.hasGap) sources.push('GAP Assessment');
  if (context.hasWebsite) sources.push('Website Lab');
  if (context.hasBrand) sources.push('Brand Lab');
  if (context.hasContent) sources.push('Content Lab');
  if (context.hasSeo) sources.push('SEO Lab');
  if (context.hasDemand) sources.push('Demand Lab');
  if (context.hasOps) sources.push('Ops Lab');

  sections.push(`Available diagnostic sources: ${sources.join(', ')}\n`);

  // Add each diagnostic section
  if (context.hasGap && context.structuredData.gap) {
    sections.push('## GAP Assessment\n');
    if (context.summaries.gap) {
      sections.push(`### Summary\n${context.summaries.gap}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.gap, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasWebsite && context.structuredData.website) {
    sections.push('## Website Lab\n');
    if (context.summaries.website) {
      sections.push(`### Summary\n${context.summaries.website}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.website, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasBrand && context.structuredData.brand) {
    sections.push('## Brand Lab\n');
    if (context.summaries.brand) {
      sections.push(`### Summary\n${context.summaries.brand}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.brand, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasContent && context.structuredData.content) {
    sections.push('## Content Lab\n');
    if (context.summaries.content) {
      sections.push(`### Summary\n${context.summaries.content}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.content, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasSeo && context.structuredData.seo) {
    sections.push('## SEO Lab\n');
    if (context.summaries.seo) {
      sections.push(`### Summary\n${context.summaries.seo}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.seo, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasDemand && context.structuredData.demand) {
    sections.push('## Demand Lab\n');
    if (context.summaries.demand) {
      sections.push(`### Summary\n${context.summaries.demand}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.demand, null, 2)}\n\`\`\`\n`);
  }

  if (context.hasOps && context.structuredData.ops) {
    sections.push('## Ops Lab\n');
    if (context.summaries.ops) {
      sections.push(`### Summary\n${context.summaries.ops}\n`);
    }
    sections.push(`### Structured Data\n\`\`\`json\n${JSON.stringify(context.structuredData.ops, null, 2)}\n\`\`\`\n`);
  }

  sections.push('\n---\n');
  sections.push('Extract media planning inputs from the above diagnostics. Only include fields where you have strong evidence. Output as JSON.');

  return sections.join('\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Map diagnostic source IDs to human-readable labels
 */
export function getDiagnosticSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    gap: 'GAP Assessment',
    gap_ia: 'GAP-IA',
    gap_full: 'Full GAP',
    gap_heavy: 'Heavy GAP',
    website_lab: 'Website Lab',
    brand_lab: 'Brand Lab',
    content_lab: 'Content Lab',
    seo_lab: 'SEO Lab',
    demand_lab: 'Demand Lab',
    ops_lab: 'Ops Lab',
  };
  return labels[source] || source;
}

/**
 * Check if a field path exists in the prefill result
 */
export function hasFieldValue(
  result: DiagnosticsPrefillResult,
  fieldPath: string
): boolean {
  const parts = fieldPath.split('.');
  let current: any = result.inputs;

  for (const part of parts) {
    if (current === undefined || current === null) return false;
    current = current[part];
  }

  return current !== undefined && current !== null && current !== '';
}

/**
 * Get confidence for a field
 */
export function getFieldConfidence(
  result: DiagnosticsPrefillResult,
  fieldPath: string
): number {
  return result.confidenceByField[fieldPath] ?? 0;
}
