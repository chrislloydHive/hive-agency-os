// lib/contextGraph/domains/digitalInfra.ts
// Digital Infrastructure Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';
import { HealthStatus } from '../enums';

/**
 * Platform Connection status
 */
export const PlatformConnection = z.object({
  platform: z.string(),
  status: HealthStatus,
  accountId: z.string().nullable(),
  lastSynced: z.string().nullable(),
  notes: z.string().nullable(),
});

export type PlatformConnection = z.infer<typeof PlatformConnection>;

/**
 * DigitalInfra domain captures tracking, analytics, and platform health.
 * This informs measurement strategy and data quality decisions.
 */
export const DigitalInfraDomain = z.object({
  // Tracking Stack
  trackingStackSummary: WithMeta(z.string()),
  trackingTools: WithMetaArray(z.string()),

  // GA4
  ga4Health: WithMeta(HealthStatus),
  ga4PropertyId: WithMeta(z.string()),
  ga4ConversionEvents: WithMetaArray(z.string()),
  ga4Notes: WithMeta(z.string()),

  // Google Search Console
  searchConsoleHealth: WithMeta(HealthStatus),
  searchConsoleProperty: WithMeta(z.string()),
  searchConsoleNotes: WithMeta(z.string()),

  // Google Business Profile
  gbpHealth: WithMeta(HealthStatus),
  gbpLocationCount: WithMeta(z.number()),
  gbpNotes: WithMeta(z.string()),

  // Call Tracking
  callTracking: WithMeta(z.string()),
  callTrackingProvider: WithMeta(z.string()),
  callTrackingHealth: WithMeta(HealthStatus),

  // CRM
  crmAndLeadFlow: WithMeta(z.string()),
  crmPlatform: WithMeta(z.string()),
  crmIntegrationHealth: WithMeta(HealthStatus),

  // Offline Conversion
  offlineConversionTracking: WithMeta(z.string()),
  offlineConversionSetup: WithMeta(HealthStatus),

  // Store Visit Measurement
  storeVisitMeasurement: WithMeta(z.string()),
  storeVisitSetup: WithMeta(HealthStatus),

  // Platform Connections
  platformConnections: WithMetaArray(PlatformConnection),

  // Measurement Limits
  measurementLimits: WithMeta(z.string()),
  dataQuality: WithMeta(z.string()),
  attributionModel: WithMeta(z.string()),
  attributionWindow: WithMeta(z.string()),
});

export type DigitalInfraDomain = z.infer<typeof DigitalInfraDomain>;

/**
 * Create an empty DigitalInfra domain
 */
export function createEmptyDigitalInfraDomain(): DigitalInfraDomain {
  return {
    trackingStackSummary: { value: null, provenance: [] },
    trackingTools: { value: [], provenance: [] },
    ga4Health: { value: null, provenance: [] },
    ga4PropertyId: { value: null, provenance: [] },
    ga4ConversionEvents: { value: [], provenance: [] },
    ga4Notes: { value: null, provenance: [] },
    searchConsoleHealth: { value: null, provenance: [] },
    searchConsoleProperty: { value: null, provenance: [] },
    searchConsoleNotes: { value: null, provenance: [] },
    gbpHealth: { value: null, provenance: [] },
    gbpLocationCount: { value: null, provenance: [] },
    gbpNotes: { value: null, provenance: [] },
    callTracking: { value: null, provenance: [] },
    callTrackingProvider: { value: null, provenance: [] },
    callTrackingHealth: { value: null, provenance: [] },
    crmAndLeadFlow: { value: null, provenance: [] },
    crmPlatform: { value: null, provenance: [] },
    crmIntegrationHealth: { value: null, provenance: [] },
    offlineConversionTracking: { value: null, provenance: [] },
    offlineConversionSetup: { value: null, provenance: [] },
    storeVisitMeasurement: { value: null, provenance: [] },
    storeVisitSetup: { value: null, provenance: [] },
    platformConnections: { value: [], provenance: [] },
    measurementLimits: { value: null, provenance: [] },
    dataQuality: { value: null, provenance: [] },
    attributionModel: { value: null, provenance: [] },
    attributionWindow: { value: null, provenance: [] },
  };
}
