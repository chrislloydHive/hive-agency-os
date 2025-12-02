// lib/diagnostics/demand-lab/index.ts
// Demand Lab V2 Main Entry Point
//
// This is the main orchestrator that:
// 1. Runs the analyzer to collect demand signals
// 2. Scores the demand generation system (company-type aware)
// 3. Generates narrative summary
// 4. Builds quick wins and projects
// 5. Returns the complete DemandLabResult

import type {
  DemandLabResult,
  DemandLabEngineResult,
  DemandLabQuickWin,
  DemandLabProject,
  DemandAnalyzerInput,
} from './types';
import { analyzeDemandInputs } from './analyzer';
import { scoreDemandLab, ScoringOutput } from './scoring';
import { generateDemandNarrative } from './narrative';

// Re-export types for convenience
export * from './types';

// ============================================================================
// Main Run Function
// ============================================================================

export interface RunDemandLabParams {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
  // Legacy support
  websiteUrl?: string;
}

/**
 * Run Demand Lab diagnostic
 * V2: Company-type aware analysis and scoring
 *
 * This is the main entry point that orchestrates:
 * 1. Signal collection (crawling, analytics)
 * 2. Company-type aware scoring across 5 dimensions
 * 3. Narrative generation
 * 4. Quick wins and projects derivation
 */
export async function runDemandLab(
  params: RunDemandLabParams
): Promise<DemandLabResult> {
  // Support both url and websiteUrl for backwards compatibility
  const websiteUrl = params.url || params.websiteUrl || '';
  const { companyId, companyType, workspaceId } = params;

  console.log('[DemandLab V2] Starting analysis:', { companyId, websiteUrl, companyType });

  // 1. Collect demand signals
  const analyzerInput: DemandAnalyzerInput = {
    companyId,
    url: websiteUrl,
    companyType,
    workspaceId,
  };
  const analysis = await analyzeDemandInputs(analyzerInput);

  console.log('[DemandLab V2] Analysis complete:', {
    landingPages: analysis.landingPages.landingPageCount,
    hasPaidTraffic: analysis.hasPaidTraffic,
    hasLeadCapture: analysis.hasLeadCapture,
    utmUsageLevel: analysis.utmUsageLevel,
    dataConfidence: analysis.dataConfidence.level,
  });

  // 2. Score the demand system (company-type aware)
  const scoring = scoreDemandLab(analysis);

  console.log('[DemandLab V2] Scoring complete:', {
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    issueCount: scoring.issues.length,
  });

  // 3. Generate narrative summary
  const narrativeSummary = generateDemandNarrative({
    dimensions: scoring.dimensions,
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
  });

  // 4. Build quick wins
  const quickWins = buildDemandQuickWins(scoring);

  // 5. Build projects
  const projects = buildDemandProjects(scoring);

  console.log('[DemandLab V2] Complete:', {
    issues: scoring.issues.length,
    quickWins: quickWins.length,
    projects: projects.length,
    pagesAnalyzed: analysis.findings?.pagesAnalyzed?.length ?? 0,
    ctasFound: analysis.findings?.ctasFound?.length ?? 0,
  });

  return {
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    dataConfidence: analysis.dataConfidence,
    narrativeSummary,
    dimensions: scoring.dimensions,
    issues: scoring.issues,
    quickWins,
    projects,
    analyticsSnapshot: analysis.analyticsSnapshot,
    findings: analysis.findings,
    generatedAt: new Date().toISOString(),
    companyId,
    url: websiteUrl,
    companyType: analysis.companyType,
  };
}

/**
 * Run Demand Lab and wrap result in engine result format
 */
export async function runDemandLabEngine(
  params: RunDemandLabParams
): Promise<DemandLabEngineResult> {
  try {
    const report = await runDemandLab(params);

    return {
      success: true,
      score: report.overallScore,
      summary: report.narrativeSummary,
      report,
    };
  } catch (error) {
    console.error('[DemandLab V2] Engine error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Quick Wins Builder (V2)
// ============================================================================

/**
 * Build quick wins from scoring results
 * V2: Improved with IDs and category-based recommendations
 */
function buildDemandQuickWins(scoring: ScoringOutput): DemandLabQuickWin[] {
  const wins: DemandLabQuickWin[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    action: string,
    impact: 'low' | 'medium' | 'high',
    effort: 'low' | 'medium' | 'high'
  ) => {
    wins.push({
      id: `dq-${idCounter++}`,
      category,
      action,
      expectedImpact: impact,
      effortLevel: effort,
    });
  };

  const channel = scoring.dimensions.find((d) => d.key === 'channelMix');
  const measurement = scoring.dimensions.find((d) => d.key === 'measurement');
  const funnel = scoring.dimensions.find((d) => d.key === 'funnel');
  const targeting = scoring.dimensions.find((d) => d.key === 'targeting');
  const creative = scoring.dimensions.find((d) => d.key === 'creative');

  // Channel Mix quick wins
  if (channel && channel.score < 60) {
    add(
      'Channel Mix',
      'Add at least one always-on demand channel (e.g. Google Search or Meta) aligned to your best-fit buyers.',
      'high',
      'medium'
    );
  }

  // Measurement quick wins
  if (measurement && measurement.score < 60) {
    add(
      'Measurement',
      'Define and configure 1–3 primary conversion events in GA4 (e.g. form submits, demo requests, purchases).',
      'high',
      'low'
    );
    add(
      'Measurement',
      'Standardize UTM naming across all major campaigns and channels.',
      'medium',
      'low'
    );
  }

  // Funnel quick wins
  if (funnel && funnel.score < 60) {
    add(
      'Funnel',
      'Create or refine a dedicated landing page for your primary offer with a single, clear CTA.',
      'high',
      'medium'
    );
  }

  // Targeting quick wins
  if (targeting && targeting.score < 60) {
    add(
      'Targeting',
      'Install retargeting pixels (Facebook, LinkedIn, Google) to re-engage site visitors.',
      'medium',
      'low'
    );
  }

  // Creative quick wins
  if (creative && creative.score < 60) {
    add(
      'Creative',
      'Rewrite primary CTA copy to be action-oriented and benefit-focused.',
      'medium',
      'low'
    );
  }

  // Limit to top 5 quick wins, sorted by impact
  return wins
    .sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.expectedImpact] - impactOrder[b.expectedImpact];
    })
    .slice(0, 5);
}

// ============================================================================
// Projects Builder (V2)
// ============================================================================

/**
 * Build strategic projects from scoring results
 * V2: Improved with IDs and strategic project recommendations based on weakest dimension
 */
function buildDemandProjects(scoring: ScoringOutput): DemandLabProject[] {
  const projects: DemandLabProject[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    title: string,
    description: string,
    impact: 'low' | 'medium' | 'high',
    timeHorizon: 'near-term' | 'mid-term' | 'long-term'
  ) => {
    projects.push({
      id: `dp-${idCounter++}`,
      category,
      title,
      description,
      impact,
      timeHorizon,
    });
  };

  // Find weakest dimension and create a strategic project
  const weakest = [...scoring.dimensions].sort((a, b) => a.score - b.score)[0];

  if (weakest) {
    if (weakest.key === 'channelMix') {
      add(
        'Channel Mix',
        'Design and launch a basic multi-channel demand engine',
        'Define 1–2 core demand channels, set clear targets, and launch campaigns with aligned offers and landing pages.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'measurement') {
      add(
        'Measurement',
        'Implement a demand measurement and optimization foundation',
        'Audit tracking, configure GA4 conversions, standardize UTMs, and set a basic experimentation cadence.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'funnel') {
      add(
        'Funnel',
        'Rebuild the demand funnel from click to conversion',
        'Map buyer journeys, simplify forms and CTAs, and add nurture steps to capture and progress demand.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'targeting') {
      add(
        'Targeting',
        'Build audience segmentation and targeting infrastructure',
        'Develop audience personas, create segment-specific landing pages, and implement retargeting layers.',
        'high',
        'mid-term'
      );
    } else if (weakest.key === 'creative') {
      add(
        'Creative',
        'Strengthen creative and messaging engine',
        'Audit value propositions, develop compelling CTAs, and implement creative testing framework.',
        'high',
        'mid-term'
      );
    }
  }

  // Add maturity-based projects
  if (scoring.maturityStage === 'unproven') {
    add(
      'Foundation',
      'Build demand generation foundation',
      'Establish core demand infrastructure: analytics, tracking, basic automation, and conversion paths. This foundational work enables all future optimization.',
      'high',
      'near-term'
    );
  } else if (scoring.maturityStage === 'emerging') {
    add(
      'Scale',
      'Scale successful demand channels',
      'Identify which channels are showing early traction and invest more heavily. Test adjacent channels while optimizing performers.',
      'high',
      'mid-term'
    );
  } else if (scoring.maturityStage === 'scaling') {
    add(
      'Optimization',
      'Optimize and expand demand channels',
      'Expand successful channels, test new acquisition strategies, and implement advanced targeting. Focus on efficiency and CAC optimization.',
      'high',
      'mid-term'
    );
  }

  // Add secondary projects for other weak dimensions
  const weakDimensions = scoring.dimensions.filter((d) => d.status === 'weak' && d.key !== weakest?.key);
  for (const dim of weakDimensions.slice(0, 2)) {
    const projectTemplates: Record<string, { title: string; description: string }> = {
      channel_mix: {
        title: 'Diversify Demand Channels',
        description: 'Audit current channel performance, identify gaps, and develop a multi-channel acquisition strategy.',
      },
      targeting: {
        title: 'Improve Audience Targeting',
        description: 'Develop audience segments, create targeted landing pages, and implement personalization.',
      },
      creative: {
        title: 'Strengthen Creative & Messaging',
        description: 'Audit CTAs, value propositions, and offers. Implement creative testing framework.',
      },
      funnel: {
        title: 'Optimize Conversion Funnel',
        description: 'Map and optimize the buyer journey. Add lead capture, reduce friction, and create clear conversion paths.',
      },
      measurement: {
        title: 'Build Measurement & Attribution',
        description: 'Implement comprehensive tracking, set up conversion goals, and build reporting dashboards.',
      },
    };

    const template = projectTemplates[dim.key];
    if (template) {
      add(dim.label, template.title, template.description, 'medium', 'mid-term');
    }
  }

  // Limit to top 5 projects
  return projects.slice(0, 5);
}
