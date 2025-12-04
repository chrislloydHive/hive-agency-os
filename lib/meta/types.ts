// lib/meta/types.ts
// Phase 6: Emergent Intelligence - Type Definitions
//
// Core types for meta-learning, cross-company analytics, and schema evolution

import type { DomainName } from '../contextGraph/companyContextGraph';

// ============================================================================
// Global Embedding Types
// ============================================================================

/**
 * Extended embedding with temporal and cross-company dimensions
 */
export interface GlobalEmbedding {
  companyId: string;
  companyName: string;
  embedding: number[];

  // Dimensional components
  brandVector: number[];
  audienceVector: number[];
  productVector: number[];
  mediaVector: number[];
  performanceVector: number[];
  temporalVector: number[];

  // Metadata
  industry: string;
  businessModel: string;
  companySize: string;
  maturityStage: 'startup' | 'growth' | 'mature' | 'enterprise';

  // Quality metrics
  completeness: number;
  confidence: number;
  lastUpdated: string;
  version: string;
}

/**
 * Company cluster definition
 */
export interface CompanyCluster {
  clusterId: string;
  name: string;
  description: string;

  // Cluster characteristics
  primaryIndustry: string;
  primaryBusinessModel: string;
  avgCompanySize: string;
  avgMaturity: string;

  // Members
  companyIds: string[];
  memberCount: number;

  // Centroid
  centroidEmbedding: number[];

  // Cluster quality
  cohesion: number; // How tight is the cluster (0-1)
  separation: number; // How distinct from other clusters (0-1)

  createdAt: string;
  lastUpdated: string;
}

/**
 * Outlier score for a company
 */
export interface CompanyOutlierScore {
  companyId: string;
  overallScore: number; // 0-1, higher = more outlier

  dimensionScores: {
    performance: number;
    strategy: number;
    audience: number;
    creative: number;
    channel: number;
    growth: number;
  };

  // What makes them an outlier
  outlierReasons: string[];

  // Is this positive or negative outlier?
  outlierType: 'positive' | 'negative' | 'neutral';

  // Recommendations
  recommendations: string[];

  analyzedAt: string;
}

// ============================================================================
// Meta Pattern Types
// ============================================================================

/**
 * Meta pattern discovered across companies
 */
export interface MetaPattern {
  id: string;
  type: MetaPatternType;
  name: string;
  description: string;

  // Discovery details
  vertical: string;
  businessModels: string[];
  applicableCompanyStages: string[];

  // Evidence
  evidence: MetaPatternEvidence[];
  sampleSize: number;
  crossCompanyConfidence: number;
  statisticalSignificance: number;

  // Actionability
  recommendedActions: PatternAction[];
  expectedImpact: {
    metric: string;
    improvement: number;
    confidence: number;
  };

  // Lifecycle
  status: 'emerging' | 'validated' | 'stable' | 'declining' | 'deprecated';
  discoveredAt: string;
  lastValidatedAt: string;
  validationCount: number;
}

export type MetaPatternType =
  | 'media_mix'
  | 'creative_angle'
  | 'persona_cluster'
  | 'seasonality'
  | 'kpi_breakpoint'
  | 'content_correlation'
  | 'website_structure'
  | 'funnel_optimization'
  | 'channel_emergence'
  | 'audience_evolution';

export interface MetaPatternEvidence {
  companyId: string;
  companyName: string;
  observation: string;
  metric: string;
  value: number;
  timestamp: string;
  weight: number;
}

export interface PatternAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  expectedOutcome: string;
  implementation: string;
  prerequisites: string[];
}

// ============================================================================
// Vertical Model Types
// ============================================================================

/**
 * Industry-specific intelligence model
 */
export interface VerticalModel {
  id: string;
  vertical: string;
  subVerticals: string[];

  // Audience expectations
  audienceExpectations: {
    primaryDemographics: string[];
    behaviorPatterns: string[];
    decisionFactors: string[];
    contentPreferences: string[];
  };

  // Creative norms
  creativeNorms: {
    topPerformingFormats: string[];
    messagingAngles: string[];
    visualStyles: string[];
    tonePreferences: string[];
    avoidPatterns: string[];
  };

  // KPI ranges
  kpiRanges: {
    cpa: { p10: number; p25: number; p50: number; p75: number; p90: number };
    roas: { p10: number; p25: number; p50: number; p75: number; p90: number };
    ctr: { p10: number; p25: number; p50: number; p75: number; p90: number };
    conversionRate: { p10: number; p25: number; p50: number; p75: number; p90: number };
    cac: { p10: number; p25: number; p50: number; p75: number; p90: number };
    ltv: { p10: number; p25: number; p50: number; p75: number; p90: number };
  };

  // Common pitfalls
  commonPitfalls: {
    pitfall: string;
    frequency: number;
    impact: 'high' | 'medium' | 'low';
    prevention: string;
  }[];

  // Seasonality
  seasonalityCurve: {
    month: number;
    demandIndex: number;
    competitionIndex: number;
    recommendedBudgetMultiplier: number;
  }[];

  // Competitive intensity
  competitiveIntensity: {
    overall: 'low' | 'medium' | 'high' | 'extreme';
    byChannel: Record<string, 'low' | 'medium' | 'high' | 'extreme'>;
    trendDirection: 'increasing' | 'stable' | 'decreasing';
  };

  // Model metadata
  sampleSize: number;
  confidence: number;
  lastUpdated: string;
  version: string;
}

// ============================================================================
// Global Benchmark Types
// ============================================================================

/**
 * Extended global benchmark
 */
export interface GlobalBenchmark {
  id: string;
  vertical: string;
  businessModel: string;
  companySize: string;
  period: string;

  // Media efficiency
  mediaEfficiency: {
    byChannel: Record<string, ChannelBenchmark>;
    overallRoas: BenchmarkPercentiles;
    overallCpa: BenchmarkPercentiles;
  };

  // Creative performance
  creativePerformance: {
    avgCreativeLifespan: number;
    topFormats: { format: string; performance: number }[];
    fatigueCurve: { day: number; performanceIndex: number }[];
  };

  // Persona effectiveness
  personaEffectiveness: {
    topPersonas: { persona: string; conversionRate: number; ltv: number }[];
    personaDiversity: number;
  };

  // Content velocity
  contentVelocity: {
    postsPerWeek: BenchmarkPercentiles;
    engagementRate: BenchmarkPercentiles;
    contentTypes: { type: string; performance: number }[];
  };

  // SEO visibility
  seoVisibility: {
    organicTrafficShare: BenchmarkPercentiles;
    keywordRankings: BenchmarkPercentiles;
    domainAuthority: BenchmarkPercentiles;
  };

  // Funnel benchmarks
  funnelBenchmarks: {
    visitToLead: BenchmarkPercentiles;
    leadToOpportunity: BenchmarkPercentiles;
    opportunityToClose: BenchmarkPercentiles;
    overallConversion: BenchmarkPercentiles;
  };

  // GA4 engagement
  ga4Engagement: {
    avgSessionDuration: BenchmarkPercentiles;
    pagesPerSession: BenchmarkPercentiles;
    bounceRate: BenchmarkPercentiles;
    engagedSessions: BenchmarkPercentiles;
  };

  // CAC/LTV patterns
  unitEconomics: {
    cac: BenchmarkPercentiles;
    ltv: BenchmarkPercentiles;
    ltvCacRatio: BenchmarkPercentiles;
    paybackMonths: BenchmarkPercentiles;
  };

  // MER/ROAS distributions
  efficiencyMetrics: {
    mer: BenchmarkPercentiles;
    roas: BenchmarkPercentiles;
    incrementalRoas: BenchmarkPercentiles;
  };

  // Sample & quality
  sampleSize: number;
  dataQuality: 'high' | 'medium' | 'low';
  generatedAt: string;
}

export interface ChannelBenchmark {
  channel: string;
  cpa: BenchmarkPercentiles;
  roas: BenchmarkPercentiles;
  ctr: BenchmarkPercentiles;
  cpc: BenchmarkPercentiles;
  adoptionRate: number;
  trend: 'growing' | 'stable' | 'declining';
}

export interface BenchmarkPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// Schema Evolution Types
// ============================================================================

/**
 * Proposed schema change
 */
export interface SchemaEvolutionProposal {
  id: string;
  type: SchemaChangeType;

  // What's changing
  domain: DomainName;
  fieldName: string;

  // Details by type
  additionDetails?: {
    fieldType: string;
    description: string;
    defaultValue: unknown;
    reasoning: string;
  };

  deprecationDetails?: {
    reason: string;
    usageCount: number;
    replacementField?: string;
  };

  renameDetails?: {
    newName: string;
    reason: string;
  };

  // Evidence
  evidence: SchemaEvolutionEvidence[];
  affectedCompanies: number;

  // Impact assessment
  impactAssessment: {
    breakingChange: boolean;
    migrationComplexity: 'low' | 'medium' | 'high';
    estimatedMigrationTime: string;
    riskLevel: 'low' | 'medium' | 'high';
  };

  // Migration plan
  migrationPlan?: MigrationPlan;

  // Lifecycle
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  proposedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  completedAt?: string;
}

export type SchemaChangeType = 'addition' | 'deprecation' | 'rename' | 'type_change';

export interface SchemaEvolutionEvidence {
  type: 'missing_across_companies' | 'unused_field' | 'naming_inconsistency' | 'pattern_emergence';
  description: string;
  sampleSize: number;
  confidence: number;
}

export interface MigrationPlan {
  steps: MigrationStep[];
  rollbackPlan: string;
  testingRequirements: string[];
  estimatedDuration: string;
}

export interface MigrationStep {
  order: number;
  description: string;
  action: string;
  reversible: boolean;
}

// ============================================================================
// Meta Memory Types
// ============================================================================

/**
 * Global intelligence memory entry
 */
export interface MetaMemoryEntry {
  id: string;
  type: MetaMemoryType;

  // Content
  key: string;
  value: unknown;
  description: string;

  // Context
  vertical?: string;
  applicableCompanyStages?: string[];
  applicableBusinessModels?: string[];

  // Source
  source: MetaMemorySource;
  sourceId?: string;

  // Quality
  confidence: number;
  validationCount: number;
  successfulApplications: number;

  // Lifecycle
  createdAt: string;
  lastUsedAt: string;
  expiresAt?: string;
  status: 'active' | 'validated' | 'deprecated' | 'expired';
}

export type MetaMemoryType =
  | 'pattern'
  | 'vertical_insight'
  | 'schema_proposal'
  | 'experiment_learning'
  | 'best_practice'
  | 'strategic_memory'
  | 'anomaly_record'
  | 'model_update';

export type MetaMemorySource =
  | 'pattern_discovery'
  | 'vertical_analysis'
  | 'schema_evolution'
  | 'experiment_analysis'
  | 'performance_analysis'
  | 'anomaly_detection'
  | 'model_training'
  | 'human_input';

// ============================================================================
// Global Anomaly Types
// ============================================================================

/**
 * Global anomaly detection result
 */
export interface GlobalAnomaly {
  id: string;
  type: GlobalAnomalyType;
  severity: 'info' | 'warning' | 'critical' | 'emergency';

  // What's happening
  title: string;
  description: string;

  // Scope
  affectedVerticals: string[];
  affectedCompanyIds: string[];
  affectedChannels?: string[];
  affectedRegions?: string[];

  // Metrics
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviationPercent: number;

  // Evidence
  evidence: AnomalyEvidence[];

  // Analysis
  possibleCauses: string[];
  recommendedActions: string[];

  // Lifecycle
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolution?: string;
  status: 'active' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
}

export type GlobalAnomalyType =
  | 'conversion_drop'
  | 'media_cost_spike'
  | 'channel_emergence'
  | 'creative_fatigue'
  | 'regional_disruption'
  | 'tracking_issue'
  | 'platform_change'
  | 'competitive_shift'
  | 'seasonality_deviation';

export interface AnomalyEvidence {
  companyId: string;
  companyName: string;
  metric: string;
  baseline: number;
  current: number;
  deviation: number;
  timestamp: string;
}

// ============================================================================
// Model Training Types
// ============================================================================

/**
 * Global model training run result
 */
export interface ModelTrainingRun {
  id: string;
  runAt: string;
  duration: number;

  // Input stats
  companiesProcessed: number;
  embeddingsUpdated: number;
  performanceDataPoints: number;

  // Analysis results
  failedPredictions: FailedPrediction[];
  modelImprovements: ModelImprovement[];

  // Updates made
  updatedModels: {
    predictionModel: boolean;
    channelMixRules: boolean;
    personaRules: boolean;
    creativeRules: boolean;
  };

  // Quality metrics
  predictionAccuracyBefore: number;
  predictionAccuracyAfter: number;
  improvementPercent: number;

  status: 'success' | 'partial' | 'failed';
  error?: string;
}

export interface FailedPrediction {
  companyId: string;
  predictionType: string;
  predicted: number;
  actual: number;
  error: number;
  possibleReasons: string[];
}

export interface ModelImprovement {
  model: string;
  aspect: string;
  beforeValue: number;
  afterValue: number;
  improvement: number;
  description: string;
}

// ============================================================================
// Emergent Reasoning Types
// ============================================================================

/**
 * Cross-company strategic insight
 */
export interface EmergentInsight {
  id: string;
  type: EmergentInsightType;

  // Content
  title: string;
  insight: string;
  reasoning: string;

  // Scope
  applicableCompanyIds: string[];
  applicableVerticals: string[];

  // Evidence
  evidence: EmergentEvidence[];
  confidence: number;

  // Actionability
  recommendations: string[];
  expectedImpact: string;

  // Lifecycle
  generatedAt: string;
  validatedAt?: string;
  status: 'new' | 'validated' | 'applied' | 'expired';
}

export type EmergentInsightType =
  | 'success_pattern'
  | 'generalizable_strategy'
  | 'audience_evolution'
  | 'creative_cycle'
  | 'growth_ceiling'
  | 'market_saturation'
  | 'expansion_opportunity'
  | 'underperformance';

export interface EmergentEvidence {
  type: string;
  description: string;
  companyIds: string[];
  metrics: Record<string, number>;
}

// ============================================================================
// Vertical Report Types
// ============================================================================

/**
 * Comprehensive vertical intelligence report
 */
export interface VerticalReport {
  id: string;
  vertical: string;
  period: string;
  generatedAt: string;

  // Executive summary
  executiveSummary: string;

  // Sections
  marketOverview: {
    totalCompanies: number;
    totalSpend: number;
    avgRoas: number;
    yoyGrowth: number;
    competitiveIntensity: string;
  };

  topPatterns: MetaPattern[];
  benchmarks: GlobalBenchmark;
  verticalModel: VerticalModel;

  activeAnomalies: GlobalAnomaly[];
  emergingOpportunities: EmergentInsight[];

  // Recommendations
  strategicRecommendations: {
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
    applicableCompanyCount: number;
  }[];
}
