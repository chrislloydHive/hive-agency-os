// app/api/autopilot/generate-recommendations/route.ts
// Generate AI-powered recommendations (hypotheses, budget, creative)

import { NextRequest, NextResponse } from 'next/server';
import { generateHypotheses } from '@/lib/autopilot/hypothesisEngine';
import { generateBudgetAllocation, generateAIBudgetAllocation } from '@/lib/autopilot/budgetAllocator';
import { generateCreativeRecommendations } from '@/lib/autopilot/creativeOptimizer';
import { loadContextGraph } from '@/lib/contextGraph';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      type, // 'hypotheses' | 'budget' | 'creative' | 'all'
      options = {},
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'type is required (hypotheses, budget, creative, or all)' },
        { status: 400 }
      );
    }

    // Load company context
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Company context not found' },
        { status: 404 }
      );
    }
    const results: Record<string, unknown> = {};

    // Generate hypotheses
    if (type === 'hypotheses' || type === 'all') {
      const companyName = graph.identity?.businessName?.value as string || 'Company';
      const hypotheses = await generateHypotheses({
        companyId,
        companyName,
        graph,
      }, {
        maxHypotheses: options.maxHypotheses || 10,
        focusDomains: options.categories,
        minConfidence: options.minConfidence,
      });
      results.hypotheses = hypotheses;
    }

    // Generate budget allocation
    if (type === 'budget' || type === 'all') {
      let budgetAllocation;
      if (options.useAI) {
        budgetAllocation = await generateAIBudgetAllocation(companyId, graph);
      } else {
        budgetAllocation = await generateBudgetAllocation(companyId, graph, {
          totalBudget: options.totalBudget,
          period: options.period || 'monthly',
        });
      }
      results.budgetAllocation = budgetAllocation;
    }

    // Generate creative recommendations
    if (type === 'creative' || type === 'all') {
      const creativeRecommendations = await generateCreativeRecommendations(
        companyId,
        graph,
        {
          maxRecommendations: options.maxRecommendations || 10,
        }
      );
      results.creativeRecommendations = creativeRecommendations;
    }

    return NextResponse.json({
      success: true,
      companyId,
      type,
      ...results,
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
