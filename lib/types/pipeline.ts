// lib/types/pipeline.ts
// Shared types for the Pipeline subsystem

export type PipelineStage =
  | 'interest_confirmed'
  | 'discovery_clarification'
  | 'solution_shaping'
  | 'proposal_submitted'
  | 'decision'
  | 'won'
  | 'lost'
  | 'dormant';

export interface OpportunityItem {
  id: string;
  companyId?: string | null;
  companyName: string;
  deliverableName?: string | null;
  stage: PipelineStage | 'other';
  leadStatus?: string | null;
  owner?: string | null;
  value?: number | null;
  closeDate?: string | null; // ISO date - Expected Close Date
  createdAt?: string | null;
  notes?: string | null;
  source?: string | null; // Lead source / how opportunity was acquired

  // Workflow fields - primary indicators
  nextStep?: string | null; // Free text for next action
  nextStepDue?: string | null; // ISO date when next step is due
  lastActivityAt?: string | null; // Auto-updated on any update
  stageEnteredAt?: string | null; // ISO datetime when current stage was entered (used for Won date baseline)

  // Deal Health (from Airtable, not computed)
  dealHealth?: 'on_track' | 'at_risk' | 'stalled' | null;

  // Airtable-managed linked records
  engagements?: string[] | null; // Linked Engagement record IDs (populated by Airtable automation)
  opportunityType?: string | null; // Single select: e.g., "New Business", "Expansion", "Renewal", "RFP Response"

  // Buying Process fields
  decisionOwner?: string | null; // Name/role of primary decision maker
  decisionDate?: string | null; // ISO date - when decision will be made
  budgetConfidence?: 'confirmed' | 'likely' | 'unknown' | 'no_budget' | null;
  knownCompetitors?: string | null; // Free text list of competitors in deal

  // RFP-specific fields (only relevant when opportunityType === "RFP Response")
  rfpDueDate?: string | null; // ISO date - RFP submission deadline
  rfpDecisionDate?: string | null; // ISO date - when RFP decision will be announced
  rfpLink?: string | null; // URL to RFP document or portal

  // From CRM, if available:
  industry?: string | null;
  companyType?: string | null;
  sizeBand?: string | null;

  // Activity thread fields (from Airtable rollups, if available)
  activitiesCount?: number | null;
  externalThreadUrl?: string | null; // Primary thread URL (e.g., Slack, Notion)
  gmailThreadId?: string | null; // Gmail thread ID for "Open in Gmail" link
}

export interface InboundLeadItem {
  id: string;
  name?: string | null;
  email?: string | null;
  website?: string | null;
  companyName?: string | null;
  leadSource?: string | null;
  status?: string | null;
  assignee?: string | null;
  notes?: string | null;
  companyId?: string | null;
  gapIaRunId?: string | null;
  gapIaScore?: number | null;
  createdAt?: string | null;

  // DMA Integration Fields (Phase 3)
  /** Normalized domain extracted from website (e.g., "example.com") */
  normalizedDomain?: string | null;
  /** DMA audit run ID if lead came from digitalmarketingaudit.ai */
  dmaAuditId?: string | null;
  /** Import status for lead processing pipeline */
  importStatus?: InboundLeadImportStatus | null;
  /** Timestamp when lead was imported into Companies */
  importedAt?: string | null;
  /** Analysis status (has analysis linked, pending, none) */
  analysisStatus?: InboundLeadAnalysisStatus | null;

  // UTM Tracking Fields
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;

  // DMA Full GAP Integration Fields
  /** Full GAP (GAP-Plan) run ID if lead came from DMA Full GAP */
  gapPlanRunId?: string | null;
  /** Overall GAP score (0-100) from Full GAP */
  gapOverallScore?: number | null;
  /** Maturity stage from Full GAP (e.g., "Early", "Emerging", "Scaling", "Leading") */
  gapMaturityStage?: string | null;
  /** Pipeline stage for board view */
  pipelineStage?: PipelineLeadStage | null;
  /** Last activity timestamp */
  lastActivityAt?: string | null;
  /** Contact message from DMA form */
  contactMessage?: string | null;

  // Full Workup Checklist (for DMA leads)
  /** Whether QBR draft has been reviewed */
  qbrReviewed?: boolean | null;
  /** Whether Media Lab has been checked */
  mediaLabReviewed?: boolean | null;
  /** Whether SEO Lab has been checked */
  seoLabReviewed?: boolean | null;
  /** Whether Competition Lab snapshot exists */
  competitionLabReviewed?: boolean | null;
  /** Whether work plan has been drafted */
  workPlanDrafted?: boolean | null;

  // Conversion fields (Lead-first flow)
  /** Linked opportunity ID (if converted to opportunity) */
  linkedOpportunityId?: string | null;
  /** Timestamp when lead was converted to company/opportunity */
  convertedAt?: string | null;
}

/**
 * Pipeline lead stages for board view
 */
export type PipelineLeadStage =
  | 'new'
  | 'qualified'
  | 'meeting_scheduled'
  | 'proposal'
  | 'won'
  | 'lost';

/**
 * Pipeline lead sources
 */
export type PipelineLeadSource =
  | 'dma_full_gap'
  | 'dma_ia'
  | 'site_contact'
  | 'referral'
  | 'manual'
  | 'outbound';

/**
 * Get display label for pipeline lead stage
 */
export function getPipelineStageLabel(stage: PipelineLeadStage | null | undefined): string {
  const labels: Record<PipelineLeadStage, string> = {
    new: 'New',
    qualified: 'Qualified',
    meeting_scheduled: 'Meeting Scheduled',
    proposal: 'Proposal',
    won: 'Won',
    lost: 'Lost',
  };
  return stage ? labels[stage] || 'Unknown' : 'Unknown';
}

/**
 * Get color classes for pipeline lead stage
 */
export function getPipelineStageColorClasses(stage: PipelineLeadStage | null | undefined): string {
  const colors: Record<PipelineLeadStage, string> = {
    new: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    meeting_scheduled: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    proposal: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return stage ? colors[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * All pipeline lead stages in order
 */
export const PIPELINE_LEAD_STAGES: PipelineLeadStage[] = [
  'new',
  'qualified',
  'meeting_scheduled',
  'proposal',
  'won',
  'lost',
];

/**
 * Get maturity stage display color
 */
export function getMaturityStageColorClasses(stage: string | null | undefined): string {
  const stageLower = (stage || '').toLowerCase();
  if (stageLower.includes('lead') || stageLower.includes('scaling')) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
  if (stageLower.includes('emerg') || stageLower.includes('growing')) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  }
  if (stageLower.includes('early') || stageLower.includes('foundation') || stageLower.includes('basic')) {
    return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * Import status for Inbound Lead processing
 */
export type InboundLeadImportStatus = 'not_imported' | 'imported' | 'skipped' | 'error';

/**
 * Analysis status for Inbound Lead
 */
export type InboundLeadAnalysisStatus = 'none' | 'pending' | 'has_analysis';

export interface PipelineKpis {
  totalPipelineValue: number;
  openOpportunitiesCount: number;
  opportunitiesByStage: { stage: string; count: number; value: number }[];
  opportunitiesByOwner: { owner: string; count: number; value: number }[];
  leadsByStatus: { status: string; count: number }[];
  // For charts:
  pipelineByMonth: { month: string; value: number }[];
}

/**
 * Deal Health type for Airtable-first pipeline
 */
export type DealHealth = 'on_track' | 'at_risk' | 'stalled';

/**
 * Get display label for deal health
 */
export function getDealHealthLabel(health: DealHealth | null | undefined): string {
  const labels: Record<DealHealth, string> = {
    on_track: 'On Track',
    at_risk: 'At Risk',
    stalled: 'Stalled',
  };
  return health ? labels[health] || 'Unknown' : '—';
}

/**
 * Get color classes for deal health
 */
export function getDealHealthColorClasses(health: DealHealth | null | undefined): string {
  const colors: Record<DealHealth, string> = {
    on_track: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    at_risk: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    stalled: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return health ? colors[health] || 'bg-slate-500/10 text-slate-400 border-slate-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * Check if a next step is overdue
 */
export function isNextStepOverdue(nextStepDue: string | null | undefined): boolean {
  if (!nextStepDue) return false;
  const today = new Date().toISOString().split('T')[0];
  return nextStepDue < today;
}

/**
 * Normalize raw stage string from Airtable to PipelineStage
 */
export function normalizeStage(raw?: string | null): PipelineStage | 'other' {
  if (!raw) return 'other';
  const r = raw.toLowerCase().trim();

  // Exact matches for Airtable stages
  if (r === 'interest confirmed') return 'interest_confirmed';
  if (r === 'discovery / clarification' || r === 'discovery/clarification') return 'discovery_clarification';
  if (r === 'solution shaping') return 'solution_shaping';
  if (r === 'proposal / rfp submitted' || r === 'proposal/rfp submitted') return 'proposal_submitted';
  if (r === 'decision') return 'decision';
  if (r === 'won') return 'won';
  if (r === 'lost') return 'lost';
  if (r === 'dormant') return 'dormant';

  // Fuzzy fallbacks for legacy data
  if (r.includes('interest')) return 'interest_confirmed';
  if (r.includes('discover') || r.includes('clarif')) return 'discovery_clarification';
  if (r.includes('solution') || r.includes('shaping')) return 'solution_shaping';
  if (r.includes('proposal') || r.includes('rfp')) return 'proposal_submitted';
  if (r.includes('decision') || r.includes('negotiat')) return 'decision';
  if (r.includes('won')) return 'won';
  if (r.includes('lost')) return 'lost';
  if (r.includes('dormant') || r.includes('stalled')) return 'dormant';

  return 'other';
}

/**
 * Get display label for a pipeline stage
 */
export function getStageLabel(stage: PipelineStage | 'other'): string {
  const labels: Record<PipelineStage | 'other', string> = {
    interest_confirmed: 'Interest Confirmed',
    discovery_clarification: 'Discovery / Clarification',
    solution_shaping: 'Solution Shaping',
    proposal_submitted: 'Proposal / RFP Submitted',
    decision: 'Decision',
    won: 'Won',
    lost: 'Lost',
    dormant: 'Dormant',
    other: 'Other',
  };
  return labels[stage] || 'Other';
}

/**
 * Get stage color classes for styling
 */
export function getStageColorClass(stage: PipelineStage | 'other'): string {
  const colors: Record<PipelineStage | 'other', string> = {
    interest_confirmed: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    discovery_clarification: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    solution_shaping: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    proposal_submitted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    decision: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[stage] || colors.other;
}

/**
 * Active pipeline stages (not closed)
 */
export const ACTIVE_STAGES: PipelineStage[] = [
  'interest_confirmed',
  'discovery_clarification',
  'solution_shaping',
  'proposal_submitted',
  'decision',
];

/**
 * All pipeline stages in order
 */
export const ALL_STAGES: (PipelineStage | 'other')[] = [
  'interest_confirmed',
  'discovery_clarification',
  'solution_shaping',
  'proposal_submitted',
  'decision',
  'won',
  'lost',
  'dormant',
  'other',
];

/**
 * Inbound lead statuses
 */
export const INBOUND_LEAD_STATUSES = [
  'New',
  'Contacted',
  'Qualified',
  'Converted',
  'Lost',
] as const;

export type InboundLeadStatus = (typeof INBOUND_LEAD_STATUSES)[number];

/**
 * Lead sources
 */
export const LEAD_SOURCES = [
  'DMA',
  'Referral',
  'Outbound',
  'Inbound',
  'Website',
  'Event',
  'Other',
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

/**
 * Get color classes for lead status
 */
export function getLeadStatusColorClasses(status?: string | null): string {
  const colors: Record<string, string> = {
    New: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Contacted: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Qualified: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Converted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return colors[status || ''] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
}

/**
 * Opportunity stages using display labels for UI compatibility
 */
export const OPPORTUNITY_STAGES = [
  'Interest Confirmed',
  'Discovery / Clarification',
  'Solution Shaping',
  'Proposal / RFP Submitted',
  'Decision',
  'Won',
  'Lost',
  'Dormant',
] as const;

/**
 * Active opportunity stages (not closed)
 */
export const ACTIVE_OPPORTUNITY_STAGES = [
  'Interest Confirmed',
  'Discovery / Clarification',
  'Solution Shaping',
  'Proposal / RFP Submitted',
  'Decision',
] as const;

/**
 * Alias for getStageColorClass using display labels
 */
export function getStageColorClasses(stage?: string | null): string {
  const colors: Record<string, string> = {
    'Interest Confirmed': 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    'Discovery / Clarification': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    'Solution Shaping': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'Proposal / RFP Submitted': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Decision': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    'Won': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Lost': 'bg-red-500/10 text-red-400 border-red-500/30',
    'Dormant': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    'Other': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[stage || ''] || colors.Other;
}

// ============================================================================
// Forecast Types
// ============================================================================

/**
 * Forecast bucket categories based on deal health and stage
 */
export type ForecastBucket = 'likely' | 'possible' | 'unlikely' | 'dormant';

/**
 * Time windows for forecast based on expected close date
 */
export type ForecastTimeWindow = 'next30' | 'days31to90' | 'days91plus' | 'noCloseDate';

/**
 * Single forecast bucket summary
 */
export interface ForecastBucketSummary {
  bucket: ForecastBucket;
  count: number;
  totalValue: number;
  opportunityIds: string[];
}

/**
 * Time window breakdown within a bucket
 */
export interface ForecastTimeWindowBreakdown {
  timeWindow: ForecastTimeWindow;
  count: number;
  totalValue: number;
}

/**
 * Stage breakdown within the forecast
 */
export interface ForecastStageBreakdown {
  stage: PipelineStage | 'other';
  bucket: ForecastBucket;
  count: number;
  totalValue: number;
}

/**
 * Complete forecast data returned by API
 */
export interface PipelineForecastData {
  /** Total value of all open pipeline (excluding won/lost) */
  totalOpenValue: number;
  /** Total count of open opportunities */
  totalOpenCount: number;
  /** Summary by forecast bucket */
  buckets: ForecastBucketSummary[];
  /** Breakdown by time window */
  byTimeWindow: ForecastTimeWindowBreakdown[];
  /** Breakdown by stage and bucket */
  byStage: ForecastStageBreakdown[];
  /** Dormant opportunities (separate from open pipeline) */
  dormant: {
    count: number;
    totalValue: number;
    opportunityIds: string[];
  };
}

/**
 * Get display label for forecast bucket
 */
export function getForecastBucketLabel(bucket: ForecastBucket): string {
  const labels: Record<ForecastBucket, string> = {
    likely: 'Likely',
    possible: 'Possible',
    unlikely: 'Unlikely',
    dormant: 'Dormant',
  };
  return labels[bucket];
}

/**
 * Get color classes for forecast bucket
 */
export function getForecastBucketColorClasses(bucket: ForecastBucket): string {
  const colors: Record<ForecastBucket, string> = {
    likely: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    possible: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    unlikely: 'bg-red-500/10 text-red-400 border-red-500/30',
    dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[bucket];
}

/**
 * Get display label for time window
 */
export function getTimeWindowLabel(window: ForecastTimeWindow): string {
  const labels: Record<ForecastTimeWindow, string> = {
    next30: 'Next 30 Days',
    days31to90: '31-90 Days',
    days91plus: '91+ Days',
    noCloseDate: 'No Close Date',
  };
  return labels[window];
}
