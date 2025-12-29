// lib/os/rfp/focus.ts
// Action routing helpers for navigating to specific RFP sections, criteria, and panels

import type { RfpSectionKey } from '@/lib/types/rfp';

// ============================================================================
// Types
// ============================================================================

/**
 * Target for focusing within the RFP Builder
 */
export type RfpFocusTarget =
  | { type: 'section'; sectionKey: RfpSectionKey }
  | { type: 'criterion'; criterionLabel: string }
  | { type: 'panel'; panel: RfpPanelType; mode?: RubricViewMode }
  | { type: 'persona'; personaType: string };

/**
 * Available panels in RFP Builder
 */
export type RfpPanelType = 'strategy' | 'rubric' | 'evaluator' | 'requirements' | 'bindings';

/**
 * Rubric view modes
 */
export type RubricViewMode = 'criteria' | 'evaluator';

/**
 * Focus action that can be dispatched
 */
export interface RfpFocusAction {
  target: RfpFocusTarget;
  scrollIntoView?: boolean;
  highlight?: boolean;
  markNeedsReview?: boolean;
}

/**
 * Callbacks for RFP focus actions
 */
export interface RfpFocusCallbacks {
  setSelectedSection?: (sectionKey: RfpSectionKey) => void;
  setShowRubricMap?: (show: boolean) => void;
  setRubricViewMode?: (mode: RubricViewMode) => void;
  setSelectedCriterion?: (label: string | null) => void;
  scrollToElement?: (elementId: string) => void;
  markSectionForReview?: (sectionKey: RfpSectionKey) => void;
  openWinStrategyPanel?: () => void;
}

// ============================================================================
// Focus Helpers
// ============================================================================

/**
 * Parse a fix section key to determine the focus target
 */
export function parseFocusTarget(fixSectionKey: string, _fixReason: string): RfpFocusTarget {
  // Check if it's a special target
  if (fixSectionKey === 'strategy' || fixSectionKey === 'win_strategy') {
    return { type: 'panel', panel: 'strategy' };
  }

  if (fixSectionKey === 'firm_brain') {
    return { type: 'panel', panel: 'bindings' };
  }

  if (fixSectionKey === 'persona' || fixSectionKey.startsWith('persona_')) {
    return { type: 'panel', panel: 'evaluator', mode: 'evaluator' };
  }

  if (fixSectionKey.startsWith('criterion:')) {
    const criterionLabel = fixSectionKey.replace('criterion:', '');
    return { type: 'criterion', criterionLabel };
  }

  // Default: treat as section key
  return { type: 'section', sectionKey: fixSectionKey as RfpSectionKey };
}

/**
 * Execute a focus action
 */
export function executeFocusAction(
  action: RfpFocusAction,
  callbacks: RfpFocusCallbacks
): void {
  const { target, scrollIntoView, markNeedsReview } = action;

  switch (target.type) {
    case 'section':
      callbacks.setSelectedSection?.(target.sectionKey);
      if (markNeedsReview) {
        callbacks.markSectionForReview?.(target.sectionKey);
      }
      if (scrollIntoView) {
        // Scroll to section in nav after a short delay for state to update
        setTimeout(() => {
          callbacks.scrollToElement?.(`section-nav-${target.sectionKey}`);
        }, 100);
      }
      break;

    case 'criterion':
      callbacks.openWinStrategyPanel?.();
      callbacks.setShowRubricMap?.(true);
      callbacks.setRubricViewMode?.('criteria');
      callbacks.setSelectedCriterion?.(target.criterionLabel);
      if (scrollIntoView) {
        setTimeout(() => {
          callbacks.scrollToElement?.(`criterion-${target.criterionLabel}`);
        }, 200);
      }
      break;

    case 'panel':
      if (target.panel === 'strategy' || target.panel === 'rubric' || target.panel === 'evaluator') {
        callbacks.openWinStrategyPanel?.();
        if (target.panel === 'rubric' || target.panel === 'evaluator') {
          callbacks.setShowRubricMap?.(true);
          callbacks.setRubricViewMode?.(target.mode || (target.panel === 'evaluator' ? 'evaluator' : 'criteria'));
        }
      }
      break;

    case 'persona':
      callbacks.openWinStrategyPanel?.();
      callbacks.setShowRubricMap?.(true);
      callbacks.setRubricViewMode?.('evaluator');
      break;
  }
}

/**
 * Create a focus action from a bid readiness fix
 */
export function createFocusActionFromFix(
  sectionKey: string,
  reason: string
): RfpFocusAction {
  const target = parseFocusTarget(sectionKey, reason);

  return {
    target,
    scrollIntoView: true,
    highlight: true,
    // Mark section for review if it's an actual content section
    markNeedsReview: target.type === 'section',
  };
}

/**
 * Get display label for a focus target
 */
export function getFocusTargetLabel(target: RfpFocusTarget): string {
  switch (target.type) {
    case 'section':
      return getSectionLabel(target.sectionKey);
    case 'criterion':
      return target.criterionLabel;
    case 'panel':
      return getPanelLabel(target.panel);
    case 'persona':
      return `${target.personaType} Evaluator`;
    default:
      return 'Unknown';
  }
}

/**
 * Get section label from key
 */
export function getSectionLabel(sectionKey: RfpSectionKey): string {
  const labels: Record<RfpSectionKey, string> = {
    agency_overview: 'Agency Overview',
    approach: 'Our Approach',
    team: 'Proposed Team',
    work_samples: 'Work Samples',
    plan_timeline: 'Plan & Timeline',
    pricing: 'Investment',
    references: 'References',
  };
  return labels[sectionKey] || sectionKey;
}

/**
 * Get panel label
 */
export function getPanelLabel(panel: RfpPanelType): string {
  const labels: Record<RfpPanelType, string> = {
    strategy: 'Win Strategy',
    rubric: 'Rubric Map',
    evaluator: 'Evaluator View',
    requirements: 'Requirements',
    bindings: 'Firm Brain',
  };
  return labels[panel] || panel;
}
