#!/usr/bin/env npx tsx
// scripts/verifyLabsContextPopulation.ts
// Proof Mode: Verify Labs → Context population is working
//
// Usage:
//   npx tsx scripts/verifyLabsContextPopulation.ts <companyId>
//   npx tsx scripts/verifyLabsContextPopulation.ts <companyId> --hydrate
//   DEBUG_CONTEXT_HYDRATION=1 npx tsx scripts/verifyLabsContextPopulation.ts <companyId> --hydrate

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getCompanyById } from '../lib/airtable/companies';
import { listDiagnosticRunsForCompany, type DiagnosticRun, type DiagnosticToolId } from '../lib/os/diagnostics/runs';
import { loadContextGraph, saveContextGraph } from '../lib/contextGraph/storage';
import { createEmptyContextGraph } from '../lib/contextGraph/companyContextGraph';

// Import all lab importers
import { websiteLabImporter } from '../lib/contextGraph/importers/websiteLabImporter';
import { brandLabImporter } from '../lib/contextGraph/importers/brandLabImporter';
import { seoLabImporter } from '../lib/contextGraph/importers/seoLabImporter';
import { contentLabImporter } from '../lib/contextGraph/importers/contentLabImporter';
import { demandLabImporter } from '../lib/contextGraph/importers/demandLabImporter';
import { opsLabImporter } from '../lib/contextGraph/importers/opsLabImporter';

// Colors for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function success(msg: string) { console.log(`${GREEN}✓${RESET} ${msg}`); }
function error(msg: string) { console.log(`${RED}✗${RESET} ${msg}`); }
function warn(msg: string) { console.log(`${YELLOW}⚠${RESET} ${msg}`); }
function info(msg: string) { console.log(`${CYAN}→${RESET} ${msg}`); }
function header(msg: string) { console.log(`\n${BOLD}${msg}${RESET}`); }
function dim(msg: string) { console.log(`${DIM}${msg}${RESET}`); }

// Lab configuration
interface LabConfig {
  toolId: DiagnosticToolId;
  label: string;
  importer: any;
  expectedKeys: string[];
  targetDomains: string[];
}

const LABS: LabConfig[] = [
  {
    toolId: 'websiteLab',
    label: 'Website Lab',
    importer: websiteLabImporter,
    expectedKeys: ['siteAssessment', 'siteGraph'],
    targetDomains: ['website', 'digitalInfra'],
  },
  {
    toolId: 'brandLab',
    label: 'Brand Lab',
    importer: brandLabImporter,
    expectedKeys: ['findings', 'dimensions', 'positioningSummary'],
    targetDomains: ['brand', 'identity', 'audience'],
  },
  {
    toolId: 'seoLab',
    label: 'SEO Lab',
    importer: seoLabImporter,
    expectedKeys: ['seoScore', 'seoSummary', 'technicalIssues', 'findings'],
    targetDomains: ['seo'],
  },
  {
    toolId: 'contentLab',
    label: 'Content Lab',
    importer: contentLabImporter,
    expectedKeys: ['contentScore', 'contentSummary', 'findings'],
    targetDomains: ['content'],
  },
  {
    toolId: 'demandLab',
    label: 'Demand Lab',
    importer: demandLabImporter,
    expectedKeys: ['demandScore', 'findings', 'channelAnalysis'],
    targetDomains: ['performanceMedia', 'audience'],
  },
  {
    toolId: 'opsLab',
    label: 'Ops Lab',
    importer: opsLabImporter,
    expectedKeys: ['opsScore', 'findings', 'capabilities'],
    targetDomains: ['ops'],
  },
];

/**
 * Detect JSON extraction path
 */
function detectJsonPath(rawJson: unknown): {
  path: 'rawEvidence.labResultV4' | 'result' | 'findings' | 'root' | 'none';
  topKeys: string[];
} {
  if (!rawJson || typeof rawJson !== 'object') {
    return { path: 'none', topKeys: [] };
  }

  const data = rawJson as Record<string, unknown>;
  const topKeys = Object.keys(data);

  // Check rawEvidence.labResultV4 (new format)
  const rawEvidence = data.rawEvidence as Record<string, unknown> | undefined;
  if (rawEvidence?.labResultV4) {
    return { path: 'rawEvidence.labResultV4', topKeys };
  }

  // Check result wrapper
  if (data.result) {
    return { path: 'result', topKeys };
  }

  // Check findings
  if (data.findings) {
    return { path: 'findings', topKeys };
  }

  // Direct root-level
  return { path: 'root', topKeys };
}

/**
 * Check if expected keys are present in the data
 */
function hasExpectedKeys(rawJson: unknown, expectedKeys: string[]): string[] {
  if (!rawJson || typeof rawJson !== 'object') return [];

  const data = rawJson as Record<string, unknown>;

  // Try various extraction paths
  const rawEvidence = data.rawEvidence as Record<string, unknown> | undefined;
  const labResult = rawEvidence?.labResultV4 as Record<string, unknown> | undefined;
  const result = data.result as Record<string, unknown> | undefined;

  const candidates = [labResult, result, data].filter(Boolean) as Record<string, unknown>[];

  const found: string[] = [];
  for (const key of expectedKeys) {
    for (const candidate of candidates) {
      if (key in candidate) {
        found.push(key);
        break;
      }
    }
  }

  return found;
}

/**
 * Count fields with values in context graph by domain
 */
function countContextFieldsByDomain(graph: any): Record<string, number> {
  const byDomain: Record<string, number> = {};

  const domainNames = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive'
  ];

  for (const domainName of domainNames) {
    const domainData = graph[domainName];
    let count = 0;
    if (domainData && typeof domainData === 'object') {
      for (const [fieldName, fieldData] of Object.entries(domainData)) {
        if (fieldName === '_meta') continue;
        if (fieldData && typeof fieldData === 'object' && 'value' in fieldData && (fieldData as any).value) {
          count++;
        }
      }
    }
    byDomain[domainName] = count;
  }

  return byDomain;
}

interface LabCheckResult {
  toolId: DiagnosticToolId;
  label: string;
  hasRun: boolean;
  runId?: string;
  status?: string;
  jsonPath: 'rawEvidence.labResultV4' | 'result' | 'findings' | 'root' | 'none';
  foundKeys: string[];
  importerSupports: boolean;
  fieldsWritten?: number;
  error?: string;
}

async function checkLab(
  companyId: string,
  lab: LabConfig,
  shouldHydrate: boolean,
  graph: any
): Promise<LabCheckResult> {
  const result: LabCheckResult = {
    toolId: lab.toolId,
    label: lab.label,
    hasRun: false,
    jsonPath: 'none',
    foundKeys: [],
    importerSupports: false,
  };

  try {
    // Check for runs
    const runs = await listDiagnosticRunsForCompany(companyId, {
      toolId: lab.toolId,
      limit: 5,
    });

    const completeRun = runs.find(r => r.status === 'complete' && r.rawJson);

    if (completeRun) {
      result.hasRun = true;
      result.runId = completeRun.id;
      result.status = completeRun.status;

      const pathInfo = detectJsonPath(completeRun.rawJson);
      result.jsonPath = pathInfo.path;
      result.foundKeys = hasExpectedKeys(completeRun.rawJson, lab.expectedKeys);
    }

    // Check importer support
    result.importerSupports = await lab.importer.supports(companyId, '');

    // Hydrate if requested
    if (shouldHydrate && result.importerSupports) {
      const importResult = await lab.importer.importAll(graph, companyId, '');
      result.fieldsWritten = importResult.fieldsUpdated;
      if (!importResult.success && importResult.errors.length > 0) {
        result.error = importResult.errors[0];
      }
    }

  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

async function main() {
  const companyId = process.argv[2];
  const shouldHydrate = process.argv.includes('--hydrate');

  if (!companyId) {
    console.error('Usage: npx tsx scripts/verifyLabsContextPopulation.ts <companyId> [--hydrate]');
    process.exit(1);
  }

  header('=== LABS → CONTEXT POPULATION PROOF ===');
  console.log('Company ID:', companyId);
  console.log('Mode:', shouldHydrate ? 'HYDRATE' : 'CHECK ONLY');
  console.log('');

  // Verify company exists
  const company = await getCompanyById(companyId);
  if (!company) {
    error('Company not found!');
    process.exit(1);
  }
  success(`Company: ${company.name}`);

  // Load or create context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, company.name);
    info('Created new empty context graph');
  }

  const beforeFields = countContextFieldsByDomain(graph);
  const beforeTotal = Object.values(beforeFields).reduce((a, b) => a + b, 0);

  header('LAB STATUS');
  console.log('');

  const results: LabCheckResult[] = [];
  let hasFailures = false;

  for (const lab of LABS) {
    const result = await checkLab(companyId, lab, shouldHydrate, graph);
    results.push(result);

    // Print result
    const statusIcon = result.hasRun ? (result.importerSupports ? GREEN + '●' + RESET : YELLOW + '○' + RESET) : DIM + '○' + RESET;
    console.log(`${statusIcon} ${BOLD}${lab.label}${RESET}`);

    if (result.hasRun) {
      dim(`   Run: ${result.runId}`);
      dim(`   Path: ${result.jsonPath}`);
      dim(`   Keys: ${result.foundKeys.length > 0 ? result.foundKeys.join(', ') : '(none matched)'}`);
      dim(`   Importer: ${result.importerSupports ? 'ready' : 'not supported'}`);

      if (shouldHydrate && result.fieldsWritten !== undefined) {
        if (result.fieldsWritten > 0) {
          success(`   Written: ${result.fieldsWritten} fields`);
        } else {
          warn(`   Written: 0 fields`);
        }
      }

      // Check for failures
      if (result.jsonPath === 'none') {
        error(`   FAIL: Run exists but JSON path is 'none'`);
        hasFailures = true;
      }
      if (shouldHydrate && result.importerSupports && result.fieldsWritten === 0 && result.foundKeys.length > 0) {
        error(`   FAIL: Valid output but 0 fields written`);
        hasFailures = true;
      }
    } else {
      dim(`   No completed runs found`);
    }

    if (result.error) {
      error(`   Error: ${result.error}`);
    }

    console.log('');
  }

  // Save if hydrated
  if (shouldHydrate) {
    await saveContextGraph(graph, 'verifyLabsContextPopulation');
    success('Context graph saved');
  }

  // Summary
  header('SUMMARY');

  const labsWithRuns = results.filter(r => r.hasRun).length;
  const labsSupported = results.filter(r => r.importerSupports).length;
  console.log(`Labs with runs: ${labsWithRuns}/${LABS.length}`);
  console.log(`Labs supported: ${labsSupported}/${LABS.length}`);

  if (shouldHydrate) {
    const afterFields = countContextFieldsByDomain(graph);
    const afterTotal = Object.values(afterFields).reduce((a, b) => a + b, 0);
    const totalWritten = results.reduce((sum, r) => sum + (r.fieldsWritten || 0), 0);

    console.log('');
    console.log(`Fields before: ${beforeTotal}`);
    console.log(`Fields after:  ${afterTotal}`);
    console.log(`Delta:         ${afterTotal - beforeTotal >= 0 ? '+' : ''}${afterTotal - beforeTotal}`);
    console.log(`Total written: ${totalWritten}`);

    console.log('');
    console.log('By domain:');
    for (const [domain, count] of Object.entries(afterFields)) {
      const before = beforeFields[domain] || 0;
      const delta = count - before;
      if (count > 0 || delta !== 0) {
        const deltaStr = delta !== 0 ? ` (${delta >= 0 ? '+' : ''}${delta})` : '';
        console.log(`  ${domain}: ${count}${deltaStr}`);
      }
    }
  }

  console.log('');

  if (hasFailures) {
    error('VERIFICATION FAILED - see errors above');
    process.exit(1);
  } else {
    success('VERIFICATION PASSED');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
