// app/api/hive-brain/policy/route.ts
// Hive Brain Policy API
//
// Endpoints:
// GET /api/hive-brain/policy - List policies
// POST /api/hive-brain/policy - Evaluate or create policy

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPolicies,
  getPoliciesForScope,
  getPolicySummary,
  evaluatePolicies,
  checkBudgetChange,
  checkCreativeCompliance,
  checkAutopilotAction,
  createPolicy,
  type PolicyContext,
} from '@/lib/hiveBrain';
import type { HivePolicy } from '@/lib/hiveBrain';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const scope = searchParams.get('scope') as 'global' | 'vertical' | 'company' | null;
    const scopeId = searchParams.get('scopeId');

    switch (action) {
      case 'summary': {
        const summary = getPolicySummary();
        return NextResponse.json(summary);
      }

      case 'forScope': {
        if (!scope) {
          return NextResponse.json(
            { error: 'scope required' },
            { status: 400 }
          );
        }
        const policies = getPoliciesForScope(scope, scopeId ?? undefined);
        return NextResponse.json({ policies });
      }

      default: {
        const policies = getAllPolicies();
        return NextResponse.json({ policies });
      }
    }
  } catch (error) {
    console.error('Hive Brain policy GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get policies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body as { action: string };

    switch (action) {
      case 'evaluate': {
        const { context } = body as { context: PolicyContext };
        if (!context) {
          return NextResponse.json(
            { error: 'context required for evaluate' },
            { status: 400 }
          );
        }
        const result = evaluatePolicies(context);
        return NextResponse.json(result);
      }

      case 'checkBudget': {
        const { currentBudget, newBudget, companyId, verticalId } = body as {
          currentBudget: number;
          newBudget: number;
          companyId?: string;
          verticalId?: string;
        };

        if (currentBudget === undefined || newBudget === undefined) {
          return NextResponse.json(
            { error: 'currentBudget and newBudget required' },
            { status: 400 }
          );
        }

        const result = checkBudgetChange(
          currentBudget,
          newBudget,
          companyId,
          verticalId
        );
        return NextResponse.json(result);
      }

      case 'checkCreative': {
        const { creative, companyId, verticalId } = body as {
          creative: {
            content: string;
            images?: string[];
            platform: string;
          };
          companyId?: string;
          verticalId?: string;
        };

        if (!creative?.content || !creative?.platform) {
          return NextResponse.json(
            { error: 'creative.content and creative.platform required' },
            { status: 400 }
          );
        }

        const result = checkCreativeCompliance(creative, companyId, verticalId);
        return NextResponse.json(result);
      }

      case 'checkAutopilot': {
        const { autopilotAction, campaignSpend, actionsToday, companyId } = body as {
          autopilotAction: string;
          campaignSpend: number;
          actionsToday: number;
          companyId?: string;
        };

        if (!autopilotAction || campaignSpend === undefined || actionsToday === undefined) {
          return NextResponse.json(
            { error: 'autopilotAction, campaignSpend, and actionsToday required' },
            { status: 400 }
          );
        }

        const result = checkAutopilotAction(
          autopilotAction,
          campaignSpend,
          actionsToday,
          companyId
        );
        return NextResponse.json(result);
      }

      case 'create': {
        const { policy } = body as {
          policy: {
            name: string;
            description: string;
            type: HivePolicy['type'];
            scope: HivePolicy['scope'];
            verticalId?: string;
            companyId?: string;
            rules: Array<{
              condition: string;
              action: 'block' | 'warn' | 'require_approval' | 'log';
              message: string;
              severity: 'critical' | 'high' | 'medium' | 'low';
            }>;
            createdBy: string;
          };
        };

        if (!policy?.name || !policy?.rules?.length) {
          return NextResponse.json(
            { error: 'policy name and rules required' },
            { status: 400 }
          );
        }

        const newPolicy = createPolicy(policy);
        return NextResponse.json(newPolicy);
      }

      default: {
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Hive Brain policy POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process policy request' },
      { status: 500 }
    );
  }
}
