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
