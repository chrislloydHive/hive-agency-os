// app/api/os/companies/[companyId]/rfps/[rfpId]/sections/[sectionKey]/generate/route.ts
// Generate AI content for a specific RFP section
//
// Uses Firm Brain + company context + section contracts to generate draft content.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  getRfpById,
  getRfpSectionByKey,
  getRfpBindings,
  updateRfpSection,
} from '@/lib/airtable/rfp';
import {
  getFirmBrainSnapshot,
  getTeamMemberById,
  getCaseStudyById,
  getReferenceById,
  getPricingTemplateById,
  getPlanTemplateById,
} from '@/lib/airtable/firmBrain';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { buildRfpSectionPrompt } from '@/lib/os/ai/buildRfpSectionPrompt';
import type { RfpSectionKey, GeneratedUsing } from '@/lib/types/rfp';
import type {
  TeamMember,
  CaseStudy,
  Reference,
  PricingTemplate,
  PlanTemplate,
} from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string; rfpId: string; sectionKey: string }>;
}

const VALID_SECTION_KEYS: RfpSectionKey[] = [
  'agency_overview',
  'approach',
  'team',
  'work_samples',
  'plan_timeline',
  'pricing',
  'references',
];

/**
 * POST /api/os/companies/[companyId]/rfps/[rfpId]/sections/[sectionKey]/generate
 * Generate AI content for a specific RFP section
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, rfpId, sectionKey } = await params;

    // Validate section key
    if (!VALID_SECTION_KEYS.includes(sectionKey as RfpSectionKey)) {
      return NextResponse.json({ error: 'Invalid section key' }, { status: 400 });
    }

    const typedSectionKey = sectionKey as RfpSectionKey;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const regenerate = body.regenerate === true;

    // Load RFP and section
    const [rfp, section] = await Promise.all([
      getRfpById(rfpId),
      getRfpSectionByKey(rfpId, typedSectionKey),
    ]);

    if (!rfp) {
      return NextResponse.json({ error: 'RFP not found' }, { status: 404 });
    }

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Check if content already exists and regenerate is not requested
    if (section.contentWorking && !regenerate) {
      return NextResponse.json({
        error: 'Section already has content. Set regenerate=true to override.',
        section,
      }, { status: 400 });
    }

    // Load Firm Brain snapshot and bindings
    const [firmBrain, bindings] = await Promise.all([
      getFirmBrainSnapshot(),
      getRfpBindings(rfpId),
    ]);

    // Load bound resources
    const boundResources = await loadBoundResources(bindings);

    // Load company context from Context Graph
    const companyContext = await loadCompanyContext(companyId);

    // Build RFP context
    const rfpContext = {
      title: rfp.title,
      scopeSummary: rfp.scopeSummary || undefined,
      requirementsChecklist: rfp.requirementsChecklist,
      dueDate: rfp.dueDate || undefined,
      selectedPath: rfp.selectedPath,
    };

    // Build the prompt
    const promptResult = buildRfpSectionPrompt({
      sectionKey: typedSectionKey,
      firmBrain,
      boundResources,
      companyContext,
      rfpContext,
      currentContent: regenerate ? section.contentWorking || undefined : undefined,
    });

    // Check if we can generate
    if (!promptResult.generatedUsing.canGenerate) {
      return NextResponse.json({
        error: 'Cannot generate section: ' + promptResult.generatedUsing.blockingReason,
        generatedUsing: promptResult.generatedUsing,
        validationWarnings: promptResult.validationWarnings,
      }, { status: 400 });
    }

    // Call Claude
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: promptResult.systemPrompt + '\n\n' + promptResult.userPrompt },
      ],
    });

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed: { content: string; confidence: string; warnings: string[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[rfp/generate] Failed to parse AI response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: responseText },
        { status: 500 }
      );
    }

    // Build generatedUsing metadata for staleness tracking
    const generatedUsing: GeneratedUsing = {
      firmBrainVersion: new Date().toISOString(),
      agencyProfileUpdatedAt: firmBrain.agencyProfile?.updatedAt || undefined,
      teamMemberIds: boundResources.teamMembers.map(t => t.id),
      caseStudyIds: boundResources.caseStudies.map(c => c.id),
      referenceIds: boundResources.references.map(r => r.id),
      pricingTemplateId: boundResources.pricingTemplate?.id,
      planTemplateId: boundResources.planTemplate?.id,
      scopeSummaryHash: hashString(rfp.scopeSummary || ''),
    };

    // Update the section with generated content
    const now = new Date().toISOString();
    const updatedSection = await updateRfpSection(section.id, {
      contentWorking: parsed.content,
      status: 'draft',
      sourceType: 'generated',
      generatedUsing,
      needsReview: true,
      lastGeneratedAt: now,
      isStale: false,
      staleReason: null,
    });

    if (!updatedSection) {
      return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      section: updatedSection,
      generatedUsing: promptResult.generatedUsing,
      aiConfidence: parsed.confidence,
      aiWarnings: parsed.warnings || [],
      validationWarnings: promptResult.validationWarnings,
    });
  } catch (error) {
    console.error('[POST rfp/generate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate section' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

interface BoundResources {
  teamMembers: TeamMember[];
  caseStudies: CaseStudy[];
  references: Reference[];
  pricingTemplate?: PricingTemplate;
  planTemplate?: PlanTemplate;
}

async function loadBoundResources(
  bindings: Awaited<ReturnType<typeof getRfpBindings>>
): Promise<BoundResources> {
  if (!bindings) {
    return {
      teamMembers: [],
      caseStudies: [],
      references: [],
    };
  }

  // Load all bound resources in parallel
  const [teamMembers, caseStudies, references, pricingTemplate, planTemplate] = await Promise.all([
    Promise.all(bindings.teamMemberIds.map(id => getTeamMemberById(id))),
    Promise.all(bindings.caseStudyIds.map(id => getCaseStudyById(id))),
    Promise.all(bindings.referenceIds.map(id => getReferenceById(id))),
    bindings.pricingTemplateId ? getPricingTemplateById(bindings.pricingTemplateId) : null,
    bindings.planTemplateId ? getPlanTemplateById(bindings.planTemplateId) : null,
  ]);

  return {
    teamMembers: teamMembers.filter((t): t is TeamMember => t !== null),
    caseStudies: caseStudies.filter((c): c is CaseStudy => c !== null),
    references: references.filter((r): r is Reference => r !== null),
    pricingTemplate: pricingTemplate || undefined,
    planTemplate: planTemplate || undefined,
  };
}

interface CompanyContext {
  companyName: string;
  industry?: string;
  businessModel?: string;
  icpDescription?: string;
  valueProposition?: string;
  positioning?: string;
  goalStatement?: string;
}

async function loadCompanyContext(companyId: string): Promise<CompanyContext> {
  try {
    const contextGraph = await loadContextGraph(companyId);

    if (!contextGraph) {
      return { companyName: 'Unknown Company' };
    }

    // Extract values from context graph
    const getValue = (domain: string, field: string): string | undefined => {
      const domainData = (contextGraph as Record<string, unknown>)[domain];
      if (!domainData || typeof domainData !== 'object') return undefined;
      const fieldData = (domainData as Record<string, unknown>)[field];
      if (!fieldData || typeof fieldData !== 'object') return undefined;
      const value = (fieldData as Record<string, unknown>).value;
      return typeof value === 'string' ? value : undefined;
    };

    return {
      companyName: getValue('identity', 'businessName') || 'Unknown Company',
      industry: getValue('identity', 'industry'),
      businessModel: getValue('identity', 'businessModel'),
      icpDescription: getValue('audience', 'icpDescription'),
      valueProposition: getValue('productOffer', 'valueProposition'),
      positioning: getValue('brand', 'positioning'),
    };
  } catch (error) {
    console.warn('[rfp/generate] Failed to load context graph:', error);
    return { companyName: 'Unknown Company' };
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
