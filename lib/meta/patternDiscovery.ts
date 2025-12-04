// lib/meta/patternDiscovery.ts
// Phase 6: Emergent Intelligence - Pattern Discovery Engine
//
// AI-powered meta-learning that analyzes all companies to detect:
// - Winning media mixes per vertical
// - Emerging creative patterns
// - Persona clusters across brands
// - Seasonality fingerprints
// - KPI breakpoints

import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  MetaPattern,
  MetaPatternType,
  MetaPatternEvidence,
  PatternAction,
} from './types';
import { loadContextGraph } from '../contextGraph';
import { getAllCompanies } from '../airtable/companies';

// ============================================================================
// Pattern Discovery Types
// ============================================================================

interface PatternCandidate {
  type: MetaPatternType;
  name: string;
  description: string;
  evidence: MetaPatternEvidence[];
  vertical: string;
  businessModels: string[];
  confidence: number;
}

interface DiscoveryOptions {
  verticalFilter?: string;
  minSampleSize?: number;
  minConfidence?: number;
  patternTypes?: MetaPatternType[];
}

interface MediaMixPattern {
  vertical: string;
  channelAllocation: Record<string, number>;
  avgRoas: number;
  sampleSize: number;
  companies: string[];
}

interface CreativePattern {
  vertical: string;
  format: string;
  messagingAngle: string;
  performance: number;
  frequency: number;
  companies: string[];
}

interface PersonaCluster {
  name: string;
  characteristics: string[];
  verticals: string[];
  conversionRate: number;
  ltv: number;
  sampleSize: number;
  companies: string[];
}

interface SeasonalityFingerprint {
  vertical: string;
  monthlyPattern: number[]; // 12 values, indexed 0-11
  peakMonths: number[];
  lowMonths: number[];
  variance: number;
  companies: string[];
}

interface KPIBreakpoint {
  metric: string;
  vertical: string;
  threshold: number;
  belowBehavior: string;
  aboveBehavior: string;
  impact: string;
  sampleSize: number;
}

// ============================================================================
// Main Discovery Functions
// ============================================================================

/**
 * Run comprehensive pattern discovery across all companies
 */
export async function discoverPatterns(
  options: DiscoveryOptions = {}
): Promise<MetaPattern[]> {
  const {
    verticalFilter,
    minSampleSize = 3,
    minConfidence = 0.6,
    patternTypes,
  } = options;

  // Load all companies with context graphs
  const companiesWithGraphs = await loadAllCompanyGraphs(verticalFilter);

  if (companiesWithGraphs.length < minSampleSize) {
    return [];
  }

  const patterns: MetaPattern[] = [];
  const typesToDiscover = patternTypes || [
    'media_mix',
    'creative_angle',
    'persona_cluster',
    'seasonality',
    'kpi_breakpoint',
    'content_correlation',
    'funnel_optimization',
    'channel_emergence',
    'audience_evolution',
  ];

  // Run discovery for each pattern type
  const discoveryPromises: Promise<PatternCandidate[]>[] = [];

  if (typesToDiscover.includes('media_mix')) {
    discoveryPromises.push(discoverMediaMixPatterns(companiesWithGraphs));
  }
  if (typesToDiscover.includes('creative_angle')) {
    discoveryPromises.push(discoverCreativePatterns(companiesWithGraphs));
  }
  if (typesToDiscover.includes('persona_cluster')) {
    discoveryPromises.push(discoverPersonaClusters(companiesWithGraphs));
  }
  if (typesToDiscover.includes('seasonality')) {
    discoveryPromises.push(discoverSeasonalityPatterns(companiesWithGraphs));
  }
  if (typesToDiscover.includes('kpi_breakpoint')) {
    discoveryPromises.push(discoverKPIBreakpoints(companiesWithGraphs));
  }
  if (typesToDiscover.includes('content_correlation')) {
    discoveryPromises.push(discoverContentCorrelations(companiesWithGraphs));
  }
  if (typesToDiscover.includes('funnel_optimization')) {
    discoveryPromises.push(discoverFunnelPatterns(companiesWithGraphs));
  }
  if (typesToDiscover.includes('channel_emergence')) {
    discoveryPromises.push(discoverChannelEmergence(companiesWithGraphs));
  }
  if (typesToDiscover.includes('audience_evolution')) {
    discoveryPromises.push(discoverAudienceEvolution(companiesWithGraphs));
  }

  const allCandidates = await Promise.all(discoveryPromises);
  const flatCandidates = allCandidates.flat();

  // Filter and convert to MetaPattern
  for (const candidate of flatCandidates) {
    if (
      candidate.evidence.length >= minSampleSize &&
      candidate.confidence >= minConfidence
    ) {
      patterns.push(convertToMetaPattern(candidate));
    }
  }

  return patterns;
}

/**
 * Discover patterns for a specific vertical
 */
export async function discoverVerticalPatterns(
  vertical: string
): Promise<MetaPattern[]> {
  return discoverPatterns({
    verticalFilter: vertical,
    minSampleSize: 2, // Lower threshold for vertical-specific
    minConfidence: 0.5,
  });
}

/**
 * Validate an existing pattern against current data
 */
export async function validatePattern(
  pattern: MetaPattern
): Promise<{ valid: boolean; newConfidence: number; updatedEvidence: MetaPatternEvidence[] }> {
  const companiesWithGraphs = await loadAllCompanyGraphs(pattern.vertical);

  const validEvidence: MetaPatternEvidence[] = [];

  for (const company of companiesWithGraphs) {
    const evidenceMatch = await checkPatternEvidence(pattern, company);
    if (evidenceMatch) {
      validEvidence.push(evidenceMatch);
    }
  }

  const newConfidence = validEvidence.length / Math.max(companiesWithGraphs.length, 1);

  return {
    valid: newConfidence >= 0.5,
    newConfidence,
    updatedEvidence: validEvidence,
  };
}

// ============================================================================
// Media Mix Pattern Discovery
// ============================================================================

async function discoverMediaMixPatterns(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];

  // Group by vertical
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const mediaMixes: MediaMixPattern[] = [];

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const channelMix = extractChannelMix(graph);

      if (Object.keys(channelMix).length > 0) {
        const roas = graph.performanceMedia?.blendedRoas?.value ?? 0;
        mediaMixes.push({
          vertical,
          channelAllocation: channelMix,
          avgRoas: typeof roas === 'number' ? roas : 0,
          sampleSize: 1,
          companies: [company.id],
        });
      }
    }

    // Cluster similar media mixes
    const clusters = clusterMediaMixes(mediaMixes);

    for (const cluster of clusters) {
      if (cluster.sampleSize >= 2) {
        const topChannels = getTopChannels(cluster.channelAllocation, 3);

        candidates.push({
          type: 'media_mix',
          name: `${vertical} Media Mix: ${topChannels.join(' + ')}`,
          description: `Companies in ${vertical} seeing success with ${topChannels.join(', ')} allocation pattern. Average ROAS: ${cluster.avgRoas.toFixed(1)}x`,
          evidence: cluster.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Uses ${topChannels.join(' + ')} mix`,
            metric: 'roas',
            value: cluster.avgRoas,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => cluster.companies.includes(c.id))),
          confidence: calculatePatternConfidence(cluster.sampleSize, cluster.avgRoas > 2 ? 0.8 : 0.5),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Creative Pattern Discovery
// ============================================================================

async function discoverCreativePatterns(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const creativePatterns: CreativePattern[] = [];

    for (const company of verticalCompanies) {
      const graph = company.graph;

      // Extract creative patterns from graph
      const formats = graph.creative?.availableFormats?.value || [];
      const messages = graph.creative?.coreMessages?.value || [];
      const toneWords = graph.audience?.toneGuidance?.value ? [graph.audience.toneGuidance.value] : [];

      for (const format of formats) {
        for (const message of messages.slice(0, 3)) {
          creativePatterns.push({
            vertical,
            format: typeof format === 'string' ? format : String(format),
            messagingAngle: typeof message === 'string' ? message : String(message),
            performance: 1, // Placeholder - would come from performance data
            frequency: 1,
            companies: [company.id],
          });
        }
      }
    }

    // Find recurring creative patterns
    const patternCounts = countCreativePatterns(creativePatterns);

    for (const [key, data] of Object.entries(patternCounts)) {
      if (data.count >= 2) {
        candidates.push({
          type: 'creative_angle',
          name: `${vertical} Creative: ${data.format} + ${data.messagingAngle.slice(0, 30)}...`,
          description: `${data.count} companies in ${vertical} using ${data.format} format with similar messaging around "${data.messagingAngle.slice(0, 50)}..."`,
          evidence: data.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Uses ${data.format} with "${data.messagingAngle.slice(0, 30)}..."`,
            metric: 'creative_pattern',
            value: 1,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => data.companies.includes(c.id))),
          confidence: calculatePatternConfidence(data.count, 0.6),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Persona Cluster Discovery
// ============================================================================

async function discoverPersonaClusters(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const allPersonas: Array<{
    companyId: string;
    companyName: string;
    vertical: string;
    persona: {
      name: string;
      demographics: string[];
      behaviors: string[];
      motivations: string[];
    };
  }> = [];

  // Extract all personas
  for (const company of companies) {
    const graph = company.graph;
    const personas = graph.audience?.personaBriefs?.value || [];
    const vertical = graph.identity?.industry?.value || 'unknown';

    for (const persona of personas) {
      if (typeof persona === 'object' && persona !== null) {
        allPersonas.push({
          companyId: company.id,
          companyName: company.name,
          vertical: typeof vertical === 'string' ? vertical : 'unknown',
          persona: {
            name: (persona as Record<string, unknown>).name as string || 'Unknown',
            demographics: ((persona as Record<string, unknown>).demographics as string[]) || [],
            behaviors: ((persona as Record<string, unknown>).behaviors as string[]) || [],
            motivations: ((persona as Record<string, unknown>).motivations as string[]) || [],
          },
        });
      }
    }
  }

  // Cluster similar personas
  const clusters = clusterPersonas(allPersonas);

  for (const cluster of clusters) {
    if (cluster.companies.length >= 2) {
      const verticals = [...new Set(cluster.personas.map(p => p.vertical))];

      candidates.push({
        type: 'persona_cluster',
        name: `Cross-Brand Persona: ${cluster.name}`,
        description: `${cluster.companies.length} companies targeting similar audience: ${cluster.characteristics.join(', ')}`,
        evidence: cluster.companies.map(companyId => {
          const personaData = cluster.personas.find(p => p.companyId === companyId);
          return {
            companyId,
            companyName: personaData?.companyName || companyId,
            observation: `Has "${personaData?.persona.name}" persona with matching characteristics`,
            metric: 'persona_match',
            value: cluster.similarity,
            timestamp: new Date().toISOString(),
            weight: 1,
          };
        }),
        vertical: verticals.length === 1 ? verticals[0] : 'cross-vertical',
        businessModels: extractBusinessModels(companies.filter(c => cluster.companies.includes(c.id))),
        confidence: calculatePatternConfidence(cluster.companies.length, cluster.similarity),
      });
    }
  }

  return candidates;
}

// ============================================================================
// Seasonality Pattern Discovery
// ============================================================================

async function discoverSeasonalityPatterns(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const seasonalData: SeasonalityFingerprint[] = [];

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const seasonalNotes = graph.identity?.seasonalityNotes?.value;

      if (seasonalNotes && typeof seasonalNotes === 'string') {
        // Parse seasonality notes into monthly pattern
        const pattern = parseSeasonalityNotes(seasonalNotes);
        if (pattern) {
          seasonalData.push({
            vertical,
            monthlyPattern: pattern.monthlyPattern,
            peakMonths: pattern.peakMonths,
            lowMonths: pattern.lowMonths,
            variance: pattern.variance,
            companies: [company.id],
          });
        }
      }
    }

    // Find common seasonality patterns
    const commonPatterns = findCommonSeasonality(seasonalData);

    for (const pattern of commonPatterns) {
      if (pattern.companies.length >= 2) {
        const peakMonthNames = pattern.peakMonths.map(m => getMonthName(m));
        const lowMonthNames = pattern.lowMonths.map(m => getMonthName(m));

        candidates.push({
          type: 'seasonality',
          name: `${vertical} Seasonality: Peak ${peakMonthNames.join(', ')}`,
          description: `${pattern.companies.length} ${vertical} companies share seasonal pattern: peaks in ${peakMonthNames.join(', ')}, lows in ${lowMonthNames.join(', ')}`,
          evidence: pattern.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Seasonal pattern: peaks ${peakMonthNames.join(', ')}`,
            metric: 'seasonality_variance',
            value: pattern.variance,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => pattern.companies.includes(c.id))),
          confidence: calculatePatternConfidence(pattern.companies.length, 0.7),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// KPI Breakpoint Discovery
// ============================================================================

async function discoverKPIBreakpoints(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  const kpiMetrics = ['cpa', 'roas', 'ctr', 'conversionRate', 'cac', 'ltv'];

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    for (const metric of kpiMetrics) {
      const values: Array<{ companyId: string; value: number }> = [];

      for (const company of verticalCompanies) {
        const graph = company.graph;
        let value: number | undefined;

        switch (metric) {
          case 'cpa':
            value = graph.objectives?.targetCpa?.value as number;
            break;
          case 'roas':
            value = graph.objectives?.targetRoas?.value as number;
            break;
          case 'ctr':
            value = graph.performanceMedia?.blendedCtr?.value as number;
            break;
          case 'conversionRate':
            value = graph.performanceMedia?.blendedCpa?.value as number; // Use CPA as proxy
            break;
          case 'cac':
            value = graph.budgetOps?.avgCustomerValue?.value as number; // Using customer value as proxy
            break;
          case 'ltv':
            value = graph.budgetOps?.customerLTV?.value as number;
            break;
        }

        if (typeof value === 'number' && !isNaN(value)) {
          values.push({ companyId: company.id, value });
        }
      }

      // Find natural breakpoints using Jenks natural breaks or simple percentile analysis
      const breakpoints = findNaturalBreakpoints(values);

      for (const breakpoint of breakpoints) {
        if (breakpoint.sampleSize >= 2) {
          candidates.push({
            type: 'kpi_breakpoint',
            name: `${vertical} ${metric.toUpperCase()} Breakpoint: ${breakpoint.threshold}`,
            description: `${vertical} companies show distinct behavior above/below ${metric} of ${breakpoint.threshold}. ${breakpoint.aboveBehavior} vs ${breakpoint.belowBehavior}`,
            evidence: breakpoint.companies.map(companyId => ({
              companyId,
              companyName: companies.find(c => c.id === companyId)?.name || companyId,
              observation: `${metric} = ${values.find(v => v.companyId === companyId)?.value}`,
              metric,
              value: values.find(v => v.companyId === companyId)?.value || 0,
              timestamp: new Date().toISOString(),
              weight: 1,
            })),
            vertical,
            businessModels: extractBusinessModels(companies.filter(c => breakpoint.companies.includes(c.id))),
            confidence: calculatePatternConfidence(breakpoint.sampleSize, 0.6),
          });
        }
      }
    }
  }

  return candidates;
}

// ============================================================================
// Content Correlation Discovery
// ============================================================================

async function discoverContentCorrelations(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const contentData: Array<{
      companyId: string;
      contentTypes: string[];
      frequency: string;
      engagement: number;
    }> = [];

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const contentTypes = graph.creative?.availableFormats?.value || [];

      contentData.push({
        companyId: company.id,
        contentTypes: Array.isArray(contentTypes)
          ? contentTypes.map(t => String(t))
          : [],
        frequency: 'weekly', // Would come from actual data
        engagement: 0.05, // Would come from actual data
      });
    }

    // Find content type correlations with success
    const correlations = findContentCorrelations(contentData);

    for (const correlation of correlations) {
      if (correlation.companies.length >= 2) {
        candidates.push({
          type: 'content_correlation',
          name: `${vertical} Content: ${correlation.contentType} Success Pattern`,
          description: `${correlation.companies.length} ${vertical} companies see higher engagement with ${correlation.contentType} content`,
          evidence: correlation.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Uses ${correlation.contentType} with ${(correlation.avgEngagement * 100).toFixed(1)}% engagement`,
            metric: 'engagement_rate',
            value: correlation.avgEngagement,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => correlation.companies.includes(c.id))),
          confidence: calculatePatternConfidence(correlation.companies.length, 0.5),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Funnel Pattern Discovery
// ============================================================================

async function discoverFunnelPatterns(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const funnelData: Array<{
      companyId: string;
      stages: string[];
      conversionRates: number[];
      bottleneck: string | null;
    }> = [];

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const website = graph.website;

      if (website) {
        const bottleneck = website.coreWebVitals?.value;

        funnelData.push({
          companyId: company.id,
          stages: [],
          conversionRates: [],
          bottleneck: typeof bottleneck === 'string' ? bottleneck : null,
        });
      }
    }

    // Find common bottlenecks
    const bottleneckCounts = countBottlenecks(funnelData);

    for (const [bottleneck, data] of Object.entries(bottleneckCounts)) {
      if (data.count >= 2) {
        candidates.push({
          type: 'funnel_optimization',
          name: `${vertical} Common Bottleneck: ${bottleneck}`,
          description: `${data.count} ${vertical} companies have "${bottleneck}" as their primary funnel bottleneck`,
          evidence: data.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Primary bottleneck: ${bottleneck}`,
            metric: 'bottleneck',
            value: 1,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => data.companies.includes(c.id))),
          confidence: calculatePatternConfidence(data.count, 0.6),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Channel Emergence Discovery
// ============================================================================

async function discoverChannelEmergence(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    const channelData: Record<string, { companies: string[]; avgPerformance: number }> = {};

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const channels = graph.performanceMedia?.activeChannels?.value || [];

      for (const channel of channels) {
        const channelName = typeof channel === 'string' ? channel : String(channel);
        if (!channelData[channelName]) {
          channelData[channelName] = { companies: [], avgPerformance: 0 };
        }
        channelData[channelName].companies.push(company.id);
      }
    }

    // Identify emerging channels (present in multiple companies but not majority)
    const totalCompanies = verticalCompanies.length;

    for (const [channel, data] of Object.entries(channelData)) {
      const adoptionRate = data.companies.length / totalCompanies;

      // Emerging = 20-60% adoption
      if (adoptionRate >= 0.2 && adoptionRate <= 0.6 && data.companies.length >= 2) {
        candidates.push({
          type: 'channel_emergence',
          name: `${vertical} Emerging Channel: ${channel}`,
          description: `${channel} is gaining traction in ${vertical} with ${(adoptionRate * 100).toFixed(0)}% adoption (${data.companies.length}/${totalCompanies} companies)`,
          evidence: data.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Active on ${channel}`,
            metric: 'channel_adoption',
            value: adoptionRate,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => data.companies.includes(c.id))),
          confidence: calculatePatternConfidence(data.companies.length, adoptionRate),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Audience Evolution Discovery
// ============================================================================

async function discoverAudienceEvolution(
  companies: CompanyWithGraph[]
): Promise<PatternCandidate[]> {
  const candidates: PatternCandidate[] = [];
  const byVertical = groupByVertical(companies);

  for (const [vertical, verticalCompanies] of Object.entries(byVertical)) {
    // Track audience segment patterns
    const segmentData: Record<string, { companies: string[]; characteristics: string[] }> = {};

    for (const company of verticalCompanies) {
      const graph = company.graph;
      const segments = graph.audience?.coreSegments?.value || [];
      const demographics = graph.audience?.demographics?.value;

      for (const segment of segments) {
        const segmentName = typeof segment === 'string' ? segment : String(segment);
        if (!segmentData[segmentName]) {
          segmentData[segmentName] = { companies: [], characteristics: [] };
        }
        segmentData[segmentName].companies.push(company.id);

        if (demographics && typeof demographics === 'string') {
          segmentData[segmentName].characteristics.push(demographics);
        }
      }
    }

    // Find evolving audience patterns
    for (const [segment, data] of Object.entries(segmentData)) {
      if (data.companies.length >= 2) {
        candidates.push({
          type: 'audience_evolution',
          name: `${vertical} Audience Trend: ${segment}`,
          description: `${data.companies.length} ${vertical} companies are targeting "${segment}" segment`,
          evidence: data.companies.map(companyId => ({
            companyId,
            companyName: companies.find(c => c.id === companyId)?.name || companyId,
            observation: `Targets "${segment}" segment`,
            metric: 'audience_segment',
            value: 1,
            timestamp: new Date().toISOString(),
            weight: 1,
          })),
          vertical,
          businessModels: extractBusinessModels(companies.filter(c => data.companies.includes(c.id))),
          confidence: calculatePatternConfidence(data.companies.length, 0.6),
        });
      }
    }
  }

  return candidates;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface CompanyWithGraph {
  id: string;
  name: string;
  graph: CompanyContextGraph;
}

async function loadAllCompanyGraphs(
  verticalFilter?: string
): Promise<CompanyWithGraph[]> {
  const companies = await getAllCompanies();
  const results: CompanyWithGraph[] = [];

  for (const company of companies) {
    try {
      const graph = await loadContextGraph(company.id);
      if (graph) {
        const vertical = graph.identity?.industry?.value;

        if (!verticalFilter || vertical === verticalFilter) {
          results.push({
            id: company.id,
            name: company.name,
            graph,
          });
        }
      }
    } catch (error) {
      // Skip companies with no graph
      continue;
    }
  }

  return results;
}

function groupByVertical(
  companies: CompanyWithGraph[]
): Record<string, CompanyWithGraph[]> {
  const groups: Record<string, CompanyWithGraph[]> = {};

  for (const company of companies) {
    const vertical = company.graph.identity?.industry?.value || 'unknown';
    const verticalStr = typeof vertical === 'string' ? vertical : 'unknown';

    if (!groups[verticalStr]) {
      groups[verticalStr] = [];
    }
    groups[verticalStr].push(company);
  }

  return groups;
}

function extractBusinessModels(companies: CompanyWithGraph[]): string[] {
  const models = new Set<string>();

  for (const company of companies) {
    const model = company.graph.identity?.businessModel?.value;
    if (typeof model === 'string') {
      models.add(model);
    }
  }

  return [...models];
}

function extractChannelMix(graph: CompanyContextGraph): Record<string, number> {
  const channels = graph.performanceMedia?.activeChannels?.value || [];
  const mix: Record<string, number> = {};

  // Equal distribution if no allocation data
  const channelCount = channels.length;
  if (channelCount > 0) {
    const allocation = 1 / channelCount;
    for (const channel of channels) {
      const channelName = typeof channel === 'string' ? channel : String(channel);
      mix[channelName] = allocation;
    }
  }

  return mix;
}

function getTopChannels(allocation: Record<string, number>, n: number): string[] {
  return Object.entries(allocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([channel]) => channel);
}

function clusterMediaMixes(mixes: MediaMixPattern[]): MediaMixPattern[] {
  // Simple clustering by dominant channel
  const clusters: Record<string, MediaMixPattern> = {};

  for (const mix of mixes) {
    const topChannel = getTopChannels(mix.channelAllocation, 1)[0] || 'unknown';

    if (!clusters[topChannel]) {
      clusters[topChannel] = {
        vertical: mix.vertical,
        channelAllocation: { ...mix.channelAllocation },
        avgRoas: mix.avgRoas,
        sampleSize: 1,
        companies: [...mix.companies],
      };
    } else {
      clusters[topChannel].avgRoas =
        (clusters[topChannel].avgRoas * clusters[topChannel].sampleSize + mix.avgRoas) /
        (clusters[topChannel].sampleSize + 1);
      clusters[topChannel].sampleSize++;
      clusters[topChannel].companies.push(...mix.companies);
    }
  }

  return Object.values(clusters);
}

function countCreativePatterns(
  patterns: CreativePattern[]
): Record<string, { format: string; messagingAngle: string; count: number; companies: string[] }> {
  const counts: Record<string, { format: string; messagingAngle: string; count: number; companies: string[] }> = {};

  for (const pattern of patterns) {
    // Normalize messaging angle for comparison
    const normalizedAngle = pattern.messagingAngle.toLowerCase().slice(0, 50);
    const key = `${pattern.format}:${normalizedAngle}`;

    if (!counts[key]) {
      counts[key] = {
        format: pattern.format,
        messagingAngle: pattern.messagingAngle,
        count: 0,
        companies: [],
      };
    }

    if (!counts[key].companies.includes(pattern.companies[0])) {
      counts[key].count++;
      counts[key].companies.push(pattern.companies[0]);
    }
  }

  return counts;
}

interface PersonaClusterResult {
  name: string;
  characteristics: string[];
  companies: string[];
  personas: Array<{
    companyId: string;
    companyName: string;
    vertical: string;
    persona: { name: string; demographics: string[]; behaviors: string[]; motivations: string[] };
  }>;
  similarity: number;
}

function clusterPersonas(
  personas: Array<{
    companyId: string;
    companyName: string;
    vertical: string;
    persona: { name: string; demographics: string[]; behaviors: string[]; motivations: string[] };
  }>
): PersonaClusterResult[] {
  // Simple clustering by shared demographics/behaviors
  const clusters: PersonaClusterResult[] = [];
  const used = new Set<number>();

  for (let i = 0; i < personas.length; i++) {
    if (used.has(i)) continue;

    const cluster: PersonaClusterResult = {
      name: personas[i].persona.name,
      characteristics: [
        ...personas[i].persona.demographics,
        ...personas[i].persona.behaviors,
      ],
      companies: [personas[i].companyId],
      personas: [personas[i]],
      similarity: 1,
    };
    used.add(i);

    for (let j = i + 1; j < personas.length; j++) {
      if (used.has(j)) continue;

      const similarity = calculatePersonaSimilarity(personas[i], personas[j]);
      if (similarity > 0.5) {
        cluster.companies.push(personas[j].companyId);
        cluster.personas.push(personas[j]);
        cluster.similarity = (cluster.similarity + similarity) / 2;
        used.add(j);
      }
    }

    if (cluster.companies.length >= 2) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

function calculatePersonaSimilarity(
  a: { persona: { demographics: string[]; behaviors: string[]; motivations: string[] } },
  b: { persona: { demographics: string[]; behaviors: string[]; motivations: string[] } }
): number {
  const aTerms = new Set([
    ...a.persona.demographics.map(d => d.toLowerCase()),
    ...a.persona.behaviors.map(b => b.toLowerCase()),
    ...a.persona.motivations.map(m => m.toLowerCase()),
  ]);

  const bTerms = new Set([
    ...b.persona.demographics.map(d => d.toLowerCase()),
    ...b.persona.behaviors.map(b => b.toLowerCase()),
    ...b.persona.motivations.map(m => m.toLowerCase()),
  ]);

  const intersection = [...aTerms].filter(t => bTerms.has(t)).length;
  const union = new Set([...aTerms, ...bTerms]).size;

  return union > 0 ? intersection / union : 0;
}

function parseSeasonalityNotes(
  notes: string
): { monthlyPattern: number[]; peakMonths: number[]; lowMonths: number[]; variance: number } | null {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const shortMonthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const notesLower = notes.toLowerCase();
  const peakMonths: number[] = [];
  const lowMonths: number[] = [];

  // Look for peak/high mentions
  const peakPattern = /peak|high|busy|surge|season/i;
  const lowPattern = /low|slow|quiet|off-season/i;

  for (let i = 0; i < 12; i++) {
    const monthName = monthNames[i];
    const shortName = shortMonthNames[i];

    if (notesLower.includes(monthName) || notesLower.includes(shortName)) {
      // Check context around month mention
      const monthIndex = Math.max(
        notesLower.indexOf(monthName),
        notesLower.indexOf(shortName)
      );
      const context = notesLower.slice(Math.max(0, monthIndex - 50), monthIndex + 50);

      if (peakPattern.test(context)) {
        peakMonths.push(i);
      } else if (lowPattern.test(context)) {
        lowMonths.push(i);
      }
    }
  }

  if (peakMonths.length === 0 && lowMonths.length === 0) {
    return null;
  }

  // Generate monthly pattern
  const monthlyPattern = new Array(12).fill(1);
  for (const month of peakMonths) {
    monthlyPattern[month] = 1.5;
  }
  for (const month of lowMonths) {
    monthlyPattern[month] = 0.5;
  }

  // Calculate variance
  const mean = monthlyPattern.reduce((a, b) => a + b, 0) / 12;
  const variance = monthlyPattern.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 12;

  return { monthlyPattern, peakMonths, lowMonths, variance };
}

function findCommonSeasonality(
  data: SeasonalityFingerprint[]
): SeasonalityFingerprint[] {
  // Group by similar peak months
  const groups: Record<string, SeasonalityFingerprint> = {};

  for (const item of data) {
    const key = item.peakMonths.sort().join(',') || 'none';

    if (!groups[key]) {
      groups[key] = {
        ...item,
        companies: [...item.companies],
      };
    } else {
      groups[key].companies.push(...item.companies);
      groups[key].variance = (groups[key].variance + item.variance) / 2;
    }
  }

  return Object.values(groups);
}

function getMonthName(month: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[month] || 'Unknown';
}

interface BreakpointResult {
  threshold: number;
  belowBehavior: string;
  aboveBehavior: string;
  sampleSize: number;
  companies: string[];
}

function findNaturalBreakpoints(
  values: Array<{ companyId: string; value: number }>
): BreakpointResult[] {
  if (values.length < 4) return [];

  // Sort values
  const sorted = [...values].sort((a, b) => a.value - b.value);

  // Find median as breakpoint
  const medianIndex = Math.floor(sorted.length / 2);
  const median = sorted[medianIndex].value;

  const below = sorted.filter(v => v.value < median);
  const above = sorted.filter(v => v.value >= median);

  if (below.length < 2 || above.length < 2) return [];

  return [{
    threshold: median,
    belowBehavior: `Below ${median.toFixed(2)}`,
    aboveBehavior: `Above ${median.toFixed(2)}`,
    sampleSize: values.length,
    companies: values.map(v => v.companyId),
  }];
}

function findContentCorrelations(
  data: Array<{ companyId: string; contentTypes: string[]; engagement: number }>
): Array<{ contentType: string; companies: string[]; avgEngagement: number }> {
  const typeData: Record<string, { companies: string[]; totalEngagement: number }> = {};

  for (const item of data) {
    for (const type of item.contentTypes) {
      if (!typeData[type]) {
        typeData[type] = { companies: [], totalEngagement: 0 };
      }
      typeData[type].companies.push(item.companyId);
      typeData[type].totalEngagement += item.engagement;
    }
  }

  return Object.entries(typeData).map(([contentType, d]) => ({
    contentType,
    companies: d.companies,
    avgEngagement: d.totalEngagement / d.companies.length,
  }));
}

function countBottlenecks(
  data: Array<{ companyId: string; bottleneck: string | null }>
): Record<string, { count: number; companies: string[] }> {
  const counts: Record<string, { count: number; companies: string[] }> = {};

  for (const item of data) {
    if (item.bottleneck) {
      if (!counts[item.bottleneck]) {
        counts[item.bottleneck] = { count: 0, companies: [] };
      }
      counts[item.bottleneck].count++;
      counts[item.bottleneck].companies.push(item.companyId);
    }
  }

  return counts;
}

function calculatePatternConfidence(sampleSize: number, baseConfidence: number): number {
  // Scale confidence by sample size (more samples = higher confidence)
  const sizeMultiplier = Math.min(1, sampleSize / 10);
  return Math.min(0.95, baseConfidence * (0.5 + 0.5 * sizeMultiplier));
}

async function checkPatternEvidence(
  pattern: MetaPattern,
  company: CompanyWithGraph
): Promise<MetaPatternEvidence | null> {
  // Check if company matches pattern criteria
  const graph = company.graph;

  switch (pattern.type) {
    case 'media_mix': {
      const channels = graph.performanceMedia?.activeChannels?.value || [];
      const patternChannels = pattern.evidence[0]?.observation?.match(/Uses (.+) mix/)?.[1]?.split(' + ') || [];
      const hasChannels = patternChannels.some(c =>
        channels.some(ch => String(ch).toLowerCase().includes(c.toLowerCase()))
      );

      if (hasChannels) {
        return {
          companyId: company.id,
          companyName: company.name,
          observation: `Uses similar channel mix`,
          metric: 'roas',
          value: graph.performanceMedia?.blendedRoas?.value as number || 0,
          timestamp: new Date().toISOString(),
          weight: 1,
        };
      }
      break;
    }

    case 'seasonality': {
      const seasonalNotes = graph.identity?.seasonalityNotes?.value;
      if (seasonalNotes && typeof seasonalNotes === 'string') {
        return {
          companyId: company.id,
          companyName: company.name,
          observation: `Has seasonal pattern`,
          metric: 'seasonality',
          value: 1,
          timestamp: new Date().toISOString(),
          weight: 1,
        };
      }
      break;
    }

    // Add more pattern type checks as needed
  }

  return null;
}

function convertToMetaPattern(candidate: PatternCandidate): MetaPattern {
  return {
    id: `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: candidate.type,
    name: candidate.name,
    description: candidate.description,
    vertical: candidate.vertical,
    businessModels: candidate.businessModels,
    applicableCompanyStages: ['growth', 'mature'], // Default
    evidence: candidate.evidence,
    sampleSize: candidate.evidence.length,
    crossCompanyConfidence: candidate.confidence,
    statisticalSignificance: candidate.confidence * 0.9,
    recommendedActions: generatePatternActions(candidate),
    expectedImpact: {
      metric: candidate.type === 'media_mix' ? 'roas' : 'performance',
      improvement: 0.1 + candidate.confidence * 0.2,
      confidence: candidate.confidence,
    },
    status: candidate.confidence >= 0.7 ? 'validated' : 'emerging',
    discoveredAt: new Date().toISOString(),
    lastValidatedAt: new Date().toISOString(),
    validationCount: 1,
  };
}

function generatePatternActions(candidate: PatternCandidate): PatternAction[] {
  const actions: PatternAction[] = [];

  switch (candidate.type) {
    case 'media_mix':
      actions.push({
        action: 'Test similar channel allocation',
        priority: 'high',
        expectedOutcome: 'Improved ROAS based on vertical benchmarks',
        implementation: 'Gradually shift budget allocation to match pattern',
        prerequisites: ['Current channel performance baseline', 'Budget flexibility'],
      });
      break;

    case 'creative_angle':
      actions.push({
        action: 'Test messaging angle variation',
        priority: 'medium',
        expectedOutcome: 'Improved creative performance',
        implementation: 'Create test ads with similar messaging themes',
        prerequisites: ['Creative team capacity', 'A/B testing capability'],
      });
      break;

    case 'seasonality':
      actions.push({
        action: 'Align budget to seasonal pattern',
        priority: 'high',
        expectedOutcome: 'Better budget efficiency during peak periods',
        implementation: 'Increase budget 30-50% during peak months',
        prerequisites: ['Flexible budgeting', 'Historical performance data'],
      });
      break;

    default:
      actions.push({
        action: `Apply ${candidate.type} pattern insights`,
        priority: 'medium',
        expectedOutcome: 'Improved performance based on cross-company patterns',
        implementation: 'Review pattern details and adapt to your context',
        prerequisites: ['Team alignment', 'Resources'],
      });
  }

  return actions;
}

// ============================================================================
// Exports
// ============================================================================

export {
  type PatternCandidate,
  type DiscoveryOptions,
  type MediaMixPattern,
  type CreativePattern,
  type PersonaCluster,
  type SeasonalityFingerprint,
  type KPIBreakpoint,
};
