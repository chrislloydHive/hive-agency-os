// lib/os/briefing/ai.ts
// AI Briefing Engine for Hive OS
// Takes HiveOsBriefingInput and generates HiveOsBriefing using OpenAI

import { getOpenAI } from '@/lib/openai';
import type { HiveOsBriefingInput, HiveOsBriefing } from './types';

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and senior marketing strategist.
You are given a JSON object that describes the overall state of an agency's client roster, work, pipeline, and analytics (GA4 + Google Search Console) for the last 30 days.
Your job is to produce a concise but actionable daily briefing that helps the agency founder know what to focus on today.

Focus on: client health, work backlog, pipeline, and growth analytics. Surface risks and opportunities, not just observations. Use plain language. Assume the reader is busy and wants clarity, not fluff.

Be specific about numbers, client names, and metrics. Reference the actual data provided.

RESPONSE FORMAT:
You must respond with valid JSON matching this exact structure:

{
  "date": "ISO timestamp (use the one from input)",
  "summary": "1–2 paragraphs executive summary highlighting key findings and what the day looks like. Be specific about numbers.",
  "todayFocus": [
    {
      "type": "client" | "work" | "pipeline" | "growth" | "risk",
      "title": "Short action-oriented title",
      "description": "1-2 sentences explaining why this matters and what to do",
      "companyId": "ID if relevant, or null",
      "companyName": "Name if relevant, or null",
      "priority": "high" | "medium" | "low"
    }
  ],
  "clientHealthNotes": [
    "Bullet point about client health situation",
    "Another observation about clients"
  ],
  "workAndDeliveryNotes": [
    "Bullet point about work status",
    "Another observation about delivery"
  ],
  "growthAnalyticsNotes": [
    "Bullet point about GA4 or GSC performance",
    "Another analytics insight"
  ],
  "risksToWatch": [
    {
      "title": "Risk title",
      "description": "Why this is a risk and what could happen",
      "severity": "high" | "medium" | "low"
    }
  ]
}

GUIDELINES:
1. todayFocus should have 3-7 items, prioritized by urgency
2. Each notes array should have 2-5 bullet points
3. risksToWatch should have 0-3 items (only include real risks)
4. If data is missing or empty, acknowledge it but still provide useful guidance
5. Use actual company names and IDs from the data
6. Prioritize:
   - Overdue work (urgent)
   - At-risk clients (important)
   - Pipeline opportunities (growth)
   - Analytics anomalies (insight)

Return ONLY valid JSON, no markdown formatting or code blocks.`;

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate an AI briefing from the input data
 */
export async function generateHiveOsBriefing(
  input: HiveOsBriefingInput
): Promise<HiveOsBriefing> {
  console.log('[Briefing AI] Generating briefing...');

  try {
    const openai = getOpenAI();

    // Build user prompt
    const userPrompt = `Generate a daily briefing based on this Hive OS data:

${JSON.stringify(input, null, 2)}

Remember to:
- Prioritize overdue work and at-risk clients
- Reference specific company names and numbers
- Keep the summary to 1-2 paragraphs
- Be actionable and specific`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('[Briefing AI] OpenAI response received');

    // Parse and validate the response
    const briefing = parseAndValidateBriefing(responseText, input.date);

    console.log('[Briefing AI] Briefing generated:', {
      summaryLength: briefing.summary.length,
      focusItems: briefing.todayFocus.length,
      risks: briefing.risksToWatch.length,
    });

    return briefing;
  } catch (error) {
    console.error('[Briefing AI] Error generating briefing:', error);

    // Return fallback briefing
    return generateFallbackBriefing(input);
  }
}

// ============================================================================
// Parsing & Validation
// ============================================================================

/**
 * Parse and validate the AI response, with fallbacks for missing fields
 */
function parseAndValidateBriefing(
  responseText: string,
  date: string
): HiveOsBriefing {
  try {
    const parsed = JSON.parse(responseText);

    return {
      date: typeof parsed.date === 'string' ? parsed.date : date,
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : 'Unable to generate summary.',
      todayFocus: Array.isArray(parsed.todayFocus)
        ? parsed.todayFocus.map(validateFocusItem)
        : [],
      clientHealthNotes: Array.isArray(parsed.clientHealthNotes)
        ? parsed.clientHealthNotes.filter(
            (n: unknown) => typeof n === 'string'
          )
        : [],
      workAndDeliveryNotes: Array.isArray(parsed.workAndDeliveryNotes)
        ? parsed.workAndDeliveryNotes.filter(
            (n: unknown) => typeof n === 'string'
          )
        : [],
      growthAnalyticsNotes: Array.isArray(parsed.growthAnalyticsNotes)
        ? parsed.growthAnalyticsNotes.filter(
            (n: unknown) => typeof n === 'string'
          )
        : [],
      risksToWatch: Array.isArray(parsed.risksToWatch)
        ? parsed.risksToWatch.map(validateRisk)
        : [],
    };
  } catch (parseError) {
    console.error('[Briefing AI] Failed to parse response:', parseError);
    console.error('[Briefing AI] Response text:', responseText.substring(0, 500));

    // Try to salvage any JSON-looking content
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const salvaged = JSON.parse(jsonMatch[0]);
        return parseAndValidateBriefing(JSON.stringify(salvaged), date);
      } catch {
        // Give up and return minimal briefing
      }
    }

    return {
      date,
      summary: 'Unable to generate AI briefing. Please review dashboard data manually.',
      todayFocus: [],
      clientHealthNotes: [],
      workAndDeliveryNotes: [],
      growthAnalyticsNotes: [],
      risksToWatch: [],
    };
  }
}

/**
 * Validate and normalize a focus item
 */
function validateFocusItem(item: any): HiveOsBriefing['todayFocus'][number] {
  const validTypes = ['client', 'work', 'pipeline', 'growth', 'risk'] as const;
  const validPriorities = ['high', 'medium', 'low'] as const;

  return {
    type: validTypes.includes(item.type) ? item.type : 'work',
    title: String(item.title || 'Action item'),
    description: String(item.description || ''),
    companyId:
      typeof item.companyId === 'string' && item.companyId ? item.companyId : null,
    companyName:
      typeof item.companyName === 'string' && item.companyName
        ? item.companyName
        : null,
    priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
  };
}

/**
 * Validate and normalize a risk item
 */
function validateRisk(item: any): HiveOsBriefing['risksToWatch'][number] {
  const validSeverities = ['high', 'medium', 'low'] as const;

  return {
    title: String(item.title || 'Risk'),
    description: String(item.description || ''),
    severity: validSeverities.includes(item.severity) ? item.severity : 'medium',
  };
}

// ============================================================================
// Fallback Generator
// ============================================================================

/**
 * Generate a fallback briefing when AI fails
 */
function generateFallbackBriefing(input: HiveOsBriefingInput): HiveOsBriefing {
  const todayFocus: HiveOsBriefing['todayFocus'] = [];
  const clientHealthNotes: string[] = [];
  const workAndDeliveryNotes: string[] = [];
  const growthAnalyticsNotes: string[] = [];
  const risksToWatch: HiveOsBriefing['risksToWatch'] = [];

  // Build focus items from data
  if (input.workSummary.overdue > 0) {
    todayFocus.push({
      type: 'work',
      title: `Address ${input.workSummary.overdue} overdue work items`,
      description:
        'Overdue items need immediate attention to maintain client satisfaction.',
      companyId: null,
      companyName: null,
      priority: 'high',
    });

    risksToWatch.push({
      title: 'Overdue Work',
      description: `${input.workSummary.overdue} work items are past due, which may impact client relationships.`,
      severity: 'high',
    });
  }

  if (input.workSummary.dueToday > 0) {
    todayFocus.push({
      type: 'work',
      title: `Complete ${input.workSummary.dueToday} items due today`,
      description: 'Stay on track by completing today\'s deliverables.',
      companyId: null,
      companyName: null,
      priority: 'high',
    });
  }

  // At-risk clients
  for (const client of input.clientHealth.atRiskClients.slice(0, 3)) {
    todayFocus.push({
      type: 'client',
      title: `Check in with ${client.name}`,
      description: `At-risk due to: ${client.reason}`,
      companyId: client.id,
      companyName: client.name,
      priority: 'high',
    });

    clientHealthNotes.push(
      `${client.name} is at risk: ${client.reason}`
    );
  }

  // New clients
  if (input.clientHealth.newClientsLast7d.length > 0) {
    clientHealthNotes.push(
      `${input.clientHealth.newClientsLast7d.length} new clients added this week`
    );
  }

  // Work notes
  workAndDeliveryNotes.push(
    `${input.workSummary.totalActive} active work items`
  );
  workAndDeliveryNotes.push(
    `${input.workSummary.dueToday} due today, ${input.workSummary.overdue} overdue`
  );

  // GAP activity
  if (input.gapSummary.assessmentsLast30d > 0) {
    workAndDeliveryNotes.push(
      `${input.gapSummary.assessmentsLast30d} GAP assessments completed in last 30 days`
    );
  }

  // Growth analytics
  if (input.growthAnalytics.ga4) {
    if (input.growthAnalytics.ga4.sessions30d) {
      growthAnalyticsNotes.push(
        `${input.growthAnalytics.ga4.sessions30d.toLocaleString()} sessions in last 30 days`
      );
    }
    if (input.growthAnalytics.ga4.users30d) {
      growthAnalyticsNotes.push(
        `${input.growthAnalytics.ga4.users30d.toLocaleString()} users in last 30 days`
      );
    }
  }

  if (input.growthAnalytics.searchConsole) {
    growthAnalyticsNotes.push(
      `Search Console: ${input.growthAnalytics.searchConsole.clicks.toLocaleString()} clicks, ${(input.growthAnalytics.searchConsole.ctr * 100).toFixed(1)}% CTR`
    );
  }

  // Pipeline
  if (input.pipelineSummary.activeOpportunities > 0) {
    todayFocus.push({
      type: 'pipeline',
      title: `Review ${input.pipelineSummary.activeOpportunities} active opportunities`,
      description: 'Keep pipeline moving forward with follow-ups.',
      companyId: null,
      companyName: null,
      priority: 'medium',
    });
  }

  // Build summary
  const summaryParts: string[] = [];

  if (input.workSummary.dueToday > 0 || input.workSummary.overdue > 0) {
    summaryParts.push(
      `You have ${input.workSummary.dueToday} work items due today and ${input.workSummary.overdue} overdue.`
    );
  }

  if (input.clientHealth.atRiskClients.length > 0) {
    summaryParts.push(
      `${input.clientHealth.atRiskClients.length} clients need attention.`
    );
  }

  if (input.pipelineSummary.activeOpportunities > 0) {
    summaryParts.push(
      `Pipeline has ${input.pipelineSummary.activeOpportunities} active opportunities.`
    );
  }

  const summary =
    summaryParts.length > 0
      ? summaryParts.join(' ')
      : 'Dashboard summary unavailable. Check individual sections for details.';

  return {
    date: input.date,
    summary,
    todayFocus,
    clientHealthNotes,
    workAndDeliveryNotes,
    growthAnalyticsNotes,
    risksToWatch,
  };
}
