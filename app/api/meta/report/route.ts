// app/api/meta/report/route.ts
// API route for generating comprehensive vertical reports

import { NextRequest, NextResponse } from 'next/server';
import {
  discoverPatterns,
  generateGlobalBenchmarks,
  buildVerticalModel,
  detectGlobalAnomalies,
  recallMemories,
} from '@/lib/meta';
import type { VerticalReport, EmergentInsight } from '@/lib/meta/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vertical = searchParams.get('vertical');

    if (!vertical) {
      return NextResponse.json(
        { success: false, error: 'Vertical parameter required' },
        { status: 400 }
      );
    }

    // Generate comprehensive vertical report
    const report = await generateVerticalReport(vertical);

    if (!report) {
      return NextResponse.json(
        { success: false, error: `Insufficient data for vertical: ${vertical}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed',
      },
      { status: 500 }
    );
  }
}

async function generateVerticalReport(vertical: string): Promise<VerticalReport | null> {
  // Run all analyses in parallel
  const [patterns, benchmarks, model, anomalies, memories] = await Promise.all([
    discoverPatterns({ verticalFilter: vertical }),
    generateGlobalBenchmarks({ vertical }),
    buildVerticalModel(vertical),
    detectGlobalAnomalies({ verticalFilter: vertical }),
    recallMemories({ vertical, taskType: 'insight' }, { limit: 10 }),
  ]);

  if (!model) {
    return null;
  }

  // Generate executive summary
  const executiveSummary = generateExecutiveSummary(vertical, {
    patternCount: patterns.length,
    anomalyCount: anomalies.length,
    sampleSize: benchmarks.sampleSize,
    dataQuality: benchmarks.dataQuality,
  });

  // Extract emerging opportunities from memories
  const emergingOpportunities: EmergentInsight[] = memories
    .filter(m => m.entry.type === 'strategic_memory' || m.entry.type === 'pattern')
    .slice(0, 5)
    .map((m, idx) => ({
      id: `opportunity-${idx}`,
      type: 'expansion_opportunity' as const,
      title: m.entry.key,
      insight: m.entry.description,
      reasoning: m.reasoning,
      applicableCompanyIds: [],
      applicableVerticals: [vertical],
      evidence: [],
      confidence: m.entry.confidence,
      recommendations: [],
      expectedImpact: 'Potential improvement based on cross-company patterns',
      generatedAt: new Date().toISOString(),
      status: 'new' as const,
    }));

  // Generate strategic recommendations
  const strategicRecommendations = generateStrategicRecommendations(patterns, anomalies, model);

  return {
    id: `report-${vertical}-${Date.now()}`,
    vertical,
    period: 'current',
    generatedAt: new Date().toISOString(),

    executiveSummary,

    marketOverview: {
      totalCompanies: benchmarks.sampleSize,
      totalSpend: 0, // Would come from aggregated data
      avgRoas: benchmarks.efficiencyMetrics.roas.mean,
      yoyGrowth: 0, // Would need historical data
      competitiveIntensity: model.competitiveIntensity.overall,
    },

    topPatterns: patterns.slice(0, 10),
    benchmarks,
    verticalModel: model,

    activeAnomalies: anomalies.filter(a => a.status === 'active'),
    emergingOpportunities,

    strategicRecommendations,
  };
}

function generateExecutiveSummary(
  vertical: string,
  data: {
    patternCount: number;
    anomalyCount: number;
    sampleSize: number;
    dataQuality: string;
  }
): string {
  const qualityNote = data.dataQuality === 'high'
    ? 'Based on high-quality data'
    : data.dataQuality === 'medium'
    ? 'Based on moderate data coverage'
    : 'Based on limited data - interpret with caution';

  const anomalyNote = data.anomalyCount > 0
    ? `${data.anomalyCount} active anomalies require attention. `
    : 'No significant anomalies detected. ';

  const patternNote = data.patternCount > 0
    ? `${data.patternCount} actionable patterns discovered across the vertical.`
    : 'Limited pattern data available.';

  return `${vertical} Intelligence Report: ${qualityNote} from ${data.sampleSize} companies. ` +
    anomalyNote + patternNote;
}

function generateStrategicRecommendations(
  patterns: Array<{ type: string; name: string; crossCompanyConfidence: number }>,
  anomalies: Array<{ severity: string; title: string; recommendedActions: string[] }>,
  model: { commonPitfalls: Array<{ pitfall: string; prevention: string; impact: string }> }
): VerticalReport['strategicRecommendations'] {
  const recommendations: VerticalReport['strategicRecommendations'] = [];

  // Add recommendations from high-confidence patterns
  for (const pattern of patterns.filter(p => p.crossCompanyConfidence > 0.7).slice(0, 3)) {
    recommendations.push({
      recommendation: `Leverage ${pattern.type} pattern: ${pattern.name}`,
      priority: 'high',
      expectedImpact: 'Based on cross-company validation',
      applicableCompanyCount: 0, // Would calculate
    });
  }

  // Add recommendations from anomalies
  for (const anomaly of anomalies.filter(a => a.severity === 'critical').slice(0, 2)) {
    recommendations.push({
      recommendation: anomaly.recommendedActions[0] || `Address: ${anomaly.title}`,
      priority: 'high',
      expectedImpact: 'Critical anomaly mitigation',
      applicableCompanyCount: 0,
    });
  }

  // Add recommendations from pitfalls
  for (const pitfall of model.commonPitfalls.filter(p => p.impact === 'high').slice(0, 2)) {
    recommendations.push({
      recommendation: pitfall.prevention,
      priority: 'medium',
      expectedImpact: `Avoid: ${pitfall.pitfall}`,
      applicableCompanyCount: 0,
    });
  }

  return recommendations;
}
