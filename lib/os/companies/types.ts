// lib/os/companies/types.ts
// View models for Companies directory page
// Provides strict typing for aggregated company data

// ============================================================================
// Core Types
// ============================================================================

export type CompanyStage = 'Prospect' | 'Client' | 'Internal' | 'Dormant' | 'Lost';

export type CompanyHealthStatus = 'Good' | 'Okay' | 'AtRisk' | 'Unknown';

export type GapRunType = 'FULL' | 'IA';

export type ActivitySource =
  | 'GAP Run'
  | 'Full GAP Run'
  | 'Diagnostic Run'
  | 'Work Updated'
  | 'Context Updated'
  | 'Lab Run'
  | 'None';

export type AttentionFilter =
  | 'highIntent'
  | 'overdueWork'
  | 'noBaseline'
  | 'duplicates'
  | 'atRisk';

export type SortField =
  | 'name'
  | 'lastActivity'
  | 'gapScore'
  | 'openWork'
  | 'health';

export type SortDirection = 'asc' | 'desc';

// ============================================================================
// View Models
// ============================================================================

/**
 * Row view model for the companies table
 * Contains all data needed to render a single company row
 */
export interface CompanyRowVM {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;

  // CRM fields
  stage: CompanyStage;
  ownerName: string | null;
  tier: string | null;

  // Health
  health: CompanyHealthStatus;
  healthReasons: string[];

  // Activity tracking
  lastActivityAt: string | null; // ISO timestamp
  lastActivityLabel: string; // e.g., "3 days ago", "No activity"
  lastActivitySource: ActivitySource;

  // Work items
  openWorkCount: number;
  overdueWorkCount: number;

  // GAP data
  latestGap: {
    type: GapRunType | null;
    score: number | null;
    runAt: string | null;
  };

  // Attention signals
  isHighIntent: boolean;
  highIntentReasons: string[];
  hasNoBaseline: boolean;
  isDuplicate: boolean;
  duplicateOf: string | null; // companyId of the primary record

  // For sorting
  createdAt: string | null;
}

/**
 * Summary view model for the companies page header
 * Contains aggregate counts for attention chips
 */
export interface CompaniesPageSummaryVM {
  // Total counts by stage
  countsByStage: {
    all: number;
    client: number;
    prospect: number;
    internal: number;
    dormant: number;
    lost: number;
  };

  // Needs attention counts
  needsAttention: {
    highIntentCount: number;
    overdueWorkCount: number;
    noBaselineCount: number;
    duplicatesCount: number;
    atRiskCount: number;
  };

  // High intent company IDs (for filtering)
  highIntentIds: string[];

  // Duplicate company IDs (for filtering)
  duplicateIds: string[];

  // No baseline company IDs (for filtering)
  noBaselineIds: string[];
}

/**
 * Filter options for company list queries
 */
export interface CompanyListFilterV2 {
  stage?: CompanyStage | 'All';
  search?: string;
  attention?: AttentionFilter;
  sortBy?: SortField;
  sortDirection?: SortDirection;
}

/**
 * Response from the companies aggregation endpoint
 */
export interface CompaniesAggregationResponse {
  companies: CompanyRowVM[];
  summary: CompaniesPageSummaryVM;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize domain for deduplication
 * Strips protocol, www, trailing slashes, and lowercases
 */
export function normalizeDomainForDedup(input: string | null | undefined): string | null {
  if (!input) return null;

  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www.
  domain = domain.replace(/^www\./, '');

  // Remove trailing slash and path
  domain = domain.split('/')[0];

  // Remove port
  domain = domain.split(':')[0];

  // Validate it looks like a domain
  if (!domain || !domain.includes('.')) {
    return null;
  }

  return domain;
}

/**
 * Map CompanyHealthStatus to display-friendly label
 */
export function getHealthLabel(health: CompanyHealthStatus): string {
  const labels: Record<CompanyHealthStatus, string> = {
    Good: 'Good',
    Okay: 'Okay',
    AtRisk: 'At Risk',
    Unknown: 'Unknown',
  };
  return labels[health];
}

/**
 * Get badge classes for health status
 */
export function getHealthBadgeClasses(health: CompanyHealthStatus): string {
  const classes: Record<CompanyHealthStatus, string> = {
    Good: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Okay: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    AtRisk: 'bg-red-500/10 text-red-400 border-red-500/30',
    Unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return classes[health];
}

/**
 * Get badge classes for stage
 */
export function getStageBadgeClasses(stage: CompanyStage): string {
  const classes: Record<CompanyStage, string> = {
    Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return classes[stage];
}

/**
 * Format last activity for display
 */
export function formatLastActivity(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No activity';

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  } catch {
    return 'Unknown';
  }
}

/**
 * Get score color class
 */
export function getScoreColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-slate-500';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 55) return 'text-amber-400';
  return 'text-red-400';
}
