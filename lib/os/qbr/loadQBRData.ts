// lib/os/qbr/loadQBRData.ts
// QBR Story View - Data Loader
//
// Pulls from existing stored outputs to build QBR narrative.
// NO new AI calls - read-only synthesis.

import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyContext } from '@/lib/os/context';
import { getActiveStrategy } from '@/lib/os/strategy';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import type {
  QBRData,
  ExecutiveBullet,
  CurrentStateSnapshot,
  WhatChanged,
  DecisionsMade,
  WhatsNext,
  RisksAndConfidence,
  DataFreshness,
} from './types';

// ============================================================================
// Main Loader
// ============================================================================

/**
 * Load all data needed for QBR Story View
 */
export async function loadQBRData(companyId: string): Promise<QBRData | null> {
  try {
    // Load company info
    const company = await getCompanyById(companyId);
    if (!company) {
      return null;
    }

    // Load all data sources in parallel
    const [context, strategy, graph, competitionRun] = await Promise.all([
      getCompanyContext(companyId).catch(() => null),
      getActiveStrategy(companyId).catch(() => null),
      loadContextGraph(companyId).catch(() => null),
      getLatestCompetitionRunV3(companyId).catch(() => null),
    ]);

    const dataSources: string[] = [];
    if (context) dataSources.push('Context');
    if (strategy) dataSources.push('Strategy');
    if (graph) dataSources.push('Context Graph');
    if (competitionRun) dataSources.push('Competition Analysis');

    // Build each section
    const currentState = buildCurrentState(context, competitionRun, graph);
    const decisionsMade = buildDecisionsMade(strategy, graph);
    const whatsNext = buildWhatsNext(graph);
    const risksAndConfidence = buildRisksAndConfidence(graph, strategy);
    const whatChanged = buildWhatChanged(strategy, graph);
    const executiveSummary = buildExecutiveSummary(currentState, decisionsMade, whatsNext, risksAndConfidence);
    const dataFreshness = buildDataFreshness(context, strategy, competitionRun, graph);

    return {
      companyId,
      companyName: company.name || 'Unknown Company',
      generatedAt: new Date().toISOString(),
      executiveSummary,
      currentState,
      whatChanged,
      decisionsMade,
      whatsNext,
      risksAndConfidence,
      dataFreshness,
      dataSources,
    };
  } catch (error) {
    console.error('[QBR] Failed to load data:', error);
    return null;
  }
}

// ============================================================================
// Section Builders
// ============================================================================

function buildCurrentState(
  context: Awaited<ReturnType<typeof getCompanyContext>> | null,
  competitionRun: Awaited<ReturnType<typeof getLatestCompetitionRunV3>> | null,
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null
): CurrentStateSnapshot {
  // Extract category from competitors or insights
  const competitiveCategory = competitionRun?.summary
    ? `${competitionRun.summary.totalCompetitors} competitors identified`
    : undefined;

  return {
    businessModel: context?.businessModel || undefined,
    valueProposition: context?.valueProposition || undefined,
    primaryAudience: context?.primaryAudience || graph?.audience?.primaryAudience?.value || undefined,

    // Competition
    competitiveCategory,
    competitivePositioning: competitionRun?.insights?.[0]?.description || undefined,
    topCompetitors: competitionRun?.competitors?.slice(0, 5).map(c => c.name) || undefined,

    // Audience
    primarySegment: graph?.audience?.primaryAudience?.value || context?.primaryAudience || undefined,
    audienceInsight: graph?.audience?.behavioralDrivers?.value?.[0] ||
      (context?.primaryAudience ? `Primary focus: ${context.primaryAudience}` : undefined),
  };
}

function buildWhatChanged(
  strategy: Awaited<ReturnType<typeof getActiveStrategy>> | null,
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null
): WhatChanged {
  const strategyUpdates: string[] = [];
  const majorAssumptions: string[] = [];

  // Extract strategy updates
  if (strategy?.summary) {
    strategyUpdates.push(strategy.summary);
  }
  if (strategy?.pillars?.length) {
    strategyUpdates.push(`${strategy.pillars.length} strategic pillars defined`);
  }

  // Extract assumptions from creative or media guidance
  const messaging = graph?.creative?.messaging?.value;
  if (messaging?.keyPillars?.length) {
    majorAssumptions.push(`Key messaging pillars: ${messaging.keyPillars.slice(0, 3).join(', ')}`);
  }

  // Media scenario
  const mediaScenario = graph?.performanceMedia?.mediaSummary?.value;

  return {
    strategyUpdates,
    mediaScenarioSelected: mediaScenario || undefined,
    majorAssumptions,
  };
}

function buildDecisionsMade(
  strategy: Awaited<ReturnType<typeof getActiveStrategy>> | null,
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null
): DecisionsMade {
  // Strategy pillars
  const strategyPillars = strategy?.pillars?.map(p => ({
    title: p.title,
    description: p.description,
    priority: p.priority,
  })) || [];

  // Media approach from context graph
  const activeChannels = graph?.performanceMedia?.activeChannels?.value || [];
  const topChannel = graph?.performanceMedia?.topPerformingChannel?.value;
  const mediaObjective = graph?.performanceMedia?.mediaSummary?.value;

  const mediaApproach = activeChannels.length > 0 ? {
    objective: mediaObjective || undefined,
    topChannels: activeChannels.slice(0, 3),
    budgetFocus: topChannel ? `Focus on ${topChannel}` : undefined,
  } : undefined;

  // Execution priorities from objectives
  const executionPriorities = strategy?.objectives?.slice(0, 5) || [];

  return {
    strategyPillars,
    mediaApproach,
    executionPriorities,
  };
}

function buildWhatsNext(
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null
): WhatsNext {
  // These would ideally come from stored Execution Lab output
  // For now, derive from available data
  const days30: string[] = [];
  const days60: string[] = [];
  const days90: string[] = [];

  // Check for any stored execution data in the graph
  // Since we don't have dedicated storage yet, we'll derive from performance media
  const topChannel = graph?.performanceMedia?.topPerformingChannel?.value;
  if (topChannel) {
    days30.push(`Optimize ${topChannel} performance`);
  }

  const underperforming = graph?.performanceMedia?.underperformingChannels?.value;
  if (underperforming?.length) {
    days60.push(`Address underperforming channels: ${underperforming.slice(0, 2).join(', ')}`);
  }

  // Work items would come from Work V2 storage
  // Placeholder for now
  const topWorkItems: WhatsNext['topWorkItems'] = [];

  return {
    days30,
    days60,
    days90,
    topWorkItems,
  };
}

function buildRisksAndConfidence(
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>> | null
): RisksAndConfidence {
  const keyRisks: string[] = [];
  const needsValidation: string[] = [];

  // Check for data gaps
  if (!graph?.audience?.primaryAudience?.value) {
    needsValidation.push('Primary audience definition needs validation');
  }

  if (!strategy?.pillars?.length) {
    keyRisks.push('No strategic pillars defined - execution may lack focus');
  }

  const activeChannels = graph?.performanceMedia?.activeChannels?.value;
  if (!activeChannels?.length) {
    keyRisks.push('No active media channels - media strategy needs implementation');
  }

  // Check completeness score
  const completeness = graph?.meta?.completenessScore;
  if (completeness && completeness < 50) {
    needsValidation.push(`Context Graph ${completeness}% complete - additional context needed`);
  }

  return {
    keyRisks,
    needsValidation,
  };
}

function buildExecutiveSummary(
  currentState: CurrentStateSnapshot,
  decisionsMade: DecisionsMade,
  whatsNext: WhatsNext,
  risks: RisksAndConfidence
): ExecutiveBullet[] {
  const bullets: ExecutiveBullet[] = [];

  // Add insight about current position
  if (currentState.competitivePositioning) {
    bullets.push({
      text: currentState.competitivePositioning,
      category: 'insight',
    });
  } else if (currentState.valueProposition) {
    bullets.push({
      text: `Value proposition: ${currentState.valueProposition}`,
      category: 'insight',
    });
  }

  // Add strategy decision
  if (decisionsMade.strategyPillars.length > 0) {
    const topPillar = decisionsMade.strategyPillars.find(p => p.priority === 'high') || decisionsMade.strategyPillars[0];
    bullets.push({
      text: `Primary strategic focus: ${topPillar.title}`,
      category: 'decision',
    });
  }

  // Add media approach
  if (decisionsMade.mediaApproach?.topChannels?.length) {
    bullets.push({
      text: `Media priority: ${decisionsMade.mediaApproach.topChannels.slice(0, 2).join(', ')}`,
      category: 'decision',
    });
  }

  // Add opportunity
  if (whatsNext.days30.length > 0) {
    bullets.push({
      text: `Near-term priority: ${whatsNext.days30[0]}`,
      category: 'opportunity',
    });
  }

  // Add risk
  if (risks.keyRisks.length > 0) {
    bullets.push({
      text: risks.keyRisks[0],
      category: 'risk',
    });
  }

  // Ensure we have at least 3 bullets
  if (bullets.length < 3 && currentState.primaryAudience) {
    bullets.push({
      text: `Target audience: ${currentState.primaryAudience}`,
      category: 'insight',
    });
  }

  return bullets.slice(0, 5);
}

function buildDataFreshness(
  context: Awaited<ReturnType<typeof getCompanyContext>> | null,
  strategy: Awaited<ReturnType<typeof getActiveStrategy>> | null,
  competitionRun: Awaited<ReturnType<typeof getLatestCompetitionRunV3>> | null,
  graph: Awaited<ReturnType<typeof loadContextGraph>> | null
): DataFreshness {
  return {
    contextUpdatedAt: context?.updatedAt || undefined,
    strategyUpdatedAt: strategy?.updatedAt || undefined,
    competitionUpdatedAt: competitionRun?.completedAt || undefined,
    labsUpdatedAt: graph?.meta?.updatedAt || undefined,
  };
}
