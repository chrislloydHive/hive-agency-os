// app/api/pipeline/update-checklist/route.ts
// API endpoint for updating Full Workup checklist items

import { NextRequest, NextResponse } from 'next/server';
import { updateWorkupChecklist } from '@/lib/airtable/inboundLeads';

type ChecklistField =
  | 'qbrReviewed'
  | 'mediaLabReviewed'
  | 'seoLabReviewed'
  | 'competitionLabReviewed'
  | 'workPlanDrafted';

const VALID_FIELDS: ChecklistField[] = [
  'qbrReviewed',
  'mediaLabReviewed',
  'seoLabReviewed',
  'competitionLabReviewed',
  'workPlanDrafted',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, field, value } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    if (!field || !VALID_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `field must be one of: ${VALID_FIELDS.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'value must be a boolean' },
        { status: 400 }
      );
    }

    await updateWorkupChecklist(leadId, field as ChecklistField, value);

    return NextResponse.json({
      success: true,
      leadId,
      field,
      value,
    });
  } catch (error) {
    console.error('[Update Checklist] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist' },
      { status: 500 }
    );
  }
}
