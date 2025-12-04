// lib/media/aiPlannerV2.ts
// AI Media Planner V2 - Enterprise Planning Orchestration
//
// This module extends the base AI planner with full 13-category input support.
// It generates comprehensive media plan options with:
// - Channel budget allocations
// - Geo strategy
// - Creative requirements
// - Targeting structure
// - Forecasted outcomes
// - Measurement plan
// - Testing roadmap
// - Risk analysis
// - Rollout plan

import type {
  MediaPlanningInputs,
  PrimaryObjective,
  RiskTolerance,
  MediaChannelId,
} from './planningInput';
import {
  generateMediaPlanOptions,
  type MediaPlanOption,
  type ChannelAllocation,
  type PlanExpectedOutcomes,
  type PlanOptionLabel,
} from './aiPlanner';
import { getMediaProfile } from './mediaProfile';
import { analyzeSeasonality } from './seasonality';
import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedMediaPlanOption extends MediaPlanOption {
  // Extended allocations
  geoStrategy: GeoStrategy;
  targetingStructure: TargetingStructure;
  creativeRequirements: CreativeRequirements;
  measurementPlan: MeasurementPlan;
  testingRoadmap: TestingRoadmap;
  riskAnalysis: RiskAnalysis;
  rolloutPlan: RolloutPlan;
}

export interface GeoStrategy {
  approach: 'national' | 'regional' | 'local' | 'store_level';
  priorityMarkets: string[];
  budgetAllocation: 'even' | 'weighted' | 'performance_based';
  notes: string;
}

export interface TargetingStructure {
  primaryAudiences: string[];
  secondaryAudiences: string[];
  exclusions: string[];
  demographicOverlay?: string;
  behavioralSignals: string[];
  customAudiences: string[];
}

export interface CreativeRequirements {
  formats: CreativeFormat[];
  keyMessages: string[];
  callsToAction: string[];
  assetGaps: string[];
  productionNeeds: string;
}

export interface CreativeFormat {
  channel: MediaChannel;
  format: string;
  dimensions?: string;
  quantity: number;
  priority: 'must_have' | 'nice_to_have';
}

export interface MeasurementPlan {
  primaryKpis: string[];
  secondaryKpis: string[];
  trackingRequirements: string[];
  attributionModel: string;
  reportingCadence: string;
  incrementalityApproach?: string;
}

export interface TestingRoadmap {
  tests: PlannedTest[];
  budget: number;
  learningAgenda: string[];
}

export interface PlannedTest {
  name: string;
  hypothesis: string;
  channel?: MediaChannel;
  budget: number;
  duration: string;
  successMetric: string;
}

export interface RiskAnalysis {
  overallRisk: 'low' | 'medium' | 'high';
  risks: IdentifiedRisk[];
  mitigations: string[];
}

export interface IdentifiedRisk {
  category: 'budget' | 'creative' | 'tracking' | 'market' | 'operational';
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface RolloutPlan {
  phases: RolloutPhase[];
  rampStrategy: 'aggressive' | 'measured' | 'conservative';
  checkpoints: string[];
}

export interface RolloutPhase {
  name: string;
  duration: string;
  budgetPercentage: number;
  channels: MediaChannel[];
  objectives: string[];
  successCriteria: string;
}

export interface EnhancedPlannerResult {
  success: true;
  options: EnhancedMediaPlanOption[];
  inputSummary: InputSummary;
  contextNotes: string[];
  generatedAt: string;
}

export interface EnhancedPlannerError {
  success: false;
  error: string;
}

export interface InputSummary {
  totalCategories: number;
  filledCategories: number;
  completenessPercentage: number;
  keyInputs: {
    objective: string;
    budget: string;
    audience: string;
    channels: string;
    risk: string;
  };
}

// ============================================================================
// Main Orchestration Function
// ============================================================================

/**
 * Generate enhanced media plan options using full 13-category inputs
 */
export async function generateEnhancedMediaPlanOptions(
  companyId: string,
  inputs: MediaPlanningInputs
): Promise<EnhancedPlannerResult | EnhancedPlannerError> {
  try {
    // Extract key parameters for base planner
    const baseInput = convertToBasePlannerInput(companyId, inputs);

    // Run base planner to get channel allocations
    const baseResult = await generateMediaPlanOptions(baseInput);

    if (!baseResult.success) {
      return baseResult;
    }

    // Load additional context
    const profile = await getMediaProfile(companyId);
    const seasonality = analyzeSeasonality(profile.seasonality);

    // Enhance each plan option with full context
    const enhancedOptions: EnhancedMediaPlanOption[] = [];

    for (const option of baseResult.options) {
      const enhanced = await enhancePlanOption(
        option,
        inputs,
        profile,
        seasonality
      );
      enhancedOptions.push(enhanced);
    }

    // Build input summary
    const inputSummary = buildInputSummary(inputs);

    // Generate context notes
    const contextNotes = generateContextNotes(inputs, profile);

    return {
      success: true,
      options: enhancedOptions,
      inputSummary,
      contextNotes,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[AIPlannerV2] Failed to generate enhanced plans:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate plans',
    };
  }
}

// ============================================================================
// Input Conversion
// ============================================================================

function convertToBasePlannerInput(
  companyId: string,
  inputs: MediaPlanningInputs
) {
  // Map primary objective to base planner objective
  const objectiveMap: Record<string, 'max_installs' | 'max_calls' | 'store_traffic' | 'blended'> = {
    lead_generation: 'max_calls',
    sales_conversions: 'max_installs',
    traffic_growth: 'store_traffic',
    brand_awareness: 'blended',
    engagement: 'blended',
    blended: 'blended',
  };

  const objective = objectiveMap[inputs.objectivesKpis.primaryObjective || 'blended'] || 'blended';

  // Get budget (prefer monthly, then derive from quarterly/annual)
  const monthlyBudget = inputs.budget.totalBudgetMonthly ||
    (inputs.budget.totalBudgetQuarterly ? Math.round(inputs.budget.totalBudgetQuarterly / 3) : null) ||
    (inputs.budget.totalBudgetAnnual ? Math.round(inputs.budget.totalBudgetAnnual / 12) : null) ||
    10000;

  // Build timeframe
  const now = new Date();
  const horizonDays: Record<string, number> = {
    '30d': 30,
    '90d': 90,
    quarter: 90,
    year: 365,
    custom: 90,
  };
  const days = horizonDays[inputs.objectivesKpis.timeHorizon || '90d'] || 90;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);

  // Map channels to MediaChannel type
  const requiredChannels = mapChannelIdsToMediaChannels(inputs.channels.requiredChannels);
  const excludedChannels = mapChannelIdsToMediaChannels(inputs.channels.disallowedChannels);

  return {
    companyId,
    objective,
    timeframe: {
      type: (inputs.objectivesKpis.timeHorizon === '30d'
        ? 'next_30_days'
        : inputs.objectivesKpis.timeHorizon === '90d'
        ? 'next_90_days'
        : 'quarter') as 'next_30_days' | 'next_90_days' | 'quarter' | 'custom',
      start: now.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
    monthlyBudget,
    guardrails: {
      maxCpa: inputs.objectivesKpis.targetCpa || undefined,
      maxCpl: inputs.objectivesKpis.targetCpl || undefined,
      requiredChannels,
      excludedChannels,
    },
    storeCount: inputs.storeLocation.isMultiLocation ? 10 : 1,
  };
}

function mapChannelIdsToMediaChannels(
  channelIds?: MediaChannelId[]
): MediaChannel[] {
  if (!channelIds) return [];

  const map: Record<string, MediaChannel> = {
    search_google: 'search',
    search_bing: 'microsoft_search',
    shopping: 'search',
    lsa: 'lsa',
    maps_gbp: 'maps',
    local_seo: 'maps',
    social_meta: 'social',
    social_tiktok: 'tiktok',
    social_instagram: 'social',
    social_linkedin: 'social',
    social_pinterest: 'social',
    social_x: 'social',
    display: 'display',
    retargeting: 'display',
    youtube: 'youtube',
    programmatic_video: 'youtube',
    radio: 'radio',
    streaming_audio: 'streaming_audio',
    ctv_ott: 'tv',
    out_of_home: 'out_of_home',
    influencers: 'social',
    email_sms: 'email',
    organic_content: 'social',
    partnerships: 'affiliate',
    pr: 'social',
    events: 'out_of_home',
    in_store_media: 'out_of_home',
  };

  return channelIds
    .map(id => map[id])
    .filter((c): c is MediaChannel => c !== undefined);
}

// ============================================================================
// Plan Enhancement
// ============================================================================

async function enhancePlanOption(
  option: MediaPlanOption,
  inputs: MediaPlanningInputs,
  profile: Awaited<ReturnType<typeof getMediaProfile>>,
  seasonality: ReturnType<typeof analyzeSeasonality>
): Promise<EnhancedMediaPlanOption> {
  // Build geo strategy
  const geoStrategy = buildGeoStrategy(inputs, option);

  // Build targeting structure
  const targetingStructure = buildTargetingStructure(inputs);

  // Build creative requirements
  const creativeRequirements = buildCreativeRequirements(inputs, option.channels);

  // Build measurement plan
  const measurementPlan = buildMeasurementPlan(inputs);

  // Build testing roadmap
  const testingRoadmap = buildTestingRoadmap(inputs, option);

  // Build risk analysis
  const riskAnalysis = buildRiskAnalysis(inputs, option);

  // Build rollout plan
  const rolloutPlan = buildRolloutPlan(inputs, option);

  return {
    ...option,
    geoStrategy,
    targetingStructure,
    creativeRequirements,
    measurementPlan,
    testingRoadmap,
    riskAnalysis,
    rolloutPlan,
  };
}

// ============================================================================
// Strategy Builders
// ============================================================================

function buildGeoStrategy(
  inputs: MediaPlanningInputs,
  option: MediaPlanOption
): GeoStrategy {
  const isMultiLocation = inputs.storeLocation.isMultiLocation;
  const geos = inputs.audience.geos;

  let approach: GeoStrategy['approach'] = 'national';
  if (isMultiLocation) {
    approach = inputs.storeLocation.storeSummary?.includes('region')
      ? 'regional'
      : 'store_level';
  } else if (geos?.includes('local') || geos?.includes('DMA')) {
    approach = 'local';
  }

  // Determine budget allocation based on risk tolerance
  const allocation: GeoStrategy['budgetAllocation'] =
    inputs.risk.riskTolerance === 'conservative'
      ? 'even'
      : inputs.risk.riskTolerance === 'aggressive'
      ? 'performance_based'
      : 'weighted';

  return {
    approach,
    priorityMarkets: extractMarkets(inputs),
    budgetAllocation: allocation,
    notes: inputs.storeLocation.tradeAreaNotes || 'Standard geographic distribution',
  };
}

function extractMarkets(inputs: MediaPlanningInputs): string[] {
  const markets: string[] = [];

  if (inputs.audience.geos) {
    // Parse geo string for market names
    const geos = inputs.audience.geos;
    const dmaMatch = geos.match(/DMA[s]?:\s*([^.]+)/i);
    if (dmaMatch) {
      markets.push(...dmaMatch[1].split(',').map(m => m.trim()));
    }
  }

  if (inputs.businessBrand.geographicFootprint) {
    // Extract regions from geographic footprint
    const regions = inputs.businessBrand.geographicFootprint;
    if (regions.includes('national')) {
      markets.push('National');
    }
  }

  return markets.length > 0 ? markets : ['Primary Market'];
}

function buildTargetingStructure(inputs: MediaPlanningInputs): TargetingStructure {
  return {
    primaryAudiences: inputs.audience.coreSegments || [],
    secondaryAudiences: [],
    exclusions: [],
    demographicOverlay: inputs.audience.demographics,
    behavioralSignals: inputs.audience.behavioralDrivers || [],
    customAudiences: inputs.audience.demandStates || [],
  };
}

function buildCreativeRequirements(
  inputs: MediaPlanningInputs,
  allocations: ChannelAllocation[]
): CreativeRequirements {
  const formats: CreativeFormat[] = [];

  // Generate format requirements based on channel allocations
  for (const alloc of allocations) {
    if (alloc.percentage < 5) continue;

    const channelFormats = getChannelFormats(alloc.channel);
    for (const format of channelFormats) {
      formats.push({
        channel: alloc.channel,
        format: format.name,
        dimensions: format.dimensions,
        quantity: format.quantity,
        priority: alloc.percentage >= 20 ? 'must_have' : 'nice_to_have',
      });
    }
  }

  return {
    formats,
    keyMessages: inputs.creativeContent.coreMessages || inputs.businessBrand.valueProps || [],
    callsToAction: inferCallsToAction(inputs.objectivesKpis.primaryObjective),
    assetGaps: inputs.creativeContent.contentGaps ? [inputs.creativeContent.contentGaps] : [],
    productionNeeds: inputs.creativeContent.productionScalability || 'Standard production capacity',
  };
}

function getChannelFormats(
  channel: MediaChannel
): Array<{ name: string; dimensions?: string; quantity: number }> {
  const formatMap: Record<string, Array<{ name: string; dimensions?: string; quantity: number }>> = {
    search: [
      { name: 'Responsive Search Ads', quantity: 3 },
      { name: 'Sitelinks', quantity: 4 },
    ],
    social: [
      { name: 'Static Image', dimensions: '1080x1080', quantity: 5 },
      { name: 'Video', dimensions: '1080x1920', quantity: 3 },
      { name: 'Carousel', quantity: 2 },
    ],
    display: [
      { name: 'Responsive Display', dimensions: 'Various', quantity: 3 },
      { name: 'Static Banner', dimensions: '300x250', quantity: 2 },
    ],
    youtube: [
      { name: 'Video Ad', dimensions: '1920x1080', quantity: 2 },
      { name: 'Bumper Ad', dimensions: '1920x1080', quantity: 3 },
    ],
    lsa: [
      { name: 'LSA Profile', quantity: 1 },
    ],
    maps: [
      { name: 'GBP Photos', quantity: 10 },
      { name: 'GBP Posts', quantity: 4 },
    ],
    radio: [
      { name: 'Audio Spot 30s', quantity: 2 },
      { name: 'Audio Spot 15s', quantity: 2 },
    ],
  };

  return formatMap[channel] || [{ name: 'Standard Creative', quantity: 2 }];
}

function inferCallsToAction(objective?: PrimaryObjective): string[] {
  const ctaMap: Record<string, string[]> = {
    lead_generation: ['Get a Quote', 'Schedule Consultation', 'Contact Us'],
    sales_conversions: ['Buy Now', 'Shop Now', 'Get Started'],
    traffic_growth: ['Learn More', 'Visit Site', 'Explore'],
    brand_awareness: ['Discover', 'Learn More', 'See How'],
    engagement: ['Join Now', 'Get Involved', 'Sign Up'],
    blended: ['Get Started', 'Learn More', 'Contact Us'],
  };

  return ctaMap[objective || 'blended'] || ctaMap.blended;
}

function buildMeasurementPlan(inputs: MediaPlanningInputs): MeasurementPlan {
  const primaryKpis = inputs.objectivesKpis.kpiLabels || [];

  // Add default KPIs based on objective
  const objectiveKpis: Record<string, string[]> = {
    lead_generation: ['Leads', 'Cost per Lead', 'Lead Quality Score'],
    sales_conversions: ['Conversions', 'Cost per Acquisition', 'ROAS'],
    traffic_growth: ['Sessions', 'Users', 'Bounce Rate'],
    brand_awareness: ['Impressions', 'Reach', 'Brand Lift'],
    engagement: ['Engagement Rate', 'Time on Site', 'Pages per Session'],
    blended: ['Blended CPA', 'Total Conversions', 'ROAS'],
  };

  const inferredKpis = objectiveKpis[inputs.objectivesKpis.primaryObjective || 'blended'] || [];
  const allPrimaryKpis = [...new Set([...primaryKpis, ...inferredKpis])];

  return {
    primaryKpis: allPrimaryKpis,
    secondaryKpis: ['Impression Share', 'CTR', 'Quality Score', 'Frequency'],
    trackingRequirements: buildTrackingRequirements(inputs),
    attributionModel: inputs.historical.attributionModelHistory || 'Data-Driven Attribution',
    reportingCadence: 'Weekly with Monthly Deep-Dives',
    incrementalityApproach: inputs.historical.incrementalityNotes,
  };
}

function buildTrackingRequirements(inputs: MediaPlanningInputs): string[] {
  const requirements: string[] = [];

  if (!inputs.digitalInfra.ga4Health || inputs.digitalInfra.ga4Health.toLowerCase().includes('issue')) {
    requirements.push('GA4 configuration audit and fix');
  } else {
    requirements.push('GA4 configured');
  }

  if (inputs.objectivesKpis.primaryObjective === 'lead_generation') {
    requirements.push('Form submission tracking');
    requirements.push('Call tracking integration');
  }

  if (inputs.storeLocation.isMultiLocation) {
    requirements.push('Store visit tracking');
    requirements.push('Location-level conversion tracking');
  }

  if (!inputs.digitalInfra.offlineConversionTracking) {
    requirements.push('Consider offline conversion import');
  }

  return requirements;
}

function buildTestingRoadmap(
  inputs: MediaPlanningInputs,
  option: MediaPlanOption
): TestingRoadmap {
  const tests: PlannedTest[] = [];
  const testingBudget = option.expected.spend * 0.1; // 10% testing budget

  // Risk-based testing approach
  if (inputs.risk.riskTolerance === 'aggressive') {
    // More tests for aggressive plans
    tests.push({
      name: 'New Channel Test',
      hypothesis: 'Untested channel may deliver incremental results',
      budget: testingBudget * 0.4,
      duration: '4 weeks',
      successMetric: 'CPA within 20% of target',
    });
  }

  // Always include creative testing
  tests.push({
    name: 'Creative A/B Test',
    hypothesis: 'Message variation will improve CTR',
    budget: testingBudget * 0.3,
    duration: '2 weeks',
    successMetric: '+10% CTR improvement',
  });

  // Audience testing
  tests.push({
    name: 'Audience Expansion Test',
    hypothesis: 'Broader targeting may reduce CPM while maintaining conversion rate',
    budget: testingBudget * 0.3,
    duration: '3 weeks',
    successMetric: 'CPA maintains within 15%',
  });

  return {
    tests,
    budget: testingBudget,
    learningAgenda: [
      'Identify top-performing creative themes',
      'Validate audience expansion opportunities',
      'Measure channel incrementality',
    ],
  };
}

function buildRiskAnalysis(
  inputs: MediaPlanningInputs,
  option: MediaPlanOption
): RiskAnalysis {
  const risks: IdentifiedRisk[] = [];

  // Budget risk
  if (!inputs.budget.totalBudgetMonthly && !inputs.budget.totalBudgetQuarterly) {
    risks.push({
      category: 'budget',
      description: 'Budget not confirmed - plan based on estimates',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Confirm budget allocation before launch',
    });
  }

  // Creative risk
  if (inputs.creativeContent.contentGaps) {
    risks.push({
      category: 'creative',
      description: 'Creative gaps identified that may delay launch',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Prioritize must-have creative assets',
    });
  }

  // Tracking risk
  if (!inputs.digitalInfra.ga4Health || inputs.digitalInfra.ga4Health.toLowerCase().includes('issue')) {
    risks.push({
      category: 'tracking',
      description: 'Tracking infrastructure needs attention',
      likelihood: 'high',
      impact: 'high',
      mitigation: 'Complete tracking audit before significant spend',
    });
  }

  // Market risk for aggressive plans
  if (option.riskLevel === 'high') {
    risks.push({
      category: 'market',
      description: 'Aggressive strategy may face CPA volatility',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Implement weekly budget reviews and CPA guardrails',
    });
  }

  // Operational risk
  if (inputs.operational.talentConstraints) {
    risks.push({
      category: 'operational',
      description: 'Team capacity constraints may limit optimization',
      likelihood: 'medium',
      impact: 'low',
      mitigation: 'Consider managed services or automation',
    });
  }

  // Calculate overall risk
  const highRisks = risks.filter(r => r.impact === 'high' && r.likelihood === 'high').length;
  const mediumRisks = risks.filter(r => r.impact === 'medium' || r.likelihood === 'medium').length;
  const overallRisk: RiskAnalysis['overallRisk'] =
    highRisks >= 2 ? 'high' : mediumRisks >= 3 ? 'medium' : 'low';

  return {
    overallRisk,
    risks,
    mitigations: risks.filter(r => r.mitigation).map(r => r.mitigation!),
  };
}

function buildRolloutPlan(
  inputs: MediaPlanningInputs,
  option: MediaPlanOption
): RolloutPlan {
  const riskTolerance = inputs.risk.riskTolerance || 'balanced';

  // Phase definitions based on risk tolerance
  const phases: RolloutPhase[] = [];

  if (riskTolerance === 'conservative') {
    // Slower, more measured rollout
    phases.push({
      name: 'Foundation',
      duration: 'Weeks 1-2',
      budgetPercentage: 40,
      channels: option.channels.slice(0, 2).map(c => c.channel),
      objectives: ['Validate tracking', 'Establish baselines'],
      successCriteria: 'Tracking verified, initial data collected',
    });
    phases.push({
      name: 'Expansion',
      duration: 'Weeks 3-4',
      budgetPercentage: 70,
      channels: option.channels.slice(0, 4).map(c => c.channel),
      objectives: ['Expand channels', 'Optimize bids'],
      successCriteria: 'CPA within target range',
    });
    phases.push({
      name: 'Optimization',
      duration: 'Weeks 5+',
      budgetPercentage: 100,
      channels: option.channels.map(c => c.channel),
      objectives: ['Full budget deployment', 'Continuous optimization'],
      successCriteria: 'Hit efficiency targets',
    });
  } else if (riskTolerance === 'aggressive') {
    // Faster rollout
    phases.push({
      name: 'Launch',
      duration: 'Week 1',
      budgetPercentage: 70,
      channels: option.channels.map(c => c.channel),
      objectives: ['Quick market entry', 'Gather data fast'],
      successCriteria: 'Campaigns live, data flowing',
    });
    phases.push({
      name: 'Scale',
      duration: 'Weeks 2+',
      budgetPercentage: 100,
      channels: option.channels.map(c => c.channel),
      objectives: ['Maximize volume', 'Aggressive testing'],
      successCriteria: 'Volume targets met',
    });
  } else {
    // Balanced rollout
    phases.push({
      name: 'Launch',
      duration: 'Week 1',
      budgetPercentage: 50,
      channels: option.channels.slice(0, 3).map(c => c.channel),
      objectives: ['Core channels live', 'Validate setup'],
      successCriteria: 'Initial data collected',
    });
    phases.push({
      name: 'Ramp',
      duration: 'Weeks 2-3',
      budgetPercentage: 80,
      channels: option.channels.map(c => c.channel),
      objectives: ['Full channel coverage', 'Initial optimization'],
      successCriteria: 'CPA trending toward target',
    });
    phases.push({
      name: 'Optimize',
      duration: 'Weeks 4+',
      budgetPercentage: 100,
      channels: option.channels.map(c => c.channel),
      objectives: ['Full optimization', 'Testing agenda'],
      successCriteria: 'Efficiency targets achieved',
    });
  }

  return {
    phases,
    rampStrategy: riskTolerance === 'conservative' ? 'conservative' : riskTolerance === 'aggressive' ? 'aggressive' : 'measured',
    checkpoints: [
      'Week 1: Tracking verification',
      'Week 2: Initial performance review',
      'Week 4: Deep dive optimization',
      'Monthly: Strategy review',
    ],
  };
}

// ============================================================================
// Input Summary
// ============================================================================

function buildInputSummary(inputs: MediaPlanningInputs): InputSummary {
  // Count filled categories
  const categories = [
    { key: 'businessBrand', data: inputs.businessBrand },
    { key: 'objectivesKpis', data: inputs.objectivesKpis },
    { key: 'audience', data: inputs.audience },
    { key: 'productOffer', data: inputs.productOffer },
    { key: 'historical', data: inputs.historical },
    { key: 'digitalInfra', data: inputs.digitalInfra },
    { key: 'competitive', data: inputs.competitive },
    { key: 'creativeContent', data: inputs.creativeContent },
    { key: 'operational', data: inputs.operational },
    { key: 'budget', data: inputs.budget },
    { key: 'channels', data: inputs.channels },
    { key: 'storeLocation', data: inputs.storeLocation },
    { key: 'risk', data: inputs.risk },
  ];

  const filledCategories = categories.filter(c => {
    const data = c.data;
    if (!data) return false;
    return Object.values(data).some(v =>
      v !== undefined &&
      v !== null &&
      v !== '' &&
      (!Array.isArray(v) || v.length > 0)
    );
  }).length;

  // Calculate overall completeness
  let totalFields = 0;
  let filledFields = 0;

  for (const cat of categories) {
    const data = cat.data;
    if (!data) continue;
    for (const value of Object.values(data)) {
      totalFields++;
      if (value !== undefined && value !== null && value !== '') {
        if (!Array.isArray(value) || value.length > 0) {
          filledFields++;
        }
      }
    }
  }

  const completeness = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Build key inputs summary
  const objectiveLabels: Record<string, string> = {
    lead_generation: 'Lead Generation',
    sales_conversions: 'Sales & Conversions',
    traffic_growth: 'Traffic Growth',
    brand_awareness: 'Brand Awareness',
    engagement: 'Engagement',
    blended: 'Blended Goals',
  };

  const budget = inputs.budget.totalBudgetMonthly ||
    (inputs.budget.totalBudgetQuarterly ? Math.round(inputs.budget.totalBudgetQuarterly / 3) : null) ||
    (inputs.budget.totalBudgetAnnual ? Math.round(inputs.budget.totalBudgetAnnual / 12) : null);

  const riskLabels: Record<string, string> = {
    conservative: 'Conservative',
    balanced: 'Balanced',
    aggressive: 'Aggressive',
  };

  return {
    totalCategories: 13,
    filledCategories,
    completenessPercentage: completeness,
    keyInputs: {
      objective: objectiveLabels[inputs.objectivesKpis.primaryObjective || 'blended'] || 'Not set',
      budget: budget ? `$${budget.toLocaleString()}/mo` : 'Not set',
      audience: inputs.audience.coreSegments?.length
        ? `${inputs.audience.coreSegments.length} segments`
        : 'Not defined',
      channels: inputs.channels.requiredChannels?.length
        ? `${inputs.channels.requiredChannels.length} required`
        : 'Flexible',
      risk: riskLabels[inputs.risk.riskTolerance || 'balanced'] || 'Balanced',
    },
  };
}

function generateContextNotes(
  inputs: MediaPlanningInputs,
  profile: Awaited<ReturnType<typeof getMediaProfile>>
): string[] {
  const notes: string[] = [];

  // Business context
  if (inputs.businessBrand.marketMaturity) {
    const maturityNotes: Record<string, string> = {
      launch: 'Early-stage business - focus on awareness and initial customer acquisition',
      growth: 'Growth phase - balance volume and efficiency',
      plateau: 'Mature market - optimize for efficiency and retention',
      turnaround: 'Turnaround situation - strategic testing recommended',
    };
    notes.push(maturityNotes[inputs.businessBrand.marketMaturity] || '');
  }

  // Seasonality
  if (inputs.businessBrand.seasonalityNotes) {
    notes.push(`Seasonality: ${inputs.businessBrand.seasonalityNotes}`);
  }

  // Multi-location
  if (inputs.storeLocation.isMultiLocation) {
    notes.push('Multi-location business - geo-specific strategies recommended');
  }

  // Budget constraints
  if (inputs.operational.budgetCapsFloors) {
    notes.push(`Budget constraints: ${inputs.operational.budgetCapsFloors}`);
  }

  // Tracking status
  if (inputs.digitalInfra.measurementLimits) {
    notes.push(`Measurement note: ${inputs.digitalInfra.measurementLimits}`);
  }

  return notes.filter(n => n.length > 0);
}

// ============================================================================
// Exports
// ============================================================================

export {
  type MediaPlanningInputs,
  type PrimaryObjective,
  type RiskTolerance,
  type MediaChannelId,
};
