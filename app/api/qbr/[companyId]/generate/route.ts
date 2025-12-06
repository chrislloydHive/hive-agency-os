// app/api/qbr/[companyId]/generate/route.ts
// Generate AI content for QBR sections

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getQbrContext } from '@/lib/contextGraph/contextGateway';
import { createQbrSnapshot } from '@/lib/contextGraph/snapshots';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

type QBRSection =
  | 'executive-summary'
  | 'media-performance'
  | 'audience-updates'
  | 'website-review'
  | 'strategy-adjustments'
  | 'recommendations';

interface GenerateBody {
  section: QBRSection;
  qbrId?: string;          // Optional QBR run ID
  createSnapshot?: boolean; // Create a snapshot of context at time of QBR
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body: GenerateBody = await request.json();
    const { section, qbrId, createSnapshot } = body;

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Create snapshot if requested (typically on first section generation)
    let snapshotId: string | undefined;
    if (createSnapshot && section === 'executive-summary') {
      try {
        const snapshot = await createQbrSnapshot(companyId, qbrId || `qbr-${Date.now()}`);
        snapshotId = snapshot.snapshotId;
        console.log(`[QBR] Created snapshot ${snapshotId} for ${companyId}`);
      } catch (snapErr) {
        console.warn('[QBR] Failed to create snapshot:', snapErr);
        // Continue without snapshot - not critical
      }
    }

    // Build context for the AI
    const context = buildQBRContext(graph, section);
    const prompt = getSectionPrompt(section, context);

    // Generate content with Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';

    return NextResponse.json({
      success: true,
      section,
      content,
      snapshotId, // Include if created
    });
  } catch (error) {
    console.error('[QBR] Error generating section:', error);
    return NextResponse.json(
      { error: 'Failed to generate section' },
      { status: 500 }
    );
  }
}

function buildQBRContext(
  graph: NonNullable<Awaited<ReturnType<typeof loadContextGraph>>>,
  section: QBRSection
): string {
  const parts: string[] = [];

  // Always include basic company info
  parts.push(`Company: ${graph.identity.businessName.value || 'Unknown'}`);
  parts.push(`Industry: ${graph.identity.industry.value || 'Unknown'}`);
  parts.push(`Primary Objective: ${graph.objectives.primaryObjective.value || 'Growth'}`);

  switch (section) {
    case 'executive-summary':
      parts.push(`Business Model: ${graph.identity.businessModel.value || 'Unknown'}`);
      parts.push(`Time Horizon: ${graph.objectives.timeHorizon.value || 'Not specified'}`);
      parts.push(`Active Channels: ${(graph.performanceMedia.activeChannels.value || []).join(', ') || 'None'}`);
      parts.push(`Graph Completeness: ${graph.meta.completenessScore || 0}%`);
      break;

    case 'media-performance':
      parts.push(`Active Channels: ${(graph.performanceMedia.activeChannels.value || []).join(', ') || 'None'}`);
      parts.push(`Total Budget: $${graph.budgetOps.totalMarketingBudget.value || 0}`);
      parts.push(`Media Issues: ${(graph.performanceMedia.mediaIssues.value || []).join('; ') || 'None'}`);
      parts.push(`Media Opportunities: ${(graph.performanceMedia.mediaOpportunities.value || []).join('; ') || 'None'}`);
      break;

    case 'audience-updates':
      parts.push(`Core Segments: ${(graph.audience.coreSegments.value || []).join(', ') || 'None'}`);
      parts.push(`Primary Markets: ${(graph.audience.primaryMarkets.value || []).join(', ') || 'None'}`);
      parts.push(`Personas: ${(graph.audience.personaNames.value || []).join(', ') || 'None'}`);
      parts.push(`Pain Points: ${(graph.audience.painPoints.value || []).slice(0, 3).join('; ') || 'None'}`);
      break;

    case 'website-review':
      parts.push(`Website Summary: ${graph.website.websiteSummary.value || 'No summary'}`);
      parts.push(`Critical Issues: ${(graph.website.criticalIssues.value || []).join('; ') || 'None'}`);
      parts.push(`Quick Wins: ${(graph.website.quickWins.value || []).join('; ') || 'None'}`);
      parts.push(`Conversion Blocks: ${(graph.website.conversionBlocks.value || []).join('; ') || 'None'}`);
      break;

    case 'strategy-adjustments':
      parts.push(`Primary Objective: ${graph.objectives.primaryObjective.value || 'Growth'}`);
      parts.push(`Secondary Objectives: ${(graph.objectives.secondaryObjectives.value || []).join(', ') || 'None'}`);
      parts.push(`Target CPA: $${graph.objectives.targetCpa.value || 'Not set'}`);
      parts.push(`Target ROAS: ${graph.objectives.targetRoas.value || 'Not set'}x`);
      // Include competitive intelligence
      if (graph.competitive) {
        const competitors = graph.competitive.primaryCompetitors?.value || [];
        if (competitors.length > 0) {
          parts.push(`Primary Competitors: ${competitors.map(c => c.name).join(', ')}`);
        }
        if (graph.competitive.positioningSummary?.value) {
          parts.push(`Competitive Positioning: ${graph.competitive.positioningSummary.value}`);
        }
        if (graph.competitive.whitespaceOpportunities?.value?.length) {
          parts.push(`Whitespace Opportunities: ${graph.competitive.whitespaceOpportunities.value.join('; ')}`);
        }
      }
      break;

    case 'recommendations':
      // Include everything for recommendations
      parts.push(`Media Issues: ${(graph.performanceMedia.mediaIssues.value || []).join('; ') || 'None'}`);
      parts.push(`Website Issues: ${(graph.website.criticalIssues.value || []).join('; ') || 'None'}`);
      parts.push(`Quick Wins: ${(graph.website.quickWins.value || []).join('; ') || 'None'}`);
      parts.push(`Opportunities: ${(graph.performanceMedia.mediaOpportunities.value || []).join('; ') || 'None'}`);
      // Include competitive intelligence for recommendations
      if (graph.competitive) {
        const competitors = graph.competitive.primaryCompetitors?.value || [];
        if (competitors.length > 0) {
          const competitorInsights = competitors
            .filter(c => c.strengths?.length || c.weaknesses?.length)
            .map(c => {
              const insights: string[] = [`${c.name}:`];
              if (c.strengths?.length) insights.push(`strengths: ${c.strengths.slice(0, 2).join(', ')}`);
              if (c.weaknesses?.length) insights.push(`weaknesses: ${c.weaknesses.slice(0, 2).join(', ')}`);
              return insights.join(' ');
            });
          if (competitorInsights.length > 0) {
            parts.push(`Competitor Insights: ${competitorInsights.join('; ')}`);
          }
        }
        if (graph.competitive.whitespaceOpportunities?.value?.length) {
          parts.push(`Competitive Whitespace: ${graph.competitive.whitespaceOpportunities.value.join('; ')}`);
        }
        if (graph.competitive.positioningSummary?.value) {
          parts.push(`Positioning Summary: ${graph.competitive.positioningSummary.value}`);
        }
      }
      break;
  }

  return parts.join('\n');
}

function getSectionPrompt(section: QBRSection, context: string): string {
  const prompts: Record<QBRSection, string> = {
    'executive-summary': `You are a marketing strategist preparing a Quarterly Business Review. Based on the following context, write a concise executive summary (3-4 paragraphs) covering key highlights, performance status, and strategic focus areas.

Context:
${context}

Write a professional executive summary that would be appropriate for C-level stakeholders. Focus on business impact and strategic direction.`,

    'media-performance': `You are a media analyst preparing a Quarterly Business Review. Based on the following context, analyze media performance and provide insights on channel effectiveness, budget utilization, and optimization opportunities.

Context:
${context}

Write a media performance analysis (3-4 paragraphs) that covers channel performance, spend efficiency, and recommendations for the next quarter.`,

    'audience-updates': `You are a customer insights analyst preparing a Quarterly Business Review. Based on the following context, analyze audience segments and personas, noting any shifts or opportunities.

Context:
${context}

Write an audience analysis (2-3 paragraphs) covering segment performance, persona insights, and targeting recommendations.`,

    'website-review': `You are a conversion optimization specialist preparing a Quarterly Business Review. Based on the following context, analyze website performance and conversion funnel health.

Context:
${context}

Write a website and conversion review (3-4 paragraphs) covering UX issues, conversion blockers, and improvement priorities.`,

    'strategy-adjustments': `You are a marketing strategist preparing a Quarterly Business Review. Based on the following context, recommend strategic adjustments for the next quarter.

Context:
${context}

Write strategy recommendations (3-4 paragraphs) covering objective alignment, tactical adjustments, competitive positioning, and prioritization guidance. If competitive intelligence is available, factor competitor movements and whitespace opportunities into your recommendations.`,

    'recommendations': `You are a marketing strategist preparing a Quarterly Business Review. Based on the following context, provide a prioritized list of actionable recommendations.

Context:
${context}

Provide 5-8 specific, actionable recommendations as a bulleted list. Each recommendation should start with "- " and be clear enough to become a work item. Order by priority (highest first). Include competitive-focused recommendations when competitor insights or whitespace opportunities are available.`,
  };

  return prompts[section];
}
