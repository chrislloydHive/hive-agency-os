// lib/os/insights/index.ts
// OS Insight Engine - Proactive Intelligence System
//
// This module provides pattern detection and insight generation
// for identifying risks, opportunities, and trends in company data.

export * from './insightTypes';
export * from './insightEngine';
export * from './insightExtractors';
export {
  ALL_PATTERNS,
  buildInsightFromMatch,
  type PatternDefinition,
  type PatternContext,
  type SnapshotData,
  type FindingData,
} from './insightPatterns';
