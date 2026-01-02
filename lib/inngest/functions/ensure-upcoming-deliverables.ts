// lib/inngest/functions/ensure-upcoming-deliverables.ts
// Inngest jobs for recurring deliverable creation
//
// Two functions:
// 1. Daily scheduled: Runs at 6am America/Los_Angeles, processes all companies
// 2. On-demand: Triggered by event for specific company
//
// Both use:
// - Deterministic idempotency keys: ${programId}:${expectedOutputId}:${periodStartISO}
// - Concurrency control: 1 per companyId
// - Operational event logging

import { inngest } from '../client';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { listPlanningPrograms, updatePlanningProgram } from '@/lib/airtable/planningPrograms';
import {
  ensureUpcomingDeliverables,
  summarizeDeliverableResults,
  type RecurringDeliverableResult,
} from '@/lib/os/programs/recurringDeliverables';
import { logHiveEventImmediate } from '@/lib/telemetry/events';
import { generateDebugId } from '@/lib/types/operationalEvent';
import type { PlanningProgram } from '@/lib/types/program';

// ============================================================================
// Constants
// ============================================================================

// Daily job runs at 6am Pacific
const DAILY_SCHEDULE = '0 6 * * *'; // 6am UTC, adjust for Pacific in description

// Default timezone for period calculations
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

// ============================================================================
// Event Types
// ============================================================================

export type EnsureDeliverablesRequestedEvent = {
  name: 'os/ensure-upcoming-deliverables.requested';
  data: {
    companyId: string;
    requestedBy?: string;
    debugId?: string;
  };
};

export type EnsureDeliverablesCompletedEvent = {
  name: 'os/ensure-upcoming-deliverables.completed';
  data: {
    companyId: string;
    debugId: string;
    programsProcessed: number;
    deliverablesCreated: number;
    deliverablesSkipped: number;
    errors: number;
  };
};

// ============================================================================
// Helper: Get Reference Date in Timezone
// ============================================================================

/**
 * Get the current date in the specified timezone
 * Used for deterministic period calculations
 */
function getDateInTimezone(timezone: string = DEFAULT_TIMEZONE): Date {
  // Get current time in specified timezone
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

  // Create date object in local timezone but representing the timezone time
  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  );
}

// ============================================================================
// Helper: Process Single Company
// ============================================================================

async function processCompanyDeliverables(
  companyId: string,
  debugId: string
): Promise<{
  results: RecurringDeliverableResult[];
  summary: ReturnType<typeof summarizeDeliverableResults>;
  programsUpdated: number;
}> {
  // Get active programs for this company
  const programs = await listPlanningPrograms(companyId);
  const activePrograms = programs.filter(
    (p) => p.status !== 'archived' && p.domain
  );

  if (activePrograms.length === 0) {
    return {
      results: [],
      summary: { totalCreated: 0, totalSkipped: 0, totalErrors: 0, programsProcessed: 0 },
      programsUpdated: 0,
    };
  }

  // Get reference date in Pacific timezone
  const asOf = getDateInTimezone(DEFAULT_TIMEZONE);

  // Process each program
  const results: RecurringDeliverableResult[] = [];
  let programsUpdated = 0;

  for (const program of activePrograms) {
    const result = ensureUpcomingDeliverables(program, {
      asOf,
      periodsAhead: 1, // Current period only
    });

    results.push(result);

    // If any deliverables were created, update the program
    if (result.created.length > 0) {
      const existingDeliverables = program.scope?.deliverables || [];
      const newDeliverables = result.created.map((c) => c.deliverable);

      await updatePlanningProgram(program.id, {
        scope: {
          ...program.scope,
          deliverables: [...existingDeliverables, ...newDeliverables],
        },
      });

      programsUpdated++;
    }
  }

  const summary = summarizeDeliverableResults(results);

  return { results, summary, programsUpdated };
}

// ============================================================================
// Helper: Log Operational Event
// ============================================================================

async function logDeliverableJobEvent(
  eventType: 'job_started' | 'deliverables_ensured' | 'job_failed',
  companyId: string,
  debugId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await logHiveEventImmediate({
    type: `os.deliverables.${eventType}` as any,
    companyId,
    metadata: {
      debugId,
      eventType,
      ...payload,
    },
  });
}

// ============================================================================
// SCHEDULED FUNCTION: Daily at 6am Pacific
// ============================================================================

export const ensureUpcomingDeliverablesDaily = inngest.createFunction(
  {
    id: 'os-ensure-upcoming-deliverables-daily',
    name: 'Ensure Upcoming Deliverables (Daily)',
    retries: 2,
    concurrency: {
      limit: 1, // Only run one daily job at a time globally
    },
  },
  // Run daily at 6am UTC (adjust for Pacific with DST consideration)
  { cron: DAILY_SCHEDULE },
  async ({ step }) => {
    const jobDebugId = generateDebugId();
    console.log(`[EnsureDeliverables:Daily] Starting scheduled job... debugId=${jobDebugId}`);

    // ========================================================================
    // STEP 1: Fetch all companies with active programs
    // ========================================================================
    const companiesWithPrograms = await step.run('fetch-companies', async () => {
      console.log('[EnsureDeliverables:Daily] Fetching companies...');

      const allCompanies = await getAllCompanies();
      const results: Array<{ id: string; name: string }> = [];

      // Check each company for active programs
      for (const company of allCompanies) {
        const programs = await listPlanningPrograms(company.id);
        const hasActive = programs.some(
          (p) => p.status !== 'archived' && p.domain
        );

        if (hasActive) {
          results.push({ id: company.id, name: company.name });
        }
      }

      console.log(`[EnsureDeliverables:Daily] Found ${results.length} companies with active programs`);
      return results;
    });

    if (companiesWithPrograms.length === 0) {
      console.log('[EnsureDeliverables:Daily] No companies with active programs. Done.');
      return {
        debugId: jobDebugId,
        companiesProcessed: 0,
        totalDeliverablesCreated: 0,
        totalDeliverablesSkipped: 0,
        totalErrors: 0,
      };
    }

    // ========================================================================
    // STEP 2: Process each company (sequential to respect concurrency)
    // ========================================================================
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    let companiesProcessed = 0;

    for (const company of companiesWithPrograms) {
      const companyResult = await step.run(
        `process-${company.id}`,
        async () => {
          const companyDebugId = generateDebugId();
          console.log(
            `[EnsureDeliverables:Daily] Processing ${company.name} (${company.id})... debugId=${companyDebugId}`
          );

          try {
            // Log job started
            await logDeliverableJobEvent('job_started', company.id, companyDebugId, {
              source: 'daily_schedule',
              companyName: company.name,
            });

            const { results, summary, programsUpdated } =
              await processCompanyDeliverables(company.id, companyDebugId);

            // Log completion
            await logDeliverableJobEvent('deliverables_ensured', company.id, companyDebugId, {
              source: 'daily_schedule',
              programsProcessed: summary.programsProcessed,
              deliverablesCreated: summary.totalCreated,
              deliverablesSkipped: summary.totalSkipped,
              errors: summary.totalErrors,
              programsUpdated,
            });

            console.log(
              `[EnsureDeliverables:Daily] ${company.name}: Created ${summary.totalCreated}, Skipped ${summary.totalSkipped}, Errors ${summary.totalErrors}`
            );

            return {
              success: true,
              created: summary.totalCreated,
              skipped: summary.totalSkipped,
              errors: summary.totalErrors,
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(
              `[EnsureDeliverables:Daily] ${company.name}: Error - ${errorMessage}`
            );

            await logDeliverableJobEvent('job_failed', company.id, companyDebugId, {
              source: 'daily_schedule',
              error: errorMessage,
            });

            return {
              success: false,
              created: 0,
              skipped: 0,
              errors: 1,
              error: errorMessage,
            };
          }
        }
      );

      totalCreated += companyResult.created;
      totalSkipped += companyResult.skipped;
      totalErrors += companyResult.errors;
      companiesProcessed++;
    }

    // ========================================================================
    // STEP 3: Summary
    // ========================================================================
    const summary = {
      debugId: jobDebugId,
      companiesProcessed,
      totalDeliverablesCreated: totalCreated,
      totalDeliverablesSkipped: totalSkipped,
      totalErrors,
    };

    console.log('[EnsureDeliverables:Daily] ============================================');
    console.log('[EnsureDeliverables:Daily] DAILY JOB COMPLETE');
    console.log(`[EnsureDeliverables:Daily] Companies processed: ${companiesProcessed}`);
    console.log(`[EnsureDeliverables:Daily] Deliverables created: ${totalCreated}`);
    console.log(`[EnsureDeliverables:Daily] Deliverables skipped: ${totalSkipped}`);
    console.log(`[EnsureDeliverables:Daily] Errors: ${totalErrors}`);
    console.log('[EnsureDeliverables:Daily] ============================================');

    return summary;
  }
);

// ============================================================================
// ON-DEMAND FUNCTION: Triggered by event
// ============================================================================

export const ensureUpcomingDeliverablesOnDemand = inngest.createFunction(
  {
    id: 'os-ensure-upcoming-deliverables-on-demand',
    name: 'Ensure Upcoming Deliverables (On-Demand)',
    retries: 2,
    concurrency: {
      limit: 1,
      key: 'event.data.companyId', // One at a time per company
    },
  },
  { event: 'os/ensure-upcoming-deliverables.requested' },
  async ({ event, step }) => {
    const { companyId, requestedBy, debugId: eventDebugId } = event.data;
    const debugId = eventDebugId || generateDebugId();

    console.log(
      `[EnsureDeliverables:OnDemand] Processing company ${companyId}... debugId=${debugId}`
    );

    // ========================================================================
    // STEP 1: Log job started
    // ========================================================================
    await step.run('log-started', async () => {
      await logDeliverableJobEvent('job_started', companyId, debugId, {
        source: 'on_demand',
        requestedBy,
      });
    });

    // ========================================================================
    // STEP 2: Process company deliverables
    // ========================================================================
    const result = await step.run('process-deliverables', async () => {
      try {
        const { results, summary, programsUpdated } =
          await processCompanyDeliverables(companyId, debugId);

        return {
          success: true,
          programsProcessed: summary.programsProcessed,
          deliverablesCreated: summary.totalCreated,
          deliverablesSkipped: summary.totalSkipped,
          errors: summary.totalErrors,
          programsUpdated,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[EnsureDeliverables:OnDemand] Error: ${errorMessage}`);

        return {
          success: false,
          programsProcessed: 0,
          deliverablesCreated: 0,
          deliverablesSkipped: 0,
          errors: 1,
          error: errorMessage,
        };
      }
    });

    // ========================================================================
    // STEP 3: Log completion
    // ========================================================================
    await step.run('log-completed', async () => {
      if (result.success) {
        await logDeliverableJobEvent('deliverables_ensured', companyId, debugId, {
          source: 'on_demand',
          requestedBy,
          ...result,
        });
      } else {
        await logDeliverableJobEvent('job_failed', companyId, debugId, {
          source: 'on_demand',
          requestedBy,
          error: 'error' in result ? result.error : 'Unknown error',
        });
      }
    });

    // ========================================================================
    // STEP 4: Emit completion event
    // ========================================================================
    await step.sendEvent('emit-completed', {
      name: 'os/ensure-upcoming-deliverables.completed',
      data: {
        companyId,
        debugId,
        programsProcessed: result.programsProcessed,
        deliverablesCreated: result.deliverablesCreated,
        deliverablesSkipped: result.deliverablesSkipped,
        errors: result.errors,
      },
    });

    console.log(
      `[EnsureDeliverables:OnDemand] Complete. Created=${result.deliverablesCreated}, Skipped=${result.deliverablesSkipped}, Errors=${result.errors}`
    );

    return {
      debugId,
      companyId,
      ...result,
    };
  }
);
