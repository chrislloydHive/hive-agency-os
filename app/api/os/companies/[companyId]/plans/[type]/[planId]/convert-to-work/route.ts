// app/api/os/companies/[companyId]/plans/[type]/[planId]/convert-to-work/route.ts
// Convert an approved plan to Work Items
//
// POST /api/os/companies/[companyId]/plans/[type]/[planId]/convert-to-work
//
// Validates:
// - Plan exists and belongs to company
// - Plan status is 'approved' (not draft, in_review, or archived)
// - Idempotency: skips work items that already exist (via work key matching)
//
// Returns:
// - Created work items
// - Skipped work keys (for transparency)
// - Stats on conversion

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getMediaPlanById,
  getContentPlanById,
} from '@/lib/airtable/heavyPlans';
import {
  getExistingWorkKeysForPlan,
  createWorkItemsFromHeavyPlan,
  attachArtifactToWorkItem,
  type HeavyPlanWorkItemInput,
} from '@/lib/airtable/workItems';
import { getArtifactById, getArtifactsForCompany } from '@/lib/airtable/artifacts';
import {
  convertPlanToWorkItems,
  validatePlanForConversion,
  getConversionBreakdown,
  type ConvertedWorkItem,
} from '@/lib/os/plans/convert';
import { createArtifactSnapshot } from '@/lib/types/work';
import type { PlanType, MediaPlan, ContentPlan } from '@/lib/types/plan';
import type { Artifact } from '@/lib/types/artifact';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; type: string; planId: string }> };

// ============================================================================
// Validation Schemas
// ============================================================================

const PlanTypeSchema = z.enum(['media', 'content']);

const ConvertBodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  /** Optional artifact IDs to attach to all created work items */
  attachArtifactIds: z.array(z.string()).optional(),
}).optional();

// ============================================================================
// POST - Convert plan to work items
// ============================================================================

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type, planId } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Parse optional body
    let dryRun = false;
    let attachArtifactIds: string[] = [];
    try {
      const body = await request.json();
      const bodyResult = ConvertBodySchema.safeParse(body);
      if (bodyResult.success && bodyResult.data?.dryRun) {
        dryRun = bodyResult.data.dryRun;
      }
      if (bodyResult.success && bodyResult.data?.attachArtifactIds) {
        attachArtifactIds = bodyResult.data.attachArtifactIds;
      }
    } catch {
      // Body is optional, ignore parse errors
    }

    // Validate artifact IDs belong to company (if provided)
    let artifactsToAttach: Artifact[] = [];
    if (attachArtifactIds.length > 0 && !dryRun) {
      for (const artifactId of attachArtifactIds) {
        const artifact = await getArtifactById(artifactId);
        if (!artifact) {
          return NextResponse.json(
            { error: `Artifact not found: ${artifactId}` },
            { status: 404 }
          );
        }
        if (artifact.companyId !== companyId) {
          return NextResponse.json(
            { error: `Artifact does not belong to this company: ${artifactId}` },
            { status: 403 }
          );
        }
        artifactsToAttach.push(artifact);
      }
    }

    // Get the plan
    const plan = planType === 'media'
      ? await getMediaPlanById(planId)
      : await getContentPlanById(planId);

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (plan.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plan does not belong to this company' },
        { status: 403 }
      );
    }

    // Validate plan is ready for conversion
    const validation = validatePlanForConversion(plan);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Plan cannot be converted to work items',
          reason: validation.error,
          hint: plan.status === 'draft'
            ? 'Plan must be approved first'
            : plan.status === 'in_review'
              ? 'Plan must be approved first'
              : plan.status === 'archived'
                ? 'Archived plans cannot be converted'
                : undefined,
        },
        { status: 400 }
      );
    }

    // Get existing work keys for idempotency
    const existingWorkKeys = await getExistingWorkKeysForPlan(planId);

    // Convert plan to work items
    const conversionResult = convertPlanToWorkItems(plan, companyId, {
      existingWorkKeys,
      dryRun,
    });

    // Get breakdown by section for context
    const breakdown = getConversionBreakdown(plan, companyId);

    // If dry run, return what would be created
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        planId,
        planType,
        planVersion: plan.version,
        stats: conversionResult.stats,
        breakdown,
        skippedWorkKeys: conversionResult.skippedWorkKeys,
        itemsToCreate: conversionResult.workItemsToCreate.map((item) => ({
          title: item.title,
          area: item.area,
          severity: item.severity,
          sectionName: item.source.sectionName,
          workKey: item.source.workKey,
        })),
      });
    }

    // Skip if nothing to create
    if (conversionResult.workItemsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        planId,
        planType,
        planVersion: plan.version,
        message: conversionResult.stats.skipped > 0
          ? 'All work items already exist (skipped due to idempotency)'
          : 'No work items to create from this plan',
        stats: conversionResult.stats,
        createdWorkItems: [],
        skippedWorkKeys: conversionResult.skippedWorkKeys,
      });
    }

    // Map converted items to Airtable input format
    const workItemInputs: HeavyPlanWorkItemInput[] = conversionResult.workItemsToCreate.map(
      (item: ConvertedWorkItem) => ({
        title: item.title,
        notes: item.notes,
        area: item.area,
        severity: item.severity,
        source: item.source,
      })
    );

    // Create work items
    const createdWorkItems = await createWorkItemsFromHeavyPlan({
      companyId,
      items: workItemInputs,
    });

    // Attach artifacts to created work items (if any)
    let attachedArtifacts: { workItemId: string; artifactId: string }[] = [];
    if (artifactsToAttach.length > 0 && createdWorkItems.length > 0) {
      for (const workItem of createdWorkItems) {
        for (const artifact of artifactsToAttach) {
          try {
            const snapshot = createArtifactSnapshot(
              artifact.id,
              artifact.type,
              artifact.title,
              artifact.status
            );
            await attachArtifactToWorkItem(workItem.id, snapshot);
            attachedArtifacts.push({
              workItemId: workItem.id,
              artifactId: artifact.id,
            });
          } catch (err) {
            console.warn(`[API] Failed to attach artifact ${artifact.id} to work item ${workItem.id}:`, err);
            // Continue with other attachments - don't fail the whole request
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      planId,
      planType,
      planVersion: plan.version,
      message: `Created ${createdWorkItems.length} work items from ${planType} plan`,
      stats: {
        ...conversionResult.stats,
        created: createdWorkItems.length,
        artifactsAttached: attachedArtifacts.length,
      },
      breakdown,
      createdWorkItems: createdWorkItems.map((item) => ({
        id: item.id,
        title: item.title,
        area: item.area,
        status: item.status,
        artifacts: artifactsToAttach.map(a => ({
          id: a.id,
          title: a.title,
          type: a.type,
        })),
      })),
      skippedWorkKeys: conversionResult.skippedWorkKeys,
    });
  } catch (error) {
    console.error('[API] Plan convert-to-work error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Preview conversion (dry run convenience)
// ============================================================================

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { companyId, type, planId } = await params;

    // Validate plan type
    const typeResult = PlanTypeSchema.safeParse(type);
    if (!typeResult.success) {
      return NextResponse.json(
        { error: 'Invalid plan type. Must be "media" or "content"' },
        { status: 400 }
      );
    }

    const planType: PlanType = typeResult.data;

    // Get the plan
    const plan = planType === 'media'
      ? await getMediaPlanById(planId)
      : await getContentPlanById(planId);

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (plan.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Plan does not belong to this company' },
        { status: 403 }
      );
    }

    // Validate plan status
    const validation = validatePlanForConversion(plan);
    const existingWorkKeys = await getExistingWorkKeysForPlan(planId);
    const breakdown = getConversionBreakdown(plan, companyId);

    // Get preview even if not approved (for UI to show what would be created)
    let preview: {
      title: string;
      area: string;
      severity: string;
      sectionName: string;
      workKey: string;
    }[] = [];
    let stats = { total: 0, created: 0, skipped: 0 };
    let skippedWorkKeys: string[] = [];

    if (plan.status === 'approved') {
      const conversionResult = convertPlanToWorkItems(plan, companyId, {
        existingWorkKeys,
        dryRun: true,
      });
      stats = conversionResult.stats;
      skippedWorkKeys = conversionResult.skippedWorkKeys;
      preview = conversionResult.workItemsToCreate.map((item) => ({
        title: item.title,
        area: item.area,
        severity: item.severity,
        sectionName: item.source.sectionName,
        workKey: item.source.workKey,
      }));
    }

    return NextResponse.json({
      planId,
      planType,
      planVersion: plan.version,
      planStatus: plan.status,
      canConvert: validation.valid,
      cannotConvertReason: validation.error,
      existingWorkItemCount: existingWorkKeys.size,
      stats,
      breakdown,
      skippedWorkKeys,
      preview,
    });
  } catch (error) {
    console.error('[API] Plan convert-to-work preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
