// lib/os/programs/recurringDeliverables.ts
// Recurring Deliverables Engine
//
// Auto-creates deliverables for programs based on their template cadence.
// Ensures upcoming deliverables exist for the current period (weekly/monthly/quarterly).
//
// Key Features:
// - Idempotent: Won't create duplicates for same period
// - Template-aware: Uses ExpectedOutputs from domain templates
// - Intensity-aware: Respects intensity level cadence rules
// - Timezone-aware: Period boundaries calculated in configurable timezone
// - Observable: Returns detailed results for logging
//
// Idempotency Key Format: ${programId}:${expectedOutputId}:${periodStartISO}
// Example: prog_123:content-batch:weekly-2025-W03

import type { PlanningProgram, PlanningDeliverable, WorkstreamType } from '@/lib/types/program';
import type { CadenceType, ExpectedOutput, IntensityLevel } from '@/lib/types/programTemplate';
import { generatePlanningDeliverableId } from '@/lib/types/program';
import { getDomainTemplate } from '@/lib/os/planning/domainTemplates';

// ============================================================================
// Constants
// ============================================================================

/** Default timezone for period calculations */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// ============================================================================
// Types
// ============================================================================

export interface RecurringDeliverableResult {
  programId: string;
  programTitle: string;
  created: Array<{
    deliverable: PlanningDeliverable;
    outputId: string;
    period: string;
    idempotencyKey: string;
  }>;
  skipped: Array<{
    outputId: string;
    reason: string;
    period: string;
    idempotencyKey: string;
  }>;
  errors: Array<{
    outputId: string;
    error: string;
  }>;
}

export interface EnsureDeliverablesOptions {
  /** Reference date for calculating periods (defaults to now) */
  asOf?: Date;
  /** Number of future periods to create deliverables for (default: 1) */
  periodsAhead?: number;
  /** Only create for these cadences (defaults to all active) */
  cadences?: CadenceType[];
  /** Timezone for period calculations (default: America/Los_Angeles) */
  timezone?: string;
}

// ============================================================================
// Timezone Helpers
// ============================================================================

/**
 * Get current date in specified timezone
 * Returns a Date object representing the current moment in the timezone
 */
export function getDateInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  );
}

/**
 * Get the start of a period (week/month/quarter) in ISO format
 * Used for deterministic idempotency keys
 */
export function getPeriodStartISO(date: Date, cadence: CadenceType): string {
  const year = date.getFullYear();

  switch (cadence) {
    case 'weekly': {
      // Get Monday of the week (ISO week starts on Monday)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      return monday.toISOString().split('T')[0];
    }
    case 'monthly': {
      // First day of month
      return `${year}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
    case 'quarterly': {
      // First day of quarter
      const quarter = Math.floor(date.getMonth() / 3);
      const quarterMonth = quarter * 3 + 1;
      return `${year}-${String(quarterMonth).padStart(2, '0')}-01`;
    }
  }
}

/**
 * Generate a deterministic idempotency key for a recurring deliverable
 * Format: ${programId}:${outputId}:${periodStartISO}
 */
export function generateIdempotencyKey(
  programId: string,
  outputId: string,
  date: Date,
  cadence: CadenceType
): string {
  const periodStart = getPeriodStartISO(date, cadence);
  return `${programId}:${outputId}:${periodStart}`;
}

// ============================================================================
// Period Calculations
// ============================================================================

/**
 * Get the period key for a given date and cadence
 * Format: "weekly-2025-W03", "monthly-2025-01", "quarterly-2025-Q1"
 */
export function getPeriodKey(date: Date, cadence: CadenceType): string {
  const year = date.getFullYear();

  switch (cadence) {
    case 'weekly': {
      // ISO week number calculation
      const tempDate = new Date(date.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
      return `weekly-${year}-W${String(weekNum).padStart(2, '0')}`;
    }
    case 'monthly': {
      const month = date.getMonth() + 1;
      return `monthly-${year}-${String(month).padStart(2, '0')}`;
    }
    case 'quarterly': {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `quarterly-${year}-Q${quarter}`;
    }
  }
}

/**
 * Get the due date for a period
 */
export function getPeriodDueDate(periodKey: string, cadence: CadenceType): Date {
  const parts = periodKey.split('-');
  const year = parseInt(parts[1], 10);

  switch (cadence) {
    case 'weekly': {
      // Parse W## format
      const weekNum = parseInt(parts[2].replace('W', ''), 10);
      const jan4 = new Date(year, 0, 4);
      const daysOffset = (weekNum - 1) * 7 - ((jan4.getDay() + 6) % 7);
      const weekEnd = new Date(jan4);
      weekEnd.setDate(jan4.getDate() + daysOffset + 6); // Sunday of the week
      return weekEnd;
    }
    case 'monthly': {
      // Last day of month
      const month = parseInt(parts[2], 10);
      return new Date(year, month, 0); // Day 0 of next month = last day of current month
    }
    case 'quarterly': {
      // Last day of quarter
      const quarter = parseInt(parts[2].replace('Q', ''), 10);
      const quarterEndMonth = quarter * 3;
      return new Date(year, quarterEndMonth, 0);
    }
  }
}

/**
 * Get periods for a date range
 */
export function getPeriodsInRange(
  startDate: Date,
  endDate: Date,
  cadence: CadenceType
): string[] {
  const periods: string[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const periodKey = getPeriodKey(current, cadence);
    if (!periods.includes(periodKey)) {
      periods.push(periodKey);
    }

    // Advance to next period
    switch (cadence) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarterly':
        current.setMonth(current.getMonth() + 3);
        break;
    }
  }

  return periods;
}

/**
 * Get the next N periods from a given date
 */
export function getUpcomingPeriods(
  fromDate: Date,
  cadence: CadenceType,
  count: number
): string[] {
  const periods: string[] = [];
  const current = new Date(fromDate);

  for (let i = 0; i < count; i++) {
    periods.push(getPeriodKey(current, cadence));

    switch (cadence) {
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'quarterly':
        current.setMonth(current.getMonth() + 3);
        break;
    }
  }

  return periods;
}

// ============================================================================
// Stable Key Generation
// ============================================================================

/**
 * Generate a stable key for a recurring deliverable
 * Used for idempotent creation - same output + period = same key
 */
export function generateRecurringDeliverableKey(
  outputId: string,
  periodKey: string
): string {
  return `recurring::${outputId}::${periodKey}`;
}

/**
 * Check if a deliverable matches a recurring key pattern
 */
export function parseRecurringDeliverableKey(
  stableKey: string
): { outputId: string; periodKey: string } | null {
  if (!stableKey.startsWith('recurring::')) return null;

  const parts = stableKey.split('::');
  if (parts.length !== 3) return null;

  return {
    outputId: parts[1],
    periodKey: parts[2],
  };
}

// ============================================================================
// Main Engine
// ============================================================================

/**
 * Ensure upcoming deliverables exist for a program
 *
 * This function is idempotent - calling it multiple times won't create duplicates.
 * It creates deliverables for the current period and optionally future periods.
 *
 * @param program The program to create deliverables for
 * @param options Configuration options
 * @returns Result with created, skipped, and errored deliverables
 */
export function ensureUpcomingDeliverables(
  program: PlanningProgram,
  options: EnsureDeliverablesOptions = {}
): RecurringDeliverableResult {
  const {
    asOf = new Date(),
    periodsAhead = 1,
    cadences,
  } = options;

  const result: RecurringDeliverableResult = {
    programId: program.id,
    programTitle: program.title,
    created: [],
    skipped: [],
    errors: [],
  };

  // Get template for program's domain
  if (!program.domain) {
    result.errors.push({
      outputId: '*',
      error: 'Program has no domain set',
    });
    return result;
  }

  const template = getDomainTemplate(program.domain);
  if (!template) {
    result.errors.push({
      outputId: '*',
      error: `No template found for domain: ${program.domain}`,
    });
    return result;
  }

  // Get intensity config to determine active cadences
  const intensity: IntensityLevel = program.intensity || 'Standard';
  const intensityConfig = template.intensityLevels[intensity];
  if (!intensityConfig) {
    result.errors.push({
      outputId: '*',
      error: `No intensity config found for: ${intensity}`,
    });
    return result;
  }
  const activeCadences = cadences || intensityConfig.cadence;

  // Get existing deliverable stable keys
  const existingKeys = new Set(
    (program.scope?.deliverables || [])
      .filter((d) => d.id.startsWith('recurring::') || d.id.includes('::'))
      .map((d) => d.id)
  );

  // Also check description field for legacy deliverables with stable keys
  const existingByDescription = new Set(
    (program.scope?.deliverables || [])
      .filter((d) => d.description?.startsWith('recurring::'))
      .map((d) => d.description!)
  );

  // Process each expected output
  for (const output of template.expectedOutputs) {
    // Check if output's cadence is active for this intensity
    if (!activeCadences.includes(output.cadence)) {
      result.skipped.push({
        outputId: output.id,
        reason: `Cadence ${output.cadence} not active for ${intensity} intensity`,
        period: '-',
        idempotencyKey: '', // No key when cadence is skipped entirely
      });
      continue;
    }

    // Get upcoming periods for this cadence
    const periods = getUpcomingPeriods(asOf, output.cadence, periodsAhead);

    for (const period of periods) {
      const stableKey = generateRecurringDeliverableKey(output.id, period);
      // Generate deterministic idempotency key for logging/debugging
      const idempotencyKey = generateIdempotencyKey(program.id, output.id, asOf, output.cadence);

      // Check if deliverable already exists
      if (existingKeys.has(stableKey) || existingByDescription.has(stableKey)) {
        result.skipped.push({
          outputId: output.id,
          reason: 'Already exists',
          period,
          idempotencyKey,
        });
        continue;
      }

      // Create the deliverable
      const dueDate = getPeriodDueDate(period, output.cadence);
      const deliverable: PlanningDeliverable = {
        id: generatePlanningDeliverableId(),
        title: `${output.name} (${formatPeriodLabel(period, output.cadence)})`,
        description: stableKey, // Store stable key in description for idempotency
        type: output.deliverableType || 'document',
        status: 'planned',
        workstreamType: output.workstreamType as WorkstreamType,
        dueDate: dueDate.toISOString().split('T')[0],
      };

      result.created.push({
        deliverable,
        outputId: output.id,
        period,
        idempotencyKey,
      });

      // Add to existing keys to prevent duplicates within same call
      existingByDescription.add(stableKey);
    }
  }

  return result;
}

/**
 * Format a period key for display
 */
export function formatPeriodLabel(periodKey: string, cadence: CadenceType): string {
  const parts = periodKey.split('-');
  const year = parts[1];

  switch (cadence) {
    case 'weekly':
      return `Week ${parts[2].replace('W', '')} ${year}`;
    case 'monthly': {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(parts[2], 10) - 1;
      return `${monthNames[monthIdx]} ${year}`;
    }
    case 'quarterly':
      return `${parts[2]} ${year}`;
  }
}

/**
 * Get a summary of deliverables by cadence for a program
 */
export function getDeliverableCadenceSummary(
  program: PlanningProgram
): Record<CadenceType, { total: number; completed: number; overdue: number }> {
  const now = new Date();
  const summary: Record<CadenceType, { total: number; completed: number; overdue: number }> = {
    weekly: { total: 0, completed: 0, overdue: 0 },
    monthly: { total: 0, completed: 0, overdue: 0 },
    quarterly: { total: 0, completed: 0, overdue: 0 },
  };

  const deliverables = program.scope?.deliverables || [];

  for (const d of deliverables) {
    // Try to parse recurring key from description
    const parsed = d.description ? parseRecurringDeliverableKey(d.description) : null;
    if (!parsed) continue;

    // Determine cadence from period key
    let cadence: CadenceType | null = null;
    if (parsed.periodKey.startsWith('weekly-')) cadence = 'weekly';
    else if (parsed.periodKey.startsWith('monthly-')) cadence = 'monthly';
    else if (parsed.periodKey.startsWith('quarterly-')) cadence = 'quarterly';

    if (!cadence) continue;

    summary[cadence].total++;

    if (d.status === 'completed') {
      summary[cadence].completed++;
    } else if (d.dueDate) {
      const dueDate = new Date(d.dueDate);
      if (dueDate < now) {
        summary[cadence].overdue++;
      }
    }
  }

  return summary;
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Ensure deliverables for multiple programs
 */
export function ensureDeliverablesForPrograms(
  programs: PlanningProgram[],
  options: EnsureDeliverablesOptions = {}
): RecurringDeliverableResult[] {
  return programs
    .filter((p) => p.status !== 'archived' && p.domain)
    .map((p) => ensureUpcomingDeliverables(p, options));
}

/**
 * Get total counts from multiple results
 */
export function summarizeDeliverableResults(
  results: RecurringDeliverableResult[]
): {
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  programsProcessed: number;
} {
  return {
    totalCreated: results.reduce((sum, r) => sum + r.created.length, 0),
    totalSkipped: results.reduce((sum, r) => sum + r.skipped.length, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    programsProcessed: results.length,
  };
}
