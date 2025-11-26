// lib/growth-plan/generateMarkdownReport.ts
// Generates long-form markdown narrative reports from Full GAP JSON output
//
// TODO: Migrate to aiForCompany() once companyId is available in the GAP flow.
// Currently the GAP engine works with URLs, not company IDs.
// See docs/ai-gateway.md for guidance on using the AI Gateway.

import { getOpenAI } from '@/lib/openai';
import type { GrowthAccelerationPlan } from './types';

/**
 * Generates a comprehensive markdown narrative report from Full GAP JSON output.
 * This is a SECOND LLM step that converts structured JSON into beginner-friendly markdown.
 *
 * @param fullGapJson - The complete Full GAP JSON output
 * @param gapIaData - Optional GAP-IA data for additional context
 * @returns Markdown string with 13 required sections
 */
export async function generateMarkdownReport(
  fullGapJson: GrowthAccelerationPlan,
  gapIaData?: any
): Promise<string> {
  console.log('[generateMarkdownReport] Starting markdown generation...');

  const systemPrompt = `You are a world-class marketing strategist and business consultant converting structured JSON assessment data into a comprehensive, beginner-friendly narrative report.

Your job is to take the Full Growth Acceleration Plan (Full GAP) JSON output and transform it into a long-form markdown document that:
- Reads like a professional consulting report written by a patient, experienced marketer
- Uses plain English with inline definitions for any jargon
- Explains WHY everything matters in business terms (traffic, conversions, trust, revenue)
- Provides specific, actionable guidance with examples
- Maintains an encouraging, coaching tone that empowers the reader
- Never contradicts the data in the JSON
- Expands on the JSON with additional strategic context and narrative flow

The output should be suitable for business owners, founders, and marketing teams who want to understand their marketing maturity and take action.`;

  const userPrompt = `Convert the following Full Growth Acceleration Plan JSON into a comprehensive markdown narrative report.

FULL GAP JSON:
\`\`\`json
${JSON.stringify(fullGapJson, null, 2)}
\`\`\`

${gapIaData ? `GAP-IA CONTEXT (for reference):\n\`\`\`json\n${JSON.stringify(gapIaData, null, 2)}\n\`\`\`\n` : ''}

Generate a markdown document with the following 13 sections:

---

# 1. EXECUTIVE SUMMARY

Write 5-7 paragraphs (3-5 sentences each) that provide a comprehensive overview of the assessment findings. Structure:

1. **What This Score Means** - Explain the overall score in business terms. What does this number say about the company's marketing maturity? What stage are they at?

2. **Key Strengths** - Highlight 2-3 specific things that are working well today. Be concrete with examples from the JSON data.

3. **Key Issues** - Identify 2-3 critical gaps or challenges. Explain why each matters for traffic, conversions, or trust.

4. **Strategic Context** - Provide market positioning insights. Where does this company stand relative to competitors? What opportunities exist?

5. **Priority Focus Areas** - Recommend 2-3 areas to tackle first and explain why these are the highest-leverage starting points.

6. **Expected Outcomes** - Paint a picture of what success looks like in 30, 60, and 90 days if recommendations are followed.

7. **Next Steps** - Briefly outline the immediate path forward.

Use the \`summary.narrative\` field from the JSON as your foundation, but expand it with strategic context and business insights.

---

# 2. WHAT THIS SCORE MEANS

Create a standalone section (2-3 paragraphs) that explains the overall score in plain English:

- What does this number indicate about marketing maturity?
- How should a business owner interpret this score?
- What's the business impact of being at this level?
- What would moving up 10-20 points mean in practical terms?

Use the \`summary.scorecardExplanation.howToRead\` field as a foundation.

---

# 3. SCORECARD AT A GLANCE

Present the scores in a markdown table with explanations:

| Dimension | Score | What This Means |
|-----------|-------|-----------------|
| **Brand & Positioning** | [score] | [1-2 sentence explanation of what this score means for the business] |
| **Content & Messaging** | [score] | [1-2 sentence explanation] |
| **SEO & Visibility** | [score] | [1-2 sentence explanation] |
| **Website & Conversion** | [score] | [1-2 sentence explanation] |
| **OVERALL** | [score] | [1-2 sentence summary] |

**Score Bands:**
- **0-39: Needs Work** - Major gaps exist. Priority focus required.
- **40-59: Developing** - Basics exist but inconsistent. Needs strengthening.
- **60-79: Solid** - Working well but room to grow. Refinement opportunity.
- **80-100: Strong** - Relative strength you can build on. Leverage this.

Use the \`summary.scores\` and \`summary.scorecardExplanation.dimensionMeanings\` fields.

---

# 4. BRAND & POSITIONING

Write 3-5 paragraphs analyzing the Brand & Positioning dimension:

1. **Current State** - What we're seeing now with specific observations from the site
2. **Why This Matters** - Business impact on trust, clarity, and positioning
3. **What Better Looks Like** - Concrete examples of improvement
4. **Key Findings** - Bullet list of 3-5 specific observations (strengths and gaps)
5. **Recommended Focus** - What to prioritize and why

Use the \`dimensions.brand\` object from the JSON, especially the \`summary\` and \`findings\` fields.

---

# 5. CONTENT & MESSAGING

Write 3-5 paragraphs analyzing the Content & Messaging dimension:

1. **Current State** - What content exists, how it's structured, what's missing
2. **Why This Matters** - Impact on traffic, engagement, and conversions
3. **What Better Looks Like** - Examples of effective content strategy
4. **Key Findings** - Bullet list of 3-5 specific observations
5. **Recommended Focus** - Content priorities and quick wins

Use the \`dimensions.content\` object from the JSON.

---

# 6. SEO & VISIBILITY

Write 3-5 paragraphs analyzing the SEO & Visibility dimension:

1. **Current State** - Technical SEO, on-page optimization, backlink profile
2. **Why This Matters** - Impact on organic traffic and discoverability
3. **What Better Looks Like** - SEO best practices and benchmarks
4. **Key Findings** - Bullet list of 3-5 specific observations
5. **Recommended Focus** - SEO priorities (technical, content, authority)

Use the \`dimensions.seo\` object from the JSON.

---

# 7. WEBSITE & CONVERSION

Write 3-5 paragraphs analyzing the Website & Conversion dimension:

1. **Current State** - UX, performance, conversion optimization
2. **Why This Matters** - Impact on visitor experience and conversion rates
3. **What Better Looks Like** - Examples of high-converting site experiences
4. **Key Findings** - Bullet list of 3-5 specific observations
5. **Recommended Focus** - Conversion optimization priorities

Use the \`dimensions.website\` object from the JSON.

---

# 8. VISITOR JOURNEY & FUNNEL

Write 2-3 paragraphs analyzing how visitors move through the site:

1. **Entry Points** - How people find and arrive at the site
2. **On-Site Experience** - Navigation, clarity, conversion paths
3. **Drop-Off Points** - Where visitors get confused or leave
4. **Optimization Opportunities** - How to improve the funnel

Use the \`visitorJourney\` object from the JSON if available, or synthesize from dimension data.

---

# 9. IDEAL CUSTOMER PROFILES & CATEGORY CONTEXT

Write 2-3 paragraphs covering:

1. **Target Audience** - Who this company serves (or should serve)
2. **Category Dynamics** - Market context, competitive landscape
3. **Positioning Opportunities** - How to stand out and win

Use the \`idealCustomerProfiles\` and \`categoryContext\` fields from the JSON if available.

---

# 10. QUICK WINS (30-60 DAYS)

Create an engaging introduction paragraph explaining what Quick Wins are and why they matter.

Then present each Quick Win as:

### [Action Title]

**Why This Matters:** [2-3 sentences explaining business impact and how it ties to dimension scores]

**What To Do:** [Specific, actionable steps]

**Expected Impact:** [Concrete outcomes]

**Ties To:** [Dimension name] (Score: [X])

Use the \`quickWins\` array from the JSON, with the \`introSentence\` field as the section introduction.

---

# 11. STRATEGIC INITIATIVES (90+ DAYS)

Create an engaging introduction paragraph explaining what Strategic Initiatives are and why they matter for long-term growth.

Then present each Strategic Initiative as:

### [Initiative Title]

**Why This Matters:** [2-3 sentences explaining strategic value and dimension ties]

**What To Do:** [Specific, actionable steps]

**Expected Impact:** [Long-term outcomes]

**Ties To:** [Dimension name] (Score: [X])

Use the \`strategicInitiatives\` array from the JSON, with the \`introSentence\` field as the section introduction.

---

# 12. RECOMMENDED ROADMAP

Create a timeline view of the recommended actions:

## Now (30 Days)
- [Quick Win 1]
- [Quick Win 2]
- [Quick Win 3]

## Next (60 Days)
- [Remaining Quick Wins]
- [Begin Strategic Initiative 1]

## Later (90+ Days)
- [Strategic Initiative 2]
- [Strategic Initiative 3]
- [Strategic Initiative 4]

Write 1-2 paragraphs explaining the sequencing logic and dependencies.

---

# 13. KPIS TO WATCH

Write 1-2 paragraphs introducing why measurement matters and what success looks like.

Then create a table of KPIs to track:

| KPI | Current Baseline | 30-Day Target | 90-Day Target | Why It Matters |
|-----|------------------|---------------|---------------|----------------|
| [Metric] | [Value] | [Value] | [Value] | [Impact explanation] |

Include 5-8 KPIs covering:
- Traffic metrics (organic, direct, referral)
- Engagement metrics (time on site, pages per session)
- Conversion metrics (form fills, demo requests, purchases)
- Brand metrics (branded search volume, direct traffic growth)

Use the \`kpisToWatch\` field from the JSON if available, or synthesize from recommendations.

---

FORMATTING GUIDELINES:
- Use markdown headers (##, ###, ####) for clear hierarchy
- Use **bold** for emphasis on key terms
- Use bullet points and numbered lists for readability
- Use tables where appropriate for structured data
- Keep paragraphs to 3-5 sentences max
- Use plain English and define any jargon inline
- Maintain an encouraging, coaching tone throughout
- Be specific and concrete with examples from the data

Generate the complete markdown report now.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 16000,
    });

    const markdown = completion.choices[0]?.message?.content;

    if (!markdown) {
      console.error('[generateMarkdownReport] No content returned from OpenAI');
      return generateFallbackMarkdown(fullGapJson);
    }

    console.log('[generateMarkdownReport] Successfully generated markdown report');
    return markdown;

  } catch (error) {
    console.error('[generateMarkdownReport] Error generating markdown:', error);
    return generateFallbackMarkdown(fullGapJson);
  }
}

/**
 * Generates a basic fallback markdown report if LLM generation fails.
 */
function generateFallbackMarkdown(fullGapJson: GrowthAccelerationPlan): string {
  const { executiveSummary, scorecard, quickWins, strategicInitiatives } = fullGapJson;

  return `# Growth Acceleration Plan

## Executive Summary

${executiveSummary?.narrative || 'Assessment completed. Detailed analysis below.'}

## Scorecard

| Dimension | Score |
|-----------|-------|
| Brand & Positioning | ${scorecard?.brand || 'N/A'} |
| Content & Messaging | ${scorecard?.content || 'N/A'} |
| SEO & Visibility | ${scorecard?.seo || 'N/A'} |
| Website & Conversion | ${scorecard?.website || 'N/A'} |
| **Overall** | **${scorecard?.overall || 'N/A'}** |

## Brand & Positioning

${fullGapJson.sectionAnalyses?.brand?.summary || fullGapJson.sectionAnalysesLegacy?.brandAndPositioning?.summary || 'Analysis pending.'}

## Content & Messaging

${fullGapJson.sectionAnalyses?.content?.summary || fullGapJson.sectionAnalysesLegacy?.contentAndMessaging?.summary || 'Analysis pending.'}

## SEO & Visibility

${fullGapJson.sectionAnalyses?.seo?.summary || fullGapJson.sectionAnalysesLegacy?.seoAndVisibility?.summary || 'Analysis pending.'}

## Website & Conversion

${fullGapJson.sectionAnalyses?.website?.summary || fullGapJson.sectionAnalysesLegacy?.websiteAndConversion?.summary || 'Analysis pending.'}

## Quick Wins

${quickWins?.map((qw, i) => `### ${i + 1}. ${qw.title}\n\n${qw.expectedOutcome}\n`).join('\n') || 'Quick wins being analyzed.'}

## Strategic Initiatives

${strategicInitiatives?.map((si, i) => `### ${i + 1}. ${si.title}\n\n${si.expectedOutcome}\n`).join('\n') || 'Strategic initiatives being analyzed.'}

---

*Note: This is a fallback report generated due to an error in the full markdown generation process.*
`;
}
