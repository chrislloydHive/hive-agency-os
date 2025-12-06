// components/competitive/index.ts
// Competitive intelligence visualization components

export { PositioningMapCore, PositioningMapEmptyState } from './PositioningMapCore';
export { PositioningMapBrandHalo, PositioningMapQBRCard } from './PositioningMapBrandHalo';
export { PositioningMapSection } from './PositioningMapSection';
export { CompetitiveLandscapeQBR } from './CompetitiveLandscapeQBR';
export {
  extractPositioningMapData,
  mapPositionToSvgCoordinates,
  mapSvgToPosition,
  hasPositioningData,
  hasAxesConfigured,
  getQuadrant,
  getQuadrantCounts,
  findWhitespaceZones,
  findCrowdedZones,
  type CompetitorPoint,
  type BrandPosition,
  type PositioningMapData,
} from './positioningMapUtils';
