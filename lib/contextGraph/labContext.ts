// lib/contextGraph/labContext.ts
// Shared Lab Context Helper - Brain-First Architecture
//
// This module provides a unified way for all Labs to:
// 1. Load relevant context from the Brain before generating
// 2. Get structured summaries for prompt injection
// 3. Track missing context for confidence adjustments
// 4. Enforce Brain-first constraints in prompts

import {
  getContextForScopes,
  type ContextScopeId,
  type ContextGatewayResult,
  type ContextGatewayField,
} from './contextGateway';

// ============================================================================
// Types
// ============================================================================

/**
 * Lab identifiers
 */
export type LabId =
  | 'website'
  | 'media'
  | 'audience'
  | 'brand'
  | 'seo'
  | 'content'
  | 'ux'
  | 'demand'
  | 'creative'
  | 'ops'
  | 'competitor';

/**
 * Array of all Lab IDs for iteration
 */
export const LAB_IDS: LabId[] = [
  'website',
  'media',
  'audience',
  'brand',
  'seo',
  'content',
  'ux',
  'demand',
  'creative',
  'ops',
  'competitor',
];

/**
 * Lab context with structured summaries and constraint info
 */
export interface LabContext {
  companyId: string;
  companyName: string;
  labId: LabId;
  scopes: ContextScopeId[];

  /** Raw context keyed by path */
  byPath: Record<string, unknown>;

  /** Human-readable summaries for prompts */
  identitySummary: string;
  audienceSummary: string;
  brandSummary: string;
  websiteSummary: string;
  mediaSummary: string;
  objectivesSummary: string;
  budgetSummary: string;

  /** Context integrity flags */
  hasCanonicalICP: boolean;
  hasBrandPositioning: boolean;
  hasObjectives: boolean;
  hasBudget: boolean;

  /** Missing context tracking */
  missingContext: MissingContextItem[];
  contextIntegrity: ContextIntegrity;

  /** Full structured result for advanced use */
  fullResult: ContextGatewayResult;

  /** Timestamp */
  loadedAt: string;
}

/**
 * Missing context item for tracking gaps
 */
export interface MissingContextItem {
  path: string;
  label: string;
  importance: 'critical' | 'important' | 'helpful';
  suggestion: string;
}

/**
 * Context integrity level
 */
export type ContextIntegrity = 'high' | 'medium' | 'low' | 'none';

/**
 * Lab-specific prompt constraints
 */
export interface LabConstraints {
  systemConstraints: string;
  fieldConstraints: Record<string, string>;
  confidenceCap: number;
}

// ============================================================================
// Lab Scope Configuration
// ============================================================================

/**
 * Scopes required for each Lab
 */
export const LAB_SCOPES: Record<LabId, ContextScopeId[]> = {
  website: ['identity', 'website', 'content', 'seo', 'objectives', 'audience'],
  media: ['identity', 'audience', 'performanceMedia', 'budgetOps', 'objectives', 'historical'],
  audience: ['identity', 'audience', 'brand', 'objectives', 'productOffer'],
  brand: ['identity', 'brand', 'audience', 'objectives', 'competitive'],
  seo: ['identity', 'content', 'seo', 'website', 'objectives'],
  content: ['identity', 'content', 'brand', 'audience', 'seo'],
  ux: ['identity', 'website', 'objectives', 'audience'],
  demand: ['identity', 'audience', 'performanceMedia', 'objectives'],
  creative: ['identity', 'brand', 'audience', 'creative', 'content'],
  ops: ['identity', 'ops', 'objectives', 'budgetOps'],
  competitor: ['identity', 'brand', 'competitive', 'audience', 'productOffer'],
};

/**
 * Critical fields per Lab (if missing, mark low integrity)
 */
const LAB_CRITICAL_FIELDS: Record<LabId, string[]> = {
  website: ['identity.industry', 'objectives.primaryObjective'],
  media: ['identity.industry', 'audience.coreSegments', 'objectives.primaryObjective'],
  audience: ['identity.industry', 'identity.businessModel'],
  brand: ['identity.industry', 'identity.businessModel'],
  seo: ['identity.industry', 'website.websiteSummary'],
  content: ['identity.industry', 'brand.positioning'],
  ux: ['identity.industry', 'objectives.primaryObjective'],
  demand: ['identity.industry', 'audience.coreSegments'],
  creative: ['identity.industry', 'brand.positioning', 'audience.coreSegments'],
  ops: ['identity.industry', 'objectives.primaryObjective'],
  competitor: ['identity.industry', 'brand.positioning'],
};

/**
 * Lab-specific prompt constraints
 */
export const LAB_CONSTRAINTS: Record<LabId, LabConstraints> = {
  website: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Use the company's existing positioning, ICP, and primary objectives from the provided context.
- Do not change who they serve. Propose website improvements within this strategy.
- All recommendations must align with the stated business model and target audience.
- Do not suggest pivoting the business or changing the core value proposition.`,
    fieldConstraints: {
      recommendations: 'Must align with stated objectives and target audience',
      improvements: 'Must be implementable within the current business model',
    },
    confidenceCap: 0.85,
  },
  media: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Channel strategy must align with the defined ICP, brand positioning, and budget constraints from context.
- Do not invent a new audience or objectives. Work within the established strategic framework.
- All budget recommendations must respect the stated budget parameters.
- Attribution model recommendations should build on existing infrastructure.`,
    fieldConstraints: {
      channelMix: 'Must target the defined audience segments',
      budgetAllocation: 'Must stay within stated budget constraints',
      targeting: 'Must align with defined ICP and personas',
    },
    confidenceCap: 0.85,
  },
  audience: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Audience insights must be grounded in the company's actual business model and industry.
- Personas must reflect the company's real target market, not hypothetical ideal customers.
- If ICP is already defined in context, refine rather than replace.
- Behavioral insights should connect to the company's actual value proposition.`,
    fieldConstraints: {
      personas: 'Must be grounded in stated business model',
      segments: 'Must align with geographic and industry context',
    },
    confidenceCap: 0.80,
  },
  brand: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Brand platform must remain consistent with existing brand pillars and positioning from context.
- You may refine language but not contradict the core positioning.
- Voice and tone suggestions must build on established brand personality.
- Do not suggest brand pivots or fundamental repositioning.`,
    fieldConstraints: {
      positioning: 'Must build on existing positioning if present',
      messaging: 'Must align with established tone of voice',
    },
    confidenceCap: 0.80,
  },
  seo: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- SEO strategy must align with the business's stated objectives and target audience.
- Keyword recommendations must be relevant to the company's products/services.
- Content recommendations should support the existing content strategy.
- Technical recommendations must be practical for the current website infrastructure.`,
    fieldConstraints: {
      keywords: 'Must be relevant to stated products and audience',
      content: 'Must align with brand voice and audience needs',
    },
    confidenceCap: 0.85,
  },
  content: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Content strategy must align with brand positioning and target audience.
- Topics must be relevant to the company's industry and expertise.
- Tone and style must match the established brand voice.
- Content recommendations should support stated business objectives.`,
    fieldConstraints: {
      topics: 'Must be relevant to industry and audience',
      style: 'Must match established brand voice',
    },
    confidenceCap: 0.80,
  },
  ux: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- UX recommendations must support the stated conversion objectives.
- User flow improvements should align with the target audience's needs.
- Design suggestions must be consistent with brand guidelines.
- Prioritize improvements that directly impact stated KPIs.`,
    fieldConstraints: {
      flows: 'Must align with target audience journey',
      design: 'Must be consistent with brand guidelines',
    },
    confidenceCap: 0.85,
  },
  demand: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Demand generation strategy must target the defined audience segments.
- Channel recommendations must align with budget constraints.
- Messaging must be consistent with brand positioning.
- Lead quality definitions must match stated ideal customer profile.`,
    fieldConstraints: {
      channels: 'Must be appropriate for target audience',
      messaging: 'Must align with brand positioning',
    },
    confidenceCap: 0.85,
  },
  creative: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Creative concepts must align with brand guidelines and positioning.
- Messaging must target the defined audience segments.
- Visual direction must be consistent with brand identity.
- All creative must support stated campaign objectives.`,
    fieldConstraints: {
      concepts: 'Must align with brand guidelines',
      messaging: 'Must target defined audience',
    },
    confidenceCap: 0.80,
  },
  ops: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Operational recommendations must align with business objectives.
- Process improvements should respect budget and resource constraints.
- Workflow suggestions must be practical for the current team structure.
- Technology recommendations should integrate with existing infrastructure.`,
    fieldConstraints: {
      processes: 'Must be practical for current resources',
      tools: 'Must integrate with existing infrastructure',
    },
    confidenceCap: 0.85,
  },
  competitor: {
    systemConstraints: `CRITICAL CONSTRAINTS:
- Competitive analysis must be grounded in the company's actual market position.
- Competitor profiles must be based on verified public information.
- Positioning recommendations must align with brand strategy and capabilities.
- Differentiation opportunities must be actionable and achievable.`,
    fieldConstraints: {
      competitors: 'Must be actual market competitors',
      positioning: 'Must align with brand strategy',
    },
    confidenceCap: 0.80,
  },
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get context for a specific Lab
 *
 * This is the main entry point. Call this before running any Lab.
 */
export async function getLabContext(
  companyId: string,
  labId: LabId
): Promise<LabContext> {
  const scopes = LAB_SCOPES[labId];

  // Load context from gateway
  const result = await getContextForScopes({
    companyId,
    scopes,
    minConfidence: 0.3,
    minFreshness: 0.2,
  });

  // Build byPath map
  const byPath: Record<string, unknown> = {};
  for (const section of result.sections) {
    for (const field of section.fields) {
      if (field.value !== null && field.value !== undefined) {
        byPath[field.path] = field.value;
      }
    }
  }

  // Build summaries
  const identitySummary = buildIdentitySummary(result);
  const audienceSummary = buildAudienceSummary(result);
  const brandSummary = buildBrandSummary(result);
  const websiteSummary = buildWebsiteSummary(result);
  const mediaSummary = buildMediaSummary(result);
  const objectivesSummary = buildObjectivesSummary(result);
  const budgetSummary = buildBudgetSummary(result);

  // Check for critical fields
  const hasCanonicalICP = checkHasICP(result);
  const hasBrandPositioning = checkHasBrandPositioning(result);
  const hasObjectives = checkHasObjectives(result);
  const hasBudget = checkHasBudget(result);

  // Build missing context list
  const missingContext = buildMissingContextList(result, labId);

  // Calculate context integrity
  const contextIntegrity = calculateContextIntegrity(result, labId);

  return {
    companyId,
    companyName: result.companyName,
    labId,
    scopes,
    byPath,
    identitySummary,
    audienceSummary,
    brandSummary,
    websiteSummary,
    mediaSummary,
    objectivesSummary,
    budgetSummary,
    hasCanonicalICP,
    hasBrandPositioning,
    hasObjectives,
    hasBudget,
    missingContext,
    contextIntegrity,
    fullResult: result,
    loadedAt: new Date().toISOString(),
  };
}

/**
 * Get Lab constraints for prompt injection
 */
export function getLabConstraints(labId: LabId): LabConstraints {
  return LAB_CONSTRAINTS[labId];
}

/**
 * Build a complete prompt context block for a Lab
 */
export function buildLabPromptContext(context: LabContext): string {
  const constraints = getLabConstraints(context.labId);
  const lines: string[] = [];

  // Header
  lines.push(`## Company Context: ${context.companyName}`);
  lines.push('');

  // Constraints
  lines.push('### Constraints');
  lines.push(constraints.systemConstraints);
  lines.push('');

  // Context summaries
  if (context.identitySummary) {
    lines.push('### Business Identity');
    lines.push(context.identitySummary);
    lines.push('');
  }

  if (context.objectivesSummary) {
    lines.push('### Objectives');
    lines.push(context.objectivesSummary);
    lines.push('');
  }

  if (context.audienceSummary) {
    lines.push('### Target Audience');
    lines.push(context.audienceSummary);
    lines.push('');
  }

  if (context.brandSummary) {
    lines.push('### Brand');
    lines.push(context.brandSummary);
    lines.push('');
  }

  if (context.websiteSummary) {
    lines.push('### Website');
    lines.push(context.websiteSummary);
    lines.push('');
  }

  if (context.mediaSummary) {
    lines.push('### Media');
    lines.push(context.mediaSummary);
    lines.push('');
  }

  if (context.budgetSummary) {
    lines.push('### Budget');
    lines.push(context.budgetSummary);
    lines.push('');
  }

  // Context integrity warning
  if (context.contextIntegrity === 'low' || context.contextIntegrity === 'none') {
    lines.push('### ⚠️ Limited Context Warning');
    lines.push('This analysis is running with incomplete company context. Key fields are missing:');
    for (const item of context.missingContext.filter(m => m.importance === 'critical')) {
      lines.push(`- ${item.label}: ${item.suggestion}`);
    }
    lines.push('');
    lines.push('Output confidence should be reduced and recommendations flagged as preliminary.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Calculate confidence cap based on context integrity
 */
export function getConfidenceCap(context: LabContext): number {
  const baseConfidence = LAB_CONSTRAINTS[context.labId].confidenceCap;

  switch (context.contextIntegrity) {
    case 'high':
      return baseConfidence;
    case 'medium':
      return Math.min(baseConfidence, 0.7);
    case 'low':
      return Math.min(baseConfidence, 0.6);
    case 'none':
      return 0.5;
  }
}

/**
 * Check if Lab should proceed based on context
 * Returns warning message if context is insufficient
 */
export function checkLabReadiness(context: LabContext): {
  canProceed: boolean;
  warning?: string;
  missingCritical: string[];
} {
  const criticalFields = LAB_CRITICAL_FIELDS[context.labId];
  const missingCritical: string[] = [];

  for (const path of criticalFields) {
    if (!context.byPath[path]) {
      missingCritical.push(path);
    }
  }

  if (context.contextIntegrity === 'none') {
    return {
      canProceed: false,
      warning: 'No company context available. Please run Setup or a diagnostic first.',
      missingCritical,
    };
  }

  if (missingCritical.length > 0) {
    return {
      canProceed: true,
      warning: `Running with limited context. Missing: ${missingCritical.join(', ')}`,
      missingCritical,
    };
  }

  return {
    canProceed: true,
    missingCritical: [],
  };
}

// ============================================================================
// Summary Builders
// ============================================================================

function buildIdentitySummary(result: ContextGatewayResult): string {
  const identity = result.sections.find(s => s.id === 'identity');
  if (!identity) return '';

  const parts: string[] = [];
  const getValue = (name: string) => identity.fields.find(f => f.path === `identity.${name}`)?.value;

  const businessName = getValue('businessName');
  const industry = getValue('industry');
  const businessModel = getValue('businessModel');
  const geoFootprint = getValue('geographicFootprint');
  const marketMaturity = getValue('marketMaturity');

  if (businessName) parts.push(`Company: ${businessName}`);
  if (industry) parts.push(`Industry: ${industry}`);
  if (businessModel) parts.push(`Business Model: ${businessModel}`);
  if (geoFootprint) parts.push(`Geographic Focus: ${geoFootprint}`);
  if (marketMaturity) parts.push(`Market Maturity: ${marketMaturity}`);

  return parts.join('\n');
}

function buildAudienceSummary(result: ContextGatewayResult): string {
  const audience = result.sections.find(s => s.id === 'audience');
  if (!audience) return '';

  const parts: string[] = [];
  const getValue = (name: string) => audience.fields.find(f => f.path === `audience.${name}`)?.value;

  const segments = getValue('coreSegments');
  const demographics = getValue('demographics');
  const geos = getValue('geos');
  const painPoints = getValue('painPoints');
  const motivations = getValue('motivations');

  if (segments && Array.isArray(segments) && segments.length > 0) {
    parts.push(`Core Segments: ${segments.join(', ')}`);
  }
  if (demographics) parts.push(`Demographics: ${demographics}`);
  if (geos) parts.push(`Geographic Targeting: ${geos}`);
  if (painPoints && Array.isArray(painPoints) && painPoints.length > 0) {
    parts.push(`Pain Points: ${painPoints.slice(0, 3).join('; ')}`);
  }
  if (motivations && Array.isArray(motivations) && motivations.length > 0) {
    parts.push(`Motivations: ${motivations.slice(0, 3).join('; ')}`);
  }

  return parts.join('\n');
}

function buildBrandSummary(result: ContextGatewayResult): string {
  const brand = result.sections.find(s => s.id === 'brand');
  if (!brand) return '';

  const parts: string[] = [];
  const getValue = (name: string) => brand.fields.find(f => f.path === `brand.${name}`)?.value;

  const positioning = getValue('positioning');
  const valueProps = getValue('valueProps');
  const toneOfVoice = getValue('toneOfVoice');
  const differentiators = getValue('differentiators');

  if (positioning) parts.push(`Positioning: ${positioning}`);
  if (valueProps && Array.isArray(valueProps) && valueProps.length > 0) {
    parts.push(`Value Props: ${valueProps.slice(0, 3).join('; ')}`);
  }
  if (toneOfVoice) parts.push(`Tone of Voice: ${toneOfVoice}`);
  if (differentiators && Array.isArray(differentiators) && differentiators.length > 0) {
    parts.push(`Differentiators: ${differentiators.slice(0, 3).join('; ')}`);
  }

  return parts.join('\n');
}

function buildWebsiteSummary(result: ContextGatewayResult): string {
  const website = result.sections.find(s => s.id === 'website');
  if (!website) return '';

  const parts: string[] = [];
  const getValue = (name: string) => website.fields.find(f => f.path === `website.${name}`)?.value;

  const summary = getValue('websiteSummary');
  const criticalIssues = getValue('criticalIssues');
  const conversionOpportunities = getValue('conversionOpportunities');

  if (summary) parts.push(`Summary: ${summary}`);
  if (criticalIssues && Array.isArray(criticalIssues) && criticalIssues.length > 0) {
    parts.push(`Critical Issues: ${criticalIssues.slice(0, 3).join('; ')}`);
  }
  if (conversionOpportunities && Array.isArray(conversionOpportunities) && conversionOpportunities.length > 0) {
    parts.push(`Opportunities: ${conversionOpportunities.slice(0, 3).join('; ')}`);
  }

  return parts.join('\n');
}

function buildMediaSummary(result: ContextGatewayResult): string {
  const media = result.sections.find(s => s.id === 'performanceMedia');
  if (!media) return '';

  const parts: string[] = [];
  const getValue = (name: string) => media.fields.find(f => f.path === `performanceMedia.${name}`)?.value;

  const activeChannels = getValue('activeChannels');
  const blendedCpa = getValue('blendedCpa');
  const blendedRoas = getValue('blendedRoas');
  const attributionModel = getValue('attributionModel');

  if (activeChannels && Array.isArray(activeChannels) && activeChannels.length > 0) {
    parts.push(`Active Channels: ${activeChannels.join(', ')}`);
  }
  if (blendedCpa) parts.push(`Blended CPA: $${blendedCpa}`);
  if (blendedRoas) parts.push(`Blended ROAS: ${blendedRoas}x`);
  if (attributionModel) parts.push(`Attribution: ${attributionModel}`);

  return parts.join('\n');
}

function buildObjectivesSummary(result: ContextGatewayResult): string {
  const objectives = result.sections.find(s => s.id === 'objectives');
  if (!objectives) return '';

  const parts: string[] = [];
  const getValue = (name: string) => objectives.fields.find(f => f.path === `objectives.${name}`)?.value;

  const primary = getValue('primaryObjective');
  const secondary = getValue('secondaryObjectives');
  const targetCpa = getValue('targetCpa');
  const targetRoas = getValue('targetRoas');
  const timeHorizon = getValue('timeHorizon');

  if (primary) parts.push(`Primary Objective: ${primary}`);
  if (secondary && Array.isArray(secondary) && secondary.length > 0) {
    parts.push(`Secondary: ${secondary.slice(0, 3).join('; ')}`);
  }
  if (targetCpa) parts.push(`Target CPA: $${targetCpa}`);
  if (targetRoas) parts.push(`Target ROAS: ${targetRoas}x`);
  if (timeHorizon) parts.push(`Time Horizon: ${timeHorizon}`);

  return parts.join('\n');
}

function buildBudgetSummary(result: ContextGatewayResult): string {
  const budget = result.sections.find(s => s.id === 'budgetOps');
  if (!budget) return '';

  const parts: string[] = [];
  const getValue = (name: string) => budget.fields.find(f => f.path === `budgetOps.${name}`)?.value;

  const mediaSpend = getValue('mediaSpendBudget');
  const totalBudget = getValue('totalMarketingBudget');
  const period = getValue('budgetPeriod');

  if (totalBudget) parts.push(`Total Marketing Budget: $${Number(totalBudget).toLocaleString()}`);
  if (mediaSpend) parts.push(`Media Spend Budget: $${Number(mediaSpend).toLocaleString()}`);
  if (period) parts.push(`Period: ${period}`);

  return parts.join('\n');
}

// ============================================================================
// Context Checks
// ============================================================================

function checkHasICP(result: ContextGatewayResult): boolean {
  const audience = result.sections.find(s => s.id === 'audience');
  if (!audience) return false;

  const segments = audience.fields.find(f => f.path === 'audience.coreSegments');
  const demographics = audience.fields.find(f => f.path === 'audience.demographics');

  return Boolean(
    (segments?.value && Array.isArray(segments.value) && segments.value.length > 0) ||
    demographics?.value
  );
}

function checkHasBrandPositioning(result: ContextGatewayResult): boolean {
  const brand = result.sections.find(s => s.id === 'brand');
  if (!brand) return false;

  const positioning = brand.fields.find(f => f.path === 'brand.positioning');
  const valueProps = brand.fields.find(f => f.path === 'brand.valueProps');

  return Boolean(
    positioning?.value ||
    (valueProps?.value && Array.isArray(valueProps.value) && valueProps.value.length > 0)
  );
}

function checkHasObjectives(result: ContextGatewayResult): boolean {
  const objectives = result.sections.find(s => s.id === 'objectives');
  if (!objectives) return false;

  const primary = objectives.fields.find(f => f.path === 'objectives.primaryObjective');
  return Boolean(primary?.value);
}

function checkHasBudget(result: ContextGatewayResult): boolean {
  const budget = result.sections.find(s => s.id === 'budgetOps');
  if (!budget) return false;

  const mediaSpend = budget.fields.find(f => f.path === 'budgetOps.mediaSpendBudget');
  return Boolean(mediaSpend?.value);
}

// ============================================================================
// Missing Context
// ============================================================================

function buildMissingContextList(result: ContextGatewayResult, labId: LabId): MissingContextItem[] {
  const missing: MissingContextItem[] = [];
  const criticalFields = LAB_CRITICAL_FIELDS[labId];

  // Check identity fields
  const identity = result.sections.find(s => s.id === 'identity');
  if (!identity || !identity.fields.find(f => f.path === 'identity.industry')?.value) {
    missing.push({
      path: 'identity.industry',
      label: 'Industry',
      importance: criticalFields.includes('identity.industry') ? 'critical' : 'important',
      suggestion: 'Define the company\'s industry in Setup or Brain',
    });
  }

  // Check audience fields
  const audience = result.sections.find(s => s.id === 'audience');
  if (!audience || !audience.fields.find(f => f.path === 'audience.coreSegments')?.value) {
    missing.push({
      path: 'audience.coreSegments',
      label: 'Target Audience',
      importance: criticalFields.includes('audience.coreSegments') ? 'critical' : 'important',
      suggestion: 'Define core audience segments in Setup or run Audience Lab',
    });
  }

  // Check objectives
  const objectives = result.sections.find(s => s.id === 'objectives');
  if (!objectives || !objectives.fields.find(f => f.path === 'objectives.primaryObjective')?.value) {
    missing.push({
      path: 'objectives.primaryObjective',
      label: 'Primary Objective',
      importance: criticalFields.includes('objectives.primaryObjective') ? 'critical' : 'important',
      suggestion: 'Define primary marketing objective in Setup',
    });
  }

  // Check brand
  const brand = result.sections.find(s => s.id === 'brand');
  if (!brand || !brand.fields.find(f => f.path === 'brand.positioning')?.value) {
    missing.push({
      path: 'brand.positioning',
      label: 'Brand Positioning',
      importance: criticalFields.includes('brand.positioning') ? 'critical' : 'helpful',
      suggestion: 'Define brand positioning in Setup or run Brand Lab',
    });
  }

  return missing;
}

function calculateContextIntegrity(result: ContextGatewayResult, labId: LabId): ContextIntegrity {
  const criticalFields = LAB_CRITICAL_FIELDS[labId];
  let criticalFound = 0;

  for (const path of criticalFields) {
    const [domain, field] = path.split('.');
    const section = result.sections.find(s => s.id === domain);
    if (section) {
      const fieldData = section.fields.find(f => f.path === path);
      if (fieldData?.value) {
        criticalFound++;
      }
    }
  }

  const coverage = criticalFields.length > 0 ? criticalFound / criticalFields.length : 0;

  if (result.populatedFields === 0) return 'none';
  if (coverage >= 0.8) return 'high';
  if (coverage >= 0.5) return 'medium';
  return 'low';
}

// ============================================================================
// Exports for UI
// ============================================================================

/**
 * Get a simple context summary for UI display
 */
export function getLabContextSummary(context: LabContext): {
  integrity: ContextIntegrity;
  integrityLabel: string;
  hasICP: boolean;
  hasBrand: boolean;
  hasObjectives: boolean;
  missingCritical: string[];
  badge: {
    type: 'success' | 'warning' | 'error';
    text: string;
  };
} {
  const readiness = checkLabReadiness(context);

  let badge: { type: 'success' | 'warning' | 'error'; text: string };
  let integrityLabel: string;

  switch (context.contextIntegrity) {
    case 'high':
      badge = { type: 'success', text: 'Anchored to Brain: ICP + Brand + Objectives loaded' };
      integrityLabel = 'High Context Integrity';
      break;
    case 'medium':
      badge = { type: 'warning', text: 'Partial context: some key fields missing' };
      integrityLabel = 'Medium Context Integrity';
      break;
    case 'low':
      badge = { type: 'warning', text: `Limited context: ${readiness.missingCritical.length} critical fields missing` };
      integrityLabel = 'Low Context Integrity';
      break;
    case 'none':
      badge = { type: 'error', text: 'No context: run Setup or diagnostics first' };
      integrityLabel = 'No Context';
      break;
  }

  return {
    integrity: context.contextIntegrity,
    integrityLabel,
    hasICP: context.hasCanonicalICP,
    hasBrand: context.hasBrandPositioning,
    hasObjectives: context.hasObjectives,
    missingCritical: readiness.missingCritical,
    badge,
  };
}
