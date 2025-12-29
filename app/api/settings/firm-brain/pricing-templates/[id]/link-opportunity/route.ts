// app/api/settings/firm-brain/pricing-templates/[id]/link-opportunity/route.ts
// Link/Unlink opportunity to pricing template

import { NextRequest, NextResponse } from 'next/server';
import { linkTemplateToOpportunity, unlinkTemplateFromOpportunity } from '@/lib/airtable/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/settings/firm-brain/pricing-templates/[id]/link-opportunity
 * Link an opportunity to this pricing template (idempotent)
 * Body: { opportunityId: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const { opportunityId } = body;

    if (!opportunityId || typeof opportunityId !== 'string') {
      return NextResponse.json(
        { error: 'opportunityId is required' },
        { status: 400 }
      );
    }

    const success = await linkTemplateToOpportunity(templateId, opportunityId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to link opportunity' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[pricing-templates/link-opportunity] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to link opportunity' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/firm-brain/pricing-templates/[id]/link-opportunity
 * Unlink an opportunity from this pricing template
 * Body: { opportunityId: string }
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;
    const body = await request.json();
    const { opportunityId } = body;

    if (!opportunityId || typeof opportunityId !== 'string') {
      return NextResponse.json(
        { error: 'opportunityId is required' },
        { status: 400 }
      );
    }

    const success = await unlinkTemplateFromOpportunity(templateId, opportunityId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to unlink opportunity' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[pricing-templates/link-opportunity] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink opportunity' },
      { status: 500 }
    );
  }
}
