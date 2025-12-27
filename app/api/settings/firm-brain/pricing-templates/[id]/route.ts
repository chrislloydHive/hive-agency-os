// app/api/settings/firm-brain/pricing-templates/[id]/route.ts
// Individual Pricing Template API

import { NextResponse } from 'next/server';
import { getPricingTemplateById, updatePricingTemplate, deletePricingTemplate } from '@/lib/airtable/firmBrain';
import { PricingTemplateInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pricingTemplate = await getPricingTemplateById(id);
    if (!pricingTemplate) {
      return NextResponse.json({ error: 'Pricing template not found' }, { status: 404 });
    }
    return NextResponse.json({ pricingTemplate });
  } catch (error) {
    console.error('[firm-brain/pricing-templates/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing template' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = PricingTemplateInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const pricingTemplate = await updatePricingTemplate(id, parsed.data);
    if (!pricingTemplate) {
      return NextResponse.json({ error: 'Pricing template not found' }, { status: 404 });
    }
    return NextResponse.json({ pricingTemplate });
  } catch (error) {
    console.error('[firm-brain/pricing-templates/[id]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update pricing template' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deletePricingTemplate(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete pricing template' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firm-brain/pricing-templates/[id]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete pricing template' }, { status: 500 });
  }
}
