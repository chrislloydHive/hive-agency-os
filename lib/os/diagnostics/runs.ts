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
  | 'seoLab'         // SEO Lab diagnostic (deep SEO + GSC + analytics)
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

  // Handle Company field - check both "Company copy" (link) and "Company" (text)
  let companyId = '';
  // First try the link field "Company copy"
  if (Array.isArray(fields['Company copy']) && fields['Company copy'].length > 0) {
    companyId = fields['Company copy'][0] as string;
  }
  // Fall back to the text field "Company"
  else if (Array.isArray(fields['Company'])) {
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
    // The Diagnostic Runs table has two Company-related fields:
    // - "Company" (single line text) - stores the record ID as text
    // - "Company copy" (link field) - links to Companies table
    // We write to both for compatibility
    console.log('[DiagnosticRuns] Setting Company fields:', {
      companyId: run.companyId,
      isValidRecordId: run.companyId.startsWith('rec'),
    });
    fields['Company'] = run.companyId; // Text field
    fields['Company copy'] = [run.companyId]; // Link field (array format)
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
  // Check multiple ways the company ID might be stored:
  // 1. "Company copy" link field (array of record IDs)
  // 2. "Company" text field (record ID as string)
  // 3. Direct RECORD_ID match on linked record
  const companyFilter = `OR(
    FIND('${companyId}', ARRAYJOIN({Company copy}, ',')),
    {Company} = '${companyId}',
    SEARCH('${companyId}', ARRAYJOIN({Company copy}))
  )`;
  let filterParts: string[] = [companyFilter.replace(/\s+/g, ' ')];

  if (opts?.toolId) {
    filterParts.push(`{Tool ID} = '${opts.toolId}'`);
  }

  if (opts?.status) {
    filterParts.push(`{Status} = '${opts.status}'`);
  }

  const filterFormula = filterParts.length > 1
    ? `AND(${filterParts.join(', ')})`
    : filterParts[0];

  console.log('[DiagnosticRuns] Filter formula:', filterFormula);

  const url = new URL(
    `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(DIAGNOSTIC_RUNS_TABLE)}`
  );
  url.searchParams.set('filterByFormula', filterFormula);
  url.searchParams.set('maxRecords', String(limit));
  url.searchParams.set('sort[0][field]', 'Created At');
  url.searchParams.set('sort[0][direction]', 'desc');

  console.log('[DiagnosticRuns] Fetching from:', DIAGNOSTIC_RUNS_TABLE);
  console.log('[DiagnosticRuns] Full URL:', url.toString().replace(config.apiKey || '', '[REDACTED]'));

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
      console.error('[DiagnosticRuns] Airtable API error:', {
        status: response.status,
        errorText,
        companyId,
        filterFormula,
      });
      // Return empty array for common errors (table not found, invalid formula, etc.)
      // This allows the app to work even if the Diagnostic Runs table isn't fully set up
      if (response.status === 404 || response.status === 422 || response.status === 400) {
        console.warn(`[DiagnosticRuns] Table query failed (${response.status}), returning empty array`);
        return [];
      }
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
 * Get recent diagnostic runs for a company (across all tools)
 * Returns runs sorted by creation date, newest first
 */
export async function getRecentRunsForCompany(
  companyId: string,
  limit: number = 5
): Promise<DiagnosticRun[]> {
  console.log('[DiagnosticRuns] Getting recent runs for company:', { companyId, limit });

  // Get all recent runs from the Diagnostic Runs table
  const runs = await listDiagnosticRunsForCompany(companyId, { limit });

  // Also try to get legacy runs if we don't have enough
  if (runs.length < limit) {
    try {
      const { getGapIaRunsForCompany } = await import('@/lib/airtable/gapIaRuns');
      const iaRuns = await getGapIaRunsForCompany(companyId, limit - runs.length);

      for (const iaRun of iaRuns) {
        // Skip if we already have this run from the Diagnostic Runs table
        const alreadyExists = runs.some(r => r.id === iaRun.id);
        if (alreadyExists) continue;

        const iaScore = iaRun.summary?.overallScore
          ?? iaRun.overallScore
          ?? iaRun.readinessScore
          ?? null;

        const maturityStage = iaRun.summary?.maturityStage ?? iaRun.maturityStage;
        const summary = maturityStage
          ? `${maturityStage} maturity stage - Score: ${iaScore}/100`
          : iaRun.summary?.narrative || iaRun.insights?.overallSummary || null;

        runs.push({
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

  // Sort by creation date, newest first
  runs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return runs.slice(0, limit);
}

/**
 * Get the latest run for each tool type for a company
 * This is useful for the Blueprint page which needs to know if each tool has been run
 * Returns a map of toolId -> latest completed run (or null if never run)
 */
export async function getLatestRunPerToolForCompany(
  companyId: string
): Promise<Map<DiagnosticToolId, DiagnosticRun | null>> {
  console.log('[DiagnosticRuns] Getting latest run per tool for company:', { companyId });

  // Fetch a larger batch to ensure we capture at least one run per tool
  // With 9 tools, 100 records should be more than enough
  const allRuns = await listDiagnosticRunsForCompany(companyId, { limit: 100 });

  // Group runs by tool and get the latest completed one for each
  const latestByTool = new Map<DiagnosticToolId, DiagnosticRun | null>();

  // Initialize all known tools with null
  const allToolIds: DiagnosticToolId[] = [
    'gapSnapshot', 'gapPlan', 'gapHeavy', 'websiteLab',
    'brandLab', 'contentLab', 'seoLab', 'demandLab', 'opsLab'
  ];
  for (const toolId of allToolIds) {
    latestByTool.set(toolId, null);
  }

  // Group and find latest completed run for each tool
  for (const run of allRuns) {
    const existing = latestByTool.get(run.toolId);

    // Only consider completed runs
    if (run.status !== 'complete') continue;

    // If no existing run or this run is newer, use it
    if (!existing || new Date(run.createdAt) > new Date(existing.createdAt)) {
      latestByTool.set(run.toolId, run);
    }
  }

  console.log('[DiagnosticRuns] Latest runs per tool:', {
    companyId,
    tools: Array.from(latestByTool.entries()).map(([toolId, run]) => ({
      toolId,
      hasRun: !!run,
      runId: run?.id,
      score: run?.score,
    })),
  });

  return latestByTool;
}

/**
 * Get recent runs including at least the latest run for each tool type
 * Combines recency with tool coverage to ensure Blueprint shows all tool statuses
 */
export async function getRecentRunsWithToolCoverage(
  companyId: string,
  recentLimit: number = 10
): Promise<DiagnosticRun[]> {
  console.log('[DiagnosticRuns] Getting recent runs with tool coverage:', { companyId, recentLimit });

  // Fetch enough runs to cover all tools
  const allRuns = await listDiagnosticRunsForCompany(companyId, { limit: 100 });

  // Sort by date descending
  allRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Track which tools we've seen
  const seenTools = new Set<DiagnosticToolId>();
  const result: DiagnosticRun[] = [];

  // First pass: take recent runs up to limit, tracking tools
  for (const run of allRuns) {
    if (result.length < recentLimit) {
      result.push(run);
      if (run.status === 'complete') {
        seenTools.add(run.toolId);
      }
    }
  }

  // Second pass: add latest completed run for any missing tools
  for (const run of allRuns) {
    if (run.status === 'complete' && !seenTools.has(run.toolId)) {
      // This is the latest completed run for this tool (since allRuns is sorted desc)
      result.push(run);
      seenTools.add(run.toolId);
    }
  }

  console.log('[DiagnosticRuns] Runs with tool coverage:', {
    totalRuns: result.length,
    toolsCovered: Array.from(seenTools),
  });

  // Re-sort by date
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return result;
}

// ============================================================================
// Score Trends
// ============================================================================

/**
 * A single score trend data point
 */
export interface CompanyScoreTrendPoint {
  date: string;           // ISO date
  score: number | null;
  toolId: DiagnosticToolId;
  runId: string;
}

/**
 * Score trends grouped by category
 */
export interface CompanyScoreTrends {
  overall: CompanyScoreTrendPoint[];   // GAP-IA or GAP-Plan scores
  website: CompanyScoreTrendPoint[];   // Website Lab scores
  seo: CompanyScoreTrendPoint[];       // SEO Lab scores
  brand: CompanyScoreTrendPoint[];     // Brand Lab scores
}

/**
 * Computed score trend with delta for a single category
 */
export interface ComputedScoreTrend {
  latestScore: number | null;
  previousScore: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'same' | null;
}

/**
 * All computed score trends for the Overview
 */
export interface ComputedScoreTrends {
  overall: ComputedScoreTrend;
  website: ComputedScoreTrend;
  seo: ComputedScoreTrend;
  brand: ComputedScoreTrend;
}

/**
 * Get score trends for a company
 *
 * Pulls diagnostic runs and extracts scores over time for key categories:
 * - overall: GAP-IA, GAP-Plan (prioritized)
 * - website: Website Lab
 * - seo: SEO Lab
 * - brand: Brand Lab
 */
export async function getCompanyScoreTrends(companyId: string): Promise<CompanyScoreTrends> {
  console.log('[ScoreTrends] Getting score trends for company:', companyId);

  const trends: CompanyScoreTrends = {
    overall: [],
    website: [],
    seo: [],
    brand: [],
  };

  try {
    // Get runs grouped by tool
    const grouped = await getRunsGroupedByTool(companyId);

    // Overall: GAP-Plan > GAP-IA > GAP-Heavy
    const overallRuns = [
      ...grouped.gapPlan.filter(r => r.status === 'complete' && r.score !== null),
      ...grouped.gapSnapshot.filter(r => r.status === 'complete' && r.score !== null),
      ...grouped.gapHeavy.filter(r => r.status === 'complete' && r.score !== null),
    ];

    // Sort by date ascending for trend display
    overallRuns.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const run of overallRuns.slice(-10)) {
      trends.overall.push({
        date: run.createdAt,
        score: run.score,
        toolId: run.toolId,
        runId: run.id,
      });
    }

    // Website Lab
    const websiteRuns = grouped.websiteLab
      .filter(r => r.status === 'complete' && r.score !== null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const run of websiteRuns.slice(-10)) {
      trends.website.push({
        date: run.createdAt,
        score: run.score,
        toolId: run.toolId,
        runId: run.id,
      });
    }

    // SEO Lab
    const seoRuns = grouped.seoLab
      .filter(r => r.status === 'complete' && r.score !== null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const run of seoRuns.slice(-10)) {
      trends.seo.push({
        date: run.createdAt,
        score: run.score,
        toolId: run.toolId,
        runId: run.id,
      });
    }

    // Brand Lab
    const brandRuns = grouped.brandLab
      .filter(r => r.status === 'complete' && r.score !== null)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const run of brandRuns.slice(-10)) {
      trends.brand.push({
        date: run.createdAt,
        score: run.score,
        toolId: run.toolId,
        runId: run.id,
      });
    }

    console.log('[ScoreTrends] Trends found:', {
      overall: trends.overall.length,
      website: trends.website.length,
      seo: trends.seo.length,
      brand: trends.brand.length,
    });

    return trends;
  } catch (error) {
    console.error('[ScoreTrends] Failed to get score trends:', error);
    return trends;
  }
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

/**
 * Compute a single trend with delta from trend points
 */
function computeSingleTrend(points: CompanyScoreTrendPoint[]): ComputedScoreTrend {
  if (points.length === 0) {
    return { latestScore: null, previousScore: null, delta: null, direction: null };
  }

  // Sort by date descending to get latest first
  const sorted = [...points].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latestScore = sorted[0]?.score ?? null;
  const previousScore = sorted[1]?.score ?? null;

  if (latestScore === null || previousScore === null) {
    return { latestScore, previousScore, delta: null, direction: null };
  }

  const delta = latestScore - previousScore;
  const direction: 'up' | 'down' | 'same' = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';

  return { latestScore, previousScore, delta, direction };
}

/**
 * Compute all score trends with deltas for the Overview
 */
export function computeScoreTrendsWithDeltas(trends: CompanyScoreTrends): ComputedScoreTrends {
  return {
    overall: computeSingleTrend(trends.overall),
    website: computeSingleTrend(trends.website),
    seo: computeSingleTrend(trends.seo),
    brand: computeSingleTrend(trends.brand),
  };
}

/**
 * Get computed score trends for a company (includes deltas)
 */
export async function getComputedScoreTrends(companyId: string): Promise<ComputedScoreTrends> {
  const trends = await getCompanyScoreTrends(companyId);
  return computeScoreTrendsWithDeltas(trends);
}
