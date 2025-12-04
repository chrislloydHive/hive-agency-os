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
          businessName: { value: data.businessIdentity.businessName, provenance: [provenance] },
          industry: { value: data.businessIdentity.industry, provenance: [provenance] },
          businessModel: { value: data.businessIdentity.businessModel, provenance: [provenance] },
          revenueModel: { value: data.businessIdentity.revenueModel, provenance: [provenance] },
          geographicFootprint: { value: data.businessIdentity.geographicFootprint, provenance: [provenance] },
          serviceArea: { value: data.businessIdentity.serviceArea, provenance: [provenance] },
          seasonalityNotes: { value: data.businessIdentity.seasonalityNotes, provenance: [provenance] },
          peakSeasons: { value: data.businessIdentity.peakSeasons, provenance: [provenance] },
          revenueStreams: { value: data.businessIdentity.revenueStreams, provenance: [provenance] },
          primaryCompetitors: { value: data.businessIdentity.primaryCompetitors, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'objectives':
      if (data.objectives) {
        graph = setDomainFields(graph, 'objectives', {
          primaryObjective: { value: data.objectives.primaryObjective, provenance: [provenance] },
          secondaryObjectives: { value: data.objectives.secondaryObjectives, provenance: [provenance] },
          primaryBusinessGoal: { value: data.objectives.primaryBusinessGoal, provenance: [provenance] },
          timeHorizon: { value: data.objectives.timeHorizon, provenance: [provenance] },
          targetCpa: { value: data.objectives.targetCpa, provenance: [provenance] },
          targetRoas: { value: data.objectives.targetRoas, provenance: [provenance] },
          revenueGoal: { value: data.objectives.revenueGoal, provenance: [provenance] },
          leadGoal: { value: data.objectives.leadGoal, provenance: [provenance] },
          kpiLabels: { value: data.objectives.kpiLabels, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'audience':
      if (data.audience) {
        graph = setDomainFields(graph, 'audience', {
          coreSegments: { value: data.audience.coreSegments, provenance: [provenance] },
          demographics: { value: data.audience.demographics, provenance: [provenance] },
          geos: { value: data.audience.geos, provenance: [provenance] },
          primaryMarkets: { value: data.audience.primaryMarkets, provenance: [provenance] },
          behavioralDrivers: { value: data.audience.behavioralDrivers, provenance: [provenance] },
          demandStates: { value: data.audience.demandStates, provenance: [provenance] },
          painPoints: { value: data.audience.painPoints, provenance: [provenance] },
          motivations: { value: data.audience.motivations, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'website':
      if (data.website) {
        graph = setDomainFields(graph, 'website', {
          websiteSummary: { value: data.website.websiteSummary, provenance: [provenance] },
          conversionBlocks: { value: data.website.conversionBlocks, provenance: [provenance] },
          conversionOpportunities: { value: data.website.conversionOpportunities, provenance: [provenance] },
          criticalIssues: { value: data.website.criticalIssues, provenance: [provenance] },
          quickWins: { value: data.website.quickWins, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'media-foundations':
      if (data.mediaFoundations) {
        graph = setDomainFields(graph, 'performanceMedia', {
          mediaSummary: { value: data.mediaFoundations.mediaSummary, provenance: [provenance] },
          activeChannels: { value: data.mediaFoundations.activeChannels, provenance: [provenance] },
          attributionModel: { value: data.mediaFoundations.attributionModel, provenance: [provenance] },
          mediaIssues: { value: data.mediaFoundations.mediaIssues, provenance: [provenance] },
          mediaOpportunities: { value: data.mediaFoundations.mediaOpportunities, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'budget-scenarios':
      if (data.budgetScenarios) {
        graph = setDomainFields(graph, 'budgetOps', {
          totalMarketingBudget: { value: data.budgetScenarios.totalMarketingBudget, provenance: [provenance] },
          mediaSpendBudget: { value: data.budgetScenarios.mediaSpendBudget, provenance: [provenance] },
          budgetPeriod: { value: data.budgetScenarios.budgetPeriod, provenance: [provenance] },
          avgCustomerValue: { value: data.budgetScenarios.avgCustomerValue, provenance: [provenance] },
          customerLTV: { value: data.budgetScenarios.customerLTV, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'creative-strategy':
      if (data.creativeStrategy) {
        graph = setDomainFields(graph, 'creative', {
          coreMessages: { value: data.creativeStrategy.coreMessages, provenance: [provenance] },
          proofPoints: { value: data.creativeStrategy.proofPoints, provenance: [provenance] },
          callToActions: { value: data.creativeStrategy.callToActions, provenance: [provenance] },
          availableFormats: { value: data.creativeStrategy.availableFormats, provenance: [provenance] },
          brandGuidelines: { value: data.creativeStrategy.brandGuidelines, provenance: [provenance] },
        }, provenance);
      }
      break;

    case 'measurement':
      if (data.measurement) {
        graph = setDomainFields(graph, 'digitalInfra', {
          ga4PropertyId: { value: data.measurement.ga4PropertyId, provenance: [provenance] },
          ga4ConversionEvents: { value: data.measurement.ga4ConversionEvents, provenance: [provenance] },
          callTracking: { value: data.measurement.callTracking, provenance: [provenance] },
          trackingTools: { value: data.measurement.trackingTools, provenance: [provenance] },
          attributionModel: { value: data.measurement.attributionModel, provenance: [provenance] },
          attributionWindow: { value: data.measurement.attributionWindow, provenance: [provenance] },
        }, provenance);
      }
      break;

    // Personas and Summary are handled separately
    case 'personas':
    case 'summary':
      // These steps don't directly map to context graph fields
      break;
  }

  return graph;
}
