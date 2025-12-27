// lib/os/artifacts/buildInputs.ts
// Build artifact generation inputs from strategy and plans
//
// Gathers context from:
// - Strategy (goal, objectives, tactics)
// - Context Graph (audience, positioning, value prop)
// - Plans (if generating from media/content plan)

import type { ContextGraph } from '@/lib/types/contextGraph';
import type { Strategy, StrategyPlay, StrategyObjective } from '@/lib/types/strategy';
import type { MediaPlan, ContentPlan, MediaPlanSections, ContentPlanSections } from '@/lib/types/plan';
import type { ArtifactGenerationContext } from './prompts';
import type { ArtifactSourceType } from './registry';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactSourceInput {
  sourceType: ArtifactSourceType;
  sourceId: string;
  /** Tactic IDs to include (if sourceType is 'strategy') */
  includedTacticIds?: string[];
}

export interface BuildInputsParams {
  source: ArtifactSourceInput;
  companyName: string;
  context: ContextGraph | null;
  strategy: Strategy | null;
  mediaPlan?: MediaPlan | null;
  contentPlan?: ContentPlan | null;
  promptHint?: string;
}

// ============================================================================
// Context Extraction Helpers
// ============================================================================

function getConfirmedValue(
  context: ContextGraph | null,
  domain: keyof ContextGraph,
  key: string
): string | null {
  if (!context) return null;
  const domainData = context[domain];
  if (!domainData || typeof domainData !== 'object') return null;
  const field = (domainData as Record<string, unknown>)[key];
  if (!field || typeof field !== 'object') return null;
  const fieldObj = field as { value?: string; status?: string };
  return fieldObj.value || null;
}

function extractObjectives(strategy: Strategy | null): Array<{ text: string; metric?: string; target?: string }> {
  if (!strategy?.objectives) return [];
  return strategy.objectives
    .filter((o): o is StrategyObjective & { status: 'active' } =>
      o.status === 'active' || o.status === 'draft'
    )
    .map(o => ({
      text: o.text,
      metric: o.metric,
      target: o.target,
    }));
}

function extractTactics(
  strategy: Strategy | null,
  includedTacticIds?: string[]
): Array<{
  title: string;
  description?: string;
  channels?: string[];
  status: string;
}> {
  if (!strategy?.plays) return [];

  let plays = strategy.plays;

  // Filter to included tactics if specified
  if (includedTacticIds && includedTacticIds.length > 0) {
    plays = plays.filter(p => includedTacticIds.includes(p.id));
  }

  // Only include active/proposed tactics by default
  return plays
    .filter(p => p.status === 'active' || p.status === 'proposed')
    .map(p => ({
      title: p.title,
      description: p.description,
      channels: p.channels,
      status: p.status,
    }));
}

// ============================================================================
// Plan Context Builders
// ============================================================================

function buildMediaPlanContext(plan: MediaPlan | null): Partial<ArtifactGenerationContext> {
  if (!plan) return {};

  const sections = plan.sections as MediaPlanSections;
  return {
    planSummary: sections.summary?.executiveSummary || undefined,
    planBudget: {
      monthly: sections.budget?.totalMonthly,
      quarterly: sections.budget?.totalQuarterly,
    },
    planChannels: sections.channelMix?.map(c => c.channel).filter(Boolean),
    planCampaigns: sections.campaigns?.map(c => ({
      name: c.name,
      channel: c.channel,
      objective: c.offer,
    })),
  };
}

function buildContentPlanContext(plan: ContentPlan | null): Partial<ArtifactGenerationContext> {
  if (!plan) return {};

  const sections = plan.sections as ContentPlanSections;
  return {
    planSummary: sections.summary?.editorialThesis || undefined,
    planChannels: sections.distribution?.channels?.map(c => c.channel).filter(Boolean),
  };
}

// ============================================================================
// Main Input Builder
// ============================================================================

/**
 * Build artifact generation context from source inputs
 */
export function buildArtifactInputs(params: BuildInputsParams): ArtifactGenerationContext {
  const { source, companyName, context, strategy, mediaPlan, contentPlan, promptHint } = params;

  // Base context from strategy + context graph
  const baseContext: ArtifactGenerationContext = {
    companyName,
    goalStatement: strategy?.goalStatement || undefined,
    positioning: getConfirmedValue(context, 'brand', 'positioning') || undefined,
    valueProposition: getConfirmedValue(context, 'productOffer', 'valueProposition') || undefined,
    primaryAudience: getConfirmedValue(context, 'audience', 'primaryAudience') || undefined,
    icpDescription: getConfirmedValue(context, 'audience', 'icpDescription') || undefined,
    strategyFrame: strategy?.strategyFrame || undefined,
    objectives: extractObjectives(strategy),
    tactics: extractTactics(strategy, source.includedTacticIds),
    promptHint,
  };

  // Merge plan-specific context based on source type
  if (source.sourceType === 'plan:media' || mediaPlan) {
    return { ...baseContext, ...buildMediaPlanContext(mediaPlan ?? null) };
  }

  if (source.sourceType === 'plan:content' || contentPlan) {
    return { ...baseContext, ...buildContentPlanContext(contentPlan ?? null) };
  }

  return baseContext;
}

/**
 * Create a hash of the inputs used for staleness tracking
 */
export function hashInputs(inputs: ArtifactGenerationContext): string {
  const relevantData = {
    goal: inputs.goalStatement,
    positioning: inputs.positioning,
    audience: inputs.primaryAudience,
    objectives: inputs.objectives.map(o => o.text).sort(),
    tactics: inputs.tactics.map(t => t.title).sort(),
  };

  // Simple hash using JSON string
  const str = JSON.stringify(relevantData);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Detect which tactic channels are present in the strategy
 */
export function detectTacticChannels(strategy: Strategy | null): {
  hasMediaTactics: boolean;
  hasContentTactics: boolean;
  hasSeoTactics: boolean;
  hasExperiments: boolean;
} {
  if (!strategy?.plays) {
    return {
      hasMediaTactics: false,
      hasContentTactics: false,
      hasSeoTactics: false,
      hasExperiments: false,
    };
  }

  const activePlays = strategy.plays.filter(p =>
    p.status === 'active' || p.status === 'proposed'
  );

  return {
    hasMediaTactics: activePlays.some(p =>
      p.channels?.some(c => ['media', 'social'].includes(c))
    ),
    hasContentTactics: activePlays.some(p =>
      p.channels?.some(c => ['content'].includes(c))
    ),
    hasSeoTactics: activePlays.some(p =>
      p.channels?.some(c => ['seo'].includes(c))
    ),
    hasExperiments: activePlays.some(p => p.status === 'proposed'),
  };
}
