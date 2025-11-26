// app/api/client-brain/insights/route.ts
// CRUD operations for Client Insights

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyInsights,
  createClientInsight,
  getInsightsSummary,
} from '@/lib/airtable/clientBrain';
import type { CreateClientInsightInput, InsightCategory, InsightSeverity } from '@/lib/types/clientBrain';
import { normalizeInsightCategory, normalizeInsightSeverity } from '@/lib/types/clientBrain';

// GET /api/client-brain/insights?companyId=xxx&category=xxx&limit=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const limit = searchParams.get('limit');
    const includeSummary = searchParams.get('includeSummary') === 'true';

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const options: {
      category?: InsightCategory;
      severity?: InsightSeverity;
      limit?: number;
    } = {};

    if (category) {
      options.category = normalizeInsightCategory(category);
    }
    if (severity) {
      options.severity = normalizeInsightSeverity(severity);
    }
    if (limit) {
      options.limit = parseInt(limit, 10);
    }

    const insights = await getCompanyInsights(companyId, options);

    let summary;
    if (includeSummary) {
      summary = await getInsightsSummary(companyId);
    }

    return NextResponse.json({
      success: true,
      insights,
      total: insights.length,
      ...(summary ? { summary } : {}),
    });

  } catch (error) {
    console.error('[Insights API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

// POST /api/client-brain/insights - Create a new manual insight
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, title, body: insightBody, category, severity, createdBy } = body;

    if (!companyId || !title || !insightBody || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, title, body, category' },
        { status: 400 }
      );
    }

    const input: CreateClientInsightInput = {
      title,
      body: insightBody,
      category: normalizeInsightCategory(category),
      severity: severity ? normalizeInsightSeverity(severity) : undefined,
      source: {
        type: 'manual',
        createdBy: createdBy || undefined,
      },
    };

    const insight = await createClientInsight(companyId, input);

    return NextResponse.json({
      success: true,
      insight,
    });

  } catch (error) {
    console.error('[Insights API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create insight' },
      { status: 500 }
    );
  }
}
