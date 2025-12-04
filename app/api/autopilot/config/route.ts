// app/api/autopilot/config/route.ts
// Manage autopilot configuration for a company

import { NextRequest, NextResponse } from 'next/server';
import {
  getAutopilotConfig,
  setAutopilotConfig,
  getCycleHistory,
  getAutopilotLogs,
} from '@/lib/autopilot/cycleEngine';
import {
  changeAutonomyLevel,
  getGovernanceSummary,
  getPendingApprovals,
  processApproval,
  triggerEmergencyStop,
  resolveEmergencyStop,
  getEmergencyState,
} from '@/lib/autopilot/autopilotGovernance';
import type { AutopilotConfig, AutonomyLevel } from '@/lib/autopilot/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const include = searchParams.get('include'); // 'history' | 'logs' | 'governance' | 'approvals' | 'all'

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const config = getAutopilotConfig(companyId);
    const response: Record<string, unknown> = { config };

    if (include === 'history' || include === 'all') {
      response.cycleHistory = getCycleHistory(companyId, 10);
    }

    if (include === 'logs' || include === 'all') {
      response.logs = getAutopilotLogs(companyId, { limit: 50 });
    }

    if (include === 'governance' || include === 'all') {
      if (config) {
        response.governance = getGovernanceSummary(companyId, config);
      }
      response.emergencyState = getEmergencyState(companyId);
    }

    if (include === 'approvals' || include === 'all') {
      response.pendingApprovals = getPendingApprovals(companyId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching autopilot config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch autopilot config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, config } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!config) {
      return NextResponse.json(
        { error: 'config is required' },
        { status: 400 }
      );
    }

    // Validate config
    const validatedConfig: AutopilotConfig = {
      companyId,
      enabled: config.enabled ?? false,
      autonomyLevel: config.autonomyLevel || 'ai_assisted',
      cycleFrequency: config.cycleFrequency || 'weekly',
      allowedDomains: config.allowedDomains || ['brand', 'audience', 'goals', 'performanceMedia'],
      budgetFlexibility: Math.max(0, Math.min(1, config.budgetFlexibility || 0.2)),
      experimentBudgetPercent: Math.max(0, Math.min(30, config.experimentBudgetPercent || 10)),
      riskTolerance: config.riskTolerance || 'moderate',
      requireApprovalFor: config.requireApprovalFor || ['budget', 'audience'],
      notifyOnChanges: config.notifyOnChanges ?? true,
      emergencyStopThreshold: Math.max(10, Math.min(100, config.emergencyStopThreshold || 50)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setAutopilotConfig(validatedConfig);

    return NextResponse.json({
      success: true,
      config: validatedConfig,
    });
  } catch (error) {
    console.error('Error saving autopilot config:', error);
    return NextResponse.json(
      { error: 'Failed to save autopilot config' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      action, // 'change_autonomy' | 'approve' | 'reject' | 'emergency_stop' | 'emergency_resolve'
      ...params
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    const config = getAutopilotConfig(companyId);
    if (!config && action !== 'emergency_stop') {
      return NextResponse.json(
        { error: 'Autopilot not configured for this company' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'change_autonomy': {
        const { newLevel, changedBy, reason } = params;
        if (!newLevel || !changedBy) {
          return NextResponse.json(
            { error: 'newLevel and changedBy are required' },
            { status: 400 }
          );
        }

        const result = changeAutonomyLevel(
          companyId,
          config!,
          newLevel as AutonomyLevel,
          changedBy,
          reason || 'No reason provided'
        );

        if (result.success) {
          // Update the config
          setAutopilotConfig({
            ...config!,
            autonomyLevel: newLevel,
            updatedAt: new Date().toISOString(),
          });
        }

        return NextResponse.json(result);
      }

      case 'approve':
      case 'reject': {
        const { requestId, reviewedBy, notes } = params;
        if (!requestId || !reviewedBy) {
          return NextResponse.json(
            { error: 'requestId and reviewedBy are required' },
            { status: 400 }
          );
        }

        const approval = processApproval(companyId, {
          requestId,
          approved: action === 'approve',
          reviewedBy,
          notes,
        });

        if (!approval) {
          return NextResponse.json(
            { error: 'Approval request not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          approval,
        });
      }

      case 'emergency_stop': {
        const { triggeredBy, reason, affectedChannels, autoResumeIn } = params;
        if (!triggeredBy || !reason) {
          return NextResponse.json(
            { error: 'triggeredBy and reason are required' },
            { status: 400 }
          );
        }

        const state = triggerEmergencyStop(companyId, triggeredBy, reason, {
          affectedChannels,
          autoResumeIn,
        });

        return NextResponse.json({
          success: true,
          emergencyState: state,
        });
      }

      case 'emergency_resolve': {
        const { resolvedBy, notes } = params;
        if (!resolvedBy) {
          return NextResponse.json(
            { error: 'resolvedBy is required' },
            { status: 400 }
          );
        }

        const state = resolveEmergencyStop(companyId, resolvedBy, notes);
        if (!state) {
          return NextResponse.json(
            { error: 'No active emergency to resolve' },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          emergencyState: state,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error updating autopilot config:', error);
    return NextResponse.json(
      { error: 'Failed to update autopilot config' },
      { status: 500 }
    );
  }
}
