// lib/hiveBrain/playbookEngine.ts
// Vertical Playbook Engine
//
// Generates and maintains living playbooks for each vertical.
// Playbooks are derived from:
// - Aggregated company data
// - Performance patterns
// - Best practices
// - Lessons learned
//
// They evolve over time as more data is collected.

import { loadContextGraph } from '../contextGraph/storage';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type { VerticalPlaybook, BenchmarkRange } from './types';

// ============================================================================
// Vertical Definitions
// ============================================================================

/**
 * Known verticals with their characteristics
 */
const VERTICAL_DEFINITIONS: Record<
  string,
  {
    name: string;
    keywords: string[];
    typicalChannels: string[];
    seasonalPeaks: number[]; // months (1-12)
    typicalCycle: 'impulse' | 'considered' | 'long_cycle';
  }
> = {
  home_services: {
    name: 'Home Services',
    keywords: ['hvac', 'plumbing', 'roofing', 'landscaping', 'cleaning'],
    typicalChannels: ['Google', 'Meta', 'LSA'],
    seasonalPeaks: [3, 4, 5, 9, 10], // Spring and Fall
    typicalCycle: 'considered',
  },
  ecommerce: {
    name: 'E-Commerce',
    keywords: ['retail', 'shop', 'store', 'products', 'commerce'],
    typicalChannels: ['Meta', 'Google Shopping', 'TikTok'],
    seasonalPeaks: [11, 12], // Holiday season
    typicalCycle: 'impulse',
  },
  b2b_saas: {
    name: 'B2B SaaS',
    keywords: ['software', 'saas', 'platform', 'enterprise', 'b2b'],
    typicalChannels: ['LinkedIn', 'Google', 'Meta'],
    seasonalPeaks: [1, 9], // New year and Q3 budget
    typicalCycle: 'long_cycle',
  },
  healthcare: {
    name: 'Healthcare',
    keywords: ['medical', 'health', 'clinic', 'doctor', 'dental'],
    typicalChannels: ['Google', 'Meta'],
    seasonalPeaks: [1, 9], // New year resolutions, back to school
    typicalCycle: 'considered',
  },
  professional_services: {
    name: 'Professional Services',
    keywords: ['legal', 'accounting', 'consulting', 'financial'],
    typicalChannels: ['Google', 'LinkedIn'],
    seasonalPeaks: [1, 2, 3, 4], // Tax season, new year planning
    typicalCycle: 'long_cycle',
  },
  real_estate: {
    name: 'Real Estate',
    keywords: ['real estate', 'property', 'homes', 'realty', 'broker'],
    typicalChannels: ['Meta', 'Google', 'Zillow'],
    seasonalPeaks: [3, 4, 5, 6], // Spring buying season
    typicalCycle: 'long_cycle',
  },
  fitness: {
    name: 'Fitness & Wellness',
    keywords: ['gym', 'fitness', 'wellness', 'yoga', 'training'],
    typicalChannels: ['Meta', 'TikTok', 'Google'],
    seasonalPeaks: [1, 9], // New year, back to school
    typicalCycle: 'considered',
  },
  education: {
    name: 'Education',
    keywords: ['school', 'university', 'learning', 'course', 'training'],
    typicalChannels: ['Meta', 'Google', 'LinkedIn'],
    seasonalPeaks: [1, 8, 9], // New year, back to school
    typicalCycle: 'long_cycle',
  },
};

// ============================================================================
// Data Aggregation
// ============================================================================

/**
 * Aggregate data for a vertical from multiple companies
 */
interface VerticalAggregation {
  verticalId: string;
  companies: Array<{
    companyId: string;
    companyName: string;
    metrics: {
      cpa?: number;
      roas?: number;
      conversionRate?: number;
    };
    topChannel: string | null;
    topCreatives: string[];
    valueProps: string[];
    painPoints: string[];
    audienceSegments: string[];
  }>;
  aggregatedMetrics: {
    avgCpa: number | null;
    avgRoas: number | null;
    cpaRange: [number, number] | null;
    roasRange: [number, number] | null;
  };
  channelDistribution: Record<string, number>;
  commonValueProps: string[];
  commonPainPoints: string[];
  topCreativePatterns: string[];
}

/**
 * Aggregate company data for a vertical
 */
async function aggregateVerticalData(
  verticalId: string,
  companyIds: string[]
): Promise<VerticalAggregation> {
  const companies: VerticalAggregation['companies'] = [];

  for (const companyId of companyIds) {
    const graph = await loadContextGraph(companyId);
    if (!graph) continue;

    // Check if company matches vertical (by industry)
    const industry = graph.identity.industry.value?.toLowerCase() ?? '';
    const verticalDef = VERTICAL_DEFINITIONS[verticalId];

    if (!verticalDef) continue;

    const matchesVertical = verticalDef.keywords.some(
      (kw) => industry.includes(kw)
    );

    if (!matchesVertical && industry !== verticalId) continue;

    companies.push({
      companyId: graph.companyId,
      companyName: graph.companyName,
      metrics: {
        cpa: graph.performanceMedia.blendedCpa?.value as number | undefined,
        roas: graph.performanceMedia.blendedRoas?.value as number | undefined,
      },
      topChannel: graph.performanceMedia.topPerformingChannel.value as string | null,
      topCreatives: graph.performanceMedia.topCreatives.value ?? [],
      valueProps: graph.brand.valueProps.value ?? [],
      painPoints: graph.audience.painPoints.value ?? [],
      audienceSegments: graph.audience.coreSegments.value ?? [],
    });
  }

  // Compute aggregated metrics
  const cpas = companies
    .map((c) => c.metrics.cpa)
    .filter((v): v is number => v !== undefined);
  const roases = companies
    .map((c) => c.metrics.roas)
    .filter((v): v is number => v !== undefined);

  const aggregatedMetrics = {
    avgCpa: cpas.length > 0 ? cpas.reduce((a, b) => a + b, 0) / cpas.length : null,
    avgRoas: roases.length > 0 ? roases.reduce((a, b) => a + b, 0) / roases.length : null,
    cpaRange: cpas.length > 0 ? [Math.min(...cpas), Math.max(...cpas)] as [number, number] : null,
    roasRange: roases.length > 0 ? [Math.min(...roases), Math.max(...roases)] as [number, number] : null,
  };

  // Channel distribution
  const channelCounts: Record<string, number> = {};
  for (const company of companies) {
    if (company.topChannel) {
      channelCounts[company.topChannel] =
        (channelCounts[company.topChannel] || 0) + 1;
    }
  }

  // Common value props (appearing in 2+ companies)
  const valuePropCounts = new Map<string, number>();
  for (const company of companies) {
    for (const vp of company.valueProps) {
      valuePropCounts.set(vp, (valuePropCounts.get(vp) || 0) + 1);
    }
  }
  const commonValueProps = Array.from(valuePropCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([vp]) => vp);

  // Common pain points
  const painPointCounts = new Map<string, number>();
  for (const company of companies) {
    for (const pp of company.painPoints) {
      painPointCounts.set(pp, (painPointCounts.get(pp) || 0) + 1);
    }
  }
  const commonPainPoints = Array.from(painPointCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([pp]) => pp);

  // Creative patterns (placeholder - would need more analysis)
  const topCreativePatterns: string[] = [];
  const allCreatives = companies.flatMap((c) => c.topCreatives);
  if (allCreatives.length > 0) {
    topCreativePatterns.push('Video content performs well');
    topCreativePatterns.push('Clear CTA in headlines');
  }

  return {
    verticalId,
    companies,
    aggregatedMetrics,
    channelDistribution: channelCounts,
    commonValueProps,
    commonPainPoints,
    topCreativePatterns,
  };
}

// ============================================================================
// Playbook Generation
// ============================================================================

/**
 * Generate a playbook for a vertical
 */
export async function generatePlaybook(
  verticalId: string,
  companyIds: string[]
): Promise<VerticalPlaybook> {
  const aggregation = await aggregateVerticalData(verticalId, companyIds);
  const verticalDef = VERTICAL_DEFINITIONS[verticalId];

  const now = new Date().toISOString();

  // Build benchmark ranges from data
  const benchmarkRanges: BenchmarkRange[] = [];

  if (aggregation.aggregatedMetrics.cpaRange) {
    const [min, max] = aggregation.aggregatedMetrics.cpaRange;
    const avg = aggregation.aggregatedMetrics.avgCpa!;
    benchmarkRanges.push({
      metric: 'CPA',
      good: avg,
      elite: min + (avg - min) * 0.3, // Top 30% range
      unit: 'USD',
      description: 'Cost per acquisition',
    });
  }

  if (aggregation.aggregatedMetrics.roasRange) {
    const [, max] = aggregation.aggregatedMetrics.roasRange;
    const avg = aggregation.aggregatedMetrics.avgRoas!;
    benchmarkRanges.push({
      metric: 'ROAS',
      good: avg,
      elite: avg + (max - avg) * 0.7, // Top 30% range
      unit: 'x',
      description: 'Return on ad spend',
    });
  }

  // Media guidelines from channel distribution
  const mediaGuidelines: string[] = [];
  const sortedChannels = Object.entries(aggregation.channelDistribution)
    .sort((a, b) => b[1] - a[1]);

  if (sortedChannels.length > 0) {
    mediaGuidelines.push(
      `Primary channel: ${sortedChannels[0][0]} (${sortedChannels[0][1]} companies using)`
    );
  }
  if (sortedChannels.length > 1) {
    mediaGuidelines.push(
      `Secondary channel: ${sortedChannels[1][0]}`
    );
  }
  if (verticalDef) {
    mediaGuidelines.push(
      `Typical channels for ${verticalDef.name}: ${verticalDef.typicalChannels.join(', ')}`
    );
  }

  // Creative guidelines
  const creativeGuidelines = [
    ...aggregation.topCreativePatterns,
    'Use customer pain points in headlines',
    'Show social proof and testimonials',
  ];

  // Diagnostic checklist
  const diagnosticChecklist = [
    'Check tracking implementation (GA4, pixels)',
    'Review conversion path for friction',
    'Audit audience targeting settings',
    'Review creative fatigue metrics',
    'Check budget pacing and caps',
  ];

  // Anti-patterns
  const antiPatterns = [
    'Broad targeting without exclusions',
    'Static creative without testing',
    'Missing conversion tracking',
    'Budget spread too thin across channels',
  ];

  // Seasonal patterns
  const seasonalPatterns = verticalDef
    ? [
        {
          name: 'Peak Season',
          months: verticalDef.seasonalPeaks,
          impact: 'high' as const,
          recommendations: [
            'Increase budget 20-30%',
            'Launch new creative before peak',
            'Ensure inventory/capacity is ready',
          ],
        },
      ]
    : [];

  // Risk constraints
  const riskConstraints = [
    'Never exceed approved budget by more than 10%',
    'Maintain brand safety settings',
    'Follow platform-specific content policies',
  ];

  // Success stories (from top performers)
  const successStories: VerticalPlaybook['successStories'] = [];
  if (aggregation.aggregatedMetrics.avgCpa && aggregation.companies.length > 0) {
    const topPerformers = aggregation.companies
      .filter((c) => c.metrics.cpa !== undefined)
      .filter((c) => c.metrics.cpa! < aggregation.aggregatedMetrics.avgCpa!)
      .slice(0, 2);

    for (const performer of topPerformers) {
      successStories.push({
        companyId: performer.companyId,
        summary: `${performer.companyName} achieved below-average CPA`,
        keyFactors: [
          performer.topChannel ? `Focused on ${performer.topChannel}` : 'Multi-channel approach',
          performer.valueProps.length > 0 ? 'Clear value proposition' : 'Strong brand identity',
        ],
      });
    }
  }

  // Core narrative
  const coreNarrative = verticalDef
    ? `${verticalDef.name} companies typically follow a ${verticalDef.typicalCycle} purchase cycle. Focus on ${verticalDef.typicalChannels[0]} as primary channel with supporting presence on ${verticalDef.typicalChannels.slice(1).join(' and ')}.`
    : `Companies in this vertical require a balanced multi-channel approach with strong creative testing.`;

  // Confidence based on sample size
  const confidence = Math.min(
    0.9,
    0.3 + aggregation.companies.length * 0.1
  );

  return {
    id: `playbook-${verticalId}-${Date.now()}`,
    verticalId,
    verticalName: verticalDef?.name ?? verticalId,
    version: 1,
    lastUpdated: now,
    coreNarrative,
    archetypes: aggregation.companies
      .flatMap((c) => c.audienceSegments)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 5),
    mediaGuidelines,
    creativeGuidelines,
    diagnosticChecklist,
    benchmarkRanges,
    antiPatterns,
    seasonalPatterns,
    riskConstraints,
    successStories,
    sampleSize: aggregation.companies.length,
    confidence,
  };
}

// ============================================================================
// Playbook Operations
// ============================================================================

/**
 * Update a playbook with new data
 */
export async function updatePlaybook(
  existingPlaybook: VerticalPlaybook,
  companyIds: string[]
): Promise<VerticalPlaybook> {
  const newPlaybook = await generatePlaybook(
    existingPlaybook.verticalId,
    companyIds
  );

  // Merge with existing, incrementing version
  return {
    ...newPlaybook,
    id: existingPlaybook.id,
    version: existingPlaybook.version + 1,
    // Keep successful strategies that are still valid
    successStories: [
      ...existingPlaybook.successStories,
      ...newPlaybook.successStories.filter(
        (s) => !existingPlaybook.successStories.some((es) => es.companyId === s.companyId)
      ),
    ].slice(0, 5),
  };
}

/**
 * Get playbook recommendations for a company
 */
export function getPlaybookRecommendationsForCompany(
  playbook: VerticalPlaybook,
  companyMetrics: {
    cpa?: number;
    roas?: number;
    topChannel?: string;
  }
): {
  strengths: string[];
  improvements: string[];
  immediateActions: string[];
} {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const immediateActions: string[] = [];

  // Check CPA against benchmarks
  const cpaBenchmark = playbook.benchmarkRanges.find((b) => b.metric === 'CPA');
  if (cpaBenchmark && companyMetrics.cpa !== undefined) {
    if (companyMetrics.cpa <= cpaBenchmark.elite) {
      strengths.push(`Elite CPA performance ($${companyMetrics.cpa.toFixed(2)} vs elite ${cpaBenchmark.elite.toFixed(2)})`);
    } else if (companyMetrics.cpa <= cpaBenchmark.good) {
      strengths.push(`Good CPA performance ($${companyMetrics.cpa.toFixed(2)})`);
    } else {
      improvements.push(`CPA above vertical average ($${companyMetrics.cpa.toFixed(2)} vs avg ${cpaBenchmark.good.toFixed(2)})`);
      immediateActions.push('Run CPA diagnostic to identify optimization opportunities');
    }
  }

  // Check ROAS against benchmarks
  const roasBenchmark = playbook.benchmarkRanges.find((b) => b.metric === 'ROAS');
  if (roasBenchmark && companyMetrics.roas !== undefined) {
    if (companyMetrics.roas >= roasBenchmark.elite) {
      strengths.push(`Elite ROAS (${companyMetrics.roas.toFixed(2)}x)`);
    } else if (companyMetrics.roas >= roasBenchmark.good) {
      strengths.push(`Good ROAS (${companyMetrics.roas.toFixed(2)}x)`);
    } else {
      improvements.push(`ROAS below vertical average (${companyMetrics.roas.toFixed(2)}x vs avg ${roasBenchmark.good.toFixed(2)}x)`);
    }
  }

  // Channel alignment
  if (companyMetrics.topChannel) {
    const channelGuideline = playbook.mediaGuidelines.find(
      (g) => g.toLowerCase().includes('primary channel')
    );
    if (channelGuideline) {
      const recommendedChannel = channelGuideline.split(':')[1]?.split('(')[0]?.trim();
      if (recommendedChannel && companyMetrics.topChannel === recommendedChannel) {
        strengths.push(`Using vertical-recommended primary channel (${recommendedChannel})`);
      } else if (recommendedChannel) {
        improvements.push(`Consider ${recommendedChannel} as primary channel (vertical recommendation)`);
      }
    }
  }

  // Add seasonal awareness
  const currentMonth = new Date().getMonth() + 1;
  for (const pattern of playbook.seasonalPatterns) {
    if (pattern.months.includes(currentMonth)) {
      immediateActions.push(
        `${pattern.name} active - ${pattern.recommendations[0]}`
      );
    }
  }

  return { strengths, improvements, immediateActions };
}

/**
 * List available verticals
 */
export function listVerticals(): Array<{
  id: string;
  name: string;
  keywords: string[];
}> {
  return Object.entries(VERTICAL_DEFINITIONS).map(([id, def]) => ({
    id,
    name: def.name,
    keywords: def.keywords,
  }));
}

/**
 * Detect vertical from company data
 */
export function detectVertical(
  industry?: string | null,
  companyName?: string
): string | null {
  const searchText = [industry, companyName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const [id, def] of Object.entries(VERTICAL_DEFINITIONS)) {
    if (def.keywords.some((kw) => searchText.includes(kw))) {
      return id;
    }
  }

  return null;
}

/**
 * Get seasonal insights for a vertical
 */
export function getSeasonalInsights(
  verticalId: string
): {
  currentImpact: 'peak' | 'normal' | 'low';
  upcomingPeaks: Array<{ month: number; name: string }>;
  recommendations: string[];
} {
  const verticalDef = VERTICAL_DEFINITIONS[verticalId];
  if (!verticalDef) {
    return {
      currentImpact: 'normal',
      upcomingPeaks: [],
      recommendations: [],
    };
  }

  const currentMonth = new Date().getMonth() + 1;
  const isPeak = verticalDef.seasonalPeaks.includes(currentMonth);

  // Find upcoming peaks in next 3 months
  const upcomingPeaks: Array<{ month: number; name: string }> = [];
  for (let i = 1; i <= 3; i++) {
    const futureMonth = ((currentMonth - 1 + i) % 12) + 1;
    if (verticalDef.seasonalPeaks.includes(futureMonth)) {
      upcomingPeaks.push({
        month: futureMonth,
        name: getMonthName(futureMonth),
      });
    }
  }

  const recommendations: string[] = [];
  if (isPeak) {
    recommendations.push('Increase budget allocation for peak season');
    recommendations.push('Ensure creative is fresh and tested');
    recommendations.push('Monitor competitor activity closely');
  } else if (upcomingPeaks.length > 0) {
    recommendations.push(`Prepare for upcoming peak in ${upcomingPeaks[0].name}`);
    recommendations.push('Test new creative concepts before peak');
  } else {
    recommendations.push('Use this period for testing and optimization');
    recommendations.push('Build audience lists for upcoming seasons');
  }

  return {
    currentImpact: isPeak ? 'peak' : 'normal',
    upcomingPeaks,
    recommendations,
  };
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return months[month - 1] ?? '';
}
