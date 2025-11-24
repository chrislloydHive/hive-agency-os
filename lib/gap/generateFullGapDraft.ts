// lib/gap/generateFullGapDraft.ts
// Light LLM call to create structured Full GAP draft from GAP-IA

import OpenAI from 'openai';
import { env } from '@/lib/env';
import type { GapIaRun } from '@/lib/gap/types';

// ============================================================================
// Full GAP Draft Generator (Light Pass)
// ============================================================================

export async function generateFullGapDraft(gapIa: GapIaRun): Promise<string> {
  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are generating a structured DRAFT of a marketing Growth Acceleration Plan (GAP).

CRITICAL RULES:
- This is NOT the final narrative
- Use the provided GAP-IA as the source of truth
- Produce an OUTLINE with SHORT paragraphs and placeholders
- DO NOT try to write polished, final copy
- Keep it concise and structured
- Use third-person language ("the site", "the brand", NOT "your site")

🚨 CRITICAL: SCORES ARE READ-ONLY 🚨
- The GAP-IA contains canonical scores that MUST NOT be changed
- DO NOT invent new scores or re-score the company
- Your job is to INTERPRET the provided scores, not create new ones
- Simply reference the scores in your narrative (e.g., "With a Brand score of 45...")

Your job is to create the STRUCTURE and rough content that will be refined in the next pass.`;

  const userPrompt = `Generate a DRAFT Full GAP report from this GAP-IA data:

${JSON.stringify({
  summary: gapIa.summary,
  dimensions: gapIa.dimensions,
  quickWins: gapIa.quickWins,
  breakdown: gapIa.breakdown,
  core: gapIa.core,
}, null, 2)}

Create a markdown document with the following structure:

# Executive Summary

[2-3 SHORT paragraphs summarizing:
- Overall score and what it means
- Key strengths
- Critical gaps
- Strategic direction for next 90 days]

# Scorecard

[Create a markdown table showing:
- Overall Score
- Brand Score
- Content Score
- SEO Score
- Website Score
- What each score means in 1 sentence]

# Brand & Positioning Summary

[PLACEHOLDER: Will be expanded in refinement pass]

Key findings:
- [List 2-3 key issues from GAP-IA]

# Content & Messaging Summary

[PLACEHOLDER: Will be expanded in refinement pass]

Key findings:
- [List 2-3 key issues from GAP-IA]

# SEO & Visibility Summary

[PLACEHOLDER: Will be expanded in refinement pass]

Key findings:
- [List 2-3 key issues from GAP-IA]

# Website & Conversion Summary

[PLACEHOLDER: Will be expanded in refinement pass]

Key findings:
- [List 2-3 key issues from GAP-IA]

# Quick Wins

[List 6-8 quick wins from GAP-IA with:
- Title
- Category
- Impact level
- Effort level
- Brief description (1-2 sentences)]

# Strategic Initiatives

[Create 5-7 strategic initiatives by grouping related issues:
- Title
- Dimension
- Timeframe
- Expected impact
- Brief description (2-3 sentences)]

# 90-Day Roadmap

## 0-30 Days
- Focus: [One sentence]
- Key actions: [3-4 bullets]

## 30-60 Days
- Focus: [One sentence]
- Key actions: [3-4 bullets]

## 60-90 Days
- Focus: [One sentence]
- Key actions: [3-4 bullets]

# KPIs to Watch

[List 5-6 KPIs with:
- Name
- What it measures
- Why it matters
- What good looks like]

Generate this DRAFT now. Keep it concise and structured.`;

  console.log('[Full GAP Draft] Calling OpenAI for draft generation...');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.5,
    max_tokens: 3000,
  });

  const draft = completion.choices[0]?.message?.content;

  if (!draft) {
    throw new Error('Empty response from OpenAI when generating Full GAP draft');
  }

  console.log('[Full GAP Draft] Successfully generated draft');

  return draft;
}
