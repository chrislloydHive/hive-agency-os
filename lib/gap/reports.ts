// lib/gap/reports.ts
// Consultant Report Generation - Convert JSON to Markdown Reports

import { openai } from '@/lib/openai';
import type { GapIaRun } from './types';
import type { GrowthAccelerationPlan } from '@/lib/growth-plan/growthActionPlanSchema';

const REPORT_VERSION = 'v1';

/**
 * Generate IA Consultant Report from GAP-IA JSON
 *
 * Produces a 2-4 page consultant-style markdown report
 * that can be shared with stakeholders.
 */
export async function generateIaConsultantReport(iaResult: GapIaRun): Promise<string> {
  console.log('[generateIaConsultantReport] Starting report generation for:', iaResult.domain);

  const prompt = buildIaReportPrompt(iaResult);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT_IA,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const markdown = completion.choices[0]?.message?.content?.trim() || '';

    if (!markdown) {
      throw new Error('No markdown content generated');
    }

    console.log('[generateIaConsultantReport] ✅ Report generated,', markdown.length, 'characters');
    return markdown;
  } catch (error) {
    console.error('[generateIaConsultantReport] Error:', error);
    throw new Error(`Failed to generate IA consultant report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate Full GAP Consultant Report from Growth Acceleration Plan JSON
 *
 * Produces an 8-20 page comprehensive consultant-style markdown report
 * suitable for executive stakeholders.
 */
export async function generateFullGapConsultantReport(plan: GrowthAccelerationPlan): Promise<string> {
  console.log('[generateFullGapConsultantReport] Starting report generation for:', plan.companyName);

  const prompt = buildFullGapReportPrompt(plan);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT_FULL_GAP,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 12000,
    });

    const markdown = completion.choices[0]?.message?.content?.trim() || '';

    if (!markdown) {
      throw new Error('No markdown content generated');
    }

    console.log('[generateFullGapConsultantReport] ✅ Report generated,', markdown.length, 'characters');
    return markdown;
  } catch (error) {
    console.error('[generateFullGapConsultantReport] Error:', error);
    throw new Error(`Failed to generate Full GAP consultant report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get current report version
 */
export function getReportVersion(): string {
  return REPORT_VERSION;
}

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPT_IA = `You are a senior marketing strategist writing a professional Initial Assessment report.

Your task is to convert a structured GAP Initial Assessment JSON into a consultant-style written report in Markdown format.

CRITICAL REQUIREMENTS:
- Derive all content from the provided JSON data - do NOT invent unrelated themes or recommendations
- Use a formal, analytical consultant tone - not marketing fluff
- Structure the report with clear headers and bullets as specified
- Keep the report focused and concise (2-4 pages equivalent when rendered)
- Use proper Markdown syntax (headers, bullets, emphasis)
- Do not use tables - stick to paragraphs and bullet lists
- All scores must match the JSON exactly
- All recommendations must be derived from the JSON data

OUTPUT STRUCTURE (strict):
1. H1 header with company name
2. Executive Summary section
3. Strengths section
4. Key Issues section
5. Strategic Priorities section
6. Quick Wins (Next 30 Days) section
7. Section Analyses (4 subsections for Brand, Content, SEO, Website)
8. Expected Outcomes section

Maintain professional consultant voice throughout.`;

const SYSTEM_PROMPT_FULL_GAP = `You are a senior marketing strategist writing a comprehensive Growth Acceleration Plan report.

Your task is to convert a structured Growth Acceleration Plan JSON into a detailed consultant-style written report in Markdown format.

CRITICAL REQUIREMENTS:
- Derive all content from the provided JSON data - do NOT invent unrelated recommendations
- Use a formal, analytical consultant tone appropriate for executive stakeholders
- Structure must follow the specified outline with all sections
- Report should be comprehensive (8-20 pages equivalent when rendered)
- Use proper Markdown syntax (headers, bullets, emphasis, NOT tables)
- All scores and data must match the JSON exactly
- All initiatives and actions must be derived from the JSON
- Present roadmap as narrative text, not tables

OUTPUT STRUCTURE (strict):
1. H1 header with company name
2. Executive Summary (with scorecard, maturity stage, narrative)
3. Strengths
4. Key Issues
5. Strategic Priorities
6. Quick Wins (Next 30 Days)
7. Strategic Initiatives (90 Days+)
8. Focus Areas
9. Roadmap & Expected Outcomes
10. Section Analyses (detailed breakdowns)
11. Strategic Outcomes

Maintain professional, matter-of-fact consultant voice throughout.`;

// ============================================================================
// Prompt Builders
// ============================================================================

function buildIaReportPrompt(iaResult: GapIaRun): string {
  const companyName = iaResult.core.businessName || iaResult.domain;
  const scores = {
    overall: iaResult.core.overallScore || iaResult.summary?.overallScore || 0,
    brand: iaResult.core.brand.brandScore || iaResult.dimensions?.brand.score || 0,
    content: iaResult.core.content.contentScore || iaResult.dimensions?.content.score || 0,
    seo: iaResult.core.seo.seoScore || iaResult.dimensions?.seo.score || 0,
    website: iaResult.core.website.websiteScore || iaResult.dimensions?.website.score || 0,
  };

  const maturityStage = iaResult.summary?.maturityStage || iaResult.core.marketingMaturity || 'developing';

  // Extract insights
  const strengths = iaResult.core.topOpportunities.slice(0, 5) || [];
  const brandInsights = iaResult.insights?.brandInsights || [];
  const contentInsights = iaResult.insights?.contentInsights || [];
  const seoInsights = iaResult.insights?.seoInsights || [];
  const websiteInsights = iaResult.insights?.websiteInsights || [];

  // Extract quick wins
  const quickWins = iaResult.quickWins?.bullets || [];

  return `# GAP Initial Assessment Data

Convert this data into a professional consultant report with the exact structure specified in your system prompt.

## Company Information
- Company Name: ${companyName}
- Website: ${iaResult.url}
- Domain: ${iaResult.domain}

## Scorecard
- Overall Score: ${scores.overall}/100
- Brand: ${scores.brand}/100
- Content: ${scores.content}/100
- SEO: ${scores.seo}/100
- Website & Conversion: ${scores.website}/100

## Maturity Stage
${maturityStage}

## Executive Overview
${iaResult.summary?.narrative || iaResult.insights.overallSummary || iaResult.core.quickSummary}

## Top Opportunities (Use as Strengths/Issues)
${strengths.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

## Quick Wins Available
${quickWins.map((qw: any) => `- [${qw.category}] ${qw.action} (Impact: ${qw.expectedImpact}, Effort: ${qw.effortLevel})`).join('\n')}

## Dimension Insights

### Brand Insights
${brandInsights.map((i: string) => `- ${i}`).join('\n')}

### Content Insights
${contentInsights.map((i: string) => `- ${i}`).join('\n')}

### SEO Insights
${seoInsights.map((i: string) => `- ${i}`).join('\n')}

### Website & Conversion Insights
${websiteInsights.map((i: string) => `- ${i}`).join('\n')}

## Instructions
Using this data:
1. Write "# GAP Initial Assessment – ${companyName}" as the title
2. Create Executive Summary with the scorecard (formatted as bullets) and a 2-3 sentence narrative
3. Extract 3-5 Strengths from the opportunities and insights
4. Identify 3-5 Key Issues from the insights (problems to address)
5. Define 3-5 Strategic Priorities (what they should focus on)
6. List 3-6 Quick Wins for the next 30 days from the quick wins data
7. Write Section Analyses for each dimension (Brand, Content, SEO, Website) - each with a narrative paragraph, key findings bullets, and quick wins bullets
8. Write Expected Outcomes (1-2 paragraphs on what improves if they execute)

Keep the tone professional and consultant-like. Use ONLY the data provided - do not invent new recommendations.`;
}

function buildFullGapReportPrompt(plan: GrowthAccelerationPlan): string {
  const companyName = plan.companyName;
  const scores = plan.scorecard || {
    overall: 0,
    brand: 0,
    content: 0,
    seo: 0,
    website: 0,
    authority: 0,
  };

  const maturityStage = plan.executiveSummaryV2?.maturityStage || plan.executiveSummary.maturityStage;
  const narrative = plan.executiveSummaryV2?.narrative || plan.executiveSummary.companyOverview;
  const strengths = plan.executiveSummaryV2?.keyStrengths || plan.executiveSummary.strengths || [];
  const issues = plan.executiveSummaryV2?.keyIssues || [];

  // Extract actions for quick wins and strategic initiatives
  const actions = plan.actions || [];
  const quickWins = actions.filter((a: any) => a.timeframe === 'immediate' || a.timeframe === 'shortTerm').slice(0, 6);
  const strategicInitiatives = actions.filter((a: any) => a.timeframe === 'mediumTerm' || a.timeframe === 'longTerm').slice(0, 6);

  // Extract section analyses
  const sectionAnalyses = plan.sectionAnalyses || {};

  // Extract strategic outcomes
  const strategicOutcomes = plan.strategicOutcomes || [];

  return `# Growth Acceleration Plan Data

Convert this data into a comprehensive professional consultant report with the exact structure specified in your system prompt.

## Company Information
- Company Name: ${companyName}
- Website: ${plan.websiteUrl}
- Generated: ${plan.generatedAt}

## Scorecard
- Overall Score: ${scores.overall}/100
- Brand: ${scores.brand}/100
- Content: ${scores.content}/100
- SEO: ${scores.seo}/100
- Website: ${scores.website}/100
- Authority: ${scores.authority}/100

## Maturity Stage
${maturityStage}

## Executive Summary Narrative
${narrative}

## Strengths
${strengths.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}

## Key Issues
${issues.map((issue: string, i: number) => `${i + 1}. ${issue}`).join('\n')}

## Strategic Theme
${plan.executiveSummaryV2?.strategicTheme || 'Focus on systematic growth across all marketing channels'}

## Quick Win Actions (Immediate/Short-term)
${quickWins.map((action: any) => `- [${action.channel || action.category}] ${action.title}: ${action.rationale} (Impact: ${action.impact}, Effort: ${action.effort}, Timeline: ${action.timeline})`).join('\n')}

## Strategic Initiative Actions (Medium/Long-term)
${strategicInitiatives.map((action: any) => `- [${action.channel || action.category}] ${action.title}: ${action.rationale} (Impact: ${action.impact}, Effort: ${action.effort}, Timeline: ${action.timeline})`).join('\n')}

## Section Analyses

### Brand
${sectionAnalyses.brand ? JSON.stringify(sectionAnalyses.brand, null, 2) : 'No brand analysis available'}

### Content
${sectionAnalyses.content ? JSON.stringify(sectionAnalyses.content, null, 2) : 'No content analysis available'}

### SEO
${sectionAnalyses.seo ? JSON.stringify(sectionAnalyses.seo, null, 2) : 'No SEO analysis available'}

### Website
${sectionAnalyses.website ? JSON.stringify(sectionAnalyses.website, null, 2) : 'No website analysis available'}

## Strategic Outcomes
${strategicOutcomes.map((outcome: any) => `### ${outcome.label}\n${outcome.description}\nLinked to: ${outcome.linkedScores?.join(', ') || 'Overall performance'}`).join('\n\n')}

## Roadmap Phases
- Immediate (1-2 weeks): ${quickWins.filter((a: any) => a.timeframe === 'immediate').length} actions
- Short-term (2-6 weeks): ${quickWins.filter((a: any) => a.timeframe === 'shortTerm').length} actions
- Medium-term (6-12 weeks): ${strategicInitiatives.filter((a: any) => a.timeframe === 'mediumTerm').length} actions
- Long-term (12-24 weeks): ${strategicInitiatives.filter((a: any) => a.timeframe === 'longTerm').length} actions

## Instructions
Using this data, write a comprehensive Growth Acceleration Plan report following this structure:

# Growth Acceleration Plan – ${companyName}

## Executive Summary
- Present the scorecard as bullet list
- State maturity stage
- Write 3-6 paragraph narrative overview

## Strengths
4-6 bullet points from the strengths data

## Key Issues
4-6 bullet points describing problems to address

## Strategic Priorities
3-6 priorities (1-2 sentences each) derived from the strategic theme and issues

## Quick Wins (Next 30 Days)
List 3-6 high-impact, low-effort actions from the quick wins data

## Strategic Initiatives (90 Days+)
3-6 initiatives with:
- Title
- 2-4 sentence description
- Impact/Effort/Timeline (as text, not table)

## Focus Areas
2-4 focus areas (e.g., "Content Strategy & Authority", "Conversion Optimization") with priority level and description

## Roadmap & Expected Outcomes
Write a narrative covering:
- 30-day expectations
- 90-day milestones
- 6-month projections
- Expected score improvements

## Section Analyses
For each of Brand, Content, SEO, Website:
- 2-3 paragraph narrative
- Key findings bullets
- Recommended actions bullets

## Strategic Outcomes
3-4 outcome blocks describing what improves (e.g., "Stronger User Engagement", "Higher Trust & Authority")

Keep the tone analytical and matter-of-fact. Use ONLY the provided data.`;
}
