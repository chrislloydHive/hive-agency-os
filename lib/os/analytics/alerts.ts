// lib/os/analytics/alerts.ts
// Workspace Analytics Alerts Engine
// Detects anomalies and generates actionable alerts

import type {
  AnalyticsAlert,
  AlertSeverity,
  AlertCategory,
  Ga4TrafficSummary,
  Ga4ChannelBreakdownItem,
  GscQueryItem,
  WorkspaceFunnelSummary,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const THRESHOLDS = {
  // Traffic thresholds
  bounceRate: {
    critical: 0.80, // 80%
    warning: 0.65,  // 65%
  },
  avgSessionDuration: {
    critical: 20, // seconds
    warning: 45,
  },
  trafficDrop: {
    critical: -40, // percent
    warning: -20,
  },
  trafficSpike: {
    warning: 100, // percent (could indicate bot traffic)
  },

  // Search thresholds
  ctr: {
    critical: 0.005, // 0.5%
    warning: 0.015,  // 1.5%
  },
  avgPosition: {
    warning: 30, // average position > 30 is concerning
  },

  // Funnel thresholds
  funnelConversion: {
    critical: 0.001, // 0.1%
    warning: 0.01,   // 1%
  },
};

// ============================================================================
// Alert ID Generator
// ============================================================================

function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Traffic Alerts
// ============================================================================

function generateTrafficAlerts(
  traffic: Ga4TrafficSummary | null,
  previousTraffic: Ga4TrafficSummary | null
): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = [];

  if (!traffic) {
    return alerts;
  }

  // High bounce rate
  if (traffic.bounceRate !== null) {
    if (traffic.bounceRate >= THRESHOLDS.bounceRate.critical) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'critical',
        title: 'Critical: Very high bounce rate',
        detail: `Bounce rate is ${(traffic.bounceRate * 100).toFixed(1)}%, indicating visitors leave immediately.`,
        hint: 'Review landing page relevance, page load speed, and user experience.',
      });
    } else if (traffic.bounceRate >= THRESHOLDS.bounceRate.warning) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'warning',
        title: 'Elevated bounce rate',
        detail: `Bounce rate is ${(traffic.bounceRate * 100).toFixed(1)}%, above healthy range.`,
        hint: 'Consider improving content relevance and page engagement.',
      });
    }
  }

  // Low session duration
  if (traffic.avgSessionDurationSeconds !== null) {
    if (traffic.avgSessionDurationSeconds <= THRESHOLDS.avgSessionDuration.critical) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'critical',
        title: 'Critical: Very low engagement',
        detail: `Average session duration is only ${Math.round(traffic.avgSessionDurationSeconds)}s.`,
        hint: 'Users are not finding value. Review content quality and site structure.',
      });
    } else if (traffic.avgSessionDurationSeconds <= THRESHOLDS.avgSessionDuration.warning) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'warning',
        title: 'Low session engagement',
        detail: `Average session duration is ${Math.round(traffic.avgSessionDurationSeconds)}s.`,
        hint: 'Add more engaging content and internal links to increase time on site.',
      });
    }
  }

  // Traffic drop vs previous period
  if (traffic.sessions !== null && previousTraffic && previousTraffic.sessions !== null && previousTraffic.sessions > 0) {
    const changePercent = ((traffic.sessions - previousTraffic.sessions) / previousTraffic.sessions) * 100;

    if (changePercent <= THRESHOLDS.trafficDrop.critical) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'critical',
        title: 'Critical: Major traffic drop',
        detail: `Traffic is down ${Math.abs(changePercent).toFixed(1)}% vs previous period (${previousTraffic.sessions.toLocaleString()} → ${traffic.sessions.toLocaleString()}).`,
        hint: 'Check for technical issues, algorithm updates, or lost traffic sources.',
      });
    } else if (changePercent <= THRESHOLDS.trafficDrop.warning) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'warning',
        title: 'Traffic declining',
        detail: `Traffic is down ${Math.abs(changePercent).toFixed(1)}% vs previous period.`,
        hint: 'Monitor trend and investigate potential causes.',
      });
    } else if (changePercent >= THRESHOLDS.trafficSpike.warning) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'info',
        title: 'Unusual traffic spike',
        detail: `Traffic is up ${changePercent.toFixed(1)}% vs previous period.`,
        hint: 'Verify traffic is legitimate and identify the source.',
      });
    }
  }

  return alerts;
}

// ============================================================================
// Channel Alerts
// ============================================================================

function generateChannelAlerts(
  channels: Ga4ChannelBreakdownItem[],
  totalSessions: number
): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = [];

  if (channels.length === 0 || totalSessions === 0) {
    return alerts;
  }

  // Check organic search share
  const organicChannel = channels.find(
    (c) => c.channel.toLowerCase().includes('organic') && c.channel.toLowerCase().includes('search')
  );

  if (organicChannel) {
    const organicShare = (organicChannel.sessions / totalSessions) * 100;

    if (organicShare < 15) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'warning',
        title: 'Low organic search traffic',
        detail: `Only ${organicShare.toFixed(1)}% of traffic comes from organic search.`,
        hint: 'SEO investment may be needed to reduce reliance on paid channels.',
        linkHref: '/analytics/os?tab=search',
      });
    }
  } else {
    // No organic traffic at all
    alerts.push({
      id: generateAlertId(),
      category: 'traffic',
      severity: 'warning',
      title: 'No organic search traffic detected',
      detail: 'The website is not receiving visitors from search engines.',
      hint: 'Review SEO fundamentals: indexing, keywords, and content quality.',
      linkHref: '/analytics/os?tab=search',
    });
  }

  // Check for over-reliance on single channel
  const topChannel = channels[0];
  if (topChannel) {
    const topShare = (topChannel.sessions / totalSessions) * 100;
    if (topShare > 80) {
      alerts.push({
        id: generateAlertId(),
        category: 'traffic',
        severity: 'info',
        title: `Traffic heavily dependent on ${topChannel.channel}`,
        detail: `${topShare.toFixed(1)}% of all traffic comes from ${topChannel.channel}.`,
        hint: 'Diversify traffic sources to reduce risk.',
      });
    }
  }

  return alerts;
}

// ============================================================================
// Search Alerts
// ============================================================================

function generateSearchAlerts(
  queries: GscQueryItem[],
  totalClicks: number,
  totalImpressions: number
): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = [];

  if (queries.length === 0) {
    return alerts;
  }

  // Overall CTR
  if (totalImpressions > 0) {
    const avgCtr = totalClicks / totalImpressions;

    if (avgCtr <= THRESHOLDS.ctr.critical) {
      alerts.push({
        id: generateAlertId(),
        category: 'search',
        severity: 'critical',
        title: 'Critical: Very low search CTR',
        detail: `Average CTR is only ${(avgCtr * 100).toFixed(2)}%. Users see your site but don't click.`,
        hint: 'Improve title tags and meta descriptions to increase click-through rate.',
      });
    } else if (avgCtr <= THRESHOLDS.ctr.warning) {
      alerts.push({
        id: generateAlertId(),
        category: 'search',
        severity: 'warning',
        title: 'Low search click-through rate',
        detail: `Average CTR is ${(avgCtr * 100).toFixed(2)}%.`,
        hint: 'Review and optimize meta titles and descriptions.',
      });
    }
  }

  // High-impression, low-click queries (opportunity alerts)
  const highImpressionLowClick = queries.filter(
    (q) => q.impressions > 100 && q.ctr !== null && q.ctr < 0.02
  );

  if (highImpressionLowClick.length > 3) {
    alerts.push({
      id: generateAlertId(),
      category: 'search',
      severity: 'info',
      title: 'High-visibility queries with low CTR',
      detail: `${highImpressionLowClick.length} queries have 100+ impressions but <2% CTR.`,
      hint: 'These are opportunities to optimize titles/descriptions for more clicks.',
      linkHref: '/analytics/os?tab=search',
    });
  }

  // Poor ranking queries
  const poorRanking = queries.filter(
    (q) => q.position !== null && q.position > THRESHOLDS.avgPosition.warning && q.impressions > 50
  );

  if (poorRanking.length > 5) {
    alerts.push({
      id: generateAlertId(),
      category: 'search',
      severity: 'info',
      title: 'Multiple queries ranking beyond page 3',
      detail: `${poorRanking.length} queries are ranking below position 30.`,
      hint: 'Focus content optimization on these topics to improve rankings.',
    });
  }

  return alerts;
}

// ============================================================================
// Funnel Alerts
// ============================================================================

function generateFunnelAlerts(funnel: WorkspaceFunnelSummary | null): AnalyticsAlert[] {
  const alerts: AnalyticsAlert[] = [];

  if (!funnel || funnel.stages.length < 2) {
    return alerts;
  }

  const stages = funnel.stages;

  // Check conversion between each stage
  for (let i = 0; i < stages.length - 1; i++) {
    const fromStage = stages[i];
    const toStage = stages[i + 1];

    if (fromStage.value === 0) continue;

    const conversionRate = toStage.value / fromStage.value;

    // Different thresholds for different stage transitions
    if (i === 0 && conversionRate < 0.01) {
      // Sessions → DMA Audits
      alerts.push({
        id: generateAlertId(),
        category: 'funnel',
        severity: 'warning',
        title: 'Low session-to-audit conversion',
        detail: `Only ${(conversionRate * 100).toFixed(2)}% of sessions start a DMA audit.`,
        hint: 'Improve CTA visibility and value proposition on landing pages.',
      });
    } else if (i === 1 && conversionRate < 0.1) {
      // DMA Audits → Leads
      alerts.push({
        id: generateAlertId(),
        category: 'funnel',
        severity: 'warning',
        title: 'Low audit-to-lead conversion',
        detail: `Only ${(conversionRate * 100).toFixed(1)}% of audit completions become leads.`,
        hint: 'Review lead capture forms and follow-up automation.',
      });
    }
  }

  // Check for declining funnel stages vs previous period
  for (const stage of stages) {
    if (stage.prevValue !== null && stage.prevValue > 0 && stage.value < stage.prevValue) {
      const changePercent = ((stage.value - stage.prevValue) / stage.prevValue) * 100;

      if (changePercent <= -30) {
        alerts.push({
          id: generateAlertId(),
          category: 'funnel',
          severity: 'warning',
          title: `${stage.label} down significantly`,
          detail: `${stage.label} decreased ${Math.abs(changePercent).toFixed(1)}% vs previous period.`,
          hint: 'Investigate causes and review related processes.',
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// Main Function
// ============================================================================

export interface GenerateAlertsInput {
  traffic: Ga4TrafficSummary | null;
  previousTraffic?: Ga4TrafficSummary | null;
  channels: Ga4ChannelBreakdownItem[];
  queries: GscQueryItem[];
  funnel: WorkspaceFunnelSummary | null;
}

/**
 * Generate all alerts based on analytics data.
 * Returns alerts sorted by severity (critical first).
 */
export function generateAnalyticsAlerts(input: GenerateAlertsInput): AnalyticsAlert[] {
  const {
    traffic,
    previousTraffic = null,
    channels,
    queries,
    funnel,
  } = input;

  const alerts: AnalyticsAlert[] = [];

  // Traffic alerts
  alerts.push(...generateTrafficAlerts(traffic, previousTraffic));

  // Channel alerts
  const totalSessions = traffic?.sessions ?? 0;
  alerts.push(...generateChannelAlerts(channels, totalSessions));

  // Search alerts
  const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
  alerts.push(...generateSearchAlerts(queries, totalClicks, totalImpressions));

  // Funnel alerts
  alerts.push(...generateFunnelAlerts(funnel));

  // Sort by severity: critical > warning > info
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log('[Alerts] Generated alerts:', {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warning: alerts.filter((a) => a.severity === 'warning').length,
    info: alerts.filter((a) => a.severity === 'info').length,
  });

  return alerts;
}

/**
 * Filter alerts by category
 */
export function filterAlertsByCategory(
  alerts: AnalyticsAlert[],
  category: AlertCategory
): AnalyticsAlert[] {
  return alerts.filter((a) => a.category === category);
}

/**
 * Filter alerts by minimum severity
 */
export function filterAlertsBySeverity(
  alerts: AnalyticsAlert[],
  minSeverity: AlertSeverity
): AnalyticsAlert[] {
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const minOrder = severityOrder[minSeverity];
  return alerts.filter((a) => severityOrder[a.severity] <= minOrder);
}
