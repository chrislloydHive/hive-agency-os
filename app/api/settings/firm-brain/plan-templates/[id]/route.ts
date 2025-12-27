// app/api/settings/firm-brain/plan-templates/[id]/route.ts
// Individual Plan Template API

import { NextResponse } from 'next/server';
import { getPlanTemplateById, updatePlanTemplate, deletePlanTemplate } from '@/lib/airtable/firmBrain';
import { PlanTemplateInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const planTemplate = await getPlanTemplateById(id);
    if (!planTemplate) {
      return NextResponse.json({ error: 'Plan template not found' }, { status: 404 });
    }
    return NextResponse.json({ planTemplate });
  } catch (error) {
    console.error('[firm-brain/plan-templates/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch plan template' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = PlanTemplateInputSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const planTemplate = await updatePlanTemplate(id, parsed.data);
    if (!planTemplate) {
      return NextResponse.json({ error: 'Plan template not found' }, { status: 404 });
    }
    return NextResponse.json({ planTemplate });
  } catch (error) {
    console.error('[firm-brain/plan-templates/[id]] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update plan template' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deletePlanTemplate(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete plan template' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[firm-brain/plan-templates/[id]] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete plan template' }, { status: 500 });
  }
}
