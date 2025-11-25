// app/api/os/dashboard/ai-briefing/route.ts
// AI Briefing API - Generates actionable daily briefings from dashboard data

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import type { DashboardSummary } from '@/lib/os/dashboardSummary';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

export type BriefingFocusArea = 'clients' | 'work' | 'pipeline' | 'analytics' | 'diagnostics';
export type BriefingLinkType = 'company' | 'work' | 'opportunity' | 'analytics' | 'none';

export interface BriefingFocusItem {
  area: BriefingFocusArea;
  title: string;
  detail: string;
  linkType: BriefingLinkType;
  linkHref: string | null;
}

export interface BriefingRisk {
  title: string;
  detail: string;
}

export interface BriefingOpportunity {
  title: string;
  detail: string;
}

export interface AIBriefing {
  headline: string;
  summary: string;
  todayFocus: BriefingFocusItem[];
  risks: BriefingRisk[];
  opportunities: BriefingOpportunity[];
}

interface BriefingRequest {
  summary: DashboardSummary;
  context?: {
    includeDiagnostics?: boolean;
  };
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and Operations for a marketing agency.

You receive a JSON summary of the agency's current state:
- Client health (at-risk clients, new clients)
- Workload (work items due today/overdue)
- Pipeline (leads, opportunities, stages)
- Analytics (GA4 + Search Console + DMA funnel)
- GAP/diagnostics activity (recent assessments/plans)

Your job is to produce a concise, actionable briefing that tells the agency lead what to focus on today.

Be specific, direct, and grounded in the data. Reference actual numbers, client names, and specific items.

TONE:
- Professional but conversational
- Direct and actionable
- Focus on what matters TODAY
- Prioritize urgent items (overdue work, at-risk clients)
- Highlight opportunities (new leads, pipeline momentum)

RESPONSE FORMAT:
You must respond with valid JSON matching this exact structure:
{
  "headline": "A punchy 5-10 word headline summarizing the day (e.g., '3 overdue tasks need attention' or 'Strong pipeline momentum this week')",
  "summary": "A 2-3 sentence narrative overview of the current state. Be specific about numbers.",
  "todayFocus": [
    {
      "area": "clients" | "work" | "pipeline" | "analytics" | "diagnostics",
      "title": "Short action title (e.g., 'Follow up with Acme Corp')",
      "detail": "1-2 sentences explaining why this matters and what to do",
      "linkType": "company" | "work" | "opportunity" | "analytics" | "none",
      "linkHref": "/companies/[id]" or "/work" or "/pipeline/opportunities" or "/analytics" or null
    }
  ],
  "risks": [
    {
      "title": "Risk title",
      "detail": "Why this is a risk and what could happen"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity title",
      "detail": "Why this is an opportunity and how to capitalize"
    }
  ]
}

RULES:
1. todayFocus should have 3-7 items, prioritized by urgency
2. risks should have 0-3 items (only include real risks)
3. opportunities should have 0-3 items (only include real opportunities)
4. If data is missing or empty, acknowledge it but still provide useful guidance
5. Use actual company names and IDs from the data
6. For linkHref, use the actual IDs provided in the data (e.g., /companies/rec123abc)
7. Always include at least one actionable focus item

Return ONLY valid JSON, no markdown formatting or code blocks.`;

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: BriefingRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { summary, context } = body;

    if (!summary) {
      return NextResponse.json(
        { ok: false, error: 'summary is required' },
        { status: 400 }
      );
    }

    console.log('[AI Briefing] Generating briefing...');
    console.log('[AI Briefing] Summary stats:', {
      companies: summary.companiesCount,
      atRisk: summary.clientHealth?.atRisk?.length || 0,
      workToday: summary.work?.today || 0,
      workOverdue: summary.work?.overdue || 0,
      activeOpportunities: summary.pipeline?.activeOpportunities || 0,
    });

    // Build the user prompt with the summary data
    const userPrompt = `Generate a daily briefing based on this dashboard summary:

${JSON.stringify(summary, null, 2)}

${context?.includeDiagnostics ? 'Include diagnostics/GAP activity in your analysis.' : ''}

Remember to:
- Prioritize overdue and at-risk items
- Reference specific company names and numbers
- Include actionable linkHref values using actual IDs from the data
- Be concise but specific`;

    // Get OpenAI client
    const openai = getOpenAI();

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('[AI Briefing] OpenAI response received');

    // Parse the response
    let briefing: AIBriefing;
    try {
      const parsed = JSON.parse(responseText);

      // Validate and sanitize the response
      briefing = {
        headline: typeof parsed.headline === 'string' ? parsed.headline : 'Daily Briefing',
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Unable to generate summary.',
        todayFocus: Array.isArray(parsed.todayFocus)
          ? parsed.todayFocus.map((item: any) => ({
              area: validateArea(item.area),
              title: String(item.title || 'Action item'),
              detail: String(item.detail || ''),
              linkType: validateLinkType(item.linkType),
              linkHref: typeof item.linkHref === 'string' ? item.linkHref : null,
            }))
          : [],
        risks: Array.isArray(parsed.risks)
          ? parsed.risks.map((item: any) => ({
              title: String(item.title || 'Risk'),
              detail: String(item.detail || ''),
            }))
          : [],
        opportunities: Array.isArray(parsed.opportunities)
          ? parsed.opportunities.map((item: any) => ({
              title: String(item.title || 'Opportunity'),
              detail: String(item.detail || ''),
            }))
          : [],
      };
    } catch (parseError) {
      console.error('[AI Briefing] Failed to parse response:', parseError);
      console.error('[AI Briefing] Response text:', responseText.substring(0, 500));

      // Return fallback briefing
      briefing = {
        headline: 'Daily Briefing',
        summary: 'Unable to generate AI briefing. Please check the dashboard data manually.',
        todayFocus: [],
        risks: [],
        opportunities: [],
      };
    }

    console.log('[AI Briefing] Briefing generated:', {
      headline: briefing.headline,
      focusItems: briefing.todayFocus.length,
      risks: briefing.risks.length,
      opportunities: briefing.opportunities.length,
    });

    return NextResponse.json({
      ok: true,
      briefing,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Briefing] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function validateArea(area: unknown): BriefingFocusArea {
  const validAreas: BriefingFocusArea[] = ['clients', 'work', 'pipeline', 'analytics', 'diagnostics'];
  return validAreas.includes(area as BriefingFocusArea)
    ? (area as BriefingFocusArea)
    : 'work';
}

function validateLinkType(linkType: unknown): BriefingLinkType {
  const validTypes: BriefingLinkType[] = ['company', 'work', 'opportunity', 'analytics', 'none'];
  return validTypes.includes(linkType as BriefingLinkType)
    ? (linkType as BriefingLinkType)
    : 'none';
}
