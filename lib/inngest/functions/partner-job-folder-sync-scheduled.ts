// lib/inngest/functions/partner-job-folder-sync-scheduled.ts
// Daily sweep: keep every Brkthru job folder structurally identical to its primary job folder
// (folders + shortcuts to Creative Review / SOCIAL-COPY docs; empty duplicates trashed).
// Repairs drift even when no delivery happens.

import { inngest } from '../client';
import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { syncPartnerJobFolderForProject } from '@/lib/delivery/syncPartnerJobFolder';

const CRON_SCHEDULE = process.env.PARTNER_JOB_FOLDER_SYNC_CRON?.trim() || '30 7 * * *';
const LINK_FIELD = process.env.PRIMARY_JOB_FOLDER_FIELD?.trim() || 'Drive Project Folder Link';

export const partnerJobFolderSyncScheduled = inngest.createFunction(
  {
    id: 'partner-job-folder-sync-scheduled',
    name: 'Partner Job Folder Sync (Daily)',
    retries: 1,
  },
  { cron: CRON_SCHEDULE },
  async () => {
    const records = await getProjectsBase()(AIRTABLE_TABLES.PROJECTS)
      .select({ filterByFormula: `NOT({${LINK_FIELD}} = BLANK())`, fields: [LINK_FIELD] })
      .all();

    const summary = { projects: records.length, synced: 0, skipped: 0, failed: 0, needsReview: 0 };
    for (const r of records) {
      const res = await syncPartnerJobFolderForProject(r.id, { oidcToken: process.env.VERCEL_OIDC_TOKEN ?? null });
      if (res.skipped) summary.skipped++;
      else if (res.ok) summary.synced++;
      else summary.failed++;
      if (res.sync && (res.sync.duplicatesNeedingReview.length || res.sync.docCopiesNeedingReview.length)) {
        summary.needsReview++;
        console.warn('[partner-job-folder-sync/cron] needs review', {
          projectName: res.projectName,
          duplicatesNeedingReview: res.sync.duplicatesNeedingReview,
          docCopiesNeedingReview: res.sync.docCopiesNeedingReview,
        });
      }
    }
    console.log('[partner-job-folder-sync/cron] summary', summary);
    return summary;
  },
);
