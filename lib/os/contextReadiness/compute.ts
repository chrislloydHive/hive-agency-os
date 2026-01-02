// lib/os/contextReadiness/compute.ts
// Context Readiness Computation
//
// Deterministic computation of context readiness scores.
// No AI calls - pure logic based on data presence and quality.

import type {
  ContextDomainKey,
  ReadinessStatus,
  ReadinessInput,
  ReadinessSummary,
  DomainReadiness,
  DomainCheck,
  DomainWarning,
  RequirementLevel,
} from './types';

import {
  DOMAIN_CONFIGS,
  DOMAIN_DISPLAY_ORDER,
  MIN_QUALITY_SCORE_FOR_READY,
  checkAudienceDomain,
  checkCompetitiveLandscapeDomain,
  checkBrandDomain,
  checkWebsiteDomain,
  checkSeoDomain,
  checkMediaDomain,
  checkCreativeDomain,
  generateDomainCTAs,
  getDomainLabSlug,
  getRequirementLevel,
} from './rules';

// ============================================================================
// Domain Status Computation
// ============================================================================

/**
 * Determine domain status from checks
 */
function computeDomainStatus(
  checks: DomainCheck[],
  labQualityScore: number | null,
  pendingProposalsCount: number
): ReadinessStatus {
  // If no checks, domain is considered missing
  if (checks.length === 0) {
    return 'missing';
  }

  const requiredChecks = checks.filter(c => c.required);
  const passedRequired = requiredChecks.filter(c => c.passed);
  const allOptionalChecks = checks.filter(c => !c.required);
  const passedOptional = allOptionalChecks.filter(c => c.passed);

  // All required checks must pass for "ready"
  const allRequiredPassed = requiredChecks.length === 0 || passedRequired.length === requiredChecks.length;

  // If lab quality is too low, downgrade to partial
  if (labQualityScore !== null && labQualityScore < MIN_QUALITY_SCORE_FOR_READY) {
    if (allRequiredPassed) {
      return 'partial'; // Downgraded due to quality
    }
  }

  // If all required passed
  if (allRequiredPassed) {
    // If we have pending proposals, consider partial (needs review)
    if (pendingProposalsCount > 0) {
      return 'partial';
    }
    // Check optional checks - if most passed, we're ready
    const optionalPassRate = allOptionalChecks.length > 0
      ? passedOptional.length / allOptionalChecks.length
      : 1;
    return optionalPassRate >= 0.5 ? 'ready' : 'partial';
  }

  // Some required checks failed
  if (passedRequired.length > 0 || pendingProposalsCount > 0) {
    return 'partial';
  }

  return 'missing';
}

/**
 * Generate warnings for a domain
 */
function generateDomainWarnings(
  domain: ContextDomainKey,
  checks: DomainCheck[],
  labQualityScore: number | null,
  labHasRun: boolean
): DomainWarning[] {
  const warnings: DomainWarning[] = [];

  // Quality score warning
  if (labQualityScore !== null && labQualityScore < MIN_QUALITY_SCORE_FOR_READY) {
    warnings.push({
      message: `Lab quality score is low (${labQualityScore}/100). Consider re-running the lab.`,
      severity: 'warning',
    });
  }

  // Lab not run warning (if lab exists)
  const labSlug = getDomainLabSlug(domain);
  if (labSlug && !labHasRun) {
    warnings.push({
      message: `${DOMAIN_CONFIGS[domain].labName || 'Lab'} has not been run yet.`,
      severity: 'info',
    });
  }

  // Failed checks
  const failedRequired = checks.filter(c => c.required && !c.passed);
  for (const check of failedRequired) {
    warnings.push({
      message: check.reason || `Missing: ${check.label}`,
      severity: 'error',
      relatedField: check.fieldPath,
    });
  }

  return warnings;
}

/**
 * Count confirmed facts for a domain from context graph
 */
function countConfirmedFacts(domain: ContextDomainKey, checks: DomainCheck[]): number {
  return checks.filter(c => c.passed).length;
}

// ============================================================================
// Single Domain Computation
// ============================================================================

/**
 * Compute readiness for a single domain
 */
export function computeDomainReadiness(
  input: ReadinessInput,
  domain: ContextDomainKey
): DomainReadiness {
  const config = DOMAIN_CONFIGS[domain];
  const labSlug = config.labSlug;

  // Get lab run info
  const labRun = labSlug ? input.labRuns.get(labSlug) : undefined;
  const labHasRun = labRun?.hasRun ?? false;
  const labQualityScore = labRun?.qualityScore ?? null;

  // Get pending proposals count
  const pendingProposalsCount = input.pendingProposalsByDomain[domain] ?? 0;

  // Run domain-specific checks
  let checks: DomainCheck[] = [];
  switch (domain) {
    case 'audience':
      checks = checkAudienceDomain(input.contextGraph);
      break;
    case 'competitiveLandscape':
      checks = checkCompetitiveLandscapeDomain(input.contextGraph, labQualityScore);
      break;
    case 'brand':
      checks = checkBrandDomain(input.contextGraph);
      break;
    case 'website':
      checks = checkWebsiteDomain(input.contextGraph);
      break;
    case 'seo':
      checks = checkSeoDomain(input.contextGraph);
      break;
    case 'media':
      checks = checkMediaDomain(input.contextGraph);
      break;
    case 'creative':
      checks = checkCreativeDomain(input.contextGraph);
      break;
  }

  // Compute status
  const status = computeDomainStatus(checks, labQualityScore, pendingProposalsCount);

  // Get requirement level
  const requirementLevel = getRequirementLevel(
    input.requiredFor,
    domain,
    pendingProposalsCount
  );

  // Generate warnings
  const warnings = generateDomainWarnings(domain, checks, labQualityScore, labHasRun);

  // Generate CTAs
  const ctas = generateDomainCTAs(
    input.companyId,
    domain,
    status,
    pendingProposalsCount,
    labHasRun
  );

  const failedChecks = checks.filter(c => !c.passed);
  const confirmedFactsCount = countConfirmedFacts(domain, checks);

  return {
    domain,
    domainLabel: config.label,
    status,
    requirementLevel,
    checks,
    failedChecks,
    warnings,
    ctas,
    primaryCTA: ctas.find(c => c.primary) ?? null,
    labSlug,
    labQualityScore,
    labHasRun,
    pendingProposalsCount,
    confirmedFactsCount,
  };
}

// ============================================================================
// Overall Score Computation
// ============================================================================

/**
 * Compute overall readiness score using weighted domain scores
 *
 * Scoring model:
 * - Required domains: weight 3
 * - Recommended domains: weight 2
 * - Optional domains: weight 1
 *
 * Status scores:
 * - ready: 1.0
 * - partial: 0.6
 * - missing: 0.0
 *
 * Penalty: If any required domain is missing, cap overall at 60
 */
export function computeOverallScore(domains: DomainReadiness[]): number {
  const weights: Record<RequirementLevel, number> = {
    required: 3,
    recommended: 2,
    optional: 1,
  };

  const statusScores: Record<ReadinessStatus, number> = {
    ready: 1.0,
    partial: 0.6,
    missing: 0.0,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  let hasRequiredMissing = false;

  for (const domain of domains) {
    const weight = weights[domain.requirementLevel];
    const statusScore = statusScores[domain.status];

    totalWeight += weight;
    weightedSum += weight * statusScore;

    if (domain.requirementLevel === 'required' && domain.status === 'missing') {
      hasRequiredMissing = true;
    }
  }

  let score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;

  // Apply penalty if any required domain is missing
  if (hasRequiredMissing) {
    score = Math.min(score, 60);
  }

  return score;
}

/**
 * Determine overall status from domain statuses
 */
function computeOverallStatus(domains: DomainReadiness[]): ReadinessStatus {
  const requiredDomains = domains.filter(d => d.requirementLevel === 'required');

  // If any required domain is missing, overall is missing
  if (requiredDomains.some(d => d.status === 'missing')) {
    return 'missing';
  }

  // If any required domain is partial, overall is partial
  if (requiredDomains.some(d => d.status === 'partial')) {
    return 'partial';
  }

  // All required domains are ready
  // Check recommended domains
  const recommendedDomains = domains.filter(d => d.requirementLevel === 'recommended');
  const recommendedMissing = recommendedDomains.filter(d => d.status === 'missing').length;

  // If more than half of recommended are missing, consider partial
  if (recommendedDomains.length > 0 && recommendedMissing > recommendedDomains.length / 2) {
    return 'partial';
  }

  return 'ready';
}

// ============================================================================
// Next Action Generation
// ============================================================================

/**
 * Generate the single next best action message and CTA
 */
function generateNextAction(domains: DomainReadiness[]): {
  message: string;
  cta: DomainReadiness['primaryCTA'];
} {
  // Priority: missing required > partial required > missing recommended > partial recommended

  // 1. Missing required domains
  const missingRequired = domains.filter(
    d => d.requirementLevel === 'required' && d.status === 'missing'
  );
  if (missingRequired.length > 0) {
    const domain = missingRequired[0];
    const domainNames = missingRequired.map(d => d.domainLabel).join(', ');
    return {
      message: `Missing required context: ${domainNames}. ${domain.primaryCTA?.label || 'Add context'}.`,
      cta: domain.primaryCTA,
    };
  }

  // 2. Partial required domains (need review)
  const partialRequired = domains.filter(
    d => d.requirementLevel === 'required' && d.status === 'partial'
  );
  if (partialRequired.length > 0) {
    const withProposals = partialRequired.filter(d => d.pendingProposalsCount > 0);
    if (withProposals.length > 0) {
      const totalProposals = withProposals.reduce((sum, d) => sum + d.pendingProposalsCount, 0);
      const domain = withProposals[0];
      return {
        message: `${totalProposals} proposal${totalProposals > 1 ? 's' : ''} need${totalProposals === 1 ? 's' : ''} review for required context.`,
        cta: domain.primaryCTA,
      };
    }
    const domain = partialRequired[0];
    return {
      message: `${domain.domainLabel} context is incomplete. ${domain.primaryCTA?.label || 'Complete context'}.`,
      cta: domain.primaryCTA,
    };
  }

  // 3. Missing recommended domains
  const missingRecommended = domains.filter(
    d => d.requirementLevel === 'recommended' && d.status === 'missing'
  );
  if (missingRecommended.length > 0) {
    const domain = missingRecommended[0];
    return {
      message: `Recommended: Add ${domain.domainLabel} context for better results.`,
      cta: domain.primaryCTA,
    };
  }

  // 4. Partial recommended domains
  const partialRecommended = domains.filter(
    d => d.requirementLevel === 'recommended' && d.status === 'partial'
  );
  if (partialRecommended.length > 0) {
    const withProposals = partialRecommended.filter(d => d.pendingProposalsCount > 0);
    if (withProposals.length > 0) {
      const domain = withProposals[0];
      return {
        message: `Review ${domain.pendingProposalsCount} ${domain.domainLabel} proposal${domain.pendingProposalsCount > 1 ? 's' : ''}.`,
        cta: domain.primaryCTA,
      };
    }
    const domain = partialRecommended[0];
    return {
      message: `Complete ${domain.domainLabel} context for better results.`,
      cta: domain.primaryCTA,
    };
  }

  // 5. All ready
  return {
    message: 'All context ready. You can proceed.',
    cta: null,
  };
}

// ============================================================================
// Main Computation Function
// ============================================================================

/**
 * Compute full readiness summary
 */
export function computeReadiness(input: ReadinessInput): ReadinessSummary {
  // Compute each domain
  const domains: DomainReadiness[] = DOMAIN_DISPLAY_ORDER.map(domain =>
    computeDomainReadiness(input, domain)
  );

  // Compute overall score and status
  const overallScore = computeOverallScore(domains);
  const overallStatus = computeOverallStatus(domains);

  // Categorize domains
  const missingRequiredDomains = domains
    .filter(d => d.requirementLevel === 'required' && d.status === 'missing')
    .map(d => d.domain);
  const partialDomains = domains
    .filter(d => d.status === 'partial')
    .map(d => d.domain);
  const readyDomains = domains
    .filter(d => d.status === 'ready')
    .map(d => d.domain);

  // Generate next action
  const { message: nextAction, cta: nextActionCTA } = generateNextAction(domains);

  return {
    companyId: input.companyId,
    requiredFor: input.requiredFor,
    overallScore,
    overallStatus,
    domains,
    missingRequiredDomains,
    partialDomains,
    readyDomains,
    nextAction,
    nextActionCTA,
    computedAt: new Date().toISOString(),
  };
}
