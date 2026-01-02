// lib/contextGraph/v5/ingestionGuards.ts
// V5 Website Lab Context Graph ingestion guards
//
// Principle: V5 is precise — but not everything belongs in the Context Graph.
// These guards ensure only high-quality, specific, actionable findings are proposed.

import type {
  V5BlockingIssue,
  V5PersonaJourney,
  V5StructuralChange,
  V5QuickWin,
  V5PageObservation,
} from '@/lib/gap-heavy/modules/websiteLabV5';
import type {
  V5PersonaType,
  BlockingIssueEligibility,
  PersonaFailureAggregation,
  V5ContextProposal,
  V5Provenance,
} from './types';

// ============================================================================
// HARD STOPS - Never Ingest
// ============================================================================

/**
 * Items that should NEVER be proposed to the Context Graph
 */
export const HARD_STOPS = {
  pageObservations: true,    // Evidence only
  quickWins: true,           // Execution-level
  v5Score: true,             // Derived metric
  genericUxStatements: true, // Vague language
  aestheticOpinions: true,   // Subjective
  singleRunObservations: true, // Need repeated signals
  noPagePath: true,          // Must be anchored to specific page
} as const;

/**
 * Generic phrases that should trigger rejection
 */
const GENERIC_PHRASES = [
  'improve ux',
  'strengthen funnel',
  'enhance user experience',
  'optimize conversion',
  'better engagement',
  'increase trust',
  'improve clarity',
  'enhance navigation',
];

/**
 * Check if text contains generic phrases
 */
export function containsGenericPhrases(text: string): boolean {
  const lower = text.toLowerCase();
  return GENERIC_PHRASES.some((phrase) => lower.includes(phrase));
}

// ============================================================================
// BLOCKING ISSUE GUARDS
// ============================================================================

/**
 * Check if a blocking issue is eligible for Context Graph ingestion
 *
 * Eligible if ALL true:
 * - Has explicit page path
 * - Has concrete fix (non-generic)
 * - Affects ≥1 persona
 * - Severity ≥ "High"
 * - Not already present (dedupe handled separately)
 */
export function checkBlockingIssueEligibility(
  issue: V5BlockingIssue
): BlockingIssueEligibility {
  const reasons: string[] = [];

  // Must have page path
  if (!issue.page || issue.page.trim() === '') {
    reasons.push('Missing page path - cannot anchor to specific location');
  }

  // Must have concrete fix
  if (!issue.concreteFix?.what || issue.concreteFix.what.trim() === '') {
    reasons.push('Missing concrete fix - no actionable recommendation');
  } else if (containsGenericPhrases(issue.concreteFix.what)) {
    reasons.push('Fix contains generic phrases - not specific enough');
  }

  // Must affect at least one persona
  if (!issue.affectedPersonas || issue.affectedPersonas.length === 0) {
    reasons.push('No affected personas specified');
  }

  // Must be high severity
  if (issue.severity !== 'high') {
    reasons.push(`Severity is "${issue.severity}" - only "high" severity issues are ingested`);
  }

  // Check if "why it blocks" is generic
  if (containsGenericPhrases(issue.whyItBlocks)) {
    reasons.push('Problem description contains generic phrases');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Filter blocking issues to only those eligible for ingestion
 */
export function filterEligibleBlockingIssues(
  issues: V5BlockingIssue[]
): { eligible: V5BlockingIssue[]; rejected: Array<{ issue: V5BlockingIssue; reasons: string[] }> } {
  const eligible: V5BlockingIssue[] = [];
  const rejected: Array<{ issue: V5BlockingIssue; reasons: string[] }> = [];

  for (const issue of issues) {
    const result = checkBlockingIssueEligibility(issue);
    if (result.eligible) {
      eligible.push(issue);
    } else {
      rejected.push({ issue, reasons: result.reasons });
    }
  }

  return { eligible, rejected };
}

// ============================================================================
// PERSONA FAILURE AGGREGATION GUARDS
// ============================================================================

/**
 * Check for repeated persona failures across multiple runs
 *
 * Individual failures: ❌ Never ingest
 * Repeated failures: ✅ May propose if:
 * - Same persona
 * - Same page
 * - Same failure reason (similarity match)
 * - Across ≥2 diagnostics
 */
export function aggregatePersonaFailures(
  historicalJourneys: Array<{
    runId: string;
    journeys: V5PersonaJourney[];
  }>
): PersonaFailureAggregation[] {
  // Build failure signature map: "persona::page::reason" → occurrences
  const failureMap = new Map<
    string,
    {
      persona: V5PersonaType;
      page: string;
      reason: string;
      runIds: Set<string>;
    }
  >();

  for (const { runId, journeys } of historicalJourneys) {
    for (const journey of journeys) {
      if (!journey.succeeded && journey.failurePoint) {
        const key = `${journey.persona}::${journey.failurePoint.page}::${normalizeReason(journey.failurePoint.reason)}`;

        if (!failureMap.has(key)) {
          failureMap.set(key, {
            persona: journey.persona,
            page: journey.failurePoint.page,
            reason: journey.failurePoint.reason,
            runIds: new Set(),
          });
        }

        failureMap.get(key)!.runIds.add(runId);
      }
    }
  }

  // Filter to only repeated failures (≥2 runs)
  const aggregations: PersonaFailureAggregation[] = [];

  for (const [, data] of failureMap) {
    const occurrenceCount = data.runIds.size;
    aggregations.push({
      eligible: occurrenceCount >= 2,
      persona: data.persona,
      page: data.page,
      reason: data.reason,
      occurrenceCount,
      runIds: Array.from(data.runIds),
    });
  }

  return aggregations;
}

/**
 * Normalize failure reason for comparison
 */
function normalizeReason(reason: string): string {
  return reason
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

// ============================================================================
// STRUCTURAL CHANGE GUARDS
// ============================================================================

/**
 * Structural changes are NEVER auto-ingested.
 * They are always:
 * - Proposed as "Strategic Opportunity"
 * - Confidence capped at 60%
 * - Require explicit human confirmation
 * - Status: proposed only
 */
export const STRUCTURAL_CHANGE_RULES = {
  autoIngest: false,
  confidenceCap: 0.6,
  requiresHumanReview: true,
  nodeType: 'site_structure_opportunity' as const,
  defaultStatus: 'proposed' as const,
} as const;

/**
 * Check if a structural change can be proposed (not auto-ingested)
 */
export function checkStructuralChangeEligibility(
  change: V5StructuralChange
): { canPropose: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Must have pages affected
  if (!change.pagesAffected || change.pagesAffected.length === 0) {
    reasons.push('No pages affected specified');
  }

  // Must have description
  if (!change.description || change.description.trim() === '') {
    reasons.push('Missing description');
  }

  // Must have rationale
  if (!change.rationale || change.rationale.trim() === '') {
    reasons.push('Missing rationale');
  }

  // Check for generic language
  if (containsGenericPhrases(change.description)) {
    reasons.push('Description contains generic phrases');
  }

  return {
    canPropose: reasons.length === 0,
    reasons,
  };
}

// ============================================================================
// PROPOSAL BUILDERS
// ============================================================================

/**
 * Build a context proposal from a blocking issue
 */
export function buildBlockingIssueProposal(
  issue: V5BlockingIssue,
  companyId: string,
  runId: string
): V5ContextProposal | null {
  const eligibility = checkBlockingIssueEligibility(issue);
  if (!eligibility.eligible) {
    return null;
  }

  const provenance: V5Provenance = {
    source: 'WebsiteLabV5',
    runId,
    pagesReferenced: [issue.page],
    personasImpacted: issue.affectedPersonas,
    confidence: mapSeverityToConfidence(issue.severity),
    humanReviewStatus: 'pending',
  };

  return {
    id: `v5-blocker-${runId}-${issue.id}`,
    companyId,
    type: 'site_conversion_blocker',
    domain: 'Website',
    pagePath: issue.page,
    personasAffected: issue.affectedPersonas,
    problem: issue.whyItBlocks,
    concreteFix: `${issue.concreteFix.what} (on ${issue.concreteFix.where})`,
    provenance,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a context proposal from aggregated persona failures
 */
export function buildPersonaFailureProposal(
  aggregation: PersonaFailureAggregation,
  companyId: string
): V5ContextProposal | null {
  if (!aggregation.eligible) {
    return null;
  }

  const latestRunId = aggregation.runIds[aggregation.runIds.length - 1];

  const provenance: V5Provenance = {
    source: 'WebsiteLabV5',
    runId: latestRunId,
    pagesReferenced: [aggregation.page],
    personasImpacted: [aggregation.persona],
    confidence: Math.min(0.7 + aggregation.occurrenceCount * 0.05, 0.85), // 70-85%
    humanReviewStatus: 'pending',
  };

  return {
    id: `v5-persona-failure-${aggregation.persona}-${normalizeReason(aggregation.reason).slice(0, 20)}`,
    companyId,
    type: 'persona_conversion_failure',
    domain: 'Website',
    pagePath: aggregation.page,
    personasAffected: [aggregation.persona],
    problem: `${aggregation.persona.replace('_', ' ')} users consistently fail on ${aggregation.page}: ${aggregation.reason}`,
    provenance,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a structural opportunity proposal (always requires human review)
 */
export function buildStructuralOpportunityProposal(
  change: V5StructuralChange,
  companyId: string,
  runId: string
): V5ContextProposal | null {
  const eligibility = checkStructuralChangeEligibility(change);
  if (!eligibility.canPropose) {
    return null;
  }

  const provenance: V5Provenance = {
    source: 'WebsiteLabV5',
    runId,
    pagesReferenced: change.pagesAffected,
    personasImpacted: [], // Structural changes affect all personas
    confidence: STRUCTURAL_CHANGE_RULES.confidenceCap, // Always capped at 60%
    humanReviewStatus: 'pending',
  };

  return {
    id: `v5-structural-${runId}-${change.title.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`,
    companyId,
    type: 'site_structure_opportunity',
    domain: 'Website',
    pagePath: change.pagesAffected[0] || '/',
    personasAffected: ['first_time', 'ready_to_buy', 'comparison_shopper'], // Affects all
    problem: change.description,
    concreteFix: change.rationale,
    provenance,
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map severity to confidence score
 */
function mapSeverityToConfidence(severity: 'high' | 'medium' | 'low'): number {
  switch (severity) {
    case 'high':
      return 0.85;
    case 'medium':
      return 0.75;
    case 'low':
      return 0.65;
  }
}

/**
 * Check if a single-run observation should be blocked
 */
export function shouldBlockSingleRunObservation(): true {
  // Always block - single run observations are never ingested
  return true;
}

/**
 * Check if an item lacks a page path (hard stop)
 */
export function lacksPagePath(pagePath: string | undefined | null): boolean {
  return !pagePath || pagePath.trim() === '';
}
