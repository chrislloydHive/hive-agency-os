// lib/os/strategy/strategyInputsHelpers.ts
// Client-safe helpers for strategy inputs
//
// These are pure functions with no server dependencies.
// Can be safely imported in client components.
//
// NOTE: Uses the unified Context-Strategy Registry for field definitions.
// See lib/os/registry/contextStrategyRegistry.ts for the single source of truth.

// Import directly from client-safe registry (NOT from index.ts barrel which includes server-only code)
import {
  getFieldsRequiredFor,
  getCriticalFields,
  getRegistryEntry,
  type ContextStrategyField,
  type StrategySection,
} from '@/lib/os/registry/contextStrategyRegistry';

// ============================================================================
// Types (re-exported for convenience)
// ============================================================================

/**
 * Provenance info for a field
 */
export interface ProvenanceInfo {
  source: string;
  updatedAt: string | null;
  confidence: number | null;
  fieldPath: string;
}

/**
 * Business reality section - core identity and audience
 */
export interface BusinessReality {
  stage: string | null;
  businessModel: string | null;
  primaryOffering: string | null;
  primaryAudience: string | null;
  icpDescription: string | null;
  goals: string[];
  valueProposition: string | null;
  industry: string | null;
  geographicFootprint: string | null;
}

/**
 * Business reality with provenance for drawer
 */
export interface BusinessRealityWithProvenance extends BusinessReality {
  provenance: {
    stage: ProvenanceInfo | null;
    businessModel: ProvenanceInfo | null;
    primaryOffering: ProvenanceInfo | null;
    primaryAudience: ProvenanceInfo | null;
    icpDescription: ProvenanceInfo | null;
    goals: ProvenanceInfo | null;
    valueProposition: ProvenanceInfo | null;
    industry: ProvenanceInfo | null;
    geographicFootprint: ProvenanceInfo | null;
  };
}

/**
 * Constraints section - budget, timing, restrictions
 */
export interface Constraints {
  minBudget: number | null;
  maxBudget: number | null;
  budgetCapsFloors: Array<{
    type: 'cap' | 'floor';
    scope: string;
    amount: number;
    period: string;
  }>;
  launchDeadlines: string[];
  channelRestrictions: Array<{
    channelId: string;
    restrictionType: string;
    reason: string | null;
  }>;
  complianceRequirements: string[];
  legalRestrictions: string | null;
}

/**
 * Constraints with provenance
 */
export interface ConstraintsWithProvenance extends Constraints {
  provenance: {
    minBudget: ProvenanceInfo | null;
    maxBudget: ProvenanceInfo | null;
    budgetCapsFloors: ProvenanceInfo | null;
    launchDeadlines: ProvenanceInfo | null;
    channelRestrictions: ProvenanceInfo | null;
    complianceRequirements: ProvenanceInfo | null;
    legalRestrictions: ProvenanceInfo | null;
  };
}

/**
 * Competitive landscape section
 */
export interface CompetitiveLandscape {
  competitors: Array<{
    name: string;
    category: string | null;
    positioning: string | null;
    threatLevel: number | null;
  }>;
  positioningAxisPrimary: string | null;
  positioningAxisSecondary: string | null;
  positionSummary: string | null;
  competitiveAdvantages: string[];
  sourceVersion: 'v4' | 'v3' | 'none';
  sourceRunId: string | null;
  sourceRunDate: string | null;
}

/**
 * Execution capabilities - what Hive can deliver
 */
export interface ExecutionCapabilities {
  serviceTaxonomy: string[];
  operatingPrinciples: string[];
  doctrineVersion: string;
}

/**
 * Metadata about the inputs
 */
export interface StrategyInputsMeta {
  contextRevisionId: string | null;
  lastUpdatedAt: string | null;
  sourcesUsed: string[];
  completenessScore: number | null;
}

/**
 * Complete Strategy Inputs ViewModel
 */
export interface StrategyInputs {
  businessReality: BusinessReality;
  constraints: Constraints;
  competition: CompetitiveLandscape;
  executionCapabilities: ExecutionCapabilities;
  meta: StrategyInputsMeta;
}

/**
 * Strategy Inputs with full provenance for details drawer
 */
export interface StrategyInputsWithProvenance {
  businessReality: BusinessRealityWithProvenance;
  constraints: ConstraintsWithProvenance;
  competition: CompetitiveLandscape;
  executionCapabilities: ExecutionCapabilities;
  meta: StrategyInputsMeta;
}

// ============================================================================
// Strategy Readiness Computation
// ============================================================================

/**
 * Critical input definition for strategy readiness
 */
export interface CriticalInput {
  id: string;
  label: string;
  section: 'businessReality' | 'constraints' | 'competition' | 'executionCapabilities';
  fieldPath: string;
  registryKey: string; // Key in the registry
  check: (inputs: StrategyInputs) => boolean;
  warningMessage: string;
  fixHint: string;
}

/**
 * Build critical inputs from the registry
 * The registry is the single source of truth for which fields are critical
 */
function buildCriticalInputs(): CriticalInput[] {
  const criticalFields = getCriticalFields().filter(f => f.requiredFor.includes('strategy'));

  // Map registry entries to CriticalInput format with check functions
  const inputs: CriticalInput[] = [];

  for (const field of criticalFields) {
    const section = field.strategySection as CriticalInput['section'];
    if (!section) continue;

    // Build check function based on registry field
    const check = buildCheckFunction(field);

    inputs.push({
      id: field.key,
      label: field.shortLabel || field.label,
      section,
      fieldPath: field.graphPath || field.legacyPath,
      registryKey: field.key,
      check,
      warningMessage: `${field.label} not set — strategy recommendations may be generic.`,
      fixHint: `Add ${field.shortLabel || field.label}`,
    });
  }

  // Add execution capabilities (special case - from Hive Brain, not registry)
  inputs.push({
    id: 'executionCapabilities',
    label: 'Execution Capabilities',
    section: 'executionCapabilities',
    fieldPath: 'capabilities',
    registryKey: 'capabilities',
    check: (inputs) => inputs.executionCapabilities.serviceTaxonomy.length > 0,
    warningMessage: 'Execution capabilities incomplete — recommendations may include unsupported services.',
    fixHint: 'Configure Hive services',
  });

  return inputs;
}

/**
 * Build a check function for a registry field
 */
function buildCheckFunction(field: ContextStrategyField): (inputs: StrategyInputs) => boolean {
  const strategyField = field.strategyField;
  const section = field.strategySection;

  if (!section || !strategyField) {
    return () => false;
  }

  return (inputs: StrategyInputs) => {
    const sectionData = inputs[section];
    if (!sectionData) return false;

    const value = (sectionData as unknown as Record<string, unknown>)[strategyField];

    // Handle different value types
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return true;
    if (typeof value === 'object') return Object.keys(value).length > 0;

    return !!value;
  };
}

/**
 * Critical inputs that affect strategy quality
 * Built from the registry at runtime
 */
const CRITICAL_INPUTS: CriticalInput[] = buildCriticalInputs();

/**
 * Strategy readiness result
 */
export interface StrategyReadiness {
  isReady: boolean;
  completenessPercent: number;
  missingCritical: CriticalInput[];
  warnings: Array<{ message: string; section: CriticalInput['section']; fixHint: string }>;
  canSynthesize: boolean;
  synthesizeBlockReason: string | null;
}

/**
 * Compute strategy readiness from inputs
 */
export function computeStrategyReadiness(inputs: StrategyInputs): StrategyReadiness {
  const missingCritical = CRITICAL_INPUTS.filter(input => !input.check(inputs));
  const completenessPercent = Math.round(
    ((CRITICAL_INPUTS.length - missingCritical.length) / CRITICAL_INPUTS.length) * 100
  );

  const warnings = missingCritical.map(input => ({
    message: input.warningMessage,
    section: input.section,
    fixHint: input.fixHint,
  }));

  // Soft gate: block Synthesize if 2+ critical inputs missing
  const canSynthesize = missingCritical.length < 2;
  const synthesizeBlockReason = missingCritical.length >= 2
    ? `${missingCritical.length} critical inputs missing: ${missingCritical.map(i => i.label).join(', ')}`
    : null;

  return {
    isReady: missingCritical.length === 0,
    completenessPercent,
    missingCritical,
    warnings,
    canSynthesize,
    synthesizeBlockReason,
  };
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Get Context page deep link for a section
 */
export function getContextDeepLink(companyId: string, section: CriticalInput['section']): string {
  const sectionAnchors: Record<CriticalInput['section'], string> = {
    businessReality: 'identity',
    constraints: 'constraints',
    competition: 'competitive',
    executionCapabilities: 'capabilities',
  };
  return `/c/${companyId}/context#${sectionAnchors[section]}`;
}

/**
 * Get Context page deep link for a specific field using the registry
 * Returns a URL with focusKey and zone params for deep linking
 */
export function getContextDeepLinkForField(companyId: string, registryKey: string): string {
  const field = getRegistryEntry(registryKey);
  if (!field) {
    return `/c/${companyId}/context`;
  }

  // Use focusKey for specific field, zone as fallback
  return `/c/${companyId}/context?focusKey=${encodeURIComponent(registryKey)}&zone=${encodeURIComponent(field.zoneId)}`;
}

/**
 * Get fix link for a critical input using the registry
 */
export function getFixLinkForCriticalInput(companyId: string, input: CriticalInput): {
  href: string;
  label: string;
  fieldLabel: string;
} {
  // Special case for execution capabilities (Hive Brain setting)
  if (input.id === 'executionCapabilities') {
    return {
      href: getHiveBrainLink(),
      label: 'Configure in Hive Brain',
      fieldLabel: input.label,
    };
  }

  return {
    href: getContextDeepLinkForField(companyId, input.registryKey),
    label: 'Update Facts',
    fieldLabel: input.label,
  };
}

/**
 * Get Hive Brain settings link
 */
export function getHiveBrainLink(): string {
  return '/settings/hive-brain';
}

/**
 * Get Context page deep link for multiple blocked keys (Update Facts button)
 * This navigates to the Context page and highlights all blocked fields
 *
 * @param companyId - Company ID
 * @param blockedKeys - Array of blocked field keys
 * @returns URL with focusKeys param for Fix navigation
 */
export function getFixBlockersLink(companyId: string, blockedKeys: string[]): string {
  if (blockedKeys.length === 0) {
    return `/c/${companyId}/context`;
  }

  if (blockedKeys.length === 1) {
    // Single key - use focusKey param
    return getContextDeepLinkForField(companyId, blockedKeys[0]);
  }

  // Multiple keys - use focusKeys param (comma-separated)
  return `/c/${companyId}/context?focusKeys=${encodeURIComponent(blockedKeys.join(','))}`;
}

/**
 * Get Fix button data for blocked-by display
 * Returns all info needed to render the Fix button
 */
export function getFixButtonData(
  companyId: string,
  blockedLabels: string[],
  blockedKeys: string[]
): {
  href: string;
  label: string;
  blockedByText: string;
  count: number;
} {
  const href = getFixBlockersLink(companyId, blockedKeys);
  const count = blockedKeys.length;

  // Build "Blocked by: X, Y, Z" text
  const blockedByText = blockedLabels.length > 0
    ? `Blocked by: ${blockedLabels.slice(0, 3).join(', ')}${blockedLabels.length > 3 ? ` +${blockedLabels.length - 3} more` : ''}`
    : '';

  return {
    href,
    label: count > 1 ? `Fix ${count} fields` : 'Fix',
    blockedByText,
    count,
  };
}

// ============================================================================
// AI Recommended Next Step
// ============================================================================

/**
 * Possible next steps the AI can recommend
 */
export type AINextStepType =
  | 'complete_context'
  | 'complete_audience'
  | 'complete_budget'
  | 'run_competition_analysis'
  | 'create_first_artifact'
  | 'explore_growth_options'
  | 'synthesize_strategy'
  | 'promote_to_canonical'
  | 'build_website_program'
  | 'strategy_complete';

/**
 * Recommended next step from AI
 */
export interface AIRecommendedNextStep {
  type: AINextStepType;
  label: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  actionType: 'link' | 'modal' | 'ai_action';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Compute the single AI-recommended next step
 * Priority order:
 * 1. Critical context gaps (high priority)
 * 2. Create first artifact (if empty)
 * 3. Explore growth options (if few artifacts)
 * 4. Synthesize strategy (if ready)
 * 5. Promote to canonical (if candidates exist)
 * 6. Build website program (if strategy exists)
 */
export function computeAIRecommendedNextStep(
  inputs: StrategyInputs,
  artifactCount: number,
  hasCanonicalStrategy: boolean,
  hasCandidateArtifacts: boolean,
  hasWebsiteProgram: boolean,
  companyId: string
): AIRecommendedNextStep {
  const readiness = computeStrategyReadiness(inputs);

  // 1. Critical: No audience defined
  if (!inputs.businessReality.primaryAudience && !inputs.businessReality.icpDescription) {
    return {
      type: 'complete_audience',
      label: 'Define Your Audience',
      description: 'AI needs to know who you serve to build an effective strategy',
      actionLabel: 'Add Audience',
      actionHref: `/c/${companyId}/context#identity`,
      actionType: 'link',
      priority: 'high',
    };
  }

  // 2. Critical: No primary offering
  if (!inputs.businessReality.primaryOffering) {
    return {
      type: 'complete_context',
      label: 'Define Your Offering',
      description: 'AI needs to know what you sell to recommend positioning',
      actionLabel: 'Add Offering',
      actionHref: `/c/${companyId}/context#identity`,
      actionType: 'link',
      priority: 'high',
    };
  }

  // 3. Important: No budget constraints
  if (!inputs.constraints.minBudget && !inputs.constraints.maxBudget) {
    return {
      type: 'complete_budget',
      label: 'Set Budget Range',
      description: 'AI will tailor recommendations to your investment capacity',
      actionLabel: 'Add Budget',
      actionHref: `/c/${companyId}/context#constraints`,
      actionType: 'link',
      priority: 'medium',
    };
  }

  // 4. No artifacts - create first
  if (artifactCount === 0) {
    return {
      type: 'create_first_artifact',
      label: 'Start Your Strategy',
      description: 'Let AI generate growth options based on your context',
      actionLabel: 'Generate Options',
      actionType: 'ai_action',
      priority: 'high',
    };
  }

  // 5. Few artifacts - explore more options
  if (artifactCount < 3 && !hasCanonicalStrategy) {
    return {
      type: 'explore_growth_options',
      label: 'Explore More Options',
      description: 'AI can generate additional growth options to compare',
      actionLabel: 'Generate More',
      actionType: 'ai_action',
      priority: 'medium',
    };
  }

  // 6. Ready to synthesize but no canonical
  if (readiness.canSynthesize && artifactCount >= 2 && !hasCanonicalStrategy) {
    return {
      type: 'synthesize_strategy',
      label: 'Synthesize Strategy',
      description: 'AI will combine your best artifacts into a cohesive strategy',
      actionLabel: 'Synthesize',
      actionType: 'ai_action',
      priority: 'high',
    };
  }

  // 7. Has candidates but no canonical
  if (hasCandidateArtifacts && !hasCanonicalStrategy) {
    return {
      type: 'promote_to_canonical',
      label: 'Promote to Canonical',
      description: 'Finalize your strategy by promoting candidate artifacts',
      actionLabel: 'Promote',
      actionType: 'modal',
      priority: 'high',
    };
  }

  // 8. Has strategy but no website program
  if (hasCanonicalStrategy && !hasWebsiteProgram) {
    return {
      type: 'build_website_program',
      label: 'Build Website Program',
      description: 'Translate your strategy into a prioritized execution plan',
      actionLabel: 'Build Program',
      actionHref: `/c/${companyId}/programs`,
      actionType: 'link',
      priority: 'high',
    };
  }

  // Default: Strategy is complete
  return {
    type: 'strategy_complete',
    label: 'Strategy Complete',
    description: 'Your strategy and programs are up to date',
    actionLabel: 'Review',
    actionType: 'modal',
    priority: 'low',
  };
}

// ============================================================================
// AI Summary Data
// ============================================================================

/**
 * Data for the AI summary view
 */
export interface AIStrategySummaryData {
  currentState: {
    label: string;
    description: string;
  };
  strategicIntent: {
    label: string;
    description: string;
  } | null;
  keyConstraints: string[];
  completenessPercent: number;
  nextStep: AIRecommendedNextStep;
}

/**
 * Compute AI summary data for display
 */
export function computeAIStrategySummaryData(
  inputs: StrategyInputs,
  artifactCount: number,
  hasCanonicalStrategy: boolean,
  hasCandidateArtifacts: boolean,
  hasWebsiteProgram: boolean,
  companyId: string,
  canonicalStrategyContent?: string | null
): AIStrategySummaryData {
  const readiness = computeStrategyReadiness(inputs);
  const nextStep = computeAIRecommendedNextStep(
    inputs,
    artifactCount,
    hasCanonicalStrategy,
    hasCandidateArtifacts,
    hasWebsiteProgram,
    companyId
  );

  // Determine current state
  let currentState: { label: string; description: string };
  if (!inputs.businessReality.primaryAudience && !inputs.businessReality.icpDescription) {
    currentState = {
      label: 'Getting Started',
      description: 'Context is incomplete. Add your audience and offering to begin.',
    };
  } else if (artifactCount === 0) {
    currentState = {
      label: 'Ready to Explore',
      description: 'Context is set. Generate growth options to explore strategic directions.',
    };
  } else if (!hasCanonicalStrategy) {
    currentState = {
      label: 'Exploring Options',
      description: `${artifactCount} artifact${artifactCount > 1 ? 's' : ''} created. Continue exploring or synthesize into strategy.`,
    };
  } else if (!hasWebsiteProgram) {
    currentState = {
      label: 'Strategy Defined',
      description: 'Canonical strategy is set. Build programs to execute.',
    };
  } else {
    currentState = {
      label: 'Executing',
      description: 'Strategy and programs are active. Monitor and iterate.',
    };
  }

  // Determine strategic intent (from canonical or inferred)
  let strategicIntent: { label: string; description: string } | null = null;
  if (canonicalStrategyContent) {
    strategicIntent = {
      label: 'Strategic Direction',
      description: canonicalStrategyContent.slice(0, 200) + (canonicalStrategyContent.length > 200 ? '...' : ''),
    };
  } else if (inputs.businessReality.valueProposition) {
    strategicIntent = {
      label: 'Value Proposition',
      description: inputs.businessReality.valueProposition,
    };
  }

  // Key constraints
  const keyConstraints: string[] = [];
  if (inputs.constraints.minBudget || inputs.constraints.maxBudget) {
    const min = inputs.constraints.minBudget ? `$${inputs.constraints.minBudget.toLocaleString()}` : '';
    const max = inputs.constraints.maxBudget ? `$${inputs.constraints.maxBudget.toLocaleString()}` : '';
    keyConstraints.push(`Budget: ${min}${min && max ? ' – ' : ''}${max}`);
  }
  if (inputs.constraints.launchDeadlines.length > 0) {
    keyConstraints.push(`Deadline: ${inputs.constraints.launchDeadlines[0]}`);
  }
  if (inputs.constraints.channelRestrictions.length > 0) {
    keyConstraints.push(`${inputs.constraints.channelRestrictions.length} channel restriction${inputs.constraints.channelRestrictions.length > 1 ? 's' : ''}`);
  }

  return {
    currentState,
    strategicIntent,
    keyConstraints,
    completenessPercent: readiness.completenessPercent,
    nextStep,
  };
}
