#!/usr/bin/env npx tsx
/**
 * scripts/proveContextPromotion.ts
 * Proof Packet Script for Context Promotion Debugging
 *
 * Usage:
 *   npx tsx scripts/proveContextPromotion.ts <companyId>
 *   npx tsx scripts/proveContextPromotion.ts <companyId> --promote
 *   npx tsx scripts/proveContextPromotion.ts <companyId> --promote --importer websiteLab
 *   DEBUG_CONTEXT_PROOF=1 npx tsx scripts/proveContextPromotion.ts <companyId> --promote
 *
 * Exit codes:
 *   0 - Success (promotion worked or no raw data to promote)
 *   1 - Failure (raw data exists but 0 fields written, or UI mismatch)
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// ============================================================================
// Types
// ============================================================================

interface ProofPacket {
  companyId: string;
  companyName: string;
  domain: string;
  timestamp: string;

  // Before snapshot
  before: {
    completeness: number;
    nodeCount: number;
    populatedDomains: string[];
    rawDataSources: {
      diagnosticRuns: number;
      gapIaRuns: number;
      gapPlanRuns: number;
      gapHeavyRuns: number;
    };
    importersWithData: string[];
  };

  // Promotion results (if --promote flag)
  promotion?: {
    executed: boolean;
    durationMs: number;
    totalFieldsWritten: number;
    totalErrors: number;
    importerResults: ImporterProof[];
  };

  // After snapshot
  after?: {
    completeness: number;
    nodeCount: number;
    populatedDomains: string[];
    completenessDelta: number;
    nodeCountDelta: number;
  };

  // UI visibility check
  uiCheck?: {
    loadedFieldCount: number;
    loadedKeys: string[];
    mismatch: boolean;
    mismatchReason?: string;
  };

  // Diagnosis
  diagnosis: string;
  exitCode: number;
}

interface ImporterProof {
  importerId: string;
  importerLabel: string;

  // Extraction
  extractionPath: string | null;
  sourceRunIds: string[];
  rawKeysFound: number;

  // Candidate writes
  candidateWrites: Array<{
    path: string;
    valuePreview: string;
    source: string;
    confidence: number;
  }>;

  // Results
  fieldsWritten: number;
  fieldsSkipped: number;
  skippedReasons: Record<string, number>;
  writtenKeys: string[];  // Actual paths that were written (limit 50)
  errors: string[];
}

// ============================================================================
// Console Formatting
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(msg: string) {
  console.log(msg);
}

function header(title: string) {
  log(`\n${colors.bright}${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}`);
  log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  log(`${colors.cyan}═══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function section(title: string) {
  log(`\n${colors.bright}${colors.blue}▸ ${title}${colors.reset}`);
  log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
}

function success(msg: string) {
  log(`  ${colors.green}✓${colors.reset} ${msg}`);
}

function warn(msg: string) {
  log(`  ${colors.yellow}⚠${colors.reset} ${msg}`);
}

function error(msg: string) {
  log(`  ${colors.red}✗${colors.reset} ${msg}`);
}

function info(msg: string) {
  log(`  ${colors.dim}→${colors.reset} ${msg}`);
}

function kvLine(key: string, value: unknown) {
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  log(`  ${colors.dim}${key}:${colors.reset} ${valueStr}`);
}

function truncate(str: string, maxLen: number = 80): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const companyId = args.find(a => !a.startsWith('--'));
  const shouldPromote = args.includes('--promote');
  const importerIndex = args.indexOf('--importer');
  const importerArg = args.find(a => a.startsWith('--importer='))?.split('=')[1]
    || (importerIndex >= 0 ? args[importerIndex + 1] : undefined);
  const debugMode = process.env.DEBUG_CONTEXT_PROOF === '1';

  if (!companyId) {
    console.error('Usage: npx tsx scripts/proveContextPromotion.ts <companyId> [--promote] [--importer <id>]');
    process.exit(1);
  }

  header('CONTEXT PROMOTION PROOF PACKET');
  log(`Company ID: ${colors.bright}${companyId}${colors.reset}`);
  log(`Mode: ${shouldPromote ? colors.green + 'PROMOTE' : colors.yellow + 'INSPECT ONLY'}${colors.reset}`);
  if (importerArg) log(`Importer: ${colors.cyan}${importerArg}${colors.reset}`);
  if (debugMode) log(`Debug: ${colors.magenta}ENABLED${colors.reset}`);

  // Dynamic imports
  const { getCompanyById } = await import('@/lib/airtable/companies');
  const { loadContextGraph, saveContextGraph } = await import('@/lib/contextGraph/storage');
  const { createEmptyContextGraph, calculateCompleteness } = await import('@/lib/contextGraph/companyContextGraph');
  const { getHeavyGapRunsByCompanyId } = await import('@/lib/airtable/gapHeavyRuns');
  const { getGapIaRunsForCompanyOrDomain } = await import('@/lib/airtable/gapIaRuns');
  const { getEnabledImporters, getImporterById } = await import('@/lib/contextGraph/importers/registry');
  const { listDiagnosticRunsForCompany } = await import('@/lib/os/diagnostics/runs');

  const proof: Partial<ProofPacket> = {
    companyId,
    timestamp: new Date().toISOString(),
  };

  // -------------------------------------------------------------------------
  // Load Company
  // -------------------------------------------------------------------------
  section('Loading Company');

  const company = await getCompanyById(companyId);
  if (!company) {
    error(`Company not found: ${companyId}`);
    process.exit(1);
  }

  proof.companyName = company.name;
  proof.domain = company.domain || company.website || '';
  success(`Found: ${company.name}`);
  kvLine('Domain', proof.domain || '(none)');

  // -------------------------------------------------------------------------
  // Before Snapshot
  // -------------------------------------------------------------------------
  section('Before Snapshot');

  const graphBefore = await loadContextGraph(companyId);
  const completenessBeforeRaw = graphBefore ? calculateCompleteness(graphBefore) : 0;
  const completenessBefore = Math.round(completenessBeforeRaw * 100) / 100;
  const nodeCountBefore = graphBefore ? countGraphNodes(graphBefore) : 0;
  const populatedDomainsBefore = graphBefore ? getPopulatedDomains(graphBefore) : [];

  kvLine('Completeness', `${completenessBefore}%`);
  kvLine('Node Count', nodeCountBefore);
  kvLine('Populated Domains', populatedDomainsBefore.length > 0 ? populatedDomainsBefore.join(', ') : '(none)');

  // Check raw data sources
  const [diagnosticRuns, gapIaRuns, gapHeavyRuns] = await Promise.all([
    listDiagnosticRunsForCompany(companyId, { limit: 10 }).catch(() => []),
    getGapIaRunsForCompanyOrDomain(companyId, proof.domain, 10).catch(() => []),
    getHeavyGapRunsByCompanyId(companyId, 10).catch(() => []),
  ]);

  const rawDataSources = {
    diagnosticRuns: diagnosticRuns.length,
    gapIaRuns: gapIaRuns.length,
    gapPlanRuns: 0, // TODO: add gapPlanRuns loader
    gapHeavyRuns: gapHeavyRuns.length,
  };

  log(`\n  ${colors.bright}Raw Data Sources:${colors.reset}`);
  kvLine('  Diagnostic Runs', rawDataSources.diagnosticRuns);
  kvLine('  GAP-IA Runs', rawDataSources.gapIaRuns);
  kvLine('  GAP-Heavy Runs', rawDataSources.gapHeavyRuns);

  // Check which importers have data
  const importers = getEnabledImporters();
  const importerChecks: string[] = [];

  log(`\n  ${colors.bright}Importer Data Availability:${colors.reset}`);
  for (const imp of importers) {
    try {
      const hasData = await imp.supports(companyId, proof.domain);
      if (hasData) {
        importerChecks.push(imp.id);
        success(`${imp.label} (${imp.id}): HAS DATA`);
      } else {
        info(`${imp.label} (${imp.id}): no data`);
      }
    } catch (e) {
      warn(`${imp.label} (${imp.id}): error checking`);
    }
  }

  proof.before = {
    completeness: completenessBefore,
    nodeCount: nodeCountBefore,
    populatedDomains: populatedDomainsBefore,
    rawDataSources,
    importersWithData: importerChecks,
  };

  const hasRawData = rawDataSources.diagnosticRuns > 0 ||
                     rawDataSources.gapIaRuns > 0 ||
                     rawDataSources.gapHeavyRuns > 0;

  if (!hasRawData) {
    header('DIAGNOSIS: NO RAW DATA');
    log(`${colors.yellow}No diagnostic or GAP runs found for this company.${colors.reset}`);
    log('Run Labs or GAP to generate raw data before promotion.');
    proof.diagnosis = 'NO_RAW_DATA';
    proof.exitCode = 0;
    printFinalPacket(proof as ProofPacket);
    process.exit(0);
  }

  if (importerChecks.length === 0) {
    header('DIAGNOSIS: IMPORTERS REPORT NO DATA');
    warn('Raw runs exist but no importer reports having data.');
    log('This may indicate:');
    log('  - Runs are incomplete or in error state');
    log('  - Raw data format is not recognized by importers');
    log('  - importer.supports() logic is too restrictive');
    proof.diagnosis = 'IMPORTERS_REPORT_NO_DATA';
    proof.exitCode = 1;
    printFinalPacket(proof as ProofPacket);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Promotion (if --promote)
  // -------------------------------------------------------------------------
  if (shouldPromote) {
    section('Executing Promotion');

    const startTime = Date.now();
    const importerResults: ImporterProof[] = [];

    // Load or create graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = createEmptyContextGraph(companyId, company.name);
      info('Created new context graph');
    }

    // Get importers to run
    const importersToRun = importerArg
      ? [getImporterById(importerArg)].filter(Boolean)
      : importers.filter(imp => importerChecks.includes(imp.id));

    if (importersToRun.length === 0) {
      error(`No matching importer found: ${importerArg || '(none with data)'}`);
      process.exit(1);
    }

    log(`\n  Running ${importersToRun.length} importer(s)...\n`);

    let totalFieldsWritten = 0;
    let totalErrors = 0;

    for (const importer of importersToRun) {
      if (!importer) continue;

      log(`  ${colors.bright}${importer.label}${colors.reset} (${importer.id})`);

      const importerProof: ImporterProof = {
        importerId: importer.id,
        importerLabel: importer.label,
        extractionPath: null,
        sourceRunIds: [],
        rawKeysFound: 0,
        candidateWrites: [],
        fieldsWritten: 0,
        fieldsSkipped: 0,
        skippedReasons: {},
        writtenKeys: [],
        errors: [],
      };

      try {
        // Run importer with proof collection
        const result = await runImporterWithProof(
          importer,
          graph,
          companyId,
          proof.domain,
          importerProof,
          debugMode
        );

        // Use actual fieldsUpdated from importer (not node count delta which misses updates)
        importerProof.fieldsWritten = result.fieldsUpdated;

        // Capture written keys (limit to 50 for readability)
        if (result.updatedPaths && result.updatedPaths.length > 0) {
          importerProof.writtenKeys = result.updatedPaths.slice(0, 50);
        }

        importerProof.sourceRunIds = result.sourceRunIds;
        importerProof.errors = result.errors;

        totalFieldsWritten += importerProof.fieldsWritten;
        totalErrors += result.errors.length;

        if (importerProof.fieldsWritten > 0) {
          success(`Wrote ${importerProof.fieldsWritten} fields`);
        } else {
          warn(`0 fields written`);
        }

        if (importerProof.skippedReasons && Object.keys(importerProof.skippedReasons).length > 0) {
          log(`    ${colors.dim}Skipped reasons:${colors.reset}`);
          for (const [reason, count] of Object.entries(importerProof.skippedReasons)) {
            log(`      ${colors.yellow}${reason}${colors.reset}: ${count}`);
          }
        }

        if (result.errors.length > 0) {
          error(`${result.errors.length} error(s)`);
          for (const err of result.errors.slice(0, 3)) {
            log(`      ${colors.red}${truncate(err)}${colors.reset}`);
          }
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        importerProof.errors.push(errMsg);
        totalErrors++;
        error(`Exception: ${truncate(errMsg)}`);
      }

      importerResults.push(importerProof);
      log('');
    }

    // Save graph if fields were written
    if (totalFieldsWritten > 0) {
      await saveContextGraph(graph, 'proof_promotion');
      success(`Saved graph with ${totalFieldsWritten} new fields`);
    }

    const durationMs = Date.now() - startTime;

    proof.promotion = {
      executed: true,
      durationMs,
      totalFieldsWritten,
      totalErrors,
      importerResults,
    };

    // -------------------------------------------------------------------------
    // After Snapshot
    // -------------------------------------------------------------------------
    section('After Snapshot');

    const graphAfter = await loadContextGraph(companyId);
    const completenessAfterRaw = graphAfter ? calculateCompleteness(graphAfter) : 0;
    const completenessAfter = Math.round(completenessAfterRaw * 100) / 100;
    const nodeCountAfter = graphAfter ? countGraphNodes(graphAfter) : 0;
    const populatedDomainsAfter = graphAfter ? getPopulatedDomains(graphAfter) : [];

    proof.after = {
      completeness: completenessAfter,
      nodeCount: nodeCountAfter,
      populatedDomains: populatedDomainsAfter,
      completenessDelta: Math.round((completenessAfter - completenessBefore) * 100) / 100,
      nodeCountDelta: nodeCountAfter - nodeCountBefore,
    };

    kvLine('Completeness', `${completenessAfter}% (${proof.after.completenessDelta >= 0 ? '+' : ''}${proof.after.completenessDelta})`);
    kvLine('Node Count', `${nodeCountAfter} (${proof.after.nodeCountDelta >= 0 ? '+' : ''}${proof.after.nodeCountDelta})`);
    kvLine('Populated Domains', populatedDomainsAfter.join(', ') || '(none)');

    // -------------------------------------------------------------------------
    // UI Visibility Check
    // -------------------------------------------------------------------------
    section('UI Visibility Check');

    // Re-load graph using the same function the UI uses
    const uiGraph = await loadContextGraph(companyId);
    const uiNodeCount = uiGraph ? countGraphNodes(uiGraph) : 0;
    const uiKeys = uiGraph ? getPopulatedFieldKeys(uiGraph).slice(0, 20) : [];

    proof.uiCheck = {
      loadedFieldCount: uiNodeCount,
      loadedKeys: uiKeys,
      mismatch: false,
    };

    kvLine('UI Loaded Field Count', uiNodeCount);
    if (uiKeys.length > 0) {
      log(`  ${colors.dim}First 20 keys:${colors.reset}`);
      for (const key of uiKeys) {
        log(`    ${colors.dim}•${colors.reset} ${key}`);
      }
    }

    if (totalFieldsWritten > 0 && uiNodeCount === nodeCountBefore) {
      proof.uiCheck.mismatch = true;
      proof.uiCheck.mismatchReason = 'Fields written but UI shows no change';
      error('MISMATCH: Fields were written but UI load shows no change!');
      log('  This indicates a read path issue - the UI may be reading from a different source.');
    } else if (uiNodeCount !== nodeCountAfter) {
      proof.uiCheck.mismatch = true;
      proof.uiCheck.mismatchReason = `UI count (${uiNodeCount}) differs from expected (${nodeCountAfter})`;
      warn(`UI count differs: expected ${nodeCountAfter}, got ${uiNodeCount}`);
    } else {
      success('UI visibility matches persisted graph');
    }

    // -------------------------------------------------------------------------
    // Diagnosis
    // -------------------------------------------------------------------------
    header('DIAGNOSIS');

    if (hasRawData && totalFieldsWritten === 0) {
      proof.diagnosis = 'RAW_DATA_EXISTS_BUT_NO_FIELDS_WRITTEN';
      proof.exitCode = 1;
      error('FAILURE: Raw data exists but 0 fields were written');
      log('');
      log(`${colors.yellow}Possible causes:${colors.reset}`);
      log('  1. Domain Authority blocking - source not authorized for domain');
      log('  2. Source Priority blocking - existing higher-priority source');
      log('  3. Human Confirmed blocking - fields locked by user');
      log('  4. Empty Value filtering - extracted values are null/empty');
      log('  5. Extraction path issue - wrong JSON path in raw data');
      log('');
      log(`${colors.cyan}Next steps:${colors.reset}`);
      log('  - Check importer proof details above for skip reasons');
      log('  - Run with DEBUG_CONTEXT_PROOF=1 for verbose output');
      log('  - Check lib/os/context/domainAuthority.ts for source permissions');
    } else if (proof.uiCheck?.mismatch) {
      proof.diagnosis = 'WRITE_SUCCESS_BUT_UI_MISMATCH';
      proof.exitCode = 1;
      error('FAILURE: Writes succeeded but UI shows different data');
      log('');
      log(`${colors.yellow}Possible causes:${colors.reset}`);
      log('  1. Storage read/write asymmetry');
      log('  2. Graph compression stripping fields');
      log('  3. Different record being loaded');
    } else if (totalFieldsWritten > 0) {
      proof.diagnosis = 'SUCCESS';
      proof.exitCode = 0;
      success(`SUCCESS: Promoted ${totalFieldsWritten} fields`);
      log(`  Completeness: ${completenessBefore}% → ${completenessAfter}%`);
    } else {
      proof.diagnosis = 'NO_ACTION_NEEDED';
      proof.exitCode = 0;
      info('No new fields to promote (may already be up to date)');
    }
  } else {
    // Inspect only mode
    proof.diagnosis = hasRawData && importerChecks.length > 0
      ? 'READY_FOR_PROMOTION'
      : 'NO_PROMOTABLE_DATA';
    proof.exitCode = 0;

    header('INSPECTION COMPLETE');
    if (hasRawData && importerChecks.length > 0) {
      success(`${importerChecks.length} importer(s) have data ready to promote`);
      log(`\nRun with ${colors.cyan}--promote${colors.reset} to execute promotion.`);
    } else {
      info('No promotable data found');
    }
  }

  printFinalPacket(proof as ProofPacket);
  process.exit(proof.exitCode);
}

// ============================================================================
// Helper Functions
// ============================================================================

function countGraphNodes(graph: any): number {
  let count = 0;

  function walk(obj: unknown, depth = 0): void {
    if (depth > 10 || !obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) return;

    const record = obj as Record<string, unknown>;
    if ('value' in record && 'provenance' in record) {
      if (record.value !== null && record.value !== undefined) {
        if (!(Array.isArray(record.value) && record.value.length === 0)) {
          count++;
        }
      }
    } else {
      Object.values(record).forEach(v => walk(v, depth + 1));
    }
  }

  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
    'budgetOps', 'operationalConstraints', 'historyRefs', 'social',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      walk(graph[domain]);
    }
  }

  return count;
}

function getPopulatedDomains(graph: any): string[] {
  const populated: string[] = [];
  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
  ];

  for (const domain of domains) {
    if (graph[domain]) {
      let hasContent = false;
      const walk = (obj: any): void => {
        if (!obj || typeof obj !== 'object') return;
        if ('value' in obj && obj.value !== null && obj.value !== undefined) {
          if (!(Array.isArray(obj.value) && obj.value.length === 0)) {
            hasContent = true;
          }
        } else if (!Array.isArray(obj)) {
          Object.values(obj).forEach(walk);
        }
      };
      walk(graph[domain]);
      if (hasContent) populated.push(domain);
    }
  }

  return populated;
}

function getPopulatedFieldKeys(graph: any): string[] {
  const keys: string[] = [];
  const domains = [
    'identity', 'brand', 'objectives', 'audience', 'productOffer',
    'digitalInfra', 'website', 'content', 'seo', 'ops',
    'performanceMedia', 'historical', 'creative', 'competitive',
  ];

  for (const domain of domains) {
    if (graph[domain] && typeof graph[domain] === 'object') {
      for (const [field, value] of Object.entries(graph[domain])) {
        if (value && typeof value === 'object' && 'value' in value) {
          const fieldData = value as { value: unknown };
          if (fieldData.value !== null && fieldData.value !== undefined) {
            if (!(Array.isArray(fieldData.value) && fieldData.value.length === 0)) {
              keys.push(`${domain}.${field}`);
            }
          }
        }
      }
    }
  }

  return keys;
}

async function runImporterWithProof(
  importer: any,
  graph: any,
  companyId: string,
  domain: string,
  proof: ImporterProof,
  debugMode: boolean
): Promise<{ sourceRunIds: string[]; errors: string[]; fieldsUpdated: number; updatedPaths: string[] }> {
  // Enable debug logging and proof mode for this importer
  if (debugMode) {
    process.env.DEBUG_CONTEXT_HYDRATION = '1';
  }
  // Always enable proof mode for the proof script
  process.env.DEBUG_CONTEXT_PROOF = '1';

  // Wrap the graph with a proxy to track writes
  const writeTracker = {
    attempted: 0,
    succeeded: 0,
    skipped: new Map<string, number>(),
  };

  // Intercept setFieldUntyped calls by patching the mutate module
  const { setFieldUntypedWithResult, setDomainFieldsWithResult } = await import('@/lib/contextGraph/mutate');

  // Store original graph methods
  const originalMeta = { ...graph.meta };

  // Run the importer
  const result = await importer.importAll(graph, companyId, domain);

  proof.sourceRunIds = result.sourceRunIds || [];
  proof.errors = result.errors || [];

  // Analyze what happened by comparing graph changes
  // Since we can't easily intercept all writes, we analyze the result
  proof.fieldsWritten = result.fieldsUpdated || 0;
  proof.fieldsSkipped = (result as any).skippedCount || 0;

  // Extract proof data from result.proof (ImportProof structure)
  const importProof = result.proof;
  if (importProof) {
    // Capture extraction path
    if (importProof.extractionPath) {
      proof.extractionPath = importProof.extractionPath;
    }

    // Capture raw keys found
    if (importProof.rawKeysFound) {
      proof.rawKeysFound = importProof.rawKeysFound;
    }

    // Capture candidate writes (limit to 20 for readability)
    if (importProof.candidateWrites && importProof.candidateWrites.length > 0) {
      proof.candidateWrites = importProof.candidateWrites.slice(0, 20);
    }

    // Capture dropped reasons
    if (importProof.droppedByReason) {
      proof.skippedReasons = {
        emptyValue: importProof.droppedByReason.emptyValue,
        domainAuthority: importProof.droppedByReason.domainAuthority,
        wrongDomainForField: importProof.droppedByReason.wrongDomainForField || 0,
        sourcePriority: importProof.droppedByReason.sourcePriority,
        humanConfirmed: importProof.droppedByReason.humanConfirmed,
        notCanonical: importProof.droppedByReason.notCanonical,
        other: importProof.droppedByReason.other,
      };
      const skipValues = Object.values(importProof.droppedByReason) as number[];
      proof.fieldsSkipped = skipValues.reduce((a, b) => a + (b || 0), 0);
    }

    // Capture offending fields for debugging
    if (importProof.offendingFields && importProof.offendingFields.length > 0) {
      (proof as any).offendingFields = importProof.offendingFields;
    }
  }

  // Legacy: If the importer returned skip reasons directly, capture them
  if ((result as any).skipReasons) {
    proof.skippedReasons = (result as any).skipReasons;
  }

  // Legacy: Capture candidate writes if available directly
  if ((result as any).candidateWrites) {
    proof.candidateWrites = (result as any).candidateWrites.slice(0, 20);
  }

  // Legacy: Capture extraction path if available directly
  if ((result as any).extractionPath) {
    proof.extractionPath = (result as any).extractionPath;
  }

  return {
    sourceRunIds: result.sourceRunIds || [],
    errors: result.errors || [],
    fieldsUpdated: result.fieldsUpdated || 0,
    updatedPaths: result.updatedPaths || [],
  };
}

function printFinalPacket(proof: ProofPacket) {
  section('Proof Packet JSON');
  log('');
  log(JSON.stringify(proof, null, 2));
}

// ============================================================================
// Run
// ============================================================================

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
