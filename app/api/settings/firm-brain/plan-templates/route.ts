// app/api/settings/firm-brain/plan-templates/route.ts
// Plan Templates API - List and Create

import { NextResponse } from 'next/server';
import { getPlanTemplates, createPlanTemplate } from '@/lib/airtable/firmBrain';
import { PlanTemplateInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const planTemplates = await getPlanTemplates();
    return NextResponse.json({ planTemplates });
  } catch (error) {
    console.error('[firm-brain/plan-templates] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch plan templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PlanTemplateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const planTemplate = await createPlanTemplate(parsed.data);
    return NextResponse.json({ planTemplate }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/plan-templates] POST error:', error);
    return NextResponse.json({ error: 'Failed to create plan template' }, { status: 500 });
  }
}
