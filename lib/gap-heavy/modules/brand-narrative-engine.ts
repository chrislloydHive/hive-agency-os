// lib/gap-heavy/modules/brand-narrative-engine.ts
// Brand Lab Narrative Engine
//
// Produces a full consultant-style narrative report from Brand Lab results.
// Long-form, markdown-like, text-first — similar to early GAP reports.

import type {
  BrandDiagnosticResult,
  BrandActionPlan,
  BrandNarrativeReport,
} from './brandLab';
import { BrandNarrativeReportSchema } from './brandLab';
import { getOpenAI } from '@/lib/openai';

// ============================================================================
// MAIN NARRATIVE GENERATION FUNCTION
// ============================================================================

export interface GenerateNarrativeInput {
  companyName: string;
  websiteUrl: string;
  diagnostic: BrandDiagnosticResult;
  actionPlan: BrandActionPlan;
}

/**
 * Generate a consultant-style narrative report from Brand Lab results.
 *
 * @param input - Company info, diagnostic, and action plan
 * @returns BrandNarrativeReport with all sections filled
 */
export async function generateBrandNarrativeReport(
  input: GenerateNarrativeInput
): Promise<BrandNarrativeReport> {
  const { companyName, websiteUrl, diagnostic, actionPlan } = input;

  console.log('[Brand Narrative Engine] Generating narrative for:', companyName);

  // Dev logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEBUG BRAND NARRATIVE] Starting generation with:', {
      companyName,
      websiteUrl,
      brandScore: diagnostic.score,
      benchmarkLabel: diagnostic.benchmarkLabel,
    });
  }

  // Truncate large fields before sending to OpenAI
  const truncatedDiagnostic = truncateDiagnosticForLLM(diagnostic);
  const truncatedActionPlan = truncateActionPlanForLLM(actionPlan);

  const systemPrompt = buildNarrativeSystemPrompt();
  const userPrompt = buildNarrativeUserPrompt({
    companyName,
    websiteUrl,
    diagnostic: truncatedDiagnostic,
    actionPlan: truncatedActionPlan,
  });

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from LLM');
    }

    // Dev logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG BRAND NARRATIVE REPORT (RAW TEXT BEFORE PARSE)]:', content.substring(0, 500) + '...');
    }

    const parsed = JSON.parse(content);
    const validated = BrandNarrativeReportSchema.parse(parsed);

    console.log('[Brand Narrative Engine] Narrative generated successfully');
    return validated;

  } catch (error) {
    console.error('[Brand Narrative Engine] Error generating narrative:', error);
    // Return a fallback narrative
    return getFallbackNarrative(companyName, websiteUrl, diagnostic, actionPlan);
  }
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildNarrativeSystemPrompt(): string {
  return `You are a senior brand strategist at a top-tier marketing consultancy.

Your task is to write a consultant-style narrative report based on the structured brand diagnostic data provided.

TONE & STYLE:
- Clear, practical, specific. Zero fluff.
- Use insights and data from the diagnostic and action plan.
- Do NOT produce marketing copy. This is internal strategist analysis.
- Write as if presenting to the CEO or CMO of this company.
- Be direct about problems. Don't sugarcoat issues.
- Cite specific findings from the diagnostic when making claims.

REPORT STRUCTURE:
Your output must be a JSON object with these sections:

{
  "meta": {
    "generatedAt": "ISO timestamp",
    "companyName": "...",
    "websiteUrl": "...",
    "brandScore": 0-100,
    "benchmarkLabel": "weak|developing|solid|strong|category_leader"
  },
  "executiveSummary": "2-3 paragraphs. Lead with the headline finding. Summarize brand health, key issues, and recommended direction.",
  "brandStorySection": "Analysis of whether the brand has a compelling origin story, purpose, or reason-to-exist. Does it connect emotionally?",
  "positioningSection": "Is positioning clear? Differentiated? Does the brand own a meaningful space in the market?",
  "messagingSection": "Is the messaging clear, consistent, and benefit-focused? Does it speak to the target audience?",
  "trustSection": "Does the brand demonstrate credibility? Human presence? Social proof? Are there gaps?",
  "visualSection": "Is the visual brand cohesive, memorable, and appropriate for the target audience?",
  "audienceFitSection": "Does the brand clearly speak to its ICP? Are there misalignment signals?",
  "priorityThemesSection": "What are the 2-4 key themes that emerged from the analysis? What patterns or root causes drive the issues?",
  "quickWinsBullets": ["3-5 immediate actions that can be done in 1-2 weeks"],
  "strategicInitiativesBullets": ["3-5 larger initiatives for the next 30-90 days"],
  "risksSection": "What brand risks exist? What happens if they're not addressed?",
  "recommendedSequencingSection": "How should work be prioritized? What comes NOW vs NEXT vs LATER? Why?"
}

Each section should be 2-4 paragraphs of substantive analysis.
Use specific findings from the diagnostic - don't be generic.
Output ONLY valid JSON matching this structure.`;
}

function buildNarrativeUserPrompt(input: {
  companyName: string;
  websiteUrl: string;
  diagnostic: Partial<BrandDiagnosticResult>;
  actionPlan: Partial<BrandActionPlan>;
}): string {
  const { companyName, websiteUrl, diagnostic, actionPlan } = input;

  return `Generate a comprehensive brand narrative report for this company.

COMPANY: ${companyName}
WEBSITE: ${websiteUrl}

This is an INTERNAL Hive strategist narrative — not client-facing copy.
Be specific, analytical, and action-oriented.

=== BRAND DIAGNOSTIC DATA ===
${JSON.stringify(diagnostic, null, 2)}

=== ACTION PLAN DATA ===
${JSON.stringify(actionPlan, null, 2)}

=== REQUIREMENTS ===
1. Fill EVERY section in the report structure
2. Identify contradictions, risks, and clarity gaps
3. Emphasize NOW vs NEXT vs LATER sequencing
4. Use SPECIFIC findings from the diagnostic - avoid generic platitudes
5. If brand pillars, inconsistencies, or risks are provided, reference them directly
6. Connect observations to business impact

Generate the full narrative report as JSON.`;
}

// ============================================================================
// TRUNCATION HELPERS
// ============================================================================

function truncateDiagnosticForLLM(diagnostic: BrandDiagnosticResult): Partial<BrandDiagnosticResult> {
  // Keep structured data but limit array sizes
  return {
    score: diagnostic.score,
    benchmarkLabel: diagnostic.benchmarkLabel,
    summary: diagnostic.summary,
    brandPillars: diagnostic.brandPillars?.slice(0, 5),
    identitySystem: diagnostic.identitySystem,
    messagingSystem: {
      ...diagnostic.messagingSystem,
      headlinePatterns: diagnostic.messagingSystem.headlinePatterns?.slice(0, 5),
      valueProps: diagnostic.messagingSystem.valueProps?.slice(0, 3),
      clarityIssues: diagnostic.messagingSystem.clarityIssues?.slice(0, 5),
    },
    positioning: diagnostic.positioning,
    audienceFit: diagnostic.audienceFit,
    trustAndProof: diagnostic.trustAndProof,
    visualSystem: diagnostic.visualSystem,
    brandAssets: diagnostic.brandAssets,
    inconsistencies: diagnostic.inconsistencies?.slice(0, 5),
    opportunities: diagnostic.opportunities?.slice(0, 5),
    risks: diagnostic.risks?.slice(0, 5),
    // Skip personas to save tokens
  };
}

function truncateActionPlanForLLM(actionPlan: BrandActionPlan): Partial<BrandActionPlan> {
  return {
    summary: actionPlan.summary,
    overallScore: actionPlan.overallScore,
    benchmarkLabel: actionPlan.benchmarkLabel,
    keyThemes: actionPlan.keyThemes?.slice(0, 4),
    now: actionPlan.now?.slice(0, 5).map(truncateWorkItem),
    next: actionPlan.next?.slice(0, 5).map(truncateWorkItem),
    later: actionPlan.later?.slice(0, 3).map(truncateWorkItem),
    strategicChanges: actionPlan.strategicChanges?.slice(0, 3),
  };
}

function truncateWorkItem(item: any): any {
  return {
    id: item.id,
    title: item.title,
    description: item.description?.substring(0, 200),
    dimension: item.dimension,
    impactScore: item.impactScore,
    priority: item.priority,
  };
}

// ============================================================================
// FALLBACK NARRATIVE
// ============================================================================

function getFallbackNarrative(
  companyName: string,
  websiteUrl: string,
  diagnostic: BrandDiagnosticResult,
  actionPlan: BrandActionPlan
): BrandNarrativeReport {
  const { score, benchmarkLabel, summary } = diagnostic;
  const nowCount = actionPlan.now?.length || 0;
  const nextCount = actionPlan.next?.length || 0;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      companyName,
      websiteUrl,
      brandScore: score,
      benchmarkLabel,
    },
    executiveSummary: `${companyName} scored ${score}/100 on the brand diagnostic, placing them in the "${benchmarkLabel}" tier. ${summary}\n\nThis analysis identified ${nowCount} immediate priorities and ${nextCount} follow-up actions for brand improvement.`,
    brandStorySection: 'Brand story analysis unavailable. The narrative engine encountered an error during generation.',
    positioningSection: `Current positioning theme: ${diagnostic.positioning.positioningTheme}. Positioning clarity score: ${diagnostic.positioning.positioningClarityScore}/100.`,
    messagingSection: `Messaging focus score: ${diagnostic.messagingSystem.messagingFocusScore}/100. ICP clarity score: ${diagnostic.messagingSystem.icpClarityScore}/100.`,
    trustSection: `Trust signals score: ${diagnostic.trustAndProof.trustSignalsScore}/100. Human presence score: ${diagnostic.trustAndProof.humanPresenceScore}/100.`,
    visualSection: `Visual consistency score: ${diagnostic.visualSystem.visualConsistencyScore}/100. Brand recognition score: ${diagnostic.visualSystem.brandRecognitionScore}/100.`,
    audienceFitSection: `Primary ICP: ${diagnostic.audienceFit.primaryICPDescription}. Alignment score: ${diagnostic.audienceFit.alignmentScore}/100.`,
    priorityThemesSection: actionPlan.keyThemes?.map(t => t.label).join(', ') || 'Themes unavailable.',
    quickWinsBullets: actionPlan.now?.slice(0, 5).map(item => item.title) || ['Review action plan for quick wins'],
    strategicInitiativesBullets: actionPlan.next?.slice(0, 5).map(item => item.title) || ['Review action plan for strategic initiatives'],
    risksSection: diagnostic.risks?.map(r => r.description).join(' ') || 'Risk analysis unavailable.',
    recommendedSequencingSection: `Start with the ${nowCount} items in the NOW bucket, then progress to the ${nextCount} NEXT items.`,
  };
}
