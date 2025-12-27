// lib/os/ui/deliverUiState.ts
// Deliver Page UI State Selector
//
// Single source of truth for Deliver page state derivation.
// Maps raw API data → discrete UI state → visibility rules.

import type { V4HealthResponse } from '@/lib/types/contextV4Health';
import type { Artifact, ArtifactType } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the Deliver experience
 */
export type DeliverState =
  | 'blocked_no_labs'         // Labs haven't run → block creating
  | 'blocked_not_decided'     // Labs run but Decide not complete
  | 'ready_no_deliverables'   // Ready but no deliverables created yet
  | 'ready_up_to_date'        // Has deliverables, all current
  | 'ready_updates_available'; // Has deliverables, some stale

/**
 * Banner tone for the current state
 */
export type BannerTone = 'blocked' | 'ready' | 'warning' | 'status';

/**
 * Banner configuration
 */
export interface DeliverBanner {
  tone: BannerTone;
  title: string;
  body: string;
}

/**
 * CTA configuration for the current state
 */
export interface DeliverCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/**
 * Updates help section visibility
 */
export type UpdatesHelpVisibility = 'hidden' | 'collapsed' | 'expanded';

/**
 * Preferred primary deliverable type
 */
export type PreferredPrimary = 'rfp_response_doc' | 'strategy_doc' | null;

/**
 * Staleness summary
 */
export interface StaleSummary {
  hasAnyStale: boolean;
  hasStaleUpdatableDoc: boolean;
  staleCount: number;
  staleUpdatableArtifact: Artifact | null;
}

/**
 * Debug info for development
 */
export interface DeliverDebugInfo {
  hasLabs: boolean;
  inputsConfirmed: boolean;
  strategyFramed: boolean;
  decideComplete: boolean;
  hasAnyDeliverables: boolean;
}

/**
 * Full UI state derived from data
 */
export interface DeliverUIState {
  state: DeliverState;
  banner: DeliverBanner;
  showPrimaryDeliverables: boolean;
  showArtifactsList: boolean;
  showUpdatesHelp: UpdatesHelpVisibility;
  primaryCTA: DeliverCTA;
  secondaryCTA: DeliverCTA | null;
  preferredPrimary: PreferredPrimary;
  staleSummary: StaleSummary;
  debug: DeliverDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface DeliverDataInput {
  contextHealth: V4HealthResponse | null;
  strategyId: string | null;
  artifacts: Artifact[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum confirmed fields to consider "inputs confirmed"
 * Must match the threshold used in Decide
 */
const INPUTS_CONFIRMED_THRESHOLD = 3;

/**
 * Deliverable artifact types (primary outputs)
 */
const DELIVERABLE_TYPES: ArtifactType[] = [
  'strategy_doc',
  'rfp_response_doc',
  'proposal_slides',
  'pricing_sheet',
];

/**
 * Artifact types that support "Insert Updates" action
 */
const UPDATABLE_TYPES: ArtifactType[] = [
  'rfp_response_doc',
  'strategy_doc',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if artifacts include any deliverable types
 */
function hasDeliverables(artifacts: Artifact[]): boolean {
  return artifacts.some(
    (a) => a.status !== 'archived' && DELIVERABLE_TYPES.includes(a.type)
  );
}

/**
 * Get staleness summary from artifacts
 */
function getStaleSummary(artifacts: Artifact[]): StaleSummary {
  const activeArtifacts = artifacts.filter((a) => a.status !== 'archived');
  const staleArtifacts = activeArtifacts.filter((a) => a.isStale);
  const staleUpdatable = staleArtifacts.find((a) =>
    UPDATABLE_TYPES.includes(a.type)
  );

  return {
    hasAnyStale: staleArtifacts.length > 0,
    hasStaleUpdatableDoc: !!staleUpdatable,
    staleCount: staleArtifacts.length,
    staleUpdatableArtifact: staleUpdatable || null,
  };
}

/**
 * Determine preferred primary deliverable
 * Priority: rfp_response_doc > strategy_doc > null
 */
function getPreferredPrimary(artifacts: Artifact[]): PreferredPrimary {
  const activeArtifacts = artifacts.filter((a) => a.status !== 'archived');

  // Check for RFP doc first
  const hasRfp = activeArtifacts.some((a) => a.type === 'rfp_response_doc');
  if (hasRfp) return 'rfp_response_doc';

  // Check for strategy doc
  const hasStrategyDoc = activeArtifacts.some((a) => a.type === 'strategy_doc');
  if (hasStrategyDoc) return 'strategy_doc';

  return null;
}

/**
 * Find artifact by type
 */
function findArtifactByType(
  artifacts: Artifact[],
  type: ArtifactType
): Artifact | null {
  return (
    artifacts.find((a) => a.type === type && a.status !== 'archived') || null
  );
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete DeliverState from raw data
 */
export function deriveDeliverState(input: DeliverDataInput): DeliverState {
  const { contextHealth, strategyId, artifacts } = input;

  // Check gating conditions
  const hasLabs = contextHealth?.websiteLab?.hasRun ?? false;
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const inputsConfirmed = confirmedCount >= INPUTS_CONFIRMED_THRESHOLD;
  const strategyFramed = !!strategyId;
  const decideComplete = inputsConfirmed && strategyFramed;

  // State resolution (exact order matters)
  if (!hasLabs) {
    return 'blocked_no_labs';
  }

  if (!decideComplete) {
    return 'blocked_not_decided';
  }

  // At this point, Decide is complete
  const hasAnyDeliverables = hasDeliverables(artifacts);

  if (!hasAnyDeliverables) {
    return 'ready_no_deliverables';
  }

  // Has deliverables - check staleness
  const staleSummary = getStaleSummary(artifacts);

  if (staleSummary.hasAnyStale) {
    return 'ready_updates_available';
  }

  return 'ready_up_to_date';
}

// ============================================================================
// Banner Configuration
// ============================================================================

/**
 * Get banner configuration for a state
 */
function getBanner(
  state: DeliverState,
  input: DeliverDataInput
): DeliverBanner {
  const { contextHealth, strategyId } = input;
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const hasStrategy = !!strategyId;

  switch (state) {
    case 'blocked_no_labs':
      return {
        tone: 'blocked',
        title: 'Run labs first',
        body: 'Extract context by running labs in Discover before creating deliverables.',
      };

    case 'blocked_not_decided':
      if (!hasStrategy && confirmedCount < INPUTS_CONFIRMED_THRESHOLD) {
        return {
          tone: 'blocked',
          title: 'Complete Decide phase first',
          body: 'Confirm context fields and generate strategy before creating deliverables.',
        };
      }
      if (!hasStrategy) {
        return {
          tone: 'blocked',
          title: 'Generate strategy first',
          body: 'Generate a strategy from your confirmed context before creating deliverables.',
        };
      }
      return {
        tone: 'blocked',
        title: 'Confirm more inputs',
        body: `Confirm at least ${INPUTS_CONFIRMED_THRESHOLD} context fields before creating deliverables.`,
      };

    case 'ready_no_deliverables':
      return {
        tone: 'ready',
        title: 'Ready to create deliverables',
        body: 'Your context is confirmed and strategy is generated. Create plans or generate artifacts from your confirmed strategy.',
      };

    case 'ready_up_to_date':
      return {
        tone: 'status',
        title: 'Deliverables up to date',
        body: 'All deliverables are aligned with your current strategy.',
      };

    case 'ready_updates_available':
      return {
        tone: 'warning',
        title: 'Updates available',
        body: 'Context or strategy has changed. Some deliverables may be out of date.',
      };
  }
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 */
function getPrimaryCTA(
  state: DeliverState,
  companyId: string,
  preferredPrimary: PreferredPrimary,
  staleSummary: StaleSummary,
  artifacts: Artifact[]
): DeliverCTA {
  switch (state) {
    case 'blocked_no_labs':
      return {
        label: 'Go to Discover',
        href: `/c/${companyId}/diagnostics`,
        variant: 'primary',
      };

    case 'blocked_not_decided':
      return {
        label: 'Go to Decide',
        href: `/c/${companyId}/decide`,
        variant: 'primary',
      };

    case 'ready_no_deliverables':
      return {
        label: 'View Artifacts',
        href: `/c/${companyId}/deliver/artifacts`,
        variant: 'primary',
      };

    case 'ready_up_to_date': {
      // Open the preferred primary deliverable
      const primaryArtifact = preferredPrimary
        ? findArtifactByType(artifacts, preferredPrimary)
        : null;

      if (primaryArtifact?.googleFileUrl) {
        return {
          label: 'Open Primary Deliverable',
          href: primaryArtifact.googleFileUrl,
          variant: 'primary',
        };
      }

      // Fallback to documents page
      return {
        label: 'View Deliverables',
        href: `/c/${companyId}/documents`,
        variant: 'primary',
      };
    }

    case 'ready_updates_available': {
      // If there's a stale updatable doc, offer Insert Updates
      if (staleSummary.hasStaleUpdatableDoc && staleSummary.staleUpdatableArtifact) {
        const artifact = staleSummary.staleUpdatableArtifact;
        const updateRoute =
          artifact.type === 'rfp_response_doc'
            ? `/c/${companyId}/rfp/${artifact.id}/update`
            : `/c/${companyId}/strategy/update`;

        return {
          label: 'Insert Updates',
          href: updateRoute,
          variant: 'primary',
        };
      }

      // No updatable stale doc - fall back to Open
      const primaryArtifact = preferredPrimary
        ? findArtifactByType(artifacts, preferredPrimary)
        : null;

      if (primaryArtifact?.googleFileUrl) {
        return {
          label: 'Open Primary Deliverable',
          href: primaryArtifact.googleFileUrl,
          variant: 'primary',
        };
      }

      return {
        label: 'View Deliverables',
        href: `/c/${companyId}/documents`,
        variant: 'primary',
      };
    }
  }
}

/**
 * Get optional secondary CTA
 */
function getSecondaryCTA(
  state: DeliverState,
  companyId: string,
  preferredPrimary: PreferredPrimary,
  artifacts: Artifact[]
): DeliverCTA | null {
  // Show "Create a Plan" secondary CTA when ready with no deliverables
  if (state === 'ready_no_deliverables') {
    return {
      label: 'Create a Plan',
      href: '#plans', // Anchor scroll to plans section
      variant: 'secondary',
    };
  }

  // Only show secondary CTA in ready states with deliverables
  if (
    state !== 'ready_up_to_date' &&
    state !== 'ready_updates_available'
  ) {
    return null;
  }

  // If primary CTA is Insert Updates, offer View Deliverables
  if (state === 'ready_updates_available') {
    return {
      label: 'View All Deliverables',
      href: `/c/${companyId}/documents`,
      variant: 'secondary',
    };
  }

  // If we have a primary artifact with URL, offer create another
  const hasRfp = artifacts.some(
    (a) => a.type === 'rfp_response_doc' && a.status !== 'archived'
  );

  if (!hasRfp && preferredPrimary === 'strategy_doc') {
    return {
      label: 'Create RFP Response',
      href: `/c/${companyId}/rfp/new`,
      variant: 'secondary',
    };
  }

  return null;
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Deliver UI state from raw data
 *
 * This is the single source of truth for all Deliver page UI decisions.
 * All conditional rendering should flow from this selector.
 *
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getDeliverUIState(
  input: DeliverDataInput,
  companyId: string
): DeliverUIState {
  const { contextHealth, strategyId, artifacts } = input;

  // Derive state
  const state = deriveDeliverState(input);

  // Compute intermediate values
  const staleSummary = getStaleSummary(artifacts);
  const preferredPrimary = getPreferredPrimary(artifacts);

  // Compute gating flags for debug
  const hasLabs = contextHealth?.websiteLab?.hasRun ?? false;
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const inputsConfirmed = confirmedCount >= INPUTS_CONFIRMED_THRESHOLD;
  const strategyFramed = !!strategyId;
  const decideComplete = inputsConfirmed && strategyFramed;
  const hasAnyDeliverables = hasDeliverables(artifacts);

  // Get banner and CTAs
  const banner = getBanner(state, input);
  const primaryCTA = getPrimaryCTA(
    state,
    companyId,
    preferredPrimary,
    staleSummary,
    artifacts
  );
  const secondaryCTA = getSecondaryCTA(
    state,
    companyId,
    preferredPrimary,
    artifacts
  );

  // Visibility rules from matrix
  const isBlocked = state === 'blocked_no_labs' || state === 'blocked_not_decided';
  const isReady = !isBlocked;

  // showPrimaryDeliverables: hidden in blocked states
  const showPrimaryDeliverables = isReady;

  // showArtifactsList: view-only in blocked, full in ready
  // (Component will be rendered, but create actions hidden)
  const showArtifactsList = true;

  // showUpdatesHelp: hidden in blocked_no_labs, collapsed otherwise
  const showUpdatesHelp: UpdatesHelpVisibility =
    state === 'blocked_no_labs'
      ? 'hidden'
      : state === 'ready_updates_available'
        ? 'expanded'
        : 'collapsed';

  return {
    state,
    banner,
    showPrimaryDeliverables,
    showArtifactsList,
    showUpdatesHelp,
    primaryCTA,
    secondaryCTA,
    preferredPrimary,
    staleSummary,
    debug: {
      hasLabs,
      inputsConfirmed,
      strategyFramed,
      decideComplete,
      hasAnyDeliverables,
    },
  };
}
