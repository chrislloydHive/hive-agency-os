// scripts/run-golden-test.ts
// Golden Test Set Runner
//
// Runs Competition V4, Context generation, and Strategy generation
// for all golden companies and snapshots results.
//
// Usage: npx tsx scripts/run-golden-test.ts

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import { GOLDEN_COMPANIES, type GoldenCompany } from '../lib/testing/goldenCompanies';
import { runCompetitionV4 } from '../lib/competition-v4';
import type { CompetitionV4Result } from '../lib/competition-v4/types';

// ============================================================================
// Types
// ============================================================================

interface GoldenTestResult {
  company: GoldenCompany;
  v4Result: CompetitionV4Result | null;
  categoryMatch: boolean;
  topCompetitors: string[];
  hasAgencyCompetitor: boolean;
  error?: string;
  durationMs: number;
}

interface GoldenTestSummary {
  timestamp: string;
  totalCompanies: number;
  successful: number;
  failed: number;
  categoryMatchRate: number;
  agencyLeakRate: number;
  results: GoldenTestResult[];
}

// ============================================================================
// Test Runner
// ============================================================================

async function runGoldenTest(company: GoldenCompany): Promise<GoldenTestResult> {
  const startTime = Date.now();
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Testing: ${company.name}`);
  console.log(`Domain: ${company.domain}`);
  console.log(`Expected: ${company.expectedVertical} / ${company.expectedArchetype}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    // Run Competition V4
    const v4Result = await runCompetitionV4({
      companyId: company.companyId || `golden-${company.id}`,
      companyName: company.name,
      domain: company.domain,
    });

    const durationMs = Date.now() - startTime;

    // Analyze results
    const categoryName = v4Result.category.category_name.toLowerCase();
    const topCompetitors = v4Result.competitors.validated.slice(0, 5).map(c => c.domain);

    // Check for agency competitor leak (should not happen for non-agencies)
    const agencyKeywords = ['agency', 'marketing', 'seo', 'digital', 'advertising', 'consulting'];
    const hasAgencyCompetitor = company.expectedArchetype !== 'agency' &&
      topCompetitors.some(domain =>
        agencyKeywords.some(kw => domain.toLowerCase().includes(kw))
      );

    // Check if category matches expectation
    const categoryMatch = checkCategoryMatch(categoryName, company.expectedVertical, company.expectedArchetype);

    console.log(`\n✅ V4 Complete in ${durationMs}ms`);
    console.log(`   Category: ${v4Result.category.category_name}`);
    console.log(`   Top Competitors: ${topCompetitors.join(', ') || 'None'}`);
    console.log(`   Category Match: ${categoryMatch ? '✓' : '✗'}`);
    console.log(`   Agency Leak: ${hasAgencyCompetitor ? '⚠️ YES' : '✓ No'}`);

    return {
      company,
      v4Result,
      categoryMatch,
      topCompetitors,
      hasAgencyCompetitor,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`\n❌ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      company,
      v4Result: null,
      categoryMatch: false,
      topCompetitors: [],
      hasAgencyCompetitor: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs,
    };
  }
}

function checkCategoryMatch(
  categoryName: string,
  expectedVertical: string,
  expectedArchetype: string
): boolean {
  // Map expected values to keywords that should appear in category
  const verticalKeywords: Record<string, string[]> = {
    'marketplace': ['marketplace', 'platform', 'two-sided'],
    'financial-services': ['bank', 'financial', 'banking', 'credit'],
    'software': ['software', 'saas', 'scheduling', 'platform', 'tool'],
    'automotive': ['automotive', 'car', 'vehicle', 'auto'],
    'services': ['service', 'agency', 'consulting', 'marketing'],
  };

  const archetypeKeywords: Record<string, string[]> = {
    'two_sided_marketplace': ['marketplace', 'platform', 'connect'],
    'local_service': ['local', 'service', 'shop', 'store'],
    'saas': ['saas', 'software', 'platform', 'tool'],
    'agency': ['agency', 'marketing', 'consulting', 'service'],
  };

  const verticalKws = verticalKeywords[expectedVertical] || [];
  const archetypeKws = archetypeKeywords[expectedArchetype] || [];

  const hasVerticalMatch = verticalKws.some(kw => categoryName.includes(kw));
  const hasArchetypeMatch = archetypeKws.some(kw => categoryName.includes(kw));

  return hasVerticalMatch || hasArchetypeMatch;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('═'.repeat(60));
  console.log('GOLDEN TEST SET RUNNER');
  console.log(`Running at: ${new Date().toISOString()}`);
  console.log(`Companies: ${GOLDEN_COMPANIES.length}`);
  console.log('═'.repeat(60));

  const results: GoldenTestResult[] = [];

  for (const company of GOLDEN_COMPANIES) {
    const result = await runGoldenTest(company);
    results.push(result);

    // Small delay between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary
  const successful = results.filter(r => !r.error).length;
  const categoryMatches = results.filter(r => r.categoryMatch).length;
  const agencyLeaks = results.filter(r => r.hasAgencyCompetitor).length;

  const summary: GoldenTestSummary = {
    timestamp: new Date().toISOString(),
    totalCompanies: GOLDEN_COMPANIES.length,
    successful,
    failed: GOLDEN_COMPANIES.length - successful,
    categoryMatchRate: Math.round((categoryMatches / GOLDEN_COMPANIES.length) * 100),
    agencyLeakRate: Math.round((agencyLeaks / GOLDEN_COMPANIES.length) * 100),
    results,
  };

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total: ${summary.totalCompanies}`);
  console.log(`Successful: ${summary.successful}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Category Match Rate: ${summary.categoryMatchRate}%`);
  console.log(`Agency Leak Rate: ${summary.agencyLeakRate}% (lower is better)`);

  console.log('\n' + '─'.repeat(60));
  console.log('RESULTS BY COMPANY');
  console.log('─'.repeat(60));

  for (const result of results) {
    const status = result.error ? '❌' : (result.categoryMatch ? '✅' : '⚠️');
    const category = result.v4Result?.category.category_name || 'N/A';
    const competitors = result.topCompetitors.slice(0, 3).join(', ') || 'None';

    console.log(`${status} ${result.company.name}`);
    console.log(`   Category: ${category}`);
    console.log(`   Top 3: ${competitors}`);
    if (result.hasAgencyCompetitor) {
      console.log(`   ⚠️ AGENCY LEAK DETECTED`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Write snapshot to file
  const snapshotPath = `.cache/golden-test-${Date.now()}.json`;
  const fs = await import('fs/promises');
  await fs.mkdir('.cache', { recursive: true });
  await fs.writeFile(snapshotPath, JSON.stringify(summary, null, 2));
  console.log(`\n📁 Snapshot saved to: ${snapshotPath}`);
}

main().catch(console.error);
