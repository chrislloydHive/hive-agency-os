// app/api/os/client-brain/[companyId]/insights/route.ts
// List and create Client Brain Insights for a company

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  listClientInsightsForCompany,
  createClientInsight,
} from '@/lib/airtable/clientInsights';
import type {
  CreateClientInsightPayload,
  ListClientInsightsOptions,
  InsightCategory,
  InsightSeverity,
} from '@/lib/types/clientBrain';
import { normalizeInsightCategory, normalizeInsightSeverity } from '@/lib/types/clientBrain';

interface RouteContext {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// GET - List insights for a company
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const options: ListClientInsightsOptions = {
      limit: parseInt(searchParams.get('limit') || '100', 10),
      category: searchParams.get('category') as InsightCategory | undefined,
      severity: searchParams.get('severity') as InsightSeverity | undefined,
    };

    const insights = await listClientInsightsForCompany(companyId, options);

    return NextResponse.json({
      insights,
      count: insights.length,
      companyId,
      companyName: company.name,
    });
  } catch (error) {
    console.error('[Client Brain API] Error listing insights:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list insights' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new insight (manual entry)
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { companyId } = await context.params;

    // Validate company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { title, body: insightBody, category, severity, tags } = body as {
      title: string;
      body: string;
      category?: string;
      severity?: string;
      tags?: string[];
    };

    // Validate required fields
    if (!title || !insightBody) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // Create the insight
    const payload: CreateClientInsightPayload = {
      companyId,
      title,
      body: insightBody,
      category: normalizeInsightCategory(category),
      severity: normalizeInsightSeverity(severity),
      source: { type: 'manual' },
      tags,
    };

    const insight = await createClientInsight(payload);

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('[Client Brain API] Error creating insight:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create insight' },
      { status: 500 }
    );
  }
}
