// app/api/os/companies/[companyId]/insights/route.ts
// API endpoint for the OS Insight Engine
// GET: Retrieve insights or weekly digest for a company

import { NextResponse } from 'next/server';
import {
  generateInsights,
  generateWeeklyDigest,
  getInsightsByTheme,
  getInsightsByType,
  getCriticalInsights,
  getPositiveInsights,
  type InsightType,
  type InsightTheme,
} from '@/lib/os/insights';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);

    // Parse query parameters
    const format = url.searchParams.get('format') || 'insights'; // 'insights' | 'digest'
    const theme = url.searchParams.get('theme') as InsightTheme | null;
    const type = url.searchParams.get('type') as InsightType | null;
    const filter = url.searchParams.get('filter'); // 'critical' | 'positive'
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    console.log('[API insights] Request:', { companyId, format, theme, type, filter, limit });

    // Handle weekly digest request
    if (format === 'digest') {
      const digest = await generateWeeklyDigest(companyId, { maxInsightsPerDigest: limit });

      return NextResponse.json({
        success: true,
        data: digest,
      });
    }

    // Handle filtered insights
    let insights;

    if (filter === 'critical') {
      insights = await getCriticalInsights(companyId);
    } else if (filter === 'positive') {
      insights = await getPositiveInsights(companyId);
    } else if (theme) {
      insights = await getInsightsByTheme(companyId, theme);
    } else if (type) {
      insights = await getInsightsByType(companyId, type);
    } else {
      insights = await generateInsights(companyId, { maxInsightsPerDigest: limit });
    }

    // Apply limit
    insights = insights.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        insights,
        count: insights.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[API insights] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate insights',
      },
      { status: 500 }
    );
  }
}
