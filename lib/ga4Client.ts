import { BetaAnalyticsDataClient } from '@google-analytics/data';

// Types for DMA Insights Dashboard
export type AuditFunnelTotals = {
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number; // 0–1
  uniqueUsers: number | null;
};

export type AuditFunnelByChannel = {
  channel: string;
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number; // 0–1
};

export type AuditFunnelByCampaign = {
  campaign: string;
  sourceMedium: string;
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number;
};

export type AuditFunnelByLandingPage = {
  path: string;
  sessions: number;
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number;
};

export type AuditFunnelTimePoint = {
  date: string; // YYYY-MM-DD
  auditsStarted: number;
  auditsCompleted: number;
  completionRate: number;
};

export type AuditFunnelSnapshot = {
  range: { startDate: string; endDate: string };
  generatedAt: string;
  totals: AuditFunnelTotals;
  byChannel: AuditFunnelByChannel[];
  byCampaign: AuditFunnelByCampaign[];
  byLandingPage: AuditFunnelByLandingPage[];
  timeSeries: AuditFunnelTimePoint[];
};

// Singleton GA4 client
let ga4Client: BetaAnalyticsDataClient | null = null;

function getGa4Client(): BetaAnalyticsDataClient {
  if (ga4Client) return ga4Client;

  const propertyId = process.env.GA4_PROPERTY_ID;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID is not set');
  }
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN must be set for GA4 OAuth'
    );
  }

  // Build an "authorized_user" credential object; @google-analytics/data / google-auth-library
  // will use this to automatically refresh access tokens as needed.
  const credentials = {
    type: 'authorized_user',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  };

  ga4Client = new BetaAnalyticsDataClient({ credentials });
  return ga4Client;
}

function getPropertyId(): string {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID is not set');
  }
  return propertyId;
}

type EventAgg = {
  started: number;
  completed: number;
};

/**
 * Fetches a comprehensive audit funnel snapshot from GA4
 */
export async function getAuditFunnelSnapshot(
  startDate: string,
  endDate: string
): Promise<AuditFunnelSnapshot> {
  const client = getGa4Client();
  const propertyId = getPropertyId();

  // Query 1: totals + time series (date + eventName)
  const [timeSeriesReport] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'date' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['audit_started', 'audit_completed'],
        },
      },
    },
    limit: 100000,
  });

  // Query 2: by channel
  const [channelReport] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'sessionSource' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['audit_started', 'audit_completed'],
        },
      },
    },
    limit: 1000,
  });

  // Query 3: by campaign
  const [campaignReport] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionCampaignName' },
      { name: 'sessionSource' },
      { name: 'eventName' },
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['audit_started', 'audit_completed'],
        },
      },
    },
    limit: 2000,
  });

  // Query 4: by landing page
  const [landingReport] = await client.runReport({
    property: propertyId,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'sessions' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: {
          values: ['audit_started', 'audit_completed'],
        },
      },
    },
    limit: 2000,
  });

  // (Optional) Query 5: unique users
  let uniqueUsers: number | null = null;
  try {
    const [usersReport] = await client.runReport({
      property: propertyId,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'totalUsers' }],
    });
    const row = usersReport.rows?.[0];
    if (row && row.metricValues?.[0]?.value) {
      uniqueUsers = Number(row.metricValues[0].value) || null;
    }
  } catch {
    uniqueUsers = null;
  }

  // Aggregate totals + time series
  const totalsAgg: EventAgg = { started: 0, completed: 0 };
  const timeSeriesMap: Record<string, EventAgg> = {};

  for (const row of timeSeriesReport.rows ?? []) {
    const date = row.dimensionValues?.[0]?.value ?? '';
    const eventName = row.dimensionValues?.[1]?.value ?? '';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0) || 0;

    if (!date) continue;

    if (!timeSeriesMap[date]) {
      timeSeriesMap[date] = { started: 0, completed: 0 };
    }

    if (eventName === 'audit_started') {
      totalsAgg.started += eventCount;
      timeSeriesMap[date].started += eventCount;
    } else if (eventName === 'audit_completed') {
      totalsAgg.completed += eventCount;
      timeSeriesMap[date].completed += eventCount;
    }
  }

  const totals: AuditFunnelTotals = {
    auditsStarted: totalsAgg.started,
    auditsCompleted: totalsAgg.completed,
    completionRate: totalsAgg.started > 0 ? totalsAgg.completed / totalsAgg.started : 0,
    uniqueUsers,
  };

  const timeSeries: AuditFunnelTimePoint[] = Object.entries(timeSeriesMap)
    .map(([date, agg]) => {
      const rate = agg.started > 0 ? agg.completed / agg.started : 0;
      return {
        date,
        auditsStarted: agg.started,
        auditsCompleted: agg.completed,
        completionRate: rate,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Aggregate by channel
  const channelMap: Record<string, EventAgg> = {};

  for (const row of channelReport.rows ?? []) {
    const channel = row.dimensionValues?.[0]?.value || '(unknown)';
    const eventName = row.dimensionValues?.[1]?.value ?? '';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0) || 0;

    if (!channelMap[channel]) {
      channelMap[channel] = { started: 0, completed: 0 };
    }

    if (eventName === 'audit_started') {
      channelMap[channel].started += eventCount;
    } else if (eventName === 'audit_completed') {
      channelMap[channel].completed += eventCount;
    }
  }

  const byChannel: AuditFunnelByChannel[] = Object.entries(channelMap)
    .map(([channel, agg]) => {
      const rate = agg.started > 0 ? agg.completed / agg.started : 0;
      return {
        channel,
        auditsStarted: agg.started,
        auditsCompleted: agg.completed,
        completionRate: rate,
      };
    })
    .sort((a, b) => b.auditsStarted - a.auditsStarted)
    .slice(0, 50);

  // Aggregate by campaign
  const campaignKey = (campaign: string, srcMed: string) => `${campaign}|||${srcMed}`;

  const campaignMap: Record<
    string,
    { campaign: string; sourceMedium: string } & EventAgg
  > = {};

  for (const row of campaignReport.rows ?? []) {
    const campaign = row.dimensionValues?.[0]?.value || '(not set)';
    const sourceMedium = row.dimensionValues?.[1]?.value || '(not set)';
    const eventName = row.dimensionValues?.[2]?.value ?? '';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0) || 0;

    if (!campaign || campaign === '(not set)') {
      continue;
    }

    const key = campaignKey(campaign, sourceMedium);
    if (!campaignMap[key]) {
      campaignMap[key] = {
        campaign,
        sourceMedium,
        started: 0,
        completed: 0,
      };
    }

    if (eventName === 'audit_started') {
      campaignMap[key].started += eventCount;
    } else if (eventName === 'audit_completed') {
      campaignMap[key].completed += eventCount;
    }
  }

  const byCampaign: AuditFunnelByCampaign[] = Object.values(campaignMap)
    .map((entry) => {
      const rate = entry.started > 0 ? entry.completed / entry.started : 0;
      return {
        campaign: entry.campaign,
        sourceMedium: entry.sourceMedium,
        auditsStarted: entry.started,
        auditsCompleted: entry.completed,
        completionRate: rate,
      };
    })
    .sort((a, b) => b.auditsStarted - a.auditsStarted)
    .slice(0, 50);

  // Aggregate by landing page
  type LandingAgg = EventAgg & { sessions: number };
  const landingMap: Record<string, LandingAgg> = {};

  for (const row of landingReport.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value || '(not set)';
    const eventName = row.dimensionValues?.[1]?.value ?? '';
    const eventCount = Number(row.metricValues?.[0]?.value ?? 0) || 0;
    const sessions = Number(row.metricValues?.[1]?.value ?? 0) || 0;

    if (!landingMap[path]) {
      landingMap[path] = { started: 0, completed: 0, sessions: 0 };
    }

    landingMap[path].sessions += sessions;

    if (eventName === 'audit_started') {
      landingMap[path].started += eventCount;
    } else if (eventName === 'audit_completed') {
      landingMap[path].completed += eventCount;
    }
  }

  const byLandingPage: AuditFunnelByLandingPage[] = Object.entries(landingMap)
    .map(([path, agg]) => {
      const rate = agg.started > 0 ? agg.completed / agg.started : 0;
      return {
        path,
        sessions: agg.sessions,
        auditsStarted: agg.started,
        auditsCompleted: agg.completed,
        completionRate: rate,
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 50);

  return {
    range: { startDate, endDate },
    generatedAt: new Date().toISOString(),
    totals,
    byChannel,
    byCampaign,
    byLandingPage,
    timeSeries,
  };
}
