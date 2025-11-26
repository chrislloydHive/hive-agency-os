// app/api/os/dma/blueprint/route.ts
// API Route: Generate AI-powered Analytics Blueprint for DMA Funnel
//
// This route analyzes the DMA funnel performance data and generates
// a customized analytics configuration with recommended metrics,
// chart types, and strategic focus areas.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';
import type { AuditFunnelSnapshot } from '@/lib/ga4Client';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// Types
// ============================================================================

export interface DmaAnalyticsBlueprint {
  objectives: string[];
  notesForStrategist: string;
  focusAreas: Array<{
    area: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    metrics: string[];
  }>;
  channelStrategies: Array<{
    channel: string;
    status: 'strong' | 'improving' | 'needs-work' | 'untapped';
    recommendation: string;
  }>;
  optimizationPriorities: Array<{
    title: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    description: string;
  }>;
  generatedAt: string;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are an analytics strategist for Hive OS, analyzing the DigitalMarketingAudit.ai (DMA) acquisition funnel.

DMA is a free digital marketing audit tool that serves as a lead generation funnel:
1. Users start an audit by entering their website URL
2. Users complete the audit by providing additional info (email, company details)
3. Completed audits become leads for follow-up

Given funnel performance data, create an "Analytics Blueprint" that helps strategists:
- Understand which channels are most effective
- Identify optimization opportunities
- Prioritize actions based on impact vs effort

IMPORTANT: Return ONLY valid JSON matching this exact TypeScript structure:

interface DmaAnalyticsBlueprint {
  objectives: string[];           // 2-4 strategic objectives for the funnel
  notesForStrategist: string;     // 2-3 sentences on overall funnel health
  focusAreas: Array<{
    area: string;                 // e.g., "Conversion Optimization", "Traffic Acquisition"
    description: string;          // Why this area matters now
    priority: "high" | "medium" | "low";
    metrics: string[];            // Key metrics to watch
  }>;
  channelStrategies: Array<{
    channel: string;              // The channel name from the data
    status: "strong" | "improving" | "needs-work" | "untapped";
    recommendation: string;       // 1-2 sentence tactical recommendation
  }>;
  optimizationPriorities: Array<{
    title: string;                // Brief title for the optimization
    impact: "high" | "medium" | "low";
    effort: "low" | "medium" | "high";
    description: string;          // What to do and expected outcome
  }>;
  generatedAt: string;            // Will be set by the system
}

ANALYSIS GUIDELINES:
- Completion rate above 60% is strong, 40-60% is average, below 40% needs work
- Look for channels with high starts but low completion (conversion leaks)
- Identify channels with good completion rate but low volume (scale opportunities)
- Consider campaign-level patterns for targeting recommendations
- Quick wins are high-impact, low-effort optimizations

Return ONLY the JSON object, no markdown code blocks or explanations.`;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { snapshot } = body as { snapshot: AuditFunnelSnapshot };

    if (!snapshot) {
      return NextResponse.json(
        { ok: false, error: 'Missing snapshot data' },
        { status: 400 }
      );
    }

    console.log('[DMA Blueprint API] Generating blueprint...');

    // Build context for the AI
    const userPrompt = buildUserPrompt(snapshot);

    // Call OpenAI to generate blueprint
    const openai = getOpenAI();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000,
    });

    const rawContent = response.choices[0].message?.content || '{}';

    // Parse the response
    let blueprint: DmaAnalyticsBlueprint;
    try {
      const parsed = JSON.parse(rawContent);
      blueprint = {
        objectives: parsed.objectives || [],
        notesForStrategist: parsed.notesForStrategist || '',
        focusAreas: parsed.focusAreas || [],
        channelStrategies: parsed.channelStrategies || [],
        optimizationPriorities: parsed.optimizationPriorities || [],
        generatedAt: new Date().toISOString(),
      };
    } catch (parseError) {
      console.error('[DMA Blueprint API] Failed to parse AI response:', rawContent);
      return NextResponse.json(
        { ok: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    console.log('[DMA Blueprint API] Blueprint generated:', {
      focusAreas: blueprint.focusAreas.length,
      channelStrategies: blueprint.channelStrategies.length,
      optimizationPriorities: blueprint.optimizationPriorities.length,
    });

    return NextResponse.json({
      ok: true,
      blueprint,
    });
  } catch (error) {
    console.error('[DMA Blueprint API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Build User Prompt
// ============================================================================

function buildUserPrompt(snapshot: AuditFunnelSnapshot): string {
  const parts: string[] = [];

  parts.push('=== DMA FUNNEL PERFORMANCE DATA ===');
  parts.push('');

  // Totals
  parts.push('OVERALL METRICS:');
  parts.push(`- Audits Started: ${snapshot.totals.auditsStarted.toLocaleString()}`);
  parts.push(`- Audits Completed: ${snapshot.totals.auditsCompleted.toLocaleString()}`);
  parts.push(`- Completion Rate: ${(snapshot.totals.completionRate * 100).toFixed(1)}%`);
  if (snapshot.totals.uniqueUsers !== null) {
    parts.push(`- Unique Users: ${snapshot.totals.uniqueUsers.toLocaleString()}`);
  }
  parts.push('');

  // By Channel
  if (snapshot.byChannel.length > 0) {
    parts.push('PERFORMANCE BY CHANNEL:');
    for (const ch of snapshot.byChannel) {
      parts.push(`- ${ch.channel}: ${ch.auditsStarted} started, ${ch.auditsCompleted} completed (${(ch.completionRate * 100).toFixed(1)}% rate)`);
    }
    parts.push('');
  }

  // By Campaign (top 10)
  if (snapshot.byCampaign.length > 0) {
    parts.push('TOP CAMPAIGNS:');
    for (const camp of snapshot.byCampaign.slice(0, 10)) {
      parts.push(`- ${camp.campaign} (${camp.sourceMedium}): ${camp.auditsStarted} started, ${camp.auditsCompleted} completed (${(camp.completionRate * 100).toFixed(1)}%)`);
    }
    parts.push('');
  }

  // Time series summary
  if (snapshot.timeSeries.length > 0) {
    const first = snapshot.timeSeries[0];
    const last = snapshot.timeSeries[snapshot.timeSeries.length - 1];
    parts.push('TIME RANGE:');
    parts.push(`- From: ${first.date} to ${last.date}`);
    parts.push(`- Days of data: ${snapshot.timeSeries.length}`);
    parts.push('');
  }

  parts.push('=== ANALYSIS REQUEST ===');
  parts.push('');
  parts.push('Based on this funnel data, create a DMA Analytics Blueprint with:');
  parts.push('- 2-4 strategic objectives for improving the funnel');
  parts.push('- 2-4 focus areas with priority levels');
  parts.push('- Strategy recommendation for each channel');
  parts.push('- 3-5 optimization priorities ranked by impact vs effort');
  parts.push('');
  parts.push('Consider:');
  parts.push('- Which channels have the best conversion rates?');
  parts.push('- Which channels have volume but poor completion?');
  parts.push('- What quick wins could improve overall performance?');
  parts.push('- What should be the strategic focus for the next 30 days?');

  return parts.join('\n');
}
