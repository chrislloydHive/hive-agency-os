// lib/types/weeklyBrief.ts
// Weekly Brief types for automated Monday morning summaries
//
// Briefs are generated weekly per company and stored for historical access.
// Content is deterministic and grounded in OS data (no pricing).

import { z } from 'zod';
import type { ProgramDomain } from './programTemplate';
import type { HealthStatus } from '@/lib/os/programs/programHealth';

// ============================================================================
// Week Key Helpers
// ============================================================================

/**
 * Get the ISO week key for a date
 * Format: YYYY-Www (e.g., 2025-W03)
 */
export function getWeekKey(date: Date = new Date()): string {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${tempDate.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get the previous week's key
 */
export function getPreviousWeekKey(date: Date = new Date()): string {
  const prevWeek = new Date(date.getTime());
  prevWeek.setDate(prevWeek.getDate() - 7);
  return getWeekKey(prevWeek);
}

/**
 * Parse a week key into year and week number
 */
export function parseWeekKey(weekKey: string): { year: number; week: number } | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  return { year: parseInt(match[1]), week: parseInt(match[2]) };
}

/**
 * Get the Monday date for a week key
 */
export function getWeekStartDate(weekKey: string): Date | null {
  const parsed = parseWeekKey(weekKey);
  if (!parsed) return null;

  // Find January 4th of that year (always in week 1 per ISO)
  const jan4 = new Date(parsed.year, 0, 4);
  // Find Monday of week 1
  const dayOfWeek = jan4.getDay() || 7; // Sunday = 7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  // Add weeks to get to target week
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (parsed.week - 1) * 7);
  return targetMonday;
}

// ============================================================================
// Brief Content Types
// ============================================================================

export interface DeliverablesByDomain {
  domain: ProgramDomain;
  count: number;
  items: Array<{
    id: string;
    title: string;
    dueDate: string;
    programTitle: string;
  }>;
}

export interface ProgramHealthSummary {
  programId: string;
  programTitle: string;
  domain: ProgramDomain | null;
  status: HealthStatus;
  topIssues: string[];
}

export interface RunbookLastWeekSummary {
  weekKey: string;
  completionPercentage: number;
  completedItems: number;
  totalItems: number;
  incompleteByDomain: Array<{
    domain: ProgramDomain;
    pendingCount: number;
  }>;
}

export interface ApprovalPending {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export interface ScopeDriftSummary {
  totalBlocked: number;
  blockedActions: Array<{
    code: string;
    count: number;
    description: string;
  }>;
  recommendedActions: string[];
}

export interface RecentChange {
  type: 'intensity_changed' | 'status_changed';
  programId: string;
  programTitle: string;
  description: string;
  timestamp: string;
}

export interface RecommendedAction {
  id: string;
  priority: number;
  category: 'drift' | 'overdue' | 'approvals' | 'health' | 'runbook';
  action: string;
  context?: string;
}

// ============================================================================
// Weekly Brief Schema
// ============================================================================

export interface WeeklyBriefContent {
  thisWeek: DeliverablesByDomain[];
  overdue: DeliverablesByDomain[];
  programHealth: {
    summary: {
      healthy: number;
      attention: number;
      atRisk: number;
    };
    atRiskPrograms: ProgramHealthSummary[];
  };
  runbook: RunbookLastWeekSummary | null;
  approvalsPending: {
    count: number;
    items: ApprovalPending[];
  };
  scopeDrift: ScopeDriftSummary;
  recentChanges: RecentChange[];
  recommendedActions: RecommendedAction[];
}

export interface WeeklyBriefSourceSummary {
  programsCount: number;
  deliverablesThisWeek: number;
  deliverablesOverdue: number;
  workItemsInProgress: number;
  approvalsCount: number;
  scopeViolationsLast30Days: number;
  recentChangesCount: number;
}

export const WeeklyBriefSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  weekKey: z.string().regex(/^\d{4}-W\d{2}$/),
  createdAt: z.string(),
  createdBy: z.string(), // 'system' | userId
  contentMarkdown: z.string(),
  content: z.custom<WeeklyBriefContent>(),
  sourceSummary: z.custom<WeeklyBriefSourceSummary>(),
  debugId: z.string(),
});

export type WeeklyBrief = z.infer<typeof WeeklyBriefSchema>;

// ============================================================================
// API Types
// ============================================================================

export interface WeeklyBriefResponse {
  brief: WeeklyBrief | null;
  weekKey: string;
  hasHistory: boolean;
}

export interface RegenerateBriefResponse {
  debugId: string;
  message: string;
  status: 'triggered' | 'already_running';
}

// ============================================================================
// Event Types
// ============================================================================

export interface WeeklyBriefGeneratedEvent {
  companyId: string;
  weekKey: string;
  briefId: string;
  debugId: string;
  createdBy: string;
  sourceSummary: WeeklyBriefSourceSummary;
}
