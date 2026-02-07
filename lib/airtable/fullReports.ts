// lib/airtable/fullReports.ts
// Airtable integration for Full Reports table
// Handles saving Website/UX diagnostics and other OS diagnostics
// v2: Uses JSON fields for detailed data, scalar fields for scores

import { base } from './client';
import type { WebsiteUxDiagnostic } from '@/lib/diagnostics/websiteUx';
import type {
  OsDiagnosticResult,
  Pillar,
  ScoresJson,
  DiagnosticsJson,
} from '@/lib/diagnostics/types';
import type {
  PriorityItem,
  PrioritiesPayload,
  PriorityArea,
  PrioritySeverity,
  PriorityImpactLevel,
  PriorityEffortSize,
  EvidencePayload,
  PlanPayload,
} from '@/lib/gap/types';

const FULL_REPORTS_TABLE_NAME =
  process.env.AIRTABLE_FULL_REPORTS_TABLE || 'Full Reports';

// ============================================================================
// Diagnostics Types (for Diagnostics View)
// ============================================================================

// Lightweight diagnostics types – flexible, not overly strict
export type DiagnosticSeverity = "critical" | "high" | "medium" | "low" | "info";

export type DiagnosticIssue = {
  id?: string;
  title?: string;
  severity?: DiagnosticSeverity;
  category?: string;
  impact?: string;
  scoreImpact?: number;
  status?: "open" | "in-progress" | "resolved";
  evidence?: string;
  suggestion?: string;
};

export type DiagnosticArea = {
  label?: string;          // e.g., "Brand"
  score?: number;          // area-specific score
  summary?: string;        // 1–2 sentence overview
  issues?: DiagnosticIssue[];
};

export type DiagnosticsPayload = {
  brand?: DiagnosticArea;
  content?: DiagnosticArea;
  seo?: DiagnosticArea;
  websiteUx?: DiagnosticArea;
  funnel?: DiagnosticArea;
  [key: string]: DiagnosticArea | undefined; // fallback for future areas
};

// ============================================================================
// Priorities Types (v2 - Canonical)
// ============================================================================

// Re-export canonical types from lib/gap/types.ts for backward compatibility
export type { PriorityItem, PrioritiesPayload } from '@/lib/gap/types';

// ============================================================================
// Full Report Record Types
// ============================================================================

export type FullReportScores = {
  overall?: number;
  brand?: number;
  content?: number;
  seo?: number;
  websiteUx?: number;
  funnel?: number;
};

export type FullReportStatus = "draft" | "processing" | "ready" | "archived" | "error";

export type FullReportRecord = {
  id: string;
  companyId: string;
  snapshotId?: string;
  gapRunId?: string;
  scores: FullReportScores;
  summary?: string;
  status: FullReportStatus;
  reportVersion?: string;
  scoresJson?: unknown;
  diagnosticsJson?: DiagnosticsPayload | undefined;
  prioritiesJson?: PrioritiesPayload | undefined;
  planJson?: PlanPayload | undefined;
  evidenceJson?: EvidencePayload | undefined;
  createdAt?: string;
  updatedAt?: string;
};

// ============================================================================
// Legacy Types
// ============================================================================

export type WebsiteUxTrend = {
  latestScore: number | null;
  previousScore: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | 'na';
  series: { date: string; score: number | null }[];
};

export type UpsertFullReportArgs = {
  companyId: string;
  snapshotId?: string;
  gapRunId?: string;
  reportType: 'GAP' | 'OS';
  /** @deprecated Use osResult instead */
  websiteUx?: WebsiteUxDiagnostic;
  /** v2: Full OS diagnostic result with all pillars */
  osResult?: OsDiagnosticResult;
};

/**
 * Upsert Full Report record for OS diagnostics (v2 schema)
 *
 * Creates or updates a Full Report record for the given company.
 * Supports both legacy websiteUx and new osResult formats.
 *
 * v2 schema:
 * - Scalar fields for scores (Overall Score, Brand Score, etc.)
 * - JSON fields for detailed data (Scores JSON, Diagnostics JSON, etc.)
 *
 * @param args - Report data including diagnostics
 * @returns Airtable record ID
 */
export async function upsertFullReportForOsRun({
  companyId,
  snapshotId,
  gapRunId,
  reportType,
  websiteUx,
  osResult,
}: UpsertFullReportArgs): Promise<string> {
  const table = base(FULL_REPORTS_TABLE_NAME);

  // 1) Get latest report for this company and type (if one exists)
  const existingRecords = await table
    .select({
      filterByFormula: `AND({Company} = '${companyId}', {Report Type} = '${reportType}')`,
      sort: [{ field: 'Report Date', direction: 'desc' }],
      maxRecords: 1,
    })
    .firstPage();

  // 2) Build base fields
  const fields: any = {
    Company: [companyId],
    'Report Type': reportType,
    'Report Date': new Date().toISOString(),
  };

  if (snapshotId) fields['Snapshot'] = [snapshotId];
  if (gapRunId) fields['Gap Run'] = [gapRunId];

  // 3) Handle v2 osResult (preferred)
  if (osResult) {
    console.log('[Full Reports] Processing v2 osResult...');

    // Set schema version
    fields['Schema Version'] = osResult.schemaVersion || 'v1';

    // Extract scalar scores
    fields['Overall Score'] = osResult.overallScore;

    // Extract per-pillar scores
    const brandScore = getPillarScoreValue(osResult, 'brand');
    const contentScore = getPillarScoreValue(osResult, 'content');
    const seoScore = getPillarScoreValue(osResult, 'seo');
    const websiteUxScore = getPillarScoreValue(osResult, 'websiteUx');
    const funnelScore = getPillarScoreValue(osResult, 'funnel');

    if (brandScore !== null) fields['Brand Score'] = brandScore;
    if (contentScore !== null) fields['Content Score'] = contentScore;
    if (seoScore !== null) fields['SEO Score'] = seoScore;
    if (websiteUxScore !== null) fields['Website UX Score'] = websiteUxScore;
    if (funnelScore !== null) fields['Funnel Score'] = funnelScore;

    // Derive Top Priority Summary
    fields['Top Priority Summary'] = buildTopPrioritySummary(osResult);

    // Derive Status based on overall score
    fields['Status'] = deriveStatus(osResult.overallScore);

    // Serialize JSON fields
    const scoresJson: ScoresJson = {
      overallScore: osResult.overallScore,
      pillarScores: osResult.pillarScores,
    };
    fields['Scores JSON'] = JSON.stringify(scoresJson);

    // Build diagnostics in both formats:
    // 1. DiagnosticsPayload for the diagnostics view
    // 2. DiagnosticsJson for internal use (legacy)
    const diagnosticsPayload: DiagnosticsPayload = buildDiagnosticsPayload(osResult);
    fields['Diagnostics JSON'] = JSON.stringify(diagnosticsPayload);

    // Normalize priorities to canonical v2 format
    const prioritiesPayload: PrioritiesPayload = buildPrioritiesPayload(osResult.priorities);
    fields['Priorities JSON'] = JSON.stringify(prioritiesPayload);

    // Normalize plan to canonical PlanPayload format
    const planPayload: PlanPayload = buildPlanPayload(osResult.plan);
    fields['Plan JSON'] = JSON.stringify(planPayload);

    fields['Evidence JSON'] = JSON.stringify(osResult.evidence);

    // Log the fields being written
    console.log('[Full Reports] v2 schema fields prepared:', {
      meta: {
        'Company': companyId,
        'Report Type': reportType,
        'Schema Version': fields['Schema Version'],
      },
      scalarScores: {
        'Overall Score': fields['Overall Score'],
        'Brand Score': fields['Brand Score'] ?? 'null',
        'Content Score': fields['Content Score'] ?? 'null',
        'SEO Score': fields['SEO Score'] ?? 'null',
        'Website UX Score': fields['Website UX Score'] ?? 'null',
        'Funnel Score': fields['Funnel Score'] ?? 'null',
      },
      summary: {
        'Top Priority Summary': fields['Top Priority Summary'],
        'Status': fields['Status'],
      },
      jsonFieldSizes: {
        'Scores JSON': fields['Scores JSON']?.length || 0,
        'Diagnostics JSON (DiagnosticsPayload)': fields['Diagnostics JSON']?.length || 0,
        'Priorities JSON': fields['Priorities JSON']?.length || 0,
        'Plan JSON': fields['Plan JSON']?.length || 0,
        'Evidence JSON': fields['Evidence JSON']?.length || 0,
      },
    });
  }
  // 4) Handle legacy websiteUx format (backwards compatibility)
  else if (websiteUx) {
    fields['Website UX Score'] = websiteUx.score;
    fields['Overall Score'] = websiteUx.score; // Use as overall for now
    fields['Status'] = deriveStatus(websiteUx.score);

    // Store in legacy fields as well for backwards compatibility
    fields['Website Diagnostics'] = buildWebsiteUxDiagnosticsText(websiteUx);
    fields['Website Priorities'] = JSON.stringify(websiteUx.priorities);

    // Also populate JSON fields if possible
    const scoresJson: ScoresJson = {
      overallScore: websiteUx.score,
      pillarScores: [
        {
          pillar: 'websiteUx',
          score: websiteUx.score,
          justification: websiteUx.justification,
        },
      ],
    };
    fields['Scores JSON'] = JSON.stringify(scoresJson);
    fields['Priorities JSON'] = JSON.stringify(
      websiteUx.priorities.map((p) => ({
        ...p,
        pillar: 'websiteUx',
        description: p.rationale,
      }))
    );
  }

  // 5) Create or update record
  if (existingRecords.length > 0) {
    const recordId = existingRecords[0].id;
    console.log(`[Full Reports] Updating existing record: ${recordId}`);
    const updated = await table.update([
      {
        id: recordId,
        fields,
      },
    ]);
    const updatedId = updated[0].id;
    console.log(
      `✅ [Full Reports] Updated record ${updatedId} for company ${companyId}`
    );
    return updatedId;
  } else {
    console.log(`[Full Reports] Creating new record for company ${companyId}`);
    const created = await table.create([
      {
        fields,
      },
    ]);
    const createdId = created[0].id;
    console.log(
      `✅ [Full Reports] Created record ${createdId} for company ${companyId}`
    );
    return createdId;
  }
}

/**
 * Get all Full Reports across all companies
 *
 * @returns Array of all full reports with normalized structure
 */
export async function getAllFullReports(): Promise<FullReportRecord[]> {
  try {
    const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
    console.log(`[Full Reports] Fetching all full reports from base: ${baseId.substring(0, 20)}...`);
    const table = base(FULL_REPORTS_TABLE_NAME);
    const records = await table.select().all();

    const reports = records.map((record) => {
      const fields = record.fields as Record<string, unknown>;
      const companyIds = fields['Company'] as string[] | undefined;

      return {
        id: record.id,
        companyId: companyIds?.[0] || '',
        snapshotId: fields['Snapshot'] as string | undefined,
        gapRunId: fields['GAP Run'] as string | undefined,
        scores: {
          overall: fields['Overall Score'] as number | undefined,
          brand: fields['Brand Score'] as number | undefined,
          content: fields['Content Score'] as number | undefined,
          seo: fields['SEO Score'] as number | undefined,
          websiteUx: fields['Website UX Score'] as number | undefined,
          funnel: fields['Funnel Score'] as number | undefined,
        },
        summary: fields['Summary'] as string | undefined,
        status: (fields['Status'] as FullReportStatus) || 'draft',
        diagnosticsJson: parseJsonField(fields['Diagnostics JSON']),
        prioritiesJson: parseJsonField(fields['Priorities JSON']),
        planJson: parseJsonField(fields['Plan JSON']),
        evidenceJson: parseJsonField(fields['Evidence JSON']),
        createdAt: fields['Created At'] as string | undefined,
        updatedAt: fields['Updated At'] as string | undefined,
      } as FullReportRecord;
    });

    console.log('[Full Reports] Found', reports.length, 'total reports');
    return reports;
  } catch (error) {
    const errorObj = error as any;
    const isAuthError = errorObj?.error === 'NOT_AUTHORIZED' || errorObj?.statusCode === 403;
    if (isAuthError) {
      const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || 'unknown';
      console.error(`[Full Reports] NOT_AUTHORIZED: API key lacks permissions for table "${FULL_REPORTS_TABLE_NAME}" in base ${baseId.substring(0, 20)}...`);
      console.error(`[Full Reports] Check: 1) API key has read access to this table, 2) Table exists in base ${baseId}, 3) AIRTABLE_OS_BASE_ID vs AIRTABLE_BASE_ID is correct`);
    }
    console.error('[Full Reports] Error fetching all reports:', error);
    return [];
  }
}

function parseJsonField(value: unknown): unknown | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * Get a Full Report by its record ID
 *
 * @param reportId - Airtable Full Report record ID
 * @returns Full Report record or null
 */
export async function getFullReportById(
  reportId: string
): Promise<any | null> {
  try {
    const table = base(FULL_REPORTS_TABLE_NAME);
    const record = await table.find(reportId);
    return record;
  } catch (error) {
    console.warn(
      `[Airtable] Failed to fetch Full Report ${reportId}:`,
      error
    );
    return null;
  }
}

/**
 * Get the latest OS Full Report for a company
 *
 * @param companyId - Airtable Company record ID
 * @returns Latest OS Full Report record or null
 */
export async function getLatestOsFullReportForCompany(
  companyId: string
): Promise<any | null> {
  try {
    const table = base(FULL_REPORTS_TABLE_NAME);

    // Fetch all OS reports and filter by company in JS (Airtable linked fields are arrays)
    const records = await table
      .select({
        filterByFormula: `{Report Type} = 'OS'`,
        sort: [{ field: 'Report Date', direction: 'desc' }],
      })
      .all();

    // Filter by company ID (linked field is an array)
    const companyReports = records.filter((record) => {
      const companyIds = record.fields['Company'] as string[] | undefined;
      return companyIds && companyIds.includes(companyId);
    });

    if (companyReports.length === 0) {
      return null;
    }

    return companyReports[0]; // Already sorted by date desc
  } catch (error: any) {
    // Silently return null for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // This table is optional/legacy - don't spam the console
    if (error?.statusCode === 403 || error?.statusCode === 404 ||
        error?.error === 'NOT_AUTHORIZED' || error?.error === 'TABLE_NOT_FOUND') {
      return null;
    }
    console.warn(
      `[Airtable] Failed to fetch OS Full Report for company ${companyId}:`,
      error
    );
    return null;
  }
}

/**
 * Get recent OS Full Reports for a company (for trend analysis)
 *
 * @param companyId - Airtable Company record ID
 * @param limit - Maximum number of records to return (default: 5)
 * @returns Array of OS Full Report records, sorted oldest → newest
 */
export async function getOsFullReportsForCompany(
  companyId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const table = base(FULL_REPORTS_TABLE_NAME);

    // Fetch all OS reports and filter by company in JS (Airtable linked fields are arrays)
    const records = await table
      .select({
        filterByFormula: `{Report Type} = 'OS'`,
        sort: [{ field: 'Report Date', direction: 'asc' }], // oldest → newest
      })
      .all();

    // Filter by company ID (linked field is an array) and limit
    const companyReports = records
      .filter((record) => {
        const companyIds = record.fields['Company'] as string[] | undefined;
        return companyIds && companyIds.includes(companyId);
      })
      .slice(0, limit);

    return companyReports;
  } catch (error: any) {
    // Silently return empty for NOT_AUTHORIZED or TABLE_NOT_FOUND errors
    // This table is optional/legacy - don't spam the console
    if (error?.statusCode === 403 || error?.statusCode === 404 ||
        error?.error === 'NOT_AUTHORIZED' || error?.error === 'TABLE_NOT_FOUND') {
      return [];
    }
    console.warn(
      `[Airtable] Failed to fetch OS Full Reports for company ${companyId}:`,
      error
    );
    return [];
  }
}

/**
 * Compute Website/UX trend from historical OS Full Reports
 *
 * @param records - Array of OS Full Report records (sorted oldest → newest)
 * @returns WebsiteUxTrend object with trend analysis
 */
export function computeWebsiteUxTrend(records: any[]): WebsiteUxTrend {
  // Map records to series data
  const series = records.map((record) => ({
    date: (record.fields['Report Date'] as string) || '',
    score: (record.fields['Website UX Score'] as number) ?? null,
  }));

  // Extract latest and previous scores
  const latestScore =
    series.length > 0 ? series[series.length - 1].score : null;
  const previousScore = series.length > 1 ? series[series.length - 2].score : null;

  // Calculate delta
  let delta: number | null = null;
  if (latestScore !== null && previousScore !== null) {
    delta = latestScore - previousScore;
  }

  // Determine direction based on 0.25 threshold
  let direction: 'up' | 'down' | 'flat' | 'na' = 'na';
  if (delta !== null) {
    if (delta > 0.25) {
      direction = 'up';
    } else if (delta < -0.25) {
      direction = 'down';
    } else {
      direction = 'flat';
    }
  }

  return {
    latestScore,
    previousScore,
    delta,
    direction,
    series,
  };
}

/**
 * Compute generalized score trend from historical OS Full Reports
 *
 * Works with any Airtable score field (Overall Score, Brand Score, etc.)
 *
 * @param records - Array of OS Full Report records (sorted oldest → newest)
 * @param fieldName - Airtable field name (e.g., "Overall Score", "Brand Score")
 * @returns WebsiteUxTrend object with trend analysis
 */
export function computeScoreTrend(
  records: any[],
  fieldName: string
): WebsiteUxTrend {
  // Map records to series data
  const series = records.map((record) => ({
    date: (record.fields['Report Date'] as string) || '',
    score: (record.fields[fieldName] as number) ?? null,
  }));

  // Extract latest and previous scores
  const latestScore =
    series.length > 0 ? series[series.length - 1].score : null;
  const previousScore = series.length > 1 ? series[series.length - 2].score : null;

  // Calculate delta
  let delta: number | null = null;
  if (latestScore !== null && previousScore !== null) {
    delta = latestScore - previousScore;
  }

  // Determine direction based on 0.25 threshold
  let direction: 'up' | 'down' | 'flat' | 'na' = 'na';
  if (delta !== null) {
    if (delta > 0.25) {
      direction = 'up';
    } else if (delta < -0.25) {
      direction = 'down';
    } else {
      direction = 'flat';
    }
  }

  return {
    latestScore,
    previousScore,
    delta,
    direction,
    series,
  };
}

/**
 * Build human-readable diagnostics text from Website/UX diagnostic
 */
function buildWebsiteUxDiagnosticsText(d: WebsiteUxDiagnostic): string {
  const issuesText =
    d.issues.length > 0
      ? d.issues
          .map(
            (i) =>
              `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}`
          )
          .join('\n')
      : 'No major UX issues identified.';

  return [
    `Score: ${d.score}/10`,
    '',
    d.justification || '',
    '',
    'Issues:',
    issuesText,
  ].join('\n');
}

// ============================================================================
// v2 Schema Read Functions
// ============================================================================

/**
 * Parse Full Report record to OsDiagnosticResult (v2 schema)
 *
 * Reads JSON fields and reconstructs the full diagnostic result object.
 * Includes runtime guards for safe parsing.
 *
 * @param record - Airtable Full Report record
 * @returns OsDiagnosticResult or null if parsing fails
 */
export function parseFullReportToOsResult(record: any): OsDiagnosticResult | null {
  try {
    const fields = record.fields;

    // Try to parse JSON fields
    let scoresJson: ScoresJson | null = null;
    let diagnosticsJson: DiagnosticsJson | null = null;
    let priorities: any[] = [];
    let plan: any = null;
    let evidence: any = {};

    // Parse Scores JSON
    const scoresRaw = fields['Scores JSON'] as string | undefined;
    if (scoresRaw) {
      try {
        scoresJson = JSON.parse(scoresRaw);
      } catch (e) {
        console.warn('[parseFullReportToOsResult] Failed to parse Scores JSON:', e);
      }
    }

    // Parse Diagnostics JSON
    const diagnosticsRaw = fields['Diagnostics JSON'] as string | undefined;
    if (diagnosticsRaw) {
      try {
        diagnosticsJson = JSON.parse(diagnosticsRaw);
      } catch (e) {
        console.warn('[parseFullReportToOsResult] Failed to parse Diagnostics JSON:', e);
      }
    }

    // Parse Priorities JSON
    const prioritiesRaw = fields['Priorities JSON'] as string | undefined;
    if (prioritiesRaw) {
      try {
        priorities = JSON.parse(prioritiesRaw);
      } catch (e) {
        console.warn('[parseFullReportToOsResult] Failed to parse Priorities JSON:', e);
      }
    }

    // Parse Plan JSON
    const planRaw = fields['Plan JSON'] as string | undefined;
    if (planRaw) {
      try {
        plan = JSON.parse(planRaw);
      } catch (e) {
        console.warn('[parseFullReportToOsResult] Failed to parse Plan JSON:', e);
      }
    }

    // Parse Evidence JSON
    const evidenceRaw = fields['Evidence JSON'] as string | undefined;
    if (evidenceRaw) {
      try {
        evidence = JSON.parse(evidenceRaw);
      } catch (e) {
        console.warn('[parseFullReportToOsResult] Failed to parse Evidence JSON:', e);
      }
    }

    // If we have parsed data, construct OsDiagnosticResult
    if (scoresJson) {
      return {
        overallScore: scoresJson.overallScore,
        pillarScores: scoresJson.pillarScores || [],
        priorities: priorities || [],
        plan: plan || { quickWins: [], strategicInitiatives: [] },
        evidence: evidence || {},
        schemaVersion: (fields['Schema Version'] as string) || 'v1',
        metadata: {
          companyId: Array.isArray(fields['Company'])
            ? fields['Company'][0]
            : undefined,
          snapshotId: Array.isArray(fields['Snapshot'])
            ? fields['Snapshot'][0]
            : undefined,
          gapRunId: Array.isArray(fields['Gap Run'])
            ? fields['Gap Run'][0]
            : undefined,
          runDate: fields['Report Date'] as string | undefined,
        },
      };
    }

    // Fallback: If no v2 JSON data, return null
    return null;
  } catch (error) {
    console.error('[parseFullReportToOsResult] Failed to parse Full Report:', error);
    return null;
  }
}

/**
 * Get the latest OS Full Report as OsDiagnosticResult (v2 schema)
 *
 * @param companyId - Airtable Company record ID
 * @returns OsDiagnosticResult or null
 */
export async function getLatestOsResultForCompany(
  companyId: string
): Promise<OsDiagnosticResult | null> {
  console.log(`[Full Reports] Fetching latest OS result for company: ${companyId}`);
  const record = await getLatestOsFullReportForCompany(companyId);
  if (!record) {
    console.log(`[Full Reports] No OS report found for company: ${companyId}`);
    return null;
  }
  console.log(`[Full Reports] Found OS report: ${record.id}`);
  const result = parseFullReportToOsResult(record);
  if (result) {
    console.log(`[Full Reports] Parsed OS result:`, {
      schemaVersion: result.schemaVersion,
      overallScore: result.overallScore,
      pillarCount: result.pillarScores.length,
      prioritiesCount: result.priorities.length,
    });
  } else {
    console.warn(`[Full Reports] Failed to parse OS result from record: ${record.id}`);
  }
  return result;
}

// ============================================================================
// v2 Schema Helper Functions
// ============================================================================

/**
 * Get score for a specific pillar from OsDiagnosticResult
 */
function getPillarScoreValue(
  result: OsDiagnosticResult,
  pillar: Pillar
): number | null {
  const pillarScore = result.pillarScores.find((ps) => ps.pillar === pillar);
  return pillarScore?.score ?? null;
}

/**
 * Build a short summary from top priorities
 * Example: "Improve page load speed, Add clear CTAs"
 */
function buildTopPrioritySummary(result: OsDiagnosticResult): string {
  if (!result.priorities || result.priorities.length === 0) {
    return 'No priorities identified';
  }

  // Take top 2 priorities by impact/effort ratio
  const topPriorities = result.priorities
    .filter((p) => p.impact === 'high' || p.impact === 'medium')
    .slice(0, 2);

  if (topPriorities.length === 0) {
    return result.priorities[0]?.title || 'No priorities identified';
  }

  return topPriorities.map((p) => p.title).join(', ');
}

/**
 * Derive Status field based on overall score
 * - < 4: Critical
 * - 4-7: Needs Attention
 * - > 7: OK
 */
function deriveStatus(overallScore: number): string {
  if (overallScore < 4) return 'Critical';
  if (overallScore <= 7) return 'Needs Attention';
  return 'OK';
}

/**
 * Build structured diagnostics JSON from OsDiagnosticResult
 */
function buildDiagnosticsJson(result: OsDiagnosticResult): DiagnosticsJson {
  const issuesByPillar: Record<Pillar, any[]> = {
    brand: [],
    content: [],
    seo: [],
    websiteUx: [],
    funnel: [],
  };

  // Group issues by pillar
  for (const pillarScore of result.pillarScores) {
    if (pillarScore.issues) {
      issuesByPillar[pillarScore.pillar] = pillarScore.issues;
    }
  }

  return {
    issuesByPillar,
    summary: buildTopPrioritySummary(result),
    commentary: result.pillarScores
      .map((ps) => `${ps.pillar}: ${ps.justification}`)
      .join('\n\n'),
  };
}

/**
 * Build DiagnosticsPayload for diagnostics view from OsDiagnosticResult
 * Converts the OsDiagnosticResult format into the structure expected by the diagnostics page
 */
function buildDiagnosticsPayload(result: OsDiagnosticResult): DiagnosticsPayload {
  const payload: DiagnosticsPayload = {};

  // Convert each pillar's data into DiagnosticArea format
  for (const pillarScore of result.pillarScores) {
    const pillar = pillarScore.pillar;

    // Map issues to DiagnosticIssue format
    const issues: DiagnosticIssue[] = (pillarScore.issues || []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      severity: issue.severity as DiagnosticSeverity,
      suggestion: issue.description, // Map description to suggestion
      evidence: '', // No evidence in current format
    }));

    // Create DiagnosticArea
    const area: DiagnosticArea = {
      label: pillar.charAt(0).toUpperCase() + pillar.slice(1), // Capitalize
      score: pillarScore.score * 10, // Convert from 1-10 scale to 0-100 scale
      summary: pillarScore.justification,
      issues,
    };

    payload[pillar] = area;
  }

  return payload;
}

/**
 * Normalize priorities from OsDiagnosticResult to canonical PrioritiesPayload (v2)
 * Maps internal diagnostics priority format to the canonical schema defined in lib/gap/types.ts
 */
function buildPrioritiesPayload(priorities: any[]): PrioritiesPayload {
  const items: PriorityItem[] = priorities.map((priority) => {
    // Map pillar to canonical PriorityArea
    const pillarToArea = (pillar: string): PriorityArea => {
      const normalized = pillar.toLowerCase();
      if (normalized === 'brand') return 'Brand';
      if (normalized === 'content') return 'Content';
      if (normalized === 'seo') return 'SEO';
      if (normalized === 'websiteux') return 'Website UX';
      if (normalized === 'funnel') return 'Funnel';
      return 'Other';
    };

    // Map impact/effort to canonical format (capitalize first letter)
    const capitalizeFirst = (str: string | undefined): string | undefined => {
      if (!str) return undefined;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Build canonical priority item
    const item: PriorityItem = {
      id: priority.id || `priority-${Math.random().toString(36).substr(2, 9)}`,
      title: priority.title || 'Untitled Priority',
    };

    // Add optional fields if present
    if (priority.pillar) {
      item.area = pillarToArea(priority.pillar);
    }

    // Note: severity is not in the diagnostics Priority type, but might be added later
    if (priority.severity) {
      item.severity = capitalizeFirst(priority.severity) as PrioritySeverity;
    }

    if (priority.impact) {
      item.impact = capitalizeFirst(priority.impact) as PriorityImpactLevel;
    }

    if (priority.effort) {
      item.effort = capitalizeFirst(priority.effort) as PriorityEffortSize;
    }

    if (priority.description) {
      item.description = priority.description;
    }

    if (priority.rationale) {
      item.rationale = priority.rationale;
    }

    if (priority.summary) {
      item.summary = priority.summary;
    }

    if (priority.expectedOutcome) {
      item.expectedOutcome = priority.expectedOutcome;
    }

    if (priority.status) {
      item.status = priority.status;
    }

    return item;
  });

  return {
    items,
  };
}

/**
 * Normalize plan from legacy format to canonical PlanPayload (v2)
 * Converts quickWins/strategicInitiatives to 30/60/90-day initiatives
 */
function buildPlanPayload(plan: any): PlanPayload {
  // If plan is already in PlanPayload format (has initiatives or phases), return as-is
  if (plan && (plan.initiatives || plan.phases)) {
    return plan as PlanPayload;
  }

  // Otherwise, convert from legacy quickWins/strategicInitiatives format
  const initiatives: import('@/lib/gap/types').PlanInitiative[] = [];

  // Map quickWins to 30_days initiatives
  if (plan?.quickWins && Array.isArray(plan.quickWins)) {
    for (const qw of plan.quickWins) {
      initiatives.push({
        id: qw.id || `quick-win-${Math.random().toString(36).substr(2, 9)}`,
        title: qw.title || 'Untitled Quick Win',
        summary: qw.description,
        timeHorizon: '30_days' as const,
        effort: qw.estimatedEffort || 'S',
        impact: qw.estimatedImpact || 'Medium',
        area: qw.pillar ? mapPillarToArea(qw.pillar) : undefined,
        status: 'not_started' as const,
      });
    }
  }

  // Map strategicInitiatives to 60_days or 90_days initiatives
  if (plan?.strategicInitiatives && Array.isArray(plan.strategicInitiatives)) {
    for (const si of plan.strategicInitiatives) {
      // Parse timeline to determine time horizon
      const timeHorizon = parseTimelineToHorizon(si.timeline);

      initiatives.push({
        id: si.id || `strategic-${Math.random().toString(36).substr(2, 9)}`,
        title: si.title || 'Untitled Initiative',
        summary: si.description,
        detail: si.expectedOutcome,
        timeHorizon,
        area: si.pillar && si.pillar !== 'multi' ? mapPillarToArea(si.pillar) : undefined,
        effort: 'M', // Default to medium
        impact: 'High', // Default to high for strategic initiatives
        status: 'not_started' as const,
      });
    }
  }

  return {
    initiatives,
    overallTheme: plan?.headlineSummary,
    narrativeSummary: plan?.headlineSummary,
  };
}

/**
 * Helper: Parse timeline string to time horizon
 */
function parseTimelineToHorizon(
  timeline?: string
): import('@/lib/gap/types').PlanTimeHorizon {
  if (!timeline) return '60_days';

  const lower = timeline.toLowerCase();
  if (lower.includes('30') || lower.includes('month') || lower.includes('immediate')) {
    return '30_days';
  }
  if (lower.includes('60') || lower.includes('2 month') || lower.includes('two month')) {
    return '60_days';
  }
  if (lower.includes('90') || lower.includes('3 month') || lower.includes('three month')) {
    return '90_days';
  }
  if (lower.includes('6 month') || lower.includes('year') || lower.includes('long')) {
    return 'beyond_90_days';
  }

  // Default to 60 days for strategic initiatives
  return '60_days';
}

/**
 * Helper: Map pillar to canonical PriorityArea
 */
function mapPillarToArea(pillar: string): PriorityArea {
  const normalized = pillar.toLowerCase();
  if (normalized === 'brand') return 'Brand';
  if (normalized === 'content') return 'Content';
  if (normalized === 'seo') return 'SEO';
  if (normalized === 'websiteux' || normalized === 'website') return 'Website UX';
  if (normalized === 'funnel') return 'Funnel';
  return 'Other';
}

// ============================================================================
// Full Report Record Helpers (for Diagnostics View)
// ============================================================================

/**
 * Helper to parse JSON safely
 */
function safeParseJsonField(maybeJson?: string): unknown {
  if (!maybeJson) return undefined;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return undefined;
  }
}

/**
 * Map an Airtable Full Report record to FullReportRecord
 */
function mapToFullReportRecord(record: any): FullReportRecord {
  const fields = record.fields as any;

  // Extract company ID from link field (array of IDs)
  const companyIds = fields['Company'] as string[] | undefined;
  const snapshotIds = fields['Snapshot'] as string[] | undefined;
  const gapRunIds = fields['Gap Run'] as string[] | undefined;

  // Build scores object
  const scores: FullReportScores = {
    overall: fields['Overall Score'] as number | undefined,
    brand: fields['Brand Score'] as number | undefined,
    content: fields['Content Score'] as number | undefined,
    seo: fields['SEO Score'] as number | undefined,
    websiteUx: fields['Website UX Score'] as number | undefined,
    funnel: fields['Funnel Score'] as number | undefined,
  };

  return {
    id: record.id,
    companyId: companyIds?.[0] ?? '',
    snapshotId: snapshotIds?.[0],
    gapRunId: gapRunIds?.[0],
    scores,
    summary: fields['Top Priority Summary'] as string | undefined,
    status: (fields['Status'] as FullReportStatus) ?? 'draft',
    reportVersion: fields['Schema Version'] as string | undefined,
    scoresJson: safeParseJsonField(fields['Scores JSON'] as string),
    diagnosticsJson: safeParseJsonField(fields['Diagnostics JSON'] as string) as DiagnosticsPayload | undefined,
    prioritiesJson: safeParseJsonField(fields['Priorities JSON'] as string) as PrioritiesPayload | undefined,
    planJson: safeParseJsonField(fields['Plan JSON'] as string) as PlanPayload | undefined,
    evidenceJson: safeParseJsonField(fields['Evidence JSON'] as string) as EvidencePayload | undefined,
    createdAt: fields['Report Date'] as string | undefined,
    updatedAt: fields['Report Date'] as string | undefined, // Airtable doesn't track updates separately
  };
}

/**
 * Get all Full Reports for a company
 *
 * Returns reports sorted by date (newest first)
 *
 * @param companyId - Airtable Company record ID
 * @returns Array of FullReportRecord
 */
export async function getFullReportsForCompany(
  companyId: string
): Promise<FullReportRecord[]> {
  try {
    console.log(`[Full Reports] Fetching reports for company: ${companyId}`);
    console.log(`[Full Reports] Using table name: "${FULL_REPORTS_TABLE_NAME}"`);
    console.log(`[Full Reports] Airtable base ID configured: ${!!process.env.AIRTABLE_BASE_ID}`);
    console.log(`[Full Reports] Airtable API key configured: ${!!(process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_ACCESS_TOKEN)}`);

    const table = base(FULL_REPORTS_TABLE_NAME);

    // Fetch all OS reports and filter by company in JS (linked fields are arrays)
    const records = await table
      .select({
        filterByFormula: `{Report Type} = 'OS'`,
        sort: [{ field: 'Report Date', direction: 'desc' }], // newest first
      })
      .all();

    // Filter by company ID (linked field is an array)
    const companyReports = records.filter((record) => {
      const companyIds = record.fields['Company'] as string[] | undefined;
      return companyIds && companyIds.includes(companyId);
    });

    console.log(`[Full Reports] Found ${companyReports.length} reports for company ${companyId}`);

    // Map to FullReportRecord
    return companyReports.map(mapToFullReportRecord);
  } catch (error) {
    // Check for authorization errors - these are expected if table doesn't exist or no access
    const isAuthError = error && typeof error === 'object' &&
      (('error' in error && (error as any).error === 'NOT_AUTHORIZED') ||
       ('statusCode' in error && (error as any).statusCode === 403));

    if (isAuthError) {
      // Silently return empty array for auth errors (table may not exist or no access)
      console.warn(`[Full Reports] No access to Full Reports table for company ${companyId}, skipping`);
      return [];
    }

    // Log other errors with details
    console.error(`[Full Reports] Error fetching reports for company ${companyId}:`,
      error instanceof Error ? error.message : 'Unknown error');

    return [];
  }
}
