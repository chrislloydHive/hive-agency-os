// lib/os/ui/documentsUiState.ts
// Documents Page UI State Selector
//
// Single source of truth for Documents page state derivation.
// Maps artifact data → discrete UI state → visibility rules.

import type { Artifact, ArtifactType, ArtifactStatus } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the Documents experience
 */
export type DocumentsState =
  | 'empty'                    // No artifacts exist
  | 'has_docs_up_to_date'      // Has artifacts, all are up to date
  | 'has_docs_updates_available'; // Has artifacts, some are stale

/**
 * Document group keys for categorization
 */
export type DocumentGroupKey =
  | 'strategy'   // strategy_doc
  | 'rfp'        // rfp_response_doc
  | 'slides'     // qbr_slides, proposal_slides
  | 'sheets'     // media_plan, pricing_sheet
  | 'other';     // brief_doc, custom

/**
 * Artifact types that support "Insert Updates" action
 */
export const UPDATABLE_TYPES: ArtifactType[] = ['strategy_doc', 'rfp_response_doc'];

/**
 * Group configuration
 */
export interface DocumentGroup {
  key: DocumentGroupKey;
  label: string;
  artifacts: Artifact[];
  count: number;
}

/**
 * Primary CTA configuration
 */
export interface DocumentsCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
  /** For external links (Google Drive) */
  external?: boolean;
}

/**
 * Debug info for development
 */
export interface DocumentsDebugInfo {
  totalCount: number;
  activeCount: number;
  staleCount: number;
  hasAnyStale: boolean;
  hasStaleUpdatable: boolean;
  preferredPrimaryId: string | null;
  preferredPrimaryType: ArtifactType | null;
}

/**
 * Full UI state derived from data
 */
export interface DocumentsUIState {
  state: DocumentsState;
  /** The primary artifact to pin at top */
  primaryArtifact: Artifact | null;
  /** Grouped artifacts (excludes archived) */
  groups: DocumentGroup[];
  /** Whether to show the staleness warning banner */
  showStaleWarning: boolean;
  /** Number of stale artifacts */
  staleCount: number;
  /** Primary CTA */
  primaryCTA: DocumentsCTA;
  /** Secondary CTA (e.g., "Open in Drive" when primary is "Insert Updates") */
  secondaryCTA: DocumentsCTA | null;
  /** The stale updatable artifact for Insert Updates route */
  staleUpdatableArtifact: Artifact | null;
  /** Debug info */
  debug: DocumentsDebugInfo;
}

/**
 * Raw data inputs for state derivation
 */
export interface DocumentsDataInput {
  artifacts: Artifact[];
}

// ============================================================================
// Group Mapping
// ============================================================================

/**
 * Map artifact type to group key
 */
function getGroupKeyForType(type: ArtifactType): DocumentGroupKey {
  switch (type) {
    case 'strategy_doc':
      return 'strategy';
    case 'rfp_response_doc':
      return 'rfp';
    case 'qbr_slides':
    case 'proposal_slides':
      return 'slides';
    case 'media_plan':
    case 'pricing_sheet':
      return 'sheets';
    case 'brief_doc':
    case 'custom':
    default:
      return 'other';
  }
}

/**
 * Group labels
 */
const GROUP_LABELS: Record<DocumentGroupKey, string> = {
  strategy: 'Strategy Documents',
  rfp: 'RFP Responses',
  slides: 'Presentations',
  sheets: 'Spreadsheets',
  other: 'Other Documents',
};

/**
 * Group order for display
 */
const GROUP_ORDER: DocumentGroupKey[] = ['strategy', 'rfp', 'slides', 'sheets', 'other'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get active (non-archived) artifacts
 */
function getActiveArtifacts(artifacts: Artifact[]): Artifact[] {
  return artifacts.filter(a => a.status !== 'archived');
}

/**
 * Sort artifacts: final first, then by updatedAt descending
 */
function sortArtifacts(artifacts: Artifact[]): Artifact[] {
  return [...artifacts].sort((a, b) => {
    // Final first
    if (a.status === 'final' && b.status !== 'final') return -1;
    if (b.status === 'final' && a.status !== 'final') return 1;
    // Then by updatedAt descending
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

/**
 * Determine preferred primary artifact
 * Priority:
 * 1. rfp_response_doc (prefer final, else newest)
 * 2. strategy_doc (prefer final, else newest)
 * 3. newest artifact (prefer final over draft)
 */
function getPreferredPrimary(artifacts: Artifact[]): Artifact | null {
  const active = getActiveArtifacts(artifacts);
  if (active.length === 0) return null;

  // Helper to find best in a type
  const findBestOfType = (type: ArtifactType): Artifact | null => {
    const ofType = active.filter(a => a.type === type);
    if (ofType.length === 0) return null;
    // Prefer final, then newest
    const final = ofType.find(a => a.status === 'final');
    if (final) return final;
    // Sort by updatedAt descending, return first
    return sortArtifacts(ofType)[0];
  };

  // Try rfp_response_doc first
  const rfp = findBestOfType('rfp_response_doc');
  if (rfp) return rfp;

  // Then strategy_doc
  const strategy = findBestOfType('strategy_doc');
  if (strategy) return strategy;

  // Fall back to newest (prefer published)
  return sortArtifacts(active)[0];
}

/**
 * Find first stale updatable artifact
 * Priority: rfp_response_doc, then strategy_doc
 */
function getStaleUpdatableArtifact(artifacts: Artifact[]): Artifact | null {
  const active = getActiveArtifacts(artifacts);
  const staleUpdatable = active.filter(
    a => a.isStale && UPDATABLE_TYPES.includes(a.type)
  );

  if (staleUpdatable.length === 0) return null;

  // Prefer rfp_response_doc
  const rfp = staleUpdatable.find(a => a.type === 'rfp_response_doc');
  if (rfp) return rfp;

  // Then strategy_doc
  return staleUpdatable.find(a => a.type === 'strategy_doc') || null;
}

/**
 * Group artifacts by type category
 */
function groupArtifacts(artifacts: Artifact[]): DocumentGroup[] {
  const active = getActiveArtifacts(artifacts);

  // Initialize empty groups
  const groupMap: Record<DocumentGroupKey, Artifact[]> = {
    strategy: [],
    rfp: [],
    slides: [],
    sheets: [],
    other: [],
  };

  // Populate groups
  for (const artifact of active) {
    const key = getGroupKeyForType(artifact.type);
    groupMap[key].push(artifact);
  }

  // Build output in order, only include non-empty groups
  const groups: DocumentGroup[] = [];
  for (const key of GROUP_ORDER) {
    const artifacts = sortArtifacts(groupMap[key]);
    if (artifacts.length > 0) {
      groups.push({
        key,
        label: GROUP_LABELS[key],
        artifacts,
        count: artifacts.length,
      });
    }
  }

  return groups;
}

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete DocumentsState from raw data
 */
export function deriveDocumentsState(input: DocumentsDataInput): DocumentsState {
  const { artifacts } = input;
  const active = getActiveArtifacts(artifacts);

  if (active.length === 0) {
    return 'empty';
  }

  const hasAnyStale = active.some(a => a.isStale);

  if (hasAnyStale) {
    return 'has_docs_updates_available';
  }

  return 'has_docs_up_to_date';
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 */
function getPrimaryCTA(
  state: DocumentsState,
  companyId: string,
  primaryArtifact: Artifact | null,
  staleUpdatableArtifact: Artifact | null
): DocumentsCTA {
  switch (state) {
    case 'empty':
      return {
        label: 'Go to Deliver',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };

    case 'has_docs_updates_available':
      // If there's a stale updatable doc, offer Insert Updates
      if (staleUpdatableArtifact) {
        const updateRoute =
          staleUpdatableArtifact.type === 'rfp_response_doc'
            ? `/c/${companyId}/rfp/${staleUpdatableArtifact.id}/update`
            : `/c/${companyId}/strategy/update`;
        return {
          label: 'Insert Updates',
          href: updateRoute,
          variant: 'primary',
        };
      }
      // Fall through to open primary
      if (primaryArtifact?.googleFileUrl) {
        return {
          label: 'Open Primary Document',
          href: primaryArtifact.googleFileUrl,
          variant: 'primary',
          external: true,
        };
      }
      return {
        label: 'Go to Deliver',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };

    case 'has_docs_up_to_date':
      if (primaryArtifact?.googleFileUrl) {
        return {
          label: 'Open Primary Document',
          href: primaryArtifact.googleFileUrl,
          variant: 'primary',
          external: true,
        };
      }
      return {
        label: 'Go to Deliver',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
  }
}

/**
 * Get optional secondary CTA
 */
function getSecondaryCTA(
  state: DocumentsState,
  companyId: string,
  primaryArtifact: Artifact | null,
  staleUpdatableArtifact: Artifact | null
): DocumentsCTA | null {
  // When primary is "Insert Updates", offer "Open Primary" as secondary
  if (state === 'has_docs_updates_available' && staleUpdatableArtifact) {
    if (primaryArtifact?.googleFileUrl) {
      return {
        label: 'Open Primary',
        href: primaryArtifact.googleFileUrl,
        variant: 'secondary',
        external: true,
      };
    }
  }

  // When we have a primary, offer "Create New" as secondary
  if (state !== 'empty' && primaryArtifact) {
    return {
      label: 'Create New',
      href: `/c/${companyId}/deliver`,
      variant: 'secondary',
    };
  }

  return null;
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Documents UI state from raw data
 *
 * This is the single source of truth for all Documents page UI decisions.
 * All conditional rendering should flow from this selector.
 *
 * @param input - Raw artifact data
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getDocumentsUIState(
  input: DocumentsDataInput,
  companyId: string
): DocumentsUIState {
  const { artifacts } = input;
  const active = getActiveArtifacts(artifacts);

  // Derive state
  const state = deriveDocumentsState(input);

  // Compute derived values
  const primaryArtifact = getPreferredPrimary(artifacts);
  const staleUpdatableArtifact = getStaleUpdatableArtifact(artifacts);
  const groups = groupArtifacts(artifacts);

  // Staleness info
  const staleArtifacts = active.filter(a => a.isStale);
  const hasAnyStale = staleArtifacts.length > 0;
  const hasStaleUpdatable = !!staleUpdatableArtifact;

  // Get CTAs
  const primaryCTA = getPrimaryCTA(state, companyId, primaryArtifact, staleUpdatableArtifact);
  const secondaryCTA = getSecondaryCTA(state, companyId, primaryArtifact, staleUpdatableArtifact);

  return {
    state,
    primaryArtifact,
    groups,
    showStaleWarning: hasAnyStale,
    staleCount: staleArtifacts.length,
    primaryCTA,
    secondaryCTA,
    staleUpdatableArtifact,
    debug: {
      totalCount: artifacts.length,
      activeCount: active.length,
      staleCount: staleArtifacts.length,
      hasAnyStale,
      hasStaleUpdatable,
      preferredPrimaryId: primaryArtifact?.id ?? null,
      preferredPrimaryType: primaryArtifact?.type ?? null,
    },
  };
}

/**
 * Get update route for an artifact type
 */
export function getUpdateRouteForArtifact(
  artifact: Artifact,
  companyId: string
): string | null {
  if (!UPDATABLE_TYPES.includes(artifact.type)) {
    return null;
  }

  if (artifact.type === 'rfp_response_doc') {
    return `/c/${companyId}/rfp/${artifact.id}/update`;
  }

  if (artifact.type === 'strategy_doc') {
    return `/c/${companyId}/strategy/update`;
  }

  return null;
}

/**
 * Check if an artifact type is updatable
 */
export function isUpdatableType(type: ArtifactType): boolean {
  return UPDATABLE_TYPES.includes(type);
}
