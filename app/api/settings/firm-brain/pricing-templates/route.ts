// app/api/settings/firm-brain/pricing-templates/route.ts
// Pricing Templates API - List and Create

import { NextResponse } from 'next/server';
import { getPricingTemplates, createPricingTemplate } from '@/lib/airtable/firmBrain';
import { PricingTemplateInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pricingTemplates = await getPricingTemplates();
    return NextResponse.json({ pricingTemplates });
  } catch (error) {
    console.error('[firm-brain/pricing-templates] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PricingTemplateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pricingTemplate = await createPricingTemplate(parsed.data);
    return NextResponse.json({ pricingTemplate }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/pricing-templates] POST error:', error);
    return NextResponse.json({ error: 'Failed to create pricing template' }, { status: 500 });
  }
}
