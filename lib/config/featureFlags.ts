// lib/config/featureFlags.ts
// Feature Flags Configuration
//
// Controls access to experimental/unreleased features.
// Default: OFF for unstable features, ON for core features.

export const FEATURE_FLAGS = {
  // ============================================================================
  // DISABLED BY DEFAULT (experimental/unreleased)
  // ============================================================================

  /** Labs system - audience, creative strategy, execution, media labs */
  LABS_ENABLED: process.env.NEXT_PUBLIC_FEATURE_LABS === 'true',

  /** Daily briefing panel and API */
  DAILY_BRIEFING_ENABLED: process.env.NEXT_PUBLIC_FEATURE_DAILY_BRIEFING === 'true',

  /** Automation system - triggers, rules, activity panel */
  AUTOMATION_ENABLED: process.env.NEXT_PUBLIC_FEATURE_AUTOMATION === 'true',

  /** Flow system debug UI - internal admin panel for flow diagnostics */
  FLOW_SYSTEM_DEBUG_UI: process.env.FLOW_SYSTEM_DEBUG_UI === 'true',

  /** Context V4 Convergence - decision-grade proposals with specificity scoring */
  CONTEXT_V4_CONVERGENCE_ENABLED: process.env.CONTEXT_V4_CONVERGENCE_ENABLED === 'true',

  // ============================================================================
  // ENABLED BY DEFAULT (core features)
  // ============================================================================

  /** Context workspace - always on */
  CONTEXT_WORKSPACE_ENABLED: true,

  /** Strategy workspace - always on */
  STRATEGY_WORKSPACE_ENABLED: true,

  /** QBR reports - always on */
  QBR_ENABLED: true,
} as const;

// Type for feature flag keys
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

// Helper to check if a feature is enabled
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}

// Response for disabled feature (API routes)
export const FEATURE_DISABLED_RESPONSE = {
  error: 'Feature not enabled',
  code: 'FEATURE_DISABLED',
} as const;
