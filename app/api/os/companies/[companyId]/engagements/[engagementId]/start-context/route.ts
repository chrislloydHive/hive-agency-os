// app/api/os/companies/[companyId]/engagements/[engagementId]/start-context/route.ts
// Trigger context gathering via Inngest

import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { getEngagementById } from '@/lib/airtable/engagements';

// POST - Trigger Inngest event for context gathering
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; engagementId: string }> }
) {
  const { companyId, engagementId } = await params;

  try {
    // Validate engagement exists
    const engagement = await getEngagementById(engagementId);
    if (!engagement) {
      return NextResponse.json(
        { error: 'Engagement not found' },
        { status: 404 }
      );
    }

    // Send Inngest event
    console.log('[Start Context API] Sending Inngest event:', {
      engagementId,
      companyId,
      selectedLabs: engagement.selectedLabs,
    });

    await inngest.send({
      name: 'engagement/start-context-gathering',
      data: {
        engagementId,
        companyId,
        selectedLabs: engagement.selectedLabs,
      },
    });

    console.log('[Start Context API] Inngest event sent successfully');

    return NextResponse.json({
      success: true,
      message: 'Context gathering started',
      engagementId,
    });
  } catch (error) {
    console.error('[Start Context API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to start context gathering: ${message}` },
      { status: 500 }
    );
  }
}
