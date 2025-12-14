// lib/contextMap/index.ts
// Context Map utilities

export {
  computeZoneBounds,
  layoutNodesInZone,
  computeZonesWithNodes,
  computeEdges,
  findNodeAtPoint,
  findZoneAtPoint,
} from './zoneLayout';

export {
  groupNodesByZone,
  groupNodesByDomain,
  filterNodes,
  searchNodes,
  sortNodes,
  sortNodesByVisualPriority,
  calculateStatistics,
  mapToArray,
  getNodesWithProposals,
  getNodesNeedingAttention,
} from './nodeGrouping';

export {
  FIELD_REGISTRY,
  FIELD_REGISTRY_MAP,
  LEGACY_PATH_MAP,
  getFieldEntry,
  getFieldEntryByLegacyPath,
  getFieldsForZone,
  getCriticalFields,
  getRecommendedFields,
} from './fieldRegistry';

export {
  hydrateLegacyContext,
  mergeNodes,
  countPopulatedFormFields,
  verifyFieldCoverage,
  createGhostNode,
  getGhostNodesForMissingRequired,
  mergeNodesWithGhosts,
  getBlockedByKeysFromNodes,
} from './legacyHydration';

export type { NodeStatistics, SortField, SortDirection, SortConfig } from './nodeGrouping';
export type { FieldRegistryEntry, FieldSource, FieldStatus } from './fieldRegistry';
export type { LegacyHydrationOptions, HydrationResult } from './legacyHydration';
export type { LayoutResult, LayoutNodesOptions, ComputeZonesOptions } from './zoneLayout';
