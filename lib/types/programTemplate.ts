// lib/types/programTemplate.ts
// Program Template Types for Domain-level Program Instantiation
//
// This defines the Program Template system that maps commercial scope (bundles)
// into OS Programs without importing pricing or margin data.
//
// Conceptual Model:
// - Airtable decides: What is sold, at what level of intensity
// - Hive OS decides: What gets executed, how work is structured, what signals success
// - OS receives SCOPE, not PRICE

import { z } from 'zod';
import type { WorkstreamType } from './program';

// ============================================================================
// Program Domain (6 domains)
// ============================================================================

export const ProgramDomainSchema = z.enum([
  'Strategy',
  'Creative',
  'Media',
  'LocalVisibility',
  'Analytics',
  'Operations',
]);

export type ProgramDomain = z.infer<typeof ProgramDomainSchema>;

export const PROGRAM_DOMAIN_LABELS: Record<ProgramDomain, string> = {
  Strategy: 'Strategy',
  Creative: 'Creative',
  Media: 'Media',
  LocalVisibility: 'Local Visibility',
  Analytics: 'Analytics',
  Operations: 'Operations',
};

export const PROGRAM_DOMAIN_DESCRIPTIONS: Record<ProgramDomain, string> = {
  Strategy: 'Strategic planning, QBR preparation, and performance analysis',
  Creative: 'Creative asset production, variations, and testing insights',
  Media: 'Media optimization, budget shifts, and channel learnings',
  LocalVisibility: 'GBP updates, local visibility improvements, and engagement',
  Analytics: 'Dashboards, attribution insights, and signal quality',
  Operations: 'Status updates, QBR narratives, and stakeholder alignment',
};

// ============================================================================
// Intensity Levels
// ============================================================================

export const IntensityLevelSchema = z.enum(['Core', 'Standard', 'Aggressive']);

export type IntensityLevel = z.infer<typeof IntensityLevelSchema>;

export const INTENSITY_LEVEL_LABELS: Record<IntensityLevel, string> = {
  Core: 'Core',
  Standard: 'Standard',
  Aggressive: 'Aggressive',
};

export const INTENSITY_LEVEL_DESCRIPTIONS: Record<IntensityLevel, string> = {
  Core: 'Reduced cadence, fewer outputs, minimal experimentation',
  Standard: 'Full cadence, regular optimization, continuous learning',
  Aggressive: 'Increased frequency, expanded testing, deeper analysis',
};

// ============================================================================
// Cadence Types
// ============================================================================

export const CadenceTypeSchema = z.enum(['weekly', 'monthly', 'quarterly']);

export type CadenceType = z.infer<typeof CadenceTypeSchema>;

export const CADENCE_LABELS: Record<CadenceType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

// ============================================================================
// Intensity Configuration
// ============================================================================

export const IntensityConfigSchema = z.object({
  /** Active cadences for this intensity level */
  cadence: z.array(CadenceTypeSchema),
  /** Multiplier for output volume (0.6 Core, 1.0 Standard, 1.5 Aggressive) */
  outputMultiplier: z.number().min(0).max(2),
  /** Experimentation budget level */
  experimentationBudget: z.enum(['none', 'limited', 'full']),
  /** Depth of analysis and reporting */
  analysisDepth: z.enum(['basic', 'regular', 'deep']),
});

export type IntensityConfig = z.infer<typeof IntensityConfigSchema>;

// ============================================================================
// Expected Output
// ============================================================================

export const ExpectedOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  /** Workstream this output belongs to */
  workstreamType: z.string(), // WorkstreamType but stored as string for flexibility
  /** How often this output is produced */
  cadence: CadenceTypeSchema,
  /** Whether output count scales with cadence (e.g., weekly = 4x monthly) */
  scaledByCadence: z.boolean().optional(),
  /** Deliverable type hint */
  deliverableType: z.enum(['document', 'asset', 'campaign', 'integration', 'process', 'other']).optional(),
});

export type ExpectedOutput = z.infer<typeof ExpectedOutputSchema>;

// ============================================================================
// Success Signals
// ============================================================================

export const SuccessSignalSchema = z.object({
  id: z.string(),
  metric: z.string(),
  description: z.string().optional(),
  /** Direction we want this metric to move */
  targetDirection: z.enum(['increase', 'decrease', 'maintain']),
  /** How often we measure this signal */
  measurementFrequency: CadenceTypeSchema,
});

export type SuccessSignal = z.infer<typeof SuccessSignalSchema>;

// ============================================================================
// Program Template (Main Definition)
// ============================================================================

export const ProgramTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: ProgramDomainSchema,
  description: z.string(),

  /** Intensity rules for each level */
  intensityLevels: z.record(IntensityLevelSchema, IntensityConfigSchema),

  /** Allowed workstream types for work items */
  allowedWorkTypes: z.array(z.string()), // WorkstreamType[]

  /** Maximum concurrent work items per intensity level */
  maxConcurrentWork: z.record(IntensityLevelSchema, z.number()),

  /** Expected deliverables/outputs */
  expectedOutputs: z.array(ExpectedOutputSchema),

  /** Success metrics and signals */
  successSignals: z.array(SuccessSignalSchema),
});

export type ProgramTemplate = z.infer<typeof ProgramTemplateSchema>;

// ============================================================================
// Bundle Instantiation Request
// ============================================================================

export const BundleInstantiationRequestSchema = z.object({
  /** Identifier for the bundle (e.g., "local-demand-engine-standard") */
  bundleId: z.string(),
  /** Domains to instantiate Programs for */
  domains: z.array(ProgramDomainSchema),
  /** Intensity level to apply to all Programs */
  intensity: IntensityLevelSchema,
  /** Start date for the engagement (ISO date string) */
  startDate: z.string(),
  /** Company to create Programs for */
  companyId: z.string(),
  /** Strategy to link Programs to */
  strategyId: z.string(),
  /** Optional: Override title prefix */
  titlePrefix: z.string().optional(),
});

export type BundleInstantiationRequest = z.infer<typeof BundleInstantiationRequestSchema>;

// ============================================================================
// Bundle Instantiation Result
// ============================================================================

export const BundleInstantiationResultSchema = z.object({
  success: z.boolean(),
  bundleId: z.string(),
  programs: z.array(z.object({
    programId: z.string(),
    domain: ProgramDomainSchema,
    title: z.string(),
    status: z.enum(['created', 'already_exists', 'failed']),
    error: z.string().optional(),
  })),
  errors: z.array(z.string()).optional(),
  summary: z.object({
    created: z.number(),
    skipped: z.number(),
    failed: z.number(),
  }),
  /** Debug ID for event tracing (returned from API) */
  debugId: z.string().optional(),
});

export type BundleInstantiationResult = z.infer<typeof BundleInstantiationResultSchema>;

// ============================================================================
// Scope Check Types (for Guardrails)
// ============================================================================

export const ScopeCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  escalationRequired: z.boolean().optional().default(false),
});

export type ScopeCheckResult = z.infer<typeof ScopeCheckResultSchema>;

// ============================================================================
// AI Capability Types
// ============================================================================

export const AICapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Whether AI can perform this action */
  allowed: z.boolean(),
  /** Whether human approval is required */
  requiresApproval: z.boolean(),
  description: z.string(),
});

export type AICapability = z.infer<typeof AICapabilitySchema>;

// ============================================================================
// Domain → Workstream Mapping
// ============================================================================

/**
 * Maps Program Domains to their allowed Workstream types
 */
export const DOMAIN_WORKSTREAM_MAP: Record<ProgramDomain, WorkstreamType[]> = {
  Strategy: ['ops', 'analytics'],
  Creative: ['content', 'brand', 'social'],
  Media: ['paid_media'],
  LocalVisibility: ['seo', 'partnerships'],
  Analytics: ['analytics'],
  Operations: ['ops'],
};

/**
 * Get allowed workstreams for a domain
 */
export function getAllowedWorkstreamsForDomain(domain: ProgramDomain): WorkstreamType[] {
  return DOMAIN_WORKSTREAM_MAP[domain] || [];
}

/**
 * Check if a workstream is allowed for a domain
 */
export function isWorkstreamAllowedForDomain(domain: ProgramDomain, workstream: WorkstreamType): boolean {
  return DOMAIN_WORKSTREAM_MAP[domain]?.includes(workstream) ?? false;
}

// ============================================================================
// Intensity Helpers
// ============================================================================

/**
 * Get output multiplier for an intensity level
 */
export function getOutputMultiplier(intensity: IntensityLevel): number {
  const multipliers: Record<IntensityLevel, number> = {
    Core: 0.6,
    Standard: 1.0,
    Aggressive: 1.5,
  };
  return multipliers[intensity];
}

/**
 * Get max concurrent work for an intensity level (default values)
 */
export function getDefaultMaxConcurrentWork(intensity: IntensityLevel): number {
  const defaults: Record<IntensityLevel, number> = {
    Core: 2,
    Standard: 4,
    Aggressive: 6,
  };
  return defaults[intensity];
}

// ============================================================================
// Bundle Preset
// ============================================================================

export const BundlePresetSchema = z.object({
  /** Unique identifier for this preset */
  id: z.string(),
  /** Human-readable name for display */
  name: z.string(),
  /** Short description of what this bundle includes */
  description: z.string(),
  /** Domains included in this bundle */
  domains: z.array(ProgramDomainSchema),
  /** Default intensity level for this bundle */
  defaultIntensity: IntensityLevelSchema,
  /** Whether this preset is available for selection */
  enabled: z.boolean().default(true),
  /** Optional client or use case this preset is designed for */
  targetClient: z.string().optional(),
  /** Sort order for display in UI */
  sortOrder: z.number().optional(),
});

export type BundlePreset = z.infer<typeof BundlePresetSchema>;

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a stable bundle key for idempotent instantiation
 */
export function generateBundleKey(companyId: string, bundleId: string): string {
  return `bundle::${companyId}::${bundleId}`;
}

/**
 * Generate a stable program key within a bundle
 */
export function generateBundleProgramKey(bundleId: string, domain: ProgramDomain): string {
  return `${bundleId}::${domain.toLowerCase()}`;
}
