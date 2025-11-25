// app/api/os/briefing/route.ts
// AI Briefing API v2
// Generates intelligent daily briefings from real data sources

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import { generateBriefing } from '@/lib/os/briefing/engine';
import type { Briefing, CompanyId } from '@/lib/os/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Hive OS, an AI Head of Growth and Operations for a marketing agency.

You receive structured data about the agency's current state:
- Focus items (prioritized action items for today)
- Risks (things that need immediate attention)
- Opportunities (growth potential)
- Data snapshot (summary metrics)
- Analytics data (GA4 traffic + Google Search Console performance)

Your job is to synthesize this into a natural, actionable briefing with:
1. A punchy headline (5-10 words) summarizing the day
2. A 2-3 sentence narrative summary

TONE:
- Professional but conversational
- Direct and actionable
- Focus on what matters TODAY
- Reference specific numbers and names from the data
- Highlight both client health AND growth analytics (traffic, search)

RULES:
1. The headline should capture the most important theme
2. The summary should give a quick overview that a busy executive can scan
3. Don't invent data - only reference what's in the provided data
4. Be specific (use names, numbers, percentages) not generic
5. If Search Console data is available, mention search performance (clicks, CTR, position)

Respond with JSON:
{
  "headline": "string",
  "summary": "string"
}`;

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let companyId: CompanyId | undefined;
    try {
      const body = await request.json();
      companyId = body.companyId;
    } catch {
      // No body or invalid JSON - that's fine, we'll do workspace-wide
    }

    console.log('[Briefing API] Generating briefing...', companyId ? `for company ${companyId}` : 'workspace-wide');

    // Generate briefing data
    const { data, focusItems, risks, opportunities, snapshot } = await generateBriefing(companyId);

    // Build context for AI
    const aiContext = {
      focusItems: focusItems.map((f) => ({
        area: f.area,
        title: f.title,
        detail: f.detail,
        priority: f.priority,
        companyName: f.companyName,
      })),
      risks: risks.map((r) => ({
        title: r.title,
        detail: r.detail,
        severity: r.severity,
        companyName: r.companyName,
      })),
      opportunities: opportunities.map((o) => ({
        title: o.title,
        detail: o.detail,
        companyName: o.companyName,
      })),
      snapshot,
      analytics: data.analytics ? {
        sessions30d: data.analytics.sessions30d,
        users30d: data.analytics.users30d,
        bounceRate: data.analytics.bounceRate,
        searchConsole: data.analytics.searchConsole ? {
          clicks: data.analytics.searchConsole.clicks,
          impressions: data.analytics.searchConsole.impressions,
          ctr: data.analytics.searchConsole.ctr,
          avgPosition: data.analytics.searchConsole.avgPosition,
          topQueries: data.analytics.searchConsole.topQueries?.slice(0, 3),
        } : undefined,
        anomalies: data.analytics.anomalies,
      } : undefined,
    };

    // Generate headline and summary with AI
    let headline = 'Daily Briefing';
    let summary = '';

    try {
      const openai = getOpenAI();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Generate a briefing headline and summary from this data:\n\n${JSON.stringify(aiContext, null, 2)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(responseText);

      if (parsed.headline) headline = parsed.headline;
      if (parsed.summary) summary = parsed.summary;
    } catch (aiError) {
      console.warn('[Briefing API] AI generation failed, using fallback:', aiError);

      // Fallback headline/summary generation
      if (snapshot.workOverdue > 0) {
        headline = `${snapshot.workOverdue} overdue items need attention`;
      } else if (snapshot.atRiskCount > 0) {
        headline = `${snapshot.atRiskCount} client${snapshot.atRiskCount > 1 ? 's' : ''} at risk`;
      } else if (focusItems.length > 0) {
        headline = focusItems[0].title;
      }

      summary = `You have ${snapshot.companiesCount} companies, ${snapshot.workOverdue} overdue work items, and ${snapshot.activeOpportunities} active opportunities.`;
    }

    // Build final briefing
    const briefing: Briefing = {
      id: `briefing-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      companyId,
      headline,
      summary,
      todayFocus: focusItems,
      risks,
      opportunities,
      dataSnapshot: snapshot,
    };

    console.log('[Briefing API] Briefing generated:', {
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
    console.error('[Briefing API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler (for simpler fetching)
// ============================================================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const companyId = searchParams.get('companyId') || undefined;

  // Create a mock POST request body
  const mockRequest = {
    json: async () => ({ companyId }),
  } as NextRequest;

  return POST(mockRequest);
}
