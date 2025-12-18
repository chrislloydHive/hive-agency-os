// lib/labs/context.ts
// Brain-first context loader for Labs
//
// Provides a unified way for Audience, Brand, and Creative Labs to:
// 1. Load scoped context from Context Graph / Brain
// 2. Get health summary relevant to the Lab
// 3. Build prompt context for refinement mode

import {
  getLabContext as getBaseLabContext,
  buildLabPromptContext,
  checkLabReadiness,
  getLabContextSummary,
  type LabContext,
  type LabId,
} from '@/lib/contextGraph/labContext';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';
import type { RefinementLabId } from './refinementTypes';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended context for refinement-mode Labs
 */
export interface RefinementLabContext extends LabContext {
  /** The full raw context graph (for direct field access) */
  rawGraph: CompanyContextGraph | null;

  /** Fields that exist and have values */
  populatedFields: Array<{
    path: string;
    value: unknown;
    source: string;
    confidence: number;
    updatedAt: string;
    isHumanOverride: boolean;
  }>;

  /** Fields that are missing or empty */
  emptyFields: string[];

  /** Context health specific to this Lab */
  labHealth: {
    completeness: number;
    criticalFieldsPresent: number;
    criticalFieldsTotal: number;
    staleSections: string[];
    recommendations: string[];
  };
}

/**
 * Field paths relevant to each refinement Lab
 *
 * These scopes define which fields each Lab can refine.
 * Expanded to ensure maximum auto-fill coverage.
 */
const LAB_FIELD_SCOPES: Record<RefinementLabId, string[]> = {
  audience: [
    // Identity context (for understanding the business)
    'identity.industry',
    'identity.businessModel',
    'audience.icpDescription',
    'identity.description',
    // All audience fields
    'audience.primaryAudience',
    'audience.primaryBuyerRoles',
    'audience.companyProfile',
    'audience.coreSegments',
    'audience.segmentDetails',
    'audience.demographics',
    'audience.geos',
    'audience.primaryMarkets',
    'audience.behavioralDrivers',
    'audience.demandStates',
    'audience.painPoints',
    'audience.motivations',
    'audience.personaNames',
    'audience.personaBriefs',
  ],
  brand: [
    // Identity context
    'identity.industry',
    'identity.businessModel',
    'audience.icpDescription',
    // All brand fields (except brandGuidelines which is assist mode)
    'brand.positioning',
    'brand.tagline',
    'brand.valueProps',
    'brand.differentiators',
    'brand.uniqueSellingPoints',
    'brand.toneOfVoice',
    'brand.brandPersonality',
    'brand.messagingPillars',
    'brand.brandPerception',
    'brand.brandStrengths',
    'brand.brandWeaknesses',
    // Cross-reference from audience
    'audience.primaryAudience',
    'audience.coreSegments',
    // ProductOffer fields relevant to brand positioning
    'productOffer.primaryProducts',
    'productOffer.services',
    'productOffer.valueProposition',
    'productOffer.keyDifferentiators',
    'productOffer.pricingModel',
  ],
  creative: [
    // Identity context
    'identity.industry',
    'audience.icpDescription',
    // Brand context for messaging alignment
    'brand.positioning',
    'brand.toneOfVoice',
    'brand.messagingPillars',
    'brand.valueProps',
    'brand.tagline',
    'brand.brandPersonality',
    // Audience context
    'audience.primaryAudience',
    'audience.coreSegments',
    'audience.painPoints',
    'audience.motivations',
    // All creative fields
    'creative.messaging',
    'creative.coreMessages',
    'creative.segmentMessages',
    'creative.proofPoints',
    'creative.callToActions',
    'creative.creativeTerritories',
    'creative.campaignConcepts',
    'creative.guidelines',
    'creative.channelPatterns',
    'creative.testingRoadmapItems',
    'creative.assetSpecs',
    'creative.availableFormats',
  ],
  competitor: [
    // Identity context
    'identity.industry',
    'identity.businessModel',
    'identity.competitiveLandscape',
    'identity.marketPosition',
    'identity.primaryCompetitors',
    // Brand context for positioning comparison
    'brand.positioning',
    'brand.differentiators',
    'brand.valueProps',
    'brand.uniqueSellingPoints',
    // All competitive fields
    'competitive.primaryAxis',
    'competitive.secondaryAxis',
    'competitive.positionSummary',
    'competitive.whitespaceOpportunities',
    'competitive.competitors',
    'competitive.primaryCompetitors',
    'competitive.shareOfVoice',
    'competitive.marketPosition',
    'competitive.competitiveAdvantages',
    'competitive.differentiationStrategy',
    'competitive.uniqueValueProps',
    'competitive.competitiveThreats',
    'competitive.competitiveOpportunities',
    'competitive.marketTrends',
    'competitive.positioningAxes',
    'competitive.ownPositionPrimary',
    'competitive.ownPositionSecondary',
    'competitive.positioningSummary',
  ],
  website: [
    // Core Identity context for understanding the business
    'identity.industry',
    'identity.businessModel',
    'identity.description',
    // Audience context for understanding conversion targets
    'audience.primaryAudience',
    'audience.painPoints',
    // Brand context for messaging alignment
    'brand.positioning',
    'brand.valueProps',
    // All website-specific fields
    'website.websiteScore',
    'website.websiteSummary',
    'website.executiveSummary',
    'website.conversionBlocks',
    'website.conversionOpportunities',
    'website.criticalIssues',
    'website.quickWins',
    'website.recommendations',
    'website.landingPageQuality',
    'website.formExperience',
    'website.infraNotes',
    'website.hasContactForm',
    'website.hasPhoneNumbers',
    'website.hasLiveChat',
    'website.hasChatbot',
    'website.mobileResponsive',
    'website.pageAssessments',
    'website.funnelIssues',
  ],
};

/**
 * Critical fields that should be present for each Lab
 */
const LAB_CRITICAL_FIELDS: Record<RefinementLabId, string[]> = {
  audience: [
    'identity.industry',
    'identity.businessModel',
    'audience.primaryAudience',
  ],
  brand: [
    'identity.industry',
    'audience.icpDescription',
    'brand.positioning',
  ],
  creative: [
    'brand.positioning',
    'audience.primaryAudience',
    'creative.coreMessages',
  ],
  competitor: [
    'identity.industry',
    'brand.positioning',
    'competitive.primaryCompetitors',
  ],
  website: [
    'identity.industry',
    'brand.valueProps',
    'website.websiteSummary',
  ],
};

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Get extended context for a refinement-mode Lab
 *
 * This builds on the base getLabContext but adds:
 * - Raw graph access for field-level operations
 * - Populated/empty field lists
 * - Lab-specific health metrics
 */
export async function getRefinementLabContext(
  companyId: string,
  labId: RefinementLabId
): Promise<RefinementLabContext> {
  // Get base Lab context
  const baseContext = await getBaseLabContext(companyId, labId);

  // Load raw graph for direct field access
  const rawGraph = await loadContextGraph(companyId);

  // Build populated/empty field lists
  const fieldScopes = LAB_FIELD_SCOPES[labId];
  const populatedFields: RefinementLabContext['populatedFields'] = [];
  const emptyFields: string[] = [];

  for (const path of fieldScopes) {
    const fieldData = getFieldFromGraph(rawGraph, path);

    if (fieldData && hasValue(fieldData.value)) {
      const provenance = fieldData.provenance?.[0];
      populatedFields.push({
        path,
        value: fieldData.value,
        source: provenance?.source || 'unknown',
        confidence: provenance?.confidence ?? 0.5,
        updatedAt: provenance?.updatedAt || '',
        isHumanOverride: isHumanSource(provenance?.source),
      });
    } else {
      emptyFields.push(path);
    }
  }

  // Calculate Lab-specific health
  const criticalFields = LAB_CRITICAL_FIELDS[labId];
  const criticalPresent = criticalFields.filter(
    (f) => populatedFields.some((p) => p.path === f)
  ).length;

  const labHealth = {
    completeness: fieldScopes.length > 0
      ? Math.round((populatedFields.length / fieldScopes.length) * 100)
      : 0,
    criticalFieldsPresent: criticalPresent,
    criticalFieldsTotal: criticalFields.length,
    staleSections: baseContext.missingContext
      .filter((m) => m.importance === 'critical')
      .map((m) => m.path.split('.')[0]),
    recommendations: buildLabRecommendations(labId, emptyFields, populatedFields),
  };

  return {
    ...baseContext,
    rawGraph,
    populatedFields,
    emptyFields,
    labHealth,
  };
}

/**
 * Build a prompt context block specifically for refinement mode
 *
 * This includes:
 * - Current canonical context values
 * - Field provenance information
 * - Instructions to refine (not replace)
 */
export function buildRefinementPromptContext(
  context: RefinementLabContext,
  labId: RefinementLabId
): string {
  const lines: string[] = [];

  // Header
  lines.push('# REFINEMENT MODE CONTEXT');
  lines.push('');
  lines.push('You are operating in **Refinement Mode**.');
  lines.push('You are given the current canonical context from Brain/Context.');
  lines.push('Your job is to **refine, clarify, and correct** this context, NOT to reinvent it from scratch.');
  lines.push('');

  // Instructions
  lines.push('## Instructions');
  lines.push('');
  lines.push('1. **Preserve strong, coherent existing context** - do not change values that are already good.');
  lines.push('2. **Only propose changes when**:');
  lines.push('   - Something is clearly missing');
  lines.push('   - Something is clearly inconsistent');
  lines.push('   - There is a clearly better articulation derived from website analysis');
  lines.push('3. **Respect human overrides** - fields marked as human override should not be changed.');
  lines.push('4. **Use high confidence (0.8+) only** when you have strong evidence.');
  lines.push('');

  // Current context
  lines.push('## Current Canonical Context');
  lines.push('');

  // Group fields by domain
  const byDomain: Record<string, typeof context.populatedFields> = {};
  for (const field of context.populatedFields) {
    const domain = field.path.split('.')[0];
    if (!byDomain[domain]) byDomain[domain] = [];
    byDomain[domain].push(field);
  }

  for (const [domain, fields] of Object.entries(byDomain)) {
    lines.push(`### ${capitalizeFirst(domain)}`);
    lines.push('');

    for (const field of fields) {
      const fieldName = field.path.split('.')[1];
      const valueStr = formatValue(field.value);
      const overrideMarker = field.isHumanOverride ? ' [HUMAN OVERRIDE - DO NOT CHANGE]' : '';
      const sourceNote = `(source: ${field.source}, confidence: ${field.confidence.toFixed(2)})`;

      lines.push(`**${fieldName}**${overrideMarker}:`);
      lines.push(valueStr);
      lines.push(`_${sourceNote}_`);
      lines.push('');
    }
  }

  // Empty fields
  if (context.emptyFields.length > 0) {
    lines.push('## Missing/Empty Fields');
    lines.push('');
    lines.push('These fields are currently empty and may need values:');
    lines.push('');
    for (const path of context.emptyFields) {
      lines.push(`- ${path}`);
    }
    lines.push('');
  }

  // Lab health summary
  lines.push('## Context Health');
  lines.push('');
  lines.push(`- Completeness: ${context.labHealth.completeness}%`);
  lines.push(`- Critical fields: ${context.labHealth.criticalFieldsPresent}/${context.labHealth.criticalFieldsTotal}`);
  if (context.labHealth.recommendations.length > 0) {
    lines.push('- Recommendations:');
    for (const rec of context.labHealth.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Build the response format instructions for refinement mode
 */
export function buildRefinementResponseFormat(): string {
  return `
## Response Format

Return a JSON object with:

\`\`\`json
{
  "refinedContext": [
    {
      "path": "domain.fieldName",
      "newValue": <the refined value>,
      "confidence": 0.85,
      "reason": "Short explanation for the change"
    }
  ],
  "diagnostics": [
    {
      "code": "diagnostic_code",
      "message": "Human-readable message",
      "severity": "info|warning|error"
    }
  ],
  "summary": "Brief summary of refinements made"
}
\`\`\`

**Important**:
- Only include fields you are changing in refinedContext
- Do NOT include fields you are keeping the same
- Do NOT include fields marked as HUMAN OVERRIDE
- Use confidence 0.8+ for high-confidence refinements
- Use confidence 0.5-0.8 for moderate confidence
- Include a diagnostic if something needs human attention
`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getFieldFromGraph(
  graph: CompanyContextGraph | null,
  path: string
): WithMetaType<unknown> | null {
  if (!graph) return null;

  const [domain, field] = path.split('.');
  const domainObj = graph[domain as keyof CompanyContextGraph] as Record<string, WithMetaType<unknown>> | undefined;
  if (!domainObj || typeof domainObj !== 'object') return null;

  return domainObj[field] || null;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function isHumanSource(source?: string): boolean {
  if (!source) return false;
  const humanSources = ['user', 'manual', 'qbr', 'strategy', 'setup_wizard'];
  return humanSources.includes(source);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((v) => `- ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function buildLabRecommendations(
  labId: RefinementLabId,
  emptyFields: string[],
  populatedFields: RefinementLabContext['populatedFields']
): string[] {
  const recommendations: string[] = [];

  // Check for low-confidence fields
  const lowConfidence = populatedFields.filter((f) => f.confidence < 0.6);
  if (lowConfidence.length > 0) {
    recommendations.push(`${lowConfidence.length} field(s) have low confidence and may need review`);
  }

  // Lab-specific recommendations
  if (labId === 'audience') {
    if (emptyFields.includes('audience.coreSegments')) {
      recommendations.push('Core audience segments are missing - critical for targeting');
    }
    if (emptyFields.includes('audience.painPoints')) {
      recommendations.push('Pain points are missing - important for messaging');
    }
  }

  if (labId === 'brand') {
    if (emptyFields.includes('brand.positioning')) {
      recommendations.push('Brand positioning is missing - foundational for all brand work');
    }
    if (emptyFields.includes('brand.valueProps')) {
      recommendations.push('Value propositions are missing - key for differentiation');
    }
  }

  if (labId === 'creative') {
    if (emptyFields.includes('creative.coreMessages')) {
      recommendations.push('Core messages are missing - needed for creative development');
    }
    if (emptyFields.includes('creative.messaging')) {
      recommendations.push('Messaging architecture is missing - defines value prop and pillars');
    }
  }

  if (labId === 'competitor') {
    if (emptyFields.includes('competitive.primaryAxis')) {
      recommendations.push('Primary positioning axis not defined - needed for competitive mapping');
    }
    if (emptyFields.includes('competitive.competitors')) {
      recommendations.push('No competitors defined - run Competitor Lab to populate');
    }
    if (emptyFields.includes('competitive.whitespaceOpportunities')) {
      recommendations.push('Whitespace opportunities not identified - strategic gaps to explore');
    }
  }

  if (labId === 'website') {
    if (emptyFields.includes('website.websiteSummary')) {
      recommendations.push('Website summary missing - run Website Lab for comprehensive analysis');
    }
    if (emptyFields.includes('website.conversionBlocks')) {
      recommendations.push('Conversion blockers not identified - critical for funnel optimization');
    }
    if (emptyFields.includes('website.quickWins')) {
      recommendations.push('Quick wins not identified - low-effort improvements to prioritize');
    }
    if (emptyFields.includes('website.criticalIssues')) {
      recommendations.push('Critical issues not documented - may impact conversion');
    }
  }

  return recommendations;
}

// ============================================================================
// Exports
// ============================================================================

export {
  getBaseLabContext as getLabContext,
  buildLabPromptContext,
  checkLabReadiness,
  getLabContextSummary,
};
