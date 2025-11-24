export type CompanyId = string;

/**
 * Company interface for OS views.
 * NOTE: Companies is a lean identity + CRM table.
 * All diagnostics, scores, priorities, plans, and evidence live in the Full Reports table.
 * Gap Runs tracks pipeline execution; Work Items tracks initiatives.
 */
export interface Company {
  id: CompanyId;
  name: string;
  websiteUrl: string; // For compatibility with existing code
  industry?: string;
  stage?: string;
  companyType?: 'SaaS' | 'Services' | 'Marketplace' | 'eCom' | 'Local' | 'Other';
  sizeBand?: '1–10' | '11–50' | '51–200' | '200+';
  region?: string;
  owner?: string;
  source?: 'Referral' | 'Inbound' | 'Outbound' | 'Internal' | 'Other';
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactRole?: string;
  notes?: string;
  // Legacy fields for backward compatibility (deprecated)
  leadId?: string;
  email?: string;
  lastSnapshotAt?: string; // ISO - derived from Full Reports
  latestOverallScore?: number; // 0–100 - derived from Full Reports, NOT stored on Companies
  status?: 'new' | 'in_progress' | 'active' | 'paused' | 'closed'; // Derived from Full Reports Status
  snapshotId?: string; // Linked Snapshot ID - derived from Full Reports
  fullReportId?: string; // Linked Full Report ID - derived from Full Reports
  snapshotReportUrl?: string; // Snapshot Report URL - derived from Full Reports
  fullReportUrl?: string; // Full Report URL - derived from Full Reports
  submissionDate?: string; // ISO date - derived from Full Reports
  fullReportDate?: string; // ISO date - derived from Full Reports
}

export interface Snapshot {
  id: string;
  companyId: CompanyId;
  createdAt: string;
  source: 'snapshot_form' | 'manual' | 'import';
  notes?: string;
}

export interface Diagnostics {
  companyId: CompanyId;
  snapshotId: string;
  overallScore: number;
  websiteScore: number;
  brandScore: number;
  contentScore: number;
  seoScore: number;
  keyIssues: string[];
}

export interface PriorityItem {
  id: string;
  companyId: CompanyId;
  title: string;
  description: string;
  impact: number; // 1–10
  effort: number; // 1–10
  category:
    | 'website'
    | 'brand'
    | 'content'
    | 'seo'
    | 'funnel'
    | 'strategy';
  status: 'not_started' | 'in_progress' | 'completed';
}

export interface GrowthPlan {
  companyId: CompanyId;
  snapshotId: string;
  headlineSummary: string;
  recommendedFocusAreas: string[];
  planSections: Array<{
    id: string;
    title: string;
    summary: string;
    recommendedActions: string[];
  }>;
}

export interface ScorecardPoint {
  date: string; // ISO
  overallScore?: number;
  traffic?: number;
  leads?: number;
  notes?: string;
}

export interface CompanyScorecard {
  companyId: CompanyId;
  history: ScorecardPoint[];
}
