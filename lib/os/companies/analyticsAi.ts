// lib/os/companies/analyticsAi.ts
// AI engine for generating per-company analytics insights
//
// Phase 2: Now uses aiForCompany() for memory-aware AI interactions.
// Analytics insights are logged to Company AI Context with type = "Analytics Insight".

import { aiForCompany } from '@/lib/ai-gateway';
import type {
  CompanyAnalyticsInput,
  CompanyAnalyticsAiInsight,
  CompanyAnalyticsKeyInsight,
  CompanyAnalyticsWorkSuggestion,
  CompanyAnalyticsExperiment,
} from './analyticsTypes';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and senior marketing strategist focusing on a single client.
You are given JSON describing this client's analytics and context:

- GA4: sessions / users over a chosen date range
- Google Search Console: clicks, impressions, CTR, average position
- GAP and diagnostics: dates of last assessments and plans, latest score, summary
- Work summary: active items, due today, overdue

Your job is to produce a concise, actionable analysis of this client's current situation and what we should do next.

Focus on:
- What's working (traffic trends, search visibility, recent activity)
- What's underperforming or at risk (low CTR, overdue work, stale assessments)
- What actions we should take next (specific work items)
- 1–3 experiments we should run

Speak like you're advising an agency owner reviewing this one client.

RESPONSE FORMAT:
You must respond with valid JSON matching this exact structure:

{
  "summary": "1-2 paragraph executive summary of this client's current state and what we should focus on",
  "keyInsights": [
    {
      "type": "engagement" | "search" | "traffic" | "conversion" | "funnel" | "content" | "technical" | "general" | "other",
      "category": "engagement" | "search" | "traffic" | "conversion" | "general",
      "title": "Short insight title (max 10 words)",
      "detail": "Brief explanation with specific data points (2-3 sentences max)",
      "evidence": "The specific metric or data supporting this insight"
    }
  ],
  "quickWins": [
    "Specific action that can be done this week"
  ],
  "workSuggestions": [
    {
      "title": "Work item title (action-oriented, max 10 words)",
      "area": "website" | "content" | "seo" | "demand" | "ops" | "general" | "other",
      "description": "What needs to be done and why (2-3 sentences)",
      "priority": "high" | "medium" | "low",
      "reason": "Why this matters for the client (1-2 sentences)",
      "impact": "high" | "medium" | "low",
      "recommendedPriority": 1-5,
      "implementationGuide": "Detailed how-to guide for implementing this work item"
    }
  ],
  "experiments": [
    {
      "name": "Experiment name",
      "hypothesis": "What we're testing and expected outcome (2-3 sentences)",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "successMetric": "How to measure success",
      "expectedImpact": "high" | "medium" | "low"
    }
  ]
}

RULES:
1. keyInsights should have 2-5 items based on available data
2. quickWins should have 2-4 items
3. workSuggestions should have 2-5 items, prioritized by impact (recommendedPriority 1 = highest)
4. experiments should have 1-3 items
5. If data is missing (no GA4, no GSC), acknowledge it and focus on what we DO know
6. Be specific with numbers - reference actual metrics from the data
7. Prioritize overdue work and stale assessments as risks
8. Keep insights concise - detail should be 2-3 sentences max
9. category in keyInsights must be one of: "engagement", "search", "traffic", "conversion", "general"
10. For workSuggestions, always include reason and impact fields
11. For each workSuggestion, include an implementationGuide field with detailed "how to" instructions that a mid-level marketer could follow. Use short paragraphs and bullet points. Focus on concrete steps: what to change, where in GA4/Search Console/website, what to watch for, and how to validate the change worked.

Return ONLY valid JSON, no markdown formatting or code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate AI insights for a company's analytics
 *
 * @param companyId - The canonical company ID (Airtable record ID)
 * @param input - Analytics data and context for the company
 * @returns AI-generated insights
 */
export async function generateCompanyAnalyticsInsights(
  companyId: string,
  input: CompanyAnalyticsInput
): Promise<CompanyAnalyticsAiInsight> {
  console.log('[CompanyAnalyticsAI] Generating insights for:', input.companyName);

  try {
    // Build user prompt with the input data
    const taskPrompt = `Generate analytics insights for this client:

${JSON.stringify(input, null, 2)}

Remember to:
- Reference specific numbers from the data
- Prioritize overdue work and at-risk items
- Suggest concrete next steps
- Be actionable and specific to this client`;

    // Use aiForCompany() for memory-aware AI call
    // This will:
    // 1. Load prior memory for the company
    // 2. Inject memory into the prompt
    // 3. Call OpenAI
    // 4. Log the response to Company AI Context with type "Analytics Insight"
    const result = await aiForCompany(companyId, {
      type: 'Analytics Insight',
      tags: ['Analytics', 'Insights', 'Marketing'],
      systemPrompt: SYSTEM_PROMPT,
      taskPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      jsonMode: true,
      maxTokens: 4000,
      memoryOptions: {
        limit: 10,
        types: ['GAP IA', 'GAP Full', 'Analytics Insight', 'Strategy'],
      },
    });

    console.log('[CompanyAnalyticsAI] Response received, memory entry:', result.memoryEntryId);

    // Parse and validate the response
    const insights = parseAndValidateInsights(result.content, input);

    console.log('[CompanyAnalyticsAI] Insights generated:', {
      summaryLength: insights.summary.length,
      keyInsights: insights.keyInsights.length,
      quickWins: insights.quickWins.length,
      workSuggestions: insights.workSuggestions.length,
      experiments: insights.experiments.length,
      memoryEntriesLoaded: result.loadedMemoryCount,
    });

    return insights;
  } catch (error) {
    console.error('[CompanyAnalyticsAI] Error generating insights:', error);
    return generateFallbackInsights(input);
  }
}

// ============================================================================
// Parsing & Validation
// ============================================================================

/**
 * Parse and validate the AI response
 */
function parseAndValidateInsights(
  responseText: string,
  input: CompanyAnalyticsInput
): CompanyAnalyticsAiInsight {
  try {
    const parsed = JSON.parse(responseText);

    return {
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : 'Unable to generate summary.',
      keyInsights: Array.isArray(parsed.keyInsights)
        ? parsed.keyInsights.map(validateKeyInsight)
        : [],
      quickWins: Array.isArray(parsed.quickWins)
        ? parsed.quickWins.filter((w: unknown) => typeof w === 'string')
        : [],
      workSuggestions: Array.isArray(parsed.workSuggestions)
        ? parsed.workSuggestions.map(validateWorkSuggestion)
        : [],
      experiments: Array.isArray(parsed.experiments)
        ? parsed.experiments.map(validateExperiment)
        : [],
    };
  } catch (parseError) {
    console.error('[CompanyAnalyticsAI] Failed to parse response:', parseError);
    console.error('[CompanyAnalyticsAI] Response text:', responseText.substring(0, 500));

    // Try to salvage JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const salvaged = JSON.parse(jsonMatch[0]);
        return parseAndValidateInsights(JSON.stringify(salvaged), input);
      } catch {
        // Give up
      }
    }

    return generateFallbackInsights(input);
  }
}

/**
 * Validate a key insight
 */
function validateKeyInsight(item: any): CompanyAnalyticsKeyInsight {
  const validTypes = [
    'traffic',
    'search',
    'conversion',
    'funnel',
    'content',
    'technical',
    'engagement',
    'general',
    'other',
  ] as const;

  const validCategories = [
    'engagement',
    'search',
    'traffic',
    'conversion',
    'general',
  ] as const;

  return {
    type: validTypes.includes(item.type) ? item.type : 'other',
    title: String(item.title || 'Insight'),
    detail: String(item.detail || ''),
    evidence: typeof item.evidence === 'string' ? item.evidence : undefined,
    category: validCategories.includes(item.category) ? item.category : 'general',
  };
}

/**
 * Validate a work suggestion
 */
function validateWorkSuggestion(item: any): CompanyAnalyticsWorkSuggestion {
  const validAreas = ['website', 'content', 'seo', 'demand', 'ops', 'general', 'other'] as const;
  const validPriorities = ['high', 'medium', 'low'] as const;
  const validImpacts = ['high', 'medium', 'low'] as const;

  return {
    title: String(item.title || 'Work item'),
    area: validAreas.includes(item.area) ? item.area : 'other',
    description: String(item.description || ''),
    priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
    reason: typeof item.reason === 'string' ? item.reason : undefined,
    impact: validImpacts.includes(item.impact) ? item.impact : undefined,
    recommendedPriority: typeof item.recommendedPriority === 'number'
      ? Math.min(5, Math.max(1, item.recommendedPriority))
      : undefined,
    implementationGuide: typeof item.implementationGuide === 'string' ? item.implementationGuide : undefined,
  };
}

/**
 * Validate an experiment
 */
function validateExperiment(item: any): CompanyAnalyticsExperiment {
  const validImpacts = ['high', 'medium', 'low'] as const;

  return {
    name: String(item.name || 'Experiment'),
    hypothesis: String(item.hypothesis || ''),
    steps: Array.isArray(item.steps)
      ? item.steps.filter((s: unknown) => typeof s === 'string')
      : [],
    successMetric: String(item.successMetric || ''),
    expectedImpact: validImpacts.includes(item.expectedImpact) ? item.expectedImpact : undefined,
  };
}

// ============================================================================
// Fallback Generator
// ============================================================================

/**
 * Generate fallback insights when AI fails
 */
function generateFallbackInsights(
  input: CompanyAnalyticsInput
): CompanyAnalyticsAiInsight {
  const keyInsights: CompanyAnalyticsKeyInsight[] = [];
  const quickWins: string[] = [];
  const workSuggestions: CompanyAnalyticsWorkSuggestion[] = [];
  const experiments: CompanyAnalyticsExperiment[] = [];

  // Build insights from available data
  if (input.ga4) {
    keyInsights.push({
      type: 'traffic',
      title: `${input.ga4.sessions.toLocaleString()} sessions in ${input.range.preset}`,
      detail: `The site received ${input.ga4.sessions.toLocaleString()} sessions from ${input.ga4.users.toLocaleString()} users.`,
      evidence: `Sessions: ${input.ga4.sessions}, Users: ${input.ga4.users}`,
    });
  } else {
    keyInsights.push({
      type: 'traffic',
      title: 'GA4 not configured',
      detail: 'Traffic analytics are not available. Configure GA4 to get traffic insights.',
    });

    quickWins.push('Connect GA4 to enable traffic analytics');
  }

  if (input.searchConsole) {
    keyInsights.push({
      type: 'search',
      title: `${input.searchConsole.clicks.toLocaleString()} search clicks`,
      detail: `Search visibility: ${input.searchConsole.impressions.toLocaleString()} impressions with ${(input.searchConsole.ctr * 100).toFixed(2)}% CTR.`,
      evidence: `Avg position: ${input.searchConsole.avgPosition?.toFixed(1) || 'N/A'}`,
    });

    if (input.searchConsole.ctr < 0.02) {
      quickWins.push('Review and optimize meta titles/descriptions to improve CTR');
    }
  } else {
    keyInsights.push({
      type: 'search',
      title: 'Search Console not configured',
      detail: 'Search analytics are not available. Configure Search Console to get SEO insights.',
    });

    quickWins.push('Connect Search Console to enable SEO analytics');
  }

  // Work-related insights
  if (input.work.overdue > 0) {
    keyInsights.push({
      type: 'other',
      title: `${input.work.overdue} overdue work items`,
      detail: 'There are overdue items that need immediate attention.',
      evidence: `Active: ${input.work.activeCount}, Due today: ${input.work.dueToday}, Overdue: ${input.work.overdue}`,
    });

    workSuggestions.push({
      title: 'Address overdue work items',
      area: 'ops',
      description: `Review and complete the ${input.work.overdue} overdue items to maintain client satisfaction.`,
      priority: 'high',
    });
  }

  // GAP-related insights
  if (!input.gapDiagnostics.lastGapAssessmentAt) {
    quickWins.push('Run initial GAP assessment to establish baseline');

    workSuggestions.push({
      title: 'Run GAP Assessment',
      area: 'ops',
      description: 'No GAP assessment on record. Run an initial assessment to identify opportunities.',
      priority: 'medium',
    });
  } else {
    const daysSinceGap = Math.floor(
      (Date.now() - new Date(input.gapDiagnostics.lastGapAssessmentAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysSinceGap > 90) {
      quickWins.push(`Run new GAP assessment (last one was ${daysSinceGap} days ago)`);
    }
  }

  // Build summary
  const summaryParts: string[] = [];

  summaryParts.push(`${input.companyName} is a ${input.stage || 'company'} that we're reviewing.`);

  if (input.ga4) {
    summaryParts.push(
      `Traffic is showing ${input.ga4.sessions.toLocaleString()} sessions and ${input.ga4.users.toLocaleString()} users over the last ${input.range.preset}.`
    );
  }

  if (input.work.overdue > 0) {
    summaryParts.push(`There are ${input.work.overdue} overdue work items that need attention.`);
  }

  // Add an experiment
  experiments.push({
    name: 'Content Performance Review',
    hypothesis:
      'Reviewing and updating underperforming content will improve engagement and conversions.',
    steps: [
      'Identify top 5 pages by traffic but low engagement',
      'Review and update content for relevance and quality',
      'Monitor engagement metrics over 4 weeks',
    ],
    successMetric: 'Increase average session duration by 20%',
  });

  return {
    summary: summaryParts.join(' '),
    keyInsights,
    quickWins,
    workSuggestions,
    experiments,
  };
}
