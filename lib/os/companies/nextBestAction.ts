// lib/os/companies/nextBestAction.ts
// Next Best Action Helper
//
// Derives a single practical next step based on alerts, snapshot, and health data.
// Displayed prominently on the Overview page to guide users.

import type { CompanyStrategicSnapshot } from '@/lib/airtable/companyStrategySnapshot';
import type { CompanyAlert } from './alerts';
import type { QuickHealthCheckResult } from './healthCheck';

// ============================================================================
// Types
// ============================================================================

export interface NextBestAction {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  linkPath?: string;
}

// ============================================================================
// Action Derivation
// ============================================================================

/**
 * Derive the next best action for a company based on available data.
 *
 * Priority order:
 * 1. Critical alerts → address immediately
 * 2. Health check issues → run diagnostics or fix identified problems
 * 3. Low scores → focus on weakest area
 * 4. Snapshot focus areas → work on top priority
 * 5. Default → run a diagnostic to establish baseline
 */
export function deriveNextBestAction(
  companyId: string,
  options: {
    alerts?: CompanyAlert[];
    snapshot?: CompanyStrategicSnapshot | null;
    healthCheck?: QuickHealthCheckResult | null;
  }
): NextBestAction {
  const { alerts = [], snapshot, healthCheck } = options;

  // 1. Check for critical alerts
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    const firstCritical = criticalAlerts[0];
    return {
      action: `Address: ${firstCritical.title}`,
      reason: 'Critical issue detected that needs immediate attention',
      priority: 'high',
      linkPath: firstCritical.linkPath || `/c/${companyId}/tools`,
    };
  }

  // 2. Check health check recommendations
  if (healthCheck?.recommendedNextStep) {
    return {
      action: healthCheck.recommendedNextStep,
      reason: healthCheck.primaryIssue || 'From latest health check',
      priority: healthCheck.status === 'at_risk' ? 'high' : 'medium',
      linkPath: `/c/${companyId}/tools`,
    };
  }

  // 3. Check for warning alerts
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  if (warningAlerts.length > 0) {
    const firstWarning = warningAlerts[0];
    return {
      action: `Review: ${firstWarning.title}`,
      reason: 'Warning that should be addressed soon',
      priority: 'medium',
      linkPath: firstWarning.linkPath || `/c/${companyId}/tools`,
    };
  }

  // 4. Check for low overall score
  if (snapshot?.overallScore !== null && snapshot?.overallScore !== undefined) {
    if (snapshot.overallScore < 50) {
      // Find the weakest area from focus areas
      const topFocus = snapshot.focusAreas?.[0];
      if (topFocus) {
        return {
          action: `Focus on: ${topFocus}`,
          reason: `Overall score is ${snapshot.overallScore}. Prioritizing the top focus area.`,
          priority: 'high',
          linkPath: `/c/${companyId}/work`,
        };
      }
      return {
        action: 'Run GAP Snapshot diagnostic',
        reason: `Overall score is ${snapshot.overallScore}. A fresh diagnostic will identify priorities.`,
        priority: 'high',
        linkPath: `/c/${companyId}/diagnostics/gap-ia`,
      };
    }

    if (snapshot.overallScore < 70) {
      const topFocus = snapshot.focusAreas?.[0];
      if (topFocus) {
        return {
          action: `Work on: ${topFocus}`,
          reason: 'Top strategic priority from the snapshot',
          priority: 'medium',
          linkPath: `/c/${companyId}/work`,
        };
      }
    }
  }

  // 5. Use snapshot focus areas if available
  if (snapshot?.focusAreas && snapshot.focusAreas.length > 0) {
    return {
      action: `Continue: ${snapshot.focusAreas[0]}`,
      reason: 'Top focus area from strategic snapshot',
      priority: 'medium',
      linkPath: `/c/${companyId}/work`,
    };
  }

  // 6. No snapshot - suggest running diagnostics
  if (!snapshot || snapshot.overallScore === null) {
    return {
      action: 'Run your first diagnostic',
      reason: 'No baseline established yet. Start with GAP Snapshot or Website Lab.',
      priority: 'medium',
      linkPath: `/c/${companyId}/tools`,
    };
  }

  // 7. Default - everything looks good
  return {
    action: 'Review recent work items',
    reason: 'No urgent issues detected. Check on in-progress work.',
    priority: 'low',
    linkPath: `/c/${companyId}/work`,
  };
}

/**
 * Get the color classes for a priority level
 */
export function getPriorityColorClasses(priority: 'high' | 'medium' | 'low'): {
  bg: string;
  text: string;
  border: string;
} {
  switch (priority) {
    case 'high':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-300',
        border: 'border-red-500/30',
      };
    case 'medium':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-300',
        border: 'border-amber-500/30',
      };
    case 'low':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-300',
        border: 'border-blue-500/30',
      };
  }
}
