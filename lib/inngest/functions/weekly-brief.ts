// lib/inngest/functions/weekly-brief.ts
// Inngest jobs for Weekly Brief generation
//
// Two functions:
// 1. Monday scheduled: Runs at 7am America/Los_Angeles every Monday
// 2. On-demand: Triggered by event for specific company
//
// Both use:
// - Idempotent upsert by companyId + weekKey
// - Operational event logging
// - Concurrency control per company

import { inngest } from '../client';
import { getAllCompanies } from '@/lib/airtable/companies';
import { listPlanningPrograms } from '@/lib/airtable/planningPrograms';
import { getWorkItemsForCompany } from '@/lib/airtable/workItems';
import { generateWeeklyBrief } from '@/lib/os/briefs/generateWeeklyBrief';
import { upsertWeeklyBrief, briefExists } from '@/lib/os/briefs/briefStore';
import { logHiveEventImmediate } from '@/lib/telemetry/events';
import { generateDebugId } from '@/lib/types/operationalEvent';
import { getWeekKey } from '@/lib/types/weeklyBrief';

// ============================================================================
// Constants
// ============================================================================

// Monday at 7am Pacific (14:00 UTC during PST, 15:00 UTC during PDT)
// Using 15:00 UTC as a reasonable approximation for 7am PT
const MONDAY_7AM_SCHEDULE = '0 15 * * 1';

// ============================================================================
// Event Types
// ============================================================================

export type WeeklyBriefRequestedEvent = {
  name: 'os/weekly-brief.requested';
  data: {
    companyId: string;
    requestedBy?: string;
    debugId?: string;
    weekKey?: string;
  };
};

export type WeeklyBriefGeneratedEvent = {
  name: 'os/weekly-brief.generated';
  data: {
    companyId: string;
    weekKey: string;
    briefId: string;
    debugId: string;
    createdBy: string;
    programsCount: number;
  };
};

// ============================================================================
// Helper: Log Event
// ============================================================================

async function logBriefEvent(
  eventType: 'job_started' | 'brief_generated' | 'job_failed' | 'brief_skipped',
  companyId: string,
  debugId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await logHiveEventImmediate({
    type: `os.weekly_brief.${eventType}` as any,
    companyId,
    metadata: {
      debugId,
      eventType,
      ...payload,
    },
  });
}

// ============================================================================
// Helper: Generate Brief for Company
// ============================================================================

async function generateBriefForCompany(
  companyId: string,
  debugId: string,
  options: {
    weekKey?: string;
    createdBy?: string;
    force?: boolean;
  } = {}
): Promise<{
  success: boolean;
  briefId?: string;
  skipped?: boolean;
  error?: string;
  weekKey: string;
  programsCount: number;
}> {
  const weekKey = options.weekKey || getWeekKey();
  const createdBy = options.createdBy || 'system';

  // Check if brief already exists (idempotency)
  if (!options.force && briefExists(companyId, weekKey)) {
    return {
      success: true,
      skipped: true,
      weekKey,
      programsCount: 0,
    };
  }

  try {
    // Fetch data
    const [programs, workItems] = await Promise.all([
      listPlanningPrograms(companyId),
      getWorkItemsForCompany(companyId),
    ]);

    // Filter to active programs
    const activePrograms = programs.filter(
      (p) => p.status !== 'archived' && p.domain
    );

    if (activePrograms.length === 0) {
      return {
        success: true,
        skipped: true,
        weekKey,
        programsCount: 0,
      };
    }

    // Generate brief
    const { brief, debugId: briefDebugId } = generateWeeklyBrief({
      companyId,
      programs,
      workItems,
      weekKey,
      createdBy,
      debugId,
    });

    // Save to store (idempotent upsert)
    upsertWeeklyBrief(brief);

    return {
      success: true,
      briefId: brief.id,
      weekKey,
      programsCount: activePrograms.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
      weekKey,
      programsCount: 0,
    };
  }
}

// ============================================================================
// SCHEDULED FUNCTION: Monday at 7am Pacific
// ============================================================================

export const weeklyBriefMonday = inngest.createFunction(
  {
    id: 'os-weekly-brief-monday',
    name: 'Generate Weekly Briefs (Monday 7am PT)',
    retries: 2,
    concurrency: {
      limit: 1, // Only run one scheduled job at a time
    },
  },
  { cron: MONDAY_7AM_SCHEDULE },
  async ({ step }) => {
    const jobDebugId = generateDebugId();
    const weekKey = getWeekKey();
    console.log(`[WeeklyBrief:Monday] Starting scheduled job... debugId=${jobDebugId} weekKey=${weekKey}`);

    // ========================================================================
    // STEP 1: Fetch companies with active programs
    // ========================================================================
    const eligibleCompanies = await step.run('fetch-companies', async () => {
      console.log('[WeeklyBrief:Monday] Fetching companies with active programs...');

      const allCompanies = await getAllCompanies();
      const results: Array<{ id: string; name: string }> = [];

      for (const company of allCompanies) {
        const programs = await listPlanningPrograms(company.id);
        const hasActive = programs.some(
          (p) => p.status !== 'archived' && p.domain
        );

        if (hasActive) {
          results.push({ id: company.id, name: company.name });
        }
      }

      console.log(`[WeeklyBrief:Monday] Found ${results.length} eligible companies`);
      return results;
    });

    if (eligibleCompanies.length === 0) {
      console.log('[WeeklyBrief:Monday] No eligible companies. Done.');
      return {
        debugId: jobDebugId,
        weekKey,
        companiesProcessed: 0,
        briefsGenerated: 0,
        briefsSkipped: 0,
        errors: 0,
      };
    }

    // ========================================================================
    // STEP 2: Generate briefs for each company
    // ========================================================================
    let briefsGenerated = 0;
    let briefsSkipped = 0;
    let errors = 0;

    for (const company of eligibleCompanies) {
      const result = await step.run(
        `generate-brief-${company.id}`,
        async () => {
          const companyDebugId = generateDebugId();
          console.log(`[WeeklyBrief:Monday] Processing ${company.name}... debugId=${companyDebugId}`);

          await logBriefEvent('job_started', company.id, companyDebugId, {
            source: 'monday_schedule',
            weekKey,
            companyName: company.name,
          });

          const briefResult = await generateBriefForCompany(company.id, companyDebugId, {
            weekKey,
            createdBy: 'system',
          });

          if (briefResult.success) {
            if (briefResult.skipped) {
              await logBriefEvent('brief_skipped', company.id, companyDebugId, {
                source: 'monday_schedule',
                weekKey,
                reason: briefResult.programsCount === 0 ? 'no_active_programs' : 'already_exists',
              });
            } else {
              await logBriefEvent('brief_generated', company.id, companyDebugId, {
                source: 'monday_schedule',
                weekKey,
                briefId: briefResult.briefId,
                programsCount: briefResult.programsCount,
              });
            }
          } else {
            await logBriefEvent('job_failed', company.id, companyDebugId, {
              source: 'monday_schedule',
              weekKey,
              error: briefResult.error,
            });
          }

          return briefResult;
        }
      );

      if (result.success) {
        if (result.skipped) {
          briefsSkipped++;
        } else {
          briefsGenerated++;
        }
      } else {
        errors++;
      }
    }

    // ========================================================================
    // STEP 3: Summary
    // ========================================================================
    const summary = {
      debugId: jobDebugId,
      weekKey,
      companiesProcessed: eligibleCompanies.length,
      briefsGenerated,
      briefsSkipped,
      errors,
    };

    console.log('[WeeklyBrief:Monday] ============================================');
    console.log('[WeeklyBrief:Monday] MONDAY JOB COMPLETE');
    console.log(`[WeeklyBrief:Monday] Week: ${weekKey}`);
    console.log(`[WeeklyBrief:Monday] Companies processed: ${eligibleCompanies.length}`);
    console.log(`[WeeklyBrief:Monday] Briefs generated: ${briefsGenerated}`);
    console.log(`[WeeklyBrief:Monday] Briefs skipped: ${briefsSkipped}`);
    console.log(`[WeeklyBrief:Monday] Errors: ${errors}`);
    console.log('[WeeklyBrief:Monday] ============================================');

    return summary;
  }
);

// ============================================================================
// ON-DEMAND FUNCTION: Triggered by event
// ============================================================================

export const weeklyBriefOnDemand = inngest.createFunction(
  {
    id: 'os-weekly-brief-on-demand',
    name: 'Generate Weekly Brief (On-Demand)',
    retries: 2,
    concurrency: {
      limit: 1,
      key: 'event.data.companyId', // One at a time per company
    },
  },
  { event: 'os/weekly-brief.requested' },
  async ({ event, step }) => {
    const { companyId, requestedBy, debugId: eventDebugId, weekKey: requestedWeekKey } = event.data;
    const debugId = eventDebugId || generateDebugId();
    const weekKey = requestedWeekKey || getWeekKey();

    console.log(`[WeeklyBrief:OnDemand] Processing company ${companyId}... debugId=${debugId} weekKey=${weekKey}`);

    // ========================================================================
    // STEP 1: Log job started
    // ========================================================================
    await step.run('log-started', async () => {
      await logBriefEvent('job_started', companyId, debugId, {
        source: 'on_demand',
        weekKey,
        requestedBy,
      });
    });

    // ========================================================================
    // STEP 2: Generate brief (force regeneration for on-demand)
    // ========================================================================
    const result = await step.run('generate-brief', async () => {
      return generateBriefForCompany(companyId, debugId, {
        weekKey,
        createdBy: requestedBy || 'system',
        force: true, // Always regenerate for on-demand
      });
    });

    // ========================================================================
    // STEP 3: Log completion
    // ========================================================================
    await step.run('log-completed', async () => {
      if (result.success && result.briefId) {
        await logBriefEvent('brief_generated', companyId, debugId, {
          source: 'on_demand',
          weekKey,
          requestedBy,
          briefId: result.briefId,
          programsCount: result.programsCount,
        });
      } else if (result.skipped) {
        await logBriefEvent('brief_skipped', companyId, debugId, {
          source: 'on_demand',
          weekKey,
          requestedBy,
          reason: 'no_active_programs',
        });
      } else {
        await logBriefEvent('job_failed', companyId, debugId, {
          source: 'on_demand',
          weekKey,
          requestedBy,
          error: result.error,
        });
      }
    });

    // ========================================================================
    // STEP 4: Emit completion event
    // ========================================================================
    if (result.success && result.briefId) {
      await step.sendEvent('emit-generated', {
        name: 'os/weekly-brief.generated',
        data: {
          companyId,
          weekKey,
          briefId: result.briefId,
          debugId,
          createdBy: requestedBy || 'system',
          programsCount: result.programsCount,
        },
      });
    }

    console.log(
      `[WeeklyBrief:OnDemand] Complete. success=${result.success} briefId=${result.briefId || 'N/A'}`
    );

    return {
      debugId,
      companyId,
      weekKey: result.weekKey,
      success: result.success,
      briefId: result.briefId,
      skipped: result.skipped,
      error: result.error,
      programsCount: result.programsCount,
    };
  }
);
