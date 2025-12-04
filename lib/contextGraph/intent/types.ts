// lib/contextGraph/intent/types.ts
// Intent classification and agent routing types
//
// Phase 4: Context Intent Engine for agent orchestration

import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Intent Types
// ============================================================================

/**
 * Categories of user intent
 */
export type IntentCategory =
  | 'optimize'      // Improve performance of something
  | 'diagnose'      // Analyze and find issues
  | 'create'        // Generate new content/plans
  | 'update'        // Modify existing data
  | 'analyze'       // Deep analysis or research
  | 'forecast'      // Predict future trends
  | 'fix'           // Resolve a specific problem
  | 'compare'       // Compare options or periods
  | 'explain'       // Get understanding or insights
  | 'automate';     // Set up automated processes

/**
 * Specific intent types
 */
export type IntentType =
  // Media intents
  | 'optimize_media_plan'
  | 'diagnose_media_performance'
  | 'create_media_plan'
  | 'forecast_media_spend'
  | 'analyze_channel_performance'

  // Creative intents
  | 'create_creative_brief'
  | 'optimize_creative_angles'
  | 'diagnose_creative_fatigue'
  | 'analyze_creative_performance'

  // Audience intents
  | 'update_audience_segments'
  | 'diagnose_audience_fit'
  | 'create_personas'
  | 'analyze_audience_behavior'

  // SEO intents
  | 'diagnose_seo_issues'
  | 'optimize_keyword_strategy'
  | 'analyze_search_visibility'
  | 'forecast_seo_impact'

  // Brand intents
  | 'update_brand_positioning'
  | 'diagnose_brand_consistency'
  | 'analyze_brand_perception'

  // Strategy intents
  | 'create_executive_summary'
  | 'forecast_seasonality'
  | 'analyze_competitive_landscape'
  | 'diagnose_strategy_gaps'

  // Context graph intents
  | 'fix_inconsistent_data'
  | 'update_stale_fields'
  | 'explain_field_value'
  | 'compare_snapshots'

  // General
  | 'unknown';

/**
 * A classified intent
 */
export interface ClassifiedIntent {
  id: string;
  rawRequest: string;
  category: IntentCategory;
  type: IntentType;
  confidence: number;

  // Extracted entities
  targetDomains: DomainName[];
  targetFields?: string[];
  timeRange?: {
    start?: string;
    end?: string;
    period?: string;
  };

  // Additional context
  entities: Record<string, unknown>;
  parameters: Record<string, unknown>;

  // Metadata
  classifiedAt: string;
  processingTimeMs: number;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Types of agents available
 */
export type AgentType =
  | 'media_agent'
  | 'creative_agent'
  | 'audience_agent'
  | 'seo_agent'
  | 'brand_agent'
  | 'strategy_agent'
  | 'diagnostic_agent'
  | 'executive_summary_agent'
  | 'context_graph_agent';

/**
 * Agent capability definition
 */
export interface AgentCapability {
  agentType: AgentType;
  name: string;
  description: string;

  // What this agent can do
  supportedIntents: IntentType[];
  supportedDomains: DomainName[];

  // Requirements
  requiredContext: string[];  // Fields that must be populated
  optionalContext: string[];  // Fields that enhance results

  // Autonomy settings
  canAutoExecute: boolean;
  requiresApproval: boolean;
  maxAutonomyLevel: AutonomyLevel;
}

/**
 * Autonomy levels for agent actions
 */
export type AutonomyLevel =
  | 'manual_only'       // Requires human initiation and approval
  | 'ai_assisted'       // AI suggests, human approves
  | 'semi_autonomous'   // AI executes with human review
  | 'fully_autonomous'; // AI executes independently

// ============================================================================
// Routing Types
// ============================================================================

/**
 * A route decision for an intent
 */
export interface RouteDecision {
  intent: ClassifiedIntent;

  // Primary agent
  primaryAgent: AgentType;
  primaryAgentConfidence: number;

  // Alternative agents
  alternativeAgents?: Array<{
    agent: AgentType;
    confidence: number;
    reason: string;
  }>;

  // Execution plan
  suggestedActions: AgentAction[];

  // Context requirements
  missingContext: string[];
  recommendedPrefill: string[];

  // Autonomy
  canAutoExecute: boolean;
  requiresApproval: boolean;
  approvalReason?: string;
}

/**
 * An action for an agent to perform
 */
export interface AgentAction {
  id: string;
  agentType: AgentType;
  actionType: string;
  description: string;

  // Input/output
  inputContext: string[];
  outputFields?: string[];

  // Execution
  estimatedDurationMs?: number;
  priority: 'high' | 'medium' | 'low';
  prerequisites?: string[];  // Other action IDs that must complete first
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Result of executing an agent action
 */
export interface AgentExecutionResult {
  actionId: string;
  agentType: AgentType;
  status: 'success' | 'partial' | 'failed' | 'pending_approval';

  // Results
  result?: unknown;
  updatedFields?: Array<{
    path: string;
    oldValue: unknown;
    newValue: unknown;
  }>;

  // Output
  summary: string;
  recommendations?: string[];

  // Metadata
  executedAt: string;
  durationMs: number;
  error?: string;
}

/**
 * Complete workflow execution
 */
export interface WorkflowExecution {
  id: string;
  intent: ClassifiedIntent;
  route: RouteDecision;

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;  // 0-100

  // Results
  actionResults: AgentExecutionResult[];

  // Metadata
  startedAt: string;
  completedAt?: string;
  initiatedBy: string;
}

// ============================================================================
// History Types
// ============================================================================

/**
 * Historical intent for learning
 */
export interface IntentHistory {
  id: string;
  companyId: string;
  intent: ClassifiedIntent;
  route: RouteDecision;
  execution?: WorkflowExecution;

  // Feedback
  wasHelpful?: boolean;
  userFeedback?: string;
  correctIntent?: IntentType;  // If user corrected the classification

  // Metadata
  timestamp: string;
}
