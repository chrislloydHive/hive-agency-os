// app/api/settings/firm-brain/pricing-templates/route.ts
// Pricing Templates API - List and Create (Simplified)

import { NextRequest, NextResponse } from 'next/server';
import {
  getPricingTemplates,
  createPricingTemplate,
  upsertPricingTemplate,
} from '@/lib/airtable/firmBrain';
import { PricingTemplateInputSchema } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/firm-brain/pricing-templates
 * List pricing templates with optional filters
 * Query params: q, hasFile, hasOpportunities
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const q = searchParams.get('q') || undefined;
    const hasFileParam = searchParams.get('hasFile');
    const hasOpportunitiesParam = searchParams.get('hasOpportunities');

    // Parse boolean filters
    let hasFile: boolean | undefined;
    if (hasFileParam !== null) {
      hasFile = hasFileParam === 'true';
    }

    let hasOpportunities: boolean | undefined;
    if (hasOpportunitiesParam !== null) {
      hasOpportunities = hasOpportunitiesParam === 'true';
    }

    const pricingTemplates = await getPricingTemplates({
      q,
      hasFile,
      hasOpportunities,
    });

    return NextResponse.json({ pricingTemplates });
  } catch (error) {
    console.error('[firm-brain/pricing-templates] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/firm-brain/pricing-templates
 * Create a new pricing template or upsert if idempotent=true
 * Body: PricingTemplateInput
 * Query params: idempotent (boolean) - if true, upsert by name
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idempotent = searchParams.get('idempotent') === 'true';

    const body = await request.json();
    const parsed = PricingTemplateInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const pricingTemplate = idempotent
      ? await upsertPricingTemplate(parsed.data)
      : await createPricingTemplate(parsed.data);

    return NextResponse.json({ pricingTemplate }, { status: 201 });
  } catch (error) {
    console.error('[firm-brain/pricing-templates] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing template' },
      { status: 500 }
    );
  }
}
