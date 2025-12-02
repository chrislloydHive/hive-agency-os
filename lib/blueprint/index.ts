// lib/blueprint/index.ts
// Blueprint Strategy Engine - Main exports

export {
  runBlueprintPipeline,
  fetchDiagnosticsData,
  fetchAnalyticsData,
  fetchBrainData,
  fetchWorkData,
  type BlueprintPipelineData,
  type DiagnosticsData,
  type AnalyticsData,
  type BrainData,
  type WorkData,
  type DiagnosticIssue,
  type DiagnosticRecommendation,
  type ToolRunStatus,
} from './pipeline';

export {
  synthesizeStrategy,
  generateStrategySynthesis,
  type StrategySynthesis,
  type StrategicFocusArea,
  type PrioritizedAction,
  type SuggestedTool,
  type NinetyDayPlan,
} from './synthesizer';

export {
  getRecommendedToolsForBlueprint,
  createWorkFromRecommendedTool,
  type RecommendedTool,
  type ToolRecommendationContext,
  type CreateWorkFromToolParams,
} from './recommendations';
