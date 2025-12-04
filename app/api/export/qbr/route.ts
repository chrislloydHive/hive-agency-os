// app/api/export/qbr/route.ts
// Export QBR Pack after Quarterly Business Review completion

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getWorkItems } from '@/lib/work/workItems';

interface ExportQBRBody {
  companyId: string;
  format?: 'json' | 'markdown';
  sections?: {
    executiveSummary?: string;
    mediaPerformance?: string;
    audienceUpdates?: string;
    websiteReview?: string;
    strategyAdjustments?: string;
    recommendations?: string[];
  };
  quarter?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportQBRBody = await request.json();
    const { companyId, format = 'json', sections, quarter } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Load work items
    const workItems = await getWorkItems(companyId);
    const activeWorkItems = workItems.filter(
      (item) => item.status !== 'Done'
    );

    // Determine quarter label
    const quarterLabel = quarter || getCurrentQuarter();

    // Build QBR pack
    const qbrPack = {
      meta: {
        companyId,
        companyName: graph.identity.businessName.value || 'Unknown',
        quarter: quarterLabel,
        generatedAt: new Date().toISOString(),
        graphVersion: graph.meta.version,
      },

      sections: {
        executiveSummary: sections?.executiveSummary || null,
        mediaPerformance: sections?.mediaPerformance || null,
        audienceUpdates: sections?.audienceUpdates || null,
        websiteReview: sections?.websiteReview || null,
        strategyAdjustments: sections?.strategyAdjustments || null,
        recommendations: sections?.recommendations || [],
      },

      currentState: {
        objectives: {
          primary: graph.objectives.primaryObjective.value,
          secondary: graph.objectives.secondaryObjectives.value,
          targetCpa: graph.objectives.targetCpa.value,
          targetRoas: graph.objectives.targetRoas.value,
        },

        media: {
          activeChannels: graph.performanceMedia.activeChannels.value,
          issues: graph.performanceMedia.mediaIssues.value,
          opportunities: graph.performanceMedia.mediaOpportunities.value,
        },

        audience: {
          coreSegments: graph.audience.coreSegments.value,
          primaryMarkets: graph.audience.primaryMarkets.value,
          personas: graph.audience.personaNames.value,
        },

        website: {
          criticalIssues: graph.website.criticalIssues.value,
          conversionBlocks: graph.website.conversionBlocks.value,
          quickWins: graph.website.quickWins.value,
        },

        budget: {
          totalMarketing: graph.budgetOps.totalMarketingBudget.value,
          mediaSpend: graph.budgetOps.mediaSpendBudget.value,
        },
      },

      actionItems: activeWorkItems.map((item) => ({
        id: item.id,
        title: item.title,
        area: item.area,
        priority: item.priority,
        status: item.status,
        dueDate: item.dueDate,
      })),

      workItemSummary: {
        total: workItems.length,
        completed: workItems.filter((i) => i.status === 'Done').length,
        inProgress: workItems.filter((i) => i.status === 'In Progress').length,
        pending: workItems.filter((i) => i.status === 'Planned' || i.status === 'Backlog').length,
      },
    };

    if (format === 'markdown') {
      const markdown = generateQBRMarkdown(qbrPack);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="qbr-${quarterLabel}-${companyId}.md"`,
        },
      });
    }

    return NextResponse.json(qbrPack);
  } catch (error) {
    console.error('[Export] Error generating QBR pack:', error);
    return NextResponse.json(
      { error: 'Failed to generate QBR pack' },
      { status: 500 }
    );
  }
}

function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}

function generateQBRMarkdown(pack: Record<string, unknown>): string {
  const meta = pack.meta as Record<string, unknown>;
  const sections = pack.sections as Record<string, unknown>;
  const currentState = pack.currentState as Record<string, unknown>;
  const actionItems = pack.actionItems as Array<Record<string, unknown>>;
  const workItemSummary = pack.workItemSummary as Record<string, unknown>;

  const objectives = currentState.objectives as Record<string, unknown>;
  const media = currentState.media as Record<string, unknown>;
  const audience = currentState.audience as Record<string, unknown>;
  const website = currentState.website as Record<string, unknown>;

  return `# Quarterly Business Review: ${meta.companyName}
## ${meta.quarter}

Generated: ${meta.generatedAt}

---

## Executive Summary

${sections.executiveSummary || '_No executive summary generated_'}

---

## Media Performance

${sections.mediaPerformance || '_No media performance analysis generated_'}

### Current Media State
- **Active Channels**: ${((media.activeChannels as string[]) || []).join(', ') || 'None'}
- **Known Issues**: ${((media.issues as string[]) || []).join('; ') || 'None'}
- **Opportunities**: ${((media.opportunities as string[]) || []).join('; ') || 'None'}

---

## Audience Updates

${sections.audienceUpdates || '_No audience updates generated_'}

### Current Audience State
- **Core Segments**: ${((audience.coreSegments as string[]) || []).join(', ') || 'None'}
- **Primary Markets**: ${((audience.primaryMarkets as string[]) || []).join(', ') || 'None'}
- **Active Personas**: ${((audience.personas as string[]) || []).join(', ') || 'None'}

---

## Website Review

${sections.websiteReview || '_No website review generated_'}

### Current Website State
- **Critical Issues**: ${((website.criticalIssues as string[]) || []).join('; ') || 'None'}
- **Conversion Blockers**: ${((website.conversionBlocks as string[]) || []).join('; ') || 'None'}
- **Quick Wins**: ${((website.quickWins as string[]) || []).join('; ') || 'None'}

---

## Strategy Adjustments

${sections.strategyAdjustments || '_No strategy adjustments generated_'}

### Current Objectives
- **Primary**: ${objectives.primary || 'Not set'}
- **Secondary**: ${((objectives.secondary as string[]) || []).join(', ') || 'None'}
- **Target CPA**: $${objectives.targetCpa || 'Not set'}
- **Target ROAS**: ${objectives.targetRoas || 'Not set'}x

---

## Recommendations

${((sections.recommendations as string[]) || []).length > 0
    ? ((sections.recommendations as string[]) || []).map((r) => `- ${r}`).join('\n')
    : '_No recommendations generated_'}

---

## Action Items

### Work Item Summary
- **Total**: ${workItemSummary.total}
- **Completed**: ${workItemSummary.completed}
- **In Progress**: ${workItemSummary.inProgress}
- **Pending**: ${workItemSummary.pending}

### Active Items
${actionItems.length > 0
    ? actionItems.map((item) =>
        `- **${item.title}** (${item.area}, ${item.priority})${item.dueDate ? ` - Due: ${item.dueDate}` : ''}`
      ).join('\n')
    : '_No active work items_'}

---

*Generated by Hive OS QBR Mode*
`;
}
