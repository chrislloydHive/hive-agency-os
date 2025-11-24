// lib/airtable/gapFullReports.ts
// Airtable integration for GAP-Full Report table
// Handles saving Website/UX diagnostics and other OS diagnostics
// v2: Uses JSON fields for detailed data, scalar fields for scores

import { base } from './client';
import { AIRTABLE_TABLES, getTableName } from './tables';
import type { WebsiteUxDiagnostic } from '@/lib/diagnostics/websiteUx';
import type {
  OsDiagnosticResult,
  Pillar,
  ScoresJson,
  DiagnosticsJson,
} from '@/lib/diagnostics/types';
import type { GapFullReport } from '@/lib/gap/types';

const GAP_FULL_REPORT_TABLE_NAME =
  process.env.AIRTABLE_GAP_FULL_REPORT_TABLE ||
  process.env.AIRTABLE_FULL_REPORTS_TABLE ||
  AIRTABLE_TABLES.GAP_FULL_REPORT;

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
// GAP-Full Report Record Types
// ============================================================================

export type GapFullReportScores = {
  overall?: number;
  brand?: number;
  content?: number;
  seo?: number;
  websiteUx?: number;
  funnel?: number;
};

export type GapFullReportStatus = "draft" | "processing" | "ready" | "archived" | "error";

export type GapFullReportRecord = {
  id: string;
  companyId: string;
  snapshotId?: string;
  gapRunId?: string;
  scores: GapFullReportScores;
  summary?: string;
  status: GapFullReportStatus;
  reportVersion?: string;
  scoresJson?: unknown;
  diagnosticsJson?: DiagnosticsPayload | undefined;
  prioritiesJson?: unknown;
  planJson?: unknown;
  evidenceJson?: unknown;
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

export type UpsertGapFullReportArgs = {
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
 * Upsert GAP-Full Report record for OS diagnostics (v2 schema)
 *
 * Creates or updates a GAP-Full Report record for the given company.
 * Supports both legacy websiteUx and new osResult formats.
 *
 * v2 schema:
 * - Scalar fields for scores (Overall Score, Brand Score, etc.)
 * - JSON fields for detailed data (Scores JSON, Diagnostics JSON, etc.)
 *
 * @param args - Report data including diagnostics
 * @returns Airtable record ID
 */
export async function upsertGapFullReportForOsRun({
  companyId,
  snapshotId,
  gapRunId,
  reportType,
  websiteUx,
  osResult,
}: UpsertGapFullReportArgs): Promise<string> {
  const table = base(GAP_FULL_REPORT_TABLE_NAME);

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
    console.log('[GAP-Full Report] Processing v2 osResult...');

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

    const diagnosticsJson: DiagnosticsJson = buildDiagnosticsJson(osResult);
    fields['Diagnostics JSON'] = JSON.stringify(diagnosticsJson);

    fields['Priorities JSON'] = JSON.stringify(osResult.priorities);
    fields['Plan JSON'] = JSON.stringify(osResult.plan);
    fields['Evidence JSON'] = JSON.stringify(osResult.evidence);

    // Log the fields being written
    console.log('[GAP-Full Report] v2 schema fields prepared:', {
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
        'Diagnostics JSON': fields['Diagnostics JSON']?.length || 0,
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
    console.log(`[GAP-Full Report] Updating existing record: ${recordId}`);
    const updated = await table.update([
      {
        id: recordId,
        fields,
      },
    ]);
    const updatedId = updated[0].id;
    console.log(
      `✅ [GAP-Full Report] Updated record ${updatedId} for company ${companyId}`
    );
    return updatedId;
  } else {
    console.log(`[GAP-Full Report] Creating new record for company ${companyId}`);
    const created = await table.create([
      {
        fields,
      },
    ]);
    const createdId = created[0].id;
    console.log(
      `✅ [GAP-Full Report] Created record ${createdId} for company ${companyId}`
    );
    return createdId;
  }
}

/**
 * Get a GAP-Full Report by its record ID
 *
 * @param reportId - Airtable GAP-Full Report record ID
 * @returns GAP-Full Report record or null
 */
export async function getGapFullReportById(
  reportId: string
): Promise<any | null> {
  try {
    const table = base(GAP_FULL_REPORT_TABLE_NAME);
    const record = await table.find(reportId);
    return record;
  } catch (error) {
    console.warn(
      `[Airtable] Failed to fetch GAP-Full Report ${reportId}:`,
      error
    );
    return null;
  }
}

/**
 * Get the latest OS GAP-Full Report for a company
 *
 * @param companyId - Airtable Company record ID
 * @returns Latest OS GAP-Full Report record or null
 */
export async function getLatestOsGapFullReportForCompany(
  companyId: string
): Promise<any | null> {
  try {
    const table = base(GAP_FULL_REPORT_TABLE_NAME);

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
  } catch (error) {
    console.warn(
      `[Airtable] Failed to fetch OS GAP-Full Report for company ${companyId}:`,
      error
    );
    return null;
  }
}

/**
 * Get recent OS GAP-Full Reports for a company (for trend analysis)
 *
 * @param companyId - Airtable Company record ID
 * @param limit - Maximum number of records to return (default: 5)
 * @returns Array of OS GAP-Full Report records, sorted oldest → newest
 */
export async function getOsGapFullReportsForCompany(
  companyId: string,
  limit: number = 5
): Promise<any[]> {
  try {
    const table = base(GAP_FULL_REPORT_TABLE_NAME);

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
  } catch (error) {
    console.warn(
      `[Airtable] Failed to fetch OS GAP-Full Reports for company ${companyId}:`,
      error
    );
    return [];
  }
}

/**
 * Compute Website/UX trend from historical OS GAP-Full Reports
 *
 * @param records - Array of OS GAP-Full Report records (sorted oldest → newest)
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
 * Compute generalized score trend from historical OS GAP-Full Reports
 *
 * Works with any Airtable score field (Overall Score, Brand Score, etc.)
 *
 * @param records - Array of OS GAP-Full Report records (sorted oldest → newest)
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
 * Parse GAP-Full Report record to OsDiagnosticResult (v2 schema)
 *
 * Reads JSON fields and reconstructs the full diagnostic result object.
 * Includes runtime guards for safe parsing.
 *
 * @param record - Airtable GAP-Full Report record
 * @returns OsDiagnosticResult or null if parsing fails
 */
export function parseGapFullReportToOsResult(record: any): OsDiagnosticResult | null {
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
        console.warn('[parseGapFullReportToOsResult] Failed to parse Scores JSON:', e);
      }
    }

    // Parse Diagnostics JSON
    const diagnosticsRaw = fields['Diagnostics JSON'] as string | undefined;
    if (diagnosticsRaw) {
      try {
        diagnosticsJson = JSON.parse(diagnosticsRaw);
      } catch (e) {
        console.warn('[parseGapFullReportToOsResult] Failed to parse Diagnostics JSON:', e);
      }
    }

    // Parse Priorities JSON
    const prioritiesRaw = fields['Priorities JSON'] as string | undefined;
    if (prioritiesRaw) {
      try {
        priorities = JSON.parse(prioritiesRaw);
      } catch (e) {
        console.warn('[parseGapFullReportToOsResult] Failed to parse Priorities JSON:', e);
      }
    }

    // Parse Plan JSON
    const planRaw = fields['Plan JSON'] as string | undefined;
    if (planRaw) {
      try {
        plan = JSON.parse(planRaw);
      } catch (e) {
        console.warn('[parseGapFullReportToOsResult] Failed to parse Plan JSON:', e);
      }
    }

    // Parse Evidence JSON
    const evidenceRaw = fields['Evidence JSON'] as string | undefined;
    if (evidenceRaw) {
      try {
        evidence = JSON.parse(evidenceRaw);
      } catch (e) {
        console.warn('[parseGapFullReportToOsResult] Failed to parse Evidence JSON:', e);
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
    console.error('[parseGapFullReportToOsResult] Failed to parse GAP-Full Report:', error);
    return null;
  }
}

/**
 * Get the latest OS GAP-Full Report as OsDiagnosticResult (v2 schema)
 *
 * @param companyId - Airtable Company record ID
 * @returns OsDiagnosticResult or null
 */
export async function getLatestOsResultFromGapFullReportForCompany(
  companyId: string
): Promise<OsDiagnosticResult | null> {
  console.log(`[GAP-Full Report] Fetching latest OS result for company: ${companyId}`);
  const record = await getLatestOsGapFullReportForCompany(companyId);
  if (!record) {
    console.log(`[GAP-Full Report] No OS report found for company: ${companyId}`);
    return null;
  }
  console.log(`[GAP-Full Report] Found OS report: ${record.id}`);
  const result = parseGapFullReportToOsResult(record);
  if (result) {
    console.log(`[GAP-Full Report] Parsed OS result:`, {
      schemaVersion: result.schemaVersion,
      overallScore: result.overallScore,
      pillarCount: result.pillarScores.length,
      prioritiesCount: result.priorities.length,
    });
  } else {
    console.warn(`[GAP-Full Report] Failed to parse OS result from record: ${record.id}`);
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

// ============================================================================
// GAP-Full Report Record Helpers (for Diagnostics View)
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
 * Map an Airtable GAP-Full Report record to GapFullReportRecord
 */
function mapToGapFullReportRecord(record: any): GapFullReportRecord {
  const fields = record.fields as any;

  // Extract company ID from link field (array of IDs)
  const companyIds = fields['Company'] as string[] | undefined;
  const snapshotIds = fields['Snapshot'] as string[] | undefined;
  const gapRunIds = fields['Gap Run'] as string[] | undefined;

  // Build scores object
  const scores: GapFullReportScores = {
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
    status: (fields['Status'] as GapFullReportStatus) ?? 'draft',
    reportVersion: fields['Schema Version'] as string | undefined,
    scoresJson: safeParseJsonField(fields['Scores JSON'] as string),
    diagnosticsJson: safeParseJsonField(fields['Diagnostics JSON'] as string) as DiagnosticsPayload | undefined,
    prioritiesJson: safeParseJsonField(fields['Priorities JSON'] as string),
    planJson: safeParseJsonField(fields['Plan JSON'] as string),
    evidenceJson: safeParseJsonField(fields['Evidence JSON'] as string),
    createdAt: fields['Report Date'] as string | undefined,
    updatedAt: fields['Report Date'] as string | undefined, // Airtable doesn't track updates separately
  };
}

/**
 * Get all GAP-Full Reports for a company
 *
 * Returns reports sorted by date (newest first)
 *
 * @param companyId - Airtable Company record ID
 * @returns Array of GapFullReportRecord
 */
export async function getGapFullReportsForCompany(
  companyId: string
): Promise<GapFullReportRecord[]> {
  try {
    console.log(`[GAP-Full Report] Fetching reports for company: ${companyId}`);

    const table = base(GAP_FULL_REPORT_TABLE_NAME);

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

    console.log(`[GAP-Full Report] Found ${companyReports.length} reports for company ${companyId}`);

    // Map to GapFullReportRecord
    return companyReports.map(mapToGapFullReportRecord);
  } catch (error) {
    console.error(`[GAP-Full Report] Error fetching reports for company ${companyId}:`, error);
    return [];
  }
}

/**
 * List recent GAP-Full Reports for Hive OS dashboard
 * Returns most recent reports sorted by creation time
 */
export async function listRecentGapFullReports(limit: number = 20): Promise<GapFullReport[]> {
  try {
    console.log('[GAP-Full Report] Listing recent reports, limit:', limit);

    const table = base(GAP_FULL_REPORT_TABLE_NAME);
    const records = await table
      .select({
        maxRecords: limit,
        sort: [{ field: 'Created At', direction: 'desc' }],
        filterByFormula: "AND({Status} != 'archived', {Status} != '', NOT({Archived}))",
      })
      .all();

    console.log(`[GAP-Full Report] Retrieved ${records.length} reports`);

    return records.map((record) => {
      const fields = record.fields;
      return {
        id: record.id,
        companyId: Array.isArray(fields['Company']) ? fields['Company'][0] : undefined,
        gapPlanRunId: Array.isArray(fields['GAP Plan Run']) ? fields['GAP Plan Run'][0] : undefined,
        status: (fields['Status'] as GapFullReportStatus) || 'draft',
        reportType: fields['Report Type'] as 'Initial' | 'Quarterly' | 'Annual' | undefined,
        overallScore: fields['Overall Score'] as number | undefined,
        brandScore: fields['Brand Score'] as number | undefined,
        contentScore: fields['Content Score'] as number | undefined,
        websiteScore: fields['Website UX Score'] as number | undefined,
        seoScore: fields['SEO Score'] as number | undefined,
        authorityScore: fields['Authority Score'] as number | undefined,
        createdAt: fields['Created At'] as string,
        updatedAt: fields['Updated At'] as string,
      } as GapFullReport;
    });
  } catch (error) {
    console.error('[GAP-Full Report] Failed to list recent reports:', error);
    return [];
  }
}

// ============================================================================
// Backward compatibility exports (deprecated)
// ============================================================================

export type FullReportScores = GapFullReportScores;
export type FullReportStatus = GapFullReportStatus;
export type FullReportRecord = GapFullReportRecord;
export const upsertFullReportForOsRun = upsertGapFullReportForOsRun;
export const getFullReportById = getGapFullReportById;
