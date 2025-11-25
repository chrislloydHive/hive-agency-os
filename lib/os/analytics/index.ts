// lib/os/analytics/index.ts
// Workspace Analytics Module Index
// Re-exports all analytics types and functions

// Types
export * from './types';

// GA4 Analytics
export {
  getWorkspaceGa4Summary,
  createDateRange,
  createPreviousPeriodRange,
  type Ga4WorkspaceSummary,
} from './ga4';

// GSC Analytics
export {
  getWorkspaceGscSummary,
  type GscWorkspaceSummary,
} from './gsc';

// Funnel Analytics
export {
  getWorkspaceFunnelSummary,
  calculateConversionRate,
  getFunnelConversionRates,
} from './funnel';

// Alerts Engine
export {
  generateAnalyticsAlerts,
  filterAlertsByCategory,
  filterAlertsBySeverity,
  type GenerateAlertsInput,
} from './alerts';

// Overview Aggregator
export {
  getWorkspaceAnalyticsOverview,
  getWorkspaceAnalytics7Days,
  getWorkspaceAnalytics30Days,
  getWorkspaceAnalytics90Days,
  parseDateRangePreset,
  hasAnalyticsData,
  getOverviewStats,
  type GetWorkspaceOverviewOptions,
} from './overview';
