// lib/analytics/metricInsights.ts
// Deterministic insight generation for individual metrics
//
// This module generates contextual insights for specific metrics
// using rule-based logic based on current values, changes, and benchmarks.

import type { CompanyAnalyticsSnapshot } from './types';

type MetricType =
  | 'sessions'
  | 'users'
  | 'pageviews'
  | 'conversions'
  | 'bounceRate'
  | 'searchClicks'
  | 'impressions'
  | 'avgPosition'
  | 'ctr';

interface MetricInsightResult {
  insight: string;
  severity: 'positive' | 'negative' | 'neutral' | 'info';
}

/**
 * Generate a contextual insight for a specific metric based on snapshot data
 */
export function getMetricInsight(
  metric: MetricType,
  snapshot: CompanyAnalyticsSnapshot
): MetricInsightResult | null {
  const ga4 = snapshot.ga4;
  const gsc = snapshot.searchConsole;
  const comparison = snapshot.comparison;

  switch (metric) {
    case 'sessions':
      return getSessionsInsight(ga4, comparison?.ga4);

    case 'users':
      return getUsersInsight(ga4, comparison?.ga4);

    case 'pageviews':
      return getPageviewsInsight(ga4);

    case 'conversions':
      return getConversionsInsight(ga4, comparison?.ga4);

    case 'bounceRate':
      return getBounceRateInsight(ga4, comparison?.ga4);

    case 'searchClicks':
      return getSearchClicksInsight(gsc, comparison?.searchConsole);

    case 'impressions':
      return getImpressionsInsight(gsc, comparison?.searchConsole);

    case 'avgPosition':
      return getPositionInsight(gsc, comparison?.searchConsole);

    case 'ctr':
      return getCtrInsight(gsc, comparison?.searchConsole);

    default:
      return null;
  }
}

// ============================================================================
// GA4 Metric Insights
// ============================================================================

function getSessionsInsight(
  ga4: CompanyAnalyticsSnapshot['ga4'],
  comparison?: { sessionsChange: number; usersChange: number; conversionsChange: number; bounceRateChange: number }
): MetricInsightResult | null {
  if (!ga4) return null;

  const change = comparison?.sessionsChange;
  const sessions = ga4.metrics.sessions;
  const users = ga4.metrics.users;

  // Check for significant change
  if (change !== undefined && Math.abs(change) >= 10) {
    if (change > 20) {
      return {
        insight: `Traffic is up ${change.toFixed(0)}% compared to the previous period. This strong growth suggests your marketing efforts are working well. Consider analyzing which channels are driving this increase to double down on what's working.`,
        severity: 'positive',
      };
    } else if (change > 0) {
      return {
        insight: `Sessions increased ${change.toFixed(0)}% versus the previous period. Steady growth is a positive sign. Monitor your traffic sources to maintain this momentum.`,
        severity: 'positive',
      };
    } else if (change < -20) {
      return {
        insight: `Traffic declined ${Math.abs(change).toFixed(0)}% from the previous period. This significant drop warrants investigation. Review your traffic sources, recent content changes, and any technical issues that may be affecting visibility.`,
        severity: 'negative',
      };
    } else {
      return {
        insight: `Sessions are down ${Math.abs(change).toFixed(0)}% compared to the previous period. Review your top traffic sources to identify which channels are underperforming and take corrective action.`,
        severity: 'negative',
      };
    }
  }

  // Check sessions per user ratio
  const sessionsPerUser = users > 0 ? sessions / users : 0;
  if (sessionsPerUser > 1.5) {
    return {
      insight: `Users are returning frequently with ${sessionsPerUser.toFixed(1)} sessions per user on average. This high return rate indicates strong engagement and content that keeps visitors coming back.`,
      severity: 'positive',
    };
  } else if (sessionsPerUser < 1.1 && sessions > 100) {
    return {
      insight: `Most users visit only once (${sessionsPerUser.toFixed(1)} sessions/user). Consider adding newsletter signups, content series, or retargeting to encourage return visits.`,
      severity: 'info',
    };
  }

  return null;
}

function getUsersInsight(
  ga4: CompanyAnalyticsSnapshot['ga4'],
  comparison?: { sessionsChange: number; usersChange: number; conversionsChange: number; bounceRateChange: number }
): MetricInsightResult | null {
  if (!ga4) return null;

  const change = comparison?.usersChange;
  const users = ga4.metrics.users;
  const newUsers = ga4.metrics.newUsers;

  // Check for significant change
  if (change !== undefined && Math.abs(change) >= 10) {
    if (change > 15) {
      return {
        insight: `User growth is strong at +${change.toFixed(0)}%. Your audience is expanding, which is a healthy sign for long-term growth. Focus on converting these new visitors into engaged users.`,
        severity: 'positive',
      };
    } else if (change < -15) {
      return {
        insight: `User count dropped ${Math.abs(change).toFixed(0)}% versus the previous period. This could indicate reduced marketing effectiveness or seasonal factors. Review your acquisition channels.`,
        severity: 'negative',
      };
    }
  }

  // Check new user ratio
  const newUserRatio = users > 0 ? newUsers / users : 0;
  if (newUserRatio > 0.8 && users > 50) {
    return {
      insight: `${(newUserRatio * 100).toFixed(0)}% of your users are new visitors. While this shows good reach, consider improving retention strategies to build a loyal audience.`,
      severity: 'info',
    };
  } else if (newUserRatio < 0.3 && users > 100) {
    return {
      insight: `Only ${(newUserRatio * 100).toFixed(0)}% of users are new. Your returning user base is strong, but consider expanding your reach to grow your audience.`,
      severity: 'info',
    };
  }

  return null;
}

function getPageviewsInsight(
  ga4: CompanyAnalyticsSnapshot['ga4']
): MetricInsightResult | null {
  if (!ga4) return null;

  const { pageviews, sessions, topPages } = ga4.metrics.pageviews > 0
    ? { pageviews: ga4.metrics.pageviews, sessions: ga4.metrics.sessions, topPages: ga4.topPages }
    : { pageviews: 0, sessions: 0, topPages: [] };

  const pagesPerSession = sessions > 0 ? pageviews / sessions : 0;

  if (pagesPerSession > 3) {
    return {
      insight: `Users view an average of ${pagesPerSession.toFixed(1)} pages per session, indicating strong content engagement. Your site structure is effectively encouraging exploration.`,
      severity: 'positive',
    };
  } else if (pagesPerSession < 1.5 && sessions > 50) {
    return {
      insight: `With only ${pagesPerSession.toFixed(1)} pages per session, visitors aren't exploring much of your content. Consider improving internal linking, adding related content sections, or making your navigation more compelling.`,
      severity: 'info',
    };
  }

  // Check if homepage dominates pageviews
  if (topPages && topPages.length > 0) {
    const homepageViews = topPages.find(p => p.path === '/' || p.path === '/index')?.pageviews || 0;
    if (homepageViews > pageviews * 0.5 && topPages.length > 5) {
      return {
        insight: `Over 50% of pageviews are on the homepage. Consider creating compelling landing pages and improving navigation to distribute traffic across your site.`,
        severity: 'info',
      };
    }
  }

  return null;
}

function getConversionsInsight(
  ga4: CompanyAnalyticsSnapshot['ga4'],
  comparison?: { sessionsChange: number; usersChange: number; conversionsChange: number; bounceRateChange: number }
): MetricInsightResult | null {
  if (!ga4) return null;

  const { conversions, conversionRate, sessions } = ga4.metrics;
  const change = comparison?.conversionsChange;

  if (change !== undefined && Math.abs(change) >= 15) {
    if (change > 25) {
      return {
        insight: `Conversions surged ${change.toFixed(0)}% compared to the previous period! This is excellent performance. Identify what's driving this success to replicate it.`,
        severity: 'positive',
      };
    } else if (change > 0) {
      return {
        insight: `Conversions are up ${change.toFixed(0)}% versus the previous period. Solid improvement in your conversion performance.`,
        severity: 'positive',
      };
    } else if (change < -25) {
      return {
        insight: `Conversions dropped ${Math.abs(change).toFixed(0)}% from the previous period. This significant decline needs immediate attention. Check for technical issues, form problems, or changes in traffic quality.`,
        severity: 'negative',
      };
    } else {
      return {
        insight: `Conversions decreased ${Math.abs(change).toFixed(0)}% compared to the previous period. Review your conversion paths and user experience for potential friction points.`,
        severity: 'negative',
      };
    }
  }

  // Benchmark conversion rate
  if (conversionRate < 0.01 && sessions > 500) {
    return {
      insight: `Your conversion rate of ${(conversionRate * 100).toFixed(2)}% is below typical benchmarks. Focus on optimizing your key conversion pages, simplifying forms, and ensuring clear calls-to-action.`,
      severity: 'info',
    };
  } else if (conversionRate > 0.05) {
    return {
      insight: `A ${(conversionRate * 100).toFixed(1)}% conversion rate is strong performance. You're effectively converting traffic into desired actions.`,
      severity: 'positive',
    };
  }

  return null;
}

function getBounceRateInsight(
  ga4: CompanyAnalyticsSnapshot['ga4'],
  comparison?: { sessionsChange: number; usersChange: number; conversionsChange: number; bounceRateChange: number }
): MetricInsightResult | null {
  if (!ga4) return null;

  const { bounceRate, engagementRate } = ga4.metrics;
  const change = comparison?.bounceRateChange;

  // For bounce rate, lower is better (negative change is good)
  if (change !== undefined && Math.abs(change) >= 5) {
    if (change < -10) {
      return {
        insight: `Bounce rate improved by ${Math.abs(change).toFixed(0)} percentage points. Visitors are engaging more with your content, which signals better content relevance or improved user experience.`,
        severity: 'positive',
      };
    } else if (change > 10) {
      return {
        insight: `Bounce rate increased ${change.toFixed(0)} percentage points. More visitors are leaving after viewing only one page. Check page load speed, content relevance, and mobile experience.`,
        severity: 'negative',
      };
    }
  }

  // Benchmark bounce rate
  if (bounceRate > 0.7) {
    return {
      insight: `A ${(bounceRate * 100).toFixed(0)}% bounce rate is high. Focus on improving page load speed, ensuring content matches visitor expectations, and adding clear next steps on key landing pages.`,
      severity: 'negative',
    };
  } else if (bounceRate < 0.4) {
    return {
      insight: `Your ${(bounceRate * 100).toFixed(0)}% bounce rate is excellent. Visitors are actively exploring your site, indicating strong content engagement and user experience.`,
      severity: 'positive',
    };
  }

  // Check engagement rate correlation
  if (engagementRate > 0.7 && bounceRate > 0.5) {
    return {
      insight: `Despite a ${(bounceRate * 100).toFixed(0)}% bounce rate, your ${(engagementRate * 100).toFixed(0)}% engagement rate shows visitors are still interacting meaningfully with content before leaving.`,
      severity: 'info',
    };
  }

  return null;
}

// ============================================================================
// Search Console Metric Insights
// ============================================================================

function getSearchClicksInsight(
  gsc: CompanyAnalyticsSnapshot['searchConsole'],
  comparison?: { clicksChange: number; impressionsChange: number; ctrChange: number; positionChange: number }
): MetricInsightResult | null {
  if (!gsc) return null;

  const { clicks, impressions, ctr } = gsc.metrics;
  const change = comparison?.clicksChange;

  if (change !== undefined && Math.abs(change) >= 10) {
    if (change > 20) {
      return {
        insight: `Search clicks jumped ${change.toFixed(0)}%! Your SEO improvements are driving significantly more organic traffic. Continue optimizing content and building on this momentum.`,
        severity: 'positive',
      };
    } else if (change > 0) {
      return {
        insight: `Search clicks increased ${change.toFixed(0)}% versus the previous period. Organic visibility is improving.`,
        severity: 'positive',
      };
    } else if (change < -20) {
      return {
        insight: `Search clicks dropped ${Math.abs(change).toFixed(0)}%. This significant decline could indicate ranking losses, algorithm changes, or technical SEO issues. Review your rankings and Search Console for errors.`,
        severity: 'negative',
      };
    } else {
      return {
        insight: `Search clicks declined ${Math.abs(change).toFixed(0)}% from the previous period. Monitor your key rankings and consider refreshing underperforming content.`,
        severity: 'negative',
      };
    }
  }

  // Check CTR vs impression ratio
  if (impressions > 10000 && ctr < 0.015) {
    return {
      insight: `With ${impressions.toLocaleString()} impressions but only ${(ctr * 100).toFixed(2)}% CTR, you're visible but not attracting clicks. Optimize your meta titles and descriptions to be more compelling.`,
      severity: 'info',
    };
  }

  return null;
}

function getImpressionsInsight(
  gsc: CompanyAnalyticsSnapshot['searchConsole'],
  comparison?: { clicksChange: number; impressionsChange: number; ctrChange: number; positionChange: number }
): MetricInsightResult | null {
  if (!gsc) return null;

  const { impressions, avgPosition } = gsc.metrics;
  const change = comparison?.impressionsChange;

  if (change !== undefined && Math.abs(change) >= 15) {
    if (change > 25) {
      return {
        insight: `Search impressions surged ${change.toFixed(0)}%! Your content is reaching a much larger audience in search results. This is a strong signal of growing organic visibility.`,
        severity: 'positive',
      };
    } else if (change > 0) {
      return {
        insight: `Impressions grew ${change.toFixed(0)}% compared to the previous period, showing increased search visibility for your content.`,
        severity: 'positive',
      };
    } else if (change < -25) {
      return {
        insight: `Impressions fell ${Math.abs(change).toFixed(0)}%. This significant visibility drop could indicate ranking losses or reduced search demand. Review your top queries for changes.`,
        severity: 'negative',
      };
    } else {
      return {
        insight: `Search impressions declined ${Math.abs(change).toFixed(0)}% versus the previous period. Monitor your rankings and consider expanding your keyword targeting.`,
        severity: 'negative',
      };
    }
  }

  // Low impressions with good position
  if (impressions < 1000 && avgPosition < 20) {
    return {
      insight: `With only ${impressions.toLocaleString()} impressions despite decent rankings, you may be targeting low-volume keywords. Consider expanding your content to cover more search demand.`,
      severity: 'info',
    };
  }

  return null;
}

function getPositionInsight(
  gsc: CompanyAnalyticsSnapshot['searchConsole'],
  comparison?: { clicksChange: number; impressionsChange: number; ctrChange: number; positionChange: number }
): MetricInsightResult | null {
  if (!gsc) return null;

  const { avgPosition, topQueries } = gsc.metrics ? { avgPosition: gsc.metrics.avgPosition, topQueries: gsc.topQueries } : { avgPosition: 0, topQueries: [] };
  const change = comparison?.positionChange;

  // For position, negative change is good (moving up in rankings)
  if (change !== undefined && Math.abs(change) >= 2) {
    if (change < -3) {
      return {
        insight: `Average position improved by ${Math.abs(change).toFixed(1)} spots. Your pages are ranking higher in search results, which should drive more organic traffic.`,
        severity: 'positive',
      };
    } else if (change > 3) {
      return {
        insight: `Average position dropped ${change.toFixed(1)} spots. Rankings are slipping, which may impact organic traffic. Review your content and backlink strategy.`,
        severity: 'negative',
      };
    }
  }

  // Position benchmarks
  if (avgPosition <= 10) {
    return {
      insight: `With an average position of ${avgPosition.toFixed(1)}, you're ranking on page one for your tracked queries. Focus on maintaining these positions and expanding to new keywords.`,
      severity: 'positive',
    };
  } else if (avgPosition > 30) {
    return {
      insight: `An average position of ${avgPosition.toFixed(1)} means most of your content appears on page 3 or beyond. Prioritize improving content quality and building authority for your target keywords.`,
      severity: 'info',
    };
  }

  // Check for position 4-10 opportunity
  if (topQueries && topQueries.length > 0) {
    const nearTop3 = topQueries.filter(q => q.position > 3 && q.position <= 10 && q.impressions > 100);
    if (nearTop3.length >= 3) {
      return {
        insight: `You have ${nearTop3.length} queries ranking in positions 4-10 with good impression volume. Small improvements could move these to top 3 positions for significantly more clicks.`,
        severity: 'info',
      };
    }
  }

  return null;
}

function getCtrInsight(
  gsc: CompanyAnalyticsSnapshot['searchConsole'],
  comparison?: { clicksChange: number; impressionsChange: number; ctrChange: number; positionChange: number }
): MetricInsightResult | null {
  if (!gsc) return null;

  const { ctr, avgPosition } = gsc.metrics;
  const change = comparison?.ctrChange;

  if (change !== undefined && Math.abs(change) >= 0.5) {
    if (change > 1) {
      return {
        insight: `Click-through rate improved ${change.toFixed(1)} percentage points. Your search listings are becoming more compelling to users. This is often a result of better meta descriptions or more relevant titles.`,
        severity: 'positive',
      };
    } else if (change < -1) {
      return {
        insight: `CTR dropped ${Math.abs(change).toFixed(1)} percentage points. Your search listings may be less appealing or facing more competition. Review and refresh your meta descriptions.`,
        severity: 'negative',
      };
    }
  }

  // CTR vs position benchmark
  const expectedCtr = getExpectedCtr(avgPosition);
  if (ctr > expectedCtr * 1.3) {
    return {
      insight: `Your ${(ctr * 100).toFixed(2)}% CTR is above average for your ranking position. Your meta titles and descriptions are effectively attracting clicks.`,
      severity: 'positive',
    };
  } else if (ctr < expectedCtr * 0.7 && gsc.metrics.impressions > 500) {
    return {
      insight: `Your ${(ctr * 100).toFixed(2)}% CTR is below average for position ${avgPosition.toFixed(1)}. Improving your meta titles and descriptions could significantly increase clicks without changing rankings.`,
      severity: 'info',
    };
  }

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get expected CTR based on average position (industry benchmarks)
 */
function getExpectedCtr(position: number): number {
  // Rough CTR by position based on industry studies
  if (position <= 1) return 0.28;
  if (position <= 2) return 0.15;
  if (position <= 3) return 0.11;
  if (position <= 4) return 0.08;
  if (position <= 5) return 0.06;
  if (position <= 6) return 0.05;
  if (position <= 7) return 0.04;
  if (position <= 8) return 0.035;
  if (position <= 9) return 0.03;
  if (position <= 10) return 0.025;
  if (position <= 20) return 0.015;
  return 0.01;
}
