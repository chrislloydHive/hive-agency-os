// lib/integrations/lsa.ts
// Google Local Services Ads integration connector (placeholder for future API implementation)

import type {
  IntegrationConnector,
  IntegrationStatus,
  IntegrationSummary,
  StoreMetrics,
  LSAMetrics,
} from './types';

/**
 * Check if LSA is connected for a company
 * TODO: Implement actual API check against WorkspaceSettings or LSA account link
 */
export async function isConnected(companyId: string): Promise<boolean> {
  // Placeholder: Check for LSA account credentials
  return false;
}

/**
 * Get LSA connection status
 */
export async function getStatus(companyId: string): Promise<IntegrationStatus> {
  const connected = await isConnected(companyId);

  if (!connected) {
    return {
      connected: false,
      error: 'Local Services Ads not connected',
    };
  }

  return {
    connected: true,
    lastSyncAt: new Date().toISOString(),
    accountId: 'placeholder',
    accountName: 'Placeholder LSA Account',
  };
}

/**
 * Get LSA performance summary
 */
export async function getSummary(
  companyId: string,
  days: number = 30
): Promise<IntegrationSummary | null> {
  const connected = await isConnected(companyId);
  if (!connected) return null;

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    impressions: 0, // LSA doesn't report impressions
    clicks: 0,
    ctr: 0,
    spend: 0,
    conversions: 0, // Leads
    cpl: null,
    dateRange: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    },
  };
}

/**
 * Get store-level LSA metrics
 */
export async function getStoreMetrics(
  companyId: string,
  storeId: string
): Promise<StoreMetrics | null> {
  const connected = await isConnected(companyId);
  if (!connected) return null;

  return {
    storeId,
    storeName: 'Placeholder Store',
    impressions: 0,
    clicks: 0,
    calls: 0,
    directionRequests: 0,
    websiteClicks: 0,
    leads: 0,
    spend: null,
    cpl: null,
    visibilityScore: null,
  };
}

/**
 * Get detailed LSA metrics
 */
export async function getLSAMetrics(
  companyId: string,
  days: number = 30
): Promise<LSAMetrics | null> {
  const connected = await isConnected(companyId);
  if (!connected) return null;

  return {
    leads: 0,
    chargedLeads: 0,
    disputedLeads: 0,
    spend: 0,
    cpl: null,
    leadsByCategory: [],
  };
}

/**
 * Get leads by service category
 * TODO: Implement actual API call
 */
export async function getLeadsByCategory(
  companyId: string,
  days: number = 30
): Promise<{ category: string; leads: number; charged: number }[]> {
  return [];
}

/**
 * Get lead quality metrics
 * TODO: Implement actual API call
 */
export async function getLeadQualityMetrics(
  companyId: string,
  days: number = 30
): Promise<{
  totalLeads: number;
  chargedRate: number;
  disputeRate: number;
  avgResponseTime: number | null;
}> {
  return {
    totalLeads: 0,
    chargedRate: 0,
    disputeRate: 0,
    avgResponseTime: null,
  };
}

// Export as connector interface
export const lsaConnector: IntegrationConnector = {
  isConnected,
  getStatus,
  getSummary,
  getStoreMetrics,
};

export default lsaConnector;
