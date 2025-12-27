// lib/os/ui/decideUiState.ts
// Decide Page UI State Selector
//
// Single source of truth for Decide page state derivation.
// Maps raw API data → discrete UI state → visibility rules.

import type { V4HealthResponse } from '@/lib/types/contextV4Health';

// ============================================================================
// Types
// ============================================================================

/**
 * Discrete states for the Decide experience
 */
export type DecideState =
  | 'blocked_no_labs'     // Labs haven't run → block all, CTA: "Go to Discover" → /diagnostics
  | 'context_proposed'    // Labs run, proposals exist but 0 confirmed
  | 'context_confirming'  // Some confirmed but < inputsConfirmed threshold
  | 'inputs_confirmed'    // All required inputs confirmed, ready for strategy
  | 'strategy_framing'    // Strategy draft exists, not locked
  | 'strategy_locked';    // Strategy finalized

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
}

/**
 * Raw data inputs for state derivation
 */
export interface DecideDataInput {
  contextHealth: V4HealthResponse | null;
  strategyExists: boolean;
  strategyLocked?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum confirmed fields to consider "inputs confirmed"
 * Maps to SRM (Strategy-Ready Minimum) requirements
 */
const INPUTS_CONFIRMED_THRESHOLD = 3;

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
 */
export function deriveDecideState(input: DecideDataInput): DecideState {
  const { contextHealth, strategyExists, strategyLocked } = input;

  const hasLabs = contextHealth?.websiteLab?.hasRun ?? false;
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const inputsConfirmed = confirmedCount >= INPUTS_CONFIRMED_THRESHOLD;

  // State resolution (exact order matters)
  if (!hasLabs) {
    return 'blocked_no_labs';
  }

  if (!inputsConfirmed && confirmedCount === 0) {
    return 'context_proposed';
  }

  if (!inputsConfirmed) {
    return 'context_confirming';
  }

  if (inputsConfirmed && !strategyExists) {
    return 'inputs_confirmed';
  }

  if (strategyExists && !strategyLocked) {
    return 'strategy_framing';
  }

  return 'strategy_locked';
}

// ============================================================================
// Tab Visibility Matrix
// ============================================================================

/**
 * Get tab visibility for a given state
 *
 * Authoritative visibility matrix:
 * | State              | Map | Table | Fields | Review |
 * |--------------------|-----|-------|--------|--------|
 * | blocked_no_labs    | ❌  | ❌    | ❌     | ❌     |
 * | context_proposed   | ❌  | ✅    | ⚪     | ❌     |
 * | context_confirming | ⚪  | ✅    | ✅     | ❌     |
 * | inputs_confirmed   | ❌  | ❌    | ❌     | ✅     |
 * | strategy_framing   | ❌  | ❌    | ❌     | ✅     |
 * | strategy_locked    | ❌  | ❌    | ❌     | 🔒     |
 *
 * Flow: Table/Fields (confirm) → Review (commit) → Deliver
 * Map only appears in context_confirming as secondary/optional.
 */
function getTabVisibility(
  state: DecideState,
  tabId: TabConfig['id']
): TabVisibility {
  const matrix: Record<DecideState, Record<TabConfig['id'], TabVisibility>> = {
    blocked_no_labs: {
      map: 'hidden',
      table: 'hidden',
      fields: 'hidden',
      review: 'hidden',
    },
    context_proposed: {
      map: 'hidden',
      table: 'primary',
      fields: 'secondary',
      review: 'hidden',
    },
    context_confirming: {
      map: 'secondary',
      table: 'primary',
      fields: 'primary',
      review: 'hidden',
    },
    inputs_confirmed: {
      map: 'hidden',
      table: 'hidden',
      fields: 'hidden',
      review: 'primary',
    },
    strategy_framing: {
      map: 'hidden',
      table: 'hidden',
      fields: 'hidden',
      review: 'primary',
    },
    strategy_locked: {
      map: 'hidden',
      table: 'hidden',
      fields: 'hidden',
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
 *
 * Explicit defaults per state:
 * - context_proposed → table
 * - context_confirming → fields
 * - inputs_confirmed → review
 * - strategy_framing → review
 * - strategy_locked → review
 */
function getDefaultTab(state: DecideState, tabs: TabConfig[]): TabConfig['id'] {
  // Explicit state-based defaults
  const stateDefaults: Record<DecideState, TabConfig['id']> = {
    blocked_no_labs: 'table', // Fallback, all hidden anyway
    context_proposed: 'table',
    context_confirming: 'fields',
    inputs_confirmed: 'review',
    strategy_framing: 'review',
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
  return 'table';
}

// ============================================================================
// CTA Configuration
// ============================================================================

/**
 * Get the primary CTA for a state
 *
 * Authoritative CTAs:
 * - blocked_no_labs → "Go to Discover" → /diagnostics
 * - context_proposed → "Confirm Inputs" → /context
 * - context_confirming → "Confirm Remaining Inputs" → /context
 * - inputs_confirmed → "Save Strategy Framing" → /strategy
 * - strategy_framing → "Finalize Strategy" → /strategy
 * - strategy_locked → "Go to Deliver" → /deliver
 */
function getPrimaryCTA(
  state: DecideState,
  companyId: string,
  _contextHealth: V4HealthResponse | null
): DecideCTA | null {
  switch (state) {
    case 'blocked_no_labs':
      return {
        label: 'Go to Discover',
        href: `/c/${companyId}/diagnostics`,
        variant: 'primary',
      };

    case 'context_proposed':
      return {
        label: 'Confirm Inputs',
        href: `/c/${companyId}/context`,
        variant: 'primary',
      };

    case 'context_confirming':
      return {
        label: 'Confirm Remaining Inputs',
        href: `/c/${companyId}/context`,
        variant: 'primary',
      };

    case 'inputs_confirmed':
      return {
        label: 'Save Strategy Framing',
        href: `/c/${companyId}/strategy`,
        variant: 'primary',
      };

    case 'strategy_framing':
      return {
        label: 'Finalize Strategy',
        href: `/c/${companyId}/strategy`,
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
  contextHealth: V4HealthResponse | null
): string {
  const confirmedCount = contextHealth?.store?.confirmed ?? 0;
  const proposedCount = contextHealth?.store?.proposed ?? 0;

  switch (state) {
    case 'blocked_no_labs':
      return 'Run labs to extract context';

    case 'context_proposed':
      return `${proposedCount} proposal${proposedCount !== 1 ? 's' : ''} ready for review`;

    case 'context_confirming':
      return `${confirmedCount}/${INPUTS_CONFIRMED_THRESHOLD} inputs confirmed`;

    case 'inputs_confirmed':
      return 'Ready to generate strategy';

    case 'strategy_framing':
      return 'Strategy draft in progress';

    case 'strategy_locked':
      return 'Strategy finalized';
  }
}

// ============================================================================
// Sub-Navigation Derivation
// ============================================================================

/**
 * Derive the default sub-view from DecideState
 *
 * State → Default Sub-View:
 * - blocked_no_labs → context (shows blocked CTA)
 * - context_proposed → context
 * - context_confirming → context
 * - inputs_confirmed → strategy
 * - strategy_framing → strategy
 * - strategy_locked → review
 */
function getDefaultSubView(state: DecideState): DecideSubView {
  const stateToSubView: Record<DecideState, DecideSubView> = {
    blocked_no_labs: 'context',
    context_proposed: 'context',
    context_confirming: 'context',
    inputs_confirmed: 'strategy',
    strategy_framing: 'strategy',
    strategy_locked: 'review',
  };
  return stateToSubView[state];
}

/**
 * Derive sub-view availability from DecideState
 *
 * Availability Matrix:
 * | State              | Context | Strategy | Review |
 * |--------------------|---------|----------|--------|
 * | blocked_no_labs    | ✅*     | ❌       | ❌     |
 * | context_proposed   | ✅      | ❌       | ❌     |
 * | context_confirming | ✅      | ❌       | ❌     |
 * | inputs_confirmed   | ✅      | ✅       | ❌     |
 * | strategy_framing   | ✅      | ✅       | ✅     |
 * | strategy_locked    | ✅      | ✅       | ✅     |
 *
 * *Context is always available, but content shows blocked CTA when no labs
 */
function getSubViewAvailability(state: DecideState): SubNavState['available'] {
  const inputsConfirmedOrLater = [
    'inputs_confirmed',
    'strategy_framing',
    'strategy_locked',
  ].includes(state);

  const strategyFramingOrLater = [
    'strategy_framing',
    'strategy_locked',
  ].includes(state);

  return {
    context: true, // Always available (shows blocked CTA if no labs)
    strategy: inputsConfirmedOrLater,
    review: strategyFramingOrLater,
  };
}

/**
 * Get the reason why a sub-view might be blocked
 */
function getSubViewBlockedReason(
  state: DecideState,
  availability: SubNavState['available']
): string | undefined {
  if (!availability.strategy) {
    return 'Confirm inputs first';
  }
  if (!availability.review) {
    return 'Complete strategy framing first';
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
 * @param input - Raw data from APIs
 * @param companyId - Company ID for building URLs
 * @returns Complete UI state configuration
 */
export function getDecideUIState(
  input: DecideDataInput,
  companyId: string
): DecideUIState {
  const state = deriveDecideState(input);
  const subNav = buildSubNavState(state);
  const tabs = buildTabs(state);
  const visibleTabs = tabs.filter((t) => t.visibility !== 'hidden');
  const defaultTab = getDefaultTab(state, tabs);
  const primaryCTA = getPrimaryCTA(state, companyId, input.contextHealth);
  const statusSummary = getStatusSummary(state, input.contextHealth);

  // Show strategy link only when inputs are confirmed
  const showStrategyLink = [
    'inputs_confirmed',
    'strategy_framing',
    'strategy_locked',
  ].includes(state);

  // Show checklist when not blocked
  const showContextChecklist = state !== 'blocked_no_labs';

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
  return primary?.id ?? visibleTabs[0]?.id ?? 'map';
}
