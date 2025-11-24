// lib/gap/parseFullGapOutput.ts
/**
 * Parse and validate Full GAP LLM output into FullGapOutput
 * Handles repair, normalization, and logging for constraint violations
 */

import {
  validateFullGapOutput,
  type FullGapOutput,
  type InitialAssessmentOutput,
} from './outputTemplates';
import { mapFullGapToApiResponse } from './outputMappers';

/**
 * Business context for Full GAP generation
 */
export interface FullGapBusinessContext {
  url: string;
  domain: string;
  businessName: string;
  gapId: string;
  companyType?: string;
  brandTier?: string;
}

/**
 * Parse raw LLM JSON output into validated FullGapOutput
 *
 * @param rawOutput - Raw JSON string or object from LLM
 * @param gapIaOutput - Source Initial Assessment output (for score validation)
 * @param options - Parsing options
 * @returns Validated FullGapOutput
 */
export function parseFullGapOutput(
  rawOutput: string | unknown,
  gapIaOutput: InitialAssessmentOutput,
  options: {
    strict?: boolean;
    logViolations?: boolean;
  } = {}
): FullGapOutput {
  const { strict = false, logViolations = true } = options;

  // Parse JSON if string
  let parsed: unknown;
  if (typeof rawOutput === 'string') {
    try {
      parsed = JSON.parse(rawOutput);
    } catch (error) {
      if (logViolations) {
        console.error('[full-gap/parse] JSON parse error:', error);
      }
      throw new Error('Invalid JSON from LLM');
    }
  } else {
    parsed = rawOutput;
  }

  // Extract IA scores for validation
  const gapIaScores = {
    overall: gapIaOutput.marketingReadinessScore,
    dimensions: gapIaOutput.dimensionSummaries.reduce(
      (acc, dim) => {
        acc[dim.id] = dim.score;
        return acc;
      },
      {} as Record<string, number>
    ),
  };

  // Validate and repair using outputTemplates validation
  try {
    const validated = validateFullGapOutput(parsed, gapIaScores, { strict });

    // Log constraint violations
    if (logViolations) {
      logFullGapConstraintViolations(parsed, validated, gapIaOutput);
    }

    return validated;
  } catch (error) {
    if (logViolations) {
      console.error('[full-gap/parse] Validation error:', error);
      console.error('[full-gap/parse] Raw output:', JSON.stringify(parsed, null, 2));
    }
    throw error;
  }
}

/**
 * Parse Full GAP output and map to API response format
 *
 * @param rawOutput - Raw JSON from LLM
 * @param gapIaOutput - Source Initial Assessment
 * @param context - Business context
 * @returns Mapped response for API/Airtable
 */
export function parseAndMapFullGapOutput(
  rawOutput: string | unknown,
  gapIaOutput: InitialAssessmentOutput,
  context: FullGapBusinessContext
): ReturnType<typeof mapFullGapToApiResponse> {
  // Parse into FullGapOutput
  const templateOutput = parseFullGapOutput(rawOutput, gapIaOutput, {
    strict: false,
    logViolations: true,
  });

  // Map to API response format
  const apiResponse = mapFullGapToApiResponse(templateOutput, context);

  console.log('[full-gap/parse] ✅ Successfully parsed and mapped Full GAP output');
  console.log(`[full-gap/parse] Overall Score: ${templateOutput.overallScore}`);
  console.log(`[full-gap/parse] Maturity Stage: ${templateOutput.maturityStage}`);
  console.log(`[full-gap/parse] Quick Wins: ${templateOutput.quickWins.length}`);
  console.log(`[full-gap/parse] Strategic Priorities: ${templateOutput.strategicPriorities.length}`);
  console.log(`[full-gap/parse] KPIs: ${templateOutput.kpis.length}`);

  return apiResponse;
}

/**
 * Log constraint violations for Full GAP output
 */
function logFullGapConstraintViolations(
  raw: any,
  validated: FullGapOutput,
  gapIaOutput: InitialAssessmentOutput
): void {
  const violations: string[] = [];

  // Check executive summary length
  if (raw.executiveSummary) {
    const wordCount = raw.executiveSummary.split(/\s+/).length;
    if (wordCount < 150) {
      violations.push(
        `executiveSummary: Too short (${wordCount} words). Should be 200-400 words (2-3 paragraphs)`
      );
    } else if (wordCount > 500) {
      violations.push(
        `executiveSummary: Too long (${wordCount} words). Should be 200-400 words (2-3 paragraphs)`
      );
    }
  }

  // Check dimension analyses count
  if (raw.dimensionAnalyses && raw.dimensionAnalyses.length !== 6) {
    violations.push(
      `dimensionAnalyses: Expected 6, got ${raw.dimensionAnalyses.length} (filled missing dimensions)`
    );
  }

  // Check quick wins count
  if (raw.quickWins) {
    if (raw.quickWins.length < 3) {
      violations.push(
        `quickWins: Expected 3-5, got ${raw.quickWins.length} (filled to minimum)`
      );
    } else if (raw.quickWins.length > 5) {
      violations.push(
        `quickWins: Expected 3-5, got ${raw.quickWins.length} (trimmed to 5)`
      );
    }
  }

  // Check strategic priorities count
  if (raw.strategicPriorities) {
    if (raw.strategicPriorities.length < 3) {
      violations.push(
        `strategicPriorities: Expected 3-7, got ${raw.strategicPriorities.length} (filled to minimum)`
      );
    } else if (raw.strategicPriorities.length > 7) {
      violations.push(
        `strategicPriorities: Expected 3-7, got ${raw.strategicPriorities.length} (trimmed to 7)`
      );
    }
  }

  // Check roadmap phases
  if (raw.roadmap90Days) {
    const phases = ['phase0_30', 'phase30_60', 'phase60_90'];
    for (const phase of phases) {
      if (!raw.roadmap90Days[phase]) {
        violations.push(`roadmap90Days: Missing ${phase} (filled with placeholder)`);
      } else if (!raw.roadmap90Days[phase].actions || raw.roadmap90Days[phase].actions.length < 4) {
        violations.push(
          `roadmap90Days.${phase}: Expected 4-7 actions, got ${raw.roadmap90Days[phase]?.actions?.length || 0} (filled to minimum)`
        );
      }
    }
  }

  // Check KPIs count
  if (raw.kpis) {
    if (raw.kpis.length < 4) {
      violations.push(
        `kpis: Expected 4-7, got ${raw.kpis.length} (filled to minimum)`
      );
    } else if (raw.kpis.length > 7) {
      violations.push(
        `kpis: Expected 4-7, got ${raw.kpis.length} (trimmed to 7)`
      );
    }
  }

  // Check score consistency with IA
  if (raw.overallScore !== gapIaOutput.marketingReadinessScore) {
    violations.push(
      `overallScore: Changed from IA (${gapIaOutput.marketingReadinessScore}) to Full GAP (${raw.overallScore}). Scores are read-only! Reverted to IA score.`
    );
  }

  // Check dimension score consistency
  if (raw.dimensionAnalyses) {
    for (const dimAnalysis of raw.dimensionAnalyses) {
      const iaDim = gapIaOutput.dimensionSummaries.find((d) => d.id === dimAnalysis.id);
      if (iaDim && Math.abs(dimAnalysis.score - iaDim.score) > 2) {
        violations.push(
          `dimensionAnalyses.${dimAnalysis.id}: Score changed from IA (${iaDim.score}) to Full GAP (${dimAnalysis.score}). Scores are read-only! Reverted to IA score.`
        );
      }
    }
  }

  // Log violations if any
  if (violations.length > 0) {
    console.warn('[full-gap/parse] ⚠️  Constraint violations detected:');
    violations.forEach((v) => console.warn(`  - ${v}`));
  }
}

/**
 * Generate Full GAP prompt context from Initial Assessment
 *
 * This creates a structured summary of the IA to pass to the Full GAP LLM call
 */
export function generateFullGapPromptContext(
  gapIaOutput: InitialAssessmentOutput,
  businessContext: {
    businessType?: string;
    brandTier?: string;
    companyName?: string;
    url?: string;
  }
): string {
  const { businessType, brandTier, companyName, url } = businessContext;

  return `
════════════════════════════════════════════
INITIAL ASSESSMENT (GAP-IA) SUMMARY
════════════════════════════════════════════

**Company**: ${companyName || url || 'Unknown'}
**Business Type**: ${businessType || 'Unknown'}
**Brand Tier**: ${brandTier || 'Unknown'}

**Overall Score**: ${gapIaOutput.marketingReadinessScore}/100
**Maturity Stage**: ${gapIaOutput.maturityStage}

**Executive Summary** (from IA):
${gapIaOutput.executiveSummary}

**Top Opportunities** (from IA):
${gapIaOutput.topOpportunities.map((opp: string, i: number) => `${i + 1}. ${opp}`).join('\n')}

**Quick Wins** (from IA):
${gapIaOutput.quickWins.map((qw, i) => `${i + 1}. ${qw.action} (${qw.dimensionId})`).join('\n')}

**Dimension Scores** (from IA - READ-ONLY):
${gapIaOutput.dimensionSummaries.map((dim) => `- ${dim.id}: ${dim.score}/100 - ${dim.summary}`).join('\n')}

════════════════════════════════════════════

**YOUR TASK:**

Build a comprehensive 90-day Growth Acceleration Plan that:
1. DEEPENS the IA insights with concrete examples and strategic context
2. Does NOT repeat IA text verbatim (expand it!)
3. Uses the IA scores as anchors (DO NOT re-score)
4. Creates strategic programs (not just quick wins)
5. Adapts to the businessType: ${businessType || 'general'}

Remember:
- IA scores are FIXED and READ-ONLY
- Each section must add NEW depth beyond the IA
- Strategic priorities are multi-step programs, NOT quick win rewrites
- Recommendations must match the business type (e.g., no LinkedIn for local gyms)

Now generate the Full GAP JSON output.
  `.trim();
}
