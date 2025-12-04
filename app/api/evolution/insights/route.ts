// app/api/evolution/insights/route.ts
// Query insights and recommendations

import { NextRequest, NextResponse } from 'next/server';
import {
  getInsights,
  getRecommendations,
  markRecommendationApplied,
  generatePatternRecommendations,
} from '@/lib/evolution/insightGenerator';
import { loadContextGraph } from '@/lib/contextGraph';
import type { InsightType, CrossCompanyInsight } from '@/lib/evolution/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type') as InsightType | null;
    const status = searchParams.get('status') as CrossCompanyInsight['status'] | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const dataType = searchParams.get('dataType'); // 'insights' | 'recommendations' | 'both'

    // Get recommendations for a company
    if (companyId && (dataType === 'recommendations' || dataType === 'both')) {
      const recommendations = getRecommendations(companyId);

      if (dataType === 'recommendations') {
        return NextResponse.json({
          recommendations,
          total: recommendations.length,
        });
      }
    }

    // Get insights
    const insights = getInsights({
      type: type || undefined,
      status: status || undefined,
      limit,
    });

    // If dataType is 'both' and we have companyId
    if (dataType === 'both' && companyId) {
      const recommendations = getRecommendations(companyId);
      return NextResponse.json({
        insights,
        recommendations,
        totalInsights: insights.length,
        totalRecommendations: recommendations.length,
      });
    }

    return NextResponse.json({
      insights,
      total: insights.length,
    });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId, recommendationId, actualImpact, performance } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required (generate_recommendations, apply_recommendation)' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'generate_recommendations': {
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }

        const graph = await loadContextGraph(companyId);
        if (!graph) {
          return NextResponse.json(
            { error: 'Company not found' },
            { status: 404 }
          );
        }

        // Use provided performance or defaults
        const perf = performance || {
          cpa: 50,
          roas: 3,
          ctr: 0.01,
          conversionRate: 0.025,
        };

        const recommendations = generatePatternRecommendations(
          companyId,
          graph,
          perf
        );

        return NextResponse.json({
          success: true,
          recommendations,
          total: recommendations.length,
        });
      }

      case 'apply_recommendation': {
        if (!companyId || !recommendationId) {
          return NextResponse.json(
            { error: 'companyId and recommendationId are required' },
            { status: 400 }
          );
        }

        const updated = markRecommendationApplied(
          companyId,
          recommendationId,
          actualImpact
        );

        if (!updated) {
          return NextResponse.json(
            { error: 'Recommendation not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          recommendation: updated,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing insights action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
