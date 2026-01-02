// app/api/os/companies/[companyId]/approvals/[approvalId]/route.ts
// Individual Approval Request API
//
// GET: Get a specific approval request
// POST: Process a decision (approve or reject)

import { NextRequest, NextResponse } from 'next/server';
import {
  getApprovalRequest,
  processApprovalDecision,
  type ApprovalDecision,
} from '@/lib/os/programs/approvals';

interface RouteContext {
  params: Promise<{ companyId: string; approvalId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId, approvalId } = await context.params;

    const approval = getApprovalRequest(approvalId);

    if (!approval) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      );
    }

    if (approval.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      approval,
    });
  } catch (error) {
    console.error('[Approval GET] Error:', error);
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
    const { companyId, approvalId } = await context.params;
    const body = await request.json();

    const { approved, reviewedBy, rejectionReason } = body;

    // Validate input
    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'approved (boolean) is required' },
        { status: 400 }
      );
    }

    // Get the approval request first to validate ownership
    const existing = getApprovalRequest(approvalId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      );
    }

    if (existing.companyId !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot process approval: status is already "${existing.status}"`,
        },
        { status: 400 }
      );
    }

    // Process the decision
    const decision: ApprovalDecision = {
      approved,
      reviewedBy,
      rejectionReason: approved ? undefined : rejectionReason,
    };

    const updatedApproval = processApprovalDecision(approvalId, decision);

    if (!updatedApproval) {
      return NextResponse.json(
        { success: false, error: 'Failed to process approval' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      approval: updatedApproval,
      message: approved
        ? 'Approval granted'
        : `Approval rejected${rejectionReason ? `: ${rejectionReason}` : ''}`,
    });
  } catch (error) {
    console.error('[Approval POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
