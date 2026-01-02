// lib/contextGraph/v5/types.ts
// V5 Website Lab Context Graph integration types

import type { V5BlockingIssue, V5PersonaJourney, V5StructuralChange } from '@/lib/gap-heavy/modules/websiteLabV5';

// ============================================================================
// V5 Context Node Types
// ============================================================================

/**
 * Node types that can be proposed to the Context Graph from V5 results
 */
export type V5ContextNodeType =
  | 'site_conversion_blocker'     // From blocking issues
  | 'persona_conversion_failure'  // From repeated persona failures
  | 'site_structure_opportunity'; // From structural changes (proposed only)

/**
 * Persona type for V5
 */
export type V5PersonaType = 'first_time' | 'ready_to_buy' | 'comparison_shopper';

/**
 * Human-readable persona labels
 */
export const PERSONA_LABELS: Record<V5PersonaType, string> = {
  first_time: 'First-Time Visitor',
  ready_to_buy: 'Ready to Buy',
  comparison_shopper: 'Comparison Shopper',
};

// ============================================================================
// V5 Context Proposal
// ============================================================================

/**
 * Provenance metadata required for all V5 context proposals
 */
export interface V5Provenance {
  /** Always 'WebsiteLabV5' */
  source: 'WebsiteLabV5';

  /** Diagnostic run ID */
  runId: string;

  /** Pages referenced in this proposal */
  pagesReferenced: string[];

  /** Personas impacted */
  personasImpacted: V5PersonaType[];

  /** Confidence score (0-1) */
  confidence: number;

  /** Human review status */
  humanReviewStatus: 'pending' | 'approved' | 'rejected';
}

/**
 * V5 Context Proposal - proposed to Context Graph
 */
export interface V5ContextProposal {
  /** Unique proposal ID */
  id: string;

  /** Company ID */
  companyId: string;

  /** Node type */
  type: V5ContextNodeType;

  /** Domain (always Website for V5) */
  domain: 'Website';

  /** Primary page path affected */
  pagePath: string;

  /** Personas affected */
  personasAffected: V5PersonaType[];

  /** Problem statement */
  problem: string;

  /** Concrete fix (for blockers) */
  concreteFix?: string;

  /** Provenance metadata */
  provenance: V5Provenance;

  /** Status */
  status: 'proposed' | 'confirmed' | 'rejected';

  /** Created timestamp */
  createdAt: string;

  /** Resolved timestamp */
  resolvedAt?: string;

  /** Resolved by (user ID) */
  resolvedBy?: string;
}

// ============================================================================
// V5 Verdict Types
// ============================================================================

/**
 * V5 Executive verdict
 */
export type V5Verdict = 'STRONG' | 'MIXED' | 'WEAK';

/**
 * Derive verdict from score
 */
export function deriveVerdict(score: number): V5Verdict {
  if (score >= 70) return 'STRONG';
  if (score >= 50) return 'MIXED';
  return 'WEAK';
}

/**
 * Verdict styling
 */
export const VERDICT_STYLES: Record<V5Verdict, { bg: string; text: string; border: string }> = {
  STRONG: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  MIXED: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  WEAK: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

// ============================================================================
// V5 Ingestion Eligibility
// ============================================================================

/**
 * Result of checking if a blocking issue is eligible for ingestion
 */
export interface BlockingIssueEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Result of checking persona failure aggregation eligibility
 */
export interface PersonaFailureAggregation {
  eligible: boolean;
  persona: V5PersonaType;
  page: string;
  reason: string;
  occurrenceCount: number;
  runIds: string[];
}

/**
 * Deduplication match result
 */
export interface DedupeMatchResult {
  isMatch: boolean;
  similarity: number;
  existingNodeId?: string;
  action: 'skip' | 'attach_evidence' | 'create_new';
}

// ============================================================================
// V5 Executive Summary Types
// ============================================================================

/**
 * Data for V5 Executive Header
 */
export interface V5ExecutiveSummary {
  score: number;
  verdict: V5Verdict;
  justification: string;
  personasAffected: V5PersonaType[];
  pagesAffected: string[];
}

/**
 * Build executive summary from V5 diagnostic data
 */
export function buildExecutiveSummary(
  score: number,
  blockingIssues: V5BlockingIssue[],
  personaJourneys: V5PersonaJourney[]
): V5ExecutiveSummary {
  const verdict = deriveVerdict(score);

  // Collect affected personas and pages from blocking issues
  const personasSet = new Set<V5PersonaType>();
  const pagesSet = new Set<string>();

  for (const issue of blockingIssues) {
    issue.affectedPersonas.forEach((p) => personasSet.add(p));
    pagesSet.add(issue.page);
  }

  // Also include failed journey personas
  for (const journey of personaJourneys) {
    if (!journey.succeeded && journey.failurePoint) {
      personasSet.add(journey.persona);
      pagesSet.add(journey.failurePoint.page);
    }
  }

  const personasAffected = Array.from(personasSet);
  const pagesAffected = Array.from(pagesSet);

  // Build justification from top blocking issues and persona failures
  const justification = buildJustification(blockingIssues, personaJourneys, personasAffected, pagesAffected);

  return {
    score,
    verdict,
    justification,
    personasAffected,
    pagesAffected,
  };
}

/**
 * Build 1-2 sentence justification from blocking issues and persona failures
 */
function buildJustification(
  blockingIssues: V5BlockingIssue[],
  personaJourneys: V5PersonaJourney[],
  personas: V5PersonaType[],
  pages: string[]
): string {
  if (blockingIssues.length === 0 && personaJourneys.every((j) => j.succeeded)) {
    return 'Site performs well across all personas with no critical blocking issues identified.';
  }

  const failedJourneys = personaJourneys.filter((j) => !j.succeeded);
  const topIssue = blockingIssues[0];

  // Format persona names
  const personaNames = personas.map((p) => PERSONA_LABELS[p]).slice(0, 3);
  const personaText =
    personaNames.length === 1
      ? personaNames[0]
      : personaNames.length === 2
        ? `${personaNames[0]} and ${personaNames[1]}`
        : `${personaNames[0]}, ${personaNames[1]}, and ${personaNames[2]}`;

  // Format page paths
  const pageText = pages.length === 1 ? pages[0] : pages.slice(0, 2).join(' and ');

  if (failedJourneys.length > 0 && topIssue) {
    return `${personaText} ${failedJourneys.length > 1 ? 'fail' : 'fails'} on ${pageText} due to ${topIssue.whyItBlocks.toLowerCase()}.`;
  }

  if (topIssue) {
    return `Primary blocker on ${topIssue.page}: ${topIssue.whyItBlocks}`;
  }

  return `${failedJourneys.length} persona ${failedJourneys.length === 1 ? 'journey' : 'journeys'} incomplete due to conversion friction.`;
}
