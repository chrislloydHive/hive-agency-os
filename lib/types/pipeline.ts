// lib/types/pipeline.ts
// Shared types for the Pipeline subsystem

export type PipelineStage =
  | 'discovery'
  | 'qualification'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface OpportunityItem {
  id: string;
  companyId?: string | null;
  companyName: string;
  deliverableName?: string | null;
  stage: PipelineStage | 'other';
  leadStatus?: string | null;
  owner?: string | null;
  value?: number | null;
  probability?: number | null; // 0-1 or 0-100 normalized in code
  closeDate?: string | null; // ISO date
  createdAt?: string | null;
  notes?: string | null;

  // Workflow fields (Phase 2.8)
  nextStep?: string | null; // Free text for next action
  nextStepDue?: string | null; // ISO date when next step is due
  lastActivityAt?: string | null; // Auto-updated on any update

  // From CRM, if available:
  industry?: string | null;
  companyType?: string | null;
  sizeBand?: string | null;
  icpFitScore?: number | null;
  leadScore?: number | null;

  // AI scoring:
  opportunityScore?: number | null; // 0–100 AI-derived
  opportunityScoreExplanation?: string | null;
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
  weightedPipelineValue: number;
  openOpportunitiesCount: number;
  opportunitiesByStage: { stage: string; count: number; value: number }[];
  opportunitiesByOwner: { owner: string; count: number; value: number }[];
  leadsByStatus: { status: string; count: number }[];
  // For charts:
  pipelineByMonth: { month: string; value: number }[];
}

/**
 * Normalize raw stage string to PipelineStage
 */
export function normalizeStage(raw?: string | null): PipelineStage | 'other' {
  if (!raw) return 'other';
  const r = raw.toLowerCase();
  if (r.includes('discover')) return 'discovery';
  if (r.includes('qual')) return 'qualification';
  if (r.includes('proposal') || r.includes('quote')) return 'proposal';
  if (r.includes('negotiation') || r.includes('contract')) return 'negotiation';
  if (r.includes('won') || r.includes('closed won')) return 'closed_won';
  if (r.includes('lost') || r.includes('closed lost')) return 'closed_lost';
  return 'other';
}

/**
 * Get display label for a pipeline stage
 */
export function getStageLabel(stage: PipelineStage | 'other'): string {
  const labels: Record<PipelineStage | 'other', string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Won',
    closed_lost: 'Lost',
    other: 'Other',
  };
  return labels[stage] || 'Other';
}

/**
 * Get stage color classes for styling
 */
export function getStageColorClass(stage: PipelineStage | 'other'): string {
  const colors: Record<PipelineStage | 'other', string> = {
    discovery: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    qualification: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    proposal: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    negotiation: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    closed_won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    closed_lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[stage] || colors.other;
}

/**
 * Active pipeline stages (not closed)
 */
export const ACTIVE_STAGES: PipelineStage[] = [
  'discovery',
  'qualification',
  'proposal',
  'negotiation',
];

/**
 * All pipeline stages in order
 */
export const ALL_STAGES: (PipelineStage | 'other')[] = [
  'discovery',
  'qualification',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
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
  'Discovery',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
] as const;

/**
 * Active opportunity stages (not closed)
 */
export const ACTIVE_OPPORTUNITY_STAGES = [
  'Discovery',
  'Qualification',
  'Proposal',
  'Negotiation',
] as const;

/**
 * Alias for getStageColorClass using display labels
 */
export function getStageColorClasses(stage?: string | null): string {
  const colors: Record<string, string> = {
    Discovery: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Qualification: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Proposal: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Negotiation: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    Won: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    Other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return colors[stage || ''] || colors.Other;
}
