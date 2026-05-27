// lib/inngest/functions/production-folder-mirror-scheduled.ts
// Daily sweep: mirror internal production folders → partner production folders.

import { inngest } from '../client';
import { listProjectsForProductionMirror } from '@/lib/airtable/projectProductionFolders';
import { runProductionFolderMirror } from '@/lib/delivery/runProductionFolderMirror';

const CRON_SCHEDULE = process.env.PRODUCTION_FOLDER_MIRROR_CRON?.trim() || '0 7 * * *';

export const productionFolderMirrorScheduled = inngest.createFunction(
  {
    id: 'production-folder-mirror-scheduled',
    name: 'Production Folder Mirror (Daily)',
    retries: 1,
  },
  { cron: CRON_SCHEDULE },
  async () => {
    const projects = await listProjectsForProductionMirror({ activeOnly: true });
    console.log(`[production-mirror/cron] projects=${projects.length}`);

    const summary = {
      projects: projects.length,
      ok: 0,
      partial: 0,
      failed: 0,
      skipped: 0,
    };

    for (const folders of projects) {
      const result = await runProductionFolderMirror(folders, {
        oidcToken: process.env.VERCEL_OIDC_TOKEN ?? null,
        requestId: `cron-${folders.projectId.slice(-8)}`,
      });
      if (result.skipped) summary.skipped++;
      else if (result.ok) summary.ok++;
      else if (result.mirror?.copied.length) summary.partial++;
      else summary.failed++;
    }

    console.log('[production-mirror/cron] summary', summary);
    return summary;
  },
);
