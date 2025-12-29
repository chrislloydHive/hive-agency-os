#!/usr/bin/env npx tsx
// scripts/verifyWebsiteLabContextFlow.ts
// Verification script for Labs→Context fix
//
// This script verifies the end-to-end flow for WebsiteLab:
// 1. Checks DIAGNOSTIC_RUNS table for websiteLab runs
// 2. Validates rawJson structure (rawEvidence.labResultV4.siteAssessment)
// 3. Triggers hydration if requested
// 4. Reports context completeness before/after
//
// Usage:
//   npx tsx scripts/verifyWebsiteLabContextFlow.ts <companyId>
//   npx tsx scripts/verifyWebsiteLabContextFlow.ts <companyId> --hydrate
//
// Debug mode (shows extraction paths):
//   DEBUG_CONTEXT_HYDRATION=1 npx tsx scripts/verifyWebsiteLabContextFlow.ts <companyId>

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getCompanyById } from '../lib/airtable/companies';
import { listDiagnosticRunsForCompany, type DiagnosticRun } from '../lib/os/diagnostics/runs';
import { getHeavyGapRunsByCompanyId } from '../lib/airtable/gapHeavyRuns';
import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { websiteLabImporter } from '../lib/contextGraph/importers/websiteLabImporter';
import { createEmptyContextGraph } from '../lib/contextGraph/companyContextGraph';

// Colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function success(msg: string) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function error(msg: string) { console.log(`${RED}✗${RESET} ${msg}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }
function info(msg: string) { console.log(`${CYAN}→${RESET} ${msg}`); }
function header(msg: string) { console.log(`\n${BOLD}${msg}${RESET}`); }

/**
 * Count fields with values in context graph
 */
function countContextFields(graph: any): { total: number; withValues: number } {
  let total = 0;
  let withValues = 0;

  const domainNames = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive'
  ];

  for (const domainName of domainNames) {
    const domainData = graph[domainName];
    if (domainData && typeof domainData === 'object') {
      for (const [fieldName, fieldData] of Object.entries(domainData)) {
        if (fieldName === '_meta') continue;
        total++;
        if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && (fieldData as any).value) {
          withValues++;
        }
      }
    }
  }

  return { total, withValues };
}

/**
 * Validate WebsiteLab rawJson structure
 */
function validateRawJsonStructure(rawJson: unknown): {
  valid: boolean;
  extractionPath: 'rawEvidence.labResultV4' | 'legacy' | 'none';
  hasSiteAssessment: boolean;
  hasSiteGraph: boolean;
  keys: string[];
} {
  if (!rawJson || typeof rawJson !== 'object') {
    return { valid: false, extractionPath: 'none', hasSiteAssessment: false, hasSiteGraph: false, keys: [] };
  }

  const data = rawJson as Record<string, unknown>;
  const keys = Object.keys(data);

  // Try new format: rawEvidence.labResultV4
  const rawEvidence = data.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    const labResult = rawEvidence.labResultV4 as Record<string, unknown>;
    return {
      valid: true,
      extractionPath: 'rawEvidence.labResultV4',
      hasSiteAssessment: !!labResult.siteAssessment,
      hasSiteGraph: !!labResult.siteGraph,
      keys,
    };
  }

  // Try legacy format: direct or wrapped in result
  const legacyData = (data.result || data) as Record<string, unknown>;
  const hasSiteAssessment = !!legacyData.siteAssessment;
  const hasSiteGraph = !!legacyData.siteGraph;

  if (hasSiteAssessment || hasSiteGraph) {
    return {
      valid: true,
      extractionPath: 'legacy',
      hasSiteAssessment,
      hasSiteGraph,
      keys,
    };
  }

  return { valid: false, extractionPath: 'none', hasSiteAssessment: false, hasSiteGraph: false, keys };
}

async function main() {
  const companyId = process.argv[2];
  const shouldHydrate = process.argv.includes('--hydrate');

  if (!companyId) {
    console.error('Usage: npx tsx scripts/verifyWebsiteLabContextFlow.ts <companyId> [--hydrate]');
    process.exit(1);
  }

  header('=== WEBSITELAB → CONTEXT FLOW VERIFICATION ===');
  console.log('Company ID:', companyId);
  console.log('Hydrate:', shouldHydrate ? 'YES' : 'NO (use --hydrate to trigger)');

  // 1. Get company info
  header('1. COMPANY INFO');
  const company = await getCompanyById(companyId);
  if (!company) {
    error('Company not found!');
    process.exit(1);
  }
  success(`Company: ${company.name}`);
  info(`Website: ${company.website || '(none)'}`);

  // 2. Check DIAGNOSTIC_RUNS table (primary source)
  header('2. DIAGNOSTIC_RUNS TABLE (PRIMARY SOURCE)');
  const diagnosticRuns = await listDiagnosticRunsForCompany(companyId, {
    toolId: 'websiteLab',
    limit: 5,
  });

  if (diagnosticRuns.length === 0) {
    warn('No WebsiteLab runs found in DIAGNOSTIC_RUNS table');
  } else {
    success(`Found ${diagnosticRuns.length} WebsiteLab run(s)`);

    // Check the latest run
    const latestRun = diagnosticRuns.find(r => r.status === 'complete' && r.rawJson);
    if (latestRun) {
      success(`Latest complete run: ${latestRun.id}`);
      info(`  Status: ${latestRun.status}`);
      info(`  Score: ${latestRun.score ?? 'n/a'}`);
      info(`  Created: ${latestRun.createdAt}`);

      // Validate rawJson structure
      const validation = validateRawJsonStructure(latestRun.rawJson);
      console.log('');
      if (validation.valid) {
        success(`rawJson structure is VALID`);
        info(`  Extraction path: ${validation.extractionPath}`);
        info(`  Has siteAssessment: ${validation.hasSiteAssessment ? 'YES' : 'NO'}`);
        info(`  Has siteGraph: ${validation.hasSiteGraph ? 'YES' : 'NO'}`);
      } else {
        error(`rawJson structure is INVALID`);
        warn(`  Top-level keys: ${validation.keys.join(', ')}`);
        warn(`  Expected: rawEvidence.labResultV4.siteAssessment OR direct siteAssessment`);
      }
    } else {
      warn('No complete run with rawJson found');
      for (const run of diagnosticRuns.slice(0, 3)) {
        warn(`  ${run.id}: status=${run.status}, hasRawJson=${!!run.rawJson}`);
      }
    }
  }

  // 3. Check GAP_HEAVY_RUNS table (legacy fallback)
  header('3. GAP_HEAVY_RUNS TABLE (LEGACY FALLBACK)');
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 5);
  const websiteLabHeavyRun = heavyRuns.find(r =>
    (r.status === 'completed' || r.status === 'paused') &&
    r.evidencePack?.websiteLabV4
  );

  if (websiteLabHeavyRun) {
    success(`Found WebsiteLab data in Heavy GAP Run: ${websiteLabHeavyRun.id}`);
    info(`  Status: ${websiteLabHeavyRun.status}`);
  } else {
    info('No WebsiteLab data in GAP_HEAVY_RUNS (this is OK if DIAGNOSTIC_RUNS has data)');
  }

  // 4. Check current context graph state
  header('4. CONTEXT GRAPH STATE (BEFORE)');
  const contextGraphBefore = await loadContextGraph(companyId);
  if (contextGraphBefore) {
    const { total, withValues } = countContextFields(contextGraphBefore);
    success(`Context graph exists`);
    info(`  Fields: ${withValues}/${total} have values (${Math.round(withValues/total*100)}%)`);

    // Check website domain specifically
    const websiteDomain = contextGraphBefore.website;
    if (websiteDomain) {
      const websiteFields = Object.entries(websiteDomain)
        .filter(([k]) => k !== '_meta')
        .filter(([_, v]) => v && typeof v === 'object' && 'value' in v && (v as any).value);
      info(`  Website domain fields with values: ${websiteFields.length}`);
      for (const [key, _] of websiteFields.slice(0, 5)) {
        info(`    - ${key}`);
      }
    }
  } else {
    warn('No context graph exists yet');
  }

  // 5. Check importer availability
  header('5. IMPORTER AVAILABILITY');
  const importerSupports = await websiteLabImporter.supports(companyId, 'website');
  if (importerSupports) {
    success('WebsiteLab importer reports data IS available');
  } else {
    error('WebsiteLab importer reports NO data available');
  }

  // 6. Trigger hydration if requested
  if (shouldHydrate) {
    header('6. TRIGGERING HYDRATION');

    const graph = contextGraphBefore || createEmptyContextGraph(companyId, company.name);

    info('Running websiteLabImporter.importAll()...');
    const importResult = await websiteLabImporter.importAll(graph, companyId, 'website');

    if (importResult.success) {
      success(`Import successful!`);
      info(`  Fields updated: ${importResult.fieldsUpdated}`);
      info(`  Updated paths: ${importResult.updatedPaths.slice(0, 5).join(', ')}${importResult.updatedPaths.length > 5 ? '...' : ''}`);
      info(`  Source run IDs: ${importResult.sourceRunIds.join(', ')}`);

      // Save the updated graph
      info('Saving updated context graph...');
      await saveContextGraph(graph, 'websiteLabImporter');
      success('Context graph saved');

      // Show after state
      const { total: totalAfter, withValues: withValuesAfter } = countContextFields(graph);
      const beforeCount = contextGraphBefore ? countContextFields(contextGraphBefore).withValues : 0;
      const delta = withValuesAfter - beforeCount;
      info(`  Fields after: ${withValuesAfter}/${totalAfter} (${delta >= 0 ? '+' : ''}${delta} change)`);
    } else {
      error(`Import failed`);
      for (const err of importResult.errors) {
        error(`  ${err}`);
      }
    }
  } else {
    header('6. HYDRATION SKIPPED (use --hydrate to run)');
  }

  // Summary
  header('=== SUMMARY ===');
  const hasDiagnosticData = diagnosticRuns.some(r => r.status === 'complete' && r.rawJson);
  const hasLegacyData = !!websiteLabHeavyRun;

  console.log('');
  console.log('Data Sources:');
  console.log(`  DIAGNOSTIC_RUNS: ${hasDiagnosticData ? GREEN + 'HAS DATA' + RESET : RED + 'NO DATA' + RESET}`);
  console.log(`  GAP_HEAVY_RUNS:  ${hasLegacyData ? GREEN + 'HAS DATA' + RESET : YELLOW + 'NO DATA (OK)' + RESET}`);
  console.log(`  Importer Ready:  ${importerSupports ? GREEN + 'YES' + RESET : RED + 'NO' + RESET}`);
  console.log('');

  if (!hasDiagnosticData && !hasLegacyData) {
    warn('NO WEBSITELAB DATA AVAILABLE');
    info('Run the WebsiteLab diagnostic first via:');
    info('  POST /api/os/diagnostics/run/website-lab { "companyId": "..." }');
  } else if (!shouldHydrate) {
    info('To trigger hydration and populate context, run:');
    info(`  npx tsx scripts/verifyWebsiteLabContextFlow.ts ${companyId} --hydrate`);
  }

  console.log('');
}

main().catch(console.error);
