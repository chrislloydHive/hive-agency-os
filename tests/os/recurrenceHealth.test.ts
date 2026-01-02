// tests/os/recurrenceHealth.test.ts
// Tests for the Recurrence Health / SLO Monitoring system

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordJobStart,
  recordJobCompletion,
  recordJobFailure,
  getJobRecord,
  getLastDailyJob,
  getLastOnDemandJob,
  getRecentJobs,
  getRecurrenceHealthSummary,
  getRecurrenceWarning,
  formatDuration,
  formatJobStatus,
  formatTimeAgo,
  clearRecurrenceJobs,
  STALE_THRESHOLD_HOURS,
} from '@/lib/os/programs/recurrenceHealth';

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
  clearRecurrenceJobs();
});

// ============================================================================
// Job Recording Tests
// ============================================================================

describe('recordJobStart', () => {
  it('creates a job record with required fields', () => {
    const job = recordJobStart('daily');

    expect(job.id).toBeTruthy();
    expect(job.debugId).toBeTruthy();
    expect(job.jobType).toBe('daily');
    expect(job.status).toBe('running');
    expect(job.startedAt).toBeTruthy();
  });

  it('includes optional companyId for on_demand jobs', () => {
    const job = recordJobStart('on_demand', { companyId: 'company-1' });

    expect(job.jobType).toBe('on_demand');
    expect(job.companyId).toBe('company-1');
  });

  it('uses provided debugId', () => {
    const job = recordJobStart('daily', { debugId: 'custom-debug' });

    expect(job.debugId).toBe('custom-debug');
  });

  it('generates unique IDs for each job', () => {
    const job1 = recordJobStart('daily');
    const job2 = recordJobStart('daily');

    expect(job1.id).not.toBe(job2.id);
  });
});

describe('recordJobCompletion', () => {
  it('updates job with completion data', () => {
    const job = recordJobStart('daily');
    const completed = recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 10,
      deliverablesSkipped: 3,
      errors: 0,
    });

    expect(completed?.status).toBe('completed');
    expect(completed?.completedAt).toBeTruthy();
    expect(completed?.durationMs).toBeGreaterThanOrEqual(0);
    expect(completed?.companiesProcessed).toBe(5);
    expect(completed?.deliverablesCreated).toBe(10);
    expect(completed?.deliverablesSkipped).toBe(3);
    expect(completed?.errors).toBe(0);
  });

  it('returns null for non-existent job', () => {
    const result = recordJobCompletion('non-existent', {
      companiesProcessed: 0,
      deliverablesCreated: 0,
      deliverablesSkipped: 0,
      errors: 0,
    });

    expect(result).toBeNull();
  });

  it('calculates duration correctly', async () => {
    const job = recordJobStart('daily');

    // Small delay to ensure measurable duration
    await new Promise(resolve => setTimeout(resolve, 10));

    const completed = recordJobCompletion(job.id, {
      companiesProcessed: 1,
      deliverablesCreated: 1,
      deliverablesSkipped: 0,
      errors: 0,
    });

    expect(completed?.durationMs).toBeGreaterThan(0);
  });
});

describe('recordJobFailure', () => {
  it('updates job with failure data', () => {
    const job = recordJobStart('daily');
    const failed = recordJobFailure(job.id, 'Database connection timeout');

    expect(failed?.status).toBe('failed');
    expect(failed?.completedAt).toBeTruthy();
    expect(failed?.errorMessage).toBe('Database connection timeout');
  });

  it('includes partial results if provided', () => {
    const job = recordJobStart('daily');
    const failed = recordJobFailure(job.id, 'Error mid-process', {
      companiesProcessed: 3,
    });

    expect(failed?.companiesProcessed).toBe(3);
  });

  it('returns null for non-existent job', () => {
    const result = recordJobFailure('non-existent', 'Error');
    expect(result).toBeNull();
  });
});

// ============================================================================
// Job Retrieval Tests
// ============================================================================

describe('getJobRecord', () => {
  it('retrieves a job by ID', () => {
    const job = recordJobStart('daily');
    const retrieved = getJobRecord(job.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(job.id);
  });

  it('returns undefined for non-existent ID', () => {
    const retrieved = getJobRecord('non-existent');
    expect(retrieved).toBeUndefined();
  });
});

describe('getLastDailyJob', () => {
  it('returns the most recent daily job', () => {
    const job1 = recordJobStart('daily');
    const job2 = recordJobStart('daily');

    const last = getLastDailyJob();
    expect(last?.id).toBe(job2.id);
  });

  it('returns null when no daily jobs exist', () => {
    const last = getLastDailyJob();
    expect(last).toBeNull();
  });

  it('ignores on_demand jobs', () => {
    recordJobStart('on_demand');
    const job = recordJobStart('daily');

    const last = getLastDailyJob();
    expect(last?.id).toBe(job.id);
  });
});

describe('getLastOnDemandJob', () => {
  it('returns the most recent on_demand job', () => {
    const job1 = recordJobStart('on_demand');
    const job2 = recordJobStart('on_demand');

    const last = getLastOnDemandJob();
    expect(last?.id).toBe(job2.id);
  });

  it('returns null when no on_demand jobs exist', () => {
    const last = getLastOnDemandJob();
    expect(last).toBeNull();
  });
});

describe('getRecentJobs', () => {
  it('returns jobs of all types by default', () => {
    recordJobStart('daily');
    recordJobStart('on_demand');
    recordJobStart('daily');

    const jobs = getRecentJobs();
    expect(jobs).toHaveLength(3);
  });

  it('filters by job type', () => {
    recordJobStart('daily');
    recordJobStart('on_demand');
    recordJobStart('daily');

    const dailyJobs = getRecentJobs({ jobType: 'daily' });
    expect(dailyJobs).toHaveLength(2);

    const onDemandJobs = getRecentJobs({ jobType: 'on_demand' });
    expect(onDemandJobs).toHaveLength(1);
  });

  it('limits results', () => {
    for (let i = 0; i < 10; i++) {
      recordJobStart('daily');
    }

    const jobs = getRecentJobs({ limit: 5 });
    expect(jobs).toHaveLength(5);
  });

  it('sorts by startedAt descending', () => {
    const job1 = recordJobStart('daily');
    const job2 = recordJobStart('daily');

    const jobs = getRecentJobs();
    expect(jobs[0].id).toBe(job2.id);
    expect(jobs[1].id).toBe(job1.id);
  });
});

// ============================================================================
// Health Summary Tests
// ============================================================================

describe('getRecurrenceHealthSummary', () => {
  it('returns healthy when recent successful daily run', () => {
    const job = recordJobStart('daily');
    recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 10,
      deliverablesSkipped: 0,
      errors: 0,
    });

    const health = getRecurrenceHealthSummary();

    expect(health.isHealthy).toBe(true);
    expect(health.isStale).toBe(false);
    expect(health.healthIssues).toHaveLength(0);
  });

  it('marks as stale when no runs exist', () => {
    const health = getRecurrenceHealthSummary();

    expect(health.isStale).toBe(true);
    expect(health.staleReason).toBe('No daily runs recorded');
    expect(health.isHealthy).toBe(false);
  });

  it('marks as stale when last run is too old', () => {
    const job = recordJobStart('daily');
    recordJobCompletion(job.id, {
      companiesProcessed: 1,
      deliverablesCreated: 1,
      deliverablesSkipped: 0,
      errors: 0,
    });

    // Simulate time passing beyond stale threshold
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + STALE_THRESHOLD_HOURS + 1);

    const health = getRecurrenceHealthSummary(futureDate);

    expect(health.isStale).toBe(true);
    expect(health.staleReason).toContain('hours ago');
  });

  it('includes failed job in health issues', () => {
    const job = recordJobStart('daily');
    recordJobFailure(job.id, 'Connection failed');

    const health = getRecurrenceHealthSummary();

    expect(health.isHealthy).toBe(false);
    expect(health.healthIssues.some(i => i.includes('failed'))).toBe(true);
  });

  it('includes job errors in health issues', () => {
    const job = recordJobStart('daily');
    recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 8,
      deliverablesSkipped: 0,
      errors: 2,
    });

    const health = getRecurrenceHealthSummary();

    expect(health.healthIssues.some(i => i.includes('2 errors'))).toBe(true);
  });

  it('calculates 24h statistics correctly', () => {
    // Create some jobs
    const job1 = recordJobStart('daily');
    recordJobCompletion(job1.id, {
      companiesProcessed: 3,
      deliverablesCreated: 6,
      deliverablesSkipped: 1,
      errors: 0,
    });

    const job2 = recordJobStart('daily');
    recordJobCompletion(job2.id, {
      companiesProcessed: 3,
      deliverablesCreated: 4,
      deliverablesSkipped: 0,
      errors: 0,
    });

    const job3 = recordJobStart('on_demand', { companyId: 'company-1' });
    recordJobFailure(job3.id, 'Test failure');

    const health = getRecurrenceHealthSummary();

    expect(health.totalRunsLast24h).toBe(3);
    expect(health.successfulRunsLast24h).toBe(2);
    expect(health.failedRunsLast24h).toBe(1);
    expect(health.deliverablesCreatedLast24h).toBe(10);
  });

  it('includes last daily and on-demand runs', () => {
    const dailyJob = recordJobStart('daily');
    recordJobCompletion(dailyJob.id, {
      companiesProcessed: 5,
      deliverablesCreated: 10,
      deliverablesSkipped: 0,
      errors: 0,
    });

    const onDemandJob = recordJobStart('on_demand', { companyId: 'company-1' });
    recordJobCompletion(onDemandJob.id, {
      companiesProcessed: 1,
      deliverablesCreated: 2,
      deliverablesSkipped: 0,
      errors: 0,
    });

    const health = getRecurrenceHealthSummary();

    expect(health.lastDailyRun?.id).toBe(dailyJob.id);
    expect(health.lastOnDemandRun?.id).toBe(onDemandJob.id);
  });
});

// ============================================================================
// Warning Tests
// ============================================================================

describe('getRecurrenceWarning', () => {
  it('returns no warning when healthy', () => {
    const job = recordJobStart('daily');
    recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 10,
      deliverablesSkipped: 0,
      errors: 0,
    });

    const warning = getRecurrenceWarning();

    expect(warning.showWarning).toBe(false);
    expect(warning.warningType).toBeNull();
    expect(warning.message).toBeNull();
  });

  it('returns stale warning when system is stale', () => {
    const warning = getRecurrenceWarning();

    expect(warning.showWarning).toBe(true);
    expect(warning.warningType).toBe('stale');
    expect(warning.message).toBeTruthy();
  });

  it('returns failed warning when last run failed', () => {
    const job = recordJobStart('daily');
    recordJobFailure(job.id, 'Database error');

    const warning = getRecurrenceWarning();

    expect(warning.showWarning).toBe(true);
    expect(warning.warningType).toBe('failed');
    expect(warning.message).toContain('Database error');
    expect(warning.debugId).toBe(job.debugId);
  });

  it('prioritizes stale over failed', () => {
    const job = recordJobStart('daily');
    recordJobFailure(job.id, 'Error');

    // Simulate time passing beyond stale threshold
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + STALE_THRESHOLD_HOURS + 1);

    const warning = getRecurrenceWarning(futureDate);

    expect(warning.warningType).toBe('stale');
  });
});

// ============================================================================
// Formatting Tests
// ============================================================================

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes', () => {
    expect(formatDuration(120000)).toBe('2m');
  });
});

describe('formatJobStatus', () => {
  it('formats running status', () => {
    const job = recordJobStart('daily');
    expect(formatJobStatus(job)).toBe('Running...');
  });

  it('formats completed status', () => {
    const job = recordJobStart('daily');
    const completed = recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 10,
      deliverablesSkipped: 0,
      errors: 0,
    });
    expect(formatJobStatus(completed!)).toBe('Completed (10 created)');
  });

  it('formats completed with errors', () => {
    const job = recordJobStart('daily');
    const completed = recordJobCompletion(job.id, {
      companiesProcessed: 5,
      deliverablesCreated: 8,
      deliverablesSkipped: 0,
      errors: 2,
    });
    expect(formatJobStatus(completed!)).toBe('Completed with 2 errors');
  });

  it('formats failed status', () => {
    const job = recordJobStart('daily');
    const failed = recordJobFailure(job.id, 'Network error');
    expect(formatJobStatus(failed!)).toBe('Failed: Network error');
  });
});

describe('formatTimeAgo', () => {
  it('formats just now', () => {
    const now = new Date();
    expect(formatTimeAgo(now, now)).toBe('just now');
  });

  it('formats minutes ago', () => {
    const now = new Date();
    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(formatTimeAgo(tenMinsAgo, now)).toBe('10m ago');
  });

  it('formats hours ago', () => {
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    expect(formatTimeAgo(threeHoursAgo, now)).toBe('3h ago');
  });

  it('formats yesterday', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(yesterday, now)).toBe('yesterday');
  });

  it('formats days ago', () => {
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(fiveDaysAgo, now)).toBe('5d ago');
  });
});

// ============================================================================
// Job Store Limits Tests
// ============================================================================

describe('Job Store Limits', () => {
  it('maintains only last 100 daily jobs', () => {
    for (let i = 0; i < 110; i++) {
      recordJobStart('daily');
    }

    const jobs = getRecentJobs({ jobType: 'daily', limit: 200 });
    expect(jobs.length).toBeLessThanOrEqual(100);
  });

  it('maintains only last 100 on_demand jobs', () => {
    for (let i = 0; i < 110; i++) {
      recordJobStart('on_demand');
    }

    const jobs = getRecentJobs({ jobType: 'on_demand', limit: 200 });
    expect(jobs.length).toBeLessThanOrEqual(100);
  });
});

// ============================================================================
// Clear Function Tests
// ============================================================================

describe('clearRecurrenceJobs', () => {
  it('clears all job records', () => {
    recordJobStart('daily');
    recordJobStart('on_demand');

    clearRecurrenceJobs();

    expect(getLastDailyJob()).toBeNull();
    expect(getLastOnDemandJob()).toBeNull();
    expect(getRecentJobs()).toHaveLength(0);
  });
});
