// app/api/autopilot/run-cycle/route.ts
// Run a complete autopilot cycle for a company

import { NextRequest, NextResponse } from 'next/server';
import { runAutopilotCycle, checkAutopilotReadiness, getAutopilotConfig } from '@/lib/autopilot/cycleEngine';
import { loadContextGraph } from '@/lib/contextGraph';
import { isEmergencyActive } from '@/lib/autopilot/autopilotGovernance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, forceRun = false } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Check emergency stop
    if (isEmergencyActive(companyId)) {
      return NextResponse.json(
        {
          error: 'Emergency stop is active',
          message: 'Autopilot cannot run while emergency stop is active. Resolve the emergency first.',
        },
        { status: 403 }
      );
    }

    // Load company context
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Company context not found' },
        { status: 404 }
      );
    }

    // Get or create config
    const config = getAutopilotConfig(companyId);
    if (!config) {
      return NextResponse.json(
        {
          error: 'Autopilot not configured',
          message: 'Please configure autopilot settings for this company first.',
        },
        { status: 400 }
      );
    }

    // Check readiness
    if (!forceRun) {
      const readiness = await checkAutopilotReadiness(companyId);
      if (!readiness.ready) {
        return NextResponse.json(
          {
            error: 'Autopilot not ready',
            reasons: readiness.reasons,
            readinessScore: readiness.score,
          },
          { status: 400 }
        );
      }
    }

    // Run the cycle
    const result = await runAutopilotCycle(companyId);

    return NextResponse.json({
      success: true,
      cycleResult: result,
    });
  } catch (error) {
    console.error('Error running autopilot cycle:', error);
    return NextResponse.json(
      { error: 'Failed to run autopilot cycle', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load company context
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Company context not found' },
        { status: 404 }
      );
    }

    // Check readiness
    const readiness = await checkAutopilotReadiness(companyId);
    const config = getAutopilotConfig(companyId);
    const emergencyActive = isEmergencyActive(companyId);

    return NextResponse.json({
      ready: readiness.ready && !emergencyActive,
      readinessScore: readiness.score,
      reasons: readiness.reasons,
      config,
      emergencyActive,
    });
  } catch (error) {
    console.error('Error checking autopilot readiness:', error);
    return NextResponse.json(
      { error: 'Failed to check readiness' },
      { status: 500 }
    );
  }
}
