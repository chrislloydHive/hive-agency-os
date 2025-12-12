// lib/os/work.ts
// Work System management for MVP
//
// Provides CRUD operations for workstreams and tasks generated from strategies.

import { getBase } from '@/lib/airtable';
import type {
  Workstream,
  Task,
  TaskStatus,
  GenerateWorkRequest,
  GenerateWorkResponse,
  UpdateTaskRequest,
  CreateTaskRequest,
  WorkSummaryMvp,
} from '@/lib/types/workMvp';
import {
  calculateWorkSummary,
  generateWorkItemId,
  DEFAULT_TASK_TEMPLATES,
} from '@/lib/types/workMvp';
import type { CompanyStrategy, StrategyPillar } from '@/lib/types/strategy';

// ============================================================================
// Configuration
// ============================================================================

const WORKSTREAMS_TABLE = 'Workstreams';
const TASKS_TABLE = 'Work Tasks';

// ============================================================================
// Workstream Operations
// ============================================================================

/**
 * Get all workstreams for a company
 */
export async function getWorkstreamsForCompany(companyId: string): Promise<Workstream[]> {
  try {
    const base = getBase();
    const records = await base(WORKSTREAMS_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map(mapRecordToWorkstream);
  } catch (error) {
    console.error('[getWorkstreamsForCompany] Error:', error);
    return [];
  }
}

/**
 * Get workstream by ID
 */
export async function getWorkstreamById(workstreamId: string): Promise<Workstream | null> {
  try {
    const base = getBase();
    const record = await base(WORKSTREAMS_TABLE).find(workstreamId);
    return mapRecordToWorkstream(record);
  } catch (error) {
    console.error('[getWorkstreamById] Error:', error);
    return null;
  }
}

/**
 * Create a workstream
 */
export async function createWorkstream(workstream: Omit<Workstream, 'id' | 'createdAt' | 'updatedAt'>): Promise<Workstream> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(WORKSTREAMS_TABLE).create({
      ...workstream,
      createdAt: now,
      updatedAt: now,
    });

    return mapRecordToWorkstream(record);
  } catch (error) {
    console.error('[createWorkstream] Error:', error);
    throw new Error(`Failed to create workstream: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a workstream
 */
export async function updateWorkstream(
  workstreamId: string,
  updates: Partial<Omit<Workstream, 'id' | 'companyId' | 'createdAt'>>
): Promise<Workstream> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    const record = await base(WORKSTREAMS_TABLE).update(workstreamId, {
      ...updates,
      updatedAt: now,
    });

    return mapRecordToWorkstream(record);
  } catch (error) {
    console.error('[updateWorkstream] Error:', error);
    throw new Error(`Failed to update workstream: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Task Operations
// ============================================================================

/**
 * Get all tasks for a company
 */
export async function getTasksForCompany(companyId: string): Promise<Task[]> {
  try {
    const base = getBase();
    const records = await base(TASKS_TABLE)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'order', direction: 'asc' }],
      })
      .all();

    return records.map(mapRecordToTask);
  } catch (error) {
    console.error('[getTasksForCompany] Error:', error);
    return [];
  }
}

/**
 * Get tasks for a workstream
 */
export async function getTasksForWorkstream(workstreamId: string): Promise<Task[]> {
  try {
    const base = getBase();
    const records = await base(TASKS_TABLE)
      .select({
        filterByFormula: `{workstreamId} = '${workstreamId}'`,
        sort: [{ field: 'order', direction: 'asc' }],
      })
      .all();

    return records.map(mapRecordToTask);
  } catch (error) {
    console.error('[getTasksForWorkstream] Error:', error);
    return [];
  }
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: string): Promise<Task | null> {
  try {
    const base = getBase();
    const record = await base(TASKS_TABLE).find(taskId);
    return mapRecordToTask(record);
  } catch (error) {
    console.error('[getTaskById] Error:', error);
    return null;
  }
}

/**
 * Create a task
 */
export async function createTask(request: CreateTaskRequest): Promise<Task> {
  const { workstreamId, title, description, dueDate, owner } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Get workstream to get companyId
    const workstream = await getWorkstreamById(workstreamId);

    const record = await base(TASKS_TABLE).create({
      workstreamId,
      companyId: workstream?.companyId,
      title,
      description,
      dueDate,
      owner,
      status: 'not_started',
      createdAt: now,
      updatedAt: now,
    });

    return mapRecordToTask(record);
  } catch (error) {
    console.error('[createTask] Error:', error);
    throw new Error(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a task
 */
export async function updateTask(request: UpdateTaskRequest): Promise<Task> {
  const { taskId, updates } = request;

  try {
    const base = getBase();
    const now = new Date().toISOString();

    // If completing a task, set completedAt
    const completedAt = updates.status === 'complete' ? now : updates.completedAt;

    const record = await base(TASKS_TABLE).update(taskId, {
      ...updates,
      completedAt,
      updatedAt: now,
    });

    return mapRecordToTask(record);
  } catch (error) {
    console.error('[updateTask] Error:', error);
    throw new Error(`Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  try {
    const base = getBase();
    await base(TASKS_TABLE).destroy(taskId);
  } catch (error) {
    console.error('[deleteTask] Error:', error);
    throw new Error(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// Work Generation
// ============================================================================

/**
 * Generate workstreams and tasks from a finalized strategy
 */
export async function generateWorkFromStrategy(
  request: GenerateWorkRequest
): Promise<GenerateWorkResponse> {
  const { strategyId, companyId } = request;

  console.log('[generateWorkFromStrategy] Starting:', { strategyId, companyId });

  try {
    // Import strategy functions dynamically to avoid circular deps
    const { getStrategyById } = await import('./strategy');
    const strategy = await getStrategyById(strategyId);

    if (!strategy) {
      console.error('[generateWorkFromStrategy] Strategy not found:', strategyId);
      throw new Error('Strategy not found');
    }

    console.log('[generateWorkFromStrategy] Found strategy with', strategy.pillars.length, 'pillars');

    const workstreams: Workstream[] = [];
    const tasks: Task[] = [];
    const now = new Date().toISOString();

    // Create a workstream for each pillar
    for (const pillar of strategy.pillars) {
      console.log('[generateWorkFromStrategy] Creating workstream for pillar:', pillar.title);
      const workstream = await createWorkstreamFromPillar(companyId, strategyId, pillar, now);
      console.log('[generateWorkFromStrategy] Workstream created:', workstream.id);
      workstreams.push(workstream);

      // Generate tasks for the workstream
      const pillarTasks = await generateTasksForWorkstream(workstream, pillar, now);
      console.log('[generateWorkFromStrategy] Tasks created for workstream:', pillarTasks.length);
      tasks.push(...pillarTasks);
    }

    console.log('[generateWorkFromStrategy] Complete:', {
      workstreams: workstreams.length,
      tasks: tasks.length,
    });

    return {
      workstreams,
      tasks,
      generatedAt: now,
    };
  } catch (error) {
    console.error('[generateWorkFromStrategy] Error:', error);
    throw new Error(`Failed to generate work: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a workstream from a strategy pillar
 */
async function createWorkstreamFromPillar(
  companyId: string,
  strategyId: string,
  pillar: StrategyPillar,
  now: string
): Promise<Workstream> {
  const service = pillar.services?.[0] || 'other';

  return createWorkstream({
    companyId,
    strategyId,
    pillarId: pillar.id,
    title: pillar.title,
    description: pillar.description,
    service,
    status: 'not_started',
    progress: 0,
  });
}

/**
 * Generate tasks for a workstream based on pillar services
 */
async function generateTasksForWorkstream(
  workstream: Workstream,
  pillar: StrategyPillar,
  now: string
): Promise<Task[]> {
  const service = workstream.service || 'other';
  const template = DEFAULT_TASK_TEMPLATES.find(t => t.service === service);

  const tasks: Task[] = [];

  if (template) {
    for (const taskTemplate of template.tasks) {
      const task = await createTask({
        workstreamId: workstream.id,
        title: taskTemplate.title,
        description: taskTemplate.description || `${taskTemplate.title} for ${pillar.title}`,
      });
      tasks.push(task);
    }
  } else {
    // Default tasks if no template
    const defaultTasks = [
      'Research and planning',
      'Define requirements',
      'Execute',
      'Review and optimize',
    ];

    for (let i = 0; i < defaultTasks.length; i++) {
      const task = await createTask({
        workstreamId: workstream.id,
        title: `${defaultTasks[i]} - ${pillar.title}`,
      });
      tasks.push(task);
    }
  }

  return tasks;
}

// ============================================================================
// Work Summary
// ============================================================================

/**
 * Get work summary for a company
 */
export async function getWorkSummaryForCompany(companyId: string): Promise<WorkSummaryMvp> {
  const [workstreams, tasks] = await Promise.all([
    getWorkstreamsForCompany(companyId),
    getTasksForCompany(companyId),
  ]);

  return calculateWorkSummary(companyId, workstreams, tasks);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map Airtable record to Workstream
 */
function mapRecordToWorkstream(record: {
  id: string;
  fields: Record<string, unknown>;
}): Workstream {
  const fields = record.fields;

  return {
    id: record.id,
    companyId: fields.companyId as string,
    strategyId: fields.strategyId as string,
    pillarId: fields.pillarId as string | undefined,
    title: (fields.title as string) || 'Untitled Workstream',
    description: fields.description as string | undefined,
    service: fields.service as Workstream['service'] | undefined,
    status: (fields.status as TaskStatus) || 'not_started',
    progress: (fields.progress as number) || 0,
    startDate: fields.startDate as string | undefined,
    endDate: fields.endDate as string | undefined,
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
  };
}

/**
 * Map Airtable record to Task
 */
function mapRecordToTask(record: {
  id: string;
  fields: Record<string, unknown>;
}): Task {
  const fields = record.fields;

  return {
    id: record.id,
    workstreamId: fields.workstreamId as string,
    companyId: fields.companyId as string | undefined,
    title: (fields.title as string) || 'Untitled Task',
    description: fields.description as string | undefined,
    owner: fields.owner as string | undefined,
    assignee: fields.assignee as string | undefined,
    status: (fields.status as TaskStatus) || 'not_started',
    dueDate: fields.dueDate as string | undefined,
    completedAt: fields.completedAt as string | undefined,
    relatedBriefId: fields.relatedBriefId as string | undefined,
    relatedFindingIds: parseJsonArray(fields.relatedFindingIds),
    createdAt: (fields.createdAt as string) || new Date().toISOString(),
    updatedAt: (fields.updatedAt as string) || new Date().toISOString(),
    order: (fields.order as number) || 0,
  };
}

/**
 * Parse JSON array from Airtable field
 */
function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
