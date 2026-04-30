#!/usr/bin/env npx tsx
// scripts/backfillMuxCli.ts
// Backfill Mux ingest for one or more existing review portals.
//
// For each portal token, walks the visible CRAS rows and triggers Mux upload
// for any row that doesn't already have a Mux identifier. The Mux webhook
// fills in playback ID / status / aspect ratio asynchronously — usually
// within ~30s of upload completion.
//
// Usage:
//   npx tsx scripts/backfillMuxCli.ts <token1> [<token2> ...]
//   npx tsx scripts/backfillMuxCli.ts <token1> --dry-run
//   npx tsx scripts/backfillMuxCli.ts <token1> --limit 1
//   REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxCli.ts
//
// Flags:
//   --dry-run    Plan only — no Mux uploads, no Airtable writes.
//   --limit N    Trigger at most N uploads per token (smoke-test escape hatch).
//
// Token is the value from the review URL: /review/<token>

import { config } from 'dotenv';
config({ path: '.env' });
config({ path: '.env.local' });

import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { backfillMux, type BackfillMuxResult } from '@/lib/review/backfillMux';

function parseArgs(argv: string[]): { tokens: string[]; dryRun: boolean; limit?: number } {
  const tokens: string[] = [];
  let dryRun = false;
  let limit: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--limit') {
      const next = argv[i + 1];
      const n = Number(next);
      if (!Number.isFinite(n) || n < 1) {
        console.error(`--limit requires a positive integer (got "${next}")`);
        process.exit(1);
      }
      limit = Math.floor(n);
      i += 1;
    } else if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length));
      if (!Number.isFinite(n) || n < 1) {
        console.error(`--limit requires a positive integer (got "${a}")`);
        process.exit(1);
      }
      limit = Math.floor(n);
    } else if (a.startsWith('--')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else {
      tokens.push(a);
    }
  }

  if (tokens.length === 0 && process.env.REVIEW_TOKEN) {
    tokens.push(process.env.REVIEW_TOKEN.trim());
  }

  return { tokens: tokens.map((t) => t.trim()).filter(Boolean), dryRun, limit };
}

function formatHeader(s: string): string {
  return `\n=== ${s} ===`;
}

function printResult(token: string, result: BackfillMuxResult, verbose: boolean) {
  const summary = {
    considered: result.considered,
    triggered: result.triggered,
    alreadyHasMux: result.alreadyHasMux,
    notVideo: result.notVideo,
    muxNotConfigured: result.muxNotConfigured,
    errors: result.errors.length,
  };
  console.log(`[${token.slice(0, 8)}...] result:`, summary);

  if (verbose) {
    for (const t of result.trace) {
      const tag = t.action.padEnd(22);
      const name = t.filename ?? t.driveFileId;
      const extra = t.detail ? ` — ${t.detail}` : '';
      console.log(`  ${tag} ${name}${extra}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`[${token.slice(0, 8)}...] errors:`);
    for (const e of result.errors) console.log(`  ! ${e}`);
  }
}

async function main() {
  const { tokens, dryRun, limit } = parseArgs(process.argv.slice(2));

  if (tokens.length === 0) {
    console.error('Usage: npx tsx scripts/backfillMuxCli.ts <token1> [<token2> ...] [--dry-run] [--limit N]');
    console.error('   or: REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxCli.ts [--dry-run] [--limit N]');
    process.exit(1);
  }

  console.log(`Backfilling Mux for ${tokens.length} portal(s).`);
  if (dryRun) console.log('Mode: DRY RUN — no Mux uploads, no Airtable writes.');
  if (limit != null) console.log(`Mode: per-portal limit = ${limit}`);

  const totals = {
    considered: 0,
    triggered: 0,
    alreadyHasMux: 0,
    notVideo: 0,
    muxNotConfigured: 0,
    errors: 0,
  };

  for (const token of tokens) {
    console.log(formatHeader(`portal ${token.slice(0, 8)}...`));

    console.log('Resolving project for token...');
    const resolved = await resolveReviewProject(token);
    if (!resolved) {
      console.error(`  Invalid or expired token. Skipping.`);
      totals.errors += 1;
      continue;
    }

    const { project, auth } = resolved;
    console.log(`Project: ${project.name} (${project.recordId})`);
    const drive = google.drive({ version: 'v3', auth });

    let result: BackfillMuxResult;
    try {
      result = await backfillMux({ drive, token, dryRun, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  backfillMux threw: ${msg}`);
      totals.errors += 1;
      continue;
    }

    // Verbose output is most useful in dry-run + smoke-test (--limit) modes.
    const verbose = dryRun || (limit != null && limit <= 5);
    printResult(token, result, verbose);

    totals.considered += result.considered;
    totals.triggered += result.triggered;
    totals.alreadyHasMux += result.alreadyHasMux;
    totals.notVideo += result.notVideo;
    totals.muxNotConfigured += result.muxNotConfigured;
    totals.errors += result.errors.length;
  }

  console.log(formatHeader('totals'));
  console.log(totals);

  if (!dryRun && totals.triggered > 0) {
    console.log('\nUploads kicked off. Mux webhooks will populate Mux Playback ID / Status');
    console.log('over the next ~30s–few minutes per asset. Tail the deploy logs or check');
    console.log('the CRAS table to confirm Mux Status flips to "ready".');
  }

  process.exit(totals.errors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
