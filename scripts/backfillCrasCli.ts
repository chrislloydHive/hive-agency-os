#!/usr/bin/env npx tsx
// scripts/backfillCrasCli.ts
// Run CRAS backfill for a review portal token (creates missing Creative Review Asset Status records).
//
// Usage:
//   npx tsx scripts/backfillCrasCli.ts <review-token>
//   npx tsx scripts/backfillCrasCli.ts <review-token> --dry-run
//   REVIEW_TOKEN=xxx npx tsx scripts/backfillCrasCli.ts
//
// Token is the value from the review URL: /review/<token>

import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local' });

import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  getReviewFolderMapFromJobFolderPartial,
  getReviewFolderMapFromClientProjectsFolder,
} from '@/lib/review/reviewFolders';
import { backfillCras } from '@/lib/review/backfillCras';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tokenArg = args.find((a) => a !== '--dry-run');
  const token = (tokenArg ?? process.env.REVIEW_TOKEN ?? '').toString().trim();

  if (!token) {
    console.error('Usage: npx tsx scripts/backfillCrasCli.ts <review-token> [--dry-run]');
    console.error('   or: REVIEW_TOKEN=xxx npx tsx scripts/backfillCrasCli.ts [--dry-run]');
    process.exit(1);
  }

  console.log('Resolving project for token...');
  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    console.error('Invalid or expired token.');
    process.exit(1);
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  console.log('Loading review folder map...');
  const folderResult = project.jobFolderId
    ? await getReviewFolderMapFromJobFolderPartial(drive, project.jobFolderId)
    : await (async () => {
        const clientProjectsFolderId =
          process.env.CAR_TOYS_PROJECTS_FOLDER_ID ?? '1NLCt-piSxfAFeeINuFyzb3Pxp-kKXTw_';
        if (clientProjectsFolderId) {
          const fromClient = await getReviewFolderMapFromClientProjectsFolder(
            drive,
            project.name,
            clientProjectsFolderId
          );
          if (fromClient) return fromClient;
        }
        return null;
      })();

  if (!folderResult) {
    console.error('Review folders not found. Run scaffold or set job folder.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('Dry run: no records will be created.');
  }

  const result = await backfillCras({
    drive,
    folderMap: folderResult.map,
    token,
    projectId: project.recordId,
    dryRun,
  });

  console.log('Result:', { created: result.created, skipped: result.skipped, errors: result.errors.length });
  if (result.errors.length > 0) {
    result.errors.forEach((e) => console.error('  ', e));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
