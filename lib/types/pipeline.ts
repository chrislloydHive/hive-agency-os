// lib/types/pipeline.ts
// Shared types for Pipeline module (Opportunities + Leads)

/**
 * Opportunity item from A-Lead Tracker table
 */
export interface OpportunityItem {
  id: string;
  companyName: string;
  deliverableName?: string;
  stage: OpportunityStage;
  leadStatus?: LeadStatus;
  owner?: string;
  value?: number;
  probability?: number;
  closeDate?: string;
  createdAt?: string;
  notes?: string;
  repNotes?: string;
  nextSteps?: string;
  // Linked entities
  companyId?: string;
  leadId?: string;
  // Snapshot fields (from GAP-IA)
  snapshotScore?: number;
  snapshotDate?: string;
  // CRM enrichment
  companyStage?: string;
  companyDomain?: string;
  companyIndustry?: string;
  icpFitScore?: number;
}

/**
 * Inbound lead item from Inbound Leads table
 */
export interface InboundLeadItem {
  id: string;
  name?: string;
  email?: string;
  website?: string;
  companyName?: string;
  leadSource?: LeadSource;
  status: InboundLeadStatus;
  assignee?: string;
  notes?: string;
  attachments?: string[];
  createdAt?: string;
  // Linked entities
  companyId?: string;
  gapIaRunId?: string;
  // Enrichment
  gapIaScore?: number;
  gapIaDate?: string;
}

/**
 * Opportunity stages (from A-Lead Tracker)
 */
export type OpportunityStage =
  | 'Discovery'
  | 'Proposal'
  | 'Contract'
  | 'Won'
  | 'Lost';

/**
 * Lead status values
 */
export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Negotiating'
  | 'Closed Won'
  | 'Closed Lost';

/**
 * Inbound lead status
 */
export type InboundLeadStatus =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Disqualified'
  | 'Converted';

/**
 * Lead source channels
 */
export type LeadSource =
  | 'DMA'
  | 'Referral'
  | 'Inbound'
  | 'Outbound'
  | 'Website'
  | 'Other';

/**
 * Stage configuration for UI
 */
export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'Discovery',
  'Proposal',
  'Contract',
  'Won',
  'Lost',
];

export const ACTIVE_OPPORTUNITY_STAGES: OpportunityStage[] = [
  'Discovery',
  'Proposal',
  'Contract',
];

export const INBOUND_LEAD_STATUSES: InboundLeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Disqualified',
  'Converted',
];

export const LEAD_SOURCES: LeadSource[] = [
  'DMA',
  'Referral',
  'Inbound',
  'Outbound',
  'Website',
  'Other',
];

/**
 * Get stage color classes for styling
 */
export function getStageColorClasses(stage: OpportunityStage): string {
  switch (stage) {
    case 'Won':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Lost':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'Contract':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'Proposal':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Discovery':
    default:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
}

/**
 * Get lead status color classes for styling
 */
export function getLeadStatusColorClasses(status: InboundLeadStatus): string {
  switch (status) {
    case 'New':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'Contacted':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Qualified':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'Converted':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Disqualified':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}
