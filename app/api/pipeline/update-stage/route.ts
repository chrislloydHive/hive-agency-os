// app/api/pipeline/update-stage/route.ts
// API endpoint for updating pipeline lead stage

import { NextRequest, NextResponse } from 'next/server';
import { updatePipelineLeadStage } from '@/lib/airtable/inboundLeads';
import type { PipelineLeadStage } from '@/lib/types/pipeline';

const VALID_STAGES: PipelineLeadStage[] = [
  'new',
  'qualified',
  'meeting_scheduled',
  'proposal',
  'won',
  'lost',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, stage } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required' },
        { status: 400 }
      );
    }

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: `stage must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    await updatePipelineLeadStage(leadId, stage as PipelineLeadStage);

    return NextResponse.json({
      success: true,
      leadId,
      stage,
    });
  } catch (error) {
    console.error('[Update Stage] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update stage' },
      { status: 500 }
    );
  }
}
