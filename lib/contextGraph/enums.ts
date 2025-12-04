// lib/contextGraph/enums.ts
// Canonical enums for the Company Context Graph
//
// These enums are the single source of truth for all categorical values
// across the entire Hive OS system.

import { z } from 'zod';

// ============================================================================
// Business Model
// ============================================================================

export const BusinessModel = z.enum([
  'dtc',              // Direct to Consumer
  'retail',           // Retail / Physical stores
  'ecommerce',        // E-commerce focused
  'b2b',              // Business to Business
  'b2b2c',            // B2B2C hybrid
  'saas',             // Software as a Service
  'marketplace',      // Marketplace / Platform
  'franchise',        // Franchise model
  'subscription',     // Subscription-based
  'services',         // Professional services
  'healthcare',       // Healthcare / Medical
  'hospitality',      // Hotels / Restaurants
  'real_estate',      // Real Estate
  'automotive',       // Automotive
  'education',        // Education
  'nonprofit',        // Non-profit
  'other',            // Other
]);

export type BusinessModel = z.infer<typeof BusinessModel>;

export const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  dtc: 'Direct to Consumer',
  retail: 'Retail',
  ecommerce: 'E-commerce',
  b2b: 'B2B',
  b2b2c: 'B2B2C',
  saas: 'SaaS',
  marketplace: 'Marketplace',
  franchise: 'Franchise',
  subscription: 'Subscription',
  services: 'Professional Services',
  healthcare: 'Healthcare',
  hospitality: 'Hospitality',
  real_estate: 'Real Estate',
  automotive: 'Automotive',
  education: 'Education',
  nonprofit: 'Non-profit',
  other: 'Other',
};

// ============================================================================
// Market Maturity
// ============================================================================

export const MarketMaturity = z.enum([
  'launch',           // New to market / Pre-launch
  'growth',           // Growing / Scaling
  'plateau',          // Mature / Stable
  'turnaround',       // Declining / Turnaround needed
  'exit',             // Winding down
  'other',            // Other
]);

export type MarketMaturity = z.infer<typeof MarketMaturity>;

export const MARKET_MATURITY_LABELS: Record<MarketMaturity, string> = {
  launch: 'Launch / New',
  growth: 'Growth',
  plateau: 'Mature / Plateau',
  turnaround: 'Turnaround',
  exit: 'Exit / Wind-down',
  other: 'Other',
};

// ============================================================================
// Risk Tolerance
// ============================================================================

export const RiskTolerance = z.enum([
  'conservative',     // Risk-averse, prefer stability
  'balanced',         // Balanced approach
  'aggressive',       // Growth-focused, higher risk tolerance
]);

export type RiskTolerance = z.infer<typeof RiskTolerance>;

export const RISK_TOLERANCE_LABELS: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

// ============================================================================
// Primary Objective
// ============================================================================

export const PrimaryObjective = z.enum([
  'lead_generation',    // Generate leads
  'sales_conversions',  // Drive sales / conversions
  'traffic_growth',     // Grow website traffic
  'brand_awareness',    // Build brand awareness
  'engagement',         // Increase engagement
  'retention',          // Customer retention
  'blended',            // Blended goals
]);

export type PrimaryObjective = z.infer<typeof PrimaryObjective>;

export const PRIMARY_OBJECTIVE_LABELS: Record<PrimaryObjective, string> = {
  lead_generation: 'Lead Generation',
  sales_conversions: 'Sales & Conversions',
  traffic_growth: 'Traffic Growth',
  brand_awareness: 'Brand Awareness',
  engagement: 'Engagement',
  retention: 'Customer Retention',
  blended: 'Blended Goals',
};

// ============================================================================
// Universal KPIs
// ============================================================================

export const UniversalKpi = z.enum([
  // Acquisition KPIs
  'leads',
  'calls',
  'form_submissions',
  'installs',
  'appointments',
  'signups',
  'trials',
  'demo_requests',

  // Revenue KPIs
  'revenue',
  'transactions',
  'orders',
  'bookings',
  'aov',                // Average Order Value
  'arpu',               // Average Revenue Per User
  'ltv',                // Lifetime Value

  // Efficiency KPIs
  'cpa',                // Cost Per Acquisition
  'cpl',                // Cost Per Lead
  'cac',                // Customer Acquisition Cost
  'roas',               // Return on Ad Spend
  'mer',                // Marketing Efficiency Ratio
  'contribution_margin',

  // Engagement KPIs
  'sessions',
  'users',
  'pageviews',
  'time_on_site',
  'bounce_rate',
  'pages_per_session',

  // Awareness KPIs
  'impressions',
  'reach',
  'frequency',
  'brand_lift',
  'share_of_voice',

  // Retention KPIs
  'retention_rate',
  'churn_rate',
  'repeat_purchase_rate',
  'nps',                // Net Promoter Score
]);

export type UniversalKpi = z.infer<typeof UniversalKpi>;

export const UNIVERSAL_KPI_LABELS: Record<UniversalKpi, string> = {
  leads: 'Leads',
  calls: 'Calls',
  form_submissions: 'Form Submissions',
  installs: 'Installs',
  appointments: 'Appointments',
  signups: 'Signups',
  trials: 'Trials',
  demo_requests: 'Demo Requests',
  revenue: 'Revenue',
  transactions: 'Transactions',
  orders: 'Orders',
  bookings: 'Bookings',
  aov: 'Average Order Value',
  arpu: 'Average Revenue Per User',
  ltv: 'Lifetime Value',
  cpa: 'Cost Per Acquisition',
  cpl: 'Cost Per Lead',
  cac: 'Customer Acquisition Cost',
  roas: 'Return on Ad Spend',
  mer: 'Marketing Efficiency Ratio',
  contribution_margin: 'Contribution Margin',
  sessions: 'Sessions',
  users: 'Users',
  pageviews: 'Pageviews',
  time_on_site: 'Time on Site',
  bounce_rate: 'Bounce Rate',
  pages_per_session: 'Pages Per Session',
  impressions: 'Impressions',
  reach: 'Reach',
  frequency: 'Frequency',
  brand_lift: 'Brand Lift',
  share_of_voice: 'Share of Voice',
  retention_rate: 'Retention Rate',
  churn_rate: 'Churn Rate',
  repeat_purchase_rate: 'Repeat Purchase Rate',
  nps: 'Net Promoter Score',
};

// ============================================================================
// Media Channel IDs
// ============================================================================

export const MediaChannelId = z.enum([
  // Search
  'search_google',
  'search_bing',
  'search_apple',

  // Local
  'maps_gbp',
  'lsa',                // Local Services Ads

  // Social
  'social_meta',
  'social_tiktok',
  'social_linkedin',
  'social_pinterest',
  'social_x',
  'social_snapchat',
  'social_reddit',

  // Display & Video
  'display',
  'retargeting',
  'youtube',
  'programmatic_video',
  'ctv_ott',

  // Audio
  'radio',
  'streaming_audio',
  'podcast',

  // Other
  'out_of_home',
  'influencers',
  'email_sms',
  'organic_content',
  'partnerships',
  'pr',
  'events',
  'in_store_media',
  'direct_mail',
  'affiliate',
]);

export type MediaChannelId = z.infer<typeof MediaChannelId>;

export const MEDIA_CHANNEL_LABELS: Record<MediaChannelId, string> = {
  search_google: 'Google Search',
  search_bing: 'Microsoft Search',
  search_apple: 'Apple Search Ads',
  maps_gbp: 'Google Maps / GBP',
  lsa: 'Local Services Ads',
  social_meta: 'Meta (Facebook/Instagram)',
  social_tiktok: 'TikTok',
  social_linkedin: 'LinkedIn',
  social_pinterest: 'Pinterest',
  social_x: 'X (Twitter)',
  social_snapchat: 'Snapchat',
  social_reddit: 'Reddit',
  display: 'Display',
  retargeting: 'Retargeting',
  youtube: 'YouTube',
  programmatic_video: 'Programmatic Video',
  ctv_ott: 'CTV/OTT',
  radio: 'Radio',
  streaming_audio: 'Streaming Audio',
  podcast: 'Podcast',
  out_of_home: 'Out of Home',
  influencers: 'Influencers',
  email_sms: 'Email & SMS',
  organic_content: 'Organic Content',
  partnerships: 'Partnerships',
  pr: 'PR',
  events: 'Events',
  in_store_media: 'In-Store Media',
  direct_mail: 'Direct Mail',
  affiliate: 'Affiliate',
};

// ============================================================================
// Time Horizon
// ============================================================================

export const TimeHorizon = z.enum([
  '30d',
  '90d',
  'quarter',
  'half_year',
  'year',
  'custom',
]);

export type TimeHorizon = z.infer<typeof TimeHorizon>;

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  '30d': '30 Days',
  '90d': '90 Days',
  quarter: 'Quarterly',
  half_year: '6 Months',
  year: 'Annual',
  custom: 'Custom',
};

// ============================================================================
// Health Status
// ============================================================================

export const HealthStatus = z.enum([
  'healthy',
  'warning',
  'critical',
  'unknown',
  'not_configured',
]);

export type HealthStatus = z.infer<typeof HealthStatus>;

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  unknown: 'Unknown',
  not_configured: 'Not Configured',
};

// ============================================================================
// Funnel Stage
// ============================================================================

export const FunnelStage = z.enum([
  'awareness',
  'consideration',
  'conversion',
  'retention',
  'advocacy',
]);

export type FunnelStage = z.infer<typeof FunnelStage>;

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  awareness: 'Awareness',
  consideration: 'Consideration',
  conversion: 'Conversion',
  retention: 'Retention',
  advocacy: 'Advocacy',
};
