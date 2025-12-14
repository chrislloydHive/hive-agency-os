// lib/os/programs/website/createWebsiteProgramSkeleton.ts
// Website Program Skeleton Generator
//
// Creates a default WebsiteProgramPlan based on available context.
// No AI required - uses simple heuristics to adapt the skeleton.
//
// Inputs (all optional, will use defaults if missing):
// - Context Graph excerpt (identity, audience, objectives, operationalConstraints, website)
// - Strategy excerpt (if exists)
// - Website Lab summary (if exists)

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type {
  WebsiteProgramPlan,
  ProgramPriority,
  ProgramPhase,
  ProgramReadinessGate,
  ProgramInputsSnapshot,
} from '@/lib/types/program';

// ============================================================================
// Input Types
// ============================================================================

export interface WebsiteProgramSkeletonInput {
  companyId: string;
  contextGraph?: CompanyContextGraph | null;
  strategyExcerpt?: StrategyExcerpt | null;
  websiteLabSummary?: WebsiteLabSummary | null;
}

export interface StrategyExcerpt {
  id?: string;
  title?: string;
  status?: string;
  primaryObjective?: string;
  positioning?: string;
}

export interface WebsiteLabSummary {
  runId?: string;
  runDate?: string;
  websiteScore?: number;
  executiveSummary?: string;
  criticalIssues?: string[];
  quickWins?: string[];
  conversionBlocks?: string[];
}

// ============================================================================
// Default Priorities
// ============================================================================

const DEFAULT_PRIORITIES: ProgramPriority[] = [
  {
    label: 'Messaging clarity',
    rationale: 'Ensure the value proposition is immediately clear to visitors.',
  },
  {
    label: 'CTA flow optimization',
    rationale: 'Reduce friction in the conversion path from landing to action.',
  },
  {
    label: 'Landing page structure',
    rationale: 'Align page structure with user intent and conversion goals.',
  },
];

// ============================================================================
// Default Phases
// ============================================================================

const DEFAULT_PHASES: ProgramPhase[] = [
  {
    phase: 'Phase 1: Fix fundamentals',
    items: [
      'Address critical technical issues',
      'Fix mobile responsiveness problems',
      'Ensure core pages load quickly',
    ],
  },
  {
    phase: 'Phase 2: Build conversion paths',
    items: [
      'Optimize primary CTAs',
      'Streamline form experience',
      'Create clear value proposition sections',
    ],
  },
  {
    phase: 'Phase 3: Optimize and measure',
    items: [
      'Implement conversion tracking',
      'Set up A/B testing framework',
      'Establish baseline metrics',
    ],
  },
];

// ============================================================================
// Default Readiness Gates
// ============================================================================

const DEFAULT_READINESS_GATES: ProgramReadinessGate[] = [
  {
    gate: 'Traffic-ready landing page exists',
    criteria: [
      'Page loads in under 3 seconds',
      'Mobile-responsive design verified',
      'Clear headline and value proposition',
      'Primary CTA visible above the fold',
    ],
  },
  {
    gate: 'Conversion tracking in place',
    criteria: [
      'Google Analytics or equivalent configured',
      'Goal/conversion events defined',
      'Form submission tracking active',
      'Phone call tracking configured (if applicable)',
    ],
  },
  {
    gate: 'Offer/message validated',
    criteria: [
      'Value proposition tested with target audience',
      'Pricing/offer clearly communicated',
      'Trust signals (reviews, testimonials) present',
    ],
  },
];

// ============================================================================
// Skeleton Generator
// ============================================================================

/**
 * Create a Website Program skeleton based on available inputs.
 * Uses simple keyword heuristics to adapt defaults - no AI required.
 */
export function createWebsiteProgramSkeleton(
  input: WebsiteProgramSkeletonInput
): WebsiteProgramPlan {
  const { companyId, contextGraph, strategyExcerpt, websiteLabSummary } = input;

  // Build priorities (adapt if we have website lab data)
  const priorities = buildPriorities(websiteLabSummary);

  // Build sequencing (adapt based on context)
  const sequencing = buildSequencing(contextGraph, websiteLabSummary);

  // Build readiness gates
  const readinessGates = buildReadinessGates(contextGraph);

  // Build title and summary
  const title = buildTitle(contextGraph, strategyExcerpt);
  const summary = buildSummary(contextGraph, strategyExcerpt);

  // Build inputs snapshot
  const inputsSnapshot = buildInputsSnapshot(
    companyId,
    contextGraph,
    strategyExcerpt,
    websiteLabSummary
  );

  return {
    title,
    summary,
    priorities,
    sequencing,
    readinessGates,
    inputsSnapshot,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildPriorities(
  websiteLabSummary?: WebsiteLabSummary | null
): ProgramPriority[] {
  // Start with defaults
  const priorities = [...DEFAULT_PRIORITIES];

  // If we have website lab data, adjust priorities based on findings
  if (websiteLabSummary) {
    const criticalIssues = websiteLabSummary.criticalIssues || [];
    const conversionBlocks = websiteLabSummary.conversionBlocks || [];
    const allIssues = [...criticalIssues, ...conversionBlocks].join(' ').toLowerCase();

    // Simple keyword heuristics to adjust priorities
    if (allIssues.includes('speed') || allIssues.includes('performance') || allIssues.includes('slow')) {
      priorities.unshift({
        label: 'Page speed optimization',
        rationale: 'Website Lab identified speed issues affecting user experience.',
      });
    }

    if (allIssues.includes('mobile') || allIssues.includes('responsive')) {
      const mobileIdx = priorities.findIndex(p => p.label.toLowerCase().includes('mobile'));
      if (mobileIdx === -1) {
        priorities.splice(1, 0, {
          label: 'Mobile experience',
          rationale: 'Website Lab identified mobile usability issues.',
        });
      }
    }

    if (allIssues.includes('form') || allIssues.includes('contact')) {
      priorities.push({
        label: 'Form optimization',
        rationale: 'Website Lab identified form experience issues.',
      });
    }

    // Keep only top 5 priorities
    return priorities.slice(0, 5);
  }

  return priorities;
}

function buildSequencing(
  contextGraph?: CompanyContextGraph | null,
  websiteLabSummary?: WebsiteLabSummary | null
): ProgramPhase[] {
  const phases = [...DEFAULT_PHASES];

  // Adjust Phase 1 if we have critical issues from website lab
  if (websiteLabSummary?.criticalIssues?.length) {
    phases[0] = {
      phase: 'Phase 1: Fix fundamentals',
      items: [
        ...websiteLabSummary.criticalIssues.slice(0, 3),
        ...phases[0].items.slice(0, 2),
      ].slice(0, 4),
    };
  }

  // Adjust Phase 2 if we have quick wins
  if (websiteLabSummary?.quickWins?.length) {
    phases[1] = {
      phase: 'Phase 2: Build conversion paths',
      items: [
        ...websiteLabSummary.quickWins.slice(0, 2),
        ...phases[1].items.slice(0, 2),
      ].slice(0, 4),
    };
  }

  // Check if analytics tracking is already in place from context
  const hasAnalytics = !!contextGraph?.digitalInfra?.ga4PropertyId?.value;
  if (hasAnalytics) {
    phases[2] = {
      phase: 'Phase 3: Optimize and measure',
      items: [
        'Review existing analytics configuration',
        'Set up A/B testing framework',
        'Establish baseline metrics',
        'Define KPI dashboards',
      ],
    };
  }

  return phases;
}

function buildReadinessGates(
  contextGraph?: CompanyContextGraph | null
): ProgramReadinessGate[] {
  const gates = [...DEFAULT_READINESS_GATES];

  // Adjust based on business type from context
  const businessModel = contextGraph?.identity?.businessModel?.value;
  const hasLeadGen = businessModel?.toLowerCase().includes('lead') ||
    businessModel?.toLowerCase().includes('service') ||
    businessModel?.toLowerCase().includes('b2b');

  if (hasLeadGen) {
    // Add lead-specific gate
    gates.push({
      gate: 'Lead capture optimized',
      criteria: [
        'Lead form tested and functional',
        'Thank you page with next steps',
        'Lead notification system active',
        'CRM integration verified (if applicable)',
      ],
    });
  }

  return gates;
}

function buildTitle(
  contextGraph?: CompanyContextGraph | null,
  strategyExcerpt?: StrategyExcerpt | null
): string {
  const companyName = contextGraph?.companyName || 'Company';
  const objective = strategyExcerpt?.primaryObjective ||
    contextGraph?.objectives?.primaryObjective?.value;

  if (objective) {
    // Create a title that references the objective
    const objectiveLower = objective.toLowerCase();
    if (objectiveLower.includes('lead') || objectiveLower.includes('conversion')) {
      return `${companyName} Website Conversion Program`;
    }
    if (objectiveLower.includes('traffic') || objectiveLower.includes('awareness')) {
      return `${companyName} Website Traffic & Engagement Program`;
    }
    if (objectiveLower.includes('sales') || objectiveLower.includes('revenue')) {
      return `${companyName} Website Sales Optimization Program`;
    }
  }

  return `${companyName} Website Program`;
}

function buildSummary(
  contextGraph?: CompanyContextGraph | null,
  strategyExcerpt?: StrategyExcerpt | null
): string {
  const parts: string[] = [
    'This program translates the strategy into prioritized website improvements.',
  ];

  // Add context-specific detail
  const primaryAudience = contextGraph?.audience?.primaryAudience?.value;
  if (primaryAudience) {
    parts.push(`Focus on optimizing the experience for ${primaryAudience}.`);
  }

  const objective = strategyExcerpt?.primaryObjective ||
    contextGraph?.objectives?.primaryObjective?.value;
  if (objective) {
    parts.push(`Primary goal: ${objective}.`);
  }

  return parts.join(' ');
}

function buildInputsSnapshot(
  companyId: string,
  contextGraph?: CompanyContextGraph | null,
  strategyExcerpt?: StrategyExcerpt | null,
  websiteLabSummary?: WebsiteLabSummary | null
): ProgramInputsSnapshot {
  return {
    companyId,
    contextRevisionId: contextGraph?.meta?.lastSnapshotId || undefined,
    strategyId: strategyExcerpt?.id,
    websiteLabRunId: websiteLabSummary?.runId,
    websiteLabSummary: websiteLabSummary?.executiveSummary?.slice(0, 500),
    constraints: {
      minBudget: contextGraph?.operationalConstraints?.minBudget?.value || undefined,
      maxBudget: contextGraph?.operationalConstraints?.maxBudget?.value || undefined,
      timeline: contextGraph?.operationalConstraints?.launchDeadlines?.value?.[0] || undefined,
    },
    capturedAt: new Date().toISOString(),
  };
}

