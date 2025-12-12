// lib/os/contextAi/generateCompanyStatusNarrative.ts
// AI helper for generating company status narratives
//
// Uses OpenAI to generate human-readable summaries of company status
// from structured data (status, analytics, findings).

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import type { CompanyStatusNarrative } from '@/lib/types/companyNarrative';
import { getFallbackNarrative } from '@/lib/types/companyNarrative';

// ============================================================================
// OpenAI Client (lazy initialization)
// ============================================================================

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

// ============================================================================
// Types
// ============================================================================

export interface GenerateNarrativeInput {
  companyId: string;
  companyName?: string;
  status: CompanyStatusSummary;
  analytics: CompanyAnalyticsSnapshot;
  existingFindings?: {
    title: string;
    severity: string;
    labSlug?: string;
  }[];
}

interface NarrativeResponse {
  summary: string;
  whatsWorking: string[];
  whatsNotWorking: string[];
  priorityFocus: string[];
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are an expert marketing strategist embedded inside Hive OS, a marketing operations platform.

You receive a structured snapshot of a single company, including:
- Commercial status (pipeline stage, lifecycle stage)
- Diagnostic status (GAP score & maturity)
- Analytics snapshot (traffic, conversions, CPL/ROAS, trends)
- A few existing findings (from GAP or Labs)

Your job is to output a JSON object with these exact fields:
- "summary": 2-3 sentences describing where this company is right now. Be specific and reference the data.
- "whatsWorking": an array of 2-5 short bullet strings (each <80 chars) highlighting strengths or positive trends.
- "whatsNotWorking": an array of 2-5 short bullet strings (each <80 chars) highlighting weaknesses, risks, or negative trends.
- "priorityFocus": an array of 3-5 short bullet strings (each <100 chars) describing the most important focus areas for the next 30-90 days.

Guidelines:
- Be concise, concrete, and grounded in the data provided.
- Do NOT include marketing fluff or generic advice.
- Reference specific numbers and trends when available.
- If analytics show no data (hasAnalytics=false), acknowledge this limitation.
- If GAP score exists, reference the maturity level.
- For media companies, highlight CPL/ROAS trends if available.

Return ONLY valid JSON matching the requested schema. No markdown, no extra text, no code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a company status narrative using AI
 *
 * This function:
 * 1. Checks if there's enough data to warrant an AI call
 * 2. Builds a compact payload for the model
 * 3. Calls OpenAI with structured JSON output
 * 4. Parses and validates the response
 * 5. Falls back gracefully on errors
 *
 * @param input - Company status, analytics, and optional findings
 * @returns CompanyStatusNarrative
 */
export async function generateCompanyStatusNarrative(
  input: GenerateNarrativeInput
): Promise<CompanyStatusNarrative> {
  const { companyId, companyName, status, analytics, existingFindings = [] } = input;

  console.log('[contextAi/narrative] Generating narrative for company:', {
    companyId,
    hasAnalytics: analytics.hasAnalytics,
    gapScore: status.gapScore,
    findingsCount: existingFindings.length,
  });

  // Short-circuit if there's clearly not enough data
  if (!analytics.hasAnalytics && !status.gapScore && existingFindings.length === 0) {
    console.log('[contextAi/narrative] Insufficient data, returning fallback');
    return getFallbackNarrative('no_analytics');
  }

  try {
    // Build a compact payload for the model
    const userPayload = buildUserPayload({
      companyId,
      companyName,
      status,
      analytics,
      existingFindings,
    });

    const openai = getOpenAI();
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.3, // Low variance for consistent output
      response_format: { type: 'json_object' },
      max_tokens: 1500,
    });

    const elapsed = Date.now() - startTime;
    console.log('[contextAi/narrative] OpenAI response received:', { elapsed, companyId });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[contextAi/narrative] No content from OpenAI');
      return getFallbackNarrative('error');
    }

    // Parse and validate response
    const parsed = JSON.parse(content) as NarrativeResponse;
    const narrative: CompanyStatusNarrative = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      whatsWorking: Array.isArray(parsed.whatsWorking) ? parsed.whatsWorking.slice(0, 5) : [],
      whatsNotWorking: Array.isArray(parsed.whatsNotWorking) ? parsed.whatsNotWorking.slice(0, 5) : [],
      priorityFocus: Array.isArray(parsed.priorityFocus) ? parsed.priorityFocus.slice(0, 5) : [],
      updatedAt: new Date().toISOString(),
      isAiGenerated: true,
      modelUsed: 'gpt-4o-mini',
    };

    console.log('[contextAi/narrative] Narrative generated:', {
      companyId,
      summaryLength: narrative.summary.length,
      whatsWorkingCount: narrative.whatsWorking.length,
      whatsNotWorkingCount: narrative.whatsNotWorking.length,
      priorityFocusCount: narrative.priorityFocus.length,
    });

    return narrative;
  } catch (error) {
    console.error('[contextAi/narrative] Error generating narrative:', error);
    return getFallbackNarrative('error');
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a compact payload for the AI model
 */
function buildUserPayload(input: GenerateNarrativeInput): Record<string, unknown> {
  const { companyId, companyName, status, analytics, existingFindings } = input;

  // Build compact status object
  const statusData: Record<string, unknown> = {
    lifecycleStage: status.lifecycleStage,
    overallStatus: status.overallStatus,
  };

  if (status.pipelineStage) statusData.pipelineStage = status.pipelineStage;
  if (status.gapScore !== null && status.gapScore !== undefined) {
    statusData.gapScore = status.gapScore;
    statusData.gapMaturity = status.gapMaturity;
  }
  if (status.lastGapRunAt) statusData.lastGapRunAt = status.lastGapRunAt;
  if (status.highSeverityIssuesCount) statusData.highSeverityIssues = status.highSeverityIssuesCount;
  if (status.totalIssuesCount) statusData.totalIssues = status.totalIssuesCount;
  if (status.mediaProgramActive) {
    statusData.mediaProgramActive = true;
    statusData.mediaProgramHealth = status.mediaProgramHealth;
  }
  if (status.overallStatusReason) statusData.statusReason = status.overallStatusReason;

  // Build compact analytics object
  const analyticsData: Record<string, unknown> = {
    hasAnalytics: analytics.hasAnalytics,
  };

  if (analytics.hasGa4) {
    analyticsData.hasGa4 = true;
    if (analytics.sessions !== null && analytics.sessions !== undefined) {
      analyticsData.sessions = analytics.sessions;
      analyticsData.sessionsChange = analytics.sessionsChangePct;
    }
    if (analytics.conversions !== null && analytics.conversions !== undefined) {
      analyticsData.conversions = analytics.conversions;
      analyticsData.conversionsChange = analytics.conversionsChangePct;
    }
    if (analytics.conversionRate !== null) {
      analyticsData.conversionRate = analytics.conversionRate;
    }
  }

  if (analytics.hasGsc) {
    analyticsData.hasGsc = true;
    if (analytics.organicClicks !== null && analytics.organicClicks !== undefined) {
      analyticsData.organicClicks = analytics.organicClicks;
      analyticsData.organicClicksChange = analytics.organicClicksChangePct;
    }
  }

  if (analytics.cpl !== null && analytics.cpl !== undefined) {
    analyticsData.cpl = analytics.cpl;
    analyticsData.cplChange = analytics.cplChangePct;
  }

  if (analytics.roas !== null && analytics.roas !== undefined) {
    analyticsData.roas = analytics.roas;
  }

  if (analytics.trend) analyticsData.trend = analytics.trend;
  if (analytics.keyAlerts?.length) analyticsData.keyAlerts = analytics.keyAlerts;

  // Build payload
  const payload: Record<string, unknown> = {
    companyId,
    status: statusData,
    analytics: analyticsData,
  };

  if (companyName) payload.companyName = companyName;

  // Include top findings (limit to 10 for token efficiency)
  if (existingFindings && existingFindings.length > 0) {
    payload.topFindings = existingFindings.slice(0, 10).map((f) => ({
      title: f.title,
      severity: f.severity,
      lab: f.labSlug,
    }));
  }

  return payload;
}
