// lib/os/contextAi/generateAnalyticsFindings.ts
// AI helper for generating analytics-derived findings
//
// Uses OpenAI to analyze analytics data and generate structured findings
// that can be written to the Brain/diagnostics system.

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { CompanyAnalyticsSnapshot } from '@/lib/types/companyAnalytics';
import type { CompanyStatusSummary } from '@/lib/types/companyStatus';

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

/**
 * Lab slug for analytics-derived findings
 */
export type AnalyticsFindingLabSlug = 'analytics' | 'media' | 'seo';

/**
 * Severity levels for findings
 */
export type AnalyticsFindingSeverity = 'low' | 'medium' | 'high';

/**
 * A finding derived from analytics data
 */
export interface AnalyticsFinding {
  /** Lab slug for categorization */
  labSlug: AnalyticsFindingLabSlug;

  /** Severity level */
  severity: AnalyticsFindingSeverity;

  /** Short title (e.g., "Organic sessions down 22% vs prior period") */
  title: string;

  /** 2-3 sentences explaining the issue or opportunity */
  description: string;

  /** 1-2 sentences describing a concrete action */
  recommendedAction: string;

  /** Source identifier for deduplication */
  source: 'analytics_ai';
}

export interface GenerateAnalyticsFindingsInput {
  analytics: CompanyAnalyticsSnapshot;
  status?: CompanyStatusSummary;
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a marketing analytics diagnostician for Hive OS.

You receive an analytics snapshot for a company containing:
- Traffic metrics (sessions, conversions, conversion rate)
- SEO metrics (organic clicks, impressions)
- Media metrics (CPL, ROAS, spend)
- Trend indicators and percent changes vs prior period

Your job is to identify meaningful changes, problems, or opportunities and output a JSON array of 0-6 "findings".

Each finding must have these exact fields:
- "labSlug": "analytics" (general), "media" (paid/CPL/ROAS), or "seo" (organic/search)
- "severity": "low", "medium", or "high"
- "title": Short title (<60 chars), e.g., "Organic sessions down 22% vs prior period"
- "description": 2-3 sentences explaining the issue/opportunity with specific numbers
- "recommendedAction": 1-2 sentences describing a concrete action

Guidelines:
- Only generate findings for MEANINGFUL changes (>10% swings, notable patterns)
- High severity: >25% negative change or critical metric failure
- Medium severity: 10-25% negative change or concerning pattern
- Low severity: Minor issues or optimization opportunities
- Do NOT generate findings for stable or slightly positive metrics
- Be specific about numbers and percentages
- If no significant issues, return an empty array []

Return ONLY valid JSON (array of objects). No markdown, no extra text, no code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate analytics-derived findings using AI
 *
 * Analyzes the analytics snapshot and generates structured findings
 * that can be written to the Brain/diagnostics system.
 *
 * @param input - Analytics snapshot and optional status
 * @returns Array of AnalyticsFinding objects
 */
export async function generateAnalyticsFindings(
  input: GenerateAnalyticsFindingsInput
): Promise<AnalyticsFinding[]> {
  const { analytics, status } = input;

  console.log('[contextAi/findings] Generating analytics findings:', {
    companyId: analytics.companyId,
    hasAnalytics: analytics.hasAnalytics,
    hasGa4: analytics.hasGa4,
    hasGsc: analytics.hasGsc,
  });

  // No analytics = no findings
  if (!analytics.hasAnalytics) {
    console.log('[contextAi/findings] No analytics data, returning empty');
    return [];
  }

  // Check if there's any meaningful data to analyze
  const hasTrafficData = analytics.sessions !== null && analytics.sessions !== undefined;
  const hasSeoData = analytics.organicClicks !== null && analytics.organicClicks !== undefined;
  const hasMediaData = analytics.cpl !== null || analytics.roas !== null;

  if (!hasTrafficData && !hasSeoData && !hasMediaData) {
    console.log('[contextAi/findings] No meaningful metrics to analyze');
    return [];
  }

  try {
    // Build compact payload
    const userPayload = buildUserPayload(analytics, status);

    const openai = getOpenAI();
    const startTime = Date.now();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(userPayload) },
      ],
      temperature: 0.2, // Low variance for consistent findings
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const elapsed = Date.now() - startTime;
    console.log('[contextAi/findings] OpenAI response received:', { elapsed });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[contextAi/findings] No content from OpenAI');
      return [];
    }

    // Parse response - expect either array directly or object with findings array
    const parsed = JSON.parse(content);
    const rawFindings = Array.isArray(parsed) ? parsed : (parsed.findings || []);

    if (!Array.isArray(rawFindings)) {
      console.error('[contextAi/findings] Response is not an array');
      return [];
    }

    // Validate and normalize findings
    const findings: AnalyticsFinding[] = rawFindings
      .map((f: Record<string, unknown>): AnalyticsFinding | null => {
        if (!f || typeof f.title !== 'string' || !f.title) return null;

        // Validate and normalize labSlug
        let labSlug: AnalyticsFindingLabSlug = 'analytics';
        if (f.labSlug === 'media' || f.labSlug === 'seo') {
          labSlug = f.labSlug;
        }

        // Validate and normalize severity
        let severity: AnalyticsFindingSeverity = 'medium';
        if (f.severity === 'high' || f.severity === 'low') {
          severity = f.severity;
        }

        return {
          labSlug,
          severity,
          title: String(f.title).slice(0, 100),
          description: typeof f.description === 'string' ? f.description : '',
          recommendedAction: typeof f.recommendedAction === 'string' ? f.recommendedAction : '',
          source: 'analytics_ai',
        };
      })
      .filter((f): f is AnalyticsFinding => f !== null)
      .slice(0, 6); // Limit to 6 findings

    console.log('[contextAi/findings] Findings generated:', {
      companyId: analytics.companyId,
      count: findings.length,
      severities: findings.map((f) => f.severity),
    });

    return findings;
  } catch (error) {
    console.error('[contextAi/findings] Error generating findings:', error);
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build a compact payload for the AI model
 */
function buildUserPayload(
  analytics: CompanyAnalyticsSnapshot,
  status?: CompanyStatusSummary
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    companyId: analytics.companyId,
    range: analytics.range,
    hasAnalytics: analytics.hasAnalytics,
  };

  // Traffic metrics
  if (analytics.hasGa4) {
    payload.traffic = {
      sessions: analytics.sessions,
      sessionsChangePct: analytics.sessionsChangePct,
      conversions: analytics.conversions,
      conversionsChangePct: analytics.conversionsChangePct,
      conversionRate: analytics.conversionRate,
    };
  }

  // SEO metrics
  if (analytics.hasGsc) {
    payload.seo = {
      organicClicks: analytics.organicClicks,
      organicClicksChangePct: analytics.organicClicksChangePct,
      organicImpressions: analytics.organicImpressions,
    };
  }

  // Media metrics
  if (analytics.cpl !== null || analytics.roas !== null || analytics.mediaSpend !== null) {
    payload.media = {
      cpl: analytics.cpl,
      cplChangePct: analytics.cplChangePct,
      roas: analytics.roas,
      mediaSpend: analytics.mediaSpend,
      mediaSpendChangePct: analytics.mediaSpendChangePct,
    };
  }

  // Overall trend
  if (analytics.trend) {
    payload.overallTrend = analytics.trend;
  }

  // Key alerts already identified
  if (analytics.keyAlerts?.length) {
    payload.existingAlerts = analytics.keyAlerts;
  }

  // Status context (if available)
  if (status) {
    payload.statusContext = {
      lifecycleStage: status.lifecycleStage,
      mediaProgramActive: status.mediaProgramActive,
      gapScore: status.gapScore,
    };
  }

  return payload;
}
