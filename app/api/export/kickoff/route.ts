// app/api/export/kickoff/route.ts
// Export Kickoff Pack after Strategic Setup Mode completion

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getWorkItems } from '@/lib/work/workItems';

interface ExportKickoffBody {
  companyId: string;
  format?: 'json' | 'markdown';
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportKickoffBody = await request.json();
    const { companyId, format = 'json' } = body;

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

    // Load work items created from setup
    const workItems = await getWorkItems(companyId);
    const setupWorkItems = workItems.filter(
      (item) => item.notes?.includes('setup_wizard') || item.notes?.includes('Strategic Setup')
    );

    // Build kickoff pack
    const kickoffPack = {
      meta: {
        companyId,
        companyName: graph.identity.businessName.value || 'Unknown',
        generatedAt: new Date().toISOString(),
        graphVersion: graph.meta.version,
        completenessScore: graph.meta.completenessScore,
      },

      businessIdentity: {
        name: graph.identity.businessName.value,
        industry: graph.identity.industry.value,
        businessModel: graph.identity.businessModel.value,
        revenueModel: graph.identity.revenueModel.value,
        geographicFootprint: graph.identity.geographicFootprint.value,
        serviceArea: graph.identity.serviceArea.value,
        seasonality: graph.identity.seasonalityNotes.value,
        peakSeasons: graph.identity.peakSeasons.value,
        competitors: graph.identity.primaryCompetitors.value,
      },

      objectives: {
        primary: graph.objectives.primaryObjective.value,
        secondary: graph.objectives.secondaryObjectives.value,
        businessGoal: graph.objectives.primaryBusinessGoal.value,
        timeHorizon: graph.objectives.timeHorizon.value,
        kpis: {
          targetCpa: graph.objectives.targetCpa.value,
          targetRoas: graph.objectives.targetRoas.value,
          revenueGoal: graph.objectives.revenueGoal.value,
          leadGoal: graph.objectives.leadGoal.value,
        },
      },

      audience: {
        coreSegments: graph.audience.coreSegments.value,
        demographics: graph.audience.demographics.value,
        geos: graph.audience.geos.value,
        primaryMarkets: graph.audience.primaryMarkets.value,
        painPoints: graph.audience.painPoints.value,
        motivations: graph.audience.motivations.value,
        personas: graph.audience.personaNames.value,
      },

      website: {
        summary: graph.website.websiteSummary.value,
        criticalIssues: graph.website.criticalIssues.value,
        conversionBlocks: graph.website.conversionBlocks.value,
        conversionOpportunities: graph.website.conversionOpportunities.value,
        quickWins: graph.website.quickWins.value,
      },

      media: {
        summary: graph.performanceMedia.mediaSummary.value,
        activeChannels: graph.performanceMedia.activeChannels.value,
        attributionModel: graph.performanceMedia.attributionModel.value,
        issues: graph.performanceMedia.mediaIssues.value,
        opportunities: graph.performanceMedia.mediaOpportunities.value,
      },

      budget: {
        totalMarketing: graph.budgetOps.totalMarketingBudget.value,
        mediaSpend: graph.budgetOps.mediaSpendBudget.value,
        period: graph.budgetOps.budgetPeriod.value,
        avgCustomerValue: graph.budgetOps.avgCustomerValue.value,
        customerLTV: graph.budgetOps.customerLTV.value,
      },

      creative: {
        coreMessages: graph.creative.coreMessages.value,
        proofPoints: graph.creative.proofPoints.value,
        callToActions: graph.creative.callToActions.value,
        availableFormats: graph.creative.availableFormats.value,
        brandGuidelines: graph.creative.brandGuidelines.value,
      },

      measurement: {
        ga4PropertyId: graph.digitalInfra.ga4PropertyId.value,
        conversionEvents: graph.digitalInfra.ga4ConversionEvents.value,
        callTracking: graph.digitalInfra.callTracking.value,
        trackingTools: graph.digitalInfra.trackingTools.value,
        attributionModel: graph.digitalInfra.attributionModel.value,
        attributionWindow: graph.digitalInfra.attributionWindow.value,
      },

      workItems: setupWorkItems.map((item) => ({
        id: item.id,
        title: item.title,
        area: item.area,
        priority: item.priority,
        status: item.status,
      })),
    };

    if (format === 'markdown') {
      const markdown = generateKickoffMarkdown(kickoffPack);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="kickoff-pack-${companyId}.md"`,
        },
      });
    }

    return NextResponse.json(kickoffPack);
  } catch (error) {
    console.error('[Export] Error generating kickoff pack:', error);
    return NextResponse.json(
      { error: 'Failed to generate kickoff pack' },
      { status: 500 }
    );
  }
}

function generateKickoffMarkdown(pack: Record<string, unknown>): string {
  const meta = pack.meta as Record<string, unknown>;
  const identity = pack.businessIdentity as Record<string, unknown>;
  const objectives = pack.objectives as Record<string, unknown>;
  const audience = pack.audience as Record<string, unknown>;
  const website = pack.website as Record<string, unknown>;
  const media = pack.media as Record<string, unknown>;
  const budget = pack.budget as Record<string, unknown>;
  const creative = pack.creative as Record<string, unknown>;
  const measurement = pack.measurement as Record<string, unknown>;
  const workItems = pack.workItems as Array<Record<string, unknown>>;

  return `# Kickoff Pack: ${meta.companyName}

Generated: ${meta.generatedAt}
Graph Completeness: ${meta.completenessScore}%

---

## Business Identity

- **Industry**: ${identity.industry || 'Not specified'}
- **Business Model**: ${identity.businessModel || 'Not specified'}
- **Geographic Footprint**: ${identity.geographicFootprint || 'Not specified'}
- **Service Area**: ${identity.serviceArea || 'Not specified'}
- **Seasonality**: ${identity.seasonality || 'Not specified'}
- **Competitors**: ${(identity.competitors as string[] || []).join(', ') || 'None identified'}

---

## Objectives

- **Primary Objective**: ${(objectives.primary as string) || 'Not set'}
- **Secondary Objectives**: ${((objectives.secondary as string[]) || []).join(', ') || 'None'}
- **Time Horizon**: ${objectives.timeHorizon || 'Not specified'}

### KPIs
- Target CPA: $${(objectives.kpis as Record<string, unknown>)?.targetCpa || 'Not set'}
- Target ROAS: ${(objectives.kpis as Record<string, unknown>)?.targetRoas || 'Not set'}x
- Revenue Goal: $${(objectives.kpis as Record<string, unknown>)?.revenueGoal || 'Not set'}
- Lead Goal: ${(objectives.kpis as Record<string, unknown>)?.leadGoal || 'Not set'}

---

## Audience

- **Core Segments**: ${((audience.coreSegments as string[]) || []).join(', ') || 'None defined'}
- **Demographics**: ${audience.demographics || 'Not specified'}
- **Primary Markets**: ${((audience.primaryMarkets as string[]) || []).join(', ') || 'None'}
- **Personas**: ${((audience.personas as string[]) || []).join(', ') || 'None created'}

### Pain Points
${((audience.painPoints as string[]) || []).map(p => `- ${p}`).join('\n') || '- None identified'}

### Motivations
${((audience.motivations as string[]) || []).map(m => `- ${m}`).join('\n') || '- None identified'}

---

## Website

${website.summary || 'No summary available'}

### Critical Issues
${((website.criticalIssues as string[]) || []).map(i => `- ${i}`).join('\n') || '- None identified'}

### Quick Wins
${((website.quickWins as string[]) || []).map(w => `- ${w}`).join('\n') || '- None identified'}

---

## Media Strategy

- **Active Channels**: ${((media.activeChannels as string[]) || []).join(', ') || 'None configured'}
- **Attribution Model**: ${media.attributionModel || 'Not set'}

### Issues
${((media.issues as string[]) || []).map(i => `- ${i}`).join('\n') || '- None identified'}

### Opportunities
${((media.opportunities as string[]) || []).map(o => `- ${o}`).join('\n') || '- None identified'}

---

## Budget

- **Total Marketing Budget**: $${budget.totalMarketing || 'Not set'}
- **Media Spend**: $${budget.mediaSpend || 'Not set'}
- **Period**: ${budget.period || 'Not specified'}
- **Avg Customer Value**: $${budget.avgCustomerValue || 'Not set'}
- **Customer LTV**: $${budget.customerLTV || 'Not set'}

---

## Creative Strategy

### Core Messages
${((creative.coreMessages as string[]) || []).map(m => `- ${m}`).join('\n') || '- None defined'}

### Proof Points
${((creative.proofPoints as string[]) || []).map(p => `- ${p}`).join('\n') || '- None defined'}

### Call to Actions
${((creative.callToActions as string[]) || []).join(', ') || 'None defined'}

### Available Formats
${((creative.availableFormats as string[]) || []).join(', ') || 'None specified'}

---

## Measurement Setup

- **GA4 Property**: ${measurement.ga4PropertyId || 'Not connected'}
- **Conversion Events**: ${((measurement.conversionEvents as string[]) || []).join(', ') || 'None configured'}
- **Call Tracking**: ${measurement.callTracking || 'Not configured'}
- **Attribution Model**: ${measurement.attributionModel || 'Not set'}
- **Attribution Window**: ${measurement.attributionWindow || 'Not set'}

---

## Recommended Work Items

${workItems.length > 0 ? workItems.map((item) =>
  `- **${item.title}** (${item.area}, ${item.priority})`
).join('\n') : 'No work items created yet'}

---

*Generated by Hive OS Strategic Setup Mode*
`;
}
