// lib/contextGraph/contextGateway.ts
// Context Gateway - Unified Read API for Company Context
//
// This is the ONLY API that SSM, QBR engines, Labs, and planner tools
// should use to fetch company context. It provides:
// - Scoped context loading (only load what you need)
// - Confidence and freshness filtering
// - Snapshot support for historical views
// - LLM-ready prompt generation

import type { CompanyContextGraph, DomainName } from './companyContextGraph';
import type { WithMetaType, ProvenanceTag } from './types';
import { loadContextGraph } from './storage';
import { getVersionById, type ContextGraphVersion } from './history';
import { getFieldFreshness, type FreshnessScore } from './freshness';

// ============================================================================
// Types
// ============================================================================

/**
 * Context scope identifiers - maps to domain names
 */
export type ContextScopeId =
  | 'identity'
  | 'brand'
  | 'objectives'
  | 'audience'
  | 'productOffer'
  | 'digitalInfra'
  | 'website'
  | 'content'
  | 'seo'
  | 'ops'
  | 'performanceMedia'
  | 'historical'
  | 'creative'
  | 'competitive'
  | 'budgetOps'
  | 'operationalConstraints'
  | 'storeRisk'
  | 'historyRefs';

/**
 * Scope labels for display
 */
export const SCOPE_LABELS: Record<ContextScopeId, string> = {
  identity: 'Company Identity',
  brand: 'Brand & Messaging',
  objectives: 'Business Objectives',
  audience: 'Target Audience',
  productOffer: 'Products & Services',
  digitalInfra: 'Digital Infrastructure',
  website: 'Website',
  content: 'Content',
  seo: 'SEO',
  ops: 'Operations',
  performanceMedia: 'Performance Media',
  historical: 'Historical Performance',
  creative: 'Creative Assets',
  competitive: 'Competitive Landscape',
  budgetOps: 'Budget & Spend',
  operationalConstraints: 'Operational Constraints',
  storeRisk: 'Store & Risk',
  historyRefs: 'Reference IDs',
};

/**
 * Field labels for human-readable display
 */
const FIELD_LABELS: Record<string, string> = {
  // Identity
  'identity.businessName': 'Business Name',
  'identity.industry': 'Industry',
  'identity.businessModel': 'Business Model',
  'identity.geographicFootprint': 'Geographic Footprint',
  'identity.marketMaturity': 'Market Maturity',
  'identity.competitiveLandscape': 'Competitive Landscape',
  'identity.uniqueSellingPoints': 'Unique Selling Points',
  // Brand
  'brand.positioning': 'Brand Positioning',
  'brand.valueProps': 'Value Propositions',
  'brand.differentiators': 'Differentiators',
  'brand.toneOfVoice': 'Tone of Voice',
  'brand.brandPersonality': 'Brand Personality',
  'brand.brandStrengths': 'Brand Strengths',
  'brand.brandWeaknesses': 'Brand Weaknesses',
  'brand.competitivePosition': 'Competitive Position',
  // Objectives
  'objectives.primaryObjective': 'Primary Objective',
  'objectives.secondaryObjectives': 'Secondary Objectives',
  'objectives.kpiLabels': 'KPIs',
  'objectives.targetCpa': 'Target CPA',
  'objectives.targetRoas': 'Target ROAS',
  'objectives.timeHorizon': 'Time Horizon',
  // Audience
  'audience.coreSegments': 'Core Segments',
  'audience.demographics': 'Demographics',
  'audience.geos': 'Geographic Targeting',
  'audience.primaryMarkets': 'Primary Markets',
  'audience.painPoints': 'Pain Points',
  'audience.motivations': 'Motivations',
  'audience.purchaseBehaviors': 'Purchase Behaviors',
  // Performance Media
  'performanceMedia.activeChannels': 'Active Channels',
  'performanceMedia.blendedCpa': 'Blended CPA',
  'performanceMedia.blendedRoas': 'Blended ROAS',
  'performanceMedia.attributionModel': 'Attribution Model',
  // Budget
  'budgetOps.mediaSpendBudget': 'Monthly Media Budget',
  'budgetOps.currentAllocation': 'Current Allocation',
  // Add more as needed...
};

/**
 * Options for context gateway queries
 */
export interface ContextGatewayOptions {
  companyId: string;
  scopes: ContextScopeId[];
  minConfidence?: number;      // default 0.4
  minFreshness?: number;       // default 0.3
  includeHumanOverridesOnly?: boolean;
  snapshotId?: string;         // if provided, read from snapshot instead of live
}

/**
 * Field status
 */
export type ContextFieldStatus = 'missing' | 'fresh' | 'stale' | 'conflicted';

/**
 * A single context field with metadata
 */
export interface ContextGatewayField {
  path: string;
  section: ContextScopeId;
  label: string;
  value: unknown | null;
  confidence: number;
  freshnessScore: number;
  status: ContextFieldStatus;
  isHumanOverride: boolean;
  lastUpdated: string | null;
  source: string | null;
}

/**
 * A section of context fields
 */
export interface ContextGatewaySection {
  id: ContextScopeId;
  label: string;
  fields: ContextGatewayField[];
  fieldCount: number;
  populatedCount: number;
  averageConfidence: number;
  averageFreshness: number;
}

/**
 * Result from context gateway query
 */
export interface ContextGatewayResult {
  companyId: string;
  companyName: string;
  sections: ContextGatewaySection[];
  isSnapshot: boolean;
  snapshotId?: string;
  snapshotLabel?: string;
  snapshotCreatedAt?: string;
  queriedAt: string;
  totalFields: number;
  populatedFields: number;
  averageConfidence: number;
  averageFreshness: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if provenance indicates human override
 */
function isHumanOverride(provenance: ProvenanceTag[]): boolean {
  if (!provenance || provenance.length === 0) return false;
  const latest = provenance[0];
  return latest.source === 'manual' || (latest.notes?.toLowerCase().includes('human') ?? false);
}

/**
 * Get confidence from provenance
 */
function getConfidence(provenance: ProvenanceTag[]): number {
  if (!provenance || provenance.length === 0) return 0;
  return provenance[0].confidence ?? 0;
}

/**
 * Get source from provenance
 */
function getSource(provenance: ProvenanceTag[]): string | null {
  if (!provenance || provenance.length === 0) return null;
  return provenance[0].source || null;
}

/**
 * Get last updated from provenance
 */
function getLastUpdated(provenance: ProvenanceTag[]): string | null {
  if (!provenance || provenance.length === 0) return null;
  return provenance[0].updatedAt || null;
}

/**
 * Determine field status based on value and freshness
 */
function determineStatus(
  value: unknown,
  freshnessScore: number
): ContextFieldStatus {
  if (value === null || value === undefined) return 'missing';
  if (Array.isArray(value) && value.length === 0) return 'missing';
  if (freshnessScore >= 0.5) return 'fresh';
  if (freshnessScore > 0) return 'stale';
  return 'stale';
}

/**
 * Get label for a field path
 */
function getFieldLabel(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];

  // Generate label from path
  const parts = path.split('.');
  const fieldName = parts[parts.length - 1];
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Extract fields from a domain object
 */
function extractFieldsFromDomain(
  domain: Record<string, unknown>,
  scopeId: ContextScopeId,
  options: {
    minConfidence: number;
    minFreshness: number;
    includeHumanOverridesOnly: boolean;
  }
): ContextGatewayField[] {
  const fields: ContextGatewayField[] = [];

  for (const [fieldName, fieldValue] of Object.entries(domain)) {
    // Check if this is a WithMeta field
    if (
      !fieldValue ||
      typeof fieldValue !== 'object' ||
      !('value' in fieldValue) ||
      !('provenance' in fieldValue)
    ) {
      continue;
    }

    const field = fieldValue as WithMetaType<unknown>;
    const path = `${scopeId}.${fieldName}`;
    const provenance = field.provenance || [];
    const confidence = getConfidence(provenance);
    const humanOverride = isHumanOverride(provenance);

    // Get freshness
    const freshnessResult = getFieldFreshness(field);
    const freshnessScore = freshnessResult?.score ?? 0;

    // Apply filters
    if (options.includeHumanOverridesOnly && !humanOverride) {
      continue;
    }

    // Don't filter by confidence/freshness for missing fields
    const value = field.value;
    const isMissing = value === null || value === undefined ||
      (Array.isArray(value) && value.length === 0);

    if (!isMissing) {
      if (confidence < options.minConfidence) continue;
      if (freshnessScore < options.minFreshness) continue;
    }

    const status = determineStatus(value, freshnessScore);

    fields.push({
      path,
      section: scopeId,
      label: getFieldLabel(path),
      value,
      confidence,
      freshnessScore,
      status,
      isHumanOverride: humanOverride,
      lastUpdated: getLastUpdated(provenance),
      source: getSource(provenance),
    });
  }

  return fields;
}

// ============================================================================
// Main Gateway Functions
// ============================================================================

/**
 * Get context for specified scopes
 *
 * This is the main entry point for loading company context.
 * Use this for all AI features, planners, and tools.
 */
export async function getContextForScopes(
  options: ContextGatewayOptions
): Promise<ContextGatewayResult> {
  const {
    companyId,
    scopes,
    minConfidence = 0.4,
    minFreshness = 0.3,
    includeHumanOverridesOnly = false,
    snapshotId,
  } = options;

  let graph: CompanyContextGraph | null = null;
  let isSnapshot = false;
  let snapshotMeta: { label?: string; createdAt?: string } = {};

  // Load from snapshot or live
  if (snapshotId) {
    const version = await getVersionById(snapshotId);
    if (version) {
      graph = version.graph as CompanyContextGraph;
      isSnapshot = true;
      snapshotMeta = {
        label: version.description || `Snapshot ${version.versionId.slice(0, 8)}`,
        createdAt: version.versionAt,
      };
    }
  }

  if (!graph) {
    graph = await loadContextGraph(companyId);
  }

  if (!graph) {
    return {
      companyId,
      companyName: '',
      sections: [],
      isSnapshot: false,
      queriedAt: new Date().toISOString(),
      totalFields: 0,
      populatedFields: 0,
      averageConfidence: 0,
      averageFreshness: 0,
    };
  }

  const sections: ContextGatewaySection[] = [];
  let totalFields = 0;
  let populatedFields = 0;
  let totalConfidence = 0;
  let totalFreshness = 0;
  let fieldCount = 0;

  for (const scopeId of scopes) {
    const domain = graph[scopeId as DomainName];
    if (!domain || typeof domain !== 'object') continue;

    const fields = extractFieldsFromDomain(
      domain as Record<string, unknown>,
      scopeId,
      { minConfidence, minFreshness, includeHumanOverridesOnly }
    );

    const populated = fields.filter(f => f.status !== 'missing');
    const avgConfidence = populated.length > 0
      ? populated.reduce((sum, f) => sum + f.confidence, 0) / populated.length
      : 0;
    const avgFreshness = populated.length > 0
      ? populated.reduce((sum, f) => sum + f.freshnessScore, 0) / populated.length
      : 0;

    sections.push({
      id: scopeId,
      label: SCOPE_LABELS[scopeId] || scopeId,
      fields,
      fieldCount: fields.length,
      populatedCount: populated.length,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      averageFreshness: Math.round(avgFreshness * 100) / 100,
    });

    totalFields += fields.length;
    populatedFields += populated.length;
    totalConfidence += avgConfidence * fields.length;
    totalFreshness += avgFreshness * fields.length;
    fieldCount += fields.length;
  }

  return {
    companyId,
    companyName: graph.companyName,
    sections,
    isSnapshot,
    snapshotId: isSnapshot ? snapshotId : undefined,
    snapshotLabel: snapshotMeta.label,
    snapshotCreatedAt: snapshotMeta.createdAt,
    queriedAt: new Date().toISOString(),
    totalFields,
    populatedFields,
    averageConfidence: fieldCount > 0 ? Math.round((totalConfidence / fieldCount) * 100) / 100 : 0,
    averageFreshness: fieldCount > 0 ? Math.round((totalFreshness / fieldCount) * 100) / 100 : 0,
  };
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Use case identifiers for context formatting
 */
export type ContextUseCase =
  | 'media_planning'
  | 'creative_brief'
  | 'strategy'
  | 'qbr'
  | 'ssm'
  | 'general';

/**
 * Extended options for prompt generation
 */
export interface ContextForPromptOptions extends ContextGatewayOptions {
  use: ContextUseCase;
  maxLength?: number;
}

/**
 * Result from prompt context query
 */
export interface ContextForPromptResult {
  structured: ContextGatewayResult;
  promptText: string;
}

/**
 * Get context formatted for LLM prompts
 *
 * This builds a compact, deterministic prompt text representation
 * suitable for injection into AI prompts.
 */
export async function getContextForPrompt(
  options: ContextForPromptOptions
): Promise<ContextForPromptResult> {
  const structured = await getContextForScopes(options);
  const promptText = formatContextAsPrompt(structured, options.use, options.maxLength);

  return {
    structured,
    promptText,
  };
}

/**
 * Format context result as prompt text
 */
function formatContextAsPrompt(
  result: ContextGatewayResult,
  use: ContextUseCase,
  maxLength?: number
): string {
  const lines: string[] = [];

  // Add header
  if (result.companyName) {
    lines.push(`# Company: ${result.companyName}`);
    lines.push('');
  }

  if (result.isSnapshot) {
    lines.push(`> Note: This is a historical snapshot from ${result.snapshotCreatedAt || 'unknown date'}`);
    lines.push('');
  }

  // Format each section
  for (const section of result.sections) {
    const populatedFields = section.fields.filter(f => f.status !== 'missing');
    if (populatedFields.length === 0) continue;

    lines.push(`[${section.label.toUpperCase()}]`);

    for (const field of populatedFields) {
      const value = formatValueForPrompt(field.value);
      if (value) {
        lines.push(`- ${field.label}: ${value}`);
      }
    }

    lines.push('');
  }

  let text = lines.join('\n').trim();

  // Truncate if needed
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength - 3) + '...';
  }

  return text;
}

/**
 * Format a value for prompt inclusion
 */
function formatValueForPrompt(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    const items = value
      .map(v => formatValueForPrompt(v))
      .filter((v): v is string => v !== null);
    return items.length > 0 ? items.join('; ') : null;
  }

  if (typeof value === 'object') {
    // For complex objects, try to extract key info
    const obj = value as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    if (obj.label) return String(obj.label);
    if (obj.value) return formatValueForPrompt(obj.value);
    return JSON.stringify(value);
  }

  return String(value);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get all context for a company (all scopes)
 */
export async function getAllContext(
  companyId: string,
  options?: Partial<Omit<ContextGatewayOptions, 'companyId' | 'scopes'>>
): Promise<ContextGatewayResult> {
  const allScopes: ContextScopeId[] = [
    'identity',
    'brand',
    'objectives',
    'audience',
    'productOffer',
    'digitalInfra',
    'website',
    'content',
    'seo',
    'ops',
    'performanceMedia',
    'historical',
    'creative',
    'competitive',
    'budgetOps',
    'operationalConstraints',
    'storeRisk',
  ];

  return getContextForScopes({
    companyId,
    scopes: allScopes,
    ...options,
  });
}

/**
 * Get context for media planning
 */
export async function getMediaPlanningContext(
  companyId: string,
  options?: Partial<Omit<ContextGatewayOptions, 'companyId' | 'scopes'>>
): Promise<ContextForPromptResult> {
  return getContextForPrompt({
    companyId,
    scopes: ['identity', 'objectives', 'audience', 'performanceMedia', 'budgetOps', 'historical'],
    use: 'media_planning',
    ...options,
  });
}

/**
 * Get context for creative briefs
 */
export async function getCreativeContext(
  companyId: string,
  options?: Partial<Omit<ContextGatewayOptions, 'companyId' | 'scopes'>>
): Promise<ContextForPromptResult> {
  return getContextForPrompt({
    companyId,
    scopes: ['identity', 'brand', 'audience', 'content', 'creative'],
    use: 'creative_brief',
    ...options,
  });
}

/**
 * Get context for QBR generation
 */
export async function getQbrContext(
  companyId: string,
  options?: Partial<Omit<ContextGatewayOptions, 'companyId' | 'scopes'>>
): Promise<ContextForPromptResult> {
  return getContextForPrompt({
    companyId,
    scopes: [
      'identity',
      'objectives',
      'performanceMedia',
      'budgetOps',
      'historical',
      'competitive',
    ],
    use: 'qbr',
    ...options,
  });
}

/**
 * Get context for SSM (Strategic State Machine)
 */
export async function getSsmContext(
  companyId: string,
  options?: Partial<Omit<ContextGatewayOptions, 'companyId' | 'scopes'>>
): Promise<ContextForPromptResult> {
  return getContextForPrompt({
    companyId,
    scopes: [
      'identity',
      'objectives',
      'audience',
      'performanceMedia',
      'budgetOps',
      'operationalConstraints',
    ],
    use: 'ssm',
    ...options,
  });
}

/**
 * Check if context exists for a company
 */
export async function hasContext(companyId: string): Promise<boolean> {
  const graph = await loadContextGraph(companyId);
  return graph !== null;
}

/**
 * Get a quick summary of context health
 */
export async function getContextHealthSummary(
  companyId: string
): Promise<{
  exists: boolean;
  completeness: number;
  freshness: number;
  confidence: number;
  staleSections: string[];
}> {
  const result = await getAllContext(companyId);

  if (result.totalFields === 0) {
    return {
      exists: false,
      completeness: 0,
      freshness: 0,
      confidence: 0,
      staleSections: [],
    };
  }

  const staleSections = result.sections
    .filter(s => s.averageFreshness < 0.5)
    .map(s => s.id);

  return {
    exists: true,
    completeness: Math.round((result.populatedFields / result.totalFields) * 100),
    freshness: Math.round(result.averageFreshness * 100),
    confidence: Math.round(result.averageConfidence * 100),
    staleSections,
  };
}
