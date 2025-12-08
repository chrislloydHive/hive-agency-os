// app/api/os/findings/[findingId]/convert-to-work-item/route.ts
// Convert Finding to Work Item API
//
// POST: Creates a Work Item from a diagnostic finding and links them

import { NextRequest, NextResponse } from 'next/server';
import { convertFindingToWorkItem } from '@/lib/os/findings/companyFindings';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// POST /api/os/findings/[findingId]/convert-to-work-item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const { findingId } = await params;

  try {
    const body = await request.json();

    // The finding data must be provided in the request body
    // This avoids an extra Airtable lookup and ensures we have the latest data
    const finding: DiagnosticDetailFinding = body.finding;

    if (!finding) {
      return NextResponse.json(
        {
          success: false,
          error: 'Finding data is required in request body',
        },
        { status: 400 }
      );
    }

    if (!finding.companyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Finding must have a companyId',
        },
        { status: 400 }
      );
    }

    // Check if already converted
    if (finding.isConvertedToWorkItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'Finding has already been converted to a work item',
          workItemId: finding.workItemId,
        },
        { status: 400 }
      );
    }

    // Optional: assignee ID for the work item
    const assigneeId = body.assigneeId;

    // Convert to work item
    const result = await convertFindingToWorkItem(findingId, finding, { assigneeId });

    return NextResponse.json({
      success: true,
      finding: result.finding,
      workItem: result.workItem,
      message: 'Successfully converted finding to work item',
    });
  } catch (error) {
    console.error('[Convert Finding API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to convert finding to work item',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
