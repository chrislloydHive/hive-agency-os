#!/usr/bin/env npx tsx
// scripts/backfillMuxThumbnailWarmCli.ts
// Warm Mux thumbnail CDN cache for existing ready assets on one or more review portals.
//
// For each portal token, walks visible CRAS rows with muxStatus=ready and fires a GET
// to the primary grid poster URL (640×360 smartcrop @ 1.5s) so clients never hit cold
// thumbnails on first portal open.
//
// Usage:
//   npx tsx scripts/backfillMuxThumbnailWarmCli.ts --project Evergreen --dry-run
//   npx tsx scripts/backfillMuxThumbnailWarmCli.ts --project Evergreen --project "Birthday Bash"
//   npx tsx scripts/backfillMuxThumbnailWarmCli.ts <token1> [<token2> ...]
//   REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxThumbnailWarmCli.ts
//
// Flags:
//   --project N  Match a Project by canonical-name fragment (case-insensitive). Repeatable.
//   --dry-run    Plan only — no HTTP requests.
//   --limit N    Warm at most N assets per token (smoke-test escape hatch).

import './_loadDotenv';

import { resolveReviewProject } from '@/lib/review/resolveProject';
import {
  backfillMuxThumbnailWarm,
  type BackfillMuxThumbnailWarmResult,
} from '@/lib/review/backfillMuxThumbnailWarm';
import { getProjectsBase } from '@/lib/airtable';

async function pingAirtableCredentials(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.AIRTABLE_API_KEY) {
    return { ok: false, error: 'AIRTABLE_API_KEY is not set in the environment.' };
  }
  try {
    const base = getProjectsBase();
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

function printResult(token: string, result: BackfillMuxThumbnailWarmResult, verbose: boolean) {
  const summary = {
    considered: result.considered,
    warmed: result.warmed,
    skipped: result.skipped,
    errors: result.errors.length,
  };
  console.log(`[${token.slice(0, 8)}...] result:`, summary);

  if (verbose) {
    for (const t of result.trace) {
      const tag = t.action.padEnd(18);
      const name = t.filename ?? t.crasRecordId;
      console.log(`  ${tag} ${name} (${t.playbackId.slice(0, 8)}...)`);
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
    console.error('  npx tsx scripts/backfillMuxThumbnailWarmCli.ts --project <name> [--project <name>...] [--dry-run] [--limit N]');
    console.error('  npx tsx scripts/backfillMuxThumbnailWarmCli.ts <token1> [<token2> ...] [--dry-run] [--limit N]');
    console.error('  REVIEW_TOKEN=xxx npx tsx scripts/backfillMuxThumbnailWarmCli.ts [--dry-run] [--limit N]');
    process.exit(1);
  }

  if (dryRun) console.log('Mode: DRY RUN — no HTTP requests.');
  if (limit != null) console.log(`Mode: per-portal limit = ${limit}`);

  console.log('Pinging Airtable credentials...');
  const ping = await pingAirtableCredentials();
  if (!ping.ok) {
    console.error('Airtable credential check failed:');
    console.error(`  ${ping.error}`);
    process.exit(1);
  }
  console.log('  ok');

  let resolvedFromProjects: Array<{ projectName: string; token: string }> = [];
  if (projectNames.length > 0) {
    console.log(`\nResolving ${projectNames.length} project name(s) to portal tokens...`);
    resolvedFromProjects = await resolveTokensFromProjectNames(projectNames);
  }

  const tokens: string[] = [
    ...positionalTokens,
    ...resolvedFromProjects.map((r) => r.token),
  ];

  if (tokens.length === 0) {
    console.error('\nNo portal tokens to process. Check --project arguments above.');
    process.exit(1);
  }

  console.log(`\nWarming Mux thumbnails for ${tokens.length} portal(s).`);

  const totals = {
    considered: 0,
    warmed: 0,
    skipped: 0,
    errors: 0,
  };

  for (const token of tokens) {
    console.log(formatHeader(`portal ${token.slice(0, 8)}...`));

    console.log('Resolving project for token...');
    const resolved = await resolveReviewProject(token);
    if (!resolved) {
      console.error(`  Could not resolve portal for this token. Skipping.`);
      totals.errors += 1;
      continue;
    }

    const { project } = resolved;
    console.log(`Project: ${project.name} (${project.recordId})`);

    let result: BackfillMuxThumbnailWarmResult;
    try {
      result = await backfillMuxThumbnailWarm({ token, dryRun, limit });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  backfillMuxThumbnailWarm threw: ${msg}`);
      totals.errors += 1;
      continue;
    }

    const verbose = dryRun || (limit != null && limit <= 5);
    printResult(token, result, verbose);

    totals.considered += result.considered;
    totals.warmed += result.warmed;
    totals.skipped += result.skipped;
    totals.errors += result.errors.length;
  }

  console.log(formatHeader('totals'));
  console.log(totals);

  if (!dryRun && totals.warmed > 0) {
    console.log('\nThumbnail warm requests fired. Mux CDN should cache frames within a few seconds per asset.');
  }

  process.exit(totals.errors > 0 ? 2 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
