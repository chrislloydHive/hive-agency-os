/**
 * Website V5 Deep Narrative Engine - Implementation
 *
 * Generates consultant-grade, long-form narrative reports from Website Lab results.
 */

import { openai } from '@/lib/openai';
import type {
  WebsiteNarrativeReport,
  WebsiteNarrativeSection,
  WebsiteNarrativeBenchmark,
  WebsiteNarrativeKeyStats,
} from './websiteNarrativeReport';
import {
  WebsiteNarrativeReportSchema,
  NARRATIVE_SECTION_IDS,
  NARRATIVE_SECTION_ORDER,
} from './websiteNarrativeReport';
import type { WebsiteUXLabResultV4 } from './websiteLab';
import type { WebsiteActionPlan } from './websiteActionPlan';
import type { HeavyGapRunState } from '../state';

// ────────────────────────────────────────────────────────────────────────────
// Input Types
// ────────────────────────────────────────────────────────────────────────────

export interface NarrativeEngineInput {
  /**
   * Website Lab V4/V5 result (required)
   */
  labResult: WebsiteUXLabResultV4;

  /**
   * Optional action plan for better prioritization language
   */
  actionPlan?: WebsiteActionPlan;

  /**
   * Optional GAP context for company info
   */
  gapContext?: {
    companyName?: string;
    websiteUrl?: string;
    maturityStage?: string;
    industryContext?: string;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Core Engine Function
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a comprehensive narrative report from Website Lab results
 *
 * This is the main entry point for the narrative engine.
 */
export async function buildWebsiteNarrativeReport(
  input: NarrativeEngineInput
): Promise<WebsiteNarrativeReport> {
  const { labResult, actionPlan, gapContext } = input;

  // Extract basic metadata
  const companyName =
    gapContext?.companyName ||
    (labResult.siteAssessment.issues || []).find((issue) => typeof issue === 'object' && 'description' in issue && typeof issue.description === 'string' && issue.description.includes('company'))?.description.split(' ')[0] ||
    'the company';

  const websiteUrl =
    gapContext?.websiteUrl ||
    labResult.siteGraph.primaryEntryPath ||
    labResult.siteGraph.pages[0]?.url ||
    'unknown';

  const overallScore = labResult.siteAssessment.score;
  const benchmarkLabel = determineBenchmarkLabel(overallScore, labResult);

  // Prepare condensed context for LLM
  const context = prepareContextForLLM(labResult, actionPlan, gapContext);

  // Generate narrative via LLM
  const narrative = await generateNarrativeWithLLM(context, {
    companyName,
    websiteUrl,
    overallScore,
    benchmarkLabel,
  });

  // Build key stats
  const keyStats = buildKeyStats(labResult);

  // Build metadata
  const metadata = {
    pagesAnalyzed: labResult.siteGraph.pages.length,
    personasTested: labResult.personas.length,
    heuristicsFlagged: labResult.heuristics.findings.length,
    analysisDepth: determineAnalysisDepth(labResult),
  };

  const report: WebsiteNarrativeReport = {
    title: `Website Experience Diagnostic Report`,
    companyName,
    websiteUrl,
    generatedAt: new Date().toISOString(),
    overallScore,
    benchmarkLabel,
    executiveSummaryMarkdown: narrative.executiveSummary,
    keyStats,
    sections: narrative.sections,
    metadata,
  };

  // Validate with Zod
  const validated = WebsiteNarrativeReportSchema.parse(report);
  return validated;
}

// ────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Determine benchmark label based on score and context
 */
function determineBenchmarkLabel(
  score: number,
  labResult: WebsiteUXLabResultV4
): WebsiteNarrativeBenchmark {
  // If lab result has a benchmark label, map it
  if (labResult.siteAssessment.benchmarkLabel) {
    const label = labResult.siteAssessment.benchmarkLabel;
    if (label === 'elite') return 'leader';
    if (label === 'strong') return 'strong';
    if (label === 'average') return 'average';
    if (label === 'weak') return 'weak';
  }

  // Otherwise use score thresholds
  if (score >= 80) return 'leader';
  if (score >= 65) return 'strong';
  if (score >= 45) return 'average';
  return 'weak';
}

/**
 * Build key stats summary
 */
function buildKeyStats(labResult: WebsiteUXLabResultV4): WebsiteNarrativeKeyStats {
  const successfulPersonas = labResult.personas.filter((p) => p.success).length;
  const personaSuccessRate =
    labResult.personas.length > 0
      ? Math.round((successfulPersonas / labResult.personas.length) * 100)
      : undefined;

  const criticalIssues = (labResult.siteAssessment.issues || []).filter((issue) =>
    typeof issue === 'object' && 'severity' in issue && issue.severity === 'high'
  ).length;

  const quickWinsCount = labResult.siteAssessment.quickWins?.length || 0;

  return {
    overallScore: labResult.siteAssessment.score,
    funnelHealthScore: labResult.siteAssessment.funnelHealthScore,
    trustScore: labResult.trustAnalysis?.trustScore,
    contentClarityScore: labResult.contentIntelligence?.summaryScore,
    conversionReadinessScore: labResult.strategistViews?.conversion?.conversionReadinessScore,
    visualModernityScore: labResult.visualBrandEvaluation?.visualModernityScore,
    personaSuccessRate,
    criticalIssuesCount: criticalIssues || undefined,
    quickWinsCount: quickWinsCount || undefined,
  };
}

/**
 * Determine analysis depth based on available data
 */
function determineAnalysisDepth(
  labResult: WebsiteUXLabResultV4
): 'basic' | 'standard' | 'comprehensive' {
  const hasPhase1 =
    labResult.ctaIntelligence &&
    labResult.contentIntelligence &&
    labResult.trustAnalysis &&
    labResult.visualBrandEvaluation &&
    labResult.impactMatrix &&
    labResult.scentTrailAnalysis;

  const hasPhase2 = labResult.strategistViews;

  if (hasPhase1 && hasPhase2) return 'comprehensive';
  if (hasPhase1) return 'standard';
  return 'basic';
}

/**
 * Prepare condensed context for LLM prompt
 */
function prepareContextForLLM(
  labResult: WebsiteUXLabResultV4,
  actionPlan?: WebsiteActionPlan,
  gapContext?: NarrativeEngineInput['gapContext']
): string {
  const sections: string[] = [];

  // 1. Overall Assessment
  sections.push(`## Overall Assessment
- Score: ${labResult.siteAssessment.score}/100
- Funnel Health: ${labResult.siteAssessment.funnelHealthScore}/100
- Multi-Page Consistency: ${labResult.siteAssessment.multiPageConsistencyScore}/100
- Benchmark: ${labResult.siteAssessment.benchmarkLabel || 'N/A'}
- Pages Analyzed: ${labResult.siteGraph.pages.length}
`);

  // 2. Section Scores
  sections.push(`## Section Scores`);
  if (labResult.siteAssessment.sectionAnalyses) {
    labResult.siteAssessment.sectionAnalyses.forEach((section) => {
      sections.push(`- ${section.dimension}: ${section.score || 'N/A'}/100 - ${section.narrative.substring(0, 100)}...`);
    });
  }

  // 3. Key Issues
  sections.push(`\n## Key Issues (Top 10)`);
  if (labResult.siteAssessment.issues) {
    labResult.siteAssessment.issues.slice(0, 10).forEach((issue, i) => {
      const issueText = typeof issue === 'string' ? issue : issue.description;
      sections.push(`${i + 1}. ${issueText}`);
    });
  }

  // 4. Recommendations
  sections.push(`\n## Top Recommendations`);
  if (labResult.siteAssessment.recommendations) {
    labResult.siteAssessment.recommendations.slice(0, 10).forEach((rec, i) => {
      sections.push(`${i + 1}. ${rec}`);
    });
  }

  // 5. Quick Wins
  if (labResult.siteAssessment.quickWins && labResult.siteAssessment.quickWins.length > 0) {
    sections.push(`\n## Quick Wins`);
    labResult.siteAssessment.quickWins.forEach((win, i) => {
      sections.push(`${i + 1}. ${win}`);
    });
  }

  // 6. Personas
  sections.push(`\n## Persona Results`);
  labResult.personas.forEach((p) => {
    sections.push(`### ${p.persona} - ${p.success ? 'SUCCESS' : 'FAILED'}
- Goal: ${p.goal}
- Clarity Score: ${p.perceivedClarityScore}/100
- Time to Goal: ${p.timeToGoalEstimate}s
- Friction: ${p.frictionNotes ? p.frictionNotes.join('; ') : 'N/A'}
- Steps: ${p.stepsTaken ? p.stepsTaken.join(' → ') : 'N/A'}`);
  });

  // 7. CTA Intelligence
  if (labResult.ctaIntelligence) {
    const topIssues = labResult.ctaIntelligence.recommendations
      ? labResult.ctaIntelligence.recommendations.slice(0, 3).join('; ')
      : 'N/A';
    sections.push(`\n## CTA Intelligence
- Summary Score: ${labResult.ctaIntelligence.summaryScore}/100
- Total CTAs: ${labResult.ctaIntelligence.ctas?.length || 0}
- Top Issues: ${topIssues}
- Narrative: ${labResult.ctaIntelligence.narrative || 'N/A'}`);
  }

  // 8. Content Intelligence
  if (labResult.contentIntelligence) {
    sections.push(`\n## Content Intelligence
- Summary Score: ${labResult.contentIntelligence.summaryScore}/100
- Value Prop Strength: ${labResult.contentIntelligence.valuePropositionStrength}/100
- Headline Quality: ${labResult.contentIntelligence.headlines.length} analyzed
- Narrative: ${labResult.contentIntelligence.narrative}`);
  }

  // 9. Trust Analysis
  if (labResult.trustAnalysis) {
    sections.push(`\n## Trust Analysis
- Trust Score: ${labResult.trustAnalysis.trustScore}/100
- Overall Density: ${labResult.trustAnalysis.overallDensity}
- Signals Found: ${labResult.trustAnalysis.signals.length}
- Narrative: ${labResult.trustAnalysis.narrative}`);
  }

  // 10. Visual Brand Evaluation
  if (labResult.visualBrandEvaluation) {
    const topRecs = labResult.visualBrandEvaluation.recommendations
      ? labResult.visualBrandEvaluation.recommendations.slice(0, 3).join('; ')
      : 'N/A';
    sections.push(`\n## Visual & Brand
- Visual Modernity: ${labResult.visualBrandEvaluation.visualModernityScore}/100
- Brand Consistency: ${labResult.visualBrandEvaluation.brandConsistencyScore}/100
- Overall Visual: ${labResult.visualBrandEvaluation.overallVisualScore}/100
- Top Recommendations: ${topRecs}`);
  }

  // 11. Impact Matrix
  if (labResult.impactMatrix) {
    sections.push(`\n## Impact Matrix
- Quick Wins: ${labResult.impactMatrix.quickWins.length}
- Major Projects: ${labResult.impactMatrix.majorProjects.length}
- Narrative: ${labResult.impactMatrix.narrative}`);
  }

  // 12. Scent Trail
  if (labResult.scentTrailAnalysis) {
    sections.push(`\n## Scent Trail Analysis
- Overall Score: ${labResult.scentTrailAnalysis.overallScore}/100
- Promise Continuity: ${labResult.scentTrailAnalysis.promiseContinuityScore}/100
- CTA Continuity: ${labResult.scentTrailAnalysis.ctaContinuityScore}/100
- Headline Consistency: ${labResult.scentTrailAnalysis.headlineConsistencyScore}/100
- Mismatches: ${labResult.scentTrailAnalysis.mismatches.length}`);
  }

  // 13. Strategist Views
  if (labResult.strategistViews?.conversion) {
    const blockers = labResult.strategistViews.conversion.funnelBlockers
      ? labResult.strategistViews.conversion.funnelBlockers.join('; ')
      : 'N/A';
    sections.push(`\n## Conversion Strategist View
- Conversion Readiness: ${labResult.strategistViews.conversion.conversionReadinessScore}/100
- Narrative: ${labResult.strategistViews.conversion.narrative || 'N/A'}
- Funnel Blockers: ${blockers}`);
  }

  if (labResult.strategistViews?.copywriting) {
    sections.push(`\n## Copywriting Strategist View
- Messaging Clarity: ${labResult.strategistViews.copywriting.messagingClarityScore}/100
- Narrative: ${labResult.strategistViews.copywriting.narrative}
- Tone: ${labResult.strategistViews.copywriting.toneAnalysis.detectedTone}`);
  }

  // 14. Action Plan (if available)
  if (actionPlan) {
    const themes = actionPlan.keyThemes?.map((t) => t.label || t.description).join(', ') || 'N/A';
    const nowItems = actionPlan.now?.slice(0, 3).map((i) => i.title).join('; ') || 'N/A';
    const nextItems = actionPlan.next?.slice(0, 3).map((i) => i.title).join('; ') || 'N/A';
    const laterItems = actionPlan.later?.slice(0, 3).map((i) => i.title).join('; ') || 'N/A';
    sections.push(`\n## Action Plan Summary
- Summary: ${actionPlan.summary}
- Key Themes: ${themes}
- Now (${actionPlan.now?.length || 0} items): ${nowItems}
- Next (${actionPlan.next?.length || 0} items): ${nextItems}
- Later (${actionPlan.later?.length || 0} items): ${laterItems}`);
  }

  // 15. GAP Context (if available)
  if (gapContext) {
    sections.push(`\n## Company Context
- Maturity Stage: ${gapContext.maturityStage || 'N/A'}
- Industry: ${gapContext.industryContext || 'N/A'}`);
  }

  return sections.join('\n');
}

/**
 * Generate narrative using LLM
 */
async function generateNarrativeWithLLM(
  context: string,
  metadata: {
    companyName: string;
    websiteUrl: string;
    overallScore: number;
    benchmarkLabel: WebsiteNarrativeBenchmark;
  }
): Promise<{ executiveSummary: string; sections: WebsiteNarrativeSection[] }> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(context, metadata);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from LLM');
    }

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    return {
      executiveSummary: parsed.executiveSummary,
      sections: parsed.sections,
    };
  } catch (error) {
    console.error('Error generating narrative:', error);
    // Fallback to basic narrative
    return generateFallbackNarrative(context, metadata);
  }
}

/**
 * Build system prompt for LLM
 */
function buildSystemPrompt(): string {
  return `You are a senior website UX, CRO (Conversion Rate Optimization), and messaging strategist with 15+ years of experience. You write consultant-grade reports for smart, busy executives.

Your task is to synthesize website diagnostic data into a long-form, narrative report that is:

**Tone & Style:**
- Professional but accessible
- Interpretive and explanatory (not just restating data)
- Concrete and specific (quote headlines, mention CTA labels)
- Persuasive about business impact
- Avoids generic fluff ("In today's digital world...")

**Structure:**
You will generate:
1. An executive summary (400-800 words)
2. Multiple detailed sections (250-600 words each)

**Executive Summary Should Include:**
- Overall score & benchmark interpretation
- 3-5 core findings (what's really happening)
- 3-5 top opportunities (what should change)
- Impact narrative: "What happens if we fix this?"

**Each Section Should:**
- Use natural prose (not bullet lists)
- Reference specific evidence from the data
- Connect issues to business outcomes
- Interpret scores, don't just restate them
- Reference personas and their experiences
- Avoid chart/metric dumps unless truly explanatory

**Section IDs to use:**
- diagnostic_overview
- hero_value_prop
- navigation_structure
- conversion_flow
- trust_social_proof
- content_clarity
- visual_brand
- persona_journeys
- scent_trail
- priority_themes

**Output Format:**
Return ONLY valid JSON with this structure:
{
  "executiveSummary": "...markdown text...",
  "sections": [
    {
      "id": "diagnostic_overview",
      "title": "Diagnostic Overview",
      "order": 10,
      "summaryBulletPoints": ["point 1", "point 2", "point 3"],
      "bodyMarkdown": "...multi-paragraph markdown..."
    },
    ...
  ]
}

Do NOT include markdown code fences, just raw JSON.`;
}

/**
 * Build user prompt with context
 */
function buildUserPrompt(
  context: string,
  metadata: {
    companyName: string;
    websiteUrl: string;
    overallScore: number;
    benchmarkLabel: string;
  }
): string {
  return `Generate a comprehensive website diagnostic narrative report for:

**Company:** ${metadata.companyName}
**Website:** ${metadata.websiteUrl}
**Overall Score:** ${metadata.overallScore}/100 (${metadata.benchmarkLabel})

**Diagnostic Data:**

${context}

---

Generate the executive summary and all relevant sections based on the available data. Focus on the most impactful findings and opportunities. Use the persona journey data to tell the story of real user experiences.

Remember:
- Write like you're explaining to a CEO or CMO
- Be specific and concrete
- Connect findings to revenue/growth impact
- Avoid generic advice
- Use natural language, not bullet lists

Return only the JSON structure as specified.`;
}

/**
 * Generate fallback narrative if LLM fails
 */
function generateFallbackNarrative(
  context: string,
  metadata: {
    companyName: string;
    websiteUrl: string;
    overallScore: number;
    benchmarkLabel: string;
  }
): { executiveSummary: string; sections: WebsiteNarrativeSection[] } {
  const executiveSummary = `# Executive Summary

${metadata.companyName}'s website (${metadata.websiteUrl}) scored ${metadata.overallScore}/100, placing it in the **${metadata.benchmarkLabel}** benchmark tier.

This diagnostic report identifies critical opportunities to improve user experience, conversion rates, and overall website effectiveness. The analysis reveals several high-impact areas requiring attention, including value proposition clarity, conversion flow optimization, and trust signal enhancement.

**Key Findings:**
The website shows room for improvement across multiple dimensions of user experience and conversion optimization.

**Recommended Next Steps:**
Review the detailed findings in each section below and prioritize improvements based on business impact and implementation effort.`;

  const sections: WebsiteNarrativeSection[] = [
    {
      id: NARRATIVE_SECTION_IDS.DIAGNOSTIC_OVERVIEW,
      title: 'Diagnostic Overview',
      order: NARRATIVE_SECTION_ORDER[NARRATIVE_SECTION_IDS.DIAGNOSTIC_OVERVIEW],
      bodyMarkdown: `This report presents a comprehensive analysis of ${metadata.companyName}'s website, examining user experience, conversion optimization, and messaging effectiveness.

The diagnostic methodology combines automated heuristic evaluation, persona-based journey testing, and expert strategic review across multiple dimensions of website performance.`,
    },
  ];

  return {
    executiveSummary,
    sections,
  };
}
