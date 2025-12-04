// app/api/setup/[companyId]/saveStep/route.ts
// Save a single step's data to the Context Graph

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { setDomainFields, createProvenance } from '@/lib/contextGraph/mutate';
import { SetupFormData, SetupStepId } from '@/app/c/[companyId]/setup/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const { stepId, data, companyName } = body as {
      stepId: SetupStepId;
      data: Partial<SetupFormData>;
      companyName: string;
    };

    // Get or create context graph
    let graph = await getOrCreateContextGraph(companyId, companyName);

    // Create provenance for this save
    const provenance = createProvenance('setup_wizard', {
      confidence: 1.0,
    });

    // Map step data to context graph domains
    graph = mapStepToGraph(graph, stepId, data, provenance);

    // Save to database
    const result = await saveContextGraph(graph);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to save context graph' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Save step error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Map form data to context graph domains based on step
// Note: setDomainFields expects raw values, not wrapped { value, provenance } objects
// We use type assertions for enum fields since form data uses generic strings
function mapStepToGraph(
  graph: ReturnType<typeof getOrCreateContextGraph> extends Promise<infer T> ? T : never,
  stepId: SetupStepId,
  data: Partial<SetupFormData>,
  provenance: ReturnType<typeof createProvenance>
) {
  switch (stepId) {
    case 'business-identity':
      if (data.businessIdentity) {
        graph = setDomainFields(graph, 'identity', {
          businessName: data.businessIdentity.businessName || undefined,
          industry: data.businessIdentity.industry || undefined,
          businessModel: (data.businessIdentity.businessModel || undefined) as any,
          revenueModel: data.businessIdentity.revenueModel || undefined,
          geographicFootprint: data.businessIdentity.geographicFootprint || undefined,
          serviceArea: data.businessIdentity.serviceArea || undefined,
          seasonalityNotes: data.businessIdentity.seasonalityNotes || undefined,
          peakSeasons: data.businessIdentity.peakSeasons || [],
          revenueStreams: data.businessIdentity.revenueStreams || [],
          primaryCompetitors: data.businessIdentity.primaryCompetitors || [],
        }, provenance);
      }
      break;

    case 'objectives':
      if (data.objectives) {
        graph = setDomainFields(graph, 'objectives', {
          primaryObjective: (data.objectives.primaryObjective || undefined) as any,
          secondaryObjectives: (data.objectives.secondaryObjectives || []) as any,
          primaryBusinessGoal: data.objectives.primaryBusinessGoal || undefined,
          timeHorizon: (data.objectives.timeHorizon || undefined) as any,
          targetCpa: data.objectives.targetCpa ?? undefined,
          targetRoas: data.objectives.targetRoas ?? undefined,
          revenueGoal: data.objectives.revenueGoal ?? undefined,
          leadGoal: data.objectives.leadGoal ?? undefined,
          kpiLabels: data.objectives.kpiLabels || [],
        }, provenance);
      }
      break;

    case 'audience':
      if (data.audience) {
        graph = setDomainFields(graph, 'audience', {
          coreSegments: data.audience.coreSegments || [],
          demographics: data.audience.demographics || undefined,
          geos: data.audience.geos || undefined,
          primaryMarkets: data.audience.primaryMarkets || [],
          behavioralDrivers: data.audience.behavioralDrivers || [],
          demandStates: data.audience.demandStates || [],
          painPoints: data.audience.painPoints || [],
          motivations: data.audience.motivations || [],
        }, provenance);
      }
      break;

    case 'personas':
      // Personas are stored via Audience Lab - persona count is just informational
      // Actual personas are linked via personaNames in the audience domain
      break;

    case 'website':
      if (data.website) {
        graph = setDomainFields(graph, 'website', {
          websiteSummary: data.website.websiteSummary || undefined,
          conversionBlocks: data.website.conversionBlocks || [],
          conversionOpportunities: data.website.conversionOpportunities || [],
          criticalIssues: data.website.criticalIssues || [],
          quickWins: data.website.quickWins || [],
        }, provenance);
      }
      break;

    case 'media-foundations':
      if (data.mediaFoundations) {
        graph = setDomainFields(graph, 'performanceMedia', {
          mediaSummary: data.mediaFoundations.mediaSummary || undefined,
          activeChannels: (data.mediaFoundations.activeChannels || []) as any,
          attributionModel: data.mediaFoundations.attributionModel || undefined,
          mediaIssues: data.mediaFoundations.mediaIssues || [],
          mediaOpportunities: data.mediaFoundations.mediaOpportunities || [],
        }, provenance);
      }
      break;

    case 'budget-scenarios':
      if (data.budgetScenarios) {
        graph = setDomainFields(graph, 'budgetOps', {
          totalMarketingBudget: data.budgetScenarios.totalMarketingBudget ?? undefined,
          mediaSpendBudget: data.budgetScenarios.mediaSpendBudget ?? undefined,
          budgetPeriod: (data.budgetScenarios.budgetPeriod || undefined) as any,
          avgCustomerValue: data.budgetScenarios.avgCustomerValue ?? undefined,
          customerLTV: data.budgetScenarios.customerLTV ?? undefined,
        }, provenance);
      }
      break;

    case 'creative-strategy':
      if (data.creativeStrategy) {
        graph = setDomainFields(graph, 'creative', {
          coreMessages: data.creativeStrategy.coreMessages || [],
          proofPoints: data.creativeStrategy.proofPoints || [],
          callToActions: data.creativeStrategy.callToActions || [],
          availableFormats: (data.creativeStrategy.availableFormats || []) as any,
          brandGuidelines: data.creativeStrategy.brandGuidelines || undefined,
        }, provenance);
      }
      break;

    case 'measurement':
      if (data.measurement) {
        graph = setDomainFields(graph, 'digitalInfra', {
          ga4PropertyId: data.measurement.ga4PropertyId || undefined,
          ga4ConversionEvents: data.measurement.ga4ConversionEvents || [],
          callTracking: data.measurement.callTracking || undefined,
          trackingTools: data.measurement.trackingTools || [],
          attributionModel: data.measurement.attributionModel || undefined,
          attributionWindow: data.measurement.attributionWindow || undefined,
        }, provenance);
      }
      break;

    case 'summary':
      // Summary step generates narrative but doesn't write new fields
      // The summary is captured during finalize
      break;
  }

  return graph;
}
