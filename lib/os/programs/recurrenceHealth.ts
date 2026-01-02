// lib/os/programs/recurrenceHealth.ts
// Recurrence Health / SLO Monitoring
//
// Tracks the health of the recurring deliverables system:
// - Last run time and status
// - Deliverables created per run
// - Warning detection for stale or failed runs
//
// Provides data for the internal SLO panel in Week View

import { z } from 'zod';
import {
  generateDebugId,
  type RecurrenceJobStartedPayload,
  type RecurrenceJobCompletedPayload,
  type RecurrenceJobFailedPayload,
} from '@/lib/types/operationalEvent';

// ============================================================================
// Types
// ============================================================================

export type RecurrenceJobStatus = 'running' | 'completed' | 'failed';

export interface RecurrenceJobRecord {
  id: string;
  debugId: string;
  jobType: 'daily' | 'on_demand';
  companyId?: string; // Only for on_demand
  status: RecurrenceJobStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  // Results (only for completed jobs)
  companiesProcessed?: number;
  deliverablesCreated?: number;
  deliverablesSkipped?: number;
  errors?: number;
  // Error info (only for failed jobs)
  errorMessage?: string;
}

export interface RecurrenceHealthSummary {
  lastDailyRun: RecurrenceJobRecord | null;
  lastOnDemandRun: RecurrenceJobRecord | null;
  isStale: boolean;
  staleReason?: string;
  isHealthy: boolean;
  healthIssues: string[];
  // Aggregate stats
  totalRunsLast24h: number;
  successfulRunsLast24h: number;
  failedRunsLast24h: number;
  deliverablesCreatedLast24h: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum hours before considering the daily job stale */
export const STALE_THRESHOLD_HOURS = 36;

/** Expected daily job run time (6am) */
export const EXPECTED_RUN_HOUR = 6;

// ============================================================================
// In-Memory Store
// ============================================================================

const jobStore = new Map<string, RecurrenceJobRecord>();
const dailyJobIds: string[] = []; // Ordered list of daily job IDs
const onDemandJobIds: string[] = []; // Ordered list of on-demand job IDs

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

// ============================================================================
// Job Recording
// ============================================================================

/**
 * Record the start of a recurrence job
 */
export function recordJobStart(
  jobType: 'daily' | 'on_demand',
  options: {
    companyId?: string;
    debugId?: string;
    companiesCount?: number;
    triggeredBy?: string;
  } = {}
): RecurrenceJobRecord {
  const debugId = options.debugId || generateDebugId();
  const now = new Date().toISOString();

  const record: RecurrenceJobRecord = {
    id: generateJobId(),
    debugId,
    jobType,
    companyId: options.companyId,
    status: 'running',
    startedAt: now,
    companiesProcessed: options.companiesCount,
  };

  jobStore.set(record.id, record);

  // Add to ordered list
  if (jobType === 'daily') {
    dailyJobIds.unshift(record.id);
    // Keep only last 100 jobs
    if (dailyJobIds.length > 100) {
      const oldId = dailyJobIds.pop();
      if (oldId) jobStore.delete(oldId);
    }
  } else {
    onDemandJobIds.unshift(record.id);
    if (onDemandJobIds.length > 100) {
      const oldId = onDemandJobIds.pop();
      if (oldId) jobStore.delete(oldId);
    }
  }

  return record;
}

/**
 * Record the completion of a recurrence job
 */
export function recordJobCompletion(
  jobId: string,
  result: {
    companiesProcessed: number;
    deliverablesCreated: number;
    deliverablesSkipped: number;
    errors: number;
  }
): RecurrenceJobRecord | null {
  const job = jobStore.get(jobId);
  if (!job) return null;

  const now = new Date();
  const startTime = new Date(job.startedAt);
  const durationMs = now.getTime() - startTime.getTime();

  const updated: RecurrenceJobRecord = {
    ...job,
    status: 'completed',
    completedAt: now.toISOString(),
    durationMs,
    companiesProcessed: result.companiesProcessed,
    deliverablesCreated: result.deliverablesCreated,
    deliverablesSkipped: result.deliverablesSkipped,
    errors: result.errors,
  };

  jobStore.set(jobId, updated);
  return updated;
}

/**
 * Record a failed recurrence job
 */
export function recordJobFailure(
  jobId: string,
  error: string,
  partialResult?: {
    companiesProcessed?: number;
  }
): RecurrenceJobRecord | null {
  const job = jobStore.get(jobId);
  if (!job) return null;

  const now = new Date();
  const startTime = new Date(job.startedAt);
  const durationMs = now.getTime() - startTime.getTime();

  const updated: RecurrenceJobRecord = {
    ...job,
    status: 'failed',
    completedAt: now.toISOString(),
    durationMs,
    errorMessage: error,
    companiesProcessed: partialResult?.companiesProcessed,
  };

  jobStore.set(jobId, updated);
  return updated;
}

// ============================================================================
// Job Retrieval
// ============================================================================

/**
 * Get a job record by ID
 */
export function getJobRecord(id: string): RecurrenceJobRecord | undefined {
  return jobStore.get(id);
}

/**
 * Get the last daily job
 */
export function getLastDailyJob(): RecurrenceJobRecord | null {
  if (dailyJobIds.length === 0) return null;
  return jobStore.get(dailyJobIds[0]) || null;
}

/**
 * Get the last on-demand job
 */
export function getLastOnDemandJob(): RecurrenceJobRecord | null {
  if (onDemandJobIds.length === 0) return null;
  return jobStore.get(onDemandJobIds[0]) || null;
}

/**
 * Get recent jobs
 */
export function getRecentJobs(
  options: {
    limit?: number;
    jobType?: 'daily' | 'on_demand';
    since?: Date;
  } = {}
): RecurrenceJobRecord[] {
  const { limit = 20, jobType, since } = options;

  let ids: string[];
  if (jobType === 'daily') {
    ids = dailyJobIds;
  } else if (jobType === 'on_demand') {
    ids = onDemandJobIds;
  } else {
    // Merge and sort by startedAt
    const allIds = [...dailyJobIds, ...onDemandJobIds];
    const jobs = allIds
      .map(id => jobStore.get(id))
      .filter((j): j is RecurrenceJobRecord => j !== undefined)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    return jobs
      .filter(j => !since || new Date(j.startedAt) >= since)
      .slice(0, limit);
  }

  return ids
    .map(id => jobStore.get(id))
    .filter((j): j is RecurrenceJobRecord => j !== undefined)
    .filter(j => !since || new Date(j.startedAt) >= since)
    .slice(0, limit);
}

// ============================================================================
// Health Calculation
// ============================================================================

/**
 * Calculate recurrence health summary
 */
export function getRecurrenceHealthSummary(asOf: Date = new Date()): RecurrenceHealthSummary {
  const lastDailyRun = getLastDailyJob();
  const lastOnDemandRun = getLastOnDemandJob();

  // Calculate staleness
  let isStale = false;
  let staleReason: string | undefined;

  if (!lastDailyRun) {
    isStale = true;
    staleReason = 'No daily runs recorded';
  } else {
    const lastRunTime = new Date(lastDailyRun.completedAt || lastDailyRun.startedAt);
    const hoursSinceLastRun = (asOf.getTime() - lastRunTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastRun > STALE_THRESHOLD_HOURS) {
      isStale = true;
      staleReason = `Last run was ${Math.round(hoursSinceLastRun)} hours ago`;
    }
  }

  // Calculate health issues
  const healthIssues: string[] = [];

  if (lastDailyRun?.status === 'failed') {
    healthIssues.push(`Last daily run failed: ${lastDailyRun.errorMessage || 'Unknown error'}`);
  }

  if (lastDailyRun?.status === 'running') {
    const runningTime = (asOf.getTime() - new Date(lastDailyRun.startedAt).getTime()) / (1000 * 60);
    if (runningTime > 30) {
      healthIssues.push(`Daily job running for ${Math.round(runningTime)} minutes`);
    }
  }

  if (lastDailyRun?.errors && lastDailyRun.errors > 0) {
    healthIssues.push(`Last run had ${lastDailyRun.errors} errors`);
  }

  if (isStale && staleReason) {
    healthIssues.push(staleReason);
  }

  const isHealthy = !isStale && healthIssues.length === 0;

  // Calculate 24h stats
  const twentyFourHoursAgo = new Date(asOf.getTime() - 24 * 60 * 60 * 1000);
  const recentJobs = getRecentJobs({ since: twentyFourHoursAgo, limit: 100 });

  const totalRunsLast24h = recentJobs.length;
  const successfulRunsLast24h = recentJobs.filter(j => j.status === 'completed').length;
  const failedRunsLast24h = recentJobs.filter(j => j.status === 'failed').length;
  const deliverablesCreatedLast24h = recentJobs
    .filter(j => j.status === 'completed')
    .reduce((sum, j) => sum + (j.deliverablesCreated || 0), 0);

  return {
    lastDailyRun,
    lastOnDemandRun,
    isStale,
    staleReason,
    isHealthy,
    healthIssues,
    totalRunsLast24h,
    successfulRunsLast24h,
    failedRunsLast24h,
    deliverablesCreatedLast24h,
  };
}

/**
 * Check if the system needs a warning banner
 */
export function getRecurrenceWarning(asOf: Date = new Date()): {
  showWarning: boolean;
  warningType: 'stale' | 'failed' | null;
  message: string | null;
  debugId: string | null;
} {
  const health = getRecurrenceHealthSummary(asOf);

  if (health.isStale) {
    return {
      showWarning: true,
      warningType: 'stale',
      message: health.staleReason || 'Recurrence system is stale',
      debugId: health.lastDailyRun?.debugId || null,
    };
  }

  if (health.lastDailyRun?.status === 'failed') {
    return {
      showWarning: true,
      warningType: 'failed',
      message: `Last recurrence run failed: ${health.lastDailyRun.errorMessage || 'Unknown error'}`,
      debugId: health.lastDailyRun.debugId,
    };
  }

  return {
    showWarning: false,
    warningType: null,
    message: null,
    debugId: null,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

/**
 * Format job status for display
 */
export function formatJobStatus(job: RecurrenceJobRecord): string {
  switch (job.status) {
    case 'running':
      return 'Running...';
    case 'completed':
      if (job.errors && job.errors > 0) {
        return `Completed with ${job.errors} errors`;
      }
      return `Completed (${job.deliverablesCreated || 0} created)`;
    case 'failed':
      return `Failed: ${job.errorMessage || 'Unknown error'}`;
  }
}

/**
 * Format time ago for display
 */
export function formatTimeAgo(date: Date, asOf: Date = new Date()): string {
  const diffMs = asOf.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

/**
 * Clear all job records (for testing)
 */
export function clearRecurrenceJobs(): void {
  jobStore.clear();
  dailyJobIds.length = 0;
  onDemandJobIds.length = 0;
}
