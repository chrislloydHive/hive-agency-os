// lib/analytics/models.ts
// Type definitions for Growth Analytics data structures

export type TrafficSummary = {
  users: number | null;
  sessions: number | null;
  pageviews: number | null;
  avgSessionDurationSeconds: number | null;
  bounceRate: number | null;
};

export type ChannelSummary = {
  channel: string;
  sessions: number;
  users: number | null;
  conversions: number | null;
};

export type LandingPageSummary = {
  path: string;
  sessions: number;
  users: number | null;
  conversions: number | null;
  avgEngagementTimeSeconds: number | null;
};

export type SearchQuerySummary = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number | null; // avg position
};

export type SearchPageSummary = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number | null;
};

export type GrowthAnalyticsSnapshot = {
  range: { startDate: string; endDate: string };
  generatedAt: string;

  traffic: TrafficSummary;
  channels: ChannelSummary[];
  topLandingPages: LandingPageSummary[];

  searchQueries: SearchQuerySummary[];
  searchPages: SearchPageSummary[];

  // For AI context
  notes?: string[];
};

// AI Insights types
export type IssueInsight = {
  title: string;
  detail: string;
  evidence: string;
};

export type RecommendedAction = {
  title: string;
  area: 'traffic' | 'conversion' | 'content' | 'seo' | 'technical';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  steps: string[];
};

export type AIInsights = {
  summary: string;
  issues: IssueInsight[];
  recommendedActions: RecommendedAction[];
};
