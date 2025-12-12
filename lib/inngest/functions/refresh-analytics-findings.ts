// lib/inngest/functions/refresh-analytics-findings.ts
// Scheduled job to refresh analytics-derived findings for media clients
//
// This runs nightly (default 6am UTC) to:
// 1. Find all companies with active media programs
// 2. Refresh analytics-derived findings for each using AI
// 3. Log results for monitoring

import { inngest } from '../client';
import { getAllCompanies, type CompanyRecord } from '@/lib/airtable/companies';
import { companyHasMediaProgram } from '@/lib/companies/media';
import { getCompanyAnalyticsSnapshot } from '@/lib/os/companies/companyAnalytics';
import { getCompanyStatusSummary } from '@/lib/os/companies/companyStatus';
import { generateAnalyticsFindings } from '@/lib/os/contextAi/generateAnalyticsFindings';
import { writeAnalyticsFindingsToBrain } from '@/lib/os/contextAi/writeAnalyticsFindingsToBrain';

// ============================================================================
// TYPES
// ============================================================================

type RefreshResult = {
  companyId: string;
  companyName: string;
  success: boolean;
  findingsCreated: number;
  error?: string;
};

// ============================================================================
// MAIN SCHEDULED FUNCTION
// ============================================================================

export const refreshAnalyticsFindingsScheduled = inngest.createFunction(
  {
    id: 'refresh-analytics-findings-scheduled',
    name: 'Refresh Analytics Findings (Scheduled)',
    retries: 1,
    concurrency: {
      limit: 1, // Only run one instance at a time
    },
  },
  // Run daily at 6am UTC
  { cron: '0 6 * * *' },
  async ({ step }) => {
    console.log('[RefreshAnalyticsFindings:Scheduled] Starting scheduled refresh...');

    // ========================================================================
    // STEP 1: Fetch media program companies
    // ========================================================================
    const mediaCompanies = await step.run('fetch-media-companies', async () => {
      console.log('[RefreshAnalyticsFindings:Scheduled] Fetching companies with media programs...');

      const allCompanies = await getAllCompanies();
      const filtered = allCompanies.filter((company) => companyHasMediaProgram(company));

      console.log(
        `[RefreshAnalyticsFindings:Scheduled] Found ${filtered.length} companies with active media programs`
      );

      // Return just the IDs and names to keep step data small
      return filtered.map((c) => ({
        id: c.id,
        name: c.name,
      }));
    });

    if (mediaCompanies.length === 0) {
      console.log('[RefreshAnalyticsFindings:Scheduled] No media program companies found. Done.');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
    }

    // ========================================================================
    // STEP 2: Process each company (sequential to avoid API rate limits)
    // ========================================================================
    const results: RefreshResult[] = [];

    for (const company of mediaCompanies) {
      const result = await step.run(`refresh-${company.id}`, async () => {
        console.log(`[RefreshAnalyticsFindings:Scheduled] Processing ${company.name} (${company.id})...`);

        try {
          // Load analytics and status
          const [analytics, status] = await Promise.all([
            getCompanyAnalyticsSnapshot({ companyId: company.id, range: '28d' }),
            getCompanyStatusSummary({ companyId: company.id }),
          ]);

          // Skip if no analytics configured
          if (!analytics.hasAnalytics) {
            console.log(
              `[RefreshAnalyticsFindings:Scheduled] ${company.name}: No analytics configured, skipping`
            );
            return {
              companyId: company.id,
              companyName: company.name,
              success: true,
              findingsCreated: 0,
              error: 'No analytics configured',
            };
          }

          // Generate AI findings
          const aiFindings = await generateAnalyticsFindings({ analytics, status });

          if (!aiFindings.length) {
            console.log(
              `[RefreshAnalyticsFindings:Scheduled] ${company.name}: No significant findings detected`
            );
            return {
              companyId: company.id,
              companyName: company.name,
              success: true,
              findingsCreated: 0,
            };
          }

          // Write findings to Brain
          const writeResult = await writeAnalyticsFindingsToBrain({
            companyId: company.id,
            findings: aiFindings,
            replaceExisting: true,
          });

          if (!writeResult.success) {
            console.error(
              `[RefreshAnalyticsFindings:Scheduled] ${company.name}: Failed to write findings:`,
              writeResult.error
            );
            return {
              companyId: company.id,
              companyName: company.name,
              success: false,
              findingsCreated: 0,
              error: writeResult.error,
            };
          }

          console.log(
            `[RefreshAnalyticsFindings:Scheduled] ${company.name}: Created ${writeResult.createdCount} findings`
          );

          return {
            companyId: company.id,
            companyName: company.name,
            success: true,
            findingsCreated: writeResult.createdCount,
          };
        } catch (error) {
          console.error(
            `[RefreshAnalyticsFindings:Scheduled] ${company.name}: Error:`,
            error
          );
          return {
            companyId: company.id,
            companyName: company.name,
            success: false,
            findingsCreated: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      results.push(result);
    }

    // ========================================================================
    // STEP 3: Summary
    // ========================================================================
    const summary = {
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalFindingsCreated: results.reduce((sum, r) => sum + r.findingsCreated, 0),
      results,
    };

    console.log('[RefreshAnalyticsFindings:Scheduled] ============================================');
    console.log('[RefreshAnalyticsFindings:Scheduled] SCHEDULED REFRESH COMPLETE');
    console.log(`[RefreshAnalyticsFindings:Scheduled] Processed: ${summary.processed}`);
    console.log(`[RefreshAnalyticsFindings:Scheduled] Succeeded: ${summary.succeeded}`);
    console.log(`[RefreshAnalyticsFindings:Scheduled] Failed: ${summary.failed}`);
    console.log(`[RefreshAnalyticsFindings:Scheduled] Total findings created: ${summary.totalFindingsCreated}`);
    console.log('[RefreshAnalyticsFindings:Scheduled] ============================================');

    return summary;
  }
);

// ============================================================================
// MANUAL TRIGGER FUNCTION (for testing or on-demand refresh)
// ============================================================================

export const refreshAnalyticsFindingsManual = inngest.createFunction(
  {
    id: 'refresh-analytics-findings-manual',
    name: 'Refresh Analytics Findings (Manual)',
    retries: 1,
  },
  { event: 'analytics.findings.refresh' },
  async ({ event, step }) => {
    const { companyIds } = event.data as { companyIds?: string[] };

    console.log('[RefreshAnalyticsFindings:Manual] Starting manual refresh...');

    // ========================================================================
    // STEP 1: Determine which companies to process
    // ========================================================================
    const targetCompanies = await step.run('determine-targets', async () => {
      if (companyIds && companyIds.length > 0) {
        // Process specific companies
        console.log(`[RefreshAnalyticsFindings:Manual] Processing ${companyIds.length} specified companies`);
        return companyIds.map((id) => ({ id, name: `Company ${id}` }));
      }

      // Process all media program companies
      const allCompanies = await getAllCompanies();
      const filtered = allCompanies.filter((company) => companyHasMediaProgram(company));
      console.log(`[RefreshAnalyticsFindings:Manual] Processing ${filtered.length} media program companies`);
      return filtered.map((c) => ({ id: c.id, name: c.name }));
    });

    if (targetCompanies.length === 0) {
      console.log('[RefreshAnalyticsFindings:Manual] No companies to process. Done.');
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
    }

    // ========================================================================
    // STEP 2: Process each company
    // ========================================================================
    const results: RefreshResult[] = [];

    for (const company of targetCompanies) {
      const result = await step.run(`refresh-${company.id}`, async () => {
        console.log(`[RefreshAnalyticsFindings:Manual] Processing ${company.name} (${company.id})...`);

        try {
          const [analytics, status] = await Promise.all([
            getCompanyAnalyticsSnapshot({ companyId: company.id, range: '28d' }),
            getCompanyStatusSummary({ companyId: company.id }),
          ]);

          if (!analytics.hasAnalytics) {
            return {
              companyId: company.id,
              companyName: company.name,
              success: true,
              findingsCreated: 0,
              error: 'No analytics configured',
            };
          }

          const aiFindings = await generateAnalyticsFindings({ analytics, status });

          if (!aiFindings.length) {
            return {
              companyId: company.id,
              companyName: company.name,
              success: true,
              findingsCreated: 0,
            };
          }

          const writeResult = await writeAnalyticsFindingsToBrain({
            companyId: company.id,
            findings: aiFindings,
            replaceExisting: true,
          });

          return {
            companyId: company.id,
            companyName: company.name,
            success: writeResult.success,
            findingsCreated: writeResult.createdCount,
            error: writeResult.error,
          };
        } catch (error) {
          return {
            companyId: company.id,
            companyName: company.name,
            success: false,
            findingsCreated: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      results.push(result);
    }

    // Summary
    return {
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalFindingsCreated: results.reduce((sum, r) => sum + r.findingsCreated, 0),
      results,
    };
  }
);
