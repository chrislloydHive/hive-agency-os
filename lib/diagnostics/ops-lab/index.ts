// lib/diagnostics/ops-lab/index.ts
// Ops Lab V1 Main Entry Point
//
// This is the main orchestrator that:
// 1. Runs the analyzer to collect ops & analytics signals
// 2. Scores the ops readiness across 5 dimensions
// 3. Generates narrative summary
// 4. Builds quick wins and projects
// 5. Returns the complete OpsLabResult

import type {
  OpsLabResult,
  OpsLabEngineResult,
  OpsLabQuickWin,
  OpsLabProject,
  OpsLabAnalyzerInput,
} from './types';
import { analyzeOpsInputs, type OpsAnalyzerOutput } from './analyzer';
import { scoreOpsLab, type OpsScoringOutput } from './scoring';
import { generateOpsNarrative } from './narrative';

// Re-export types for convenience
export * from './types';

// ============================================================================
// Main Run Function
// ============================================================================

export interface RunOpsLabParams {
  companyId?: string;
  url: string;
  companyType?: string | null;
  workspaceId?: string;
  // Optional: Pre-collected data from other sources
  htmlSummary?: any;
  analyticsSummary?: any;
  techStackSignals?: any;
}

/**
 * Run Ops Lab diagnostic
 *
 * This is the main entry point that orchestrates:
 * 1. Signal collection (tracking tools, CRM, automation, experimentation)
 * 2. Scoring across 5 dimensions
 * 3. Narrative generation
 * 4. Quick wins and projects derivation
 */
export async function runOpsLab(params: RunOpsLabParams): Promise<OpsLabResult> {
  const {
    companyId,
    url,
    companyType,
    workspaceId,
    htmlSummary,
    analyticsSummary,
    techStackSignals,
  } = params;

  console.log('[OpsLab V1] Starting analysis:', { companyId, url, companyType });

  // 1. Collect ops signals
  const analyzerInput: OpsLabAnalyzerInput = {
    companyId,
    url,
    companyType,
    workspaceId,
    htmlSummary,
    analyticsSummary,
    techStackSignals,
  };
  const analysis = await analyzeOpsInputs(analyzerInput);

  console.log('[OpsLab V1] Analysis complete:', {
    trackingTools: analysis.trackingTools.length,
    hasCrm: analysis.hasCrm,
    hasAutomation: analysis.hasAutomationPlatform,
    hasExperimentation: analysis.hasExperimentationTool,
    dataConfidence: analysis.dataConfidence.level,
  });

  // 2. Score the ops system
  const scoring = scoreOpsLab(analysis);

  console.log('[OpsLab V1] Scoring complete:', {
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
    issueCount: scoring.issues.length,
  });

  // 3. Generate narrative summary
  const narrativeSummary = generateOpsNarrative({
    dimensions: scoring.dimensions,
    overallScore: scoring.overallScore,
    maturityStage: scoring.maturityStage,
  });

  // 4. Build quick wins
  const quickWins = buildOpsQuickWins(scoring, analysis);

  // 5. Build projects
  const projects = buildOpsProjects(scoring, analysis);

  console.log('[OpsLab V1] Complete:', {
    issues: scoring.issues.length,
    quickWins: quickWins.length,
    projects: projects.length,
  });

  return {
    companyId: companyId || '',
    companyType,
    url,
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
  };
}

/**
 * Run Ops Lab and wrap result in engine result format
 */
export async function runOpsLabEngine(
  params: RunOpsLabParams
): Promise<OpsLabEngineResult> {
  try {
    const report = await runOpsLab(params);

    return {
      success: true,
      score: report.overallScore,
      summary: report.narrativeSummary,
      report,
    };
  } catch (error) {
    console.error('[OpsLab V1] Engine error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Quick Wins Builder
// ============================================================================

/**
 * Build quick wins from scoring results
 */
function buildOpsQuickWins(
  scoring: OpsScoringOutput,
  analysis: OpsAnalyzerOutput
): OpsLabQuickWin[] {
  const wins: OpsLabQuickWin[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    action: string,
    impact: 'low' | 'medium' | 'high',
    effort: 'low' | 'medium' | 'high'
  ) => {
    wins.push({
      id: `oq-${idCounter++}`,
      category,
      action,
      expectedImpact: impact,
      effortLevel: effort,
    });
  };

  const tracking = scoring.dimensions.find((d) => d.key === 'tracking');
  const data = scoring.dimensions.find((d) => d.key === 'data');
  const crm = scoring.dimensions.find((d) => d.key === 'crm');
  const automation = scoring.dimensions.find((d) => d.key === 'automation');
  const experimentation = scoring.dimensions.find((d) => d.key === 'experimentation');

  // Tracking quick wins
  if (!analysis.hasGa4) {
    add(
      'Tracking',
      'Install and configure Google Analytics 4 with basic conversion events.',
      'high',
      'medium'
    );
  }
  if (!analysis.hasGtm && analysis.hasGa4) {
    add(
      'Tracking',
      'Set up Google Tag Manager for flexible tag deployment.',
      'medium',
      'low'
    );
  }
  if (!analysis.hasFacebookPixel && !analysis.hasLinkedinInsight) {
    add(
      'Tracking',
      'Install retargeting pixels (Facebook, LinkedIn) for paid media efficiency.',
      'medium',
      'low'
    );
  }

  // Data quality quick wins
  if (analysis.utmUsageLevel !== 'consistent') {
    add(
      'Data',
      'Standardize UTM naming conventions across all campaigns and channels.',
      'high',
      'low'
    );
  }

  // CRM quick wins
  if (!analysis.hasCrm && (crm?.score ?? 0) < 60) {
    add(
      'CRM',
      'Implement a CRM or connect existing CRM to website lead capture.',
      'high',
      'medium'
    );
  }

  // Automation quick wins
  if (!analysis.hasAutomationPlatform && (automation?.score ?? 0) < 50) {
    add(
      'Automation',
      'Set up basic email automation for lead nurturing.',
      'medium',
      'medium'
    );
  }

  // Experimentation quick wins
  if (!analysis.hasExperimentationTool && analysis.hasGa4) {
    add(
      'Experimentation',
      'Define 2-3 key conversion actions and create a simple testing roadmap.',
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
// Projects Builder
// ============================================================================

/**
 * Build strategic projects from scoring results
 */
function buildOpsProjects(
  scoring: OpsScoringOutput,
  analysis: OpsAnalyzerOutput
): OpsLabProject[] {
  const projects: OpsLabProject[] = [];
  let idCounter = 0;

  const add = (
    category: string,
    title: string,
    description: string,
    impact: 'low' | 'medium' | 'high',
    timeHorizon: 'near-term' | 'mid-term' | 'long-term'
  ) => {
    projects.push({
      id: `op-${idCounter++}`,
      category,
      title,
      description,
      impact,
      timeHorizon,
    });
  };

  // Find weakest dimension
  const weakest = [...scoring.dimensions].sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

  // Add project based on weakest dimension
  if (weakest) {
    const projectTemplates: Record<string, { title: string; description: string }> = {
      tracking: {
        title: 'Build Complete Tracking Infrastructure',
        description:
          'Implement GA4, GTM, and key advertising pixels. Configure conversion events and ensure data flows correctly.',
      },
      data: {
        title: 'Establish Data Governance Framework',
        description:
          'Create UTM naming standards, implement data validation, and build attribution reporting.',
      },
      crm: {
        title: 'Implement CRM & Pipeline Integration',
        description:
          'Connect CRM to marketing touchpoints. Build lead scoring and lifecycle stage tracking.',
      },
      automation: {
        title: 'Deploy Marketing Automation Platform',
        description:
          'Implement marketing automation for lead nurturing, email journeys, and behavioral triggers.',
      },
      experimentation: {
        title: 'Build Experimentation Capability',
        description:
          'Deploy A/B testing infrastructure. Create testing roadmap and establish experimentation culture.',
      },
    };

    const template = projectTemplates[weakest.key];
    if (template) {
      add(weakest.label, template.title, template.description, 'high', 'mid-term');
    }
  }

  // Add maturity-based projects
  if (scoring.maturityStage === 'unproven') {
    add(
      'Foundation',
      'Build Marketing Ops Foundation',
      'Establish core infrastructure: analytics, tracking, basic automation. This foundational work enables all future optimization.',
      'high',
      'near-term'
    );
  } else if (scoring.maturityStage === 'emerging') {
    add(
      'Integration',
      'Integrate Marketing & Sales Systems',
      'Connect marketing tools to CRM. Build unified view of the customer journey from first touch to close.',
      'high',
      'mid-term'
    );
  } else if (scoring.maturityStage === 'scaling') {
    add(
      'Optimization',
      'Optimize & Automate Marketing Operations',
      'Scale successful processes, automate repetitive tasks, and implement advanced attribution.',
      'high',
      'mid-term'
    );
  }

  // Add secondary projects for other weak dimensions
  const weakDimensions = scoring.dimensions.filter(
    (d) => d.status === 'weak' && d.key !== weakest?.key
  );
  for (const dim of weakDimensions.slice(0, 2)) {
    const projectTemplates: Record<string, { title: string; description: string }> = {
      tracking: {
        title: 'Strengthen Tracking Coverage',
        description: 'Fill tracking gaps, add missing pixels, and ensure complete data capture.',
      },
      data: {
        title: 'Improve Data Quality',
        description: 'Clean up data practices, standardize naming, and build quality dashboards.',
      },
      crm: {
        title: 'Enhance CRM Integration',
        description: 'Deepen CRM connections, improve lead routing, and add lifecycle automation.',
      },
      automation: {
        title: 'Expand Automation Capabilities',
        description: 'Add new automation workflows, build customer journeys, and reduce manual work.',
      },
      experimentation: {
        title: 'Launch Testing Program',
        description: 'Start systematic A/B testing, build testing backlog, and create learning loops.',
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
