// lib/gap/parseGapIaOutput.ts
/**
 * Parse and validate GAP-IA LLM output into InitialAssessmentOutput
 * Handles repair, normalization, and logging for constraint violations
 */

import {
  validateInitialAssessmentOutput,
  type InitialAssessmentOutput,
} from './outputTemplates';
import { mapInitialAssessmentToApiResponse, type GapIaV2AiOutput } from './outputMappers';

/**
 * Business context for GAP-IA analysis
 */
export interface GapIaBusinessContext {
  url: string;
  domain: string;
  businessName?: string;
  companyType?: string;
  brandTier?: string;
  htmlSignals?: any;
  digitalFootprint?: any;
  multiPageSnapshot?: any;
}

/**
 * Parse raw LLM JSON output into validated InitialAssessmentOutput
 *
 * @param rawOutput - Raw JSON string or object from LLM
 * @param options - Parsing options
 * @returns Validated InitialAssessmentOutput
 */
export function parseGapIaOutput(
  rawOutput: string | unknown,
  options: {
    strict?: boolean;
    logViolations?: boolean;
  } = {}
): InitialAssessmentOutput {
  const { strict = false, logViolations = true } = options;

  // Parse JSON if string
  let parsed: unknown;
  if (typeof rawOutput === 'string') {
    try {
      parsed = JSON.parse(rawOutput);
    } catch (error) {
      if (logViolations) {
        console.error('[gap-ia/parse] JSON parse error:', error);
      }
      throw new Error('Invalid JSON from LLM');
    }
  } else {
    parsed = rawOutput;
  }

  // Validate and repair using outputTemplates validation
  try {
    const validated = validateInitialAssessmentOutput(parsed, { strict });

    // Log constraint violations
    if (logViolations) {
      logConstraintViolations(parsed, validated);
    }

    return validated;
  } catch (error) {
    if (logViolations) {
      console.error('[gap-ia/parse] Validation error:', error);
      console.error('[gap-ia/parse] Raw output:', JSON.stringify(parsed, null, 2));
    }
    throw error;
  }
}

/**
 * Parse GAP-IA output and map to API response format
 *
 * @param rawOutput - Raw JSON from LLM
 * @param context - Business context for enrichment
 * @returns Complete GapIaV2AiOutput for API response
 */
export function parseAndMapGapIaOutput(
  rawOutput: string | unknown,
  context: GapIaBusinessContext
): GapIaV2AiOutput {
  // Parse into InitialAssessmentOutput
  const templateOutput = parseGapIaOutput(rawOutput, {
    strict: false,
    logViolations: true,
  });

  // Map to API response format (backward compatible)
  const apiResponse = mapInitialAssessmentToApiResponse(templateOutput, context);

  console.log('[gap-ia/parse] ✅ Successfully parsed and mapped GAP-IA output');
  console.log(`[gap-ia/parse] Overall Score: ${templateOutput.marketingReadinessScore}`);
  console.log(`[gap-ia/parse] Maturity Stage: ${templateOutput.maturityStage}`);
  console.log(`[gap-ia/parse] Top Opportunities: ${templateOutput.topOpportunities.length}`);
  console.log(`[gap-ia/parse] Quick Wins: ${templateOutput.quickWins.length}`);
  console.log(`[gap-ia/parse] Dimension Summaries: ${templateOutput.dimensionSummaries.length}`);

  return apiResponse;
}

/**
 * Log constraint violations (when LLM output doesn't match hard constraints)
 */
function logConstraintViolations(raw: any, validated: InitialAssessmentOutput): void {
  const violations: string[] = [];

  // Check topOpportunities count
  if (raw.topOpportunities && raw.topOpportunities.length !== 3) {
    violations.push(
      `topOpportunities: Expected 3, got ${raw.topOpportunities.length} (normalized to 3)`
    );
  }

  // Check quickWins count
  if (raw.quickWins && raw.quickWins.length !== 3) {
    violations.push(
      `quickWins: Expected 3, got ${raw.quickWins.length} (normalized to 3)`
    );
  }

  // Check dimensionSummaries count
  if (raw.dimensionSummaries && raw.dimensionSummaries.length !== 6) {
    violations.push(
      `dimensionSummaries: Expected 6, got ${raw.dimensionSummaries.length} (filled missing dimensions)`
    );
  }

  // Check executive summary length (rough heuristic: < 500 chars = ~3-4 sentences)
  if (raw.executiveSummary && raw.executiveSummary.length > 500) {
    violations.push(
      `executiveSummary: Too long (${raw.executiveSummary.length} chars). Should be 3-4 sentences (~200-400 chars)`
    );
  }

  // Check for missing dimension IDs
  if (raw.dimensionSummaries) {
    const requiredIds = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];
    const actualIds = new Set(raw.dimensionSummaries.map((d: any) => d.id));
    const missing = requiredIds.filter((id) => !actualIds.has(id));
    if (missing.length > 0) {
      violations.push(
        `dimensionSummaries: Missing dimensions: ${missing.join(', ')} (filled with placeholders)`
      );
    }
  }

  // Check for duplicate dimension IDs
  if (raw.dimensionSummaries) {
    const ids = raw.dimensionSummaries.map((d: any) => d.id);
    const duplicates = ids.filter((id: string, index: number) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      const uniqueDuplicates = Array.from(new Set(duplicates));
      violations.push(
        `dimensionSummaries: Duplicate dimension IDs: ${uniqueDuplicates.join(', ')}`
      );
    }
  }

  // Check for score recalculation (if LLM's overall score differs from weighted calculation)
  if (raw.marketingReadinessScore !== validated.marketingReadinessScore) {
    violations.push(
      `marketingReadinessScore: LLM provided ${raw.marketingReadinessScore}, recalculated to ${validated.marketingReadinessScore} based on dimension scores`
    );
  }

  // Log violations if any
  if (violations.length > 0) {
    console.warn('[gap-ia/parse] ⚠️  Constraint violations detected:');
    violations.forEach((v) => console.warn(`  - ${v}`));
  }
}

/**
 * Generate business-type aware context string for LLM prompt
 *
 * This provides guidance to the LLM on what to prioritize based on business type
 */
export function generateBusinessTypeContext(
  companyType?: string,
  brandTier?: string
): string {
  if (!companyType) {
    return 'Business type unknown. Use general marketing best practices.';
  }

  const contexts: Record<string, string> = {
    local_business: `
This is a LOCAL BUSINESS (${brandTier || 'local'}).
CRITICAL PRIORITIES:
- Google Business Profile (ESSENTIAL - must be in top opportunities if missing)
- Local search and Google Maps visibility
- Instagram/Facebook social presence
- Reviews and reputation
- Schedule, hours, location clarity
DO NOT prioritize LinkedIn unless specifically relevant.
    `.trim(),

    b2c_services: `
This is a B2C SERVICES business (${brandTier || 'smb'}).
PRIORITIES:
- Service clarity and differentiation
- Reviews and social proof
- Easy booking/consultation CTAs
- Instagram/Facebook for brand building
- Google Business Profile if local
LinkedIn is generally NOT relevant unless B2B component.
    `.trim(),

    b2b_saas: `
This is a B2B SAAS company (${brandTier || 'startup'}).
CRITICAL PRIORITIES:
- LinkedIn Company Page (ESSENTIAL - must be in top opportunities if missing)
- Content depth (blog, case studies, whitepapers)
- Thought leadership and POV
- Pricing transparency
- Demo/trial conversion flow
- Case studies and social proof
Google Business Profile is NOT relevant unless local sales.
    `.trim(),

    b2b_services: `
This is a B2B SERVICES company (${brandTier || 'smb'}).
CRITICAL PRIORITIES:
- LinkedIn Company Page (ESSENTIAL)
- Case studies and portfolio
- Service differentiation and expertise signals
- Thought leadership content
- Authority signals (credentials, media, awards)
Google Business Profile optional unless local presence.
    `.trim(),

    ecommerce: `
This is an ECOMMERCE business (${brandTier || 'smb'}).
PRIORITIES:
- Product page UX and clarity
- Reviews and ratings
- Cart/checkout friction reduction
- Merchandising and navigation
- Instagram/Pinterest for discovery
- Site speed and mobile experience
LinkedIn is generally NOT relevant.
    `.trim(),

    marketplace: `
This is a MARKETPLACE platform (${brandTier || 'startup'}).
PRIORITIES:
- Two-sided value prop clarity (buyer + seller)
- Trust and safety signals
- Network effects messaging
- SEO for category coverage
- Content for both sides of marketplace
    `.trim(),
  };

  return contexts[companyType] || `Business type: ${companyType}. Prioritize accordingly.`;
}
