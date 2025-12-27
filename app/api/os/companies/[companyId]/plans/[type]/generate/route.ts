// app/api/os/companies/[companyId]/plans/[type]/generate/route.ts
// AI-powered plan generation endpoint
//
// POST /api/os/companies/[companyId]/plans/[type]/generate
// Modes:
// - create: Generate a new draft plan
// - refresh: Generate updated draft based on changes (creates new draft + proposal)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createMediaPlan,
  createContentPlan,
  getApprovedPlan,
  getMediaPlanById,
  getContentPlanById,
} from '@/lib/airtable/heavyPlans';
import { createPlanProposal } from '@/lib/airtable/planProposals';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getActiveStrategy } from '@/lib/os/strategy';
import {
  computeContextHash,
  computeStrategyHash,
  computeSourceSnapshot,
} from '@/lib/os/plans/planSnapshots';
import { buildPlanInputs } from '@/lib/os/plans/ai/buildPlanInputs';
import { generatePlanDraft } from '@/lib/os/plans/ai/generatePlanDraft';
import type { PlanType, MediaPlanSections, ContentPlanSections } from '@/lib/types/plan';

export const maxDuration = 120; // 2 minutes for AI generation

type Params = { params: Promise<{ companyId: string; type: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const GenerateRequestSchema = z.object({
  mode: z.enum(['create', 'refresh']).default('create'),
  existingPlanId: z.string().optional(),
  strategyId: z.string().optional(),
});

// ============================================================================
// POST - Generate plan draft
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const parseResult = GenerateRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { mode, existingPlanId, strategyId: requestStrategyId } = parseResult.data;

    console.log(`[generatePlan] Starting ${mode} for ${planType} plan, company ${companyId}`);

    // Load context and strategy
    const context = await loadContextGraph(companyId);
    const strategy = await getActiveStrategy(companyId);

    if (!strategy) {
      return NextResponse.json(
        {
          error: 'No active strategy found',
          hint: 'Create and lock a strategy before generating plans',
        },
        { status: 400 }
      );
    }

    const strategyId = requestStrategyId || strategy.id;

    // For refresh mode, load existing plan
    let existingPlanSummary: string | undefined;
    let existingPlan = null;

    if (mode === 'refresh') {
      // Get the existing plan to refresh
      if (existingPlanId) {
        existingPlan = planType === 'media'
          ? await getMediaPlanById(existingPlanId)
          : await getContentPlanById(existingPlanId);
      } else {
        // Find the approved plan to base refresh on
        existingPlan = await getApprovedPlan(planType, companyId, strategyId);
      }

      if (existingPlan) {
        existingPlanSummary = summarizePlan(existingPlan.sections, planType);
      }
    }

    // Build inputs for AI
    const inputs = buildPlanInputs(
      context,
      strategy,
      planType,
      mode,
      existingPlanSummary
    );

    // Generate plan draft using AI
    console.log(`[generatePlan] Calling AI to generate ${planType} plan...`);
    const generated = await generatePlanDraft(companyId, inputs);

    // Compute source snapshot for staleness tracking
    const sourceSnapshot = computeSourceSnapshot(context, strategy);

    // Create the new draft plan
    console.log(`[generatePlan] Creating draft plan...`);

    const planData = {
      companyId,
      strategyId,
      status: 'draft' as const,
      version: 1,
      sections: generated.sections,
    };

    const newPlan = planType === 'media'
      ? await createMediaPlan(planData as Parameters<typeof createMediaPlan>[0], sourceSnapshot)
      : await createContentPlan(planData as Parameters<typeof createContentPlan>[0], sourceSnapshot);

    if (!newPlan) {
      return NextResponse.json(
        { error: 'Failed to create plan' },
        { status: 500 }
      );
    }

    // For refresh mode, also create a proposal linking back to the source plan
    let proposal = null;
    if (mode === 'refresh' && existingPlan) {
      console.log(`[generatePlan] Creating proposal for refresh...`);

      proposal = await createPlanProposal({
        planType,
        planId: existingPlan.id,
        companyId,
        strategyId,
        proposedPatch: {
          op: 'full_replacement',
          newPlanId: newPlan.id,
          sections: generated.sections,
        },
        rationale: generated.rationale,
        warnings: generated.warnings,
        generatedUsing: {
          contextKeysUsed: generated.inputsUsed.filter(k => k.startsWith('context.')),
          strategyKeysUsed: generated.inputsUsed.filter(k => k.startsWith('strategy.')),
          goalAlignmentActive: Boolean(strategy.goalStatement),
          businessDefinitionMissing: !context || Object.keys(context).length === 0,
        },
      });
    }

    return NextResponse.json({
      plan: newPlan,
      proposal,
      generation: {
        rationale: generated.rationale,
        warnings: generated.warnings,
        inputsUsed: generated.inputsUsed,
      },
    });
  } catch (error) {
    console.error('[API] Plan generation error:', error);
    return NextResponse.json(
      {
        error: 'Plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Create a summary of an existing plan for context
 */
function summarizePlan(
  sections: MediaPlanSections | ContentPlanSections,
  planType: PlanType
): string {
  const parts: string[] = [];

  if (planType === 'media') {
    const media = sections as MediaPlanSections;
    if (media.summary?.executiveSummary) {
      parts.push(`Executive Summary: ${media.summary.executiveSummary}`);
    }
    if (media.budget?.totalMonthly) {
      parts.push(`Budget: $${media.budget.totalMonthly}/month`);
    }
    if (media.channelMix?.length) {
      parts.push(`Channels: ${media.channelMix.map(c => c.channel).join(', ')}`);
    }
    if (media.campaigns?.length) {
      parts.push(`Campaigns: ${media.campaigns.length}`);
    }
  } else {
    const content = sections as ContentPlanSections;
    if (content.summary?.editorialThesis) {
      parts.push(`Editorial Thesis: ${content.summary.editorialThesis}`);
    }
    if (content.pillars?.length) {
      parts.push(`Pillars: ${content.pillars.map(p => p.pillar).join(', ')}`);
    }
    if (content.calendar?.length) {
      parts.push(`Calendar Items: ${content.calendar.length}`);
    }
    if (content.distribution?.channels?.length) {
      parts.push(`Distribution: ${content.distribution.channels.map(c => c.channel).join(', ')}`);
    }
  }

  return parts.join('\n');
}
