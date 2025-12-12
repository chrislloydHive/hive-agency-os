// lib/os/context.ts
// Context management for MVP Company Context Workspace
//
// Provides CRUD operations for company context data.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  CompanyContext,
  UpdateContextRequest,
  ContextSummary,
  CompetitionSummary,
  CompetitionSummaryCompetitor,
  ContextDraft,
  ContextDraftSource,
  Competitor,
} from '@/lib/types/context';
import { createContextSummary } from '@/lib/types/context';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import { getDiagnosticFindingsForCompany } from '@/lib/airtable/diagnosticDetails';
import { getFullReportsForCompany } from '@/lib/airtable/fullReports';
import { getRecentRunsForCompany } from '@/lib/os/diagnostics/runs';

// ============================================================================
// Baseline Signal Detection Types
// ============================================================================

/**
 * Represents the baseline signals available for a company.
 * Used to determine if AI context generation has enough data to work with.
 */
export interface BaselineSignals {
  /** Whether any diagnostic labs have been run */
  hasLabRuns: boolean;
  /** Whether a Full GAP report exists */
  hasFullGap: boolean;
  /** Whether a Competition run exists */
  hasCompetition: boolean;
  /** Whether website metadata (title/description) is available */
  hasWebsiteMetadata: boolean;
  /** Count of diagnostic findings */
  findingsCount: number;
  /** Number of competitors found */
  competitorCount: number;
  /** Latest Full GAP report ID (if available) */
  fullGapReportId?: string;
  /** Website title from diagnostics (if available) */
  websiteTitle?: string;
  /** Website meta description from diagnostics (if available) */
  websiteMetaDescription?: string;
  /** Summary of available signal sources */
  signalSources: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const CONTEXT_TABLE = AIRTABLE_TABLES.COMPANY_CONTEXT;
const CONTEXT_DRAFT_TABLE = AIRTABLE_TABLES.COMPANY_CONTEXT_DRAFTS;

// Field name mapping: TypeScript property -> Airtable field name
// Based on actual Airtable schema (all camelCase)
const FIELD_MAP: Record<string, string> = {
  companyId: 'companyId',
  businessModel: 'businessModel',
  valueProposition: 'valueProposition',
  companyCategory: 'companyCategory',
  marketSignals: 'marketSignals',
  primaryAudience: 'primaryAudience',
  secondaryAudience: 'secondaryAudience',
  icpDescription: 'icpDescription',
  objectives: 'objectives',
  keyMetrics: 'keyMetrics',
  constraints: 'constraints',
  budget: 'budget',
  timeline: 'timeline',
  competitorsNotes: 'competitorsNotes',
  competitors: 'competitors',
  differentiators: 'differentiators',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy',
  isAiGenerated: 'isAiGenerated',
};

// Reverse mapping: Airtable field name -> TypeScript property
const REVERSE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

// Fields that should NOT be written to Airtable (read-only or computed)
const READ_ONLY_FIELDS = new Set(['id', 'createdAt']);

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Get company context by company ID
 */
export async function getCompanyContext(companyId: string): Promise<CompanyContext | null> {
  try {
    const base = getBase();
    const records = await base(CONTEXT_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      // Return default empty context
      return {
        companyId,
        objectives: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const record = records[0];
    return mapRecordToContext(record);
  } catch (error) {
    console.error('[getCompanyContext] Error:', error);
    // Return default context on error
    return {
      companyId,
      objectives: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Get context summary for overview display
 */
export async function getCompanyContextSummary(companyId: string): Promise<ContextSummary | null> {
  const context = await getCompanyContext(companyId);
  if (!context) return null;
  return createContextSummary(context);
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Update company context (upsert)
 */
export async function updateCompanyContext(request: UpdateContextRequest): Promise<CompanyContext> {
  const { companyId, updates, source = 'user' } = request;

  try {
    const base = getBase();

    // Check if context exists
    const existing = await base(CONTEXT_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        maxRecords: 1,
      })
      .firstPage();

    const now = new Date().toISOString();

    // Build fields with proper serialization for arrays
    const rawFields: Record<string, unknown> = {
      companyId,
      ...updates,
      objectives: updates.objectives ? JSON.stringify(updates.objectives) : undefined,
      differentiators: updates.differentiators ? JSON.stringify(updates.differentiators) : undefined,
      keyMetrics: updates.keyMetrics ? JSON.stringify(updates.keyMetrics) : undefined,
      marketSignals: updates.marketSignals ? JSON.stringify(updates.marketSignals) : undefined,
      competitors: updates.competitors ? JSON.stringify(updates.competitors) : undefined,
      updatedAt: now,
      updatedBy: source,
    };

    // Remove undefined values, skip read-only fields, and map field names to Airtable format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleanFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawFields)) {
      // Skip undefined values and read-only fields
      if (value !== undefined && !READ_ONLY_FIELDS.has(key)) {
        // Map TypeScript property name to Airtable field name
        const airtableFieldName = FIELD_MAP[key] || key;
        cleanFields[airtableFieldName] = value;
      }
    }

    let record;
    if (existing.length > 0) {
      // Update existing
      record = await base(CONTEXT_TABLE).update(existing[0].id, cleanFields);
    } else {
      // Create new
      record = await base(CONTEXT_TABLE).create({
        ...cleanFields,
        createdAt: now,
      });
    }

    return mapRecordToContext(record as { id: string; fields: Record<string, unknown> });
  } catch (error) {
    // Extract Airtable error details if available
    const airtableError = error as {
      error?: string;
      message?: string;
      statusCode?: number;
    };
    console.error('[updateCompanyContext] Error:', {
      error: airtableError.error,
      message: airtableError.message,
      statusCode: airtableError.statusCode,
      raw: error,
    });
    const errorMessage = airtableError.message || (error instanceof Error ? error.message : 'Unknown error');
    throw new Error(`Failed to update context: ${errorMessage}`);
  }
}

/**
 * Initialize context for a company (creates default if not exists)
 */
export async function initializeCompanyContext(companyId: string): Promise<CompanyContext> {
  const existing = await getCompanyContext(companyId);
  if (existing && existing.id) {
    return existing;
  }

  return updateCompanyContext({
    companyId,
    updates: {},
    source: 'user',
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to get field value by TypeScript property name
 * Checks both the mapped Airtable name and the raw property name
 */
function getField(fields: Record<string, unknown>, propName: string): unknown {
  const airtableName = FIELD_MAP[propName];
  // Try the Airtable name first, then fall back to the prop name
  return fields[airtableName] ?? fields[propName];
}

/**
 * Map Airtable record to CompanyContext
 */
function mapRecordToContext(record: {
  id: string;
  fields: Record<string, unknown>;
}): CompanyContext {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: getField(fields, 'companyId') as string,
    businessModel: getField(fields, 'businessModel') as string | undefined,
    valueProposition: getField(fields, 'valueProposition') as string | undefined,
    // New classification fields
    companyCategory: getField(fields, 'companyCategory') as string | undefined,
    marketSignals: parseJsonArray(getField(fields, 'marketSignals')),
    // Audience fields
    primaryAudience: getField(fields, 'primaryAudience') as string | undefined,
    secondaryAudience: getField(fields, 'secondaryAudience') as string | undefined,
    icpDescription: getField(fields, 'icpDescription') as string | undefined,
    objectives: parseJsonArray(getField(fields, 'objectives')),
    keyMetrics: parseJsonArray(getField(fields, 'keyMetrics')),
    constraints: getField(fields, 'constraints') as string | undefined,
    budget: getField(fields, 'budget') as string | undefined,
    timeline: getField(fields, 'timeline') as string | undefined,
    competitorsNotes: getField(fields, 'competitorsNotes') as string | undefined,
    competitors: parseCompetitorsJson(getField(fields, 'competitors')),
    differentiators: parseJsonArray(getField(fields, 'differentiators')),
    notes: getField(fields, 'notes') as string | undefined,
    createdAt: getField(fields, 'createdAt') as string | undefined,
    updatedAt: getField(fields, 'updatedAt') as string | undefined,
    updatedBy: getField(fields, 'updatedBy') as string | undefined,
    isAiGenerated: getField(fields, 'isAiGenerated') as boolean | undefined,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Parse JSON competitors array from Airtable field
 */
function parseCompetitorsJson(value: unknown): Competitor[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value as Competitor[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// ============================================================================
// Industry Inference Helper
// ============================================================================

/**
 * Infer company category and hints from name/domain/metadata
 * Used to anchor AI context generation with accurate signals
 */
export function inferCompanyCategoryAndHints(params: {
  companyName: string;
  domain?: string;
  websiteTitle?: string;
  websiteMetaDescription?: string;
}): {
  companyCategory?: string;
  detectedIndustry?: string;
  detectedAudienceHints: string[];
  detectedBusinessModelHints: string[];
} {
  const { companyName, domain, websiteTitle = '', websiteMetaDescription = '' } = params;
  const text = `${companyName} ${domain ?? ''} ${websiteTitle} ${websiteMetaDescription}`.toLowerCase();

  let companyCategory: string | undefined;
  let detectedIndustry: string | undefined;
  const detectedAudienceHints: string[] = [];
  const detectedBusinessModelHints: string[] = [];

  // Fitness / Personal Training
  if (text.includes('trainer') || text.includes('personal training') || text.includes('fitness') || text.includes('trainrhub')) {
    companyCategory = 'fitness marketplace';
    detectedIndustry = 'marketplace/platform for fitness professionals and clients';
    detectedAudienceHints.push('personal trainers', 'fitness professionals', 'people looking for trainers');
    detectedBusinessModelHints.push('two-sided marketplace', 'directory + lead generation', 'platform/SaaS');
  }
  // Marketing Agency
  else if (text.includes('agency') && (text.includes('marketing') || text.includes('advertising') || text.includes('digital'))) {
    companyCategory = 'marketing agency';
    detectedIndustry = 'marketing and advertising services';
    detectedAudienceHints.push('business owners', 'marketing decision-makers');
    detectedBusinessModelHints.push('services', 'retainer-based', 'project-based work');
  }
  // SaaS / Software
  else if (text.includes('saas') || text.includes('software') || text.includes('platform') || text.includes('app')) {
    companyCategory = 'saas';
    detectedIndustry = 'software as a service';
    detectedAudienceHints.push('businesses', 'professionals');
    detectedBusinessModelHints.push('subscription', 'freemium', 'SaaS');
  }
  // E-commerce
  else if (text.includes('shop') || text.includes('store') || text.includes('ecommerce') || text.includes('retail')) {
    companyCategory = 'ecommerce';
    detectedIndustry = 'online retail / e-commerce';
    detectedAudienceHints.push('consumers', 'online shoppers');
    detectedBusinessModelHints.push('direct-to-consumer', 'marketplace', 'retail');
  }
  // Local Service
  else if (text.includes('local') || text.includes('service') || text.includes('repair') || text.includes('home')) {
    companyCategory = 'local service';
    detectedIndustry = 'local services';
    detectedAudienceHints.push('local homeowners', 'local businesses');
    detectedBusinessModelHints.push('service-based', 'appointment booking', 'local SEO');
  }
  // Healthcare / Health
  else if (text.includes('health') || text.includes('medical') || text.includes('clinic') || text.includes('care')) {
    companyCategory = 'healthcare';
    detectedIndustry = 'healthcare services';
    detectedAudienceHints.push('patients', 'healthcare providers');
    detectedBusinessModelHints.push('appointments', 'insurance', 'direct payment');
  }
  // Financial Services / Banking
  else if (text.includes('bank') || text.includes('finance') || text.includes('loan') || text.includes('credit')) {
    companyCategory = 'financial services';
    detectedIndustry = 'banking and financial services';
    detectedAudienceHints.push('consumers', 'small businesses');
    detectedBusinessModelHints.push('lending', 'deposits', 'fee-based services');
  }

  return {
    companyCategory,
    detectedIndustry,
    detectedAudienceHints,
    detectedBusinessModelHints,
  };
}

// ============================================================================
// Baseline Signal Detection
// ============================================================================

/**
 * Get baseline signals for a company.
 * Checks diagnostic runs, Full GAP reports, and website metadata.
 */
export async function getBaselineSignalsForCompany(companyId: string): Promise<BaselineSignals> {
  console.log('[getBaselineSignalsForCompany] Checking signals for:', companyId);

  const signalSources: string[] = [];
  let hasLabRuns = false;
  let hasFullGap = false;
  let hasCompetition = false;
  let hasWebsiteMetadata = false;
  let findingsCount = 0;
  let competitorCount = 0;
  let fullGapReportId: string | undefined;
  let websiteTitle: string | undefined;
  let websiteMetaDescription: string | undefined;

  try {
    // Check for diagnostic findings (from labs)
    const findings = await getDiagnosticFindingsForCompany(companyId);
    findingsCount = findings.length;
    if (findingsCount > 0) {
      hasLabRuns = true;
      signalSources.push(`${findingsCount} diagnostic findings`);

      // Look for website metadata in findings descriptions
      // Website labs often include meta description findings
      const metaFinding = findings.find(f =>
        f.dimension?.toLowerCase().includes('meta') ||
        f.description?.toLowerCase().includes('meta description') ||
        f.description?.toLowerCase().includes('title tag')
      );
      if (metaFinding) {
        hasWebsiteMetadata = true;
        signalSources.push('Website metadata from labs');
      }
    }

    // Fallback: Check Diagnostic Runs table if no findings found
    // This catches cases where labs ran but findings weren't extracted to Diagnostic Details
    if (!hasLabRuns) {
      try {
        const recentRuns = await getRecentRunsForCompany(companyId, 3);
        const completedRuns = recentRuns.filter(r => r.status === 'complete');
        if (completedRuns.length > 0) {
          hasLabRuns = true;
          const toolIds = Array.from(new Set(completedRuns.map(r => r.toolId)));
          signalSources.push(`Lab runs: ${toolIds.join(', ')}`);
          console.log('[getBaselineSignalsForCompany] Found diagnostic runs as fallback:', {
            count: completedRuns.length,
            tools: toolIds,
          });
        }
      } catch (runError) {
        console.warn('[getBaselineSignalsForCompany] Diagnostic runs fallback check failed:', runError);
      }
    }

    // Check for Full GAP reports
    const reports = await getFullReportsForCompany(companyId);
    const latestReadyReport = reports.find(r => r.status === 'ready');
    if (latestReadyReport) {
      hasFullGap = true;
      fullGapReportId = latestReadyReport.id;
      signalSources.push('Full GAP report');

      // Extract website metadata from GAP report if available
      const diagnostics = latestReadyReport.diagnosticsJson;
      if (diagnostics?.websiteUx?.summary) {
        hasWebsiteMetadata = true;
        // Parse metadata from websiteUx summary if structured
        const summary = diagnostics.websiteUx.summary;
        if (typeof summary === 'string') {
          // Look for title/description patterns
          const titleMatch = summary.match(/title[:\s]+["']?([^"'\n]+)["']?/i);
          const descMatch = summary.match(/description[:\s]+["']?([^"'\n]+)["']?/i);
          if (titleMatch) websiteTitle = titleMatch[1];
          if (descMatch) websiteMetaDescription = descMatch[1];
        }
      }
    }

    // Check for Competition V3 runs
    console.log('[getBaselineSignalsForCompany] Checking competition for:', companyId);
    try {
      const competitionRun = await getLatestCompetitionRunV3(companyId);
      console.log('[getBaselineSignalsForCompany] Competition run result:', {
        found: !!competitionRun,
        status: competitionRun?.status,
        competitorCount: competitionRun?.competitors?.length ?? 0,
      });
      // Accept 'completed' or 'running' with competitors (for legacy runs stored before status fix)
      const hasValidCompetition = competitionRun &&
        (competitionRun.status === 'completed' || (competitionRun.status === 'running' && competitionRun.competitors?.length > 0)) &&
        competitionRun.competitors;
      if (hasValidCompetition) {
        hasCompetition = true;
        competitorCount = competitionRun.competitors.length;
        signalSources.push(`Competition snapshot (${competitorCount} competitors)`);
      }
    } catch (compError) {
      console.error('[getBaselineSignalsForCompany] Competition check error:', compError);
    }

    console.log('[getBaselineSignalsForCompany] Result:', {
      hasLabRuns,
      hasFullGap,
      hasCompetition,
      hasWebsiteMetadata,
      findingsCount,
      competitorCount,
      signalSources,
    });

    return {
      hasLabRuns,
      hasFullGap,
      hasCompetition,
      hasWebsiteMetadata,
      findingsCount,
      competitorCount,
      fullGapReportId,
      websiteTitle,
      websiteMetaDescription,
      signalSources,
    };
  } catch (error) {
    console.error('[getBaselineSignalsForCompany] Error:', error);
    return {
      hasLabRuns: false,
      hasFullGap: false,
      hasCompetition: false,
      hasWebsiteMetadata: false,
      findingsCount: 0,
      competitorCount: 0,
      signalSources: [],
    };
  }
}

/**
 * Check if there's enough signal to run AI context generation.
 * Requires at least one of: lab runs, Full GAP report, competition run, or website metadata.
 */
export function hasEnoughContextSignal(signals: BaselineSignals): boolean {
  return signals.hasLabRuns || signals.hasFullGap || signals.hasCompetition || signals.hasWebsiteMetadata;
}

/**
 * Build initial context from a Full GAP report.
 * Used for DMA companies that already have a GAP run.
 */
export async function buildContextFromFullGap(
  companyId: string,
  fullGapReportId: string
): Promise<Partial<CompanyContext> | null> {
  console.log('[buildContextFromFullGap] Building context from GAP:', { companyId, fullGapReportId });

  try {
    const reports = await getFullReportsForCompany(companyId);
    const report = reports.find(r => r.id === fullGapReportId);

    if (!report) {
      console.error('[buildContextFromFullGap] Report not found:', fullGapReportId);
      return null;
    }

    const context: Partial<CompanyContext> = {};

    // Extract from diagnostics JSON
    const diagnostics = report.diagnosticsJson;
    if (diagnostics) {
      // Brand diagnostics often contain positioning/audience info
      if (diagnostics.brand?.summary) {
        context.businessModel = diagnostics.brand.summary;
      }

      // Content diagnostics can inform audience
      if (diagnostics.content?.summary) {
        // Look for audience-related phrases
        const contentSummary = diagnostics.content.summary;
        if (contentSummary.toLowerCase().includes('audience') ||
            contentSummary.toLowerCase().includes('customer') ||
            contentSummary.toLowerCase().includes('user')) {
          context.primaryAudience = contentSummary;
        }
      }
    }

    // Extract from evidence JSON (telemetry)
    const evidence = report.evidenceJson;
    if (evidence && typeof evidence === 'object') {
      // Look for business model signals in evidence
      const evidenceObj = evidence as Record<string, unknown>;
      if (evidenceObj.businessType) {
        context.companyCategory = String(evidenceObj.businessType);
      }
      if (evidenceObj.targetAudience) {
        context.primaryAudience = String(evidenceObj.targetAudience);
      }
    }

    // Extract from priorities JSON (business objectives)
    const priorities = report.prioritiesJson;
    if (priorities?.items && Array.isArray(priorities.items)) {
      // Top priorities can inform objectives
      const topPriorities = priorities.items.slice(0, 3).map(p => p.title);
      if (topPriorities.length > 0) {
        context.objectives = topPriorities;
      }
    }

    context.isAiGenerated = false; // Imported from GAP, not AI-generated

    console.log('[buildContextFromFullGap] Built context:', Object.keys(context));
    return context;
  } catch (error) {
    console.error('[buildContextFromFullGap] Error:', error);
    return null;
  }
}

// ============================================================================
// Competition Summary Helper
// ============================================================================

/**
 * Get competition summary for a company from the latest V3 competition run.
 * Returns null if no competition run exists.
 */
export async function getCompetitionSummaryForCompany(
  companyId: string
): Promise<CompetitionSummary | null> {
  console.log('[getCompetitionSummaryForCompany] Fetching for:', companyId);

  try {
    const run = await getLatestCompetitionRunV3(companyId);

    if (!run || !run.competitors || run.competitors.length === 0) {
      console.log('[getCompetitionSummaryForCompany] No competition run found');
      return null;
    }

    // Extract primary competitors (direct and partial types, sorted by threat score)
    // Note: CompetitorProfileV3 uses classification.type and scores.threatScore
    const relevantCompetitors = run.competitors
      .filter(c => c.classification?.type === 'direct' || c.classification?.type === 'partial')
      .sort((a, b) => (b.scores?.threatScore ?? 0) - (a.scores?.threatScore ?? 0))
      .slice(0, 5); // Top 5 competitors

    const primaryCompetitors: CompetitionSummaryCompetitor[] = relevantCompetitors.map(c => ({
      domain: c.domain ?? c.homepageUrl ?? '',
      name: c.name,
      type: c.classification?.type,
      notes: c.analysis?.whyCompetitor ?? c.summary,
    }));

    // Build positioning notes from insights
    let positioningNotes: string | undefined;
    if (run.insights && run.insights.length > 0) {
      // Find landscape insight - LandscapeInsight has category (threat/opportunity/trend/white-space)
      const landscapeInsight = run.insights.find(
        i => i.category === 'opportunity' || i.category === 'threat'
      );
      positioningNotes = landscapeInsight?.description ?? run.insights[0]?.description;
    }

    // Aggregate strengths and weaknesses from competitors
    const allStrengths = new Set<string>();
    const allWeaknesses = new Set<string>();

    for (const c of relevantCompetitors) {
      if (c.analysis?.weaknesses) {
        // Competitor weaknesses = client's relative strengths
        c.analysis.weaknesses.forEach(w => allStrengths.add(w));
      }
      if (c.analysis?.strengths) {
        // Competitor strengths = areas where client is behind
        c.analysis.strengths.forEach(s => allWeaknesses.add(s));
      }
    }

    const summary: CompetitionSummary = {
      primaryCompetitors,
      positioningNotes,
      relativeStrengths: allStrengths.size > 0 ? Array.from(allStrengths).slice(0, 5) : undefined,
      relativeWeaknesses: allWeaknesses.size > 0 ? Array.from(allWeaknesses).slice(0, 5) : undefined,
    };

    console.log('[getCompetitionSummaryForCompany] Built summary:', {
      competitorCount: primaryCompetitors.length,
      hasPositioning: !!positioningNotes,
      strengthsCount: summary.relativeStrengths?.length ?? 0,
      weaknessesCount: summary.relativeWeaknesses?.length ?? 0,
    });

    return summary;
  } catch (error) {
    console.error('[getCompetitionSummaryForCompany] Error:', error);
    return null;
  }
}

// ============================================================================
// Context Draft Operations
// ============================================================================

/**
 * Get the latest context draft for a company
 */
export async function getContextDraft(companyId: string): Promise<ContextDraft | null> {
  try {
    const base = getBase();
    const records = await base(CONTEXT_DRAFT_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        maxRecords: 1,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const contextJson = record.get('contextJson') as string | undefined;

    return {
      companyId: record.get('companyId') as string,
      context: contextJson ? JSON.parse(contextJson) : {},
      source: (record.get('source') as ContextDraftSource) || 'ai/baseline-v1',
      createdAt: (record.get('createdAt') as string) || new Date().toISOString(),
      sourceRunId: record.get('sourceRunId') as string | undefined,
      summary: record.get('summary') as string | undefined,
    };
  } catch (error) {
    // Table may not exist yet - this is OK, just means no drafts
    const airtableError = error as { error?: string; statusCode?: number };
    if (airtableError.statusCode === 404 || airtableError.error === 'NOT_FOUND') {
      // Table doesn't exist - expected during initial setup
      console.log('[getContextDraft] Draft table not found (OK if not yet created)');
    } else {
      console.error('[getContextDraft] Error fetching draft:', airtableError.error || error);
    }
    return null;
  }
}

/**
 * Save or update a context draft for a company.
 * This does NOT modify the saved context - it's a proposal for review.
 */
export async function saveContextDraft(draft: ContextDraft): Promise<void> {
  const { companyId, context, source, sourceRunId, summary } = draft;

  try {
    const base = getBase();

    // Check if a draft already exists
    const existing = await base(CONTEXT_DRAFT_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        maxRecords: 1,
      })
      .firstPage();

    // Build draft data, omitting undefined fields for Airtable compatibility
    const draftData: Record<string, string> = {
      companyId,
      contextJson: JSON.stringify(context),
      source,
      createdAt: new Date().toISOString(),
    };
    if (sourceRunId) {
      draftData.sourceRunId = sourceRunId;
    }
    if (summary) {
      draftData.summary = summary;
    }

    if (existing.length > 0) {
      // Update existing draft
      await base(CONTEXT_DRAFT_TABLE).update(existing[0].id, draftData);
      console.log('[saveContextDraft] Updated existing draft for:', companyId);
    } else {
      // Create new draft
      await base(CONTEXT_DRAFT_TABLE).create([{ fields: draftData }]);
      console.log('[saveContextDraft] Created new draft for:', companyId);
    }
  } catch (error) {
    console.error('[saveContextDraft] Error:', error);
    throw new Error(`Failed to save context draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a context draft (called after user saves or discards)
 */
export async function deleteContextDraft(companyId: string): Promise<void> {
  try {
    const base = getBase();
    const records = await base(CONTEXT_DRAFT_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
      })
      .firstPage();

    if (records.length > 0) {
      await base(CONTEXT_DRAFT_TABLE).destroy(records.map(r => r.id));
      console.log('[deleteContextDraft] Deleted draft for:', companyId);
    }
  } catch (error) {
    console.error('[deleteContextDraft] Error:', error);
    // Don't throw - draft deletion is not critical
  }
}

/**
 * Commit a draft to saved context.
 * This saves the draft as the canonical context and removes the draft.
 */
export async function commitContextDraft(companyId: string): Promise<CompanyContext | null> {
  const draft = await getContextDraft(companyId);

  if (!draft) {
    console.warn('[commitContextDraft] No draft found for:', companyId);
    return null;
  }

  // Save the draft context as the canonical context
  const savedContext = await updateCompanyContext({
    companyId,
    updates: {
      ...draft.context,
      isAiGenerated: draft.source.startsWith('ai/'),
    },
    source: draft.source.startsWith('ai/') ? 'ai' : 'user',
  });

  // Delete the draft
  await deleteContextDraft(companyId);

  console.log('[commitContextDraft] Committed draft for:', companyId);
  return savedContext;
}

// ============================================================================
// Server-side Draft Generation from Baseline
// ============================================================================

/**
 * Generate a context draft from existing baseline signals (server-side).
 * This is called when baseline exists but no draft and no saved context.
 * Does NOT call OpenAI - just builds a minimal draft for the user to see.
 * For AI-generated drafts, use the /api/os/context/regenerate endpoint.
 */
export async function generateDraftFromBaseline(
  companyId: string,
  companyName: string,
  companyDomain: string,
  signals: BaselineSignals
): Promise<ContextDraft | null> {
  // Use inference to get initial values
  const inferred = inferCompanyCategoryAndHints({
    companyName,
    domain: companyDomain,
    websiteTitle: signals.websiteTitle ?? '',
    websiteMetaDescription: signals.websiteMetaDescription ?? '',
  });

  // Build a minimal context from what we know
  const context: CompanyContext = {
    companyId,
    companyCategory: inferred.companyCategory || undefined,
    // Leave other fields empty for user to fill or AI to populate
  };

  const draft: ContextDraft = {
    companyId,
    context,
    source: 'ai/baseline-v1',
    createdAt: new Date().toISOString(),
    summary: `Draft created from ${signals.signalSources.join(', ')}`,
  };

  // Save the draft so it persists
  try {
    await saveContextDraft(draft);
    console.log('[generateDraftFromBaseline] Created draft for:', companyId);
  } catch (error) {
    console.error('[generateDraftFromBaseline] Failed to save draft:', error);
    // Return the draft anyway so the UI has something to show
  }

  return draft;
}

// ============================================================================
// Context Integration with Existing Systems
// ============================================================================

/**
 * Merge context with data from diagnostic findings
 * TODO: Integrate with existing diagnostic findings system
 */
export async function enrichContextFromDiagnostics(
  companyId: string,
  _context: CompanyContext
): Promise<Partial<CompanyContext>> {
  // TODO: Pull relevant findings from diagnostics to suggest context updates
  // This would integrate with lib/os/findings/ and lib/airtable/diagnosticDetails.ts
  console.log(`[enrichContextFromDiagnostics] Placeholder for ${companyId}`);
  return {};
}

/**
 * Sync context with existing Brain/Context Graph
 * TODO: Integrate with existing context graph system
 */
export async function syncWithContextGraph(
  companyId: string,
  context: CompanyContext
): Promise<void> {
  // TODO: Sync with lib/os/context/graphModel.ts and context graph infrastructure
  console.log(`[syncWithContextGraph] Placeholder for ${companyId}`, context.id);
}

// ============================================================================
// Re-export Context Graph modules
// ============================================================================

// Re-export everything from the context/ directory for backwards compatibility
// This allows imports from '@/lib/os/context' to access context graph features
export * from './context/types';
export * from './context/graphModel';
export {
  calculateFreshnessScore,
  detectConflict,
  autoResolveConflict,
  checkMissingFields,
  calculateContextHealth,
  checkContextIntegrity,
  updateProvenance,
  lockField,
  unlockField,
  verifyField,
  getFieldsNeedingAttention,
} from './context/graphIntegrity';
export {
  toHealthSummary,
  checkCompanyContextHealth,
  getDetailedIntegrityCheck,
  healthToDataSource,
  getQuickHealthIndicator,
  trackFieldUpdate,
  getFieldsByStatus,
  generateHealthReport,
  type ContextHealthSummary,
} from './context/brainIntegration';
export {
  loadContextOverview,
  type ContextOverview,
  type DomainStats,
} from './context/loadContextOverview';
export {
  loadCoverageGraph,
  type CoverageNode,
  type CoverageNodeStatus,
  type CoverageDomainSummary,
  type CoverageGraph,
} from './context/loadCoverageGraph';
export {
  loadRelationshipGraph,
  getNodeConnections,
  getMissingDependencies,
  type RelationshipType,
  type RelationshipEdge,
  type RelationshipNode,
  type RelationshipGraph,
  type NodePosition,
} from './context/dependencies';
