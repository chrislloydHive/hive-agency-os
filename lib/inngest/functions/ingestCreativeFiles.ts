// lib/inngest/functions/ingestCreativeFiles.ts
// Scheduled cron: discover newly-uploaded files in Client Review variant folders
// (Prospecting/Retargeting × tactic) and create CRAS records for them.
// Does not scan Evergreen, Promotions, or _Production Assets — those copies
// were recreating CRAS rows after files were deleted from the review folders.
//
// Runs every 5 minutes. Idempotent — files that already have CRAS records are
// skipped both via an upfront dedupe query and via ensureCrasRecord's own
// (Review Token + Source Folder ID) uniqueness check.
//
// This function is a TRIGGER ONLY. All real ingestion logic lives in
// lib/review/ingestFileToCras.ts.

import { inngest } from '../client';
import { getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getDriveClient } from '@/lib/google/driveClient';
import { getProjectsByCreativeReviewHubFolderId } from '@/lib/airtable/projectFolderMap';
import { listFilesInReviewVariantFolders } from '@/lib/review/reviewFolders';
import {
  ingestFilesToCras,
  type IngestFileInput,
} from '@/lib/review/ingestFileToCras';
import { ensurePartnerDeliverySetup } from '@/lib/delivery/ensurePartnerDeliverySetup';

const CRON_SCHEDULE = '*/5 * * * *';

const MAX_FILES_PER_PROJECT = 1000;
const INGEST_BATCH_SIZE = 10;

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

/**
 * Fetch the set of Drive file IDs that already have a CRAS record for a given
 * Project. Used to skip files we've already ingested.
 */
async function getExistingCrasFileIdsForProject(
  projectId: string
): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const projectsBase = getProjectsBase();
    // Match the Project link via FIND() over the linked record IDs.
    const formula = `FIND("${projectId}", ARRAYJOIN({Project})) > 0`;
    const records = await projectsBase(CRAS_TABLE)
      .select({
        filterByFormula: formula,
        fields: [SOURCE_FOLDER_ID_FIELD],
      })
      .all();
    for (const r of records) {
      const fid = (r.fields as Record<string, unknown>)[SOURCE_FOLDER_ID_FIELD];
      if (typeof fid === 'string' && fid) set.add(fid);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ingest-cron] failed to load existing CRAS file IDs for project ${projectId}: ${msg}`
    );
  }
  return set;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const ingestCreativeFilesScheduled = inngest.createFunction(
  {
    id: 'ingest-creative-files-scheduled',
    name: 'Ingest Creative Files (CRH folders → CRAS)',
    retries: 1,
    concurrency: { limit: 1 },
  },
  { cron: CRON_SCHEDULE },
  async ({ step, event }) => {
    console.log(
      '[ingest-cron] tick',
      { cron: CRON_SCHEDULE, eventId: event.id }
    );

    // Drive client (service account / WIF — same pattern as other crons).
    // NOTE: must NOT be built inside step.run — Inngest JSON-serializes step
    // return values, which would strip the methods off the googleapis client
    // and cause "drive.files.list is not a function".
    const oidcToken = process.env.VERCEL_OIDC_TOKEN || undefined;
    const drive = await getDriveClient({ vercelOidcToken: oidcToken });
    console.log('[ingest-cron] drive client keys:', Object.keys(drive));
    if (typeof drive?.files?.list !== 'function') {
      throw new Error(
        '[ingest-cron] getDriveClient did not return a valid drive_v3.Drive (drive.files.list missing)'
      );
    }

    const projects = await step.run('load-projects', async () => {
      const map = await getProjectsByCreativeReviewHubFolderId();
      console.log(
        `[ingest-cron] loaded ${map.size} project(s) with Creative Review Hub Folder ID`
      );
      return Array.from(map.values());
    });

    let totalFilesFound = 0;
    let totalNewFiles = 0;
    let totalCreated = 0;
    let totalErrors = 0;

    // Each project is its own step so Inngest checkpoints between them.
    // If one project hangs/errors, the others still complete on retry.
    for (const project of projects) {
      const stepId = `scan-${project.projectId}`;
      try {
        const summary = await step.run(stepId, async () => {
          console.log('[ingest-cron] scanning project:', {
            projectName: project.projectName,
            projectId: project.projectId,
            crhFolderId: project.folderId,
          });

          let files: Awaited<ReturnType<typeof listFilesInReviewVariantFolders>>;
          try {
            files = await listFilesInReviewVariantFolders(drive, project.folderId);
            if (files.length > MAX_FILES_PER_PROJECT) {
              files = files.slice(0, MAX_FILES_PER_PROJECT);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(
              `[ingest-cron] traversal failed for project ${project.projectName}: ${msg}`
            );
            return { filesFound: 0, newFiles: 0, created: 0, errors: 1 };
          }

          console.log(`[ingest-cron] files found: ${files.length}`, {
            projectId: project.projectId,
          });

          if (files.length === 0) {
            return { filesFound: 0, newFiles: 0, created: 0, errors: 0 };
          }

          const existing = await getExistingCrasFileIdsForProject(project.projectId);
          const newFiles = files.filter((f) => {
            if (existing.has(f.id)) {
              console.log('[ingest-cron] skipped existing file:', { fileId: f.id });
              return false;
            }
            return true;
          });

          console.log(`[ingest-cron] new files: ${newFiles.length}`, {
            projectId: project.projectId,
          });

          if (newFiles.length === 0) {
            return { filesFound: files.length, newFiles: 0, created: 0, errors: 0 };
          }

          const payloads: IngestFileInput[] = newFiles.map((f) => ({
            fileId: f.id,
            fileName: f.name,
            folderId: f.folderId,
            parentFolderIds: [f.folderId],
            tactic: f.tactic,
            variant: f.variant,
          }));

          let created = 0;
          let errors = 0;
          for (const batch of chunk(payloads, INGEST_BATCH_SIZE)) {
            for (const p of batch) {
              console.log('[ingest-cron] sending file:', {
                fileId: p.fileId,
                fileName: p.fileName,
              });
            }
            try {
              const r = await ingestFilesToCras(batch, { drive });
              created += r.created;
              errors += r.errors;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('[ingest-cron] batch ingest failed:', msg);
              errors += batch.length;
            }
          }

          return { filesFound: files.length, newFiles: newFiles.length, created, errors };
        });

        totalFilesFound += summary.filesFound;
        totalNewFiles += summary.newFiles;
        totalCreated += summary.created;
        totalErrors += summary.errors;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[ingest-cron] step ${stepId} threw: ${msg}`
        );
        totalErrors++;
      }

      // Self-healing partner delivery provisioning. ensurePartnerDeliverySetup
      // in ingestFileToCras only runs when a CRAS row is newly created, so
      // projects whose CRAS records pre-date that hook never get provisioned.
      // ensurePartnerDeliverySetup is idempotent (existing-batch check), so
      // running it every tick is a no-op for already-provisioned projects and
      // backfills any that are missing.
      try {
        await step.run(`ensure-delivery-${project.projectId}`, async () => {
          return await ensurePartnerDeliverySetup({
            projectId: project.projectId,
            projectName: project.projectName,
          });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[ingest-cron] ensurePartnerDeliverySetup failed for ${project.projectName}: ${msg}`
        );
      }
    }

    const result = {
      projectsScanned: projects.length,
      filesFound: totalFilesFound,
      newFiles: totalNewFiles,
      crasCreated: totalCreated,
      errors: totalErrors,
    };
    console.log('[ingest-cron] done', result);
    return result;
  }
);
