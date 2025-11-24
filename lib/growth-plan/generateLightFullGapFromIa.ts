// lib/growth-plan/generateLightFullGapFromIa.ts
// Light Full GAP - generates strategic layers from existing GAP-IA data in a single LLM call

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { GapIaRun } from '@/lib/gap/types';
import {
  GAP_SHARED_SYSTEM_PROMPT,
  GAP_SHARED_REASONING_PROMPT,
} from '@/lib/gap/prompts/sharedPrompts';
import { FULL_GAP_OUTPUT_PROMPT_V4 } from '@/lib/gap/prompts/fullGapOutputPromptV4';
import { FullGapOutputSchema, type FullGapOutput } from '@/lib/gap/outputTemplates';
import { mapFullGapToApiResponse } from '@/lib/gap/outputMappers';

// ============================================================================
// Types
// ============================================================================

export interface LightFullGap {
  executiveSummaryNarrative: string;
  strategicInitiatives: Array<{
    title: string;
    description: string;
    timeframe: 'short' | 'medium' | 'long';
    dimension: 'brand' | 'content' | 'seo' | 'website' | 'digitalFootprint' | 'authority' | 'overall';
    expectedImpact: 'low' | 'medium' | 'high';
  }>;
  ninetyDayPlan: Array<{
    phase: '0-30 days' | '30-60 days' | '60-90 days';
    focus: string;
    actions: string[];
    businessRationale: string;
  }>;
  kpisToWatch: Array<{
    name: string;
    description: string;
    whyItMatters: string;
    whatGoodLooksLike: string;
  }>;
}

// ============================================================================
// Main Generator
// ============================================================================

export async function generateLightFullGapFromIa(
  gapIa: GapIaRun,
  domain: string,
  url: string
): Promise<LightFullGap> {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  console.log('[Light Full GAP/V4] Calling OpenAI to generate strategic layers...');

  // Build comprehensive IA briefing for V4 mapping contract
  const iaBriefing = `
INITIAL ASSESSMENT (COMPLETE BRIEFING)
════════════════════════════════════════

Executive Summary: ${gapIa.summary?.narrative || 'Not provided'}
Overall Score: ${gapIa.summary?.overallScore || 0}/100
Maturity Stage: ${gapIa.summary?.maturityStage || 'Not provided'}

TOP OPPORTUNITIES (3):
${(gapIa.summary?.topOpportunities || []).map((opp, i) => `${i + 1}. ${opp}`).join('\n')}

QUICK WINS (3):
${(gapIa.quickWins?.bullets || []).slice(0, 3).map((qw, i) => {
  if (typeof qw === 'string') {
    return `${i + 1}. ${qw}`;
  }
  return `${i + 1}. ${qw.action || 'Quick win'} [${qw.category || 'unknown'}, impact: ${qw.expectedImpact || 'medium'}]`;
}).join('\n')}

DIMENSION SUMMARIES (6):
${Object.entries(gapIa.dimensions || {}).map(([key, dim]: [string, any]) => `
- ${key}: ${dim.score}/100
  Summary: ${dim.summary || dim.oneLiner || 'Not provided'}
  Key Issue: ${dim.keyIssue || dim.issues?.[0] || 'Not specified'}
`).join('')}

BUSINESS CONTEXT:
- Business Type: ${gapIa.core?.companyType || gapIa.businessContext?.businessType || 'unknown'}
- Brand Tier: ${gapIa.core?.brandTier || gapIa.businessContext?.brandTier || 'other'}
- Business Name: ${gapIa.core?.businessName || gapIa.businessContext?.businessName || domain}
- Domain: ${domain}
- URL: ${url}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: GAP_SHARED_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${GAP_SHARED_REASONING_PROMPT}

**Analysis Mode:** FULL_GAP (Full Growth Acceleration Plan - V4)

${iaBriefing}`,
      },
      { role: 'user', content: FULL_GAP_OUTPUT_PROMPT_V4 },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 6000, // Increased for detailed consultant-grade output
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from OpenAI when generating Light Full GAP');
  }

  console.log('[Light Full GAP/V4] ✅ Received Full GAP response:', {
    length: content.length,
  });

  try {
    const parsed = JSON.parse(content);

    console.log('[Light Full GAP/V4] Validating Full GAP structure...');

    // Validate using V4 schema (same structure as V3, but with V4 prompt expectations)
    const validatedV4 = FullGapOutputSchema.parse(parsed);

    console.log('[Light Full GAP/V4] ✅ Schema validation successful:', {
      overallScore: validatedV4.overallScore,
      maturityStage: validatedV4.maturityStage,
      quickWinCount: validatedV4.quickWins.length,
      strategicPriorityCount: validatedV4.strategicPriorities.length,
    });

    // Map V4 output to LightFullGap format for backward compatibility
    const lightFullGap: LightFullGap = {
      executiveSummaryNarrative: validatedV4.executiveSummary,
      strategicInitiatives: validatedV4.strategicPriorities.map(priority => ({
        title: priority.title,
        description: priority.description,
        timeframe: priority.timeframe || 'medium',
        dimension: priority.relatedDimensions?.[0] || 'overall',
        expectedImpact: 'medium', // Use medium as default
      })),
      ninetyDayPlan: [
        {
          phase: '0-30 days' as const,
          focus: validatedV4.roadmap90Days.phase0_30.whyItMatters.split('.')[0] || '0-30 days focus',
          actions: validatedV4.roadmap90Days.phase0_30.actions,
          businessRationale: validatedV4.roadmap90Days.phase0_30.whyItMatters,
        },
        {
          phase: '30-60 days' as const,
          focus: validatedV4.roadmap90Days.phase30_60.whyItMatters.split('.')[0] || '30-60 days focus',
          actions: validatedV4.roadmap90Days.phase30_60.actions,
          businessRationale: validatedV4.roadmap90Days.phase30_60.whyItMatters,
        },
        {
          phase: '60-90 days' as const,
          focus: validatedV4.roadmap90Days.phase60_90.whyItMatters.split('.')[0] || '60-90 days focus',
          actions: validatedV4.roadmap90Days.phase60_90.actions,
          businessRationale: validatedV4.roadmap90Days.phase60_90.whyItMatters,
        },
      ],
      kpisToWatch: validatedV4.kpis.map(kpi => ({
        name: kpi.name,
        description: kpi.whatItMeasures,
        whyItMatters: kpi.whyItMatters,
        whatGoodLooksLike: kpi.whatGoodLooksLike,
      })),
    };

    console.log('[Light Full GAP/V4] ✅ Mapped to LightFullGap format');

    return lightFullGap;
  } catch (error) {
    console.error('[Light Full GAP/V4] Validation or mapping failed:', error);

    // Log validation errors for debugging
    if (error instanceof Error) {
      if ('issues' in error && Array.isArray((error as any).issues)) {
        console.error('[Light Full GAP/V3] Validation issues:', JSON.stringify((error as any).issues.slice(0, 5), null, 2));
      }
    }

    throw new Error(`Light Full GAP V3 validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
