// lib/os/diagnostics/runs.ts
// DiagnosticRuns abstraction layer for Hive OS
//
// This module provides a unified interface for diagnostic runs across all tools.
// It wraps the existing GAP-Heavy Run infrastructure to provide a consistent
// API for the Diagnostics Suite.

import {
  createRecord,
  updateRecord,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

// ============================================================================
// Types
// ============================================================================

/**
 * Diagnostic tool identifiers
 * Maps to the tools available in the Diagnostics Suite
 */
export type DiagnosticToolId =
  | 'gapSnapshot'    // GAP-IA Initial Assessment
  | 'gapPlan'        // Full GAP Plan generation
  | 'gapHeavy'       // Deep multi-source diagnostic (Heavy Worker V3)
  | 'websiteLab'     // Website UX/Conversion diagnostic
  | 'brandLab'       // Brand health diagnostic
  | 'contentLab'     // Content diagnostic
  | 'seoLab'         // SEO diagnostic
  | 'demandLab'      // Demand generation diagnostic
  | 'opsLab';        // Marketing operations diagnostic

/**
 * Status of a diagnostic run
 */
export type DiagnosticRunStatus =
  | 'pending'
  | 'running'
  | 'complete'
  | 'failed';

/**
 * A diagnostic run record
 */
export interface DiagnosticRun {
  id: string;
  companyId: string;
  toolId: DiagnosticToolId;
  status: DiagnosticRunStatus;
  summary: string | null;
  score: number | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
  rawJson?: unknown;
}

/**
 * Input for creating a new diagnostic run
 */
export interface CreateDiagnosticRunInput {
  companyId: string;
  toolId: DiagnosticToolId;
  status?: DiagnosticRunStatus;
  summary?: string | null;
  score?: number | null;
  metadata?: Record<string, unknown>;
  rawJson?: unknown;
}

/**
 * Patch input for updating a diagnostic run
 */
export type UpdateDiagnosticRunPatch = Partial<
  Omit<DiagnosticRun, 'id' | 'companyId' | 'toolId' | 'createdAt'>
>;

/**
 * Options for listing diagnostic runs
 */
export interface ListDiagnosticRunsOptions {
  toolId?: DiagnosticToolId;
  limit?: number;
  status?: DiagnosticRunStatus;
}

// ============================================================================
// Table Configuration
// ============================================================================

// Use a dedicated table for diagnostic runs from centralized tables config
// Table schema:
// - Run ID (autonumber or formula)
// - Company (link to Companies)
// - Tool ID (single select: gapSnapshot, gapPlan, websiteLab, brandLab, contentLab, seoLab, demandLab, opsLab)
// - Status (single select: pending, running, complete, failed)
// - Summary (long text)
// - Score (number, 0-100)
// - Metadata JSON (long text)
// - Raw JSON (long text)
// - Created At (date/time)
// - Updated At (date/time)
// - URL (URL field - optional, for URL-based tools)
// - Domain (text field - optional, for domain-based tools)
const DIAGNOSTIC_RUNS_TABLE = AIRTABLE_TABLES.DIAGNOSTIC_RUNS;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Airtable record to DiagnosticRun
 */
function airtableRecordToDiagnosticRun(record: {
  id: string;
  fields: Record<string, unknown>;
}): DiagnosticRun {
  const fields = record.fields;

  // Handle Company field - linked record format
  let companyId = '';
  if (Array.isArray(fields['Company'])) {
    companyId = fields['Company'][0] as string;
  } else if (typeof fields['Company'] === 'string') {
    companyId = fields['Company'];
  }

  // Parse metadata JSON if present
  let metadata: Record<string, unknown> | undefined;
  if (typeof fields['Metadata JSON'] === 'string' && fields['Metadata JSON']) {
    try {
      metadata = JSON.parse(fields['Metadata JSON']);
    } catch {
      metadata = undefined;
    }
  }

  // Parse raw JSON if present
  let rawJson: unknown;
  if (typeof fields['Raw JSON'] === 'string' && fields['Raw JSON']) {
    try {
      rawJson = JSON.parse(fields['Raw JSON']);
    } catch {
      rawJson = undefined;
    }
  }

  // Parse score - handle both number and string formats from Airtable
  let score: number | null = null;
  const rawScore = fields['Score'];
  if (typeof rawScore === 'number') {
    score = rawScore;
  } else if (typeof rawScore === 'string' && rawScore !== '') {
    const parsed = parseFloat(rawScore);
    if (!isNaN(parsed)) {
      score = parsed;
    }
  }

  // If score is still null, try to extract from rawJson
  if (score === null && rawJson && typeof rawJson === 'object') {
    const raw = rawJson as any;
    const ia = raw.initialAssessment || raw;
    const extractedScore = ia?.summary?.overallScore ?? ia?.scores?.overall ?? ia?.overallScore ?? ia?.score;
    if (typeof extractedScore === 'number') {
      score = extractedScore;
      console.log('[DiagnosticRuns] Score extracted from rawJson:', { recordId: record.id, extractedScore });
    }
  }

  // Debug: log score parsing
  console.log('[DiagnosticRuns] Score parsing:', { recordId: record.id, rawScore, parsedScore: score, rawType: typeof rawScore, hasRawJson: !!rawJson });

  return {
    id: record.id,
    companyId,
    toolId: (fields['Tool ID'] as DiagnosticToolId) || 'gapSnapshot',
    status: (fields['Status'] as DiagnosticRunStatus) || 'pending',
    summary: (fields['Summary'] as string) || null,
    score,
    createdAt: (fields['Created At'] as string) || new Date().toISOString(),
    updatedAt: (fields['Updated At'] as string) || new Date().toISOString(),
    metadata,
    rawJson,
  };
}

/**
 * Convert DiagnosticRun fields to Airtable fields
 */
function diagnosticRunToAirtableFields(
  run: Partial<CreateDiagnosticRunInput | UpdateDiagnosticRunPatch> & { updatedAt?: string }
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if ('companyId' in run && run.companyId) {
    // Store as text - works with any field type
    fields['Company'] = run.companyId;
  }
  if ('toolId' in run && run.toolId) {
    fields['Tool ID'] = run.toolId;
  }
  if ('status' in run && run.status) {
    fields['Status'] = run.status;
  }
  if ('summary' in run) {
    fields['Summary'] = run.summary || '';
  }
  if ('score' in run && run.score !== undefined) {
    fields['Score'] = run.score;
  }
  if ('metadata' in run && run.metadata) {
    fields['Metadata JSON'] = JSON.stringify(run.metadata);
  }
  if ('rawJson' in run && run.rawJson !== undefined) {
    // Airtable long text fields have a 100,000 character limit
    // Truncate large JSON data to fit
    const MAX_JSON_LENGTH = 95000; // Leave some buffer
    let jsonStr = JSON.stringify(run.rawJson);

    if (jsonStr.length > MAX_JSON_LENGTH) {
      console.log('[DiagnosticRuns] Raw JSON too large, extracting key data:', {
        originalLength: jsonStr.length,
      });

      // Try to extract just the essential data for the tool type
      const raw = run.rawJson as any;
      const essentialData: Record<string, unknown> = {
        _truncated: true,
        _originalLength: jsonStr.length,
      };

      // For DiagnosticModuleResult from Website Lab V4
      // Structure: { module, status, score, summary, issues, recommendations, rawEvidence: { labResultV4 } }
      if (raw.rawEvidence?.labResultV4) {
        const labResult = raw.rawEvidence.labResultV4;
        essentialData.module = raw.module;
        essentialData.status = raw.status;
        essentialData.score = raw.score;
        essentialData.summary = raw.summary;
        essentialData.issues = raw.issues?.slice(0, 10);
        essentialData.recommendations = raw.recommendations?.slice(0, 10);
        // Preserve siteAssessment for the page to use
        essentialData.rawEvidence = {
          labResultV4: {
            siteAssessment: labResult.siteAssessment ? {
              score: labResult.siteAssessment.score,
              overallScore: labResult.siteAssessment.overallScore,
              summary: labResult.siteAssessment.summary,
              executiveSummary: labResult.siteAssessment.executiveSummary,
              dimensions: labResult.siteAssessment.dimensions,
              quickWins: labResult.siteAssessment.quickWins?.slice(0, 5),
              criticalIssues: labResult.siteAssessment.criticalIssues?.slice(0, 5),
              issues: labResult.siteAssessment.issues?.slice(0, 10),
              recommendations: labResult.siteAssessment.recommendations?.slice(0, 10),
              pageAssessments: labResult.siteAssessment.pageAssessments?.slice(0, 3),
              conversionFunnels: labResult.siteAssessment.conversionFunnels,
              consultantReport: labResult.siteAssessment.consultantReport,
            } : null,
          },
        };
      }
      // For raw Website Lab results with siteAssessment directly
      else if (raw.siteAssessment) {
        essentialData.siteAssessment = {
          score: raw.siteAssessment.score,
          overallScore: raw.siteAssessment.overallScore,
          summary: raw.siteAssessment.summary,
          executiveSummary: raw.siteAssessment.executiveSummary,
          dimensions: raw.siteAssessment.dimensions,
          quickWins: raw.siteAssessment.quickWins?.slice(0, 5),
          criticalIssues: raw.siteAssessment.criticalIssues?.slice(0, 5),
          issues: raw.siteAssessment.issues?.slice(0, 10),
          recommendations: raw.siteAssessment.recommendations?.slice(0, 10),
          consultantReport: raw.siteAssessment.consultantReport,
        };
      }

      // For GAP-IA results, extract summary and dimensions
      if (raw.initialAssessment) {
        essentialData.initialAssessment = {
          summary: raw.initialAssessment.summary,
          dimensions: raw.initialAssessment.dimensions,
        };
      }
      if (raw.summary && !essentialData.summary) {
        essentialData.summary = raw.summary;
      }
      if (raw.dimensions && !essentialData.dimensions) {
        essentialData.dimensions = raw.dimensions;
      }

      // For module results without rawEvidence
      if (raw.module && raw.score !== undefined && !essentialData.module) {
        essentialData.module = raw.module;
        essentialData.score = raw.score;
        essentialData.summary = raw.summary;
        essentialData.issues = raw.issues?.slice(0, 10);
        essentialData.recommendations = raw.recommendations?.slice(0, 10);
      }

      jsonStr = JSON.stringify(essentialData);

      // If still too large, just store minimal data
      if (jsonStr.length > MAX_JSON_LENGTH) {
        jsonStr = JSON.stringify({
          _truncated: true,
          _originalLength: jsonStr.length,
          _note: 'Data too large for storage',
        });
      }
    }

    fields['Raw JSON'] = jsonStr;
  }

  // Note: "Updated At" is a computed field in Airtable, don't set it manually

  return fields;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new diagnostic run
 */
export async function createDiagnosticRun(
  input: CreateDiagnosticRunInput
): Promise<DiagnosticRun> {
  console.log('[DiagnosticRuns] Creating run:', {
    companyId: input.companyId,
    toolId: input.toolId,
    status: input.status,
  });

  const fields = diagnosticRunToAirtableFields({
    ...input,
    status: input.status || 'pending',
  });
  // Note: "Created At" is auto-set by Airtable

  try {
    const result = await createRecord(DIAGNOSTIC_RUNS_TABLE, fields);

    console.log('[DiagnosticRuns] Run created:', {
      recordId: result?.id,
      toolId: input.toolId,
    });

    return airtableRecordToDiagnosticRun(result);
  } catch (error) {
    console.error('[DiagnosticRuns] Failed to create run:', error);
    throw error;
  }
}

/**
 * Update an existing diagnostic run
 */
export async function updateDiagnosticRun(
  id: string,
  patch: UpdateDiagnosticRunPatch
): Promise<DiagnosticRun> {
  console.log('[DiagnosticRuns] Updating run:', {
    id,
    patchKeys: Object.keys(patch),
  });

  const fields = diagnosticRunToAirtableFields({
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  try {
    const result = await updateRecord(DIAGNOSTIC_RUNS_TABLE, id, fields);

    console.log('[DiagnosticRuns] Run updated:', {
      recordId: result?.id,
      status: patch.status,
    });

    return airtableRecordToDiagnosticRun(result);
  } catch (error) {
    console.error('[DiagnosticRuns] Failed to update run:', error);
    throw error;
  }
}

/**
 * List diagnostic runs for a company
 */
export async function listDiagnosticRunsForCompany(
  companyId: string,
  opts?: ListDiagnosticRunsOptions
): Promise<DiagnosticRun[]> {
  console.log('[DiagnosticRuns] Listing runs for company:', {
    companyId,
    toolId: opts?.toolId,
    limit: opts?.limit,
  });

  const config = getAirtableConfig();
  const limit = opts?.limit || 50;

  // Build filter formula
  let filterParts: string[] = [`FIND('${companyId}', ARRAYJOIN({Company}, ','))`];

  if (opts?.toolId) {
    filterParts.push(`{Tool ID} = '${opts.toolId}'`);
  }

  if (opts?.status) {
    filterParts.push(`{Status} = '${opts.status}'`);
  }

  const filterFormula = filterParts.length > 1
    ? `AND(${filterParts.join(', ')})`
    : filterParts[0];

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(DIAGNOSTIC_RUNS_TABLE)}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('maxRecords', String(limit));
  url.searchParams.set('sort[0][field]', 'Created At');
  url.searchParams.set('sort[0][direction]', 'desc');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Return empty array for common errors (table not found, invalid formula, etc.)
      // This allows the app to work even if the Diagnostic Runs table isn't fully set up
      if (response.status === 404 || response.status === 422 || response.status === 400) {
        console.warn(`[DiagnosticRuns] Table query failed (${response.status}), returning empty array`);
        return [];
      }
      console.error('[DiagnosticRuns] Airtable API error:', {
        status: response.status,
        errorText,
      });
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const runs = (result.records || []).map(airtableRecordToDiagnosticRun);

    console.log('[DiagnosticRuns] Found runs:', {
      count: runs.length,
      companyId,
    });

    return runs;
  } catch (error) {
    console.error('[DiagnosticRuns] Failed to list runs:', error);
    // Return empty array on error to not break the UI
    return [];
  }
}

/**
 * Get the latest run for a company and tool
 */
export async function getLatestRunForCompanyAndTool(
  companyId: string,
  toolId: DiagnosticToolId
): Promise<DiagnosticRun | null> {
  console.log('[DiagnosticRuns] Getting latest run:', { companyId, toolId });

  const runs = await listDiagnosticRunsForCompany(companyId, {
    toolId,
    limit: 1,
  });

  return runs.length > 0 ? runs[0] : null;
}

/**
 * Get a single diagnostic run by ID
 */
export async function getDiagnosticRun(id: string): Promise<DiagnosticRun | null> {
  console.log('[DiagnosticRuns] Getting run:', { id });

  const config = getAirtableConfig();
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(DIAGNOSTIC_RUNS_TABLE)}/${id}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return airtableRecordToDiagnosticRun(result);
  } catch (error) {
    console.error('[DiagnosticRuns] Failed to get run:', error);
    return null;
  }
}

/**
 * Get runs grouped by tool ID for a company
 * This pulls from both the Diagnostic Runs table AND Heavy GAP Runs (for backwards compat)
 */
export async function getRunsGroupedByTool(
  companyId: string
): Promise<Record<DiagnosticToolId, DiagnosticRun[]>> {
  // Get runs from the dedicated Diagnostic Runs table
  const runs = await listDiagnosticRunsForCompany(companyId, { limit: 100 });

  const grouped: Record<DiagnosticToolId, DiagnosticRun[]> = {
    gapSnapshot: [],
    gapPlan: [],
    gapHeavy: [],
    websiteLab: [],
    brandLab: [],
    contentLab: [],
    seoLab: [],
    demandLab: [],
    opsLab: [],
  };

  for (const run of runs) {
    if (grouped[run.toolId]) {
      grouped[run.toolId].push(run);
    }
  }

  // Also check legacy GAP-IA Runs for gapSnapshot (backwards compat)
  if (grouped.gapSnapshot.length === 0) {
    try {
      const { getGapIaRunsForCompany } = await import('@/lib/airtable/gapIaRuns');
      const iaRuns = await getGapIaRunsForCompany(companyId, 5);

      console.log('[DiagnosticRuns] Processing legacy GAP-IA Runs:', { count: iaRuns.length });

      for (const iaRun of iaRuns) {
        // Extract score from various locations in the GAP-IA result
        const iaScore = iaRun.summary?.overallScore
          ?? iaRun.overallScore
          ?? iaRun.readinessScore
          ?? null;

        console.log('[DiagnosticRuns] GAP-IA score extraction:', { runId: iaRun.id, score: iaScore });

        const maturityStage = iaRun.summary?.maturityStage ?? iaRun.maturityStage;
        const summary = maturityStage
          ? `${maturityStage} maturity stage - Score: ${iaScore}/100`
          : iaRun.summary?.narrative || iaRun.insights?.overallSummary || null;

        grouped.gapSnapshot.push({
          id: iaRun.id,
          companyId,
          toolId: 'gapSnapshot',
          status: iaRun.status === 'complete' || iaRun.status === 'completed' ? 'complete' : iaRun.status === 'error' || iaRun.status === 'failed' ? 'failed' : 'running',
          summary,
          score: typeof iaScore === 'number' ? iaScore : null,
          createdAt: iaRun.createdAt,
          updatedAt: iaRun.updatedAt,
          rawJson: iaRun,
        });
      }
    } catch (error) {
      console.warn('[DiagnosticRuns] Failed to fetch legacy GAP-IA Runs:', error);
    }
  }

  // Also check Heavy GAP Runs for Website/Brand results (backwards compat)
  try {
    const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');
    const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 5);

    console.log('[DiagnosticRuns] Processing Heavy GAP Runs:', { count: heavyRuns.length });

    for (const heavyRun of heavyRuns) {
      if (!heavyRun.evidencePack) continue;

      // Extract Website Lab results
      if (heavyRun.evidencePack.websiteLabV4 && grouped.websiteLab.length === 0) {
        const websiteResult = heavyRun.evidencePack.websiteLabV4;
        const websiteScore = websiteResult.siteAssessment?.overallScore
          ?? websiteResult.score
          ?? websiteResult.siteAssessment?.score
          ?? null;
        console.log('[DiagnosticRuns] Website Lab score extraction:', { runId: heavyRun.id, score: websiteScore });
        grouped.websiteLab.push({
          id: `heavy-${heavyRun.id}-website`,
          companyId,
          toolId: 'websiteLab',
          status: 'complete',
          summary: websiteResult.siteAssessment?.executiveSummary || null,
          score: websiteScore,
          createdAt: heavyRun.createdAt,
          updatedAt: heavyRun.updatedAt,
          rawJson: websiteResult,
        });
      }

      // Extract Brand Lab results
      if (heavyRun.evidencePack.brandLab && grouped.brandLab.length === 0) {
        const brandResult = heavyRun.evidencePack.brandLab;
        const brandScore = brandResult.diagnostic?.overallScore
          ?? brandResult.diagnostic?.score
          ?? brandResult.score
          ?? null;
        console.log('[DiagnosticRuns] Brand Lab score extraction:', { runId: heavyRun.id, score: brandScore });
        grouped.brandLab.push({
          id: `heavy-${heavyRun.id}-brand`,
          companyId,
          toolId: 'brandLab',
          status: 'complete',
          summary: brandResult.diagnostic?.executiveSummary || null,
          score: brandScore,
          createdAt: heavyRun.createdAt,
          updatedAt: heavyRun.updatedAt,
          rawJson: brandResult,
        });
      }

      // Extract module results for other tools (seo, content, demand, ops)
      const modules = heavyRun.evidencePack.modules || [];
      for (const mod of modules) {
        const toolMap: Record<string, DiagnosticToolId> = {
          'seo': 'seoLab',
          'content': 'contentLab',
          'demand': 'demandLab',
          'ops': 'opsLab',
        };
        const toolId = toolMap[mod.module];
        if (toolId && grouped[toolId].length === 0) {
          const modStatus = String(mod.status);
          const modScore = typeof mod.score === 'number' ? mod.score : null;
          console.log('[DiagnosticRuns] Module score extraction:', { runId: heavyRun.id, module: mod.module, score: modScore });
          grouped[toolId].push({
            id: `heavy-${heavyRun.id}-${mod.module}`,
            companyId,
            toolId,
            status: modStatus === 'completed' || modStatus === 'complete' ? 'complete' : modStatus === 'error' || modStatus === 'failed' ? 'failed' : 'running',
            summary: (mod.summary as string) || null,
            score: modScore,
            createdAt: heavyRun.createdAt,
            updatedAt: heavyRun.updatedAt,
            rawJson: mod.rawEvidence || mod,
          });
        }
      }
    }
  } catch (error) {
    console.warn('[DiagnosticRuns] Failed to fetch Heavy GAP Runs:', error);
  }

  return grouped;
}

// ============================================================================
// Tool ID Helpers
// ============================================================================

/**
 * Get human-readable label for a tool ID
 */
export function getToolLabel(toolId: DiagnosticToolId): string {
  const labels: Record<DiagnosticToolId, string> = {
    gapSnapshot: 'GAP Snapshot',
    gapPlan: 'GAP Plan',
    gapHeavy: 'GAP Heavy',
    websiteLab: 'Website Lab',
    brandLab: 'Brand Lab',
    contentLab: 'Content Lab',
    seoLab: 'SEO Lab',
    demandLab: 'Demand Lab',
    opsLab: 'Ops Lab',
  };
  return labels[toolId] || toolId;
}

/**
 * Get status color class
 */
export function getStatusColor(status: DiagnosticRunStatus): string {
  const colors: Record<DiagnosticRunStatus, string> = {
    pending: 'text-slate-400',
    running: 'text-amber-400',
    complete: 'text-emerald-400',
    failed: 'text-red-400',
  };
  return colors[status] || 'text-slate-400';
}

/**
 * Check if a tool ID is valid
 */
export function isValidToolId(toolId: string): toolId is DiagnosticToolId {
  const validToolIds: DiagnosticToolId[] = [
    'gapSnapshot',
    'gapPlan',
    'gapHeavy',
    'websiteLab',
    'brandLab',
    'contentLab',
    'seoLab',
    'demandLab',
    'opsLab',
  ];
  return validToolIds.includes(toolId as DiagnosticToolId);
}

/**
 * Get all runs for a specific tool across all companies
 */
export async function getRunsByTool(
  toolId: DiagnosticToolId,
  limit: number = 50
): Promise<DiagnosticRun[]> {
  console.log('[DiagnosticRuns] Getting runs by tool:', { toolId, limit });

  const config = getAirtableConfig();

  const filterFormula = `{Tool ID} = '${toolId}'`;

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(DIAGNOSTIC_RUNS_TABLE)}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('maxRecords', String(limit));
  url.searchParams.set('sort[0][field]', 'Created At');
  url.searchParams.set('sort[0][direction]', 'desc');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 422 || response.status === 400) {
        console.warn(`[DiagnosticRuns] Table query failed (${response.status}), returning empty array`);
        return [];
      }
      const errorText = await response.text();
      throw new Error(`Airtable API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const runs = (result.records || []).map(airtableRecordToDiagnosticRun);

    console.log('[DiagnosticRuns] Found runs for tool:', {
      count: runs.length,
      toolId,
    });

    return runs;
  } catch (error) {
    console.error('[DiagnosticRuns] Failed to get runs by tool:', error);
    return [];
  }
}
