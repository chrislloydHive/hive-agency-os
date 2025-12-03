// lib/integrations/index.ts
// Central export for all media integrations

export * from './types';

// Individual connectors
export { default as googleAdsConnector, isConnected as isGoogleAdsConnected } from './google-ads';
export { default as ga4Connector, isConnected as isGA4Connected } from './ga4';
export { default as gbpConnector, isConnected as isGBPConnected } from './gbp';
export { default as lsaConnector, isConnected as isLSAConnected } from './lsa';
export { default as callrailConnector, isConnected as isCallTrackingConnected } from './callrail';

import { googleAdsConnector } from './google-ads';
import { ga4Connector } from './ga4';
import { gbpConnector } from './gbp';
import { lsaConnector } from './lsa';
import { callrailConnector } from './callrail';
import type { IntegrationConnector, IntegrationStatus } from './types';

// Integration registry
export const integrations = {
  'google-ads': googleAdsConnector,
  ga4: ga4Connector,
  gbp: gbpConnector,
  lsa: lsaConnector,
  callrail: callrailConnector,
} as const;

export type IntegrationKey = keyof typeof integrations;

/**
 * Get all integration statuses for a company
 */
export async function getAllIntegrationStatuses(
  companyId: string
): Promise<Record<IntegrationKey, IntegrationStatus>> {
  const [googleAds, ga4, gbp, lsa, callrail] = await Promise.all([
    googleAdsConnector.getStatus(companyId),
    ga4Connector.getStatus(companyId),
    gbpConnector.getStatus(companyId),
    lsaConnector.getStatus(companyId),
    callrailConnector.getStatus(companyId),
  ]);

  return {
    'google-ads': googleAds,
    ga4,
    gbp,
    lsa,
    callrail,
  };
}

/**
 * Check if any integrations are connected
 */
export async function hasAnyIntegration(companyId: string): Promise<boolean> {
  const statuses = await getAllIntegrationStatuses(companyId);
  return Object.values(statuses).some((status) => status.connected);
}

/**
 * Get list of connected integrations
 */
export async function getConnectedIntegrations(
  companyId: string
): Promise<IntegrationKey[]> {
  const statuses = await getAllIntegrationStatuses(companyId);
  return (Object.entries(statuses) as [IntegrationKey, IntegrationStatus][])
    .filter(([_, status]) => status.connected)
    .map(([key]) => key);
}

/**
 * Integration display metadata
 */
export const integrationMeta: Record<
  IntegrationKey,
  {
    name: string;
    description: string;
    icon: string;
    setupUrl?: string;
  }
> = {
  'google-ads': {
    name: 'Google Ads',
    description: 'Search, Display, and Video campaigns',
    icon: 'ads',
  },
  ga4: {
    name: 'Google Analytics 4',
    description: 'Website traffic and conversions',
    icon: 'analytics',
  },
  gbp: {
    name: 'Google Business Profile',
    description: 'Local visibility and engagement',
    icon: 'business',
  },
  lsa: {
    name: 'Local Services Ads',
    description: 'Google Guaranteed leads',
    icon: 'local',
  },
  callrail: {
    name: 'Call Tracking',
    description: 'CallRail or CTM call attribution',
    icon: 'phone',
  },
};
