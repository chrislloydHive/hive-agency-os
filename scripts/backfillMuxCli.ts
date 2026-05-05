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
//   npx tsx scripts/backfillMuxCli.ts --project Evergreen --dry-run
//   npx tsx scripts/backfillMuxCli.ts --project Evergreen --project "Birthday Bash"
//   npx tsx scripts/backfillMuxCli.ts <token1> [<token2> ...]
//   REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxCli.ts
//
// Flags:
//   --project N  Match a Project by canonical-name fragment (case-insensitive). Repeatable.
//                Looks up Client Review Portal Token in Airtable so you don't have to paste it.
//   --dry-run    Plan only — no Mux uploads, no Airtable writes.
//   --limit N    Trigger at most N uploads per token (smoke-test escape hatch).
//
// Token (when passed positionally) is the value from the review URL: /review/<token>

// IMPORTANT: this side-effect import must come FIRST. ES modules evaluate
// imports depth-first in source order, so loading dotenv here guarantees
// process.env is populated before @/lib/airtable/bases.ts captures
// AIRTABLE_PROJECTS_BASE_ID at module load.
import './_loadDotenv';

import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { backfillMux, type BackfillMuxResult } from '@/lib/review/backfillMux';
import { getProjectsBase } from '@/lib/airtable';

/**
 * Quick credential ping — fail fast with a clear message if the Airtable PAT is
 * missing/wrong/revoked, so we don't surface that as a misleading
 * "Invalid or expired token" against the user's review token.
 */
async function pingAirtableCredentials(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.AIRTABLE_API_KEY) {
    return { ok: false, error: 'AIRTABLE_API_KEY is not set in the environment.' };
  }
  try {
    const base = getProjectsBase();
    // Smallest possible read against the Projects table to validate the PAT + base ID.
    await base('Projects').select({ maxRecords: 1, fields: [] }).firstPage();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

interface ParsedArgs {
  tokens: string[];
  projectNames: string[];
  dryRun: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const tokens: string[] = [];
  const projectNames: string[] = [];
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
    } else if (a === '--project') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        console.error(`--project requires a project-name fragment (e.g. --project Evergreen)`);
        process.exit(1);
      }
      projectNames.push(next);
      i += 1;
    } else if (a.startsWith('--project=')) {
      projectNames.push(a.slice('--project='.length));
    } else if (a.startsWith('--')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else {
      tokens.push(a);
    }
  }

  if (tokens.length === 0 && projectNames.length === 0 && process.env.REVIEW_TOKEN) {
    tokens.push(process.env.REVIEW_TOKEN.trim());
  }

  return {
    tokens: tokens.map((t) => t.trim()).filter(Boolean),
    projectNames: projectNames.map((n) => n.trim()).filter(Boolean),
    dryRun,
    limit,
  };
}

/**
 * Look up review-portal tokens from project-name fragments.
 *
 * Returns one entry per match. Skips ambiguous queries (>1 match) with a warning
 * — caller should rerun with a more specific fragment. Tokens never go to
 * stderr/stdout in full; only the first 8 chars are surfaced for traceability.
 */
async function resolveTokensFromProjectNames(
  names: string[],
): Promise<Array<{ projectName: string; token: string }>> {
  if (names.length === 0) return [];

  const NAME_FIELD = 'Project Name (Job #)';
  const TOKEN_FIELD = 'Client Review Portal Token';

  const base = getProjectsBase();
  const records = await base('Projects')
    .select({ fields: [NAME_FIELD, TOKEN_FIELD] })
    .all();

  const matches: Array<{ projectName: string; token: string }> = [];

  for (const query of names) {
    const q = query.toLowerCase();
    const found = records.filter((r) => {
      const name = String((r.fields as Record<string, unknown>)[NAME_FIELD] ?? '').toLowerCase();
      return name.includes(q);
    });

    if (found.length === 0) {
      console.warn(`  --project "${query}": no project matched. Skipping.`);
      continue;
    }
    if (found.length > 1) {
      console.warn(`  --project "${query}": matched ${found.length} projects (ambiguous):`);
      for (const r of found) {
        console.warn(`    - ${(r.fields as Record<string, unknown>)[NAME_FIELD]}`);
      }
      console.warn(`    Use a more specific fragment to disambiguate. Skipping.`);
      continue;
    }
    const fields = found[0].fields as Record<string, unknown>;
    const projectName = String(fields[NAME_FIELD] ?? '');
    const token = String(fields[TOKEN_FIELD] ?? '').trim();
    if (!token) {
      console.warn(`  --project "${query}" → "${projectName}": no Client Review Portal Token on record. Skipping.`);
      continue;
    }
    matches.push({ projectName, token });
    console.log(`  --project "${query}" → "${projectName}" (token ${token.slice(0, 8)}...)`);
  }
  return matches;
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
  const { tokens: positionalTokens, projectNames, dryRun, limit } = parseArgs(process.argv.slice(2));

  if (positionalTokens.length === 0 && projectNames.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/backfillMuxCli.ts --project <name> [--project <name>...] [--dry-run] [--limit N]');
    console.error('  npx tsx scripts/backfillMuxCli.ts <token1> [<token2> ...] [--dry-run] [--limit N]');
    console.error('  REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxCli.ts [--dry-run] [--limit N]');
    process.exit(1);
  }

  if (dryRun) console.log('Mode: DRY RUN — no Mux uploads, no Airtable writes.');
  if (limit != null) console.log(`Mode: per-portal limit = ${limit}`);

  // Pre-flight: validate Airtable credentials before doing anything else, so
  // the first failure mode the user sees is the real one — not a misleading
  // "Invalid or expired token" line for every portal.
  console.log('Pinging Airtable credentials...');
  const ping = await pingAirtableCredentials();
  if (!ping.ok) {
    console.error('Airtable credential check failed:');
    console.error(`  ${ping.error}`);
    console.error('\nLikely causes:');
    console.error('  • AIRTABLE_API_KEY is missing or stale in .env.local');
    console.error('  • A different AIRTABLE_API_KEY is exported in your shell and overriding .env.local (try: unset AIRTABLE_API_KEY)');
    console.error('  • The PAT lacks read access to the Projects base (AIRTABLE_PROJECTS_BASE_ID or AIRTABLE_BASE_ID)');
    process.exit(1);
  }
  console.log('  ok');

  // Resolve --project name fragments to tokens (after the credential check so
  // any auth error surfaces from the ping, not from this lookup).
  let resolvedFromProjects: Array<{ projectName: string; token: string }> = [];
  if (projectNames.length > 0) {
    console.log(`\nResolving ${projectNames.length} project name(s) to portal tokens...`);
    resolvedFromProjects = await resolveTokensFromProjectNames(projectNames);
  }

  // Combine: positional tokens (treated as opaque) + tokens resolved from --project.
  const tokens: string[] = [
    ...positionalTokens,
    ...resolvedFromProjects.map((r) => r.token),
  ];

  if (tokens.length === 0) {
    console.error('\nNo portal tokens to process. Check --project arguments above.');
    process.exit(1);
  }

  console.log(`\nBackfilling Mux for ${tokens.length} portal(s).`);

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
      // Credentials were just verified, so a null here means either the token
      // doesn't match any Projects row OR the row is missing required fields.
      // The underlying resolver logs the specific reason to stderr above this line.
      console.error(`  Could not resolve portal for this token. See [review/resolveProject] log above for the underlying cause. Skipping.`);
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
