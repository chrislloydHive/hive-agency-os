// lib/hiveBrain/agentOrchestrator.ts
// Multi-Agent Orchestrator
//
// Coordinates multiple specialized agents (Media, Creative, Audience, etc.)
// to execute complex multi-step strategies across companies.
//
// Key capabilities:
// - Task decomposition: Break complex goals into agent-specific tasks
// - Dependency management: Ensure tasks execute in correct order
// - State tracking: Monitor orchestration progress
// - Error handling: Handle failures gracefully with rollback/retry

import type {
  AgentType,
  AgentTask,
  AgentState,
  Orchestration,
} from './types';

// ============================================================================
// Agent Registry
// ============================================================================

/**
 * Agent capability definition
 */
interface AgentCapability {
  type: AgentType;
  name: string;
  description: string;
  canHandle: string[]; // Task types this agent can handle
  requiredInputs: string[]; // Required input fields
  outputs: string[]; // Output fields produced
}

/**
 * Registry of available agents and their capabilities
 */
const AGENT_REGISTRY: AgentCapability[] = [
  {
    type: 'media',
    name: 'Media Lab Agent',
    description: 'Plans and optimizes paid media campaigns',
    canHandle: ['media_plan', 'budget_allocation', 'channel_optimization'],
    requiredInputs: ['companyId', 'budget'],
    outputs: ['mediaPlan', 'channelMix', 'projections'],
  },
  {
    type: 'creative',
    name: 'Creative Lab Agent',
    description: 'Generates creative concepts, copy, and assets',
    canHandle: ['creative_brief', 'ad_copy', 'concept_generation'],
    requiredInputs: ['companyId', 'channel'],
    outputs: ['creatives', 'concepts', 'copy'],
  },
  {
    type: 'audience',
    name: 'Audience Lab Agent',
    description: 'Researches and defines target audiences and personas',
    canHandle: ['persona_research', 'audience_expansion', 'segment_analysis'],
    requiredInputs: ['companyId'],
    outputs: ['personas', 'segments', 'insights'],
  },
  {
    type: 'seo',
    name: 'SEO Lab Agent',
    description: 'Analyzes and optimizes organic search presence',
    canHandle: ['keyword_research', 'content_optimization', 'technical_audit'],
    requiredInputs: ['companyId', 'domain'],
    outputs: ['keywords', 'recommendations', 'audit'],
  },
  {
    type: 'website',
    name: 'Website Lab Agent',
    description: 'Analyzes and improves website performance and UX',
    canHandle: ['site_audit', 'conversion_optimization', 'ux_analysis'],
    requiredInputs: ['companyId', 'url'],
    outputs: ['issues', 'recommendations', 'insights'],
  },
  {
    type: 'brand',
    name: 'Brand Lab Agent',
    description: 'Develops brand strategy and positioning',
    canHandle: ['brand_audit', 'positioning', 'messaging_framework'],
    requiredInputs: ['companyId'],
    outputs: ['positioning', 'messaging', 'guidelines'],
  },
  {
    type: 'executive',
    name: 'Executive Summary Agent',
    description: 'Generates executive summaries and reports',
    canHandle: ['executive_summary', 'quarterly_review', 'performance_report'],
    requiredInputs: ['companyId', 'period'],
    outputs: ['summary', 'insights', 'recommendations'],
  },
  {
    type: 'diagnostics',
    name: 'Diagnostics Agent',
    description: 'Runs diagnostic checks and identifies issues',
    canHandle: ['health_check', 'performance_audit', 'issue_detection'],
    requiredInputs: ['companyId'],
    outputs: ['issues', 'scores', 'recommendations'],
  },
];

// ============================================================================
// Task Decomposition
// ============================================================================

/**
 * Decompose a high-level goal into agent tasks
 */
export function decomposeGoal(
  goal: string,
  companyIds: string[],
  context: Record<string, unknown> = {}
): AgentTask[] {
  const tasks: AgentTask[] = [];
  const orchestrationId = generateId();
  const now = new Date().toISOString();

  // Pattern matching for common goals
  const goalLower = goal.toLowerCase();

  if (goalLower.includes('launch') && goalLower.includes('campaign')) {
    // Full campaign launch flow
    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'audience',
        description: 'Research and define target audience personas',
        priority: 'high',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'persona_research' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'brand',
        description: 'Validate brand positioning and messaging',
        priority: 'high',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'positioning' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'media',
        description: 'Create media plan and channel mix',
        priority: 'high',
        dependencies: [tasks[0].id], // Wait for audience
        companyIds,
        input: { ...context, task: 'media_plan' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'creative',
        description: 'Generate creative concepts and ad copy',
        priority: 'high',
        dependencies: [tasks[0].id, tasks[1].id], // Wait for audience + brand
        companyIds,
        input: { ...context, task: 'creative_brief' },
        createdAt: now,
      })
    );
  } else if (goalLower.includes('diagnose') || goalLower.includes('audit')) {
    // Full diagnostic flow
    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'diagnostics',
        description: 'Run comprehensive health check',
        priority: 'high',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'health_check' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'website',
        description: 'Audit website performance and UX',
        priority: 'medium',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'site_audit' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'seo',
        description: 'Analyze SEO health and opportunities',
        priority: 'medium',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'technical_audit' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'executive',
        description: 'Compile diagnostic summary report',
        priority: 'low',
        dependencies: [tasks[0].id, tasks[1].id, tasks[2].id],
        companyIds,
        input: { ...context, task: 'executive_summary' },
        createdAt: now,
      })
    );
  } else if (goalLower.includes('creative') && goalLower.includes('refresh')) {
    // Creative refresh flow
    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'audience',
        description: 'Refresh persona insights',
        priority: 'high',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'persona_research' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'creative',
        description: 'Generate new creative concepts',
        priority: 'high',
        dependencies: [tasks[0].id],
        companyIds,
        input: { ...context, task: 'concept_generation' },
        createdAt: now,
      })
    );
  } else if (goalLower.includes('expand') && goalLower.includes('audience')) {
    // Audience expansion flow
    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'audience',
        description: 'Analyze current audience segments',
        priority: 'high',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'segment_analysis' },
        createdAt: now,
      })
    );

    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'audience',
        description: 'Identify expansion opportunities',
        priority: 'high',
        dependencies: [tasks[0].id],
        companyIds,
        input: { ...context, task: 'audience_expansion' },
        createdAt: now,
      })
    );
  } else {
    // Default: single diagnostic task
    tasks.push(
      createTask({
        orchestrationId,
        agentType: 'diagnostics',
        description: `Investigate: ${goal}`,
        priority: 'medium',
        dependencies: [],
        companyIds,
        input: { ...context, task: 'health_check', goal },
        createdAt: now,
      })
    );
  }

  return tasks;
}

// ============================================================================
// Orchestration Management
// ============================================================================

/**
 * Create a new orchestration from a goal
 */
export function createOrchestration(
  goal: string,
  source: Orchestration['source'],
  companyIds: string[],
  context: Record<string, unknown> = {},
  initiatedBy?: string
): Orchestration {
  const tasks = decomposeGoal(goal, companyIds, context);

  return {
    id: tasks.length > 0 ? tasks[0].orchestrationId : generateId(),
    goal,
    source,
    state: 'planning',
    tasks,
    companyIds,
    initiatedBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get the next tasks that are ready to execute
 */
export function getReadyTasks(orchestration: Orchestration): AgentTask[] {
  const completedIds = new Set(
    orchestration.tasks
      .filter((t) => t.state === 'completed')
      .map((t) => t.id)
  );

  return orchestration.tasks.filter((task) => {
    // Skip already started or completed tasks
    if (task.state !== 'pending') return false;

    // Check all dependencies are met
    return task.dependencies.every((depId) => completedIds.has(depId));
  });
}

/**
 * Update a task's state
 */
export function updateTaskState(
  orchestration: Orchestration,
  taskId: string,
  state: AgentState,
  output?: Record<string, unknown>,
  error?: string
): Orchestration {
  const now = new Date().toISOString();

  const updatedTasks = orchestration.tasks.map((task) => {
    if (task.id !== taskId) return task;

    return {
      ...task,
      state,
      output: output ?? task.output,
      error: error ?? task.error,
      startedAt: state === 'executing' ? now : task.startedAt,
      completedAt: state === 'completed' || state === 'failed' ? now : task.completedAt,
    };
  });

  // Determine overall orchestration state
  let orchState: Orchestration['state'] = orchestration.state;

  const allCompleted = updatedTasks.every((t) => t.state === 'completed');
  const anyFailed = updatedTasks.some((t) => t.state === 'failed');
  const anyExecuting = updatedTasks.some((t) => t.state === 'executing');

  if (allCompleted) {
    orchState = 'completed';
  } else if (anyFailed) {
    orchState = 'failed';
  } else if (anyExecuting || updatedTasks.some((t) => t.state === 'planning')) {
    orchState = 'executing';
  }

  return {
    ...orchestration,
    tasks: updatedTasks,
    state: orchState,
    completedAt: orchState === 'completed' || orchState === 'failed' ? now : undefined,
  };
}

/**
 * Get orchestration progress summary
 */
export function getOrchestrationProgress(orchestration: Orchestration): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  failed: number;
  percentComplete: number;
} {
  const tasks = orchestration.tasks;

  const completed = tasks.filter((t) => t.state === 'completed').length;
  const inProgress = tasks.filter(
    (t) => t.state === 'executing' || t.state === 'planning'
  ).length;
  const failed = tasks.filter((t) => t.state === 'failed').length;
  const pending = tasks.filter((t) => t.state === 'pending').length;

  return {
    total: tasks.length,
    completed,
    inProgress,
    pending,
    failed,
    percentComplete: tasks.length > 0 ? (completed / tasks.length) * 100 : 0,
  };
}

// ============================================================================
// Task Execution Simulation
// ============================================================================

/**
 * Simulate executing a task (for development/testing)
 * In production, this would call actual agent implementations
 */
export async function simulateTaskExecution(
  task: AgentTask
): Promise<{ output: Record<string, unknown>; error?: string }> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Generate mock output based on agent type
  switch (task.agentType) {
    case 'media':
      return {
        output: {
          mediaPlan: {
            channels: ['Meta', 'Google', 'TikTok'],
            totalBudget: task.input.budget || 10000,
            breakdown: { Meta: 0.4, Google: 0.4, TikTok: 0.2 },
          },
          projections: {
            impressions: 500000,
            clicks: 15000,
            conversions: 300,
          },
        },
      };

    case 'creative':
      return {
        output: {
          concepts: [
            { name: 'Hero Story', hook: 'Transform your business' },
            { name: 'Social Proof', hook: 'Join 10,000+ customers' },
          ],
          copy: {
            headlines: ['Headline A', 'Headline B'],
            descriptions: ['Description A', 'Description B'],
          },
        },
      };

    case 'audience':
      return {
        output: {
          personas: [
            { name: 'Decision Maker Dana', segment: 'B2B Leaders' },
            { name: 'Growth-Focused Gary', segment: 'SMB Owners' },
          ],
          segments: ['Enterprise', 'Mid-Market', 'SMB'],
        },
      };

    case 'diagnostics':
      return {
        output: {
          healthScore: 72,
          issues: [
            { severity: 'high', description: 'Low conversion rate' },
            { severity: 'medium', description: 'Incomplete tracking' },
          ],
          recommendations: [
            'Improve landing page',
            'Complete GA4 setup',
          ],
        },
      };

    default:
      return {
        output: {
          status: 'completed',
          summary: `${task.agentType} task completed successfully`,
        },
      };
  }
}

/**
 * Run an orchestration to completion (simulation mode)
 */
export async function runOrchestration(
  orchestration: Orchestration,
  onProgress?: (orch: Orchestration) => void
): Promise<Orchestration> {
  let current: Orchestration = { ...orchestration, state: 'executing' };

  while (true) {
    const readyTasks = getReadyTasks(current);

    if (readyTasks.length === 0) {
      // No more tasks to run
      break;
    }

    // Execute ready tasks in parallel
    const executions = readyTasks.map(async (task) => {
      // Mark as executing
      current = updateTaskState(current, task.id, 'executing');
      onProgress?.(current);

      try {
        const result = await simulateTaskExecution(task);

        if (result.error) {
          return { taskId: task.id, state: 'failed' as const, error: result.error };
        }

        return { taskId: task.id, state: 'completed' as const, output: result.output };
      } catch (err) {
        return {
          taskId: task.id,
          state: 'failed' as const,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.all(executions);

    // Update all task states
    for (const result of results) {
      current = updateTaskState(
        current,
        result.taskId,
        result.state,
        result.state === 'completed' ? result.output : undefined,
        result.state === 'failed' ? result.error : undefined
      );
    }

    onProgress?.(current);
  }

  // Generate results summary
  const completedTasks = current.tasks.filter((t) => t.state === 'completed');
  const summaryParts = completedTasks.map(
    (t) => `${t.agentType}: ${t.description}`
  );

  return {
    ...current,
    resultsSummary: summaryParts.join('\n'),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createTask(params: {
  orchestrationId: string;
  agentType: AgentType;
  description: string;
  priority: AgentTask['priority'];
  dependencies: string[];
  companyIds: string[];
  input: Record<string, unknown>;
  createdAt: string;
}): AgentTask {
  return {
    id: generateId(),
    orchestrationId: params.orchestrationId,
    agentType: params.agentType,
    description: params.description,
    priority: params.priority,
    state: 'pending',
    dependencies: params.dependencies,
    input: params.input,
    companyIds: params.companyIds,
    createdAt: params.createdAt,
  };
}

/**
 * Get agent capability info
 */
export function getAgentCapabilities(type: AgentType): AgentCapability | undefined {
  return AGENT_REGISTRY.find((a) => a.type === type);
}

/**
 * List all available agents
 */
export function listAgents(): AgentCapability[] {
  return AGENT_REGISTRY;
}

/**
 * Find agents that can handle a specific task type
 */
export function findAgentsForTask(taskType: string): AgentCapability[] {
  return AGENT_REGISTRY.filter((a) => a.canHandle.includes(taskType));
}
