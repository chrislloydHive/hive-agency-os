// lib/competition-v3/index.ts
// Competition Lab V3 - Main Entry Point
//
// A comprehensive competitive intelligence system that:
// 1. Discovers competitors using context-driven queries
// 2. Enriches candidates with AI-powered metadata extraction
// 3. Classifies into 6 categories (direct, partial, fractional, internal, platform, irrelevant)
// 4. Scores on 7 dimensions + threat/relevance composites
// 5. Positions on Value Model vs ICP alignment map
// 6. Generates narrative insights and recommendations

// Main orchestrator
export {
  runCompetitionV3,
  type RunCompetitionV3Options,
  type CompetitionV3Result,
} from './orchestrator/runCompetitionAnalysis';

// Storage layer (dual-storage: Competition Runs table + Context Graph)
export {
  saveCompetitionRunV3,
  updateCompetitionRunV3,
  getCompetitionRunV3,
  getLatestCompetitionRunV3,
  listCompetitionRunsV3,
  type CompetitionRunV3Payload,
} from './store';

// Summarization for Context Graph
export {
  summarizeForContext,
  type CompetitiveSummary,
  type CompetitorSummary,
} from './summarizeForContext';

// Context Graph writer
export {
  updateCompetitiveDomain,
  type UpdateCompetitiveDomainResult,
} from './updateCompetitiveDomain';

// Types
export * from './types';

// Discovery layer
export { generateSearchQueries } from './discovery/searchQueries';
export { searchWithAI, runDiscovery } from './discovery/aiSearch';

// Enrichment layer
export { enrichCandidates } from './enrichment/metadataExtractor';
export { classifyCandidates, selectFinalCompetitors } from './enrichment/categoryClassifier';

// Scoring engine
export { scoreCompetitors } from './scoring/computeScores';

// Positioning
export {
  computePositioningCoordinates,
  getQuadrantStats,
  getAxisLabels,
  getQuadrantDescriptions,
  getTypeColors,
} from './positioning/computeCoordinates';

// Narrative
export {
  generateLandscapeNarrative,
  generateRecommendations,
} from './orchestrator/narrativeGenerator';
