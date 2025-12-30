// lib/os/ui/decideUiState.ts
// Decide Page UI State Selector
//
// Single source of truth for Decide page state derivation.
// Maps raw API data → discrete UI state → visibility rules.
//
// PHILOSOPHY (V11+):
// - Labs are OPTIONAL enrichment, never gating
// - Manual context entry is ALWAYS available
// - Only strategy existence gates proceeding to Deliver
// - AI guardrails live in prompts (provenance/confidence), not UI gating

import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the Decide experience
 *
 * V11+: Simplified states. Labs never block. Context always editable.
 * - no_strategy: No strategy exists yet (context editing always available)
 * - strategy_draft: Strategy exists but not locked
 * - strategy_locked: Strategy finalized, ready for Deliver
 */
export type DecideState =
  | 'no_strategy'      // No strategy yet → can add context, create strategy
  | 'strategy_draft'   // Strategy exists, not locked → can edit, proceed to review
  | 'strategy_locked'; // Strategy finalized → ready for Deliver

/**
 * Sub-view within the Decide phase
 * - context: Review/confirm business context (Map/Table/Fields tabs)
 * - strategy: Generate and refine strategy framing
 * - review: Final review/lock before Deliver
 */
export type DecideSubView = 'context' | 'strategy' | 'review';

/**
 * Sub-navigation state configuration
 */
export interface SubNavState {
  /** Currently active sub-view (must be validated via sanitizeActiveSubView) */
  active: DecideSubView;
  /** Default sub-view for the current DecideState */
  default: DecideSubView;
  /** Availability of each sub-view */
  available: {
    context: boolean;
    strategy: boolean;
    review: boolean;
  };
  /** Optional reason if a sub-view is blocked */
  reasonIfBlocked?: string;
}

/**
 * Tab visibility levels
 */
export type TabVisibility = 'hidden' | 'secondary' | 'primary' | 'readonly';

/**
 * Individual tab configuration
 */
export interface TabConfig {
  id: 'map' | 'table' | 'fields' | 'review';
  label: string;
  visibility: TabVisibility;
}

/**
 * CTA configuration for the current state
 */
export interface DecideCTA {
  label: string;
  href: string;
  variant: 'primary' | 'secondary';
}

/**
 * Informational banner for context status
 */
export interface ContextStatusBanner {
  type: 'info' | 'warning' | 'success';
  message: string;
  showLabsCTA: boolean;
}

/**
 * Full UI state derived from data
 */
export interface DecideUIState {
  state: DecideState;
  /** Sub-navigation state (Context | Strategy | Review) */
  subNav: SubNavState;
  tabs: TabConfig[];
  visibleTabs: TabConfig[];
  defaultTab: 'map' | 'table' | 'fields' | 'review';
  primaryCTA: DecideCTA | null;
  statusSummary: string;
  showStrategyLink: boolean;
  showContextChecklist: boolean;
  /** Informational banner about context status (non-blocking) */
  contextBanner: ContextStatusBanner | null;
  /** Whether labs have been run (informational only) */
  hasLabsRun: boolean;
  /** Whether strategy origin is imported */
  isImported: boolean;
}

/**
 * Raw data inputs for state derivation
 */
export interface DecideDataInput {
  contextHealth: V4HealthResponse | null;
  strategyExists: boolean;
  strategyLocked?: boolean;
  /** Strategy origin: imported strategies show special banner */
  strategyOrigin?: 'generated' | 'imported' | 'hybrid';
  /** Whether strategy frame has minimal content (intent or optimizationScope) */
  hasMinimalFrame?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Tab definitions with labels
 */
const TAB_DEFINITIONS: Record<TabConfig['id'], string> = {
  map: 'Map',
  table: 'Table',
  fields: 'Fields',
  review: 'Review',
};

// ============================================================================
// State Derivation
// ============================================================================

/**
 * Derive the discrete DecideState from raw data
 *
 * V11+: Simplified logic. Labs never block.
 * State is based purely on strategy existence and lock status.
 */
export function deriveDecideState(input: DecideDataInput): DecideState {
  const { strategyExists, strategyLocked } = input;

  // Simple state machine: strategy existence and lock status only
  if (!strategyExists) {
    return 'no_strategy';
  }

  if (strategyLocked) {
    return 'strategy_locked';
  }

  return 'strategy_draft';
}

// ============================================================================
// Tab Visibility Matrix
// ============================================================================

/**
 * Get tab visibility for a given state
 *
 * V11+: All context tabs always visible (context editing never blocked)
 *
 * Authoritative visibility matrix:
 * | State           | Map | Table | Fields | Review |
 * |-----------------|-----|-------|--------|--------|
 * | no_strategy     | ⚪  | ✅    | ✅     | ❌     |
 * | strategy_draft  | ⚪  | ⚪    | ✅     | ✅     |
 * | strategy_locked | ⚪  | ⚪    | ⚪     | 🔒     |
 *
 * Context tabs (map, table, fields) are always available for editing.
 * Review tab appears when strategy exists.
 */
function getTabVisibility(
  state: DecideState,
  tabId: TabConfig['id']
): TabVisibility {
  const matrix: Record<DecideState, Record<TabConfig['id'], TabVisibility>> = {
    no_strategy: {
      map: 'secondary',
      table: 'primary',
      fields: 'primary',
      review: 'hidden', // No strategy yet
    },
    strategy_draft: {
      map: 'secondary',
      table: 'secondary',
      fields: 'primary',
      review: 'primary',
    },
    strategy_locked: {
      map: 'secondary',
      table: 'secondary',
      fields: 'secondary',
      review: 'readonly',
    },
  };

  return matrix[state][tabId];
}

/**
 * Build tab configuration for the current state
 */
function buildTabs(state: DecideState): TabConfig[] {
  const tabIds: TabConfig['id'][] = ['map', 'table', 'fields', 'review'];

  return tabIds.map((id) => ({
    id,
    label: TAB_DEFINITIONS[id],
    visibility: getTabVisibility(state, id),
  }));
}

/**
 * Get the default active tab for a state
 */
function getDefaultTab(state: DecideState, tabs: TabConfig[]): TabConfig['id'] {
  // Explicit state-based defaults
  const stateDefaults: Record<DecideState, TabConfig['id']> = {
    no_strategy: 'fields',    // Start with manual context entry
    strategy_draft: 'review', // Focus on review when strategy exists
    strategy_locked: 'review',
  };

  const defaultTab = stateDefaults[state];

  // Verify the default is visible (non-hidden)
  const isVisible = tabs.some(
    (t) => t.id === defaultTab && t.visibility !== 'hidden'
  );
  if (isVisible) return defaultTab;

  // Fall back to first visible (non-hidden)
  const visible = tabs.find((t) => t.visibility !== 'hidden');
  if (visible) return visible.id;

  // Ultimate fallback
  return 'fields';
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 *
 * V11+: Simplified CTAs. No blocking states.
 */
function getPrimaryCTA(
  state: DecideState,
  companyId: string
): DecideCTA | null {
  switch (state) {
    case 'no_strategy':
      return {
        label: 'Create Strategy',
        href: `/c/${companyId}/strategy`,
        variant: 'primary',
      };

    case 'strategy_draft':
      return {
        label: 'Review & Finalize',
        href: `/c/${companyId}/decide#review`,
        variant: 'primary',
      };

    case 'strategy_locked':
      return {
        label: 'Go to Deliver',
        href: `/c/${companyId}/deliver`,
        variant: 'primary',
      };
  }
}

/**
 * Get status summary text for the state
 */
function getStatusSummary(
  state: DecideState,
  contextHealth: V4HealthResponse | null,
  isImported: boolean
): string {
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;

  switch (state) {
    case 'no_strategy':
      if (proposedCount > 0) {
        return `${proposedCount} proposal${proposedCount !== 1 ? 's' : ''} ready for review`;
      }
      if (confirmedCount > 0) {
        return `${confirmedCount} context field${confirmedCount !== 1 ? 's' : ''} confirmed`;
      }
      return 'Add context to improve AI quality';

    case 'strategy_draft':
      if (isImported) {
        return 'Strategy anchored — review before proceeding';
      }
      return 'Strategy draft ready for review';

    case 'strategy_locked':
      return 'Strategy finalized — ready for Deliver';
  }
}

/**
 * Get informational banner about context status (non-blocking)
 */
function getContextBanner(
  contextHealth: V4HealthResponse | null,
  isImported: boolean
): ContextStatusBanner | null {
  const hasLabs = contextHealth?.websiteLab?.hasRun ?? false;
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;

  // Imported strategy banner
  if (isImported) {
    return {
      type: 'info',
      message: 'Strategy imported. Labs optional — run later to enrich context.',
      showLabsCTA: true,
    };
  }

  // No context at all
  if (!hasLabs && confirmedCount === 0 && proposedCount === 0) {
    return {
      type: 'info',
      message: 'No baseline context yet. Add key facts manually or run a lab to enrich.',
      showLabsCTA: true,
    };
  }

  // Has proposals to review
  if (proposedCount > 0) {
    return {
      type: 'warning',
      message: `${proposedCount} AI proposal${proposedCount !== 1 ? 's' : ''} waiting for review.`,
      showLabsCTA: false,
    };
  }

  // Labs run, context confirmed
  if (hasLabs && confirmedCount > 0) {
    return {
      type: 'success',
      message: `${confirmedCount} context field${confirmedCount !== 1 ? 's' : ''} confirmed from labs.`,
      showLabsCTA: false,
    };
  }

  return null;
}

// ============================================================================
// Sub-Navigation Derivation
// ============================================================================

/**
 * Derive the default sub-view from DecideState
 *
 * V11+: All sub-views available. No blocking.
 */
function getDefaultSubView(state: DecideState): DecideSubView {
  const stateToSubView: Record<DecideState, DecideSubView> = {
    no_strategy: 'context',   // Start with context entry
    strategy_draft: 'review', // Focus on review when strategy exists
    strategy_locked: 'review',
  };
  return stateToSubView[state];
}

/**
 * Derive sub-view availability from DecideState
 *
 * V11+: Context and Strategy always available.
 * Review available when strategy exists.
 */
function getSubViewAvailability(state: DecideState): SubNavState['available'] {
  return {
    context: true,  // Always available
    strategy: true, // Always available (AI quality varies with context)
    review: state !== 'no_strategy', // Available when strategy exists
  };
}

/**
 * Get the reason why a sub-view might be blocked
 */
function getSubViewBlockedReason(
  state: DecideState,
  availability: SubNavState['available']
): string | undefined {
  if (!availability.review) {
    return 'Create a strategy first';
  }
  return undefined;
}

/**
 * Build the complete sub-navigation state
 */
function buildSubNavState(state: DecideState): SubNavState {
  const defaultSubView = getDefaultSubView(state);
  const available = getSubViewAvailability(state);
  const reasonIfBlocked = getSubViewBlockedReason(state, available);

  return {
    active: defaultSubView, // Will be overridden by sanitizeActiveSubView
    default: defaultSubView,
    available,
    reasonIfBlocked,
  };
}

/**
 * Sanitize active sub-view if it's no longer available
 *
 * @param current - The currently selected sub-view
 * @param uiState - The complete UI state (must have subNav.available and subNav.default)
 * @returns A valid sub-view that is currently available
 */
export function sanitizeActiveSubView(
  current: DecideSubView,
  uiState: Pick<DecideUIState, 'subNav'>
): DecideSubView {
  const { available, default: defaultSubView } = uiState.subNav;

  // If current is available, keep it
  if (available[current]) {
    return current;
  }

  // Fall back to default
  return defaultSubView;
}

// ============================================================================
// Main Selector
// ============================================================================

/**
 * Get the complete Decide UI state from raw data
 *
 * This is the single source of truth for all Decide page UI decisions.
 * All conditional rendering should flow from this selector.
 *
 * V11+: No blocking states. Labs are informational only.
 *
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getDecideUIState(
  input: DecideDataInput,
  companyId: string
): DecideUIState {
  const { contextHealth, strategyOrigin } = input;

  const state = deriveDecideState(input);
  const subNav = buildSubNavState(state);
  const tabs = buildTabs(state);
  const visibleTabs = tabs.filter((t) => t.visibility !== 'hidden');
  const defaultTab = getDefaultTab(state, tabs);
  const isImported = strategyOrigin === 'imported';
  const hasLabsRun = contextHealth?.websiteLab?.hasRun ?? false;
  const primaryCTA = getPrimaryCTA(state, companyId);
  const statusSummary = getStatusSummary(state, contextHealth, isImported);
  const contextBanner = getContextBanner(contextHealth, isImported);

  // Strategy link always available (AI quality varies with context)
  const showStrategyLink = true;

  // Context checklist always shown
  const showContextChecklist = true;

  return {
    state,
    subNav,
    tabs,
    visibleTabs,
    defaultTab,
    primaryCTA,
    statusSummary,
    showStrategyLink,
    showContextChecklist,
    contextBanner,
    hasLabsRun,
    isImported,
  };
}

/**
 * Sanitize active tab if it's no longer visible
 */
export function sanitizeActiveTab(
  currentTab: string,
  visibleTabs: TabConfig[]
): TabConfig['id'] {
  const isVisible = visibleTabs.some((t) => t.id === currentTab);
  if (isVisible) return currentTab as TabConfig['id'];

  // Fall back to default (first primary or first visible)
  const primary = visibleTabs.find((t) => t.visibility === 'primary');
  return primary?.id ?? visibleTabs[0]?.id ?? 'fields';
}

// ============================================================================
// Legacy Compatibility (deprecated, will be removed)
// ============================================================================

/**
 * @deprecated Use DecideState instead. These are mapped for backward compatibility.
 */
export type LegacyDecideState =
  | 'blocked_no_labs'
  | 'imported_ready'
  | 'context_proposed'
  | 'context_confirming'
  | 'inputs_confirmed'
  | 'strategy_framing'
  | 'strategy_locked';

/**
 * Map new state to legacy state for backward compatibility
 * @deprecated Will be removed in next version
 */
export function toLegacyState(state: DecideState): LegacyDecideState {
  switch (state) {
    case 'no_strategy':
      return 'inputs_confirmed'; // Closest equivalent
    case 'strategy_draft':
      return 'strategy_framing';
    case 'strategy_locked':
      return 'strategy_locked';
  }
}
