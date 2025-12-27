// lib/os/ui/decideRoute.ts
// Route-based active sub-view detection for Decide phase
//
// Maps pathname and hash to the correct DecideSubView.
// Used by pages to determine which sub-view is currently active.

import type { DecideSubView } from './decideUiState';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of route analysis for Decide phase
 */
export interface DecideRouteInfo {
  /** Whether the current route is within the Decide phase */
  isDecidePage: boolean;
  /** The detected active sub-view */
  activeSubView: DecideSubView;
}

// ============================================================================
// Route Patterns
// ============================================================================

/**
 * Route patterns that map to 'context' sub-view
 * Includes the main context page and all subviews
 */
const CONTEXT_ROUTE_PATTERNS = [
  /^\/c\/[^/]+\/context(\/.*)?$/, // /c/[companyId]/context and subviews
];

/**
 * Route patterns that map to 'strategy' sub-view
 */
const STRATEGY_ROUTE_PATTERNS = [
  /^\/c\/[^/]+\/strategy(\/.*)?$/, // /c/[companyId]/strategy and subviews
];

/**
 * Route patterns that map to 'review' sub-view
 * Note: Review is often embedded in /decide with #review hash
 */
const REVIEW_ROUTE_PATTERNS = [
  /^\/c\/[^/]+\/readiness$/, // AI Quality page (optional, under Decide umbrella)
];

/**
 * Route patterns that are part of the Decide phase (show DecideShell)
 */
const DECIDE_PHASE_PATTERNS = [
  /^\/c\/[^/]+\/decide(\/.*)?$/, // /c/[companyId]/decide
  /^\/c\/[^/]+\/context(\/.*)?$/, // /c/[companyId]/context
  /^\/c\/[^/]+\/strategy(\/.*)?$/, // /c/[companyId]/strategy
  /^\/c\/[^/]+\/readiness$/, // AI Quality (optional)
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if a pathname matches any patterns in a list
 */
function matchesAnyPattern(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(pathname));
}

/**
 * Determine if the current route is part of the Decide phase
 *
 * @param pathname - The current URL pathname
 * @returns true if this route should show the Decide sub-nav
 */
export function isDecidePhaseRoute(pathname: string): boolean {
  return matchesAnyPattern(pathname, DECIDE_PHASE_PATTERNS);
}

/**
 * Get the active DecideSubView from the current route
 *
 * Priority:
 * 1. Check hash for explicit sub-view (e.g., #review)
 * 2. Check pathname against known patterns
 * 3. Default to 'context' if on Decide page without specific route
 *
 * @param pathname - The current URL pathname
 * @param hash - The URL hash (including the # symbol)
 * @returns The detected DecideSubView
 */
export function getActiveDecideSubViewFromPath(
  pathname: string,
  hash: string = ''
): DecideSubView {
  // 1. Check hash for explicit sub-view
  const normalizedHash = hash.replace('#', '').toLowerCase();
  if (normalizedHash === 'context') return 'context';
  if (normalizedHash === 'strategy') return 'strategy';
  if (normalizedHash === 'review') return 'review';

  // 2. Check pathname against patterns
  if (matchesAnyPattern(pathname, CONTEXT_ROUTE_PATTERNS)) {
    return 'context';
  }

  if (matchesAnyPattern(pathname, STRATEGY_ROUTE_PATTERNS)) {
    return 'strategy';
  }

  if (matchesAnyPattern(pathname, REVIEW_ROUTE_PATTERNS)) {
    return 'review';
  }

  // 3. On /decide page without hash, default to 'context'
  // (the decide page itself is a landing with all three sub-views)
  if (/^\/c\/[^/]+\/decide(\/)?$/.test(pathname)) {
    return 'context';
  }

  // Fallback to context for any unrecognized Decide phase route
  return 'context';
}

/**
 * Get full route info for the current path
 *
 * @param pathname - The current URL pathname
 * @param hash - The URL hash (including the # symbol)
 * @returns DecideRouteInfo with isDecidePage and activeSubView
 */
export function getDecideRouteInfo(pathname: string, hash: string = ''): DecideRouteInfo {
  const isDecidePage = isDecidePhaseRoute(pathname);
  const activeSubView = getActiveDecideSubViewFromPath(pathname, hash);

  return {
    isDecidePage,
    activeSubView,
  };
}

/**
 * Build the URL for navigating to a specific sub-view
 *
 * @param companyId - The company ID
 * @param subView - The target sub-view
 * @returns The URL to navigate to
 */
export function buildDecideSubViewUrl(companyId: string, subView: DecideSubView): string {
  switch (subView) {
    case 'context':
      return `/c/${companyId}/context`;
    case 'strategy':
      return `/c/${companyId}/strategy`;
    case 'review':
      // Review is embedded in the decide page
      return `/c/${companyId}/decide#review`;
    default:
      return `/c/${companyId}/context`;
  }
}
