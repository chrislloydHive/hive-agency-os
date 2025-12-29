// lib/autopilot/quarterlyPlanner.ts
// Phase 5: Quarterly Planning Engine
//
// Generates comprehensive 12-week strategic plans including:
// - Channel overview and recommendations
// - Budget distribution by week
// - Creative roadmap
// - Messaging priorities
// - Geo targets
// - Expected impact projections
// - Risk assessment
// - KPIs and milestones

import Anthropic from '@anthropic-ai/sdk';
import type { CompanyContextGraph } from '../contextGraph/companyContextGraph';
import type {
  QuarterlyPlan,
  WeeklyBudget,
  ChannelStrategy,
  CreativeRoadmap,
  QuarterlyKPI,
  RiskAssessment,
  Milestone,
} from './types';

// ============================================================================
// AI Client
// ============================================================================

const anthropic = new Anthropic();

// ============================================================================
// Quarterly Plan Generation
// ============================================================================

/**
 * Generate a comprehensive quarterly plan
 */
export async function generateQuarterlyPlan(
  companyId: string,
  graph: CompanyContextGraph,
  options: {
    startDate?: string;
    totalBudget?: number;
    focusAreas?: string[];
    constraints?: string[];
    previousPlanId?: string;
  } = {}
): Promise<QuarterlyPlan> {
  const now = new Date();
  const startDate = options.startDate ? new Date(options.startDate) : getNextQuarterStart(now);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 84); // 12 weeks

  const quarterName = getQuarterName(startDate);

  // Extract context
  const totalBudget = options.totalBudget ||
    (graph.budgetOps?.mediaSpendBudget?.value as number || 50000) * 3;
  const activeChannels = graph.performanceMedia?.activeChannels?.value as string[] || [];
  const primaryGoal = graph.objectives?.primaryObjective?.value as string || 'growth';
  const _targetAudiences = graph.audience?.coreSegments?.value as string[] || [];
  const seasonalNotes = graph.identity?.seasonalityNotes?.value as string || '';
  const peakSeasons = graph.identity?.peakSeasons?.value as string[] || [];

  // Generate plan components
  const channelStrategies = generateChannelStrategies(
    activeChannels,
    totalBudget,
    primaryGoal,
    graph
  );

  const weeklyBudgets = generateWeeklyBudgets(
    totalBudget,
    startDate,
    peakSeasons,
    channelStrategies
  );

  const creativeRoadmap = generateCreativeRoadmap(
    startDate,
    graph,
    channelStrategies
  );

  const messagingPriorities = generateMessagingPriorities(graph);
  const geoTargets = generateGeoTargets(graph);
  const kpis = generateKPIs(primaryGoal, totalBudget, graph);
  const risks = assessRisks(graph, channelStrategies, totalBudget);
  const milestones = generateMilestones(startDate, kpis);

  // Generate AI executive summary
  const executiveSummary = await generateExecutiveSummary(
    companyId,
    graph,
    quarterName,
    totalBudget,
    channelStrategies,
    kpis
  );

  const plan: QuarterlyPlan = {
    id: `qplan_${Date.now()}`,
    companyId,
    quarter: quarterName,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    status: 'draft',

    executiveSummary,

    totalBudget,
    weeklyBudgets,
    channelStrategies,

    creativeRoadmap,
    messagingPriorities,
    geoTargets,

    kpis,
    expectedImpact: calculateExpectedImpact(kpis, graph),
    risks,
    milestones,

    constraints: options.constraints || [],
    assumptions: generateAssumptions(graph),

    previousPlanId: options.previousPlanId,

    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    createdBy: 'autopilot',
  };

  return plan;
}

// ============================================================================
// Channel Strategy Generation
// ============================================================================

function generateChannelStrategies(
  activeChannels: string[],
  totalBudget: number,
  primaryGoal: string,
  graph: CompanyContextGraph
): ChannelStrategy[] {
  const strategies: ChannelStrategy[] = [];

  // Default channel allocations based on goal
  const goalAllocations: Record<string, Record<string, number>> = {
    growth: {
      google_ads: 0.35,
      meta_ads: 0.30,
      tiktok_ads: 0.15,
      youtube: 0.10,
      programmatic: 0.10,
    },
    awareness: {
      youtube: 0.25,
      meta_ads: 0.25,
      programmatic: 0.20,
      tiktok_ads: 0.20,
      google_ads: 0.10,
    },
    conversions: {
      google_ads: 0.45,
      meta_ads: 0.30,
      retargeting: 0.15,
      youtube: 0.10,
    },
    retention: {
      meta_ads: 0.35,
      google_ads: 0.25,
      email: 0.20,
      programmatic: 0.20,
    },
  };

  const baseAllocations = goalAllocations[primaryGoal.toLowerCase()] || goalAllocations.growth;

  // Filter to active channels and normalize
  const relevantChannels = activeChannels.length > 0 ? activeChannels : Object.keys(baseAllocations);
  let totalAllocation = 0;

  for (const channel of relevantChannels) {
    totalAllocation += baseAllocations[channel] || 0.1;
  }

  for (const channel of relevantChannels) {
    const rawAllocation = baseAllocations[channel] || 0.1;
    const normalizedAllocation = rawAllocation / totalAllocation;
    const channelBudget = totalBudget * normalizedAllocation;

    strategies.push({
      channel,
      allocation: normalizedAllocation * 100,
      quarterlyBudget: channelBudget,
      monthlyBudget: channelBudget / 3,

      objectives: getChannelObjectives(channel, primaryGoal),
      tactics: getChannelTactics(channel, primaryGoal),
      targetMetrics: getChannelTargetMetrics(channel, graph),

      priority: normalizedAllocation > 0.25 ? 'high' : normalizedAllocation > 0.1 ? 'medium' : 'low',
      status: 'planned',
    });
  }

  return strategies.sort((a, b) => b.allocation - a.allocation);
}

function getChannelObjectives(channel: string, goal: string): string[] {
  const objectiveMap: Record<string, Record<string, string[]>> = {
    google_ads: {
      growth: ['Capture high-intent search demand', 'Scale shopping campaigns', 'Optimize ROAS'],
      awareness: ['Increase brand search volume', 'Expand discovery campaigns'],
      conversions: ['Maximize conversion volume', 'Lower CPA through optimization'],
      retention: ['Re-engage past converters', 'Promote loyalty programs'],
    },
    meta_ads: {
      growth: ['Scale lookalike audiences', 'Test new creative angles', 'Optimize for purchases'],
      awareness: ['Maximize reach in target demos', 'Build brand recall', 'Drive engagement'],
      conversions: ['Optimize for add-to-cart', 'Scale retargeting', 'Test conversion campaigns'],
      retention: ['Re-engage dormant customers', 'Promote repeat purchases'],
    },
    tiktok_ads: {
      growth: ['Reach Gen Z/Millennial audiences', 'Test viral content formats', 'Scale winning ads'],
      awareness: ['Build brand presence', 'Partner with creators', 'Maximize video views'],
      conversions: ['Test shopping integration', 'Optimize for conversions'],
      retention: ['Re-engage with trending content', 'Build community'],
    },
    youtube: {
      growth: ['Drive consideration through video', 'Retarget engaged viewers'],
      awareness: ['Maximize reach through skippable ads', 'Build brand story'],
      conversions: ['Use action campaigns', 'Optimize for site visits'],
      retention: ['Nurture existing customers', 'Share educational content'],
    },
    programmatic: {
      growth: ['Expand reach through DSP', 'Test new inventory sources'],
      awareness: ['Maximize impressions', 'Build frequency across sites'],
      conversions: ['Optimize for conversions', 'Use dynamic creative'],
      retention: ['Retarget across the web', 'Sequential messaging'],
    },
  };

  return objectiveMap[channel]?.[goal.toLowerCase()] ||
    objectiveMap[channel]?.['growth'] ||
    ['Optimize channel performance', 'Test and learn'];
}

function getChannelTactics(channel: string, goal: string): string[] {
  const tacticMap: Record<string, string[]> = {
    google_ads: [
      'Implement automated bidding strategies',
      'Expand keyword coverage',
      'Test responsive search ads',
      'Optimize audience targeting',
    ],
    meta_ads: [
      'Test Advantage+ campaigns',
      'Scale winning creative',
      'Implement conversion API',
      'Test new placements',
    ],
    tiktok_ads: [
      'Partner with TikTok creators',
      'Test spark ads',
      'Use native video formats',
      'Leverage trending sounds',
    ],
    youtube: [
      'Create multiple video lengths',
      'Test bumper ads',
      'Use custom intent audiences',
      'Implement video action campaigns',
    ],
    programmatic: [
      'Test contextual targeting',
      'Implement frequency caps',
      'Use deal IDs for premium inventory',
      'Test CTV placements',
    ],
  };

  return tacticMap[channel] || ['Optimize based on performance data', 'Test new approaches'];
}

function getChannelTargetMetrics(
  channel: string,
  graph: CompanyContextGraph
): Record<string, number> {
  // Base metrics with channel-specific adjustments
  const currentCPA = graph.objectives?.targetCpa?.value as number || 50;
  const currentROAS = graph.objectives?.targetRoas?.value as number || 3;

  const channelMultipliers: Record<string, { cpa: number; roas: number; ctr: number }> = {
    google_ads: { cpa: 1.0, roas: 1.2, ctr: 0.03 },
    meta_ads: { cpa: 0.9, roas: 1.0, ctr: 0.01 },
    tiktok_ads: { cpa: 0.85, roas: 0.8, ctr: 0.008 },
    youtube: { cpa: 1.2, roas: 0.7, ctr: 0.005 },
    programmatic: { cpa: 1.3, roas: 0.6, ctr: 0.002 },
  };

  const multipliers = channelMultipliers[channel] || { cpa: 1.0, roas: 1.0, ctr: 0.01 };

  return {
    target_cpa: Math.round(currentCPA * multipliers.cpa),
    target_roas: Math.round(currentROAS * multipliers.roas * 10) / 10,
    target_ctr: multipliers.ctr,
  };
}

// ============================================================================
// Weekly Budget Generation
// ============================================================================

function generateWeeklyBudgets(
  totalBudget: number,
  startDate: Date,
  seasonalPatterns: string[],
  channelStrategies: ChannelStrategy[]
): WeeklyBudget[] {
  const weeklyBudgets: WeeklyBudget[] = [];
  const weeklyBase = totalBudget / 12;

  // Seasonal adjustments based on patterns
  const weeklyMultipliers = calculateSeasonalMultipliers(startDate, seasonalPatterns);

  for (let week = 1; week <= 12; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const multiplier = weeklyMultipliers[week - 1] || 1.0;
    const weekBudget = weeklyBase * multiplier;

    // Distribute across channels
    const channelBudgets: Record<string, number> = {};
    for (const strategy of channelStrategies) {
      channelBudgets[strategy.channel] = weekBudget * (strategy.allocation / 100);
    }

    weeklyBudgets.push({
      week,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      totalBudget: weekBudget,
      channelBudgets,
      notes: getWeeklyNotes(week, startDate, seasonalPatterns),
      adjustmentReason: multiplier !== 1.0 ? 'Seasonal adjustment' : undefined,
    });
  }

  return weeklyBudgets;
}

function calculateSeasonalMultipliers(startDate: Date, seasonalPatterns: string[]): number[] {
  const multipliers: number[] = new Array(12).fill(1.0);

  // Check for holiday patterns
  const hasHolidaySeason = seasonalPatterns.some(p =>
    p.toLowerCase().includes('holiday') || p.toLowerCase().includes('christmas')
  );

  const hasSummerSeason = seasonalPatterns.some(p =>
    p.toLowerCase().includes('summer')
  );

  const hasBackToSchool = seasonalPatterns.some(p =>
    p.toLowerCase().includes('school') || p.toLowerCase().includes('fall')
  );

  // Apply seasonal adjustments based on quarter
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;

  if (quarter === 4 && hasHolidaySeason) {
    // Q4 holiday ramp-up
    multipliers[6] = 1.1;  // Week 7
    multipliers[7] = 1.2;  // Week 8
    multipliers[8] = 1.3;  // Week 9
    multipliers[9] = 1.4;  // Week 10
    multipliers[10] = 1.5; // Week 11 (Black Friday)
    multipliers[11] = 1.3; // Week 12 (Christmas)
  } else if (quarter === 3 && hasBackToSchool) {
    // Q3 back-to-school
    multipliers[4] = 1.2;  // August
    multipliers[5] = 1.3;
    multipliers[6] = 1.2;
    multipliers[7] = 1.1;
  } else if (quarter === 2 && hasSummerSeason) {
    // Q2 summer ramp
    multipliers[8] = 1.2;
    multipliers[9] = 1.3;
    multipliers[10] = 1.3;
    multipliers[11] = 1.2;
  }

  // Normalize to ensure total matches budget
  const total = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(m => (m / total) * 12);
}

function getWeeklyNotes(week: number, startDate: Date, seasonalPatterns: string[]): string {
  const weekDate = new Date(startDate);
  weekDate.setDate(weekDate.getDate() + (week - 1) * 7);

  const month = weekDate.toLocaleString('default', { month: 'long' });
  const dayOfMonth = weekDate.getDate();

  // Check for notable dates
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;

  if (quarter === 4) {
    if (week === 10 || week === 11) {
      return 'Black Friday / Cyber Monday - Peak spending week';
    }
    if (week === 12) {
      return 'Holiday season - Focus on gift messaging';
    }
  }

  if (week === 1) {
    return 'Quarter kickoff - Launch new campaigns';
  }

  if (week === 6) {
    return 'Mid-quarter review - Adjust based on performance';
  }

  if (week === 12) {
    return 'Quarter close - Optimize for end-of-quarter targets';
  }

  return `${month} Week ${Math.ceil(dayOfMonth / 7)}`;
}

// ============================================================================
// Creative Roadmap Generation
// ============================================================================

function generateCreativeRoadmap(
  startDate: Date,
  graph: CompanyContextGraph,
  channelStrategies: ChannelStrategy[]
): CreativeRoadmap {
  const themes = generateQuarterlyThemes(startDate, graph);
  const formats = generateFormatRecommendations(channelStrategies);
  const refreshSchedule = generateRefreshSchedule(startDate);
  const testingPlan = generateCreativeTestingPlan(channelStrategies);

  return {
    themes,
    formats,
    refreshSchedule,
    testingPlan,
    productionNeeds: generateProductionNeeds(formats, channelStrategies),
  };
}

function generateQuarterlyThemes(startDate: Date, graph: CompanyContextGraph): string[] {
  const quarter = Math.floor(startDate.getMonth() / 3) + 1;
  const brand = graph.brand;

  const baseThemes: string[] = [];

  // Add brand-specific themes
  const valueProps = brand?.valueProps?.value as string[] | undefined;
  if (valueProps && valueProps.length > 0) {
    baseThemes.push(valueProps[0]);
  }

  // Add seasonal themes
  const seasonalThemes: Record<number, string[]> = {
    1: ['New Year / Fresh Start', 'Winter Solutions', 'Q1 Planning'],
    2: ['Spring Renewal', 'Tax Season', 'Summer Planning'],
    3: ['Summer Lifestyle', 'Back to School', 'Mid-Year Review'],
    4: ['Holiday Prep', 'Gift Guide', 'Year-End Deals'],
  };

  baseThemes.push(...(seasonalThemes[quarter] || []));

  // Add goal-specific themes
  const primaryGoal = graph.objectives?.primaryObjective?.value as string | undefined;
  if (primaryGoal?.toLowerCase().includes('awareness')) {
    baseThemes.push('Brand Story', 'Why Us');
  } else if (primaryGoal?.toLowerCase().includes('conversion')) {
    baseThemes.push('Product Benefits', 'Customer Success');
  }

  return baseThemes.slice(0, 5);
}

function generateFormatRecommendations(
  channelStrategies: ChannelStrategy[]
): Record<string, string[]> {
  const formats: Record<string, string[]> = {};

  for (const strategy of channelStrategies) {
    const channelFormats: Record<string, string[]> = {
      google_ads: ['Responsive Search Ads', 'Performance Max', 'Discovery Ads'],
      meta_ads: ['Single Image', 'Carousel', 'Video 15s', 'Video 30s', 'Collection'],
      tiktok_ads: ['Spark Ads', 'TopView', 'In-Feed Video', 'Branded Effect'],
      youtube: ['Skippable 15s', 'Skippable 30s', 'Bumper 6s', 'Discovery'],
      programmatic: ['Display 300x250', 'Display 728x90', 'Native', 'Video'],
    };

    formats[strategy.channel] = channelFormats[strategy.channel] || ['Standard formats'];
  }

  return formats;
}

function generateRefreshSchedule(startDate: Date): Array<{ week: number; action: string }> {
  return [
    { week: 1, action: 'Launch new quarterly creative' },
    { week: 3, action: 'First performance review - pause underperformers' },
    { week: 4, action: 'Introduce new variations of top performers' },
    { week: 6, action: 'Mid-quarter creative refresh' },
    { week: 8, action: 'Test new messaging angles' },
    { week: 10, action: 'Final quarter push - scale winners' },
    { week: 12, action: 'Begin next quarter creative production' },
  ];
}

function generateCreativeTestingPlan(
  channelStrategies: ChannelStrategy[]
): Array<{ test: string; channel: string; duration: string }> {
  const tests: Array<{ test: string; channel: string; duration: string }> = [];

  // Add channel-specific tests
  for (const strategy of channelStrategies) {
    if (strategy.priority === 'high') {
      tests.push({
        test: `${strategy.channel} - Messaging angle test`,
        channel: strategy.channel,
        duration: '2 weeks',
      });
      tests.push({
        test: `${strategy.channel} - Format comparison test`,
        channel: strategy.channel,
        duration: '3 weeks',
      });
    } else if (strategy.priority === 'medium') {
      tests.push({
        test: `${strategy.channel} - Creative refresh test`,
        channel: strategy.channel,
        duration: '2 weeks',
      });
    }
  }

  return tests;
}

function generateProductionNeeds(
  formats: Record<string, string[]>,
  channelStrategies: ChannelStrategy[]
): string[] {
  const needs: string[] = [];

  // Count video needs
  const videoChannels = ['meta_ads', 'tiktok_ads', 'youtube'];
  const hasVideoChannels = channelStrategies.some(s => videoChannels.includes(s.channel));

  if (hasVideoChannels) {
    needs.push('Video production: 3-5 hero videos (15s, 30s versions)');
    needs.push('Video editing: 10+ cut-downs and variations');
  }

  // Count static needs
  const staticChannels = ['google_ads', 'meta_ads', 'programmatic'];
  const hasStaticChannels = channelStrategies.some(s => staticChannels.includes(s.channel));

  if (hasStaticChannels) {
    needs.push('Static design: 15-20 ad units across sizes');
    needs.push('Copywriting: 20+ headline and description variants');
  }

  // TikTok specific
  if (channelStrategies.some(s => s.channel === 'tiktok_ads')) {
    needs.push('UGC content: 5-10 creator-style videos');
  }

  return needs;
}

// ============================================================================
// KPIs and Projections
// ============================================================================

function generateKPIs(
  primaryGoal: string,
  totalBudget: number,
  graph: CompanyContextGraph
): QuarterlyKPI[] {
  const kpis: QuarterlyKPI[] = [];

  // Always include core KPIs
  const currentCPA = graph.objectives?.targetCpa?.value as number || 50;
  const currentROAS = graph.objectives?.targetRoas?.value as number || 3;

  // Revenue KPI
  const projectedRevenue = totalBudget * currentROAS;
  kpis.push({
    metric: 'Revenue',
    target: projectedRevenue,
    unit: 'dollars',
    baseline: projectedRevenue * 0.9,
    stretch: projectedRevenue * 1.15,
    priority: 'high',
    measurementMethod: 'Platform + Analytics',
  });

  // Conversion KPI
  const projectedConversions = Math.round(totalBudget / currentCPA);
  kpis.push({
    metric: 'Conversions',
    target: projectedConversions,
    unit: 'count',
    baseline: Math.round(projectedConversions * 0.9),
    stretch: Math.round(projectedConversions * 1.2),
    priority: 'high',
    measurementMethod: 'Platform tracking',
  });

  // CPA KPI
  kpis.push({
    metric: 'CPA',
    target: currentCPA,
    unit: 'dollars',
    baseline: currentCPA * 1.1,
    stretch: currentCPA * 0.9,
    priority: 'high',
    measurementMethod: 'Platform + Analytics',
  });

  // ROAS KPI
  kpis.push({
    metric: 'ROAS',
    target: currentROAS,
    unit: 'ratio',
    baseline: currentROAS * 0.9,
    stretch: currentROAS * 1.2,
    priority: 'high',
    measurementMethod: 'Platform + Analytics',
  });

  // Goal-specific KPIs
  if (primaryGoal.toLowerCase().includes('awareness')) {
    kpis.push({
      metric: 'Reach',
      target: Math.round(totalBudget * 100),
      unit: 'people',
      baseline: Math.round(totalBudget * 80),
      stretch: Math.round(totalBudget * 120),
      priority: 'medium',
      measurementMethod: 'Platform reporting',
    });

    kpis.push({
      metric: 'Brand Search Volume',
      target: 1.2,
      unit: 'multiplier',
      baseline: 1.0,
      stretch: 1.5,
      priority: 'medium',
      measurementMethod: 'Google Search Console',
    });
  }

  return kpis;
}

function calculateExpectedImpact(
  kpis: QuarterlyKPI[],
  graph: CompanyContextGraph
): {
  revenue: { min: number; expected: number; max: number };
  conversions: { min: number; expected: number; max: number };
  efficiency: { cpa: number; roas: number };
} {
  const revenueKPI = kpis.find(k => k.metric === 'Revenue');
  const conversionsKPI = kpis.find(k => k.metric === 'Conversions');
  const cpaKPI = kpis.find(k => k.metric === 'CPA');
  const roasKPI = kpis.find(k => k.metric === 'ROAS');

  return {
    revenue: {
      min: revenueKPI?.baseline || 0,
      expected: revenueKPI?.target || 0,
      max: revenueKPI?.stretch || 0,
    },
    conversions: {
      min: conversionsKPI?.baseline || 0,
      expected: conversionsKPI?.target || 0,
      max: conversionsKPI?.stretch || 0,
    },
    efficiency: {
      cpa: cpaKPI?.target || 50,
      roas: roasKPI?.target || 3,
    },
  };
}

// ============================================================================
// Risk Assessment
// ============================================================================

function assessRisks(
  graph: CompanyContextGraph,
  channelStrategies: ChannelStrategy[],
  totalBudget: number
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  // Budget concentration risk
  const topChannelAllocation = Math.max(...channelStrategies.map(s => s.allocation));
  if (topChannelAllocation > 50) {
    risks.push({
      id: `risk_concentration_${Date.now()}`,
      category: 'budget',
      title: 'Channel Concentration Risk',
      description: `Over ${topChannelAllocation.toFixed(0)}% of budget in single channel`,
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Diversify budget across additional channels',
      owner: 'Media Team',
    });
  }

  // Creative fatigue risk
  risks.push({
    id: `risk_creative_${Date.now()}`,
    category: 'creative',
    title: 'Creative Fatigue',
    description: 'Extended use of same creative assets may reduce performance',
    likelihood: 'high',
    impact: 'medium',
    mitigation: 'Plan for monthly creative refreshes',
    owner: 'Creative Team',
  });

  // Platform changes risk
  risks.push({
    id: `risk_platform_${Date.now()}`,
    category: 'external',
    title: 'Platform Algorithm Changes',
    description: 'Social platforms may change algorithms affecting performance',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: 'Maintain diversified channel mix',
    owner: 'Media Team',
  });

  // Competitive risk
  risks.push({
    id: `risk_competitive_${Date.now()}`,
    category: 'competitive',
    title: 'Increased Competition',
    description: 'Competitors may increase spend during peak periods',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: 'Reserve budget flexibility for competitive response',
    owner: 'Strategy Team',
  });

  // Tracking/measurement risk
  risks.push({
    id: `risk_tracking_${Date.now()}`,
    category: 'technical',
    title: 'Attribution Challenges',
    description: 'Privacy changes may impact conversion tracking accuracy',
    likelihood: 'high',
    impact: 'high',
    mitigation: 'Implement server-side tracking and MMM',
    owner: 'Analytics Team',
  });

  return risks;
}

// ============================================================================
// Milestones
// ============================================================================

function generateMilestones(startDate: Date, kpis: QuarterlyKPI[]): Milestone[] {
  const milestones: Milestone[] = [];

  // Week 1: Launch
  const week1 = new Date(startDate);
  milestones.push({
    id: `milestone_launch_${Date.now()}`,
    week: 1,
    date: week1.toISOString().split('T')[0],
    title: 'Quarter Launch',
    description: 'All campaigns live with new creative',
    criteria: ['All channels active', 'New creative deployed', 'Tracking verified'],
    status: 'pending',
  });

  // Week 4: First checkpoint
  const week4 = new Date(startDate);
  week4.setDate(week4.getDate() + 21);
  milestones.push({
    id: `milestone_checkpoint1_${Date.now()}`,
    week: 4,
    date: week4.toISOString().split('T')[0],
    title: 'First Month Review',
    description: 'Evaluate initial performance and adjust',
    criteria: ['25% of quarterly conversions', 'CPA within 10% of target', 'All tests launched'],
    status: 'pending',
  });

  // Week 8: Mid-quarter
  const week8 = new Date(startDate);
  week8.setDate(week8.getDate() + 49);
  milestones.push({
    id: `milestone_midquarter_${Date.now()}`,
    week: 8,
    date: week8.toISOString().split('T')[0],
    title: 'Mid-Quarter Review',
    description: 'Major strategy adjustment point',
    criteria: ['60% of quarterly conversions', 'Test results analyzed', 'Budget reallocation complete'],
    status: 'pending',
  });

  // Week 12: Close
  const week12 = new Date(startDate);
  week12.setDate(week12.getDate() + 77);
  milestones.push({
    id: `milestone_close_${Date.now()}`,
    week: 12,
    date: week12.toISOString().split('T')[0],
    title: 'Quarter Close',
    description: 'Final results and next quarter planning',
    criteria: ['100% of targets met', 'Learnings documented', 'Next quarter plan drafted'],
    status: 'pending',
  });

  return milestones;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNextQuarterStart(date: Date): Date {
  const currentQuarter = Math.floor(date.getMonth() / 3);
  const nextQuarterMonth = (currentQuarter + 1) * 3;

  if (nextQuarterMonth >= 12) {
    return new Date(date.getFullYear() + 1, 0, 1);
  }

  return new Date(date.getFullYear(), nextQuarterMonth, 1);
}

function getQuarterName(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter} ${date.getFullYear()}`;
}

function generateMessagingPriorities(graph: CompanyContextGraph): string[] {
  const priorities: string[] = [];

  // From brand positioning
  const valueProps = graph.brand?.valueProps?.value as string[] | undefined;
  if (valueProps) {
    priorities.push(...valueProps.slice(0, 2));
  }

  // From differentiators
  const differentiators = graph.brand?.differentiators?.value as string[] | undefined;
  if (differentiators) {
    priorities.push(...differentiators.slice(0, 2));
  }

  // Default priorities
  if (priorities.length === 0) {
    priorities.push(
      'Core product benefits',
      'Customer success stories',
      'Competitive advantages'
    );
  }

  return priorities.slice(0, 5);
}

function generateGeoTargets(graph: CompanyContextGraph): string[] {
  const markets = graph.audience?.primaryMarkets?.value as string[] | undefined;
  return markets || ['United States'];
}

function generateAssumptions(graph: CompanyContextGraph): string[] {
  return [
    'Market conditions remain stable',
    'Platform costs remain within historical ranges',
    'Creative assets delivered on schedule',
    'Tracking infrastructure remains functional',
    'No major competitive disruptions',
  ];
}

// ============================================================================
// AI Executive Summary Generation
// ============================================================================

async function generateExecutiveSummary(
  companyId: string,
  graph: CompanyContextGraph,
  quarterName: string,
  totalBudget: number,
  channelStrategies: ChannelStrategy[],
  kpis: QuarterlyKPI[]
): Promise<string> {
  const companyName = graph.identity?.businessName?.value as string || 'Company';
  const primaryGoal = graph.objectives?.primaryObjective?.value as string || 'growth';

  const topChannels = channelStrategies
    .slice(0, 3)
    .map(s => `${s.channel} (${s.allocation.toFixed(0)}%)`)
    .join(', ');

  const revenueKPI = kpis.find(k => k.metric === 'Revenue');
  const conversionsKPI = kpis.find(k => k.metric === 'Conversions');

  const prompt = `Write a concise executive summary (2-3 paragraphs) for a quarterly media plan:

Company: ${companyName}
Quarter: ${quarterName}
Total Budget: $${totalBudget.toLocaleString()}
Primary Goal: ${primaryGoal}
Top Channels: ${topChannels}
Target Revenue: $${revenueKPI?.target?.toLocaleString() || 'N/A'}
Target Conversions: ${conversionsKPI?.target?.toLocaleString() || 'N/A'}

The summary should:
1. Open with the strategic focus for the quarter
2. Highlight key channel investments and expected outcomes
3. Close with success criteria and main risks to monitor

Write in professional business language, be specific about numbers, and keep it under 200 words.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.type === 'text') {
      return textContent.text;
    }
  } catch (error) {
    console.error('Failed to generate executive summary:', error);
  }

  // Fallback summary
  return `${quarterName} Media Plan for ${companyName}

This quarter focuses on ${primaryGoal} with a total investment of $${totalBudget.toLocaleString()} across ${channelStrategies.length} channels. Primary investment will be concentrated in ${topChannels}, aligned with our audience reach and efficiency goals.

Target outcomes include ${conversionsKPI?.target?.toLocaleString() || 'growth'} conversions and $${revenueKPI?.target?.toLocaleString() || 'N/A'} in attributed revenue. Key risks include platform algorithm changes and competitive pressure during peak periods.`;
}

// ============================================================================
// Plan Management Functions
// ============================================================================

const quarterlyPlans = new Map<string, QuarterlyPlan[]>();

/**
 * Store a quarterly plan
 */
export function storeQuarterlyPlan(plan: QuarterlyPlan): void {
  const plans = quarterlyPlans.get(plan.companyId) || [];
  plans.push(plan);
  quarterlyPlans.set(plan.companyId, plans);
}

/**
 * Get quarterly plans for a company
 */
export function getQuarterlyPlans(companyId: string): QuarterlyPlan[] {
  return quarterlyPlans.get(companyId) || [];
}

/**
 * Get a specific quarterly plan
 */
export function getQuarterlyPlan(companyId: string, planId: string): QuarterlyPlan | null {
  const plans = quarterlyPlans.get(companyId) || [];
  return plans.find(p => p.id === planId) || null;
}

/**
 * Update a quarterly plan's status
 */
export function updatePlanStatus(
  companyId: string,
  planId: string,
  status: QuarterlyPlan['status']
): QuarterlyPlan | null {
  const plans = quarterlyPlans.get(companyId) || [];
  const planIndex = plans.findIndex(p => p.id === planId);

  if (planIndex === -1) return null;

  plans[planIndex] = {
    ...plans[planIndex],
    status,
    updatedAt: new Date().toISOString(),
  };

  quarterlyPlans.set(companyId, plans);
  return plans[planIndex];
}
