// app/api/os/companies/[companyId]/creative/work/route.ts
// API endpoint for creating Work items from Creative Lab output
//
// Supports creating:
// - Experiments from testing plans
// - Asset briefs from asset specs

import { NextRequest, NextResponse } from 'next/server';
import { createWorkItem } from '@/lib/airtable/workItems';
import type { WorkSource, WorkSourceCreativeLab, WorkItemArea, WorkItemSeverity } from '@/lib/types/work';
import type { TestingRoadmapItem, AssetSpec, CampaignConceptExtended } from '@/lib/contextGraph/domains/creative';

export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface CreateExperimentRequest {
  type: 'experiment';
  testingRoadmapItem: TestingRoadmapItem;
  campaignConceptName?: string;
  runId?: string;
}

interface CreateAssetBriefRequest {
  type: 'asset_brief';
  assetSpec: AssetSpec;
  runId?: string;
}

interface CreateFromConceptRequest {
  type: 'from_concept';
  campaignConcept: CampaignConceptExtended;
  runId?: string;
}

type CreateWorkRequest = CreateExperimentRequest | CreateAssetBriefRequest | CreateFromConceptRequest;

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const body: CreateWorkRequest = await request.json();

    console.log('[CreativeLabWork] Creating work item:', body.type);

    let workItem;

    switch (body.type) {
      case 'experiment':
        workItem = await createExperimentWorkItem(companyId, body);
        break;
      case 'asset_brief':
        workItem = await createAssetBriefWorkItem(companyId, body);
        break;
      case 'from_concept':
        workItem = await createFromConceptWorkItems(companyId, body);
        break;
      default:
        return NextResponse.json({ error: 'Invalid work item type' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      workItem,
    });
  } catch (error) {
    console.error('[CreativeLabWork] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create work item' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Work Item Creation Functions
// ============================================================================

async function createExperimentWorkItem(
  companyId: string,
  body: CreateExperimentRequest
) {
  const { testingRoadmapItem, campaignConceptName, runId } = body;

  const title = `[Experiment] ${testingRoadmapItem.name}`;

  const notes = buildExperimentNotes(testingRoadmapItem, campaignConceptName);

  const source: WorkSourceCreativeLab = {
    sourceType: 'creative_lab',
    runId,
    itemType: 'experiment',
    itemId: testingRoadmapItem.id,
  };

  // Map priority
  const severityMap: Record<string, WorkItemSeverity> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  // Map effort to area (experiments typically fall under Analytics/Funnel)
  const area: WorkItemArea = 'Funnel';

  const workItem = await createWorkItem({
    title,
    notes,
    companyId,
    area,
    severity: severityMap[testingRoadmapItem.priority] || 'Medium',
    status: 'Planned',
    source: source as unknown as WorkSource,
  });

  return workItem;
}

function buildExperimentNotes(
  item: TestingRoadmapItem,
  campaignConceptName?: string
): string {
  const sections: string[] = [];

  sections.push(`## Experiment: ${item.name}`);
  sections.push(item.description);

  if (campaignConceptName) {
    sections.push(`\n**Linked Campaign:** ${campaignConceptName}`);
  }

  sections.push(`\n**Channel:** ${item.channel}`);
  if (item.segment) {
    sections.push(`**Target Segment:** ${item.segment}`);
  }

  sections.push(`\n### Hypotheses`);
  for (const h of item.hypotheses) {
    sections.push(`- ${h}`);
  }

  sections.push(`\n### Success Metrics`);
  for (const m of item.successMetrics) {
    sections.push(`- ${m}`);
  }

  sections.push(`\n**Expected Impact:** ${item.expectedImpact}`);
  sections.push(`**Effort:** ${item.effort}`);
  sections.push(`**Priority:** ${item.priority}`);

  if (item.dependsOn?.length) {
    sections.push(`\n**Dependencies:** ${item.dependsOn.join(', ')}`);
  }

  return sections.join('\n');
}

async function createAssetBriefWorkItem(
  companyId: string,
  body: CreateAssetBriefRequest
) {
  const { assetSpec, runId } = body;

  const title = `[Asset Brief] ${assetSpec.assetType} for ${assetSpec.campaignConceptName}`;

  const notes = buildAssetBriefNotes(assetSpec);

  const source: WorkSourceCreativeLab = {
    sourceType: 'creative_lab',
    runId,
    itemType: 'asset_brief',
    itemId: assetSpec.id,
  };

  // Map priority
  const severityMap: Record<string, WorkItemSeverity> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  // Asset briefs typically fall under Content or Brand
  const area: WorkItemArea = 'Content';

  const workItem = await createWorkItem({
    title,
    notes,
    companyId,
    area,
    severity: severityMap[assetSpec.priority] || 'Medium',
    status: 'Planned',
    source: source as unknown as WorkSource,
  });

  return workItem;
}

function buildAssetBriefNotes(spec: AssetSpec): string {
  const sections: string[] = [];

  sections.push(`## Asset Brief: ${spec.assetType}`);
  sections.push(`**Campaign:** ${spec.campaignConceptName}`);
  sections.push(`**Channel:** ${spec.channel}`);

  if (spec.territoryName) {
    sections.push(`**Creative Territory:** ${spec.territoryName}`);
  }
  if (spec.segment) {
    sections.push(`**Target Segment:** ${spec.segment}`);
  }

  sections.push(`\n### Specifications`);
  if (spec.specs.dimensions) {
    sections.push(`- **Dimensions:** ${spec.specs.dimensions}`);
  }
  if (spec.specs.duration) {
    sections.push(`- **Duration:** ${spec.specs.duration}`);
  }
  if (spec.specs.fileFormat) {
    sections.push(`- **Format:** ${spec.specs.fileFormat}`);
  }
  if (spec.specs.maxFileSize) {
    sections.push(`- **Max File Size:** ${spec.specs.maxFileSize}`);
  }
  if (spec.specs.platformRequirements?.length) {
    sections.push(`- **Platform Requirements:**`);
    for (const req of spec.specs.platformRequirements) {
      sections.push(`  - ${req}`);
    }
  }

  sections.push(`\n### Copy Slots`);
  for (const slot of spec.copySlots) {
    sections.push(`\n**${slot.name}**${slot.maxChars ? ` (max ${slot.maxChars} chars)` : ''}`);
    sections.push(`> ${slot.suggestedCopy}`);
    if (slot.alternatives?.length) {
      sections.push(`Alternatives:`);
      for (const alt of slot.alternatives) {
        sections.push(`- ${alt}`);
      }
    }
  }

  sections.push(`\n### Visual Direction`);
  sections.push(spec.visualNotes);

  sections.push(`\n**Priority:** ${spec.priority}`);

  return sections.join('\n');
}

async function createFromConceptWorkItems(
  companyId: string,
  body: CreateFromConceptRequest
) {
  const { campaignConcept, runId } = body;

  const title = `[Campaign] ${campaignConcept.name}`;

  const sections: string[] = [];
  sections.push(`## Campaign Concept: ${campaignConcept.name}`);
  sections.push(`\n**Insight:** ${campaignConcept.insight}`);
  sections.push(`\n**Concept:** ${campaignConcept.concept}`);

  sections.push(`\n### Example Ads`);
  for (const ad of campaignConcept.exampleAds) {
    sections.push(`- ${ad}`);
  }

  sections.push(`\n### Channels`);
  sections.push(campaignConcept.channels.join(', '));

  sections.push(`\n### Measurement`);
  for (const m of campaignConcept.measurement) {
    sections.push(`- ${m}`);
  }

  if (campaignConcept.testingPlan) {
    sections.push(`\n### Testing Plan`);
    sections.push(`**Hypotheses:**`);
    for (const h of campaignConcept.testingPlan.hypotheses) {
      sections.push(`- ${h}`);
    }
    sections.push(`\n**Metrics:** ${campaignConcept.testingPlan.metrics.join(', ')}`);

    if (campaignConcept.testingPlan.targetKPIs) {
      sections.push(`\n**Target KPIs:**`);
      for (const [kpi, target] of Object.entries(campaignConcept.testingPlan.targetKPIs)) {
        sections.push(`- ${kpi}: ${target}`);
      }
    }
  }

  const notes = sections.join('\n');

  const source: WorkSourceCreativeLab = {
    sourceType: 'creative_lab',
    runId,
    itemType: 'campaign_concept',
    itemId: campaignConcept.name,
  };

  const workItem = await createWorkItem({
    title,
    notes,
    companyId,
    area: 'Content',
    severity: 'High',
    status: 'Planned',
    source: source as unknown as WorkSource,
  });

  return workItem;
}
