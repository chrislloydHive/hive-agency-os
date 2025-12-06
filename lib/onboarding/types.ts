// lib/onboarding/types.ts
// Types for "Run Everything Once" Onboarding Flow
//
// This orchestrates FCB → Labs Refinement → Full GAP Orchestrator
// to fully initialize a company's Context Graph in one pass.

import type { FCBRunResult } from '@/lib/contextGraph/fcb';
import type { LabRefinementRunResult, RefinementLabId } from '@/lib/labs/refinementTypes';
import type { ContextHealthScore } from '@/lib/contextGraph/health';

// ============================================================================
// Onboarding Step Types
// ============================================================================

/**
 * Steps in the onboarding pipeline
 */
export type OnboardingStep =
  | 'fcb'
  | 'audience_lab'
  | 'brand_lab'
  | 'creative_lab'
  | 'competitor_lab'
  | 'website_lab'
  | 'gap_orchestrator'
  | 'snapshot';

/**
 * Status of a single step
 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Result for a single step
 */
export interface StepResult {
  step: OnboardingStep;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

// ============================================================================
// Input/Output Types
// ============================================================================

/**
 * Input for running the full onboarding pass
 */
export interface OnboardingInput {
  companyId: string;
  /** Skip FCB if context already has foundational data */
  skipFcbIfPopulated?: boolean;
  /** Skip labs that are already complete (>90%) */
  skipCompleteLabs?: boolean;
  /** Run in dry-run mode (no writes) */
  dryRun?: boolean;
  /** Force run everything regardless of current state */
  force?: boolean;
}

/**
 * Result of the full onboarding pass
 */
export interface OnboardingResult {
  success: boolean;
  companyId: string;
  companyName: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;

  // Step results
  steps: StepResult[];

  // FCB result
  fcb: FCBRunResult | null;

  // Lab refinement results
  labs: {
    audience: LabRefinementRunResult | null;
    brand: LabRefinementRunResult | null;
    creative: LabRefinementRunResult | null;
    competitor: LabRefinementRunResult | null;
    website: LabRefinementRunResult | null;
  };

  // GAP Orchestrator result (simplified)
  gap: {
    success: boolean;
    labsRun: string[];
    insightsGenerated: number;
    snapshotId?: string;
    error?: string;
  } | null;

  // Context health before/after
  contextHealthBefore: ContextHealthScore;
  contextHealthAfter: ContextHealthScore;

  // Snapshot ID for QBR
  snapshotId?: string;

  // Summary stats
  summary: {
    fieldsPopulated: number;
    fieldsRefined: number;
    insightsGenerated: number;
    healthImprovement: number;
  };

  // Error if failed
  error?: string;
}

/**
 * Progress update for streaming UI
 */
export interface OnboardingProgress {
  currentStep: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  stepStatus: StepStatus;
  stepMessage: string;
  overallProgress: number; // 0-100
  steps: StepResult[];
}

// ============================================================================
// Step Configuration
// ============================================================================

/**
 * Ordered list of onboarding steps
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  'fcb',
  'audience_lab',
  'brand_lab',
  'creative_lab',
  'competitor_lab',
  'website_lab',
  'gap_orchestrator',
  'snapshot',
];

/**
 * Human-readable labels for steps
 */
export const STEP_LABELS: Record<OnboardingStep, string> = {
  fcb: 'Auto-fill from Website (FCB)',
  audience_lab: 'Audience Lab Refinement',
  brand_lab: 'Brand Lab Refinement',
  creative_lab: 'Creative Lab Refinement',
  competitor_lab: 'Competitor Lab Refinement',
  website_lab: 'Website Lab Refinement',
  gap_orchestrator: 'Full GAP Analysis',
  snapshot: 'Create Baseline Snapshot',
};

/**
 * Map lab step to RefinementLabId
 */
export const STEP_TO_LAB_ID: Partial<Record<OnboardingStep, RefinementLabId>> = {
  audience_lab: 'audience',
  brand_lab: 'brand',
  creative_lab: 'creative',
  competitor_lab: 'competitor',
  website_lab: 'website',
};
