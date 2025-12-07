// lib/brain/summaryTypes.ts
// Shared data contracts for Brain summary consumed by QBR & Blueprint
//
// BrainSummary provides a unified view of company context health,
// domain status, lab runs, and insights that downstream consumers
// (QBR Story, Blueprint) can depend on without coupling to internals.

// ============================================================================
// Domain Health
// ============================================================================

export interface BrainDomainHealth {
  /** Domain identifier (e.g., "identity", "brand", "audience") */
  id: string;
  /** Human-readable label (e.g., "Identity", "Brand") */
  label: string;
  /** Overall health score (0-100) combining completeness, freshness, confidence */
  healthScore: number;
  /** Field completion percentage (0-100) */
  completion: number;
  /** Data freshness percentage (0-100) */
  freshness: number;
  /** Number of fields with conflicting values from different sources */
  conflictedFields: number;
  /** Number of fields with low confidence scores */
  lowConfidenceFields: number;
  /** Number of required/important fields that are empty */
  missingFields: number;
}

// ============================================================================
// Context Deltas (changes between snapshots)
// ============================================================================

export interface BrainContextDelta {
  /** Unique identifier for this change */
  id: string;
  /** Human-readable label for what changed */
  label: string;
  /** Domain this change belongs to */
  domainId: string;
  /** Type of change */
  changeType: 'added' | 'removed' | 'updated';
  /** Importance level (1-5, where 5 is most important) */
  importance: number;
  /** Short human-readable description of the change */
  summary: string;
  /** ISO timestamp of when the change occurred */
  changedAt?: string;
}

// ============================================================================
// Lab Summaries
// ============================================================================

export type LabStatus = 'not_run' | 'stale' | 'fresh';

export interface BrainLabSummary {
  /** Lab identifier (e.g., "competition", "website", "brand") */
  id: string;
  /** Human-readable label */
  label: string;
  /** ISO timestamp of last run, if any */
  lastRunAt?: string;
  /** Current status based on recency */
  status: LabStatus;
  /** List of domain IDs this lab enriches */
  enrichesDomains: string[];
  /** Optional notes or summary from last run */
  notes?: string;
  /** Link to lab page */
  href?: string;
}

// ============================================================================
// Insights Summary
// ============================================================================

export type InsightSeverity = 'critical' | 'warning' | 'info';

export interface BrainInsightItem {
  /** Unique insight ID */
  id: string;
  /** Short title */
  title: string;
  /** Severity level */
  severity: InsightSeverity;
  /** Related domain, if any */
  domainId?: string;
  /** Brief description */
  description?: string;
}

export interface BrainInsightsSummary {
  /** Total number of insights */
  totalInsights: number;
  /** Count of critical severity insights */
  criticalCount: number;
  /** Count of warning severity insights */
  warningCount: number;
  /** Count of info severity insights */
  infoCount: number;
  /** Top insights to display (limited list) */
  topInsights: BrainInsightItem[];
}

// ============================================================================
// Main BrainSummary Contract
// ============================================================================

export interface BrainSummary {
  /** Company ID */
  companyId: string;
  /** Snapshot ID (e.g., "current" or a QBR snapshot ID) */
  snapshotId: string;
  /** Overall data confidence score (0-100) derived from health + conflicts */
  dataConfidenceScore: number;
  /** Health status for each domain */
  domains: BrainDomainHealth[];
  /** Context changes since comparison snapshot (if provided) */
  contextDeltas: BrainContextDelta[];
  /** Summary of lab run statuses */
  labs: BrainLabSummary[];
  /** Summary of insights */
  insights: BrainInsightsSummary;
  /** ISO timestamp when this summary was generated */
  generatedAt: string;
}

// ============================================================================
// Helper Types for Consumers
// ============================================================================

/** Domain health status tier based on score */
export type DomainHealthTier = 'strong' | 'needs_work' | 'critical';

export function getDomainHealthTier(score: number): DomainHealthTier {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'needs_work';
  return 'critical';
}

/** Get domains below a health threshold */
export function getWeakDomains(
  domains: BrainDomainHealth[],
  threshold = 70
): BrainDomainHealth[] {
  return domains.filter((d) => d.healthScore < threshold);
}

/** Get formatted confidence label */
export function getConfidenceLabel(score: number): string {
  if (score >= 80) return 'High';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Low';
  return 'Very Low';
}
