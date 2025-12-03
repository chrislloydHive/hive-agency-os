// lib/integrations/types.ts
// Shared types for media integrations

export interface IntegrationStatus {
  connected: boolean;
  lastSyncAt?: string;
  accountId?: string;
  accountName?: string;
  error?: string;
}

export interface IntegrationSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
  cpl: number | null;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface StoreMetrics {
  storeId: string;
  storeName: string;
  impressions: number;
  clicks: number;
  calls: number;
  directionRequests: number;
  websiteClicks: number;
  leads: number;
  spend: number | null;
  cpl: number | null;
  visibilityScore: number | null;
}

export interface IntegrationConnector {
  isConnected(companyId: string): Promise<boolean>;
  getStatus(companyId: string): Promise<IntegrationStatus>;
  getSummary(companyId: string, days?: number): Promise<IntegrationSummary | null>;
  getStoreMetrics(companyId: string, storeId: string): Promise<StoreMetrics | null>;
}

// Channel-specific types
export interface GoogleAdsMetrics extends IntegrationSummary {
  searchImpressionShare: number | null;
  qualityScore: number | null;
  campaignBreakdown: {
    campaignId: string;
    campaignName: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
  }[];
}

export interface GA4Metrics extends IntegrationSummary {
  sessions: number;
  users: number;
  bounceRate: number;
  avgSessionDuration: number;
  goalCompletions: {
    goalName: string;
    completions: number;
  }[];
  channelBreakdown: {
    channel: string;
    sessions: number;
    conversions: number;
  }[];
}

export interface GBPMetrics {
  visibilityScore: number | null;
  searchImpressions: number;
  mapImpressions: number;
  websiteClicks: number;
  phoneClicks: number;
  directionRequests: number;
  reviews: {
    total: number;
    averageRating: number;
    recentCount: number;
  };
}

export interface LSAMetrics {
  leads: number;
  chargedLeads: number;
  disputedLeads: number;
  spend: number;
  cpl: number | null;
  leadsByCategory: {
    category: string;
    count: number;
  }[];
}

export interface CallTrackingMetrics {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  avgCallDuration: number;
  uniqueCallers: number;
  callsBySource: {
    source: string;
    count: number;
  }[];
}
