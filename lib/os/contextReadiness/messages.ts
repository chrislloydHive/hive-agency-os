// lib/os/contextReadiness/messages.ts
// Context Readiness Messaging Helpers
//
// Replaces confusing states like "Some labs have findings but no proposed facts"
// with readiness-driven messages that tell users exactly what's missing and what to do.

import type {
  ReadinessSummary,
  DomainReadiness,
  ContextDomainKey,
  RequiredForFeature,
  ReadinessStatus,
} from './types';
import { DOMAIN_CONFIGS } from './rules';

// ============================================================================
// Feature Labels
// ============================================================================

const FEATURE_LABELS: Record<RequiredForFeature, string> = {
  overview: 'Company Overview',
  proposals: 'Review Queue',
  strategy: 'Strategy',
  'gap-plan': 'GAP Plan',
  labs: 'Diagnostics',
};

// ============================================================================
// Status Messages
// ============================================================================

/**
 * Get a summary message for the overall readiness status
 */
export function getOverallStatusMessage(summary: ReadinessSummary): string {
  const featureLabel = FEATURE_LABELS[summary.requiredFor];

  switch (summary.overallStatus) {
    case 'ready':
      return `All required context is ready for ${featureLabel}.`;

    case 'partial': {
      const missingCount = summary.missingRequiredDomains.length;
      const partialCount = summary.partialDomains.length;

      if (missingCount > 0) {
        const domainNames = summary.missingRequiredDomains
          .map(d => DOMAIN_CONFIGS[d].label)
          .join(', ');
        return `Missing ${missingCount} required domain${missingCount > 1 ? 's' : ''} for ${featureLabel}: ${domainNames}.`;
      }

      if (partialCount > 0) {
        return `${partialCount} domain${partialCount > 1 ? 's' : ''} need${partialCount === 1 ? 's' : ''} attention for ${featureLabel}.`;
      }

      return `Context is partially ready for ${featureLabel}.`;
    }

    case 'missing': {
      const domainNames = summary.missingRequiredDomains
        .map(d => DOMAIN_CONFIGS[d].label)
        .join(', ');
      return `Cannot proceed with ${featureLabel}. Missing required context: ${domainNames}.`;
    }
  }
}

/**
 * Get a concise status badge label
 */
export function getStatusBadgeLabel(status: ReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'partial':
      return 'Partial';
    case 'missing':
      return 'Missing';
  }
}

/**
 * Get status badge color class
 */
export function getStatusBadgeColor(status: ReadinessStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'partial':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'missing':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

// ============================================================================
// Domain-Specific Messages
// ============================================================================

/**
 * Get a detailed message for a domain's status
 */
export function getDomainStatusMessage(domain: DomainReadiness): string {
  const { domainLabel, status, failedChecks, pendingProposalsCount, labHasRun } = domain;

  if (status === 'ready') {
    return `${domainLabel} context is complete and verified.`;
  }

  if (status === 'missing') {
    if (!labHasRun && domain.labSlug) {
      return `No ${domainLabel} data. Run ${DOMAIN_CONFIGS[domain.domain].labName || domainLabel + ' Lab'} to populate.`;
    }
    if (failedChecks.length > 0) {
      const missing = failedChecks
        .filter(c => c.required)
        .map(c => c.label)
        .join(', ');
      return `Missing required ${domainLabel} fields: ${missing || 'core data'}.`;
    }
    return `No ${domainLabel} context found.`;
  }

  // Partial
  if (pendingProposalsCount > 0) {
    return `${domainLabel} has ${pendingProposalsCount} pending proposal${pendingProposalsCount > 1 ? 's' : ''} to review.`;
  }

  if (failedChecks.length > 0) {
    const missing = failedChecks
      .filter(c => c.required)
      .map(c => c.label)
      .join(', ');
    if (missing) {
      return `${domainLabel} is missing: ${missing}.`;
    }
    const recommended = failedChecks
      .filter(c => !c.required)
      .map(c => c.label)
      .join(', ');
    return `${domainLabel} is ready but could improve: ${recommended}.`;
  }

  return `${domainLabel} context is partially complete.`;
}

/**
 * Get a "why" tooltip message explaining a domain's status
 */
export function getDomainWhyMessage(domain: DomainReadiness): string {
  const lines: string[] = [];

  // Status summary
  if (domain.status === 'ready') {
    lines.push('All checks passed.');
  } else if (domain.status === 'missing') {
    lines.push('Required data is missing.');
  } else {
    lines.push('Some checks need attention.');
  }

  // Failed checks
  if (domain.failedChecks.length > 0) {
    lines.push('');
    lines.push('Missing:');
    for (const check of domain.failedChecks.slice(0, 3)) {
      lines.push(`• ${check.label}${check.reason ? `: ${check.reason}` : ''}`);
    }
    if (domain.failedChecks.length > 3) {
      lines.push(`• ...and ${domain.failedChecks.length - 3} more`);
    }
  }

  // Warnings
  const nonCheckWarnings = domain.warnings.filter(w => !w.relatedField);
  if (nonCheckWarnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    for (const warning of nonCheckWarnings.slice(0, 2)) {
      lines.push(`• ${warning.message}`);
    }
  }

  // Lab quality
  const labScore = domain.labQualityScore;
  if (labScore != null && labScore < 40) {
    lines.push('');
    lines.push(`Lab quality score: ${labScore}/100 (low)`);
  }

  return lines.join('\n');
}

// ============================================================================
// Action Messages
// ============================================================================

/**
 * Get a clear next action message
 * Replaces confusing messages like "Some labs have findings but no proposed facts"
 */
export function getNextActionMessage(summary: ReadinessSummary): string {
  // Use the computed next action from the summary
  return summary.nextAction;
}

/**
 * Get an empty state message for when there's no context at all
 */
export function getEmptyStateMessage(requiredFor: RequiredForFeature): string {
  const featureLabel = FEATURE_LABELS[requiredFor];

  switch (requiredFor) {
    case 'strategy':
      return `To generate a strategy, you need Audience and Competitive Landscape context. Run the Audience Lab and Competition Lab to get started.`;

    case 'gap-plan':
      return `GAP Plan requires Audience, Competitive Landscape, and Brand context. Start by running the diagnostic labs.`;

    case 'proposals':
      return `No pending proposals to review. Run labs to generate context proposals.`;

    case 'overview':
      return `Get started by running diagnostic labs to build your company context.`;

    case 'labs':
      return `Run diagnostic labs to analyze your company's digital presence.`;
  }
}

/**
 * Format a list of missing domains into a human-readable message
 */
export function formatMissingDomainsMessage(
  missingDomains: ContextDomainKey[],
  requiredFor: RequiredForFeature
): string {
  if (missingDomains.length === 0) {
    return '';
  }

  const featureLabel = FEATURE_LABELS[requiredFor];
  const domainNames = missingDomains.map(d => DOMAIN_CONFIGS[d].label);

  if (domainNames.length === 1) {
    return `You have 1 domain missing required context for ${featureLabel}: ${domainNames[0]}.`;
  }

  if (domainNames.length === 2) {
    return `You have 2 domains missing required context for ${featureLabel}: ${domainNames[0]} and ${domainNames[1]}.`;
  }

  const last = domainNames.pop();
  return `You have ${domainNames.length + 1} domains missing required context for ${featureLabel}: ${domainNames.join(', ')}, and ${last}.`;
}

// ============================================================================
// Progress Messages
// ============================================================================

/**
 * Get a progress indicator message
 */
export function getProgressMessage(summary: ReadinessSummary): string {
  const { overallScore, readyDomains, domains } = summary;
  const total = domains.length;
  const ready = readyDomains.length;

  if (overallScore === 100) {
    return `All ${total} domains ready`;
  }

  if (ready === 0) {
    return `No domains ready yet`;
  }

  return `${ready} of ${total} domains ready (${overallScore}%)`;
}

/**
 * Get a short status line for compact display
 */
export function getCompactStatusLine(summary: ReadinessSummary): string {
  const { overallStatus, overallScore, missingRequiredDomains } = summary;

  if (overallStatus === 'ready') {
    return `Context ready (${overallScore}%)`;
  }

  if (overallStatus === 'missing') {
    return `Missing: ${missingRequiredDomains.map(d => DOMAIN_CONFIGS[d].label).join(', ')}`;
  }

  return `Partial (${overallScore}%) - ${summary.nextAction}`;
}
