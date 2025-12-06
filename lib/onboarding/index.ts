// lib/onboarding/index.ts
// Onboarding Module - "Run Everything Once"

export { runOnboarding, type OnboardingProgressCallback } from './runOnboarding';
export type {
  OnboardingInput,
  OnboardingResult,
  OnboardingStep,
  OnboardingProgress,
  StepResult,
  StepStatus,
} from './types';
export { ONBOARDING_STEPS, STEP_LABELS } from './types';
