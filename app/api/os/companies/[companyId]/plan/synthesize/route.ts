// app/api/os/companies/[companyId]/plan/synthesize/route.ts
// Plan Synthesis API
//
// POST: Generate strategic plan from findings using the recommendations engine
// Returns themes, next best actions, quick wins, quarterly roadmap, and sequences

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyFindings, getCompanyFindingsSummary } from '@/lib/os/findings/companyFindings';
import { getCompanyById } from '@/lib/airtable/companies';
import { synthesizePlan, type PlanSynthesisResult } from '@/lib/os/recommendations';
import type { Finding, FindingCategory, FindingDimension, FindingSeverity, LabSlug } from '@/lib/os/findings/types';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Airtable finding to standardized Finding type
 */
function convertToStandardizedFinding(f: DiagnosticDetailFinding, index: number): Finding {
  // Map category string to FindingCategory
  const categoryMap: Record<string, FindingCategory> = {
    'Technical': 'technical',
    'UX': 'website',
    'Brand': 'content',
    'Content': 'content',
    'SEO': 'seo',
    'Analytics': 'technical',
    'Media': 'social',
    'Demand': 'content',
    'Ops': 'technical',
  };

  // Map dimension string to FindingDimension
  const dimensionMap: Record<string, FindingDimension> = {
    'Performance': 'performance',
    'Presence': 'presence',
    'Visibility': 'visibility',
    'Accuracy': 'accuracy',
    'Completeness': 'completeness',
    'Consistency': 'consistency',
    'Engagement': 'engagement',
    'Authority': 'authority',
    'Compliance': 'compliance',
    'General': 'presence',
    'Summary': 'presence',
  };

  // Map lab slug
  const labSlugMap: Record<string, LabSlug> = {
    'website': 'website',
    'brand': 'brand',
    'seo': 'rankings',
    'content': 'content',
    'demand': 'audience',
    'ops': 'technical',
    'gap': 'gbp',
    'gbp': 'gbp',
    'social': 'social',
    'competition': 'competition',
  };

  // Map severity
  const severityMap: Record<string, FindingSeverity> = {
    'critical': 'critical',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
    'info': 'info',
  };

  // Determine impact level from severity
  const impactLevelMap: Record<string, 'high' | 'medium' | 'low'> = {
    'critical': 'high',
    'high': 'high',
    'medium': 'medium',
    'low': 'low',
  };

  const category = categoryMap[f.category || ''] || 'technical';
  const dimension = dimensionMap[f.dimension || ''] || 'presence';
  const severity = severityMap[f.severity || 'medium'] || 'medium';
  const labSlug = labSlugMap[f.labSlug || 'website'] || 'website';

  return {
    id: f.id || `finding-${index}`,
    labSlug,
    category,
    dimension,
    severity,
    location: {
      url: f.location || undefined,
      platform: f.labSlug || undefined,
    },
    issueKey: `${category}-${dimension}-${index}`,
    description: f.description || 'No description',
    recommendation: f.recommendation || 'Review and address this finding',
    estimatedImpact: {
      level: impactLevelMap[f.severity || 'medium'] || 'medium',
      metric: category === 'seo' ? 'visibility' : category === 'website' ? 'conversions' : 'engagement',
      effort: severity === 'critical' || severity === 'high' ? 'moderate' : 'quick',
    },
    confidence: 80,
    detectedAt: f.createdAt || new Date().toISOString(),
    tags: [f.labSlug || 'unknown', f.category || 'unknown'].filter(Boolean),
  };
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Parse request body for options
    let options: { year?: number; maxNextBestActions?: number; maxQuickWins?: number } = {};
    try {
      const body = await request.json();
      options = body || {};
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Fetch company and findings
    const [company, findings, summary] = await Promise.all([
      getCompanyById(companyId),
      getCompanyFindings(companyId),
      getCompanyFindingsSummary(companyId),
    ]);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    if (findings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No findings to synthesize' },
        { status: 400 }
      );
    }

    // Convert findings to standardized format
    const standardizedFindings: Finding[] = findings.map((f, i) =>
      convertToStandardizedFinding(f, i)
    );

    console.log('[Plan Synthesis] Converting', findings.length, 'findings to standardized format');

    // Generate plan using the recommendations engine
    const synthesis: PlanSynthesisResult = synthesizePlan(standardizedFindings, {
      year: options.year || new Date().getFullYear(),
      maxNextBestActions: options.maxNextBestActions || 10,
      maxQuickWins: options.maxQuickWins || 5,
    });

    console.log('[Plan Synthesis] Generated plan with', synthesis.stats.totalActions, 'actions');

    // Build legacy format for backward compatibility
    const legacySynthesis = {
      themes: synthesis.themes.map(t => t.title),
      prioritizedActions: synthesis.nextBestActions.map(a => a.title),
      sequencing: synthesis.quarterlyRoadmap.length > 0
        ? `Start with ${synthesis.quarterlyRoadmap[0]?.themes.slice(0, 2).join(' and ')} in Q1, then progress through subsequent quarters.`
        : 'Prioritize quick wins first, then address high-priority items.',
      kpiConsiderations: `Track progress on ${synthesis.stats.totalActions} actions across ${synthesis.themes.length} themes. Focus on ${synthesis.stats.criticalCount} critical items first.`,
      implementationNotes: synthesis.quickWins.length > 0
        ? `Start with these quick wins: ${synthesis.quickWins.slice(0, 3).map(q => q.title).join(', ')}`
        : 'Begin with the highest priority actions to build momentum.',
      summary: `${synthesis.stats.totalActions} actions identified across ${synthesis.themes.length} strategic themes. ${synthesis.stats.quickWinsCount} quick wins available for immediate impact. ${synthesis.stats.criticalCount} critical items require immediate attention.`,
    };

    return NextResponse.json({
      success: true,
      // Full synthesis result
      plan: {
        themes: synthesis.themes,
        nextBestActions: synthesis.nextBestActions,
        quickWins: synthesis.quickWins,
        quarterlyRoadmap: synthesis.quarterlyRoadmap,
        sequences: synthesis.sequences,
        stats: synthesis.stats,
      },
      // Legacy format for backward compatibility
      synthesis: legacySynthesis,
      findingsCount: findings.length,
      findingsSummary: summary,
    });
  } catch (error) {
    console.error('[Plan Synthesis API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate synthesis',
      },
      { status: 500 }
    );
  }
}
