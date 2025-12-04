// lib/contextGraph/intent/router.ts
// Intent routing engine
//
// Phase 4: Routes classified intents to appropriate agents

import { randomUUID } from 'crypto';
import type { CompanyContextGraph, DomainName } from '../companyContextGraph';
import type {
  ClassifiedIntent,
  IntentType,
  AgentType,
  AgentCapability,
  RouteDecision,
  AgentAction,
  AutonomyLevel,
} from './types';

// ============================================================================
// Agent Definitions
// ============================================================================

const AGENT_CAPABILITIES: AgentCapability[] = [
  {
    agentType: 'media_agent',
    name: 'Media Optimization Agent',
    description: 'Optimizes media plans, analyzes channel performance, and forecasts spend',
    supportedIntents: [
      'optimize_media_plan',
      'diagnose_media_performance',
      'create_media_plan',
      'forecast_media_spend',
      'analyze_channel_performance',
    ],
    supportedDomains: ['performanceMedia', 'budgetOps', 'historical'],
    requiredContext: ['performanceMedia.channels', 'performanceMedia.targetCpa'],
    optionalContext: ['historical.pastCampaigns', 'budgetOps.monthlyBudget'],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'semi_autonomous',
  },
  {
    agentType: 'creative_agent',
    name: 'Creative Strategy Agent',
    description: 'Creates briefs, optimizes messaging, and analyzes creative performance',
    supportedIntents: [
      'create_creative_brief',
      'optimize_creative_angles',
      'diagnose_creative_fatigue',
      'analyze_creative_performance',
    ],
    supportedDomains: ['creative', 'brand', 'audience'],
    requiredContext: ['brand.positioning', 'audience.primaryAudience'],
    optionalContext: ['creative.messagingAngles', 'brand.differentiators'],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'semi_autonomous',
  },
  {
    agentType: 'audience_agent',
    name: 'Audience Intelligence Agent',
    description: 'Updates segments, creates personas, and analyzes audience behavior',
    supportedIntents: [
      'update_audience_segments',
      'diagnose_audience_fit',
      'create_personas',
      'analyze_audience_behavior',
    ],
    supportedDomains: ['audience'],
    requiredContext: ['audience.primaryAudience'],
    optionalContext: ['audience.secondaryAudiences', 'audience.buyerJourney'],
    canAutoExecute: true,
    requiresApproval: false,
    maxAutonomyLevel: 'fully_autonomous',
  },
  {
    agentType: 'seo_agent',
    name: 'SEO Strategy Agent',
    description: 'Diagnoses SEO issues, optimizes keywords, and analyzes visibility',
    supportedIntents: [
      'diagnose_seo_issues',
      'optimize_keyword_strategy',
      'analyze_search_visibility',
      'forecast_seo_impact',
    ],
    supportedDomains: ['seo', 'content', 'website'],
    requiredContext: ['seo.primaryKeywords'],
    optionalContext: ['website.siteSpeed', 'content.contentPillars'],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'ai_assisted',
  },
  {
    agentType: 'brand_agent',
    name: 'Brand Strategy Agent',
    description: 'Updates positioning, ensures consistency, and analyzes perception',
    supportedIntents: [
      'update_brand_positioning',
      'diagnose_brand_consistency',
      'analyze_brand_perception',
    ],
    supportedDomains: ['brand', 'identity'],
    requiredContext: ['identity.companyName'],
    optionalContext: ['brand.positioning', 'brand.voiceTone'],
    canAutoExecute: false,
    requiresApproval: true,
    maxAutonomyLevel: 'manual_only',
  },
  {
    agentType: 'strategy_agent',
    name: 'Strategic Planning Agent',
    description: 'Analyzes competitive landscape, forecasts seasonality, identifies gaps',
    supportedIntents: [
      'analyze_competitive_landscape',
      'forecast_seasonality',
      'diagnose_strategy_gaps',
    ],
    supportedDomains: ['competitive', 'objectives', 'historical'],
    requiredContext: ['objectives.primaryGoal'],
    optionalContext: ['competitive.mainCompetitors', 'historical.pastCampaigns'],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'ai_assisted',
  },
  {
    agentType: 'executive_summary_agent',
    name: 'Executive Summary Agent',
    description: 'Creates high-level summaries and strategic narratives',
    supportedIntents: ['create_executive_summary'],
    supportedDomains: ['objectives', 'performanceMedia', 'brand', 'audience'],
    requiredContext: ['identity.companyName', 'objectives.primaryGoal'],
    optionalContext: ['performanceMedia.targetCpa', 'brand.positioning'],
    canAutoExecute: true,
    requiresApproval: false,
    maxAutonomyLevel: 'fully_autonomous',
  },
  {
    agentType: 'diagnostic_agent',
    name: 'Diagnostic Agent',
    description: 'General-purpose diagnostic and analysis agent',
    supportedIntents: [],  // Handles unknown intents
    supportedDomains: [],  // Can work with any domain
    requiredContext: [],
    optionalContext: [],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'ai_assisted',
  },
  {
    agentType: 'context_graph_agent',
    name: 'Context Graph Agent',
    description: 'Fixes inconsistencies, updates stale fields, explains values',
    supportedIntents: [
      'fix_inconsistent_data',
      'update_stale_fields',
      'explain_field_value',
      'compare_snapshots',
    ],
    supportedDomains: [],  // Works across all domains
    requiredContext: [],
    optionalContext: [],
    canAutoExecute: true,
    requiresApproval: true,
    maxAutonomyLevel: 'semi_autonomous',
  },
];

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Route an intent to the appropriate agent(s)
 */
export function routeIntent(
  intent: ClassifiedIntent,
  graph: CompanyContextGraph,
  autonomyLevel: AutonomyLevel = 'ai_assisted'
): RouteDecision {
  // Find primary agent
  const primaryAgent = findBestAgent(intent);
  const primaryCapability = AGENT_CAPABILITIES.find(a => a.agentType === primaryAgent);

  // Find alternative agents
  const alternatives = findAlternativeAgents(intent, primaryAgent);

  // Check context requirements
  const contextCheck = checkContextRequirements(primaryCapability!, graph);

  // Generate action plan
  const actions = generateActionPlan(intent, primaryAgent, graph);

  // Determine if we can auto-execute
  const canAutoExecute =
    primaryCapability?.canAutoExecute === true &&
    contextCheck.missingContext.length === 0 &&
    isAutonomyAllowed(primaryCapability.maxAutonomyLevel, autonomyLevel);

  const requiresApproval =
    primaryCapability?.requiresApproval === true ||
    !canAutoExecute ||
    autonomyLevel === 'manual_only';

  return {
    intent,
    primaryAgent,
    primaryAgentConfidence: calculateAgentConfidence(intent, primaryCapability!),
    alternativeAgents: alternatives,
    suggestedActions: actions,
    missingContext: contextCheck.missingContext,
    recommendedPrefill: contextCheck.recommendedPrefill,
    canAutoExecute,
    requiresApproval,
    approvalReason: requiresApproval
      ? getApprovalReason(intent, primaryCapability!, contextCheck)
      : undefined,
  };
}

function findBestAgent(intent: ClassifiedIntent): AgentType {
  // First, try to find an agent that supports this specific intent
  for (const capability of AGENT_CAPABILITIES) {
    if (capability.supportedIntents.includes(intent.type)) {
      return capability.agentType;
    }
  }

  // If no specific match, find agent by domain
  for (const domain of intent.targetDomains) {
    for (const capability of AGENT_CAPABILITIES) {
      if (capability.supportedDomains.includes(domain)) {
        return capability.agentType;
      }
    }
  }

  // Fall back to diagnostic agent
  return 'diagnostic_agent';
}

function findAlternativeAgents(
  intent: ClassifiedIntent,
  primaryAgent: AgentType
): Array<{ agent: AgentType; confidence: number; reason: string }> {
  const alternatives: Array<{ agent: AgentType; confidence: number; reason: string }> = [];

  for (const capability of AGENT_CAPABILITIES) {
    if (capability.agentType === primaryAgent) continue;

    // Check domain overlap
    const domainOverlap = intent.targetDomains.filter(d =>
      capability.supportedDomains.includes(d)
    );

    if (domainOverlap.length > 0) {
      alternatives.push({
        agent: capability.agentType,
        confidence: domainOverlap.length / intent.targetDomains.length,
        reason: `Also handles ${domainOverlap.join(', ')} domains`,
      });
    }
  }

  return alternatives
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function checkContextRequirements(
  capability: AgentCapability,
  graph: CompanyContextGraph
): {
  missingContext: string[];
  recommendedPrefill: string[];
} {
  const missingContext: string[] = [];
  const recommendedPrefill: string[] = [];

  // Check required context
  for (const path of capability.requiredContext) {
    const value = getValueByPath(graph, path);
    if (value === null || value === undefined) {
      missingContext.push(path);
    }
  }

  // Check optional context for recommendations
  for (const path of capability.optionalContext) {
    const value = getValueByPath(graph, path);
    if (value === null || value === undefined) {
      recommendedPrefill.push(path);
    }
  }

  return { missingContext, recommendedPrefill };
}

function calculateAgentConfidence(
  intent: ClassifiedIntent,
  capability: AgentCapability
): number {
  let confidence = intent.confidence;

  // Boost if agent directly supports this intent
  if (capability.supportedIntents.includes(intent.type)) {
    confidence = Math.min(1, confidence * 1.2);
  }

  // Boost if all domains are supported
  const allDomainsSupported = intent.targetDomains.every(d =>
    capability.supportedDomains.includes(d) || capability.supportedDomains.length === 0
  );
  if (allDomainsSupported) {
    confidence = Math.min(1, confidence * 1.1);
  }

  return Math.round(confidence * 100) / 100;
}

function isAutonomyAllowed(
  agentMaxLevel: AutonomyLevel,
  requestedLevel: AutonomyLevel
): boolean {
  const levels: AutonomyLevel[] = [
    'manual_only',
    'ai_assisted',
    'semi_autonomous',
    'fully_autonomous',
  ];

  const agentIndex = levels.indexOf(agentMaxLevel);
  const requestedIndex = levels.indexOf(requestedLevel);

  return requestedIndex <= agentIndex;
}

function getApprovalReason(
  intent: ClassifiedIntent,
  capability: AgentCapability,
  contextCheck: { missingContext: string[] }
): string {
  if (contextCheck.missingContext.length > 0) {
    return `Missing required context: ${contextCheck.missingContext.join(', ')}`;
  }

  if (capability.maxAutonomyLevel === 'manual_only') {
    return 'This action requires human initiation and approval';
  }

  if (capability.requiresApproval) {
    return 'Agent requires approval before executing changes';
  }

  return 'Standard approval required for this action';
}

// ============================================================================
// Action Planning
// ============================================================================

function generateActionPlan(
  intent: ClassifiedIntent,
  agentType: AgentType,
  graph: CompanyContextGraph
): AgentAction[] {
  const actions: AgentAction[] = [];
  const baseId = randomUUID().slice(0, 8);

  // Generate actions based on intent type
  switch (intent.type) {
    case 'optimize_media_plan':
      actions.push({
        id: `action_${baseId}_1`,
        agentType,
        actionType: 'analyze_current_plan',
        description: 'Analyze current media plan performance',
        inputContext: ['performanceMedia.channels', 'performanceMedia.targetCpa'],
        outputFields: [],
        estimatedDurationMs: 5000,
        priority: 'high',
      });
      actions.push({
        id: `action_${baseId}_2`,
        agentType,
        actionType: 'generate_optimizations',
        description: 'Generate optimization recommendations',
        inputContext: ['historical.pastCampaigns'],
        outputFields: ['performanceMedia.bestChannels'],
        estimatedDurationMs: 10000,
        priority: 'high',
        prerequisites: [`action_${baseId}_1`],
      });
      break;

    case 'create_creative_brief':
      actions.push({
        id: `action_${baseId}_1`,
        agentType,
        actionType: 'gather_context',
        description: 'Gather brand and audience context',
        inputContext: ['brand.positioning', 'audience.primaryAudience'],
        outputFields: [],
        estimatedDurationMs: 3000,
        priority: 'high',
      });
      actions.push({
        id: `action_${baseId}_2`,
        agentType,
        actionType: 'generate_brief',
        description: 'Generate creative brief',
        inputContext: ['creative.messagingAngles'],
        outputFields: ['creative.creativeDirection'],
        estimatedDurationMs: 15000,
        priority: 'high',
        prerequisites: [`action_${baseId}_1`],
      });
      break;

    case 'diagnose_seo_issues':
      actions.push({
        id: `action_${baseId}_1`,
        agentType,
        actionType: 'run_seo_audit',
        description: 'Run comprehensive SEO audit',
        inputContext: ['seo.primaryKeywords', 'website.siteSpeed'],
        outputFields: [],
        estimatedDurationMs: 20000,
        priority: 'high',
      });
      actions.push({
        id: `action_${baseId}_2`,
        agentType,
        actionType: 'generate_recommendations',
        description: 'Generate SEO recommendations',
        inputContext: [],
        outputFields: ['seo.technicalIssues'],
        estimatedDurationMs: 5000,
        priority: 'medium',
        prerequisites: [`action_${baseId}_1`],
      });
      break;

    case 'create_executive_summary':
      actions.push({
        id: `action_${baseId}_1`,
        agentType,
        actionType: 'synthesize_context',
        description: 'Synthesize context across domains',
        inputContext: ['objectives.primaryGoal', 'performanceMedia.targetCpa', 'brand.positioning'],
        outputFields: [],
        estimatedDurationMs: 5000,
        priority: 'high',
      });
      actions.push({
        id: `action_${baseId}_2`,
        agentType,
        actionType: 'generate_summary',
        description: 'Generate executive summary',
        inputContext: [],
        outputFields: [],
        estimatedDurationMs: 10000,
        priority: 'high',
        prerequisites: [`action_${baseId}_1`],
      });
      break;

    default:
      // Generic action for unknown intents
      actions.push({
        id: `action_${baseId}_1`,
        agentType,
        actionType: 'analyze',
        description: `Analyze request: ${intent.rawRequest}`,
        inputContext: intent.targetDomains.map(d => d),
        outputFields: [],
        estimatedDurationMs: 10000,
        priority: 'medium',
      });
  }

  return actions;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getValueByPath(graph: CompanyContextGraph, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = graph;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  if (current && typeof current === 'object' && 'value' in current) {
    return (current as { value: unknown }).value;
  }

  return current;
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_CAPABILITIES };
