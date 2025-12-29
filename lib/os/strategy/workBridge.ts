// lib/os/strategy/workBridge.ts
// Strategy → Work Bridge
//
// Helper functions for converting Strategy tactics into Work items.
// Deterministic mapping with no LLM usage.

import type { CompanyStrategy, Tactic, StrategyObjective, StrategicBet, TacticChannel } from '@/lib/types/strategy';
import type { StrategyLink, WorkstreamType } from '@/lib/types/work';
import type { CreateWorkItemInput, WorkItemArea } from '@/lib/airtable/workItems';

// ============================================================================
// Types
// ============================================================================

/**
 * Draft work item ready for creation
 */
export interface WorkItemDraft {
  title: string;
  description: string;
  strategyLink: StrategyLink;
  workstreamType: WorkstreamType;
  area: WorkItemArea;
}

/**
 * Context for building a work item from a tactic
 */
export interface TacticContext {
  strategy: CompanyStrategy;
  objective?: StrategyObjective;
  bet?: StrategicBet;
  tactic: Tactic;
}

// ============================================================================
// Workstream Type Classification
// ============================================================================

/**
 * Keywords for workstream type classification
 */
const WORKSTREAM_KEYWORDS: Record<WorkstreamType, string[]> = {
  paid_media: ['ads', 'paid', 'media', 'budget', 'campaign', 'ppc', 'spend', 'advertising', 'meta ads', 'google ads', 'linkedin ads'],
  content: ['content', 'case study', 'blog', 'article', 'guide', 'whitepaper', 'ebook', 'video', 'podcast', 'newsletter'],
  seo: ['seo', 'search', 'organic', 'keyword', 'ranking', 'serp', 'backlink', 'schema', 'technical seo'],
  email: ['email', 'newsletter', 'nurture', 'drip', 'automation', 'mailchimp', 'klaviyo'],
  website: ['website', 'landing page', 'homepage', 'web design', 'ux', 'cta', 'form'],
  brand: ['brand', 'messaging', 'positioning', 'identity', 'logo', 'voice', 'tone'],
  partnerships: ['partner', 'partnership', 'affiliate', 'referral', 'integration', 'co-marketing'],
  analytics: ['analytics', 'tracking', 'measurement', 'reporting', 'dashboard', 'attribution', 'ga4'],
  social: ['social', 'twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'social media'],
  conversion: ['conversion', 'cro', 'optimization', 'a/b test', 'funnel', 'checkout', 'cart'],
  ops: ['operations', 'process', 'workflow', 'automation', 'integration', 'ops'],
  other: [],
};

/**
 * Map TacticChannel to WorkstreamType
 */
const CHANNEL_TO_WORKSTREAM: Record<TacticChannel, WorkstreamType> = {
  seo: 'seo',
  content: 'content',
  website: 'website',
  media: 'paid_media',
  social: 'social',
  email: 'email',
  brand: 'brand',
  analytics: 'analytics',
  conversion: 'conversion',
  other: 'other',
};

/**
 * Classify a tactic into a workstream type
 * Uses deterministic keyword matching on title and description
 */
export function classifyWorkstreamType(tactic: Tactic): WorkstreamType {
  // First, check if tactic has explicit channels
  if (tactic.channels && tactic.channels.length > 0) {
    // Use the first channel as the primary workstream type
    return CHANNEL_TO_WORKSTREAM[tactic.channels[0]] || 'other';
  }

  // Otherwise, use keyword matching on title and description
  const text = `${tactic.title} ${tactic.description || ''}`.toLowerCase();

  // Check each workstream type in priority order
  const priorityOrder: WorkstreamType[] = [
    'paid_media', // Check paid_media first (most specific)
    'seo',
    'email',
    'content',
    'website',
    'brand',
    'partnerships',
    'analytics',
    'other',
  ];

  for (const workstreamType of priorityOrder) {
    const keywords = WORKSTREAM_KEYWORDS[workstreamType];
    if (keywords.some(keyword => text.includes(keyword))) {
      return workstreamType;
    }
  }

  return 'other';
}

/**
 * Map WorkstreamType to WorkItemArea
 */
export function workstreamTypeToArea(workstreamType: WorkstreamType): WorkItemArea {
  const mapping: Record<WorkstreamType, WorkItemArea> = {
    content: 'Content',
    website: 'Website UX',
    seo: 'SEO',
    email: 'Content', // Email falls under Content area
    partnerships: 'Strategy',
    paid_media: 'Strategy', // Media planning is strategic
    social: 'Content', // Social falls under Content area
    brand: 'Brand',
    analytics: 'Analytics',
    conversion: 'Funnel', // CRO is funnel-focused
    ops: 'Operations',
    other: 'Other',
  };
  return mapping[workstreamType];
}

// ============================================================================
// Work Item Building
// ============================================================================

/**
 * Build a work item draft from a tactic
 */
export function buildWorkItemFromTactic(context: TacticContext): WorkItemDraft {
  const { strategy, objective, bet, tactic } = context;

  // Classify the workstream type
  const workstreamType = classifyWorkstreamType(tactic);
  const area = workstreamTypeToArea(workstreamType);

  // Build description with strategy context
  const descriptionParts: string[] = [];
  descriptionParts.push(`From Strategy: ${strategy.title || 'Untitled Strategy'}`);

  if (objective) {
    descriptionParts.push(`Objective: ${typeof objective === 'string' ? objective : objective.text}`);
  }

  if (bet) {
    descriptionParts.push(`Strategic Bet: ${bet.title}`);
  }

  if (tactic.description) {
    descriptionParts.push('');
    descriptionParts.push(tactic.description);
  }

  if (tactic.timeline) {
    descriptionParts.push(`Timeline: ${tactic.timeline}`);
  }

  // Build strategy link
  const strategyLink: StrategyLink = {
    strategyId: strategy.id,
    objectiveId: objective ? (typeof objective === 'string' ? undefined : objective.id) : undefined,
    betId: bet?.id,
    tacticId: tactic.id,
    tacticTitle: tactic.title,
  };

  return {
    title: tactic.title,
    description: descriptionParts.join('\n'),
    strategyLink,
    workstreamType,
    area,
  };
}

/**
 * Convert a work item draft to CreateWorkItemInput
 */
export function draftToCreateInput(
  draft: WorkItemDraft,
  companyId: string
): CreateWorkItemInput {
  return {
    title: draft.title,
    companyId,
    notes: draft.description,
    area: draft.area,
    severity: 'Medium',
    status: 'Backlog',
    strategyLink: draft.strategyLink,
    workstreamType: draft.workstreamType,
  };
}

// ============================================================================
// Idempotency Helpers
// ============================================================================

/**
 * Generate a stable key for idempotent work item creation
 */
export function stableWorkKey(strategyId: string, tacticId: string): string {
  return `strategy:${strategyId}:tactic:${tacticId}`;
}

/**
 * Check if a work item is linked to a specific tactic
 */
export function isWorkLinkedToTactic(
  strategyLink: StrategyLink | undefined,
  tacticId: string
): boolean {
  return strategyLink?.tacticId === tacticId;
}

/**
 * Check if a work item is linked to a specific strategy
 */
export function isWorkLinkedToStrategy(
  strategyLink: StrategyLink | undefined,
  strategyId: string
): boolean {
  return strategyLink?.strategyId === strategyId;
}

// ============================================================================
// Tactic Finder Helpers
// ============================================================================

/**
 * Find a tactic by ID in a strategy
 * Searches through all pillars and plays to find the tactic
 */
export function findTacticInStrategy(
  strategy: CompanyStrategy,
  tacticId: string
): { tactic: Tactic; objectiveId?: string; betId?: string } | null {
  // V7+ strategies may have tactics at the top level or nested
  // Check various locations based on strategy structure

  // For now, we'll need to look through pillars which may have plays
  // and each play may have tactics
  if (strategy.pillars) {
    for (const pillar of strategy.pillars) {
      // Check if pillar has plays with tactics
      // This depends on the actual structure - for now return null
      // The caller should pass the tactic directly
    }
  }

  // If the strategy has a "tactics" field directly (V7+ structure)
  // we would search there

  return null;
}

/**
 * Find a bet by ID in a strategy
 */
export function findBetInStrategy(
  strategy: CompanyStrategy,
  betId: string
): StrategicBet | null {
  // V7 strategies may have bets at various levels
  // This is a placeholder - the actual structure depends on the strategy version
  return null;
}

/**
 * Find an objective by ID in a strategy
 */
export function findObjectiveInStrategy(
  strategy: CompanyStrategy,
  objectiveId: string
): StrategyObjective | null {
  if (!strategy.objectives) return null;

  for (const obj of strategy.objectives) {
    if (typeof obj === 'string') continue;
    if (obj.id === objectiveId) return obj;
  }

  return null;
}

// ============================================================================
// Paid Media Detection
// ============================================================================

/**
 * Check if a tactic is classified as paid media
 */
export function isPaidMediaTactic(tactic: Tactic): boolean {
  return classifyWorkstreamType(tactic) === 'paid_media';
}

/**
 * Check if a work item is paid media
 */
export function isPaidMediaWorkItem(workstreamType: WorkstreamType | undefined): boolean {
  return workstreamType === 'paid_media';
}
