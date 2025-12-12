// lib/types/workMvp.ts
// MVP Work types for Work System
//
// These types define workstreams and tasks that are generated
// from finalized strategies.

// ============================================================================
// Core Work Types
// ============================================================================

/**
 * Task status for both workstreams and tasks
 */
export type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_review'
  | 'complete';

/**
 * Service type (aligned with strategy services)
 */
export type WorkService =
  | 'website'
  | 'seo'
  | 'content'
  | 'media'
  | 'brand'
  | 'social'
  | 'email'
  | 'analytics'
  | 'conversion'
  | 'other';

/**
 * Workstream - a high-level work track derived from a strategy pillar
 */
export interface Workstream {
  id: string;
  companyId: string;
  strategyId: string;
  pillarId?: string;

  // Workstream details
  title: string;
  description?: string;
  service?: WorkService;

  // Status & progress
  status: TaskStatus;
  progress?: number; // 0-100

  // Timeline
  startDate?: string;
  endDate?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Task - an individual work item within a workstream
 */
export interface Task {
  id: string;
  workstreamId: string;
  companyId?: string;

  // Task details
  title: string;
  description?: string;

  // Assignment & ownership
  owner?: string;
  assignee?: string;

  // Status & tracking
  status: TaskStatus;
  dueDate?: string;
  completedAt?: string;

  // Related entities
  relatedBriefId?: string;
  relatedFindingIds?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  order?: number;
}

// ============================================================================
// Work Generation
// ============================================================================

/**
 * Request to generate work from a finalized strategy
 */
export interface GenerateWorkRequest {
  strategyId: string;
  companyId: string;
  useAi?: boolean;
}

/**
 * Response from work generation
 */
export interface GenerateWorkResponse {
  workstreams: Workstream[];
  tasks: Task[];
  generatedAt: string;
}

/**
 * Task templates for deterministic work generation
 */
export interface TaskTemplate {
  service: WorkService;
  tasks: Array<{
    title: string;
    description?: string;
    order: number;
  }>;
}

// ============================================================================
// Work Summary (for Overview)
// ============================================================================

/**
 * Work summary for display in Overview
 */
export interface WorkSummaryMvp {
  companyId: string;
  totalWorkstreams: number;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  recentlyCompleted: Array<{ title: string; completedAt: string }>;
  upNext: Array<{ title: string; dueDate?: string }>;
  overallProgress: number; // 0-100
}

/**
 * Calculate work summary from workstreams and tasks
 */
export function calculateWorkSummary(
  companyId: string,
  workstreams: Workstream[],
  tasks: Task[]
): WorkSummaryMvp {
  const tasksByStatus: Record<TaskStatus, number> = {
    not_started: 0,
    in_progress: 0,
    blocked: 0,
    ready_for_review: 0,
    complete: 0,
  };

  for (const task of tasks) {
    tasksByStatus[task.status]++;
  }

  const completedTasks = tasks
    .filter(t => t.status === 'complete' && t.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5);

  const upNextTasks = tasks
    .filter(t => t.status === 'not_started' || t.status === 'in_progress')
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  const totalTasks = tasks.length;
  const completedCount = tasksByStatus.complete;
  const overallProgress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return {
    companyId,
    totalWorkstreams: workstreams.length,
    totalTasks,
    tasksByStatus,
    recentlyCompleted: completedTasks.map(t => ({
      title: t.title,
      completedAt: t.completedAt!,
    })),
    upNext: upNextTasks.map(t => ({
      title: t.title,
      dueDate: t.dueDate,
    })),
    overallProgress,
  };
}

// ============================================================================
// Task Update Operations
// ============================================================================

/**
 * Update task request
 */
export interface UpdateTaskRequest {
  taskId: string;
  updates: Partial<Omit<Task, 'id' | 'workstreamId' | 'createdAt'>>;
}

/**
 * Create task request
 */
export interface CreateTaskRequest {
  workstreamId: string;
  title: string;
  description?: string;
  dueDate?: string;
  owner?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique work item ID
 */
export function generateWorkItemId(prefix: 'ws' | 'task' = 'task'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Status display labels
 */
export const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  ready_for_review: 'Ready for Review',
  complete: 'Complete',
};

/**
 * Status display colors (Tailwind classes)
 */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  blocked: 'bg-red-500/10 text-red-400 border-red-500/30',
  ready_for_review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  complete: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

/**
 * Default task templates by service
 */
export const DEFAULT_TASK_TEMPLATES: TaskTemplate[] = [
  {
    service: 'website',
    tasks: [
      { title: 'Audit current website', order: 1 },
      { title: 'Define website goals and KPIs', order: 2 },
      { title: 'Create wireframes/mockups', order: 3 },
      { title: 'Implement changes', order: 4 },
      { title: 'Test and optimize', order: 5 },
    ],
  },
  {
    service: 'seo',
    tasks: [
      { title: 'Technical SEO audit', order: 1 },
      { title: 'Keyword research and mapping', order: 2 },
      { title: 'On-page optimization', order: 3 },
      { title: 'Content gap analysis', order: 4 },
      { title: 'Link building strategy', order: 5 },
    ],
  },
  {
    service: 'content',
    tasks: [
      { title: 'Content audit and inventory', order: 1 },
      { title: 'Define content strategy', order: 2 },
      { title: 'Create editorial calendar', order: 3 },
      { title: 'Produce content', order: 4 },
      { title: 'Distribute and promote', order: 5 },
    ],
  },
  {
    service: 'media',
    tasks: [
      { title: 'Define media objectives', order: 1 },
      { title: 'Create media brief', order: 2 },
      { title: 'Develop creative assets', order: 3 },
      { title: 'Launch campaigns', order: 4 },
      { title: 'Monitor and optimize', order: 5 },
    ],
  },
  {
    service: 'brand',
    tasks: [
      { title: 'Brand audit', order: 1 },
      { title: 'Define brand positioning', order: 2 },
      { title: 'Develop messaging framework', order: 3 },
      { title: 'Create brand guidelines', order: 4 },
      { title: 'Roll out brand updates', order: 5 },
    ],
  },
];
