#!/usr/bin/env npx tsx
// scripts/verifyContextPopulation.ts
// Unified verification script for Labs/GAP → Context population
//
// Usage:
//   npx tsx scripts/verifyContextPopulation.ts <companyId> --source <sourceKey>
//   npx tsx scripts/verifyContextPopulation.ts <companyId> --source websiteLab --hydrate
//   npx tsx scripts/verifyContextPopulation.ts <companyId> --all
//
// Sources:
//   websiteLab, brandLab, seoLab, contentLab, demandLab, opsLab,
//   audienceLab, competitionLab, gapSnapshot, gapIa, gapPlan, gapHeavy

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getCompanyById } from '../lib/airtable/companies';
import { listDiagnosticRunsForCompany, type DiagnosticRun, type DiagnosticToolId } from '../lib/os/diagnostics/runs';
import { getHeavyGapRunsByCompanyId } from '../lib/airtable/gapHeavyRuns';
import { getGapIaRunsForCompanyOrDomain } from '../lib/airtable/gapIaRuns';
import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { createEmptyContextGraph } from '../lib/contextGraph/companyContextGraph';

// Import all importers
import { websiteLabImporter } from '../lib/contextGraph/importers/websiteLabImporter';
import { brandLabImporter } from '../lib/contextGraph/importers/brandLabImporter';
import { seoLabImporter } from '../lib/contextGraph/importers/seoLabImporter';
import { contentLabImporter } from '../lib/contextGraph/importers/contentLabImporter';
import { demandLabImporter } from '../lib/contextGraph/importers/demandLabImporter';
import { opsLabImporter } from '../lib/contextGraph/importers/opsLabImporter';
import { gapImporter } from '../lib/contextGraph/importers/gapImporter';
import { gapPlanImporter } from '../lib/contextGraph/importers/gapPlanImporter';

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

// Source configuration
interface SourceConfig {
  toolId?: DiagnosticToolId;
  table: 'DIAGNOSTIC_RUNS' | 'GAP_IA_RUNS' | 'GAP_PLAN_RUN' | 'GAP_HEAVY_RUNS';
  importer: any;
  expectedPath: string;
  domains: string[];
}

const SOURCE_CONFIG: Record<string, SourceConfig> = {
  websiteLab: {
    toolId: 'websiteLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: websiteLabImporter,
    expectedPath: 'rawEvidence.labResultV4.siteAssessment',
    domains: ['website', 'digitalInfra'],
  },
  brandLab: {
    toolId: 'brandLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: brandLabImporter,
    expectedPath: 'rawEvidence.labResultV4 OR result.findings OR dimensions',
    domains: ['brand', 'identity', 'audience'],
  },
  seoLab: {
    toolId: 'seoLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: seoLabImporter,
    expectedPath: 'rawEvidence.labResultV4 OR root',
    domains: ['seo'],
  },
  contentLab: {
    toolId: 'contentLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: contentLabImporter,
    expectedPath: 'rawEvidence.labResultV4 OR root',
    domains: ['content'],
  },
  demandLab: {
    toolId: 'demandLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: demandLabImporter,
    expectedPath: 'rawEvidence.labResultV4 OR root',
    domains: ['performanceMedia', 'audience'],
  },
  opsLab: {
    toolId: 'opsLab',
    table: 'DIAGNOSTIC_RUNS',
    importer: opsLabImporter,
    expectedPath: 'rawEvidence.labResultV4 OR root',
    domains: ['ops'],
  },
  gapSnapshot: {
    toolId: 'gapSnapshot',
    table: 'DIAGNOSTIC_RUNS',
    importer: gapImporter,
    expectedPath: 'initialAssessment',
    domains: ['identity', 'objectives'],
  },
  gapIa: {
    table: 'GAP_IA_RUNS',
    importer: gapImporter,
    expectedPath: 'core/dimensions/summary',
    domains: ['identity', 'objectives'],
  },
  gapPlan: {
    table: 'GAP_PLAN_RUN',
    importer: gapPlanImporter,
    expectedPath: 'gapStructured + insights',
    domains: ['objectives', 'identity', 'brand', 'audience', 'competitive', 'productOffer'],
  },
  gapHeavy: {
    table: 'GAP_HEAVY_RUNS',
    importer: null, // Legacy fallback only
    expectedPath: 'evidencePack.*',
    domains: ['website', 'brand'],
  },
};

/**
 * Detect which JSON path is present in rawJson
 */
function detectJsonPath(rawJson: unknown): {
  path: string;
  hasLabResultV4: boolean;
  hasLegacy: boolean;
  keys: string[];
} {
  if (!rawJson || typeof rawJson !== 'object') {
    return { path: 'none', hasLabResultV4: false, hasLegacy: false, keys: [] };
  }

  const data = rawJson as Record<string, unknown>;
  const keys = Object.keys(data);

  // Check for rawEvidence.labResultV4 (new format)
  const rawEvidence = data.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    return {
      path: 'rawEvidence.labResultV4',
      hasLabResultV4: true,
      hasLegacy: false,
      keys,
    };
  }

  // Check for result wrapper
  if (data.result) {
    return {
      path: 'result',
      hasLabResultV4: false,
      hasLegacy: true,
      keys,
    };
  }

  // Check for known root-level fields
  const knownFields = ['siteAssessment', 'findings', 'dimensions', 'initialAssessment', 'core'];
  const hasKnownField = knownFields.some(f => f in data);
  if (hasKnownField) {
    return {
      path: 'root',
      hasLabResultV4: false,
      hasLegacy: true,
      keys,
    };
  }

  return { path: 'unknown', hasLabResultV4: false, hasLegacy: false, keys };
}

/**
 * Count fields with values in context graph
 */
function countContextFields(graph: any): { total: number; withValues: number; byDomain: Record<string, number> } {
  let total = 0;
  let withValues = 0;
  const byDomain: Record<string, number> = {};

  const domainNames = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive'
  ];

  for (const domainName of domainNames) {
    const domainData = graph[domainName];
    let domainCount = 0;
    if (domainData && typeof domainData === 'object') {
      for (const [fieldName, fieldData] of Object.entries(domainData)) {
        if (fieldName === '_meta') continue;
        total++;
        if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && (fieldData as any).value) {
          withValues++;
          domainCount++;
        }
      }
    }
    byDomain[domainName] = domainCount;
  }

  return { total, withValues, byDomain };
}

/**
 * Verify a single source
 */
async function verifySource(
  companyId: string,
  sourceKey: string,
  shouldHydrate: boolean
): Promise<{ success: boolean; fieldsWritten: number }> {
  const config = SOURCE_CONFIG[sourceKey];
  if (!config) {
    error(`Unknown source: ${sourceKey}`);
    return { success: false, fieldsWritten: 0 };
  }

  header(`=== ${sourceKey.toUpperCase()} ===`);
  info(`Table: ${config.table}`);
  info(`Expected path: ${config.expectedPath}`);
  info(`Target domains: ${config.domains.join(', ')}`);

  let hasData = false;
  let latestRun: any = null;
  let jsonPath: ReturnType<typeof detectJsonPath> | null = null;

  // Check for data based on table type
  if (config.table === 'DIAGNOSTIC_RUNS' && config.toolId) {
    const runs = await listDiagnosticRunsForCompany(companyId, {
      toolId: config.toolId,
      limit: 5,
    });
    const completeRun = runs.find(r => r.status === 'complete' && r.rawJson);
    if (completeRun) {
      hasData = true;
      latestRun = completeRun;
      jsonPath = detectJsonPath(completeRun.rawJson);
      success(`Found ${runs.length} run(s), latest complete: ${completeRun.id}`);
      info(`  JSON path detected: ${jsonPath.path}`);
      info(`  Has labResultV4: ${jsonPath.hasLabResultV4 ? 'YES' : 'NO'}`);
      info(`  Top-level keys: ${jsonPath.keys.slice(0, 5).join(', ')}${jsonPath.keys.length > 5 ? '...' : ''}`);
    } else {
      warn(`No complete runs with rawJson found (${runs.length} total runs)`);
    }
  } else if (config.table === 'GAP_IA_RUNS') {
    const company = await getCompanyById(companyId);
    const domain = company?.domain || company?.website || '';
    const runs = await getGapIaRunsForCompanyOrDomain(companyId, domain, 5);
    const completeRun = runs.find(r => r.status === 'completed' || r.status === 'complete');
    if (completeRun) {
      hasData = true;
      latestRun = completeRun;
      success(`Found ${runs.length} GAP IA run(s), latest complete: ${completeRun.id}`);
      info(`  Has core: ${!!completeRun.core}`);
      info(`  Has dimensions: ${!!completeRun.dimensions}`);
      info(`  Has summary: ${!!completeRun.summary}`);
    } else {
      warn(`No complete GAP IA runs found (${runs.length} total runs)`);
    }
  } else if (config.table === 'GAP_HEAVY_RUNS') {
    const runs = await getHeavyGapRunsByCompanyId(companyId, 5);
    const completeRun = runs.find(r => (r.status === 'completed' || r.status === 'paused') && r.evidencePack);
    if (completeRun) {
      hasData = true;
      latestRun = completeRun;
      success(`Found ${runs.length} GAP Heavy run(s), latest: ${completeRun.id}`);
      info(`  Has evidencePack: ${!!completeRun.evidencePack}`);
      if (completeRun.evidencePack) {
        const packKeys = Object.keys(completeRun.evidencePack);
        info(`  Evidence pack keys: ${packKeys.join(', ')}`);
      }
    } else {
      warn(`No complete GAP Heavy runs found`);
    }
  }

  // Check importer availability
  if (config.importer) {
    const supports = await config.importer.supports(companyId, '');
    info(`Importer reports data available: ${supports ? 'YES' : 'NO'}`);
  }

  // Hydrate if requested
  let fieldsWritten = 0;
  if (shouldHydrate && config.importer && hasData) {
    header('HYDRATING...');
    const company = await getCompanyById(companyId);
    if (!company) {
      error('Company not found');
      return { success: false, fieldsWritten: 0 };
    }

    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = createEmptyContextGraph(companyId, company.name);
      info('Created new empty context graph');
    }

    const beforeCount = countContextFields(graph);
    info(`Before: ${beforeCount.withValues}/${beforeCount.total} fields with values`);

    const result = await config.importer.importAll(graph, companyId, '');

    if (result.success) {
      success(`Import successful!`);
      info(`  Fields updated: ${result.fieldsUpdated}`);
      info(`  Paths: ${result.updatedPaths.slice(0, 5).join(', ')}${result.updatedPaths.length > 5 ? '...' : ''}`);
      fieldsWritten = result.fieldsUpdated;

      // Save the graph
      await saveContextGraph(graph, `${sourceKey}Importer`);
      success('Context graph saved');

      const afterCount = countContextFields(graph);
      info(`After: ${afterCount.withValues}/${afterCount.total} fields with values (+${afterCount.withValues - beforeCount.withValues})`);

      // Show domain breakdown
      for (const domain of config.domains) {
        const count = afterCount.byDomain[domain] || 0;
        if (count > 0) {
          info(`  ${domain}: ${count} fields`);
        }
      }
    } else {
      error(`Import failed`);
      for (const err of result.errors) {
        error(`  ${err}`);
      }
    }
  }

  return { success: hasData, fieldsWritten };
}

async function main() {
  const args = process.argv.slice(2);
  const companyId = args[0];
  const sourceArg = args.find(a => a === '--source' || a === '-s');
  const sourceIndex = args.indexOf(sourceArg || '--source');
  const sourceKey = sourceIndex >= 0 ? args[sourceIndex + 1] : null;
  const shouldHydrate = args.includes('--hydrate');
  const verifyAll = args.includes('--all');

  if (!companyId || (!sourceKey && !verifyAll)) {
    console.log('Usage:');
    console.log('  npx tsx scripts/verifyContextPopulation.ts <companyId> --source <sourceKey> [--hydrate]');
    console.log('  npx tsx scripts/verifyContextPopulation.ts <companyId> --all [--hydrate]');
    console.log('');
    console.log('Sources:');
    console.log('  ' + Object.keys(SOURCE_CONFIG).join(', '));
    process.exit(1);
  }

  header('=== CONTEXT POPULATION VERIFICATION ===');
  console.log('Company ID:', companyId);
  console.log('Hydrate:', shouldHydrate ? 'YES' : 'NO');

  // Verify company exists
  const company = await getCompanyById(companyId);
  if (!company) {
    error('Company not found!');
    process.exit(1);
  }
  success(`Company: ${company.name}`);

  const results: Record<string, { success: boolean; fieldsWritten: number }> = {};

  if (verifyAll) {
    // Verify all sources
    for (const key of Object.keys(SOURCE_CONFIG)) {
      results[key] = await verifySource(companyId, key, shouldHydrate);
    }
  } else if (sourceKey) {
    results[sourceKey] = await verifySource(companyId, sourceKey, shouldHydrate);
  }

  // Summary
  header('=== SUMMARY ===');
  for (const [key, result] of Object.entries(results)) {
    const status = result.success ? `${GREEN}HAS DATA${RESET}` : `${RED}NO DATA${RESET}`;
    const fields = result.fieldsWritten > 0 ? ` (${result.fieldsWritten} fields written)` : '';
    console.log(`  ${key}: ${status}${fields}`);
  }

  console.log('');
}

main().catch(console.error);
