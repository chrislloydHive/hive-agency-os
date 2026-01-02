// lib/audience/demographicProposals.ts
// Demographic Overlay Proposal Generator for Context Graph V4
//
// DOCTRINE: Demographics are overlays, not facts.
// - All demographic overlays go through Review Queue
// - They are NEVER auto-confirmed
// - They are clearly labeled "Inferred – requires confirmation"
// - They must not pollute core Context facts

// Generate simple unique IDs without external dependency
function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}
import type { ContextProposal, ContextProposalBatch } from '@/lib/contextGraph/nodes/types';
import type { DemographicOverlay } from './demographicOverlays';

// ============================================================================
// Types
// ============================================================================

/**
 * Demographic proposal trigger type
 */
export const DEMOGRAPHIC_PROPOSAL_TRIGGER = 'lab_inference' as const;

/**
 * Field path for demographic overlays in Context Graph
 * These go to a separate path that requires explicit confirmation
 */
export const DEMOGRAPHIC_OVERLAY_FIELD_PATH = 'audience.segmentDemographicOverlays';

/**
 * Options for generating demographic proposals
 */
export interface GenerateDemographicProposalsOptions {
  companyId: string;
  labRunId?: string;
  createdBy?: string;
}

/**
 * Result of generating demographic proposals
 */
export interface GenerateDemographicProposalsResult {
  success: boolean;
  proposals: ContextProposal[];
  skippedCount: number;
  /** Summary message */
  summary: string;
}

// ============================================================================
// Proposal Generation
// ============================================================================

/**
 * Generate Context Graph proposals from demographic overlays
 *
 * CRITICAL CONSTRAINTS:
 * - Proposals are marked with low confidence (matching overlay confidence)
 * - Proposals include clear "inferred" labeling
 * - Proposals must be explicitly confirmed by human review
 * - No auto-confirmation allowed
 *
 * @param overlays - Demographic overlays from the Audience Lab
 * @param options - Generation options
 */
export function generateDemographicProposals(
  overlays: DemographicOverlay[],
  options: GenerateDemographicProposalsOptions
): GenerateDemographicProposalsResult {
  const { companyId, labRunId } = options;
  const proposals: ContextProposal[] = [];
  let skippedCount = 0;

  for (const overlay of overlays) {
    // Validate overlay has required data
    if (!overlay.appliesToSegmentKey || !overlay.inferredAttributes) {
      skippedCount++;
      continue;
    }

    // Check if any attributes are actually set
    const attrs = overlay.inferredAttributes;
    const hasAttributes = attrs.ageRange || attrs.incomeTier || attrs.householdType ||
      attrs.genderSkew || attrs.lifestyleContext;

    if (!hasAttributes) {
      skippedCount++;
      continue;
    }

    // Build the proposal
    const proposal: ContextProposal = {
      id: `prop_demo_${generateId()}`,
      companyId,
      fieldPath: `${DEMOGRAPHIC_OVERLAY_FIELD_PATH}.${overlay.appliesToSegmentKey}`,
      fieldLabel: `Demographic Overlay for Segment`,
      proposedValue: overlay,
      currentValue: null,
      reasoning: buildDemographicReasoning(overlay),
      confidence: overlay.confidence / 100, // Convert 0-70 to 0-0.7
      trigger: DEMOGRAPHIC_PROPOSAL_TRIGGER,
      triggerSource: labRunId ? `audienceLab:${labRunId}` : 'audienceLab',
      status: 'pending',
      createdAt: new Date().toISOString(),

      // V4 Convergence metadata
      decisionImpact: 'LOW', // Demographics are secondary to behavioral data
      specificityScore: overlay.confidence, // Use overlay confidence as specificity
      genericnessReasons: buildGenericnessReasons(overlay),
      hiddenByDefault: true, // Hidden by default until confirmed
      fieldCategory: 'tactical', // Not core positioning

      // V4 Evidence grounding
      evidenceAnchors: overlay.evidence.map(e => ({
        quote: e.snippet,
        source: e.sourceUrl || 'behavioral_analysis',
        pageTitle: `Evidence type: ${e.type}`,
        confidence: overlay.confidence / 100,
      })),
      isUngrounded: overlay.evidence.length === 0,
    };

    proposals.push(proposal);
  }

  const summary = proposals.length > 0
    ? `Generated ${proposals.length} demographic overlay proposal(s) for review. ${skippedCount > 0 ? `${skippedCount} skipped (insufficient data).` : ''}`
    : `No demographic proposals generated. ${skippedCount > 0 ? `${skippedCount} overlays skipped (insufficient data).` : 'No overlays provided.'}`;

  console.log('[DemographicProposals]', summary);

  return {
    success: true,
    proposals,
    skippedCount,
    summary,
  };
}

/**
 * Build reasoning text for a demographic overlay proposal
 */
function buildDemographicReasoning(overlay: DemographicOverlay): string {
  const parts: string[] = [
    `⚠️ INFERRED DEMOGRAPHIC OVERLAY – Requires human confirmation`,
    '',
    `Confidence: ${overlay.confidence}% (capped at 70% per guardrail policy)`,
    '',
    overlay.rationale,
  ];

  // Add evidence summary
  if (overlay.evidence.length > 0) {
    parts.push('');
    parts.push('Evidence:');
    for (const e of overlay.evidence.slice(0, 3)) {
      parts.push(`• [${e.type}] ${e.snippet}`);
    }
    if (overlay.evidence.length > 3) {
      parts.push(`• ... and ${overlay.evidence.length - 3} more`);
    }
  }

  return parts.join('\n');
}

/**
 * Build genericness reasons for a demographic overlay
 */
function buildGenericnessReasons(overlay: DemographicOverlay): string[] {
  const reasons: string[] = [];

  // Check for industry norm reliance
  const hasIndustryNorm = overlay.evidence.some(e => e.type === 'industry_norm');
  if (hasIndustryNorm) {
    reasons.push('Relies on industry norms rather than company-specific signals');
  }

  // Low confidence indicates potential genericness
  if (overlay.confidence <= 50) {
    reasons.push('Low confidence (≤50%) suggests limited behavioral evidence');
  }

  // Check for broad attributes
  const attrs = overlay.inferredAttributes;
  if (attrs.ageRange && attrs.ageRange.includes('-54')) {
    reasons.push('Age range spans broad demographic (25-54)');
  }
  if (attrs.incomeTier && attrs.incomeTier.includes('mid to upper')) {
    reasons.push('Income tier is broad range');
  }

  return reasons;
}

/**
 * Create a proposal batch from demographic proposals
 */
export function createDemographicProposalBatch(
  proposals: ContextProposal[],
  companyId: string,
  labRunId?: string
): ContextProposalBatch {
  return {
    id: `batch_demo_${generateId()}`,
    companyId,
    proposals,
    trigger: DEMOGRAPHIC_PROPOSAL_TRIGGER,
    triggerSource: labRunId ? `audienceLab:${labRunId}` : 'audienceLab',
    batchReasoning: 'Demographic overlays inferred from behavioral segment analysis. These are low-confidence inferences that require human confirmation.',
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
}

// ============================================================================
// Review Queue Display Helpers
// ============================================================================

/**
 * Format a demographic proposal for Review Queue display
 */
export function formatDemographicProposalForReview(proposal: ContextProposal): {
  title: string;
  badge: string;
  warningText: string;
  attributes: Array<{ label: string; value: string }>;
  canAutoApprove: false; // Never auto-approve demographics
} {
  const overlay = proposal.proposedValue as DemographicOverlay;
  const attrs = overlay.inferredAttributes;

  const attributes: Array<{ label: string; value: string }> = [];
  if (attrs.ageRange) attributes.push({ label: 'Age Range', value: attrs.ageRange });
  if (attrs.incomeTier) attributes.push({ label: 'Income Tier', value: attrs.incomeTier });
  if (attrs.householdType) attributes.push({ label: 'Household Type', value: attrs.householdType });
  if (attrs.genderSkew) attributes.push({ label: 'Gender Skew', value: attrs.genderSkew });
  if (attrs.lifestyleContext) attributes.push({ label: 'Lifestyle', value: attrs.lifestyleContext });

  return {
    title: `Demographic Overlay: ${overlay.appliesToSegmentKey}`,
    badge: 'INFERRED',
    warningText: 'Inferred demographic overlay — review before use. Not a confirmed fact.',
    attributes,
    canAutoApprove: false, // CRITICAL: Never auto-approve
  };
}

/**
 * Check if a proposal is a demographic overlay proposal
 */
export function isDemographicOverlayProposal(proposal: ContextProposal): boolean {
  return proposal.fieldPath.startsWith(DEMOGRAPHIC_OVERLAY_FIELD_PATH);
}
