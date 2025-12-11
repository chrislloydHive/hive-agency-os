// lib/os/context/index.ts
// Context module exports

// Types
export * from './types';

// Graph Model (canonical types and utilities)
export * from './graphModel';

// Integrity functions
export {
  calculateFreshnessScore,
  detectConflict,
  autoResolveConflict,
  checkMissingFields,
  calculateContextHealth,
  checkContextIntegrity,
  updateProvenance,
  lockField,
  unlockField,
  verifyField,
  getFieldsNeedingAttention,
} from './graphIntegrity';

// Brain integration
export {
  toHealthSummary,
  checkCompanyContextHealth,
  getDetailedIntegrityCheck,
  healthToDataSource,
  getQuickHealthIndicator,
  trackFieldUpdate,
  getFieldsByStatus,
  generateHealthReport,
  type ContextHealthSummary,
} from './brainIntegration';

// Context Overview Loader
export {
  loadContextOverview,
  type ContextOverview,
  type DomainStats,
} from './loadContextOverview';

// Coverage Graph Loader
export {
  loadCoverageGraph,
  type CoverageNode,
  type CoverageNodeStatus,
  type CoverageDomainSummary,
  type CoverageGraph,
} from './loadCoverageGraph';

// Relationship/Dependency Graph Loader
export {
  loadRelationshipGraph,
  getNodeConnections,
  getMissingDependencies,
  type RelationshipType,
  type RelationshipEdge,
  type RelationshipNode,
  type RelationshipGraph,
  type NodePosition,
} from './dependencies';
