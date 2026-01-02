// app/api/os/companies/[companyId]/approvals/route.ts
// Approvals Inbox API
//
// GET: List approvals for a company (with optional status filter)
// POST: Create a new approval request (for AI actions)

import { NextRequest, NextResponse } from 'next/server';
import {
  getApprovals,
  getPendingApprovals,
  getApprovalSummary,
  createApprovalRequest,
  type ApprovalStatus,
} from '@/lib/os/programs/approvals';
import { getCapability, requiresApproval } from '@/lib/os/programs/aiCapabilities';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') as ApprovalStatus | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const includeSummary = searchParams.get('summary') === 'true';

    const approvals = status
      ? getApprovals(companyId, { status, limit })
      : getApprovals(companyId, { limit });

    const response: {
      success: boolean;
      approvals: typeof approvals;
      summary?: ReturnType<typeof getApprovalSummary>;
    } = {
      success: true,
      approvals,
    };

    if (includeSummary) {
      response.summary = getApprovalSummary(companyId);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Approvals GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;
    const body = await request.json();

    const {
      capabilityId,
      programId,
      workItemId,
      artifactId,
      description,
      payload,
      context: requestContext,
      debugId,
    } = body;

    // Validate capability
    if (!capabilityId) {
      return NextResponse.json(
        { success: false, error: 'capabilityId is required' },
        { status: 400 }
      );
    }

    const capability = getCapability(capabilityId);
    if (!capability) {
      return NextResponse.json(
        { success: false, error: `Unknown capability: ${capabilityId}` },
        { status: 400 }
      );
    }

    // Check if this action actually requires approval
    if (!requiresApproval(capabilityId)) {
      return NextResponse.json(
        {
          success: false,
          error: `Capability "${capability.name}" does not require approval`,
        },
        { status: 400 }
      );
    }

    // Validate payload
    if (!description || !payload) {
      return NextResponse.json(
        { success: false, error: 'description and payload are required' },
        { status: 400 }
      );
    }

    // Create the approval request
    const approvalRequest = createApprovalRequest({
      companyId,
      capabilityId,
      programId,
      workItemId,
      artifactId,
      description,
      payload: payload as Record<string, unknown>,
      context: requestContext,
      expiresInHours: 72,
      debugId,
    });

    return NextResponse.json({
      success: true,
      approval: approvalRequest,
    });
  } catch (error) {
    console.error('[Approvals POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
