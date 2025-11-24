/**
 * Google Telemetry Helper
 *
 * Fetches real GA4 + Search Console data via Google APIs and normalizes it
 * into the EvidencePayload format for use in Full Reports.
 *
 * Uses a service account for authentication.
 */

import { google } from 'googleapis';
import type {
  EvidencePayload,
  EvidenceMetric,
  EvidenceInsight,
} from '@/lib/gap/types';

/**
 * Fetch evidence (telemetry) for a company from GA4 and/or Search Console
 *
 * @param ga4PropertyId - GA4 property ID (e.g., "properties/123456789")
 * @param searchConsoleSiteUrl - Search Console site URL (e.g., "https://www.trainrhub.com/")
 * @returns EvidencePayload or undefined if no data sources configured
 */
export async function fetchEvidenceForCompany({
  ga4PropertyId,
  searchConsoleSiteUrl,
}: {
  ga4PropertyId?: string;
  searchConsoleSiteUrl?: string;
}): Promise<EvidencePayload | undefined> {
  console.log('[Google Telemetry] Fetching evidence:', {
    ga4PropertyId,
    searchConsoleSiteUrl,
  });

  // If neither source is configured, return undefined
  if (!ga4PropertyId && !searchConsoleSiteUrl) {
    console.log('[Google Telemetry] No telemetry sources configured');
    return undefined;
  }

  const metrics: EvidenceMetric[] = [];
  const insights: EvidenceInsight[] = [];

  // Set up Google API auth using service account
  const auth = await getGoogleAuth();
  if (!auth) {
    console.error('[Google Telemetry] Failed to authenticate with Google APIs');
    return undefined;
  }

  // Fetch GA4 data if configured
  if (ga4PropertyId) {
    try {
      const ga4Data = await fetchGA4Data(auth, ga4PropertyId);
      metrics.push(...ga4Data.metrics);
      insights.push(...ga4Data.insights);
    } catch (error) {
      console.error('[Google Telemetry] Error fetching GA4 data:', error);
    }
  }

  // Fetch Search Console data if configured
  if (searchConsoleSiteUrl) {
    try {
      const gscData = await fetchSearchConsoleData(auth, searchConsoleSiteUrl);
      metrics.push(...gscData.metrics);
      insights.push(...gscData.insights);
    } catch (error) {
      console.error('[Google Telemetry] Error fetching Search Console data:', error);
    }
  }

  // If no data was collected, return undefined
  if (metrics.length === 0 && insights.length === 0) {
    console.log('[Google Telemetry] No telemetry data collected');
    return undefined;
  }

  // ========================================================================
  // Generate insights from metrics using rule-based analysis
  // ========================================================================
  const generatedInsights = buildInsightsFromMetrics(metrics);
  insights.push(...generatedInsights);

  // ========================================================================
  // Limit and sort payload to keep it compact
  // ========================================================================
  // Define severity order for sorting (Critical > High > Medium > Low > Info)
  const severityOrder: Record<string, number> = {
    Critical: 1,
    High: 2,
    Medium: 3,
    Low: 4,
    Info: 5,
  };

  // Sort insights by severity (most severe first)
  insights.sort((a, b) => {
    const severityA = severityOrder[a.severity] || 999;
    const severityB = severityOrder[b.severity] || 999;
    return severityA - severityB;
  });

  // Keep only top 10 insights
  const topInsights = insights.slice(0, 10);

  // Prioritize metrics (keep traffic, engagement, SEO metrics first)
  const priorityMetricIds = [
    'ga4_sessions_30d',
    'ga4_organic_sessions_30d',
    'ga4_engagement_rate_30d',
    'gsc_clicks_28d',
    'gsc_position_28d',
    'gsc_ctr_28d',
    'ga4_users_30d',
    'ga4_avg_session_duration_30d',
    'gsc_impressions_28d',
    'gsc_high_imp_low_ctr_count',
  ];

  const priorityMetrics = metrics.filter((m) => priorityMetricIds.includes(m.id));
  const otherMetrics = metrics.filter((m) => !priorityMetricIds.includes(m.id));
  const topMetrics = [...priorityMetrics, ...otherMetrics].slice(0, 10);

  console.log('[Google Telemetry] Evidence collected and processed:', {
    totalMetrics: metrics.length,
    keptMetrics: topMetrics.length,
    totalInsights: insights.length,
    keptInsights: topInsights.length,
  });

  return {
    metrics: topMetrics,
    insights: topInsights,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get authenticated Google API client using service account
 */
async function getGoogleAuth() {
  try {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      console.warn('[Google Telemetry] GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
      return null;
    }

    const credentials = JSON.parse(serviceAccountJson);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
    });

    return auth;
  } catch (error) {
    console.error('[Google Telemetry] Error setting up Google Auth:', error);
    return null;
  }
}

/**
 * Fetch GA4 data for the last 30 days vs previous 30 days
 * Now includes: traffic, engagement, page-level performance
 */
async function fetchGA4Data(
  auth: any,
  propertyId: string
): Promise<{ metrics: EvidenceMetric[]; insights: EvidenceInsight[] }> {
  console.log('[Google Telemetry] Fetching enriched GA4 data for:', propertyId);

  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const metrics: EvidenceMetric[] = [];

  // Ensure propertyId is in the correct format (string)
  const propertyResource = String(propertyId);

  try {
    // Calculate date ranges (last 30 days vs previous 30 days)
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() - 1); // Yesterday

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 29); // 30 days total

    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 29);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // ========================================================================
    // 1. TRAFFIC VOLUME & TREND + ENGAGEMENT
    // Run comprehensive report for current period with engagement metrics
    // ========================================================================
    const currentReport = await analyticsData.properties.runReport({
      property: propertyResource,
      requestBody: {
        dateRanges: [
          {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'engagedSessions' },
          { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
        ],
        dimensions: [],
      },
    });

    // Run report for previous period
    const previousReport = await analyticsData.properties.runReport({
      property: propertyResource,
      requestBody: {
        dateRanges: [
          {
            startDate: formatDate(prevStartDate),
            endDate: formatDate(prevEndDate),
          },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'engagedSessions' },
          { name: 'averageSessionDuration' },
          { name: 'engagementRate' },
        ],
        dimensions: [],
      },
    });

    // Extract current metrics
    const currentRow = currentReport.data.rows?.[0];
    const previousRow = previousReport.data.rows?.[0];

    if (currentRow && previousRow) {
      // Helper to calculate change metrics
      const calcChange = (current: number, previous: number) => {
        const absoluteChange = current - previous;
        const percentChange = previous > 0 ? (absoluteChange / previous) * 100 : 0;
        const direction: 'up' | 'down' | 'flat' =
          Math.abs(percentChange) < 5 ? 'flat' : percentChange > 0 ? 'up' : 'down';
        return { absoluteChange, percentChange, direction };
      };

      // Extract all metric values
      const currentSessions = parseInt(currentRow.metricValues?.[0]?.value || '0');
      const previousSessions = parseInt(previousRow.metricValues?.[0]?.value || '0');
      const sessionsChange = calcChange(currentSessions, previousSessions);

      const currentUsers = parseInt(currentRow.metricValues?.[1]?.value || '0');
      const previousUsers = parseInt(previousRow.metricValues?.[1]?.value || '0');
      const usersChange = calcChange(currentUsers, previousUsers);

      const currentNewUsers = parseInt(currentRow.metricValues?.[2]?.value || '0');
      const previousNewUsers = parseInt(previousRow.metricValues?.[2]?.value || '0');
      const newUsersChange = calcChange(currentNewUsers, previousNewUsers);

      const currentEngagedSessions = parseInt(currentRow.metricValues?.[3]?.value || '0');
      const previousEngagedSessions = parseInt(previousRow.metricValues?.[3]?.value || '0');
      const engagedSessionsChange = calcChange(currentEngagedSessions, previousEngagedSessions);

      const currentAvgDuration = parseFloat(currentRow.metricValues?.[4]?.value || '0');
      const previousAvgDuration = parseFloat(previousRow.metricValues?.[4]?.value || '0');
      const avgDurationChange = calcChange(currentAvgDuration, previousAvgDuration);

      const currentEngagementRate = parseFloat(currentRow.metricValues?.[5]?.value || '0');
      const previousEngagementRate = parseFloat(previousRow.metricValues?.[5]?.value || '0');
      const engagementRateChange = calcChange(currentEngagementRate * 100, previousEngagementRate * 100);

      // Add traffic metrics
      metrics.push({
        id: 'ga4_sessions_30d',
        source: 'ga4',
        label: 'Sessions',
        value: currentSessions,
        unit: 'sessions',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: sessionsChange.absoluteChange,
        changePercent: sessionsChange.percentChange,
        direction: sessionsChange.direction,
        area: 'Funnel',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'ga4_users_30d',
        source: 'ga4',
        label: 'Active Users',
        value: currentUsers,
        unit: 'users',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: usersChange.absoluteChange,
        changePercent: usersChange.percentChange,
        direction: usersChange.direction,
        area: 'Funnel',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'ga4_new_users_30d',
        source: 'ga4',
        label: 'New Users',
        value: currentNewUsers,
        unit: 'users',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: newUsersChange.absoluteChange,
        changePercent: newUsersChange.percentChange,
        direction: newUsersChange.direction,
        area: 'Funnel',
        timestamp: new Date().toISOString(),
      });

      // Add engagement metrics
      metrics.push({
        id: 'ga4_engagement_rate_30d',
        source: 'ga4',
        label: 'Engagement Rate',
        value: (currentEngagementRate * 100).toFixed(1),
        unit: '%',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: engagementRateChange.absoluteChange,
        changePercent: engagementRateChange.percentChange,
        direction: engagementRateChange.direction,
        area: 'Website UX',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'ga4_avg_session_duration_30d',
        source: 'ga4',
        label: 'Avg Session Duration',
        value: currentAvgDuration.toFixed(0),
        unit: 's',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: avgDurationChange.absoluteChange,
        changePercent: avgDurationChange.percentChange,
        direction: avgDurationChange.direction,
        area: 'Website UX',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'ga4_engaged_sessions_30d',
        source: 'ga4',
        label: 'Engaged Sessions',
        value: currentEngagedSessions,
        unit: 'sessions',
        period: 'last_30_days',
        comparisonPeriod: 'prev_30_days',
        change: engagedSessionsChange.absoluteChange,
        changePercent: engagedSessionsChange.percentChange,
        direction: engagedSessionsChange.direction,
        area: 'Website UX',
        timestamp: new Date().toISOString(),
      });

      // ========================================================================
      // 2. ORGANIC TRAFFIC with period-over-period comparison
      // ========================================================================
      const [organicCurrentReport, organicPreviousReport] = await Promise.all([
        analyticsData.properties.runReport({
          property: propertyResource,
          requestBody: {
            dateRanges: [
              {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
              },
            ],
            metrics: [{ name: 'sessions' }],
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            dimensionFilter: {
              filter: {
                fieldName: 'sessionDefaultChannelGroup',
                stringFilter: {
                  matchType: 'EXACT',
                  value: 'Organic Search',
                },
              },
            },
          },
        }),
        analyticsData.properties.runReport({
          property: propertyResource,
          requestBody: {
            dateRanges: [
              {
                startDate: formatDate(prevStartDate),
                endDate: formatDate(prevEndDate),
              },
            ],
            metrics: [{ name: 'sessions' }],
            dimensions: [{ name: 'sessionDefaultChannelGroup' }],
            dimensionFilter: {
              filter: {
                fieldName: 'sessionDefaultChannelGroup',
                stringFilter: {
                  matchType: 'EXACT',
                  value: 'Organic Search',
                },
              },
            },
          },
        }),
      ]);

      const organicCurrentRow = organicCurrentReport.data.rows?.[0];
      const organicPreviousRow = organicPreviousReport.data.rows?.[0];

      if (organicCurrentRow) {
        const currentOrganicSessions = parseInt(organicCurrentRow.metricValues?.[0]?.value || '0');
        const previousOrganicSessions = parseInt(organicPreviousRow?.metricValues?.[0]?.value || '0');
        const organicChange = calcChange(currentOrganicSessions, previousOrganicSessions);

        metrics.push({
          id: 'ga4_organic_sessions_30d',
          source: 'ga4',
          label: 'Organic Search Sessions',
          value: currentOrganicSessions,
          unit: 'sessions',
          period: 'last_30_days',
          comparisonPeriod: 'prev_30_days',
          change: organicChange.absoluteChange,
          changePercent: organicChange.percentChange,
          direction: organicChange.direction,
          area: 'SEO',
          timestamp: new Date().toISOString(),
        });
      }

      // ========================================================================
      // 3. KEY PAGES PERFORMANCE - Identify pages with engagement issues
      // ========================================================================
      try {
        const pagesReport = await analyticsData.properties.runReport({
          property: propertyResource,
          requestBody: {
            dateRanges: [
              {
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
              },
            ],
            metrics: [
              { name: 'sessions' },
              { name: 'engagementRate' },
              { name: 'averageSessionDuration' },
            ],
            dimensions: [{ name: 'pagePath' }],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
            limit: '10', // Top 10 pages by sessions (string required by googleapis)
          },
        });

        if (pagesReport.data.rows && pagesReport.data.rows.length > 0) {
          // Calculate site-wide average engagement rate for comparison
          const siteAvgEngagement = currentEngagementRate;

          for (const row of pagesReport.data.rows) {
            const pagePath = row.dimensionValues?.[0]?.value || '';
            const pageSessions = parseInt(row.metricValues?.[0]?.value || '0');
            const pageEngagement = parseFloat(row.metricValues?.[1]?.value || '0');
            const pageDuration = parseFloat(row.metricValues?.[2]?.value || '0');

            // Only add metrics for pages with significant traffic
            if (pageSessions < currentSessions * 0.05) continue; // Skip pages < 5% of total

            // Flag pages with significantly lower engagement than site average
            if (pageEngagement < siteAvgEngagement * 0.7) {
              // 30% or more below average
              metrics.push({
                id: `ga4_page_${pagePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
                source: 'ga4',
                label: `Low Engagement: ${pagePath}`,
                value: (pageEngagement * 100).toFixed(1),
                unit: '%',
                period: 'last_30_days',
                area: 'Content',
                timestamp: new Date().toISOString(),
                dimensionKey: ['pagePath', pagePath],
              });
            }
          }
        }
      } catch (pagesError) {
        console.warn('[Google Telemetry] Could not fetch page-level data:', pagesError);
      }
    }

    console.log('[Google Telemetry] Enriched GA4 data fetched:', {
      metricsCount: metrics.length,
    });
  } catch (error) {
    console.error('[Google Telemetry] Error in GA4 fetch:', error);
    throw error;
  }

  return { metrics, insights: [] }; // Insights will be generated later from all metrics
}

/**
 * Fetch Search Console data for the last 28 days
 * Now includes: aggregate metrics, query-level analysis, opportunity identification
 */
async function fetchSearchConsoleData(
  auth: any,
  siteUrl: string
): Promise<{ metrics: EvidenceMetric[]; insights: EvidenceInsight[] }> {
  console.log('[Google Telemetry] Fetching enriched Search Console data for:', siteUrl);

  const searchConsole = google.searchconsole({ version: 'v1', auth });
  const metrics: EvidenceMetric[] = [];

  try {
    // Calculate date range (last 28 days, ending 3 days ago due to GSC delay)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // 3 days ago (GSC data delay)

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 27); // 28 days total

    // Previous period for comparison
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 27);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Helper to calculate change
    const calcChange = (current: number, previous: number) => {
      const absoluteChange = current - previous;
      const percentChange = previous > 0 ? (absoluteChange / previous) * 100 : 0;
      const direction: 'up' | 'down' | 'flat' =
        Math.abs(percentChange) < 5 ? 'flat' : percentChange > 0 ? 'up' : 'down';
      return { absoluteChange, percentChange, direction };
    };

    // ========================================================================
    // 1. AGGREGATE METRICS with period-over-period comparison
    // ========================================================================
    const [currentResponse, previousResponse] = await Promise.all([
      searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: [],
          rowLimit: 1,
        },
      }),
      searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: formatDate(prevStartDate),
          endDate: formatDate(prevEndDate),
          dimensions: [],
          rowLimit: 1,
        },
      }),
    ]);

    const currentRow = currentResponse.data.rows?.[0];
    const previousRow = previousResponse.data.rows?.[0];

    if (currentRow) {
      const currentClicks = currentRow.clicks || 0;
      const previousClicks = previousRow?.clicks || 0;
      const clicksChange = calcChange(currentClicks, previousClicks);

      const currentImpressions = currentRow.impressions || 0;
      const previousImpressions = previousRow?.impressions || 0;
      const impressionsChange = calcChange(currentImpressions, previousImpressions);

      const currentCtr = currentRow.ctr || 0;
      const previousCtr = previousRow?.ctr || 0;
      const ctrChange = calcChange(currentCtr * 100, previousCtr * 100);

      const currentPosition = currentRow.position || 0;
      const previousPosition = previousRow?.position || 0;
      const positionChange = calcChange(currentPosition, previousPosition);

      // Add aggregate metrics
      metrics.push({
        id: 'gsc_clicks_28d',
        source: 'search_console',
        label: 'Search Clicks',
        value: currentClicks,
        unit: 'clicks',
        period: 'last_28_days',
        comparisonPeriod: 'prev_28_days',
        change: clicksChange.absoluteChange,
        changePercent: clicksChange.percentChange,
        direction: clicksChange.direction,
        area: 'SEO',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'gsc_impressions_28d',
        source: 'search_console',
        label: 'Search Impressions',
        value: currentImpressions,
        unit: 'impressions',
        period: 'last_28_days',
        comparisonPeriod: 'prev_28_days',
        change: impressionsChange.absoluteChange,
        changePercent: impressionsChange.percentChange,
        direction: impressionsChange.direction,
        area: 'SEO',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'gsc_ctr_28d',
        source: 'search_console',
        label: 'Avg CTR',
        value: (currentCtr * 100).toFixed(2),
        unit: '%',
        period: 'last_28_days',
        comparisonPeriod: 'prev_28_days',
        change: ctrChange.absoluteChange,
        changePercent: ctrChange.percentChange,
        direction: ctrChange.direction,
        area: 'SEO',
        timestamp: new Date().toISOString(),
      });

      metrics.push({
        id: 'gsc_position_28d',
        source: 'search_console',
        label: 'Avg Position',
        value: currentPosition.toFixed(1),
        unit: 'position',
        period: 'last_28_days',
        comparisonPeriod: 'prev_28_days',
        change: positionChange.absoluteChange,
        changePercent: positionChange.percentChange,
        direction: positionChange.direction,
        area: 'SEO',
        timestamp: new Date().toISOString(),
      });

      // ========================================================================
      // 2. QUERY-LEVEL ANALYSIS - Identify opportunities
      // ========================================================================
      try {
        const queryResponse = await searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            dimensions: ['query'],
            rowLimit: 50, // Top 50 queries by impressions
          },
        });

        if (queryResponse.data.rows && queryResponse.data.rows.length > 0) {
          const queries = queryResponse.data.rows;

          // Calculate median impressions for thresholding
          const sortedByImpressions = [...queries].sort(
            (a, b) => (b.impressions || 0) - (a.impressions || 0)
          );
          const medianImpressions =
            sortedByImpressions[Math.floor(sortedByImpressions.length / 2)]?.impressions || 0;

          // Identify high-impression, low-CTR queries (SEO opportunity)
          const highImpLowCtr = queries.filter((q) => {
            const impressions = q.impressions || 0;
            const ctr = q.ctr || 0;
            return impressions > medianImpressions && ctr < 0.02; // <2% CTR
          });

          if (highImpLowCtr.length > 0) {
            metrics.push({
              id: 'gsc_high_imp_low_ctr_count',
              source: 'search_console',
              label: 'High-Impression Low-CTR Queries',
              value: highImpLowCtr.length,
              unit: 'queries',
              period: 'last_28_days',
              area: 'SEO',
              timestamp: new Date().toISOString(),
            });
          }

          // Identify queries with poor position but high impressions (ranking opportunity)
          const poorPositionQueries = queries.filter((q) => {
            const impressions = q.impressions || 0;
            const position = q.position || 0;
            return impressions > medianImpressions * 0.5 && position > 20;
          });

          if (poorPositionQueries.length > 0) {
            metrics.push({
              id: 'gsc_poor_position_count',
              source: 'search_console',
              label: 'High-Impression Poor-Position Queries',
              value: poorPositionQueries.length,
              unit: 'queries',
              period: 'last_28_days',
              area: 'SEO',
              timestamp: new Date().toISOString(),
            });
          }

          // Optional: Brand vs non-brand analysis
          // Simple heuristic: queries containing common brand terms
          const brandTerms = ['trainrhub', 'hive', 'forms']; // Adjust per company
          const brandQueries = queries.filter((q) => {
            const query = (q.keys?.[0] || '').toLowerCase();
            return brandTerms.some((term) => query.includes(term));
          });

          const totalQueryClicks = queries.reduce((sum, q) => sum + (q.clicks || 0), 0);
          const brandQueryClicks = brandQueries.reduce((sum, q) => sum + (q.clicks || 0), 0);
          const nonBrandQueryClicks = totalQueryClicks - brandQueryClicks;

          const brandClickShare =
            totalQueryClicks > 0 ? (brandQueryClicks / totalQueryClicks) * 100 : 0;

          if (brandQueryClicks > 0 && nonBrandQueryClicks > 0) {
            metrics.push({
              id: 'gsc_brand_click_share',
              source: 'search_console',
              label: 'Brand Query Click Share',
              value: brandClickShare.toFixed(1),
              unit: '%',
              period: 'last_28_days',
              area: 'SEO',
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (queryError) {
        console.warn('[Google Telemetry] Could not fetch query-level data:', queryError);
      }

      console.log('[Google Telemetry] Enriched Search Console data fetched:', {
        metricsCount: metrics.length,
      });
    } else {
      console.log('[Google Telemetry] No Search Console data available');
    }
  } catch (error) {
    console.error('[Google Telemetry] Error in Search Console fetch:', error);
    throw error;
  }

  return { metrics, insights: [] }; // Insights will be generated later from all metrics
}

/**
 * Build actionable insights from metrics using rule-based analysis
 * This applies pattern detection to identify opportunities and issues
 */
function buildInsightsFromMetrics(metrics: EvidenceMetric[]): EvidenceInsight[] {
  const insights: EvidenceInsight[] = [];

  // Helper to find metric by ID
  const findMetric = (id: string) => metrics.find((m) => m.id === id);

  // Helper to get severity based on magnitude
  const getSeverity = (percentChange: number, thresholds: { critical: number; high: number; medium: number }): 'Critical' | 'High' | 'Medium' | 'Low' => {
    const abs = Math.abs(percentChange);
    if (abs >= thresholds.critical) return 'Critical';
    if (abs >= thresholds.high) return 'High';
    if (abs >= thresholds.medium) return 'Medium';
    return 'Low';
  };

  // ========================================================================
  // RULE 1: Traffic surge (sessions increase >20%)
  // ========================================================================
  const sessions = findMetric('ga4_sessions_30d');
  if (sessions && sessions.changePercent !== undefined) {
    if (sessions.changePercent > 20) {
      insights.push({
        id: 'insight_traffic_surge',
        source: 'ga4',
        area: 'Funnel',
        headline: `Strong traffic growth (+${sessions.changePercent.toFixed(0)}%)`,
        detail: `Sessions increased by ${sessions.changePercent.toFixed(1)}% compared to the previous 30 days, indicating positive momentum. Current: ${sessions.value} sessions.`,
        severity: sessions.changePercent > 50 ? 'Medium' : 'Info',
        metricIds: ['ga4_sessions_30d'],
        tag: 'opportunity',
      });
    }
  }

  // ========================================================================
  // RULE 2: Traffic drop (sessions decrease >20%)
  // ========================================================================
  if (sessions && sessions.changePercent !== undefined) {
    if (sessions.changePercent < -20) {
      const severity = getSeverity(sessions.changePercent, { critical: 50, high: 35, medium: 20 });
      insights.push({
        id: 'insight_traffic_drop',
        source: 'ga4',
        area: 'Funnel',
        headline: `Significant traffic decline (${sessions.changePercent.toFixed(0)}%)`,
        detail: `Sessions decreased by ${Math.abs(sessions.changePercent).toFixed(1)}% compared to the previous 30 days. This warrants immediate investigation into traffic sources and technical issues.`,
        severity,
        metricIds: ['ga4_sessions_30d'],
        tag: 'traffic_drop',
      });
    }
  }

  // ========================================================================
  // RULE 3: Organic traffic drop (organic sessions decrease >20%)
  // ========================================================================
  const organicSessions = findMetric('ga4_organic_sessions_30d');
  if (organicSessions && organicSessions.changePercent !== undefined) {
    if (organicSessions.changePercent < -20) {
      insights.push({
        id: 'insight_organic_drop',
        source: 'ga4',
        area: 'SEO',
        headline: `Organic search traffic declining (${organicSessions.changePercent.toFixed(0)}%)`,
        detail: `Organic sessions decreased by ${Math.abs(organicSessions.changePercent).toFixed(1)}% vs previous period. Check for ranking drops, indexing issues, or algorithm updates.`,
        severity: 'High',
        metricIds: ['ga4_organic_sessions_30d'],
        tag: 'traffic_drop',
      });
    } else if (organicSessions.changePercent > 20) {
      insights.push({
        id: 'insight_organic_growth',
        source: 'ga4',
        area: 'SEO',
        headline: `Organic search traffic growing (+${organicSessions.changePercent.toFixed(0)}%)`,
        detail: `Organic sessions increased by ${organicSessions.changePercent.toFixed(1)}% vs previous period. Recent SEO efforts are paying off.`,
        severity: 'Info',
        metricIds: ['ga4_organic_sessions_30d'],
        tag: 'opportunity',
      });
    }
  }

  // ========================================================================
  // RULE 4: Low engagement rate (below 40% or declining >10%)
  // ========================================================================
  const engagementRate = findMetric('ga4_engagement_rate_30d');
  if (engagementRate) {
    const currentRate = parseFloat(String(engagementRate.value));
    const changePercent = engagementRate.changePercent || 0;

    if (currentRate < 40 || changePercent < -10) {
      insights.push({
        id: 'insight_low_engagement',
        source: 'ga4',
        area: 'Website UX',
        headline: currentRate < 40
          ? `Low engagement rate (${currentRate.toFixed(1)}%)`
          : `Engagement rate declining (${changePercent.toFixed(0)}%)`,
        detail: currentRate < 40
          ? `Only ${currentRate.toFixed(1)}% of sessions are engaged. Review site UX, page load speed, and content quality to improve visitor interaction.`
          : `Engagement rate dropped by ${Math.abs(changePercent).toFixed(1)}% to ${currentRate.toFixed(1)}%. Investigate recent site changes or content updates.`,
        severity: currentRate < 30 ? 'High' : 'Medium',
        metricIds: ['ga4_engagement_rate_30d'],
        tag: 'stability',
      });
    }
  }

  // ========================================================================
  // RULE 5: Short session duration (below 60s or declining >20%)
  // ========================================================================
  const avgDuration = findMetric('ga4_avg_session_duration_30d');
  if (avgDuration) {
    const currentDuration = parseFloat(String(avgDuration.value));
    const changePercent = avgDuration.changePercent || 0;

    if (currentDuration < 60 || changePercent < -20) {
      insights.push({
        id: 'insight_short_duration',
        source: 'ga4',
        area: 'Content',
        headline: currentDuration < 60
          ? `Very short session duration (${currentDuration.toFixed(0)}s)`
          : `Session duration declining (${changePercent.toFixed(0)}%)`,
        detail: currentDuration < 60
          ? `Average session duration is only ${currentDuration.toFixed(0)} seconds. Users may not be finding what they need, or content may lack depth.`
          : `Session duration dropped by ${Math.abs(changePercent).toFixed(1)}% to ${currentDuration.toFixed(0)}s. Review content changes and user paths.`,
        severity: 'Medium',
        metricIds: ['ga4_avg_session_duration_30d'],
        tag: 'stability',
      });
    }
  }

  // ========================================================================
  // RULE 6: Page-level engagement issues
  // ========================================================================
  const lowEngagementPages = metrics.filter((m) =>
    m.id.startsWith('ga4_page_') && m.area === 'Content'
  );
  if (lowEngagementPages.length > 0) {
    const pagePaths = lowEngagementPages
      .map((m) => m.dimensionKey?.[1])
      .filter(Boolean)
      .slice(0, 3);

    insights.push({
      id: 'insight_low_engagement_pages',
      source: 'ga4',
      area: 'Content',
      headline: `${lowEngagementPages.length} high-traffic pages have low engagement`,
      detail: `Key pages like ${pagePaths.join(', ')} have significantly lower engagement than site average. Review content quality, CTAs, and page load performance.`,
      severity: 'Medium',
      metricIds: lowEngagementPages.map((m) => m.id),
      tag: 'opportunity',
    });
  }

  // ========================================================================
  // RULE 7: Search Console - Poor average position
  // ========================================================================
  const avgPosition = findMetric('gsc_position_28d');
  if (avgPosition) {
    const position = parseFloat(String(avgPosition.value));
    if (position > 20) {
      insights.push({
        id: 'insight_poor_position',
        source: 'search_console',
        area: 'SEO',
        headline: `Low search visibility (avg position ${position.toFixed(1)})`,
        detail: `Average search position is ${position.toFixed(1)}, indicating significant opportunity to improve rankings and visibility through SEO optimization.`,
        severity: position > 30 ? 'High' : 'Medium',
        metricIds: ['gsc_position_28d'],
        tag: 'opportunity',
      });
    } else if (position > 10) {
      insights.push({
        id: 'insight_moderate_position',
        source: 'search_console',
        area: 'SEO',
        headline: `Moderate search visibility (avg position ${position.toFixed(1)})`,
        detail: `Average position is ${position.toFixed(1)}. Moving into top 10 could significantly increase organic traffic.`,
        severity: 'Medium',
        metricIds: ['gsc_position_28d'],
        tag: 'opportunity',
      });
    }
  }

  // ========================================================================
  // RULE 8: Search Console - Low CTR
  // ========================================================================
  const avgCtr = findMetric('gsc_ctr_28d');
  if (avgCtr) {
    const ctr = parseFloat(String(avgCtr.value));
    if (ctr < 2) {
      insights.push({
        id: 'insight_low_ctr',
        source: 'search_console',
        area: 'SEO',
        headline: `Low click-through rate (${ctr.toFixed(2)}%)`,
        detail: `Average CTR is ${ctr.toFixed(2)}%. Improving titles and meta descriptions could increase traffic from existing impressions without changing rankings.`,
        severity: 'Medium',
        metricIds: ['gsc_ctr_28d'],
        tag: 'opportunity',
      });
    }
  }

  // ========================================================================
  // RULE 9: High-impression, low-CTR queries
  // ========================================================================
  const highImpLowCtr = findMetric('gsc_high_imp_low_ctr_count');
  if (highImpLowCtr && Number(highImpLowCtr.value) > 0) {
    insights.push({
      id: 'insight_ctr_opportunity',
      source: 'search_console',
      area: 'SEO',
      headline: `${highImpLowCtr.value} queries with high impressions but low CTR`,
      detail: `Several high-visibility queries have poor click-through rates. Optimizing titles and meta descriptions for these queries could unlock quick wins.`,
      severity: 'Medium',
      metricIds: ['gsc_high_imp_low_ctr_count'],
      tag: 'opportunity',
    });
  }

  // ========================================================================
  // RULE 10: Poor position queries (ranking opportunity)
  // ========================================================================
  const poorPosition = findMetric('gsc_poor_position_count');
  if (poorPosition && Number(poorPosition.value) > 0) {
    insights.push({
      id: 'insight_ranking_opportunity',
      source: 'search_console',
      area: 'SEO',
      headline: `${poorPosition.value} high-impression queries ranking poorly`,
      detail: `Multiple queries with significant search volume are ranking outside top 20. Targeted content optimization could improve visibility.`,
      severity: 'Medium',
      metricIds: ['gsc_poor_position_count'],
      tag: 'opportunity',
    });
  }

  // ========================================================================
  // RULE 11: Brand dependency (if brand click share > 70%)
  // ========================================================================
  const brandShare = findMetric('gsc_brand_click_share');
  if (brandShare) {
    const share = parseFloat(String(brandShare.value));
    if (share > 70) {
      insights.push({
        id: 'insight_brand_dependency',
        source: 'search_console',
        area: 'SEO',
        headline: `High brand search dependency (${share.toFixed(0)}%)`,
        detail: `${share.toFixed(0)}% of search clicks come from branded queries. Diversifying into non-brand keywords could unlock growth.`,
        severity: 'Info',
        metricIds: ['gsc_brand_click_share'],
        tag: 'opportunity',
      });
    }
  }

  console.log('[Google Telemetry] Generated insights from metrics:', {
    metricsCount: metrics.length,
    insightsCount: insights.length,
  });

  return insights;
}

/**
 * Format evidence payload into a prompt-friendly text summary
 * Use this to include telemetry context in LLM prompts
 */
export function formatEvidenceForPrompt(evidence: EvidencePayload | undefined): string {
  if (!evidence || (!evidence.metrics?.length && !evidence.insights?.length)) {
    return '';
  }

  let summary = '=== REAL TELEMETRY DATA ===\n\n';

  if (evidence.metrics && evidence.metrics.length > 0) {
    summary += 'Key Metrics:\n';
    for (const metric of evidence.metrics) {
      summary += `- ${metric.label}: ${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`;
      if (metric.changePercent !== undefined) {
        const sign = metric.changePercent > 0 ? '+' : '';
        summary += ` (${sign}${metric.changePercent.toFixed(1)}% vs ${metric.comparisonPeriod || 'previous period'})`;
      }
      summary += `\n`;
    }
    summary += '\n';
  }

  if (evidence.insights && evidence.insights.length > 0) {
    summary += 'Key Insights:\n';
    for (const insight of evidence.insights) {
      const headline = insight.headline || insight.title || 'Untitled';
      const detail = insight.detail || insight.description || '';
      summary += `- [${insight.severity}] ${headline}`;
      if (detail) {
        summary += `: ${detail}`;
      }
      summary += `\n`;
    }
    summary += '\n';
  }

  summary += '=== END TELEMETRY DATA ===\n';

  return summary;
}
