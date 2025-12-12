// lib/types/context.ts
// MVP Context types for Company Context Workspace
//
// These types define the editable, structured context for a company
// used in strategic planning and AI-assisted workflows.

// ============================================================================
// Core Context Types
// ============================================================================

/**
 * Competitor type classification
 */
export type CompetitorType = 'direct' | 'indirect' | 'adjacent';

/**
 * Source of competitor data
 */
export type CompetitorSource = 'baseline' | 'ai' | 'manual';

/**
 * Structured competitor object for Context Graph
 */
export interface Competitor {
  /** Competitor's domain (required) */
  domain: string;
  /** Competitor's name */
  name?: string;
  /** Offer overlap score (0-100) */
  offerOverlap: number;
  /** Jobs-to-be-done match */
  jtbdMatch: boolean;
  /** Geographic relevance score (0-100) */
  geoRelevance: number;
  /** Type of competitor */
  type: CompetitorType;
  /** AI confidence score (0-100) */
  confidence: number;
  /** Source of this competitor data */
  source: CompetitorSource;
}

/**
 * Company context - the structured knowledge about a company
 * used for strategic planning and AI-assisted workflows
 */
export interface CompanyContext {
  id?: string;
  companyId: string;

  // Business fundamentals
  businessModel?: string;
  valueProposition?: string;

  // NEW: Company classification
  companyCategory?: string;      // e.g., "fitness marketplace", "local service", "ecommerce", "saas"
  marketSignals?: string[];      // Short bullet-style signals about the market

  // Audience & ICP
  primaryAudience?: string;
  secondaryAudience?: string;
  icpDescription?: string;

  // Objectives & Goals
  objectives?: string[];         // 3–6 high-level objectives
  keyMetrics?: string[];

  // Constraints & Considerations
  constraints?: string;
  budget?: string;
  timeline?: string;

  // Competitive landscape
  competitorsNotes?: string;     // High-level notes (legacy)
  competitors?: Competitor[];    // Structured competitor objects
  differentiators?: string[];

  // Free-form notes
  notes?: string;

  // AI Confidence Notes (per-field quality signals)
  confidenceNotes?: {
    highConfidence?: string[];   // Fields where inference is strong
    needsReview?: string[];      // "field: reason" for fields needing human review
  };

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  isAiGenerated?: boolean;       // True if last update was AI-generated
}

/**
 * Context field metadata for tracking provenance
 */
export interface ContextFieldMeta {
  fieldPath: string;
  source: 'user' | 'ai' | 'diagnostic' | 'import';
  setAt: string;
  confidence?: number;
  verifiedAt?: string;
}

/**
 * AI-suggested context improvements
 */
export interface ContextSuggestion {
  field: keyof CompanyContext;
  currentValue?: string | string[];
  suggestedValue: string | string[];
  reasoning: string;
  confidence: number;
}

/**
 * Context update request
 */
export interface UpdateContextRequest {
  companyId: string;
  updates: Partial<CompanyContext>;
  source?: 'user' | 'ai' | 'diagnostic';
}

/**
 * AI assist request for context refinement
 */
export interface ContextAiAssistRequest {
  companyId: string;
  currentContext: CompanyContext;
  focusFields?: (keyof CompanyContext)[];
}

/**
 * Structured input for AI context refinement
 * Contains all signals needed for accurate context generation
 */
export interface ContextAiInput {
  companyName: string;
  domain?: string;
  currentContext?: CompanyContext | null;
  diagnosticsSummary?: {
    website?: string;
    seo?: string;
    content?: string;
    brand?: string;
  };
  detectedIndustry?: string;
  detectedAudienceHints?: string[];
  detectedBusinessModelHints?: string[];
  /** Competition snapshot data for competitive positioning */
  competitionSummary?: CompetitionSummary | null;
}

/**
 * AI assist response with suggestions
 */
export interface ContextAiAssistResponse {
  suggestions: ContextSuggestion[];
  summary: string;
  generatedAt: string;
}

// ============================================================================
// Context Summary (for Overview and Reports)
// ============================================================================

/**
 * Lightweight context summary for display in Overview and Reports
 */
export interface ContextSummary {
  companyId: string;
  businessModel?: string;
  primaryAudience?: string;
  topObjectives: string[];
  keyConstraints?: string;
  lastUpdated?: string;
  completeness: number; // 0-100
}

/**
 * Calculate context completeness score
 */
export function calculateContextCompleteness(context: CompanyContext): number {
  const fields = [
    'businessModel',
    'primaryAudience',
    'valueProposition',
    'objectives',
    'constraints',
    'competitors',
    'companyCategory',
  ];

  let filled = 0;
  for (const field of fields) {
    const value = context[field as keyof CompanyContext];
    if (value) {
      if (typeof value === 'string' && value.trim()) {
        filled++;
      } else if (Array.isArray(value) && value.length > 0) {
        filled++;
      }
    }
  }

  return Math.round((filled / fields.length) * 100);
}

/**
 * Create a context summary from full context
 */
export function createContextSummary(context: CompanyContext): ContextSummary {
  return {
    companyId: context.companyId,
    businessModel: context.businessModel,
    primaryAudience: context.primaryAudience,
    topObjectives: (context.objectives || []).slice(0, 3),
    keyConstraints: context.constraints,
    lastUpdated: context.updatedAt,
    completeness: calculateContextCompleteness(context),
  };
}

// ============================================================================
// Competition Snapshot Types
// ============================================================================

/**
 * A competitor extracted from Competition snapshot diagnostic
 */
export interface CompetitionSummaryCompetitor {
  domain: string;
  name?: string;
  type?: string; // e.g. "marketplace", "local service", "national brand"
  notes?: string;
}

/**
 * Summary of competition analysis for context enrichment
 */
export interface CompetitionSummary {
  /** Primary competitors detected */
  primaryCompetitors: CompetitionSummaryCompetitor[];
  /** Overall positioning notes */
  positioningNotes?: string;
  /** Where the client is strong relative to competitors */
  relativeStrengths?: string[];
  /** Where competitors are strong */
  relativeWeaknesses?: string[];
}

// ============================================================================
// Context Draft Types (for AI-generated proposals)
// ============================================================================

/**
 * Source/provenance of a context draft
 */
export type ContextDraftSource = 'ai/baseline-v1' | 'ai/assist' | 'user/edit' | 'import/gap';

/**
 * A context draft is an AI- or user-generated proposal that is NOT yet committed.
 * It allows users to review, edit, and approve before saving as canonical context.
 */
export interface ContextDraft {
  /** Company this draft belongs to */
  companyId: string;
  /** The proposed context values */
  context: CompanyContext;
  /** Source/provenance of the draft */
  source: ContextDraftSource;
  /** When this draft was created */
  createdAt: string;
  /** Run ID that generated this draft (for traceability) */
  sourceRunId?: string;
  /** Summary of what was generated/changed */
  summary?: string;
}

/**
 * Response from initial diagnostics run
 */
export interface InitialDiagnosticsResult {
  success: boolean;
  baselineSignals: {
    hasLabRuns: boolean;
    hasFullGap: boolean;
    hasCompetition: boolean;
    hasWebsiteMetadata: boolean;
    findingsCount: number;
    competitorCount: number;
    signalSources: string[];
  };
  contextDraft: ContextDraft | null;
  message: string;
  durationMs: number;
}

// ============================================================================
// Competitor Parsing & Validation Utilities
// ============================================================================

const VALID_COMPETITOR_TYPES: CompetitorType[] = ['direct', 'indirect', 'adjacent'];
const VALID_COMPETITOR_SOURCES: CompetitorSource[] = ['baseline', 'ai', 'manual'];

/**
 * Validate and normalize a competitor object from AI output
 */
export function parseCompetitor(raw: unknown, defaultSource: CompetitorSource = 'ai'): Competitor | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  // Domain is required
  if (!obj.domain || typeof obj.domain !== 'string' || !obj.domain.trim()) {
    return null;
  }

  // Normalize type
  let type: CompetitorType = 'direct';
  if (typeof obj.type === 'string' && VALID_COMPETITOR_TYPES.includes(obj.type as CompetitorType)) {
    type = obj.type as CompetitorType;
  }

  // Normalize source
  let source: CompetitorSource = defaultSource;
  if (typeof obj.source === 'string' && VALID_COMPETITOR_SOURCES.includes(obj.source as CompetitorSource)) {
    source = obj.source as CompetitorSource;
  }

  // Normalize numeric scores (0-100)
  const normalizeScore = (val: unknown, defaultVal = 0): number => {
    if (typeof val === 'number') {
      return Math.max(0, Math.min(100, Math.round(val)));
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
    return defaultVal;
  };

  return {
    domain: obj.domain.trim().toLowerCase(),
    name: typeof obj.name === 'string' ? obj.name.trim() : undefined,
    offerOverlap: normalizeScore(obj.offerOverlap, 0),
    jtbdMatch: obj.jtbdMatch === true || obj.jtbdMatch === 'true',
    geoRelevance: normalizeScore(obj.geoRelevance, 0),
    type,
    confidence: normalizeScore(obj.confidence, 50),
    source,
  };
}

/**
 * Parse and validate an array of competitors from AI output
 * - Validates each competitor
 * - Removes duplicates (by domain)
 * - Attaches source
 */
export function parseCompetitors(
  raw: unknown,
  defaultSource: CompetitorSource = 'ai'
): Competitor[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const competitors: Competitor[] = [];

  for (const item of raw) {
    const competitor = parseCompetitor(item, defaultSource);
    if (competitor && !seen.has(competitor.domain)) {
      seen.add(competitor.domain);
      competitors.push(competitor);
    }
  }

  return competitors;
}

/**
 * Create an empty competitor with defaults
 */
export function createEmptyCompetitor(): Competitor {
  return {
    domain: '',
    offerOverlap: 0,
    jtbdMatch: false,
    geoRelevance: 0,
    type: 'direct',
    confidence: 50,
    source: 'manual',
  };
}
