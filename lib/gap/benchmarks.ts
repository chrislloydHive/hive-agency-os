// lib/gap/benchmarks.ts
// Benchmarking logic for "How You Stack Up" feature
// Computes category-based benchmarks (median, top quartile, percentiles) across all GAP runs

import { getAirtableConfig } from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

/**
 * Benchmark summary for a single metric (e.g., overall, website, brand)
 */
export interface MetricBenchmark {
  value: number | null;        // Current run's value
  median: number | null;       // Median across peer set
  topQuartile: number | null;  // 75th percentile
  percentile: number | null;   // 0–100 (where this value ranks)
}

/**
 * Cohort type indicates what level of filtering was used
 * - exact: Matched on full cohort (e.g., "SaaS | Tier 1")
 * - broaderCategory: Matched on company type only (e.g., all "SaaS" regardless of tier)
 * - global: Used all runs (fallback when not enough peers)
 */
export type CohortType = 'exact' | 'broaderCategory' | 'global';

/**
 * Complete benchmark summary for a GAP run
 */
export interface GapBenchmarkSummary {
  peerCount: number;                 // Number of peers in the comparison set
  category: string | null;           // Legacy field for backward compatibility
  benchmarkCohortUsed: string | null; // The cohort actually used for comparison
  cohortType: CohortType;            // What level of fallback was used

  overall: MetricBenchmark;
  website: MetricBenchmark;
  brand: MetricBenchmark;
  content: MetricBenchmark;
  seo: MetricBenchmark;
  authority: MetricBenchmark;
  digitalFootprint: MetricBenchmark;
}

/**
 * Calculate median from an array of numbers
 * Returns null if fewer than 3 values
 */
export function median(values: number[]): number | null {
  if (values.length < 3) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate top quartile (75th percentile) from an array of numbers
 * Returns null if fewer than 3 values
 */
export function topQuartile(values: number[]): number | null {
  if (values.length < 3) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.75) - 1;

  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Calculate percentile rank for a specific value within an array
 * Returns a number from 0–100 indicating how this value ranks
 * Returns null if value is null or fewer than 3 values in array
 *
 * @param values - Array of peer values
 * @param value - The value to rank
 * @returns Percentile (0-100) or null
 */
export function percentile(values: number[], value: number | null): number | null {
  if (value === null || value === undefined) return null;
  if (values.length < 3) return null;

  // Count how many values are less than or equal to this value
  const countLessOrEqual = values.filter(v => v <= value).length;

  // Calculate percentile (0-100)
  const percentileRank = (countLessOrEqual / values.length) * 100;

  return Math.round(percentileRank);
}

/**
 * Compute benchmark for a single metric
 */
function computeMetricBenchmark(
  currentValue: number | null,
  peerValues: number[]
): MetricBenchmark {
  // If fewer than 3 peers, return nulls
  if (peerValues.length < 3) {
    return {
      value: currentValue,
      median: null,
      topQuartile: null,
      percentile: null,
    };
  }

  return {
    value: currentValue,
    median: median(peerValues),
    topQuartile: topQuartile(peerValues),
    percentile: percentile(peerValues, currentValue),
  };
}

/**
 * Fetch GAP runs from Airtable for benchmarking with cohort filtering
 *
 * @param cohortFilter - Benchmark cohort to filter by (e.g., "SaaS | Tier 1"), null for all runs
 * @param companyTypeFilter - Company type to filter by (e.g., "SaaS"), null to skip
 * @returns Array of Airtable records
 */
async function fetchGapRunsForBenchmarking(
  cohortFilter: string | null = null,
  companyTypeFilter: string | null = null
): Promise<any[]> {
  const config = getAirtableConfig();
  const tableName = AIRTABLE_TABLES.GAP_PLAN_RUN;

  // Build filter formula with cohort awareness
  let filterFormula = 'NOT({Archived})'; // Exclude archived runs

  if (cohortFilter) {
    // Filter by exact benchmark cohort
    filterFormula = `AND(${filterFormula}, {Benchmark Cohort} = "${cohortFilter}")`;
  } else if (companyTypeFilter) {
    // Filter by company type only (broader category)
    filterFormula = `AND(${filterFormula}, {Company Type} = "${companyTypeFilter}")`;
  }

  // Note: Digital Footprint Score field may not exist in older Airtable schemas
  // We'll try to fetch it, but handle it gracefully if missing
  const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
    tableName
  )}?filterByFormula=${encodeURIComponent(filterFormula)}&fields[]=Company ID&fields[]=Overall Score&fields[]=Website Score&fields[]=Brand Score&fields[]=Content Score&fields[]=SEO Score&fields[]=Authority Score&fields[]=Benchmark Cohort&fields[]=Company Type&fields[]=Tier`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result.records || [];
}

/**
 * Get benchmark summary for a specific GAP run with cohort-aware filtering
 *
 * Implements fallback sequence:
 * 1. Try exact cohort match (e.g., "SaaS | Tier 1")
 * 2. If < 10 peers, try broader category (e.g., all "SaaS" regardless of tier)
 * 3. If still < 10 peers, use global benchmark (all runs)
 *
 * @param gapRunId - The GAP run ID to benchmark
 * @returns Benchmark summary or null if run not found
 */
export async function getGapBenchmarksForRun(gapRunId: string): Promise<GapBenchmarkSummary | null> {
  try {
    console.log('[getGapBenchmarksForRun] Fetching benchmarks for:', gapRunId);

    // Fetch the current run to get its cohort and scores
    const config = getAirtableConfig();
    const tableName = AIRTABLE_TABLES.GAP_PLAN_RUN;

    // Determine if gapRunId is an Airtable record ID (starts with "rec") or a GAP ID
    const isAirtableRecordId = gapRunId.startsWith('rec');

    let currentRunUrl: string;
    if (isAirtableRecordId) {
      // Direct fetch by record ID
      currentRunUrl = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(tableName)}/${gapRunId}`;
    } else {
      // Fetch by searching for gapId in Data JSON field
      // This searches for the gapId anywhere in the JSON (e.g., "gapId":"GAP-xxx")
      currentRunUrl = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
        tableName
      )}?filterByFormula=${encodeURIComponent(`SEARCH("${gapRunId}", {Data JSON})`)}&maxRecords=1`;
    }

    console.log('[getGapBenchmarksForRun] Fetching from:', currentRunUrl);

    const currentRunResponse = await fetch(currentRunUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!currentRunResponse.ok) {
      console.error('[getGapBenchmarksForRun] Failed to fetch current run:', currentRunResponse.status);
      return null;
    }

    const currentRunResult = await currentRunResponse.json();

    // Handle direct record fetch vs. filtered list fetch
    let currentRun: any;
    if (isAirtableRecordId) {
      // Direct record fetch returns a single record object
      currentRun = currentRunResult.fields;
    } else {
      // Filtered fetch returns { records: [...] }
      const currentRunRecords = currentRunResult.records || [];
      if (currentRunRecords.length === 0) {
        console.error('[getGapBenchmarksForRun] Run not found:', gapRunId);
        return null;
      }
      currentRun = currentRunRecords[0].fields;
    }
    const benchmarkCohort = (currentRun['Benchmark Cohort'] as string) || null;
    const companyType = (currentRun['Company Type'] as string) || null;
    const category = (currentRun['Category'] as string) || null; // Legacy field

    console.log('[getGapBenchmarksForRun] Current run cohort data:', {
      benchmarkCohort,
      companyType,
      legacyCategory: category,
    });

    // Minimum peer threshold for each level
    const MIN_EXACT_COHORT_PEERS = 10;
    const MIN_BROADER_CATEGORY_PEERS = 10;

    let allRuns: any[] = [];
    let cohortType: CohortType = 'global';
    let cohortUsed: string | null = null;

    // 1. Try exact cohort match first
    if (benchmarkCohort) {
      console.log('[getGapBenchmarksForRun] Trying exact cohort:', benchmarkCohort);
      allRuns = await fetchGapRunsForBenchmarking(benchmarkCohort, null);
      console.log(`[getGapBenchmarksForRun] Exact cohort peers: ${allRuns.length}`);

      if (allRuns.length >= MIN_EXACT_COHORT_PEERS) {
        cohortType = 'exact';
        cohortUsed = benchmarkCohort;
        console.log('[getGapBenchmarksForRun] ✅ Using exact cohort');
      }
    }

    // 2. Fallback: Try broader category (same company type, any tier)
    if (cohortType === 'global' && companyType) {
      console.log('[getGapBenchmarksForRun] Exact cohort insufficient, trying broader category:', companyType);
      allRuns = await fetchGapRunsForBenchmarking(null, companyType);
      console.log(`[getGapBenchmarksForRun] Broader category peers: ${allRuns.length}`);

      if (allRuns.length >= MIN_BROADER_CATEGORY_PEERS) {
        cohortType = 'broaderCategory';
        cohortUsed = companyType;
        console.log('[getGapBenchmarksForRun] ✅ Using broader category');
      }
    }

    // 3. Final fallback: Use global benchmark (all runs)
    if (cohortType === 'global') {
      console.log('[getGapBenchmarksForRun] Broader category insufficient, using global benchmark');
      allRuns = await fetchGapRunsForBenchmarking(null, null);
      console.log(`[getGapBenchmarksForRun] Global peers: ${allRuns.length}`);
      cohortUsed = null;
      console.log('[getGapBenchmarksForRun] ✅ Using global benchmark');
    }

    console.log('[getGapBenchmarksForRun] Final peer set:', {
      cohortType,
      cohortUsed,
      peerCount: allRuns.length,
    });

    // Extract scores for each metric
    const overallScores: number[] = [];
    const websiteScores: number[] = [];
    const brandScores: number[] = [];
    const contentScores: number[] = [];
    const seoScores: number[] = [];
    const authorityScores: number[] = [];
    const digitalFootprintScores: number[] = [];

    allRuns.forEach(record => {
      const fields = record.fields;

      const overall = fields['Overall Score'] as number | undefined;
      const website = fields['Website Score'] as number | undefined;
      const brand = fields['Brand Score'] as number | undefined;
      const content = fields['Content Score'] as number | undefined;
      const seo = fields['SEO Score'] as number | undefined;
      const authority = fields['Authority Score'] as number | undefined;
      const digitalFootprint = fields['Digital Footprint'] as number | undefined;

      if (overall !== undefined && overall !== null) overallScores.push(overall);
      if (website !== undefined && website !== null) websiteScores.push(website);
      if (brand !== undefined && brand !== null) brandScores.push(brand);
      if (content !== undefined && content !== null) contentScores.push(content);
      if (seo !== undefined && seo !== null) seoScores.push(seo);
      if (authority !== undefined && authority !== null) authorityScores.push(authority);
      if (digitalFootprint !== undefined && digitalFootprint !== null) digitalFootprintScores.push(digitalFootprint);
    });

    console.log('[getGapBenchmarksForRun] Score counts:', {
      overall: overallScores.length,
      website: websiteScores.length,
      brand: brandScores.length,
      content: contentScores.length,
      seo: seoScores.length,
      authority: authorityScores.length,
      digitalFootprint: digitalFootprintScores.length,
    });

    // Get current run's scores
    const currentOverall = (currentRun['Overall Score'] as number) ?? null;
    const currentWebsite = (currentRun['Website Score'] as number) ?? null;
    const currentBrand = (currentRun['Brand Score'] as number) ?? null;
    const currentContent = (currentRun['Content Score'] as number) ?? null;
    const currentSeo = (currentRun['SEO Score'] as number) ?? null;
    const currentAuthority = (currentRun['Authority Score'] as number) ?? null;
    // Digital Footprint field may not exist in older Airtable schemas
    const currentDigitalFootprint = (currentRun['Digital Footprint'] as number | undefined) ?? null;

    // Compute benchmarks for each metric
    const summary: GapBenchmarkSummary = {
      peerCount: allRuns.length,
      category, // Legacy field for backward compatibility
      benchmarkCohortUsed: cohortUsed,
      cohortType,
      overall: computeMetricBenchmark(currentOverall, overallScores),
      website: computeMetricBenchmark(currentWebsite, websiteScores),
      brand: computeMetricBenchmark(currentBrand, brandScores),
      content: computeMetricBenchmark(currentContent, contentScores),
      seo: computeMetricBenchmark(currentSeo, seoScores),
      authority: computeMetricBenchmark(currentAuthority, authorityScores),
      digitalFootprint: computeMetricBenchmark(currentDigitalFootprint, digitalFootprintScores),
    };

    console.log('[getGapBenchmarksForRun] Benchmark summary:', {
      peerCount: summary.peerCount,
      category: summary.category,
      overallPercentile: summary.overall.percentile,
    });

    return summary;
  } catch (error) {
    console.error('[getGapBenchmarksForRun] Error:', error);
    return null;
  }
}
