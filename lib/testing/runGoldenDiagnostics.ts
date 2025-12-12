// lib/testing/runGoldenDiagnostics.ts
// Golden Test Runner - Executes diagnostics for all golden companies
//
// Usage:
// - Call via API route: POST /api/internal/testing/run-golden
// - Or import and call runGoldenDiagnostics() directly

import { GOLDEN_COMPANIES, type GoldenCompany } from './goldenCompanies';
import { findCompanyByDomain, createCompany, normalizeDomain } from '@/lib/airtable/companies';
import { runCompetitionV3 } from '@/lib/competition-v3';
import { runCompetitionV4, shouldRunV4, type CompetitionV4Result } from '@/lib/competition-v4';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { classifyCompanyArchetypeAndVertical } from '@/lib/competition-v3/verticalClassifier';
import type { VerticalCategory, CompanyArchetype } from '@/lib/competition-v3/types';

// ============================================================================
// Result Types
// ============================================================================

export interface GoldenTestResult {
  /** Golden company ID */
  goldenId: string;

  /** Company name */
  company: string;

  /** Airtable company ID (created or found) */
  companyId: string;

  /** Detected archetype */
  archetype: CompanyArchetype;

  /** Expected archetype */
  expectedArchetype: CompanyArchetype;

  /** Archetype match */
  archetypeMatch: boolean;

  /** Detected vertical */
  vertical: VerticalCategory;

  /** Expected vertical */
  expectedVertical: VerticalCategory;

  /** Vertical match */
  verticalMatch: boolean;

  /** Top competitor domains (first 10) */
  topCompetitors: string[];

  /** Number of agency competitors found (should be 0 for non-agencies) */
  agencyCompetitorCount: number;

  /** Context summary present */
  contextSummaryPresent: boolean;

  /** Competition run ID */
  competitionRunId: string | null;

  /** Competition V4 result (if enabled) */
  v4Result?: {
    ran: boolean;
    status: string;
    category: string;
    validatedCount: number;
    removedCount: number;
    topCompetitors: string[];
  };

  /** Any error that occurred */
  error: string | null;

  /** Duration in ms */
  durationMs: number;

  /** Pass/Fail status */
  status: 'pass' | 'fail' | 'error';

  /** Failure reasons */
  failureReasons: string[];
}

export interface GoldenRunSummary {
  /** Total companies tested */
  total: number;

  /** Passed tests */
  passed: number;

  /** Failed tests */
  failed: number;

  /** Errored tests */
  errored: number;

  /** Total duration */
  totalDurationMs: number;

  /** Individual results */
  results: GoldenTestResult[];

  /** Overall pass/fail */
  overallStatus: 'pass' | 'fail';

  /** Summary of failures */
  failureSummary: string[];
}

// ============================================================================
// Agency Detection (for validation)
// ============================================================================

const AGENCY_KEYWORDS = [
  'marketing agency', 'digital agency', 'creative agency',
  'seo agency', 'ppc agency', 'advertising agency',
  'web agency', 'design agency', 'branding agency',
  'content agency', 'media agency', 'growth agency',
  'marketing firm', 'marketing company', 'consultancy',
];

function isAgencyDomain(domain: string, name: string): boolean {
  const text = `${domain} ${name}`.toLowerCase();
  return AGENCY_KEYWORDS.some(kw => text.includes(kw)) || domain.includes('agency');
}

// ============================================================================
// Single Company Test
// ============================================================================

async function runSingleGoldenTest(golden: GoldenCompany): Promise<GoldenTestResult> {
  const startTime = Date.now();
  const failureReasons: string[] = [];

  console.log(`\n[golden-test] ========================================`);
  console.log(`[golden-test] Testing: ${golden.name}`);
  console.log(`[golden-test] Domain: ${golden.domain}`);
  console.log(`[golden-test] Expected: ${golden.expectedVertical} / ${golden.expectedArchetype}`);
  console.log(`[golden-test] ========================================\n`);

  try {
    // Step 1: Find or create company
    let company = await findCompanyByDomain(golden.domain);

    if (!company) {
      console.log(`[golden-test] Creating company for: ${golden.domain}`);
      company = await createCompany({
        name: golden.name,
        domain: normalizeDomain(golden.domain),
        website: golden.website,
      });
    }

    if (!company) {
      throw new Error(`Failed to find or create company for ${golden.domain}`);
    }

    const companyId = company.id;
    console.log(`[golden-test] Company ID: ${companyId}`);

    // Step 2: Run competition analysis (this also runs vertical detection)
    console.log(`[golden-test] Running Competition V3...`);
    const competitionResult = await runCompetitionV3({ companyId });

    // Step 2b: Run Competition V4 if enabled
    let v4Result: CompetitionV4Result | null = null;
    if (shouldRunV4()) {
      console.log(`[golden-test] Running Competition V4...`);
      try {
        v4Result = await runCompetitionV4({
          companyId,
          companyName: golden.name,
          domain: golden.domain,
        });
        console.log(`[golden-test] V4 category: ${v4Result.category.category_name}`);
        console.log(`[golden-test] V4 validated: ${v4Result.competitors.validated.length}, removed: ${v4Result.competitors.removed.length}`);
      } catch (v4Error) {
        console.error(`[golden-test] V4 failed:`, v4Error);
      }
    }

    // Step 3: Load context graph for classification check
    const graph = await loadContextGraph(companyId);

    // Access domains safely from the graph
    const identity = (graph as any)?.identity || {};
    const productOffer = (graph as any)?.productOffer || {};
    const audience = (graph as any)?.audience || {};

    // Build partial context for classification
    const partialContext = {
      businessName: identity.businessName?.value || golden.name,
      domain: golden.domain,
      industry: identity.industry?.value || null,
      businessModel: identity.businessModel?.value || null,
      icpDescription: audience.targetAudience?.value || null,
      primaryOffers: productOffer.coreServices?.value || [],
      valueProposition: null,
      differentiators: [],
    };

    // Get classification
    const classification = classifyCompanyArchetypeAndVertical(partialContext);
    const detectedArchetype = classification.archetype.archetype;
    const detectedVertical = classification.vertical.verticalCategory;

    // Step 4: Analyze competitors for agency bias
    const competitors = competitionResult.competitors || [];
    const topCompetitors = competitors.slice(0, 10).map(c => c.domain || c.name);

    // Count agency competitors
    const agencyCompetitorCount = competitors.filter(c =>
      isAgencyDomain(c.domain || '', c.name)
    ).length;

    // Step 5: Check context
    const contextSummaryPresent = !!(graph?.identity?.businessName?.value);

    // Step 6: Validate results
    const archetypeMatch = detectedArchetype === golden.expectedArchetype;
    const verticalMatch = detectedVertical === golden.expectedVertical;

    // Check for agency bias (non-agency companies should have few/no agency competitors)
    const isExpectedAgency = golden.expectedArchetype === 'agency';
    const hasAgencyBias = !isExpectedAgency && agencyCompetitorCount > 2;

    if (!archetypeMatch) {
      failureReasons.push(`Archetype mismatch: got "${detectedArchetype}", expected "${golden.expectedArchetype}"`);
    }

    if (!verticalMatch) {
      failureReasons.push(`Vertical mismatch: got "${detectedVertical}", expected "${golden.expectedVertical}"`);
    }

    if (hasAgencyBias) {
      failureReasons.push(`Agency bias detected: ${agencyCompetitorCount} agency competitors for non-agency company`);
    }

    if (competitors.length === 0) {
      failureReasons.push('No competitors found');
    }

    const status = failureReasons.length === 0 ? 'pass' : 'fail';
    const durationMs = Date.now() - startTime;

    console.log(`\n[golden-test] Result: ${status.toUpperCase()}`);
    console.log(`[golden-test] Archetype: ${detectedArchetype} (expected: ${golden.expectedArchetype}) ${archetypeMatch ? '✓' : '✗'}`);
    console.log(`[golden-test] Vertical: ${detectedVertical} (expected: ${golden.expectedVertical}) ${verticalMatch ? '✓' : '✗'}`);
    console.log(`[golden-test] Competitors: ${competitors.length} (${agencyCompetitorCount} agencies)`);
    if (v4Result) {
      console.log(`[golden-test] V4 Category: ${v4Result.category.category_name}`);
      console.log(`[golden-test] V4 Competitors: ${v4Result.competitors.validated.length} validated, ${v4Result.competitors.removed.length} removed`);
    }
    console.log(`[golden-test] Duration: ${durationMs}ms`);
    if (failureReasons.length > 0) {
      console.log(`[golden-test] Failures: ${failureReasons.join('; ')}`);
    }

    return {
      goldenId: golden.id,
      company: golden.name,
      companyId,
      archetype: detectedArchetype,
      expectedArchetype: golden.expectedArchetype,
      archetypeMatch,
      vertical: detectedVertical,
      expectedVertical: golden.expectedVertical,
      verticalMatch,
      topCompetitors,
      agencyCompetitorCount,
      contextSummaryPresent,
      competitionRunId: competitionResult.run.id,
      v4Result: v4Result ? {
        ran: true,
        status: v4Result.execution.status,
        category: v4Result.category.category_name,
        validatedCount: v4Result.competitors.validated.length,
        removedCount: v4Result.competitors.removed.length,
        topCompetitors: v4Result.competitors.validated.slice(0, 5).map(c => c.domain),
      } : undefined,
      error: null,
      durationMs,
      status,
      failureReasons,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    console.error(`[golden-test] ERROR: ${errorMsg}`);

    return {
      goldenId: golden.id,
      company: golden.name,
      companyId: '',
      archetype: 'unknown',
      expectedArchetype: golden.expectedArchetype,
      archetypeMatch: false,
      vertical: 'unknown',
      expectedVertical: golden.expectedVertical,
      verticalMatch: false,
      topCompetitors: [],
      agencyCompetitorCount: 0,
      contextSummaryPresent: false,
      competitionRunId: null,
      error: errorMsg,
      durationMs,
      status: 'error',
      failureReasons: [`Error: ${errorMsg}`],
    };
  }
}

// ============================================================================
// Full Golden Test Run
// ============================================================================

export async function runGoldenDiagnostics(
  options: {
    /** Specific golden IDs to run (default: all) */
    goldenIds?: string[];
    /** Run in parallel (default: false for clearer logs) */
    parallel?: boolean;
  } = {}
): Promise<GoldenRunSummary> {
  const { goldenIds, parallel = false } = options;

  const companies = goldenIds
    ? GOLDEN_COMPANIES.filter(c => goldenIds.includes(c.id))
    : GOLDEN_COMPANIES;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[GOLDEN TEST] Starting Golden Test Run`);
  console.log(`[GOLDEN TEST] Companies: ${companies.length}`);
  console.log(`[GOLDEN TEST] Mode: ${parallel ? 'parallel' : 'sequential'}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  let results: GoldenTestResult[];

  if (parallel) {
    results = await Promise.all(companies.map(runSingleGoldenTest));
  } else {
    results = [];
    for (const company of companies) {
      const result = await runSingleGoldenTest(company);
      results.push(result);
    }
  }

  const totalDurationMs = Date.now() - startTime;

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errored = results.filter(r => r.status === 'error').length;

  const failureSummary = results
    .filter(r => r.status !== 'pass')
    .map(r => `${r.company}: ${r.failureReasons.join('; ')}`);

  const overallStatus = failed === 0 && errored === 0 ? 'pass' : 'fail';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[GOLDEN TEST] Run Complete`);
  console.log(`[GOLDEN TEST] Results: ${passed}/${companies.length} passed`);
  console.log(`[GOLDEN TEST] Failed: ${failed}, Errored: ${errored}`);
  console.log(`[GOLDEN TEST] Total Duration: ${(totalDurationMs / 1000).toFixed(1)}s`);
  console.log(`[GOLDEN TEST] Overall: ${overallStatus.toUpperCase()}`);
  if (failureSummary.length > 0) {
    console.log(`\n[GOLDEN TEST] Failure Summary:`);
    failureSummary.forEach(f => console.log(`  - ${f}`));
  }
  console.log(`${'='.repeat(60)}\n`);

  return {
    total: companies.length,
    passed,
    failed,
    errored,
    totalDurationMs,
    results,
    overallStatus,
    failureSummary,
  };
}

// ============================================================================
// Quick Summary Output
// ============================================================================

export function formatGoldenSummary(summary: GoldenRunSummary): string {
  const lines: string[] = [
    '┌─────────────────────────────────────────────────────────────┐',
    '│                    GOLDEN TEST RESULTS                      │',
    '├─────────────────────────────────────────────────────────────┤',
  ];

  for (const result of summary.results) {
    const statusIcon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '!';
    const archetypeIcon = result.archetypeMatch ? '✓' : '✗';
    const verticalIcon = result.verticalMatch ? '✓' : '✗';

    lines.push(`│ ${statusIcon} ${result.company.padEnd(40)} ${result.vertical.padEnd(15)} │`);
    lines.push(`│   Archetype: ${result.archetype.padEnd(20)} ${archetypeIcon}                   │`);
    lines.push(`│   Vertical: ${result.vertical.padEnd(20)} ${verticalIcon}                    │`);
    lines.push(`│   Competitors: ${result.topCompetitors.length} (${result.agencyCompetitorCount} agencies)                     │`);
    if (result.failureReasons.length > 0) {
      lines.push(`│   ⚠ ${result.failureReasons[0].substring(0, 50).padEnd(50)} │`);
    }
    lines.push('├─────────────────────────────────────────────────────────────┤');
  }

  lines.push(`│ TOTAL: ${summary.passed}/${summary.total} passed | ${summary.failed} failed | ${summary.errored} errors │`);
  lines.push(`│ STATUS: ${summary.overallStatus.toUpperCase().padEnd(50)} │`);
  lines.push('└─────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}
