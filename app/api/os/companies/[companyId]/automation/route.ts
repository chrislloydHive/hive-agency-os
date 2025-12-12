// app/api/os/companies/[companyId]/automation/route.ts
// Automation API Routes
//
// GET: Retrieve automation activity and settings
// POST: Trigger manual rerun or update settings

import { NextRequest, NextResponse } from 'next/server';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import {
  getAutomationActivity,
  isAutomationEnabled,
  setAutomationEnabled,
  processAutomationTrigger,
} from '@/lib/os/automation';
import { createManualRerunTrigger } from '@/lib/os/automation/triggers';
import type { AutomationAction } from '@/lib/os/automation/types';

// ============================================================================
// GET: Get automation activity and settings
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Automation must be explicitly enabled
  if (!FEATURE_FLAGS.AUTOMATION_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;

    // Get activity and settings in parallel
    const [activity, enabled] = await Promise.all([
      getAutomationActivity(companyId, 50),
      isAutomationEnabled(companyId),
    ]);

    return NextResponse.json({
      success: true,
      companyId,
      enabled,
      activity,
    });
  } catch (error) {
    console.error('[AutomationAPI] GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get automation data',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST: Update settings or trigger manual rerun
// ============================================================================

interface PostBody {
  action: 'toggle' | 'rerun';
  enabled?: boolean;
  userId?: string;
  requestedActions?: AutomationAction[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  // Feature gate: Automation must be explicitly enabled
  if (!FEATURE_FLAGS.AUTOMATION_ENABLED) {
    return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
  }

  try {
    const { companyId } = await params;
    const body: PostBody = await request.json();

    if (body.action === 'toggle') {
      // Toggle automation enabled/disabled
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'enabled must be a boolean' },
          { status: 400 }
        );
      }

      await setAutomationEnabled(companyId, body.enabled, body.userId);

      return NextResponse.json({
        success: true,
        companyId,
        enabled: body.enabled,
      });
    }

    if (body.action === 'rerun') {
      // Trigger manual rerun
      const trigger = createManualRerunTrigger(
        companyId,
        body.userId,
        body.requestedActions
      );

      const run = await processAutomationTrigger(trigger);

      return NextResponse.json({
        success: true,
        companyId,
        run: {
          id: run.id,
          status: run.status,
          actionsRun: run.actions,
          duration: run.durationMs,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[AutomationAPI] POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process automation action',
      },
      { status: 500 }
    );
  }
}
