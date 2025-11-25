// lib/os/companies/health.ts
// Central Health Model for Company Evaluation
// Health is derived in code, not stored in Airtable (with option for manual override)

// ============================================================================
// Types
// ============================================================================

export type CompanyHealth = 'Healthy' | 'At Risk' | 'Unknown';

export interface CompanyActivitySnapshot {
  lastGapAssessmentAt?: string | null;
  lastGapPlanAt?: string | null;
  lastDiagnosticAt?: string | null;
  lastWorkActivityAt?: string | null; // created or completed
  lastAnyActivityAt?: string | null;
}

export interface CompanyHealthEvaluation {
  health: CompanyHealth;
  reasons: string[]; // human-readable reasons we can show in UI
}

export interface HealthInputs {
  stage?: string | null; // "Client" | "Prospect" | "Internal" | etc.
  activity: CompanyActivitySnapshot;
  // Optional flags for additional context
  hasOverdueWork?: boolean;
  hasBacklogWork?: boolean;
  latestGapScore?: number | null;
  // Optional manual override fields for future:
  healthOverride?: CompanyHealth | null;
  atRiskFlag?: boolean | null;
}

// ============================================================================
// Constants
// ============================================================================

const INACTIVITY_THRESHOLD_DAYS = 90;
const PROSPECT_INACTIVITY_THRESHOLD_DAYS = 90;
const PROSPECT_HEALTHY_THRESHOLD_DAYS = 60;
const LOW_SCORE_THRESHOLD = 40;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the number of days between a date and now
 */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Format a date for display in reasons
 */
function formatDateForReason(dateStr: string | null | undefined): string {
  if (!dateStr) return 'unknown date';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'unknown date';
  }
}

/**
 * Get the most recent date from an array of date strings
 */
export function getMaxDate(...dates: (string | null | undefined)[]): string | null {
  const validDates = dates
    .filter((d): d is string => !!d)
    .map((d) => new Date(d))
    .filter((d) => !isNaN(d.getTime()));

  if (validDates.length === 0) return null;

  const maxDate = new Date(Math.max(...validDates.map((d) => d.getTime())));
  return maxDate.toISOString();
}

// ============================================================================
// Main Health Evaluation Function
// ============================================================================

/**
 * Evaluate company health based on stage, activity, and optional flags
 *
 * Rules (v1 heuristic):
 *
 * If healthOverride is provided → return that + reason "Manual override"
 *
 * For Clients:
 * - No activity at all → At Risk ("No assessments, diagnostics, or work activity recorded yet.")
 * - Last activity > 90 days ago → At Risk ("No recent activity in the last 90 days.")
 * - Last GAP assessment > 90 days ago → At Risk ("No recent GAP assessment in the last 90 days.")
 * - Has overdue/backlog work with no recent activity → At Risk
 * - Low GAP score (< 40) → At Risk
 * - Otherwise → Healthy ("Client has recent activity and assessments.")
 *
 * For Prospects:
 * - No GAP assessment and no diagnostics → Unknown ("No diagnostics or assessments yet.")
 * - Recent GAP/diagnostics within 60 days → Healthy
 * - Last activity > 90 days → At Risk ("Prospect has been inactive for 90+ days.")
 *
 * For other stages → default to "Unknown"
 */
export function evaluateCompanyHealth(inputs: HealthInputs): CompanyHealthEvaluation {
  const {
    stage,
    activity,
    hasOverdueWork = false,
    hasBacklogWork = false,
    latestGapScore,
    healthOverride,
    atRiskFlag,
  } = inputs;

  // Manual override takes precedence
  if (healthOverride) {
    return {
      health: healthOverride,
      reasons: ['Manual override'],
    };
  }

  // At Risk flag override
  if (atRiskFlag === true) {
    return {
      health: 'At Risk',
      reasons: ['Manually flagged as at risk'],
    };
  }

  const normalizedStage = stage?.trim() || '';
  const reasons: string[] = [];

  // Compute lastAnyActivityAt if not already set
  const lastAnyActivityAt =
    activity.lastAnyActivityAt ||
    getMaxDate(
      activity.lastGapAssessmentAt,
      activity.lastGapPlanAt,
      activity.lastDiagnosticAt,
      activity.lastWorkActivityAt
    );

  const daysSinceActivity = daysSince(lastAnyActivityAt);
  const daysSinceGapAssessment = daysSince(activity.lastGapAssessmentAt);

  // ========================================================================
  // Client Health Logic
  // ========================================================================
  if (normalizedStage === 'Client') {
    // No activity at all
    if (!lastAnyActivityAt) {
      return {
        health: 'At Risk',
        reasons: ['No assessments, diagnostics, or work activity recorded yet.'],
      };
    }

    // Very low GAP score
    if (latestGapScore !== null && latestGapScore !== undefined && latestGapScore < LOW_SCORE_THRESHOLD) {
      reasons.push(`Low GAP score (${latestGapScore}/100) indicates significant issues.`);
      return {
        health: 'At Risk',
        reasons,
      };
    }

    // Check inactivity
    if (daysSinceActivity !== null && daysSinceActivity > INACTIVITY_THRESHOLD_DAYS) {
      reasons.push(
        `No recent activity in the last ${INACTIVITY_THRESHOLD_DAYS} days (last: ${formatDateForReason(lastAnyActivityAt)}).`
      );
      return {
        health: 'At Risk',
        reasons,
      };
    }

    // Check GAP assessment staleness
    if (activity.lastGapAssessmentAt) {
      if (daysSinceGapAssessment !== null && daysSinceGapAssessment > INACTIVITY_THRESHOLD_DAYS) {
        reasons.push(
          `No recent GAP assessment in the last ${INACTIVITY_THRESHOLD_DAYS} days (last: ${formatDateForReason(activity.lastGapAssessmentAt)}).`
        );
        return {
          health: 'At Risk',
          reasons,
        };
      }
    } else {
      // No GAP assessment ever for a client
      reasons.push('No GAP assessment on record.');
      return {
        health: 'At Risk',
        reasons,
      };
    }

    // Overdue or stale backlog work
    if (hasOverdueWork || hasBacklogWork) {
      // Only flag if combined with some staleness
      if (daysSinceActivity !== null && daysSinceActivity > 30) {
        reasons.push('Backlog or overdue work with no recent activity.');
        return {
          health: 'At Risk',
          reasons,
        };
      }
    }

    // Client is healthy
    return {
      health: 'Healthy',
      reasons: ['Client has recent activity and assessments.'],
    };
  }

  // ========================================================================
  // Prospect Health Logic
  // ========================================================================
  if (normalizedStage === 'Prospect' || normalizedStage === 'Lead') {
    const hasGapAssessment = !!activity.lastGapAssessmentAt;
    const hasDiagnostics = !!activity.lastDiagnosticAt;

    // No GAP and no diagnostics
    if (!hasGapAssessment && !hasDiagnostics) {
      return {
        health: 'Unknown',
        reasons: ['No diagnostics or assessments yet.'],
      };
    }

    // Check for recent activity (within 60 days = healthy pipeline)
    if (daysSinceActivity !== null && daysSinceActivity <= PROSPECT_HEALTHY_THRESHOLD_DAYS) {
      return {
        health: 'Healthy',
        reasons: ['Prospect has recent engagement and assessments.'],
      };
    }

    // Inactive for too long
    if (daysSinceActivity !== null && daysSinceActivity > PROSPECT_INACTIVITY_THRESHOLD_DAYS) {
      reasons.push(
        `Prospect has been inactive for ${PROSPECT_INACTIVITY_THRESHOLD_DAYS}+ days (last: ${formatDateForReason(lastAnyActivityAt)}).`
      );
      return {
        health: 'At Risk',
        reasons,
      };
    }

    // Default for prospects with some activity
    return {
      health: 'Healthy',
      reasons: ['Prospect is being actively worked.'],
    };
  }

  // ========================================================================
  // Internal / Dormant / Lost / Other Stages
  // ========================================================================
  if (normalizedStage === 'Internal') {
    // Internal companies are typically not evaluated for health
    return {
      health: 'Unknown',
      reasons: ['Internal company - health not tracked.'],
    };
  }

  if (normalizedStage === 'Dormant') {
    return {
      health: 'Unknown',
      reasons: ['Company is dormant.'],
    };
  }

  if (normalizedStage === 'Lost' || normalizedStage === 'Churned') {
    return {
      health: 'Unknown',
      reasons: ['Company is no longer active.'],
    };
  }

  // Default for unknown stages
  return {
    health: 'Unknown',
    reasons: ['Health status could not be determined.'],
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

/**
 * Get health badge color classes for UI
 */
export function getHealthBadgeClasses(health: CompanyHealth): string {
  switch (health) {
    case 'Healthy':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'At Risk':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'Unknown':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

/**
 * Format the primary health reason for display
 */
export function getPrimaryHealthReason(reasons: string[]): string | null {
  return reasons.length > 0 ? reasons[0] : null;
}
