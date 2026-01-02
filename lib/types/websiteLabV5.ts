// lib/types/websiteLabV5.ts
// Website Lab V5 Types - Shared type definitions for UI and logic layers
//
// These types define the structure of V5 diagnostic output.
// Import from here for stable UI imports.

// ============================================================================
// PERSONA TYPE
// ============================================================================

export type V5PersonaType = 'first_time' | 'ready_to_buy' | 'comparison_shopper';

export const PERSONA_LABELS: Record<V5PersonaType, string> = {
  first_time: 'First-Time Visitor',
  ready_to_buy: 'Ready to Buy',
  comparison_shopper: 'Comparison Shopper',
};

// ============================================================================
// V5 OUTPUT TYPES
// ============================================================================

export type V5PageObservation = {
  pagePath: string;
  pageType: string;
  aboveFoldElements: string[];
  primaryCTAs: Array<{
    text: string;
    position: 'above_fold' | 'mid_page' | 'below_fold';
    destination: string | null;
  }>;
  trustProofElements: string[];
  missingUnclearElements: string[];
};

export type V5PersonaJourney = {
  persona: V5PersonaType;
  startingPage: string;
  intendedGoal: string;
  actualPath: string[];
  failurePoint: { page: string; reason: string } | null;
  confidenceScore: number;
  succeeded: boolean;
};

export type V5BlockingIssue = {
  id: number;
  severity: 'high' | 'medium' | 'low';
  affectedPersonas: V5PersonaType[];
  page: string;
  whyItBlocks: string;
  concreteFix: { what: string; where: string };
};

export type V5QuickWin = {
  addressesIssueId: number;
  title: string;
  action: string;
  page: string;
  expectedImpact: string;
};

export type V5StructuralChange = {
  addressesIssueIds: number[];
  title: string;
  description: string;
  pagesAffected: string[];
  rationale: string;
};

export type V5DiagnosticOutput = {
  observations: V5PageObservation[];
  personaJourneys: V5PersonaJourney[];
  blockingIssues: V5BlockingIssue[];
  quickWins: V5QuickWin[];
  structuralChanges: V5StructuralChange[];
  score: number;
  scoreJustification: string;
};

// ============================================================================
// VERDICT DERIVATION
// ============================================================================

export type V5Verdict = 'STRONG' | 'MIXED' | 'WEAK';

export function deriveVerdict(score: number): V5Verdict {
  if (score >= 80) return 'STRONG';
  if (score >= 60) return 'MIXED';
  return 'WEAK';
}

export const VERDICT_CONFIG: Record<V5Verdict, { label: string; color: string; bgColor: string }> = {
  STRONG: { label: 'Strong', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  MIXED: { label: 'Mixed', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  WEAK: { label: 'Needs Work', color: 'text-red-400', bgColor: 'bg-red-500/10' },
};
