// lib/media/planComposerV2.ts
// Enhanced Media Plan Composer V2
//
// Generates comprehensive plan summaries reflecting all 13 input categories.
// Outputs include:
// - Executive summary
// - Strategic context
// - Channel mix with reasoning
// - Geo strategy
// - Audience targeting
// - Creative requirements
// - Measurement framework
// - Testing agenda
// - Risk assessment
// - Implementation roadmap

import type { MediaPlanningInputs } from './planningInput';
import type {
  EnhancedMediaPlanOption,
  GeoStrategy,
  TargetingStructure,
  CreativeRequirements,
  MeasurementPlan,
  TestingRoadmap,
  RiskAnalysis,
  RolloutPlan,
} from './aiPlannerV2';
import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ComprehensivePlanSummary {
  planId: string;
  planName: string;
  generatedAt: string;

  // Core sections
  execSummary: string;
  strategicContext: StrategicContextSection;
  channelStrategy: ChannelStrategySection;
  geoStrategy: GeoStrategySection;
  audienceStrategy: AudienceStrategySection;
  creativeStrategy: CreativeStrategySection;
  measurementFramework: MeasurementSection;
  testingAgenda: TestingSection;
  riskAssessment: RiskSection;
  implementationRoadmap: ImplementationSection;

  // Forecasts
  forecast: ForecastSection;

  // Appendix
  inputSummary: InputSummarySection;
}

export interface StrategicContextSection {
  businessContext: string;
  marketPosition: string;
  competitiveLandscape: string;
  seasonalityNotes: string;
  keyConstraints: string[];
}

export interface ChannelStrategySection {
  overview: string;
  channels: ChannelDetail[];
  totalBudget: number;
  channelCount: number;
}

export interface ChannelDetail {
  channel: MediaChannel;
  name: string;
  budget: number;
  percentage: number;
  role: string;
  reasoning: string;
  expectedOutcomes: string;
  keyTactics: string[];
}

export interface GeoStrategySection {
  approach: string;
  priorityMarkets: string[];
  allocationMethod: string;
  localConsiderations: string;
}

export interface AudienceStrategySection {
  primaryAudiences: string[];
  targetingApproach: string;
  demographicProfile: string;
  behavioralSignals: string[];
  customAudiences: string[];
}

export interface CreativeStrategySection {
  overview: string;
  keyMessages: string[];
  callsToAction: string[];
  formatRequirements: FormatRequirement[];
  productionNeeds: string;
  assetGaps: string[];
}

export interface FormatRequirement {
  channel: string;
  format: string;
  quantity: number;
  priority: string;
}

export interface MeasurementSection {
  framework: string;
  primaryKpis: KpiDetail[];
  secondaryKpis: string[];
  trackingRequirements: string[];
  attributionModel: string;
  reportingCadence: string;
}

export interface KpiDetail {
  metric: string;
  target?: string;
  importance: 'primary' | 'secondary';
}

export interface TestingSection {
  overview: string;
  tests: TestDetail[];
  totalTestBudget: number;
  learningAgenda: string[];
}

export interface TestDetail {
  name: string;
  hypothesis: string;
  budget: number;
  duration: string;
  successMetric: string;
}

export interface RiskSection {
  overallAssessment: string;
  risks: RiskDetail[];
  mitigationPlan: string[];
}

export interface RiskDetail {
  category: string;
  description: string;
  severity: string;
  mitigation: string;
}

export interface ImplementationSection {
  overview: string;
  phases: PhaseDetail[];
  checkpoints: string[];
  criticalPath: string[];
}

export interface PhaseDetail {
  name: string;
  duration: string;
  budget: string;
  activities: string[];
  successCriteria: string;
}

export interface ForecastSection {
  summary: string;
  metrics: ForecastMetric[];
  assumptions: string[];
  confidenceLevel: string;
}

export interface ForecastMetric {
  metric: string;
  value: number | string;
  trend?: string;
}

export interface InputSummarySection {
  completeness: number;
  categoriesProvided: string[];
  categoriesMissing: string[];
  dataSourcesUsed: string[];
}

// ============================================================================
// Main Composer Function
// ============================================================================

export function composeComprehensivePlanSummary(
  option: EnhancedMediaPlanOption,
  inputs: MediaPlanningInputs,
  planName?: string
): ComprehensivePlanSummary {
  const planId = option.id;
  const name = planName || `${option.label} Media Plan`;

  return {
    planId,
    planName: name,
    generatedAt: new Date().toISOString(),

    execSummary: composeExecSummary(option, inputs),
    strategicContext: composeStrategicContext(inputs),
    channelStrategy: composeChannelStrategy(option, inputs),
    geoStrategy: composeGeoStrategySection(option.geoStrategy, inputs),
    audienceStrategy: composeAudienceStrategy(option.targetingStructure, inputs),
    creativeStrategy: composeCreativeStrategy(option.creativeRequirements, inputs),
    measurementFramework: composeMeasurementSection(option.measurementPlan, inputs),
    testingAgenda: composeTestingSection(option.testingRoadmap),
    riskAssessment: composeRiskSection(option.riskAnalysis),
    implementationRoadmap: composeImplementationSection(option.rolloutPlan),
    forecast: composeForecastSection(option),
    inputSummary: composeInputSummary(inputs),
  };
}

// ============================================================================
// Section Composers
// ============================================================================

function composeExecSummary(
  option: EnhancedMediaPlanOption,
  inputs: MediaPlanningInputs
): string {
  const objective = getObjectiveLabel(inputs.objectivesKpis.primaryObjective);
  const budget = option.expected.spend;
  const topChannels = option.channels
    .slice(0, 3)
    .map(c => getChannelName(c.channel))
    .join(', ');

  const timeframe = getTimeframeLabel(inputs.objectivesKpis.timeHorizon);
  const riskLevel = option.riskLevel;

  let summary = `This ${option.label.toLowerCase()} media plan is designed to ${objective.toLowerCase()} `;
  summary += `over the ${timeframe} period. `;
  summary += `With a monthly investment of $${budget.toLocaleString()}, the strategy focuses on `;
  summary += `${topChannels} to drive results. `;

  if (option.expected.installs > 0) {
    summary += `The plan is projected to deliver ${option.expected.installs.toLocaleString()} conversions `;
    summary += `at an average CPA of $${option.expected.cpa}. `;
  }

  summary += `This approach carries ${riskLevel} risk with a confidence score of ${option.confidenceScore}%.`;

  return summary;
}

function composeStrategicContext(inputs: MediaPlanningInputs): StrategicContextSection {
  const businessContext = [
    inputs.businessBrand.businessModel && `Business model: ${inputs.businessBrand.businessModel}`,
    inputs.businessBrand.revenueModel && `Revenue model: ${inputs.businessBrand.revenueModel}`,
    inputs.businessBrand.positioning,
  ]
    .filter(Boolean)
    .join('. ') || 'Business context not fully specified.';

  const marketPosition = [
    inputs.businessBrand.marketMaturity && `Market stage: ${getMaturityLabel(inputs.businessBrand.marketMaturity)}`,
    inputs.businessBrand.geographicFootprint && `Geographic footprint: ${inputs.businessBrand.geographicFootprint}`,
  ]
    .filter(Boolean)
    .join('. ') || 'Market position details not provided.';

  const competitiveLandscape = inputs.businessBrand.competitiveLandscape ||
    inputs.competitive.shareOfVoice ||
    'Competitive landscape not detailed.';

  const seasonalityNotes = inputs.businessBrand.seasonalityNotes ||
    inputs.historical.seasonalityOverlays ||
    'No specific seasonality noted.';

  const keyConstraints: string[] = [];
  if (inputs.operational.budgetCapsFloors) keyConstraints.push(inputs.operational.budgetCapsFloors);
  if (inputs.operational.channelRestrictions) keyConstraints.push(inputs.operational.channelRestrictions);
  if (inputs.operational.talentConstraints) keyConstraints.push(inputs.operational.talentConstraints);
  if (inputs.digitalInfra.measurementLimits) keyConstraints.push(`Measurement: ${inputs.digitalInfra.measurementLimits}`);

  return {
    businessContext,
    marketPosition,
    competitiveLandscape,
    seasonalityNotes,
    keyConstraints: keyConstraints.length > 0 ? keyConstraints : ['No major constraints identified'],
  };
}

function composeChannelStrategy(
  option: EnhancedMediaPlanOption,
  inputs: MediaPlanningInputs
): ChannelStrategySection {
  const channels: ChannelDetail[] = option.channels.map(alloc => ({
    channel: alloc.channel,
    name: getChannelName(alloc.channel),
    budget: alloc.budget,
    percentage: alloc.percentage,
    role: getChannelRole(alloc.channel, inputs.objectivesKpis.primaryObjective),
    reasoning: getChannelReasoning(alloc.channel, alloc.percentage, alloc.isRequired),
    expectedOutcomes: getChannelExpectedOutcomes(alloc.channel, alloc.budget),
    keyTactics: getChannelTactics(alloc.channel),
  }));

  const overview = `This plan distributes budget across ${channels.length} channels, `;
  const topChannel = channels[0];
  const overviewContinued = topChannel
    ? `with ${topChannel.name} as the primary driver at ${topChannel.percentage}% of spend.`
    : 'balanced across performance and awareness channels.';

  return {
    overview: overview + overviewContinued,
    channels,
    totalBudget: option.expected.spend,
    channelCount: channels.length,
  };
}

function composeGeoStrategySection(
  geoStrategy: GeoStrategy,
  inputs: MediaPlanningInputs
): GeoStrategySection {
  const approachLabels: Record<string, string> = {
    national: 'National coverage with broad reach',
    regional: 'Regional focus targeting key markets',
    local: 'Local market concentration',
    store_level: 'Store-level geo-targeting for maximum precision',
  };

  const allocationLabels: Record<string, string> = {
    even: 'Even distribution across all markets',
    weighted: 'Weighted allocation based on market potential',
    performance_based: 'Performance-based dynamic allocation',
  };

  return {
    approach: approachLabels[geoStrategy.approach] || geoStrategy.approach,
    priorityMarkets: geoStrategy.priorityMarkets,
    allocationMethod: allocationLabels[geoStrategy.budgetAllocation] || geoStrategy.budgetAllocation,
    localConsiderations: inputs.storeLocation.localSeasonality ||
      inputs.storeLocation.localCompetitiveDensity ||
      geoStrategy.notes,
  };
}

function composeAudienceStrategy(
  targeting: TargetingStructure,
  inputs: MediaPlanningInputs
): AudienceStrategySection {
  const approach = targeting.primaryAudiences.length > 0
    ? `Focused targeting on ${targeting.primaryAudiences.length} primary segments`
    : 'Broad reach targeting with behavioral refinement';

  return {
    primaryAudiences: targeting.primaryAudiences.length > 0
      ? targeting.primaryAudiences
      : ['General market audience'],
    targetingApproach: approach,
    demographicProfile: inputs.audience.demographics || targeting.demographicOverlay || 'Not specified',
    behavioralSignals: targeting.behavioralSignals.length > 0
      ? targeting.behavioralSignals
      : ['Purchase intent', 'Category interest'],
    customAudiences: targeting.customAudiences.length > 0
      ? targeting.customAudiences
      : ['Retargeting', 'Lookalikes'],
  };
}

function composeCreativeStrategy(
  creative: CreativeRequirements,
  inputs: MediaPlanningInputs
): CreativeStrategySection {
  const overview = creative.formats.length > 0
    ? `${creative.formats.length} creative formats required across channels`
    : 'Standard creative formats needed';

  const formatRequirements: FormatRequirement[] = creative.formats.map(f => ({
    channel: getChannelName(f.channel),
    format: f.format,
    quantity: f.quantity,
    priority: f.priority === 'must_have' ? 'Must Have' : 'Nice to Have',
  }));

  return {
    overview,
    keyMessages: creative.keyMessages.length > 0
      ? creative.keyMessages
      : inputs.businessBrand.valueProps || ['Key messages to be developed'],
    callsToAction: creative.callsToAction,
    formatRequirements,
    productionNeeds: creative.productionNeeds,
    assetGaps: creative.assetGaps.length > 0
      ? creative.assetGaps
      : ['No critical gaps identified'],
  };
}

function composeMeasurementSection(
  measurement: MeasurementPlan,
  inputs: MediaPlanningInputs
): MeasurementSection {
  const primaryKpis: KpiDetail[] = measurement.primaryKpis.map(kpi => ({
    metric: kpi,
    target: getKpiTarget(kpi, inputs),
    importance: 'primary' as const,
  }));

  const framework = `${measurement.attributionModel} attribution with ${measurement.reportingCadence.toLowerCase()}`;

  return {
    framework,
    primaryKpis,
    secondaryKpis: measurement.secondaryKpis,
    trackingRequirements: measurement.trackingRequirements,
    attributionModel: measurement.attributionModel,
    reportingCadence: measurement.reportingCadence,
  };
}

function composeTestingSection(testing: TestingRoadmap): TestingSection {
  const overview = testing.tests.length > 0
    ? `${testing.tests.length} planned tests with $${testing.budget.toLocaleString()} allocated`
    : 'Testing agenda to be developed';

  const tests: TestDetail[] = testing.tests.map(t => ({
    name: t.name,
    hypothesis: t.hypothesis,
    budget: t.budget,
    duration: t.duration,
    successMetric: t.successMetric,
  }));

  return {
    overview,
    tests,
    totalTestBudget: testing.budget,
    learningAgenda: testing.learningAgenda,
  };
}

function composeRiskSection(risk: RiskAnalysis): RiskSection {
  const assessmentLabels: Record<string, string> = {
    low: 'Low overall risk - well-defined strategy with proven channels',
    medium: 'Moderate risk - balanced approach with some testing',
    high: 'Higher risk profile - aggressive strategy with upside potential',
  };

  const risks: RiskDetail[] = risk.risks.map(r => ({
    category: r.category.charAt(0).toUpperCase() + r.category.slice(1),
    description: r.description,
    severity: `${r.likelihood} likelihood, ${r.impact} impact`,
    mitigation: r.mitigation || 'Mitigation to be determined',
  }));

  return {
    overallAssessment: assessmentLabels[risk.overallRisk] || 'Risk assessment in progress',
    risks,
    mitigationPlan: risk.mitigations.length > 0
      ? risk.mitigations
      : ['Monitor performance weekly', 'Maintain budget flexibility'],
  };
}

function composeImplementationSection(rollout: RolloutPlan): ImplementationSection {
  const strategyLabels: Record<string, string> = {
    conservative: 'Conservative rollout with measured scaling',
    measured: 'Balanced rollout with steady progression',
    aggressive: 'Aggressive launch for rapid market entry',
  };

  const phases: PhaseDetail[] = rollout.phases.map(p => ({
    name: p.name,
    duration: p.duration,
    budget: `${p.budgetPercentage}% of total`,
    activities: p.objectives,
    successCriteria: p.successCriteria,
  }));

  const criticalPath = [
    'Complete tracking setup',
    'Launch core channels',
    'First optimization cycle',
    'Full budget deployment',
  ];

  return {
    overview: strategyLabels[rollout.rampStrategy] || 'Standard implementation',
    phases,
    checkpoints: rollout.checkpoints,
    criticalPath,
  };
}

function composeForecastSection(option: EnhancedMediaPlanOption): ForecastSection {
  const { expected } = option;

  const metrics: ForecastMetric[] = [
    { metric: 'Total Spend', value: `$${expected.spend.toLocaleString()}` },
    { metric: 'Projected Conversions', value: expected.installs.toLocaleString() },
    { metric: 'Projected Calls', value: expected.calls.toLocaleString() },
    { metric: 'Projected Leads', value: expected.leads.toLocaleString() },
    { metric: 'Expected CPA', value: `$${expected.cpa}` },
    { metric: 'Expected CPL', value: `$${expected.cpl}` },
    { metric: 'Expected Impressions', value: expected.impressions.toLocaleString() },
    { metric: 'Expected Clicks', value: expected.clicks.toLocaleString() },
  ];

  const confidenceLabels: Record<string, string> = {
    high: 'High confidence based on historical data',
    medium: 'Medium confidence with standard assumptions',
    low: 'Lower confidence - more testing needed',
  };

  const confidence = option.confidenceScore >= 80
    ? 'high'
    : option.confidenceScore >= 60
    ? 'medium'
    : 'low';

  return {
    summary: `Projected to deliver ${expected.installs.toLocaleString()} conversions at $${expected.cpa} CPA`,
    metrics,
    assumptions: [
      'Based on industry benchmarks and available data',
      'Assumes consistent market conditions',
      'Tracking properly configured',
      'Creative assets available at launch',
    ],
    confidenceLevel: confidenceLabels[confidence],
  };
}

function composeInputSummary(inputs: MediaPlanningInputs): InputSummarySection {
  const categories = [
    { id: 'businessBrand', name: 'Business & Brand', data: inputs.businessBrand },
    { id: 'objectivesKpis', name: 'Objectives & KPIs', data: inputs.objectivesKpis },
    { id: 'audience', name: 'Audience', data: inputs.audience },
    { id: 'productOffer', name: 'Products & Offers', data: inputs.productOffer },
    { id: 'historical', name: 'Historical Performance', data: inputs.historical },
    { id: 'digitalInfra', name: 'Digital Infrastructure', data: inputs.digitalInfra },
    { id: 'competitive', name: 'Competitive Intel', data: inputs.competitive },
    { id: 'creativeContent', name: 'Creative & Content', data: inputs.creativeContent },
    { id: 'operational', name: 'Operational Constraints', data: inputs.operational },
    { id: 'budget', name: 'Budget', data: inputs.budget },
    { id: 'channels', name: 'Channel Universe', data: inputs.channels },
    { id: 'storeLocation', name: 'Stores & Locations', data: inputs.storeLocation },
    { id: 'risk', name: 'Risk Appetite', data: inputs.risk },
  ];

  const provided: string[] = [];
  const missing: string[] = [];

  for (const cat of categories) {
    const hasData = cat.data && Object.values(cat.data).some(v =>
      v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0)
    );
    if (hasData) {
      provided.push(cat.name);
    } else {
      missing.push(cat.name);
    }
  }

  const completeness = Math.round((provided.length / categories.length) * 100);

  const dataSources: string[] = [];
  if (inputs.businessBrand.valueProps?.length) dataSources.push('Brain');
  if (inputs.digitalInfra.ga4Health) dataSources.push('Diagnostics');
  if (inputs.channels.requiredChannels?.length) dataSources.push('Media Profile');
  if (dataSources.length === 0) dataSources.push('Manual Input');

  return {
    completeness,
    categoriesProvided: provided,
    categoriesMissing: missing,
    dataSourcesUsed: dataSources,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

const CHANNEL_NAMES: Record<MediaChannel, string> = {
  search: 'Paid Search',
  maps: 'Google Maps',
  lsa: 'Local Service Ads',
  social: 'Social Media',
  radio: 'Radio',
  display: 'Display',
  youtube: 'YouTube/Video',
  microsoft_search: 'Microsoft Search',
  tiktok: 'TikTok',
  email: 'Email',
  affiliate: 'Affiliate',
  tv: 'Television',
  streaming_audio: 'Streaming Audio',
  out_of_home: 'Out-of-Home',
  print: 'Print',
  direct_mail: 'Direct Mail',
};

function getChannelName(channel: MediaChannel): string {
  return CHANNEL_NAMES[channel] || channel;
}

function getObjectiveLabel(objective?: string): string {
  const labels: Record<string, string> = {
    lead_generation: 'drive lead generation',
    sales_conversions: 'maximize conversions and sales',
    traffic_growth: 'grow website traffic',
    brand_awareness: 'build brand awareness',
    engagement: 'drive engagement',
    blended: 'achieve blended marketing goals',
  };
  return labels[objective || 'blended'] || 'achieve marketing objectives';
}

function getTimeframeLabel(horizon?: string): string {
  const labels: Record<string, string> = {
    '30d': 'next 30 days',
    '90d': 'next 90 days',
    quarter: 'quarter',
    year: 'year',
    custom: 'planning period',
  };
  return labels[horizon || '90d'] || 'planning period';
}

function getMaturityLabel(maturity: string): string {
  const labels: Record<string, string> = {
    launch: 'Launch/Early Stage',
    growth: 'Growth Phase',
    plateau: 'Mature/Plateau',
    turnaround: 'Turnaround',
    other: 'Other',
  };
  return labels[maturity] || maturity;
}

function getChannelRole(channel: MediaChannel, objective?: string): string {
  const roles: Record<string, Record<string, string>> = {
    search: {
      lead_generation: 'Primary lead capture',
      sales_conversions: 'Conversion driver',
      traffic_growth: 'Intent traffic',
      brand_awareness: 'Search presence',
      default: 'Core performance channel',
    },
    lsa: {
      lead_generation: 'Direct lead generation',
      default: 'Local lead capture',
    },
    social: {
      brand_awareness: 'Primary awareness driver',
      engagement: 'Community engagement',
      default: 'Awareness & retargeting',
    },
    maps: {
      default: 'Local discovery & traffic',
    },
    display: {
      brand_awareness: 'Broad awareness',
      default: 'Retargeting & awareness',
    },
    youtube: {
      brand_awareness: 'Video awareness',
      default: 'Video engagement',
    },
    radio: {
      brand_awareness: 'Mass awareness',
      default: 'Broad reach',
    },
  };

  const channelRoles = roles[channel] || {};
  return channelRoles[objective || 'default'] || channelRoles.default || 'Supporting channel';
}

function getChannelReasoning(channel: MediaChannel, percentage: number, isRequired: boolean): string {
  let reasoning = '';

  if (isRequired) {
    reasoning = 'Required channel based on historical performance. ';
  }

  if (percentage >= 30) {
    reasoning += 'Primary budget allocation reflecting strategic importance.';
  } else if (percentage >= 15) {
    reasoning += 'Significant allocation for balanced contribution.';
  } else if (percentage >= 5) {
    reasoning += 'Supporting allocation for diversification.';
  } else {
    reasoning += 'Test allocation for validation.';
  }

  return reasoning;
}

function getChannelExpectedOutcomes(channel: MediaChannel, budget: number): string {
  const cpaEstimates: Partial<Record<MediaChannel, number>> = {
    search: 150,
    lsa: 120,
    social: 180,
    maps: 100,
    display: 200,
    youtube: 250,
    radio: 300,
  };

  const cpa = cpaEstimates[channel] || 175;
  const conversions = Math.round(budget / cpa);

  return `~${conversions} conversions at estimated $${cpa} CPA`;
}

function getChannelTactics(channel: MediaChannel): string[] {
  const tactics: Record<string, string[]> = {
    search: ['Branded campaigns', 'Non-brand keywords', 'Competitor conquesting'],
    lsa: ['Service category optimization', 'Review management', 'Budget pacing'],
    social: ['Prospecting campaigns', 'Retargeting', 'Lookalike audiences'],
    maps: ['GBP optimization', 'Local campaigns', 'Review response'],
    display: ['Remarketing lists', 'Custom intent audiences', 'Responsive ads'],
    youtube: ['TrueView in-stream', 'Bumper ads', 'Custom intent targeting'],
    radio: ['Drive-time spots', 'Frequency optimization', 'Local market focus'],
  };

  return tactics[channel] || ['Standard optimization', 'Performance monitoring'];
}

function getKpiTarget(kpi: string, inputs: MediaPlanningInputs): string | undefined {
  const kpiLower = kpi.toLowerCase();

  if (kpiLower.includes('cpa') && inputs.objectivesKpis.targetCpa) {
    return `$${inputs.objectivesKpis.targetCpa}`;
  }
  if (kpiLower.includes('cpl') && inputs.objectivesKpis.targetCpl) {
    return `$${inputs.objectivesKpis.targetCpl}`;
  }
  if (kpiLower.includes('roas') && inputs.objectivesKpis.targetRoas) {
    return `${inputs.objectivesKpis.targetRoas}x`;
  }

  return undefined;
}

// ============================================================================
// Export Formatters
// ============================================================================

/**
 * Format plan summary as markdown document
 */
export function formatPlanAsMarkdownV2(summary: ComprehensivePlanSummary): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${summary.planName}`);
  lines.push(`*Generated: ${new Date(summary.generatedAt).toLocaleDateString()}*`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push(summary.execSummary);
  lines.push('');

  // Strategic Context
  lines.push('## Strategic Context');
  lines.push('');
  lines.push('### Business Context');
  lines.push(summary.strategicContext.businessContext);
  lines.push('');
  lines.push('### Market Position');
  lines.push(summary.strategicContext.marketPosition);
  lines.push('');
  lines.push('### Competitive Landscape');
  lines.push(summary.strategicContext.competitiveLandscape);
  lines.push('');
  lines.push('### Seasonality');
  lines.push(summary.strategicContext.seasonalityNotes);
  lines.push('');
  if (summary.strategicContext.keyConstraints.length > 0) {
    lines.push('### Key Constraints');
    for (const constraint of summary.strategicContext.keyConstraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push('');
  }

  // Channel Strategy
  lines.push('## Channel Strategy');
  lines.push(summary.channelStrategy.overview);
  lines.push('');
  lines.push(`**Total Budget:** $${summary.channelStrategy.totalBudget.toLocaleString()}`);
  lines.push(`**Active Channels:** ${summary.channelStrategy.channelCount}`);
  lines.push('');

  for (const channel of summary.channelStrategy.channels) {
    lines.push(`### ${channel.name} (${channel.percentage}%)`);
    lines.push(`- **Budget:** $${channel.budget.toLocaleString()}`);
    lines.push(`- **Role:** ${channel.role}`);
    lines.push(`- **Rationale:** ${channel.reasoning}`);
    lines.push(`- **Expected:** ${channel.expectedOutcomes}`);
    lines.push(`- **Key Tactics:** ${channel.keyTactics.join(', ')}`);
    lines.push('');
  }

  // Geo Strategy
  lines.push('## Geographic Strategy');
  lines.push(`**Approach:** ${summary.geoStrategy.approach}`);
  lines.push(`**Allocation:** ${summary.geoStrategy.allocationMethod}`);
  if (summary.geoStrategy.priorityMarkets.length > 0) {
    lines.push(`**Priority Markets:** ${summary.geoStrategy.priorityMarkets.join(', ')}`);
  }
  lines.push(`**Local Notes:** ${summary.geoStrategy.localConsiderations}`);
  lines.push('');

  // Audience Strategy
  lines.push('## Audience Strategy');
  lines.push(`**Approach:** ${summary.audienceStrategy.targetingApproach}`);
  lines.push('');
  lines.push('**Primary Audiences:**');
  for (const aud of summary.audienceStrategy.primaryAudiences) {
    lines.push(`- ${aud}`);
  }
  lines.push('');
  lines.push(`**Demographics:** ${summary.audienceStrategy.demographicProfile}`);
  lines.push('');
  lines.push('**Behavioral Signals:**');
  for (const sig of summary.audienceStrategy.behavioralSignals) {
    lines.push(`- ${sig}`);
  }
  lines.push('');

  // Creative Strategy
  lines.push('## Creative Strategy');
  lines.push(summary.creativeStrategy.overview);
  lines.push('');
  lines.push('**Key Messages:**');
  for (const msg of summary.creativeStrategy.keyMessages) {
    lines.push(`- ${msg}`);
  }
  lines.push('');
  lines.push(`**Calls to Action:** ${summary.creativeStrategy.callsToAction.join(' | ')}`);
  lines.push('');
  if (summary.creativeStrategy.formatRequirements.length > 0) {
    lines.push('**Format Requirements:**');
    lines.push('| Channel | Format | Qty | Priority |');
    lines.push('|---------|--------|-----|----------|');
    for (const fmt of summary.creativeStrategy.formatRequirements) {
      lines.push(`| ${fmt.channel} | ${fmt.format} | ${fmt.quantity} | ${fmt.priority} |`);
    }
    lines.push('');
  }

  // Measurement Framework
  lines.push('## Measurement Framework');
  lines.push(summary.measurementFramework.framework);
  lines.push('');
  lines.push('**Primary KPIs:**');
  for (const kpi of summary.measurementFramework.primaryKpis) {
    const target = kpi.target ? ` (Target: ${kpi.target})` : '';
    lines.push(`- ${kpi.metric}${target}`);
  }
  lines.push('');
  lines.push(`**Secondary KPIs:** ${summary.measurementFramework.secondaryKpis.join(', ')}`);
  lines.push('');
  lines.push('**Tracking Requirements:**');
  for (const req of summary.measurementFramework.trackingRequirements) {
    lines.push(`- ${req}`);
  }
  lines.push('');

  // Testing Agenda
  lines.push('## Testing Agenda');
  lines.push(summary.testingAgenda.overview);
  lines.push('');
  if (summary.testingAgenda.tests.length > 0) {
    for (const test of summary.testingAgenda.tests) {
      lines.push(`### ${test.name}`);
      lines.push(`- **Hypothesis:** ${test.hypothesis}`);
      lines.push(`- **Budget:** $${test.budget.toLocaleString()}`);
      lines.push(`- **Duration:** ${test.duration}`);
      lines.push(`- **Success Metric:** ${test.successMetric}`);
      lines.push('');
    }
  }
  lines.push('**Learning Agenda:**');
  for (const item of summary.testingAgenda.learningAgenda) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  // Risk Assessment
  lines.push('## Risk Assessment');
  lines.push(summary.riskAssessment.overallAssessment);
  lines.push('');
  if (summary.riskAssessment.risks.length > 0) {
    lines.push('**Identified Risks:**');
    for (const risk of summary.riskAssessment.risks) {
      lines.push(`- **${risk.category}:** ${risk.description} (${risk.severity})`);
      lines.push(`  - *Mitigation:* ${risk.mitigation}`);
    }
    lines.push('');
  }

  // Implementation Roadmap
  lines.push('## Implementation Roadmap');
  lines.push(summary.implementationRoadmap.overview);
  lines.push('');
  for (const phase of summary.implementationRoadmap.phases) {
    lines.push(`### ${phase.name} (${phase.duration})`);
    lines.push(`**Budget:** ${phase.budget}`);
    lines.push('**Activities:**');
    for (const act of phase.activities) {
      lines.push(`- ${act}`);
    }
    lines.push(`**Success Criteria:** ${phase.successCriteria}`);
    lines.push('');
  }
  lines.push('**Checkpoints:**');
  for (const cp of summary.implementationRoadmap.checkpoints) {
    lines.push(`- ${cp}`);
  }
  lines.push('');

  // Forecast
  lines.push('## Projected Results');
  lines.push(summary.forecast.summary);
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  for (const metric of summary.forecast.metrics) {
    lines.push(`| ${metric.metric} | ${metric.value} |`);
  }
  lines.push('');
  lines.push(`**Confidence:** ${summary.forecast.confidenceLevel}`);
  lines.push('');

  // Input Summary
  lines.push('---');
  lines.push('## Input Summary');
  lines.push(`**Completeness:** ${summary.inputSummary.completeness}%`);
  lines.push(`**Data Sources:** ${summary.inputSummary.dataSourcesUsed.join(', ')}`);
  lines.push(`**Categories Provided:** ${summary.inputSummary.categoriesProvided.join(', ')}`);
  if (summary.inputSummary.categoriesMissing.length > 0) {
    lines.push(`**Categories Missing:** ${summary.inputSummary.categoriesMissing.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format plan summary as JSON
 */
export function formatPlanAsJsonV2(summary: ComprehensivePlanSummary): string {
  return JSON.stringify(summary, null, 2);
}
