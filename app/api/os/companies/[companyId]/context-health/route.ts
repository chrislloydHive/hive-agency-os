// app/api/os/companies/[companyId]/context-health/route.ts
// Context Graph Health API endpoint
//
// GET /api/os/companies/[companyId]/context-health
// Returns comprehensive health/completeness status of a company's context graph
// including overall score, critical coverage, freshness, section breakdown

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { calculateCompleteness, calculateDomainCoverage } from '@/lib/contextGraph/companyContextGraph';
import {
  computeContextHealthScore,
  getHealthRecommendations,
  getSeverityLabel,
} from '@/lib/contextGraph/health';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    console.log('[API] Context health request for company:', companyId);

    // Compute comprehensive health score
    const healthScore = await computeContextHealthScore(companyId);

    // Also get domain coverage for backward compatibility
    const graph = await loadContextGraph(companyId);

    if (!graph) {
      // Return a minimal response for new companies
      return NextResponse.json({
        overallScore: 0,
        completenessScore: 0,
        criticalCoverageScore: 0,
        freshnessScore: 100,
        confidenceScore: 100,
        severity: 'unhealthy',
        severityLabel: 'Weak / Incomplete',
        sectionScores: [],
        missingCriticalFields: [],
        recommendations: [],
        // Legacy fields for backward compatibility
        completenessScore_legacy: 0,
        domainCoverage: {},
        lastUpdated: null,
        lastFusionAt: null,
        fieldCount: { total: 0, populated: 0 },
        staleFields: 0,
        healthScore: 0,
        healthStatus: 'critical',
        needsRefresh: [],
      });
    }

    // Get domain coverage for backward compatibility
    const domainCoverage = calculateDomainCoverage(graph);

    // Get recommendations
    const recommendations = getHealthRecommendations(healthScore);

    // Build response with both new and legacy fields
    const healthData = {
      // New comprehensive scoring
      overallScore: healthScore.overallScore,
      completenessScore: healthScore.completenessScore,
      criticalCoverageScore: healthScore.criticalCoverageScore,
      freshnessScore: healthScore.freshnessScore,
      confidenceScore: healthScore.confidenceScore,
      severity: healthScore.severity,
      severityLabel: getSeverityLabel(healthScore.severity),
      sectionScores: healthScore.sectionScores,
      missingCriticalFields: healthScore.missingCriticalFields.map(f => ({
        path: f.path,
        label: f.label,
        section: f.section,
        primarySources: f.primarySources,
      })),
      recommendations,
      stats: healthScore.stats,
      computedAt: healthScore.computedAt,

      // Legacy fields for backward compatibility
      completenessScore_legacy: calculateCompleteness(graph),
      domainCoverage,
      lastUpdated: graph.meta.updatedAt,
      lastFusionAt: graph.meta.lastFusionAt,
      fieldCount: {
        total: healthScore.stats.totalFields,
        populated: healthScore.stats.populatedFields,
      },
      staleFields: healthScore.stats.staleFields,
      // Map new severity to old healthStatus format
      healthScore: healthScore.overallScore,
      healthStatus: healthScore.severity === 'healthy' ? 'healthy'
        : healthScore.severity === 'degraded' ? 'fair'
        : 'critical',
      needsRefresh: healthScore.missingCriticalFields.slice(0, 10).map(f => ({
        domain: f.domain,
        field: f.field,
        reason: 'missing' as const,
      })),
    };

    console.log('[API] Context health:', {
      companyId,
      overall: healthScore.overallScore,
      critical: healthScore.criticalCoverageScore,
      completeness: healthScore.completenessScore,
      freshness: healthScore.freshnessScore,
      severity: healthScore.severity,
      stale: healthScore.stats.staleFields,
    });

    return NextResponse.json(healthData);
  } catch (error) {
    console.error('[API] Context health error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
