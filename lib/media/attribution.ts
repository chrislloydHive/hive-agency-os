// lib/media/attribution.ts
// Attribution Layer
//
// Multi-touch attribution modeling for media performance analysis.
// Supports multiple attribution models and journey analysis.

import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

export type AttributionModel =
  | 'last_click'
  | 'first_click'
  | 'linear'
  | 'time_decay'
  | 'position_based'
  | 'data_driven';

export interface TouchPoint {
  id: string;
  channel: MediaChannel;
  campaign?: string;
  timestamp: string;
  interactionType: 'impression' | 'click' | 'engagement' | 'visit';
  value?: number;
}

export interface ConversionEvent {
  id: string;
  type: 'lead' | 'sale' | 'phone_call' | 'form_submit' | 'store_visit' | 'appointment';
  value: number;
  timestamp: string;
  customerId?: string;
  touchPoints: TouchPoint[];
}

export interface AttributedConversion {
  conversionId: string;
  conversionType: ConversionEvent['type'];
  conversionValue: number;
  model: AttributionModel;
  channelCredits: ChannelCredit[];
  totalTouchPoints: number;
  journeyDuration: number; // in hours
}

export interface ChannelCredit {
  channel: MediaChannel;
  credit: number; // 0-1, percentage of conversion credit
  creditValue: number; // dollar value of credit
  touchPointCount: number;
  position: 'first' | 'middle' | 'last' | 'only';
}

export interface AttributionReport {
  companyId: string;
  mediaProgramId?: string;
  dateRange: { start: string; end: string };
  model: AttributionModel;
  totalConversions: number;
  totalValue: number;
  channelPerformance: ChannelAttributionSummary[];
  journeyAnalysis: JourneyAnalysis;
  modelComparison?: ModelComparison[];
}

export interface ChannelAttributionSummary {
  channel: MediaChannel;
  conversions: number;
  attributedValue: number;
  percentOfTotal: number;
  avgCreditPerConversion: number;
  firstTouchConversions: number;
  lastTouchConversions: number;
  assistedConversions: number;
  avgTouchPointsInJourney: number;
}

export interface JourneyAnalysis {
  avgTouchPoints: number;
  avgJourneyDuration: number; // hours
  commonPaths: JourneyPath[];
  channelSequences: ChannelSequence[];
}

export interface JourneyPath {
  path: MediaChannel[];
  conversions: number;
  avgValue: number;
  percentOfTotal: number;
}

export interface ChannelSequence {
  from: MediaChannel | 'entry';
  to: MediaChannel | 'conversion';
  count: number;
  conversionRate: number;
}

export interface ModelComparison {
  model: AttributionModel;
  channelCredits: Partial<Record<MediaChannel, number>>;
  insight: string;
}

// ============================================================================
// Attribution Calculation
// ============================================================================

/**
 * Calculate attribution for a set of conversions
 */
export function calculateAttribution(args: {
  conversions: ConversionEvent[];
  model: AttributionModel;
}): AttributedConversion[] {
  const { conversions, model } = args;

  return conversions.map((conversion) => {
    const credits = calculateCredits(conversion.touchPoints, model);
    const journeyDuration = calculateJourneyDuration(conversion.touchPoints);

    return {
      conversionId: conversion.id,
      conversionType: conversion.type,
      conversionValue: conversion.value,
      model,
      channelCredits: credits.map((credit) => ({
        ...credit,
        creditValue: credit.credit * conversion.value,
      })),
      totalTouchPoints: conversion.touchPoints.length,
      journeyDuration,
    };
  });
}

/**
 * Calculate credits based on attribution model
 */
function calculateCredits(
  touchPoints: TouchPoint[],
  model: AttributionModel
): Omit<ChannelCredit, 'creditValue'>[] {
  if (touchPoints.length === 0) {
    return [];
  }

  // Sort by timestamp
  const sorted = [...touchPoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Group by channel
  const channelTouchPoints = new Map<MediaChannel, TouchPoint[]>();
  for (const tp of sorted) {
    const existing = channelTouchPoints.get(tp.channel) || [];
    channelTouchPoints.set(tp.channel, [...existing, tp]);
  }

  const channels = Array.from(channelTouchPoints.keys());
  const credits: Omit<ChannelCredit, 'creditValue'>[] = [];

  switch (model) {
    case 'last_click':
      return calculateLastClickCredits(sorted, channelTouchPoints);

    case 'first_click':
      return calculateFirstClickCredits(sorted, channelTouchPoints);

    case 'linear':
      return calculateLinearCredits(sorted, channelTouchPoints);

    case 'time_decay':
      return calculateTimeDecayCredits(sorted, channelTouchPoints);

    case 'position_based':
      return calculatePositionBasedCredits(sorted, channelTouchPoints);

    case 'data_driven':
      // Simplified data-driven: weighted by engagement
      return calculateDataDrivenCredits(sorted, channelTouchPoints);

    default:
      return calculateLastClickCredits(sorted, channelTouchPoints);
  }
}

/**
 * Last-click attribution: 100% credit to last touchpoint
 */
function calculateLastClickCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const lastTouch = sorted[sorted.length - 1];
  const channels = Array.from(channelTouchPoints.keys());

  return channels.map((channel) => ({
    channel,
    credit: channel === lastTouch.channel ? 1 : 0,
    touchPointCount: channelTouchPoints.get(channel)?.length || 0,
    position: getChannelPosition(channel, sorted),
  }));
}

/**
 * First-click attribution: 100% credit to first touchpoint
 */
function calculateFirstClickCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const firstTouch = sorted[0];
  const channels = Array.from(channelTouchPoints.keys());

  return channels.map((channel) => ({
    channel,
    credit: channel === firstTouch.channel ? 1 : 0,
    touchPointCount: channelTouchPoints.get(channel)?.length || 0,
    position: getChannelPosition(channel, sorted),
  }));
}

/**
 * Linear attribution: equal credit to all touchpoints
 */
function calculateLinearCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const creditPerTouch = 1 / sorted.length;
  const channels = Array.from(channelTouchPoints.keys());

  return channels.map((channel) => {
    const touchCount = channelTouchPoints.get(channel)?.length || 0;
    return {
      channel,
      credit: creditPerTouch * touchCount,
      touchPointCount: touchCount,
      position: getChannelPosition(channel, sorted),
    };
  });
}

/**
 * Time decay attribution: more credit to recent touchpoints
 * Using a 7-day half-life
 */
function calculateTimeDecayCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const conversionTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const halfLifeMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  // Calculate raw weights based on time decay
  const weights = sorted.map((tp) => {
    const tpTime = new Date(tp.timestamp).getTime();
    const ageMs = conversionTime - tpTime;
    return Math.pow(0.5, ageMs / halfLifeMs);
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Aggregate by channel
  const channelCredits = new Map<MediaChannel, number>();

  sorted.forEach((tp, idx) => {
    const current = channelCredits.get(tp.channel) || 0;
    channelCredits.set(tp.channel, current + normalizedWeights[idx]);
  });

  const channels = Array.from(channelTouchPoints.keys());

  return channels.map((channel) => ({
    channel,
    credit: channelCredits.get(channel) || 0,
    touchPointCount: channelTouchPoints.get(channel)?.length || 0,
    position: getChannelPosition(channel, sorted),
  }));
}

/**
 * Position-based attribution: 40% first, 40% last, 20% middle
 */
function calculatePositionBasedCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const channels = Array.from(channelTouchPoints.keys());

  if (sorted.length === 1) {
    return calculateLastClickCredits(sorted, channelTouchPoints);
  }

  if (sorted.length === 2) {
    // Split 50/50 between first and last
    const firstChannel = sorted[0].channel;
    const lastChannel = sorted[1].channel;

    return channels.map((channel) => {
      let credit = 0;
      if (channel === firstChannel) credit += 0.5;
      if (channel === lastChannel) credit += 0.5;

      return {
        channel,
        credit,
        touchPointCount: channelTouchPoints.get(channel)?.length || 0,
        position: getChannelPosition(channel, sorted),
      };
    });
  }

  // Standard position-based: 40% first, 40% last, 20% middle (split evenly)
  const firstChannel = sorted[0].channel;
  const lastChannel = sorted[sorted.length - 1].channel;
  const middleTouchPoints = sorted.slice(1, -1);
  const middleCreditPerTouch = middleTouchPoints.length > 0 ? 0.2 / middleTouchPoints.length : 0;

  const channelCredits = new Map<MediaChannel, number>();

  // First touch credit
  const firstCredit = channelCredits.get(firstChannel) || 0;
  channelCredits.set(firstChannel, firstCredit + 0.4);

  // Last touch credit
  const lastCredit = channelCredits.get(lastChannel) || 0;
  channelCredits.set(lastChannel, lastCredit + 0.4);

  // Middle touch credits
  for (const tp of middleTouchPoints) {
    const current = channelCredits.get(tp.channel) || 0;
    channelCredits.set(tp.channel, current + middleCreditPerTouch);
  }

  return channels.map((channel) => ({
    channel,
    credit: channelCredits.get(channel) || 0,
    touchPointCount: channelTouchPoints.get(channel)?.length || 0,
    position: getChannelPosition(channel, sorted),
  }));
}

/**
 * Simplified data-driven attribution
 * Weights by interaction type (clicks > engagements > impressions)
 */
function calculateDataDrivenCredits(
  sorted: TouchPoint[],
  channelTouchPoints: Map<MediaChannel, TouchPoint[]>
): Omit<ChannelCredit, 'creditValue'>[] {
  const interactionWeights: Record<TouchPoint['interactionType'], number> = {
    click: 4,
    engagement: 3,
    visit: 2,
    impression: 1,
  };

  const weights = sorted.map((tp) => interactionWeights[tp.interactionType]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map((w) => w / totalWeight);

  // Aggregate by channel
  const channelCredits = new Map<MediaChannel, number>();

  sorted.forEach((tp, idx) => {
    const current = channelCredits.get(tp.channel) || 0;
    channelCredits.set(tp.channel, current + normalizedWeights[idx]);
  });

  const channels = Array.from(channelTouchPoints.keys());

  return channels.map((channel) => ({
    channel,
    credit: channelCredits.get(channel) || 0,
    touchPointCount: channelTouchPoints.get(channel)?.length || 0,
    position: getChannelPosition(channel, sorted),
  }));
}

/**
 * Determine channel position in journey
 */
function getChannelPosition(
  channel: MediaChannel,
  sorted: TouchPoint[]
): ChannelCredit['position'] {
  if (sorted.length === 1) {
    return 'only';
  }

  const firstIndex = sorted.findIndex((tp) => tp.channel === channel);
  const lastIndex = sorted.findLastIndex((tp) => tp.channel === channel);

  if (firstIndex === 0 && lastIndex === sorted.length - 1) {
    return 'only'; // Channel appears first and last
  }
  if (firstIndex === 0) {
    return 'first';
  }
  if (lastIndex === sorted.length - 1) {
    return 'last';
  }
  return 'middle';
}

/**
 * Calculate journey duration in hours
 */
function calculateJourneyDuration(touchPoints: TouchPoint[]): number {
  if (touchPoints.length < 2) {
    return 0;
  }

  const sorted = [...touchPoints].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstTime = new Date(sorted[0].timestamp).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();

  return (lastTime - firstTime) / (1000 * 60 * 60); // Convert ms to hours
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate attribution report from conversion data
 */
export function generateAttributionReport(args: {
  companyId: string;
  mediaProgramId?: string;
  conversions: ConversionEvent[];
  model: AttributionModel;
  dateRange: { start: string; end: string };
  includeModelComparison?: boolean;
}): AttributionReport {
  const { companyId, mediaProgramId, conversions, model, dateRange, includeModelComparison } = args;

  const attributed = calculateAttribution({ conversions, model });

  // Calculate channel performance
  const channelPerformance = calculateChannelPerformance(attributed, conversions);

  // Analyze journeys
  const journeyAnalysis = analyzeJourneys(conversions);

  // Model comparison (optional)
  let modelComparison: ModelComparison[] | undefined;
  if (includeModelComparison) {
    modelComparison = compareModels(conversions);
  }

  return {
    companyId,
    mediaProgramId,
    dateRange,
    model,
    totalConversions: conversions.length,
    totalValue: conversions.reduce((sum, c) => sum + c.value, 0),
    channelPerformance,
    journeyAnalysis,
    modelComparison,
  };
}

/**
 * Calculate channel-level performance metrics
 */
function calculateChannelPerformance(
  attributed: AttributedConversion[],
  conversions: ConversionEvent[]
): ChannelAttributionSummary[] {
  const channelData = new Map<
    MediaChannel,
    {
      totalCredit: number;
      totalValue: number;
      firstTouch: number;
      lastTouch: number;
      assisted: number;
      touchPointCounts: number[];
    }
  >();

  // Initialize all channels from attributed data
  for (const attr of attributed) {
    for (const credit of attr.channelCredits) {
      if (!channelData.has(credit.channel)) {
        channelData.set(credit.channel, {
          totalCredit: 0,
          totalValue: 0,
          firstTouch: 0,
          lastTouch: 0,
          assisted: 0,
          touchPointCounts: [],
        });
      }

      const data = channelData.get(credit.channel)!;
      data.totalCredit += credit.credit;
      data.totalValue += credit.creditValue;
      data.touchPointCounts.push(credit.touchPointCount);

      if (credit.position === 'first' || credit.position === 'only') {
        data.firstTouch++;
      }
      if (credit.position === 'last' || credit.position === 'only') {
        data.lastTouch++;
      }
      if (credit.position === 'middle') {
        data.assisted++;
      }
    }
  }

  const totalValue = conversions.reduce((sum, c) => sum + c.value, 0);

  return Array.from(channelData.entries()).map(([channel, data]) => ({
    channel,
    conversions: data.totalCredit, // Fractional conversions
    attributedValue: data.totalValue,
    percentOfTotal: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
    avgCreditPerConversion: data.touchPointCounts.length > 0
      ? data.totalCredit / data.touchPointCounts.length
      : 0,
    firstTouchConversions: data.firstTouch,
    lastTouchConversions: data.lastTouch,
    assistedConversions: data.assisted,
    avgTouchPointsInJourney: data.touchPointCounts.length > 0
      ? data.touchPointCounts.reduce((a, b) => a + b, 0) / data.touchPointCounts.length
      : 0,
  })).sort((a, b) => b.attributedValue - a.attributedValue);
}

/**
 * Analyze customer journeys
 */
function analyzeJourneys(conversions: ConversionEvent[]): JourneyAnalysis {
  // Calculate average metrics
  const touchPointCounts = conversions.map((c) => c.touchPoints.length);
  const avgTouchPoints = touchPointCounts.length > 0
    ? touchPointCounts.reduce((a, b) => a + b, 0) / touchPointCounts.length
    : 0;

  const durations = conversions.map((c) => calculateJourneyDuration(c.touchPoints));
  const avgJourneyDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Find common paths
  const pathCounts = new Map<string, { count: number; totalValue: number }>();

  for (const conversion of conversions) {
    const sorted = [...conversion.touchPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Deduplicate consecutive same channels
    const channels: MediaChannel[] = [];
    for (const tp of sorted) {
      if (channels.length === 0 || channels[channels.length - 1] !== tp.channel) {
        channels.push(tp.channel);
      }
    }

    const pathKey = channels.join(' → ');
    const existing = pathCounts.get(pathKey) || { count: 0, totalValue: 0 };
    pathCounts.set(pathKey, {
      count: existing.count + 1,
      totalValue: existing.totalValue + conversion.value,
    });
  }

  const totalConversions = conversions.length;
  const commonPaths: JourneyPath[] = Array.from(pathCounts.entries())
    .map(([pathKey, data]) => ({
      path: pathKey.split(' → ') as MediaChannel[],
      conversions: data.count,
      avgValue: data.totalValue / data.count,
      percentOfTotal: totalConversions > 0 ? (data.count / totalConversions) * 100 : 0,
    }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 10);

  // Calculate channel sequences
  const sequences = new Map<string, { count: number; conversions: number }>();

  for (const conversion of conversions) {
    const sorted = [...conversion.touchPoints].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Entry sequence
    if (sorted.length > 0) {
      const entryKey = `entry → ${sorted[0].channel}`;
      const entryExisting = sequences.get(entryKey) || { count: 0, conversions: 0 };
      sequences.set(entryKey, {
        count: entryExisting.count + 1,
        conversions: entryExisting.conversions + 1,
      });
    }

    // Channel-to-channel sequences
    for (let i = 0; i < sorted.length - 1; i++) {
      const seqKey = `${sorted[i].channel} → ${sorted[i + 1].channel}`;
      const existing = sequences.get(seqKey) || { count: 0, conversions: 0 };
      sequences.set(seqKey, {
        count: existing.count + 1,
        conversions: existing.conversions + (i === sorted.length - 2 ? 1 : 0),
      });
    }

    // Exit to conversion sequence
    if (sorted.length > 0) {
      const exitKey = `${sorted[sorted.length - 1].channel} → conversion`;
      const exitExisting = sequences.get(exitKey) || { count: 0, conversions: 0 };
      sequences.set(exitKey, {
        count: exitExisting.count + 1,
        conversions: exitExisting.conversions + 1,
      });
    }
  }

  const channelSequences: ChannelSequence[] = Array.from(sequences.entries())
    .map(([key, data]) => {
      const [from, to] = key.split(' → ');
      return {
        from: from as MediaChannel | 'entry',
        to: to as MediaChannel | 'conversion',
        count: data.count,
        conversionRate: data.count > 0 ? data.conversions / data.count : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    avgTouchPoints,
    avgJourneyDuration,
    commonPaths,
    channelSequences,
  };
}

/**
 * Compare results across attribution models
 */
function compareModels(conversions: ConversionEvent[]): ModelComparison[] {
  const models: AttributionModel[] = [
    'last_click',
    'first_click',
    'linear',
    'time_decay',
    'position_based',
  ];

  return models.map((model) => {
    const attributed = calculateAttribution({ conversions, model });

    // Aggregate channel credits
    const channelCredits: Partial<Record<MediaChannel, number>> = {};

    for (const attr of attributed) {
      for (const credit of attr.channelCredits) {
        channelCredits[credit.channel] = (channelCredits[credit.channel] || 0) + credit.creditValue;
      }
    }

    // Generate insight
    const insight = generateModelInsight(model, channelCredits);

    return { model, channelCredits, insight };
  });
}

/**
 * Generate insight about model results
 */
function generateModelInsight(
  model: AttributionModel,
  channelCredits: Partial<Record<MediaChannel, number>>
): string {
  const sorted = Object.entries(channelCredits)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return 'No attributed conversions';
  }

  const topChannel = sorted[0][0];
  const topValue = sorted[0][1];

  switch (model) {
    case 'last_click':
      return `${topChannel} drives the most direct conversions (${formatCurrency(topValue)})`;
    case 'first_click':
      return `${topChannel} is the strongest awareness driver (${formatCurrency(topValue)})`;
    case 'linear':
      return `${topChannel} has the most consistent presence in journeys (${formatCurrency(topValue)})`;
    case 'time_decay':
      return `${topChannel} is most influential near conversion (${formatCurrency(topValue)})`;
    case 'position_based':
      return `${topChannel} excels at journey start or finish (${formatCurrency(topValue)})`;
    default:
      return `${topChannel} receives most credit (${formatCurrency(topValue)})`;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================================
// Model Recommendations
// ============================================================================

export interface ModelRecommendation {
  recommendedModel: AttributionModel;
  reason: string;
  alternativeModels: { model: AttributionModel; useCase: string }[];
}

/**
 * Recommend attribution model based on business context
 */
export function recommendAttributionModel(args: {
  avgJourneyLength: number;
  primaryGoal: 'awareness' | 'conversion' | 'balanced';
  channelCount: number;
}): ModelRecommendation {
  const { avgJourneyLength, primaryGoal, channelCount } = args;

  let recommendedModel: AttributionModel;
  let reason: string;

  if (avgJourneyLength <= 1.5) {
    // Short journeys - last click is fine
    recommendedModel = 'last_click';
    reason = 'Most customers convert in 1-2 touchpoints, making last-click attribution accurate';
  } else if (primaryGoal === 'awareness') {
    recommendedModel = 'first_click';
    reason = 'Prioritizes top-of-funnel channels that introduce customers to your brand';
  } else if (primaryGoal === 'conversion') {
    recommendedModel = 'time_decay';
    reason = 'Emphasizes channels closest to conversion while acknowledging the full journey';
  } else if (channelCount >= 4) {
    recommendedModel = 'position_based';
    reason = 'Balances credit between awareness and conversion in multi-channel journeys';
  } else {
    recommendedModel = 'linear';
    reason = 'Equal credit ensures no channel is undervalued in the customer journey';
  }

  const allAlternatives: { model: AttributionModel; useCase: string }[] = [
    { model: 'last_click', useCase: 'Optimizing for immediate conversions' },
    { model: 'first_click', useCase: 'Evaluating awareness campaigns' },
    { model: 'linear', useCase: 'Fair comparison across all channels' },
    { model: 'time_decay', useCase: 'Focus on recent touchpoints' },
    { model: 'position_based', useCase: 'Balanced multi-touch analysis' },
  ];

  const alternativeModels = allAlternatives.filter((m) => m.model !== recommendedModel);

  return {
    recommendedModel,
    reason,
    alternativeModels,
  };
}

// ============================================================================
// Attribution Labels
// ============================================================================

export const ATTRIBUTION_MODEL_LABELS: Record<
  AttributionModel,
  { name: string; description: string }
> = {
  last_click: {
    name: 'Last Click',
    description: '100% credit to the last touchpoint before conversion',
  },
  first_click: {
    name: 'First Click',
    description: '100% credit to the first touchpoint in the journey',
  },
  linear: {
    name: 'Linear',
    description: 'Equal credit distributed across all touchpoints',
  },
  time_decay: {
    name: 'Time Decay',
    description: 'More credit to touchpoints closer to conversion',
  },
  position_based: {
    name: 'Position Based',
    description: '40% first, 40% last, 20% middle touchpoints',
  },
  data_driven: {
    name: 'Data-Driven',
    description: 'Credit based on engagement and interaction type',
  },
};

export const CONVERSION_TYPE_LABELS: Record<ConversionEvent['type'], string> = {
  lead: 'Lead',
  sale: 'Sale',
  phone_call: 'Phone Call',
  form_submit: 'Form Submission',
  store_visit: 'Store Visit',
  appointment: 'Appointment',
};
