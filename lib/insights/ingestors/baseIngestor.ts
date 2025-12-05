// lib/insights/ingestors/baseIngestor.ts
// Base infrastructure for insight extraction from diagnostic reports

import { aiForCompany } from '@/lib/ai-gateway/aiClient';
import { getLabContext, buildLabPromptContext, type LabId } from '@/lib/contextGraph/labContext';
import { getContextHealthSummary } from '@/lib/contextGraph/contextGateway';
import { getCompanyById } from '@/lib/airtable/companies';
import type { DiagnosticRun } from '@/lib/os/diagnostics/runs';
import {
  validateInsightUnits,
  INSIGHT_EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  type InsightUnit,
} from '../extractorSchema';
import { deduplicateAndCreate } from '../repo';

// ============================================================================
// Types
// ============================================================================

export interface IngestorParams {
  companyId: string;
  run: DiagnosticRun;
}

export interface IngestorResult {
  success: boolean;
  insightsCreated: number;
  insightsSkipped: number;
  error?: string;
}

export interface ReportDataExtractor {
  (run: DiagnosticRun): string;
}

export interface IngestorConfig {
  toolId: string;
  toolName: string;
  labId: LabId | null;
  extractReportData: ReportDataExtractor;
  systemPromptAddendum?: string;
}

// ============================================================================
// Base Ingestor
// ============================================================================

/**
 * Run insight extraction for a diagnostic report
 */
export async function runIngestor(
  params: IngestorParams,
  config: IngestorConfig
): Promise<IngestorResult> {
  const { companyId, run } = params;
  const { toolId, toolName, labId, extractReportData, systemPromptAddendum } = config;

  console.log(`[Ingestor:${toolId}] Starting insight extraction`, {
    companyId,
    runId: run.id,
  });

  try {
    // 1. Extract report data
    const reportData = extractReportData(run);
    if (!reportData || reportData.trim().length < 50) {
      console.log(`[Ingestor:${toolId}] Report data too short, skipping`);
      return { success: true, insightsCreated: 0, insightsSkipped: 0 };
    }

    // 2. Load context (if this is a Lab, get Lab context)
    let contextSummary = '';
    if (labId) {
      try {
        const labContext = await getLabContext(companyId, labId);
        contextSummary = buildLabPromptContext(labContext);
      } catch (error) {
        console.warn(`[Ingestor:${toolId}] Failed to load lab context:`, error);
      }
    }

    // 3. Get context health summary
    let healthSummary = '';
    try {
      const health = await getContextHealthSummary(companyId);
      healthSummary = `Context completeness: ${health.completeness}%, Freshness: ${health.freshness}%`;
      if (health.staleSections.length > 0) {
        healthSummary += `\nStale sections: ${health.staleSections.join(', ')}`;
      }
    } catch (error) {
      console.warn(`[Ingestor:${toolId}] Failed to load health summary:`, error);
    }

    // 4. Get company name
    let companyName = 'Unknown Company';
    try {
      const company = await getCompanyById(companyId);
      if (company?.name) {
        companyName = company.name;
      }
    } catch (error) {
      console.warn(`[Ingestor:${toolId}] Failed to get company name:`, error);
    }

    // 5. Build prompt
    const taskPrompt = buildExtractionPrompt({
      toolName,
      companyName,
      reportData,
      contextSummary: contextSummary || undefined,
      healthSummary: healthSummary || undefined,
    });

    // 6. Call AI
    const systemPrompt = systemPromptAddendum
      ? `${INSIGHT_EXTRACTION_SYSTEM_PROMPT}\n\n${systemPromptAddendum}`
      : INSIGHT_EXTRACTION_SYSTEM_PROMPT;

    const result = await aiForCompany(companyId, {
      type: 'Diagnostic Summary', // Use existing MemoryEntryType
      tags: ['Insights', toolName],
      relatedEntityId: run.id,
      systemPrompt,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 2000,
    });

    // 7. Parse and validate insights
    let rawInsights: unknown;
    try {
      rawInsights = JSON.parse(result.content);
    } catch {
      console.error(`[Ingestor:${toolId}] Failed to parse AI response as JSON`);
      return { success: false, insightsCreated: 0, insightsSkipped: 0, error: 'Invalid JSON response' };
    }

    const insights = validateInsightUnits(rawInsights);
    if (insights.length === 0) {
      console.log(`[Ingestor:${toolId}] No valid insights extracted`);
      return { success: true, insightsCreated: 0, insightsSkipped: 0 };
    }

    // 8. Deduplicate and create
    const { created, skipped } = await deduplicateAndCreate({
      units: insights,
      companyId,
      sourceType: 'tool_run', // Always 'tool_run' for diagnostic insights
      sourceRunId: run.id,
      toolSlug: toolId,
    });

    console.log(`[Ingestor:${toolId}] Extraction complete`, {
      extracted: insights.length,
      created: created.length,
      skipped,
    });

    return {
      success: true,
      insightsCreated: created.length,
      insightsSkipped: skipped,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Ingestor:${toolId}] Extraction failed:`, error);
    return {
      success: false,
      insightsCreated: 0,
      insightsSkipped: 0,
      error: message,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Safely extract JSON from run rawJson
 */
export function safeExtractRawJson(run: DiagnosticRun): Record<string, unknown> | null {
  if (!run.rawJson) return null;
  if (typeof run.rawJson !== 'object') return null;
  return run.rawJson as Record<string, unknown>;
}

/**
 * Extract Lab result data from various possible structures
 * Labs can store data in different places:
 * - rawEvidence.labResultV4.siteAssessment (Website Lab V4)
 * - siteAssessment directly
 * - module/score/issues/recommendations at root (standard lab result)
 */
export function extractLabData(run: DiagnosticRun): {
  score: number | null;
  summary: string | null;
  issues: string[];
  recommendations: string[];
  dimensions: Record<string, { score?: number; issues?: string[]; summary?: string }>;
  quickWins: string[];
  siteAssessment: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
} {
  const result = {
    score: run.score,
    summary: run.summary || null,
    issues: [] as string[],
    recommendations: [] as string[],
    dimensions: {} as Record<string, { score?: number; issues?: string[]; summary?: string }>,
    quickWins: [] as string[],
    siteAssessment: null as Record<string, unknown> | null,
    raw: null as Record<string, unknown> | null,
  };

  const raw = safeExtractRawJson(run);
  if (!raw) return result;
  result.raw = raw;

  // Try to find siteAssessment in various locations
  let siteAssessment: Record<string, unknown> | null = null;

  // Check rawEvidence.labResultV4.siteAssessment (Website Lab V4)
  const rawEvidence = raw.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
    if (labResult.siteAssessment) {
      siteAssessment = labResult.siteAssessment as Record<string, unknown>;
    }
  }

  // Check direct siteAssessment
  if (!siteAssessment && raw.siteAssessment) {
    siteAssessment = raw.siteAssessment as Record<string, unknown>;
  }

  if (siteAssessment) {
    result.siteAssessment = siteAssessment;

    // Extract score
    if (typeof siteAssessment.overallScore === 'number') {
      result.score = siteAssessment.overallScore;
    } else if (typeof siteAssessment.score === 'number') {
      result.score = siteAssessment.score;
    }

    // Extract summary
    if (siteAssessment.executiveSummary) {
      result.summary = String(siteAssessment.executiveSummary);
    } else if (siteAssessment.summary) {
      result.summary = String(siteAssessment.summary);
    }

    // Extract dimensions
    if (siteAssessment.dimensions && typeof siteAssessment.dimensions === 'object') {
      const dims = siteAssessment.dimensions as Record<string, Record<string, unknown>>;
      for (const [key, dim] of Object.entries(dims)) {
        result.dimensions[key] = {
          score: typeof dim.score === 'number' ? dim.score : undefined,
          issues: Array.isArray(dim.issues) ? dim.issues.map(i => String(typeof i === 'object' && i && 'title' in i ? (i as any).title : i)) : undefined,
          summary: typeof dim.summary === 'string' ? dim.summary : undefined,
        };
      }
    }

    // Extract issues
    if (Array.isArray(siteAssessment.criticalIssues)) {
      result.issues = siteAssessment.criticalIssues.map(i =>
        String(typeof i === 'object' && i && 'title' in i ? (i as any).title : i)
      );
    } else if (Array.isArray(siteAssessment.issues)) {
      result.issues = siteAssessment.issues.map(i =>
        String(typeof i === 'object' && i && 'title' in i ? (i as any).title : i)
      );
    }

    // Extract recommendations / quick wins
    if (Array.isArray(siteAssessment.quickWins)) {
      result.quickWins = siteAssessment.quickWins.map(q =>
        String(typeof q === 'object' && q && 'title' in q ? (q as any).title : q)
      );
    }
    if (Array.isArray(siteAssessment.recommendations)) {
      result.recommendations = siteAssessment.recommendations.map(r =>
        String(typeof r === 'object' && r && 'title' in r ? (r as any).title : r)
      );
    }
  }

  // Fallback to root-level data (standard lab result structure)
  if (result.issues.length === 0 && Array.isArray(raw.issues)) {
    result.issues = raw.issues.map(i =>
      String(typeof i === 'object' && i && 'title' in i ? (i as any).title : i)
    );
  }
  if (result.recommendations.length === 0 && Array.isArray(raw.recommendations)) {
    result.recommendations = raw.recommendations.map(r =>
      String(typeof r === 'object' && r && 'title' in r ? (r as any).title : r)
    );
  }
  if (!result.summary && raw.summary) {
    result.summary = String(raw.summary);
  }

  return result;
}

/**
 * Format scores for prompt
 */
export function formatScores(scores: Record<string, number | null | undefined>): string {
  return Object.entries(scores)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}/100`)
    .join('\n');
}

/**
 * Format array items for prompt
 */
export function formatArrayItems(items: unknown[], label: string, limit = 5): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  const formatted = items
    .slice(0, limit)
    .map((item) => {
      if (typeof item === 'string') return `- ${item}`;
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const title = obj.title || obj.name || obj.label || JSON.stringify(item);
        return `- ${title}`;
      }
      return `- ${String(item)}`;
    })
    .join('\n');
  return `**${label}:**\n${formatted}`;
}
