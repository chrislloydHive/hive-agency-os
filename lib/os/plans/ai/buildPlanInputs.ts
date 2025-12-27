// lib/os/plans/ai/buildPlanInputs.ts
// Gathers context and strategy inputs for plan generation

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { CompanyStrategy, StrategyObjective } from '@/lib/types/strategy';
import type { PlanType } from '@/lib/types/plan';

/**
 * Structured inputs for plan generation
 */
export interface PlanGenerationInputs {
  // Company identity
  companyName: string | null;
  businessModel: string | null;
  positioning: string | null;

  // Audience
  primaryAudience: string | null;
  icpDescription: string | null;
  painPoints: string[];

  // Product/Offer
  valueProposition: string | null;
  mainOffer: string | null;

  // Strategy
  goalStatement: string | null;
  strategyFrame: string | null;
  objectives: string[];
  acceptedBets: string[];

  // Additional context for media plans
  budgetRange: string | null;
  channels: string[];

  // Additional context for content plans
  contentThemes: string[];
  seoFocus: string | null;

  // Meta
  planType: PlanType;
  mode: 'create' | 'refresh';
  existingPlanSummary?: string;
}

/**
 * Extract confirmed field value from context graph
 */
function getConfirmedValue(
  context: CompanyContextGraph | null,
  domain: keyof CompanyContextGraph,
  key: string
): string | null {
  if (!context) return null;
  const domainData = context[domain];
  if (!domainData || typeof domainData !== 'object') return null;
  const field = (domainData as Record<string, unknown>)[key];
  if (!field || typeof field !== 'object') return null;
  const fieldObj = field as { value?: string; status?: string };
  // Return value if confirmed (status === 'confirmed' or has a value)
  return fieldObj.value || null;
}

/**
 * Extract array from confirmed field
 */
function getConfirmedArray(
  context: CompanyContextGraph | null,
  domain: keyof CompanyContextGraph,
  key: string
): string[] {
  if (!context) return [];
  const domainData = context[domain];
  if (!domainData || typeof domainData !== 'object') return [];
  const field = (domainData as Record<string, unknown>)[key];
  if (!field || typeof field !== 'object') return [];
  const fieldObj = field as { value?: string[] };
  return fieldObj.value || [];
}

/**
 * Build inputs from context and strategy for plan generation
 */
export function buildPlanInputs(
  context: CompanyContextGraph | null,
  strategy: CompanyStrategy | null,
  planType: PlanType,
  mode: 'create' | 'refresh' = 'create',
  existingPlanSummary?: string
): PlanGenerationInputs {
  // Extract strategy data - handle legacy string[] and StrategyObjective[]
  let objectives: string[] = [];
  if (strategy?.objectives && strategy.objectives.length > 0) {
    if (typeof strategy.objectives[0] === 'string') {
      // Legacy string[] format
      objectives = strategy.objectives as string[];
    } else {
      // StrategyObjective[] format
      objectives = (strategy.objectives as StrategyObjective[])
        .filter(o => o.status === 'active' || o.status === 'draft')
        .map(o => o.text);
    }
  }

  const acceptedBets = (strategy?.pillars || [])
    .filter(p => p.status === 'active' || p.status === 'completed')
    .map(p => `${p.title}: ${p.description || ''}`.trim());

  // Extract from context domains
  const channels: string[] = [];
  const contentThemes: string[] = [];

  // Try to get content themes from bets
  if (planType === 'content') {
    const contentBets = (strategy?.pillars || [])
      .filter(p => p.status === 'active' || p.status === 'completed')
      .filter(p =>
        p.title?.toLowerCase().includes('content') ||
        p.description?.toLowerCase().includes('content')
      )
      .map(p => p.title);
    contentThemes.push(...contentBets);
  }

  return {
    // Company identity
    companyName: getConfirmedValue(context, 'identity', 'companyName'),
    businessModel: getConfirmedValue(context, 'identity', 'businessModel'),
    positioning: getConfirmedValue(context, 'brand', 'positioning'),

    // Audience
    primaryAudience: getConfirmedValue(context, 'audience', 'primaryAudience'),
    icpDescription: getConfirmedValue(context, 'audience', 'icpDescription'),
    painPoints: getConfirmedArray(context, 'audience', 'painPoints'),

    // Product/Offer
    valueProposition: getConfirmedValue(context, 'productOffer', 'valueProposition'),
    mainOffer: getConfirmedValue(context, 'productOffer', 'mainOffer'),

    // Strategy
    goalStatement: strategy?.goalStatement || null,
    strategyFrame: strategy?.strategyFrame ? JSON.stringify(strategy.strategyFrame) : null,
    objectives,
    acceptedBets,

    // Additional context for media plans
    budgetRange: getConfirmedValue(context, 'productOffer', 'budgetRange') || null,
    channels,

    // Additional context for content plans
    contentThemes,
    seoFocus: getConfirmedValue(context, 'seo', 'seoFocus'),

    // Meta
    planType,
    mode,
    existingPlanSummary,
  };
}

/**
 * Format inputs as a prompt section
 */
export function formatInputsForPrompt(inputs: PlanGenerationInputs): string {
  const sections: string[] = [];

  // Company Context
  if (inputs.companyName || inputs.businessModel || inputs.positioning) {
    sections.push(`## Company Context
- Company: ${inputs.companyName || 'Unknown'}
- Business Model: ${inputs.businessModel || 'Not specified'}
- Positioning: ${inputs.positioning || 'Not specified'}`);
  }

  // Target Audience
  if (inputs.primaryAudience || inputs.icpDescription || inputs.painPoints.length > 0) {
    sections.push(`## Target Audience
- Primary Audience: ${inputs.primaryAudience || 'Not specified'}
- ICP Description: ${inputs.icpDescription || 'Not specified'}
- Pain Points: ${inputs.painPoints.length > 0 ? inputs.painPoints.join(', ') : 'Not specified'}`);
  }

  // Product/Offer
  if (inputs.valueProposition || inputs.mainOffer) {
    sections.push(`## Product/Offer
- Value Proposition: ${inputs.valueProposition || 'Not specified'}
- Main Offer: ${inputs.mainOffer || 'Not specified'}`);
  }

  // Strategy
  if (inputs.goalStatement || inputs.strategyFrame || inputs.objectives.length > 0 || inputs.acceptedBets.length > 0) {
    let strategySection = `## Strategy`;
    if (inputs.goalStatement) {
      strategySection += `\n- Goal Statement: ${inputs.goalStatement}`;
    }
    if (inputs.strategyFrame) {
      strategySection += `\n- Strategy Frame: ${inputs.strategyFrame}`;
    }
    if (inputs.objectives.length > 0) {
      strategySection += `\n- Objectives:\n${inputs.objectives.map(o => `  - ${o}`).join('\n')}`;
    }
    if (inputs.acceptedBets.length > 0) {
      strategySection += `\n- Accepted Bets:\n${inputs.acceptedBets.map(b => `  - ${b}`).join('\n')}`;
    }
    sections.push(strategySection);
  }

  // Plan-specific context
  if (inputs.planType === 'media') {
    if (inputs.budgetRange || inputs.channels.length > 0) {
      sections.push(`## Media Context
- Budget Range: ${inputs.budgetRange || 'Not specified'}
- Known Channels: ${inputs.channels.length > 0 ? inputs.channels.join(', ') : 'Not specified'}`);
    }
  } else {
    if (inputs.contentThemes.length > 0 || inputs.seoFocus) {
      sections.push(`## Content Context
- Content Themes: ${inputs.contentThemes.length > 0 ? inputs.contentThemes.join(', ') : 'Not specified'}
- SEO Focus: ${inputs.seoFocus || 'Not specified'}`);
    }
  }

  // Existing plan summary for refresh mode
  if (inputs.mode === 'refresh' && inputs.existingPlanSummary) {
    sections.push(`## Existing Plan Summary
${inputs.existingPlanSummary}

Note: This is a refresh. Update the plan based on any changes in context or strategy while preserving sections that are still valid.`);
  }

  return sections.join('\n\n');
}
