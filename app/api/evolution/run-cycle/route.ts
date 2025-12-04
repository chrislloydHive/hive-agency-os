// app/api/evolution/run-cycle/route.ts
// Run evolution cycle and get analytics

import { NextRequest, NextResponse } from 'next/server';
import {
  runEvolutionCycle,
  getEvolutionAnalytics,
  getCycleHistory,
  getEvolutionTrends,
} from '@/lib/evolution/evolutionCycle';
import { loadContextGraph } from '@/lib/contextGraph';
import { getActiveExperiments, getCompletedExperiments } from '@/lib/autopilot/optimizationEngine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataType = searchParams.get('type'); // 'analytics' | 'history' | 'trends' | 'all'
    const limit = parseInt(searchParams.get('limit') || '10');

    const response: Record<string, unknown> = {};

    if (dataType === 'analytics' || dataType === 'all' || !dataType) {
      response.analytics = getEvolutionAnalytics();
    }

    if (dataType === 'history' || dataType === 'all') {
      response.cycleHistory = getCycleHistory(limit);
    }

    if (dataType === 'trends' || dataType === 'all') {
      response.trends = await getEvolutionTrends();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching evolution data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evolution data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyIds,
      discoverPatterns = true,
      updateBenchmarks = true,
      generateInsights = true,
      distributeRecommendations = true,
    } = body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: 'companyIds array is required' },
        { status: 400 }
      );
    }

    // Load data for all companies
    const companyData: Array<{
      companyId: string;
      graph: any;
      experiments: any[];
      performance: {
        cpa: number;
        ctr: number;
        conversionRate: number;
        roas: number;
        cpc: number;
        spend: number;
        conversions: number;
      };
    }> = [];

    for (const companyId of companyIds) {
      const graph = await loadContextGraph(companyId);
      if (!graph) continue;

      const activeExperiments = getActiveExperiments(companyId);
      const completedExperiments = getCompletedExperiments(companyId);
      const targetCpa = graph.objectives?.targetCpa?.value as number || 50;
      const targetRoas = graph.objectives?.targetRoas?.value as number || 3;
      const monthlyBudget = graph.budgetOps?.mediaSpendBudget?.value as number || graph.performanceMedia?.totalMonthlySpend?.value as number || 10000;

      companyData.push({
        companyId,
        graph,
        experiments: [...activeExperiments, ...completedExperiments],
        performance: {
          cpa: targetCpa,
          ctr: 0.01,
          conversionRate: 0.025,
          roas: targetRoas,
          cpc: targetCpa * 0.025,
          spend: monthlyBudget,
          conversions: Math.round(monthlyBudget / targetCpa),
        },
      });
    }

    if (companyData.length === 0) {
      return NextResponse.json(
        { error: 'No valid companies found' },
        { status: 400 }
      );
    }

    // Run the evolution cycle
    const result = await runEvolutionCycle(companyData, {
      discoverPatterns,
      updateBenchmarks,
      generateInsights,
      distributeRecommendations,
    });

    return NextResponse.json({
      success: result.status === 'success',
      result,
      analytics: getEvolutionAnalytics(),
    });
  } catch (error) {
    console.error('Error running evolution cycle:', error);
    return NextResponse.json(
      { error: 'Failed to run evolution cycle', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
