// app/api/os/companies/[companyId]/engagements/[engagementId]/actions/route.ts
// Engagement status transition actions

import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementById,
  startContextGathering,
  approveContext,
  startWork,
  completeEngagement,
  resetEngagement,
} from '@/lib/airtable/engagements';
import { canTransitionStatus } from '@/lib/types/engagement';
import { createProjectStrategy, getStrategyByEngagementId } from '@/lib/os/strategy';

type ActionType =
  | 'start-context-gathering'
  | 'approve-context'
  | 'start-work'
  | 'complete'
  | 'reset'
  | 'create-strategy'; // Manual strategy creation for already-approved engagements

// POST /api/os/companies/[companyId]/engagements/[engagementId]/actions
// Execute a status transition action
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  const { engagementId } = await params;

  try {
    const body = await request.json();
    const action = body.action as ActionType;

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      );
    }

    // Get current engagement
    const engagement = await getEngagementById(engagementId);

    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    // 'create-strategy' doesn't change status - skip validation for it
    if (action !== 'create-strategy') {
      // Map action to target status for validation
      const actionToTargetStatus: Record<string, string> = {
        'start-context-gathering': 'context_gathering',
        'approve-context': 'context_approved',
        'start-work': 'in_progress',
        'complete': 'completed',
        'reset': 'draft',
      };

      const targetStatus = actionToTargetStatus[action];

      if (!targetStatus) {
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
      }

      // Validate transition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!canTransitionStatus(engagement.status, targetStatus as any)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${engagement.status} to ${targetStatus}`,
            currentStatus: engagement.status,
            targetStatus,
          },
          { status: 400 }
        );
      }
    }

    let updatedEngagement;

    switch (action) {
      case 'start-context-gathering': {
        const gapRunId = body.gapRunId;
        if (!gapRunId) {
          return NextResponse.json(
            { error: 'gapRunId is required for start-context-gathering' },
            { status: 400 }
          );
        }
        updatedEngagement = await startContextGathering(engagementId, gapRunId);
        break;
      }

      case 'approve-context': {
        updatedEngagement = await approveContext(engagementId);
        console.log('[Engagements API] Approved context, engagement type:', updatedEngagement.type);

        // For project engagements, auto-create a ProjectStrategy
        let strategyId: string | undefined;
        if (updatedEngagement.type === 'project') {
          console.log('[Engagements API] Project engagement - creating strategy...');
          try {
            // Check if strategy already exists for this engagement
            let strategy = await getStrategyByEngagementId(engagementId);
            console.log('[Engagements API] Existing strategy for engagement:', strategy?.id || 'none');

            if (!strategy) {
              // Create new project strategy
              console.log('[Engagements API] Creating new ProjectStrategy...');
              strategy = await createProjectStrategy(updatedEngagement);
              console.log('[Engagements API] Created ProjectStrategy:', strategy.id);
            }

            strategyId = strategy.id;
            console.log('[Engagements API] Returning strategyId:', strategyId);
          } catch (strategyError) {
            console.error('[Engagements API] Failed to create ProjectStrategy:', strategyError);
            // Don't fail the approval - strategy can be created later
          }
        } else {
          console.log('[Engagements API] Not a project engagement, skipping strategy creation');
        }

        return NextResponse.json({
          success: true,
          engagement: updatedEngagement,
          action,
          previousStatus: engagement.status,
          newStatus: updatedEngagement.status,
          strategyId, // Include strategyId for redirect
        });
      }

      case 'start-work':
        updatedEngagement = await startWork(engagementId);
        break;

      case 'complete':
        updatedEngagement = await completeEngagement(engagementId);
        break;

      case 'reset':
        updatedEngagement = await resetEngagement(engagementId);
        break;

      case 'create-strategy': {
        // Manual strategy creation for already-approved project engagements
        if (engagement.type !== 'project') {
          return NextResponse.json(
            { error: 'create-strategy only works for project engagements' },
            { status: 400 }
          );
        }

        console.log('[Engagements API] Manual strategy creation for:', engagementId);

        let strategy = await getStrategyByEngagementId(engagementId);
        console.log('[Engagements API] Existing strategy:', strategy?.id || 'none');

        if (!strategy) {
          console.log('[Engagements API] Creating new ProjectStrategy...');
          strategy = await createProjectStrategy(engagement);
          console.log('[Engagements API] Created:', strategy.id);
        }

        return NextResponse.json({
          success: true,
          engagement,
          action,
          strategyId: strategy.id,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      engagement: updatedEngagement,
      action,
      previousStatus: engagement.status,
      newStatus: updatedEngagement.status,
    });
  } catch (error) {
    console.error('[Engagements API] Error executing action:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: 'Failed to execute action',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
