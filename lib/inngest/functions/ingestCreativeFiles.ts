// lib/inngest/functions/ingestCreativeFiles.ts
// Scheduled cron: discover newly-uploaded files in Client Review variant folders
// (Prospecting/Retargeting × tactic) and create CRAS records for them.
// Does not scan Evergreen, Promotions, or _Production Assets — those copies
// were recreating CRAS rows after files were deleted from the review folders.
//
// Runs every 5 minutes. Idempotent — files whose CRAS already has Mux (or that
// are not videos) are skipped. Files that only have a portal-created CRAS row
// still go through ingestFileToCras so Mux can start. ensureCrasRecord also
// dedupes on (Review Token + Source Folder ID).
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
import {
  driveFileIdFromCrasSourceField,
  existingCrasEntryFromFields,
  selectIngestCronFiles,
  type ExistingCrasIndexEntry,
} from '@/lib/review/ingestCronSelection';
import { CRAS_MUX_IDENTIFIER_FIELD_NAMES } from '@/lib/mux/crasMuxFields';

const CRON_SCHEDULE = '*/5 * * * *';

const MAX_FILES_PER_PROJECT = 1000;
const INGEST_BATCH_SIZE = 10;

const CRAS_TABLE = AIRTABLE_TABLES.CREATIVE_REVIEW_ASSET_STATUS;
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

/**
 * CRAS index for a project: Drive file id → mux/filename so the cron can skip
 * fully ingested rows but still Mux-backfill portal-created video CRAS.
 */
async function getExistingCrasIndexForProject(
  projectId: string
): Promise<Map<string, ExistingCrasIndexEntry>> {
  const map = new Map<string, ExistingCrasIndexEntry>();
  try {
    const projectsBase = getProjectsBase();
    const formula = `FIND("${projectId}", ARRAYJOIN({Project})) > 0`;
    const records = await projectsBase(CRAS_TABLE)
      .select({
        filterByFormula: formula,
        fields: [SOURCE_FOLDER_ID_FIELD, 'Filename', ...CRAS_MUX_IDENTIFIER_FIELD_NAMES],
      })
      .all();
    for (const r of records) {
      const fields = r.fields as Record<string, unknown>;
      const fid = driveFileIdFromCrasSourceField(fields[SOURCE_FOLDER_ID_FIELD]);
      if (!fid) continue;
      map.set(fid, existingCrasEntryFromFields(fields));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ingest-cron] failed to load existing CRAS index for project ${projectId}: ${msg}`
    );
  }
  return map;
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

          const existing = await getExistingCrasIndexForProject(project.projectId);
          const selected = selectIngestCronFiles(files, existing);
          console.log(`[ingest-cron] selected files`, {
            projectId: project.projectId,
            filesFound: files.length,
            newFiles: selected.newCount,
            muxBackfill: selected.muxBackfillCount,
            skipped: selected.skipped,
          });

          if (selected.toProcess.length === 0) {
            return { filesFound: files.length, newFiles: 0, created: 0, errors: 0 };
          }

          const payloads: IngestFileInput[] = selected.toProcess.map((f) => ({
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

          return { filesFound: files.length, newFiles: selected.toProcess.length, created, errors };
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
