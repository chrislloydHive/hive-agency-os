// lib/os/impact/impactTypes.ts
// Types for the Impact & ROI Engine
// Maps work items to KPI improvements and calculates ROI

// ============================================================================
// Core Impact Types
// ============================================================================

export type ImpactCategory =
  | 'traffic'           // Website traffic impact
  | 'conversions'       // Conversion rate impact
  | 'visibility'        // Search visibility impact
  | 'engagement'        // User engagement impact
  | 'brand_trust'       // Brand perception impact
  | 'local_presence'    // Local search impact
  | 'technical_health'; // Technical performance impact

export type ImpactLevel = 'high' | 'medium' | 'low' | 'minimal';

export type EffortLevel = 'quick-win' | 'moderate' | 'significant' | 'major';

export type MeasurementStatus = 'pending' | 'in_progress' | 'measured' | 'estimated';

// ============================================================================
// Work Item Impact Mapping
// ============================================================================

export interface WorkItemImpact {
  /** Work item ID */
  workItemId: string;
  /** Work item title */
  workItemTitle: string;
  /** Lab or category source */
  source: string;
  /** Completion date if completed */
  completedAt?: string;
  /** Primary impact category */
  primaryImpact: ImpactCategory;
  /** Secondary impact categories */
  secondaryImpacts: ImpactCategory[];
  /** Estimated impact level */
  estimatedLevel: ImpactLevel;
  /** Effort required */
  effort: EffortLevel;
  /** KPI estimates */
  kpiEstimates: KPIEstimate[];
  /** Actual measurements (if available) */
  measurements?: ImpactMeasurement[];
  /** ROI calculation */
  roi?: ROICalculation;
}

export interface KPIEstimate {
  /** KPI name */
  kpi: string;
  /** Metric name */
  metric: string;
  /** Current value (baseline) */
  baseline?: number;
  /** Estimated improvement (absolute or percentage) */
  estimatedChange: number;
  /** Whether change is percentage */
  isPercentage: boolean;
  /** Confidence in estimate 0-100 */
  confidence: number;
  /** Timeframe to see impact */
  timeframe: string;
}

export interface ImpactMeasurement {
  /** KPI measured */
  kpi: string;
  /** Baseline value */
  baseline: number;
  /** Measured value after */
  measured: number;
  /** Actual change */
  actualChange: number;
  /** Percentage change */
  percentChange: number;
  /** Date measured */
  measuredAt: string;
  /** Attribution confidence */
  attributionConfidence: number;
}

export interface ROICalculation {
  /** Estimated cost (effort hours * rate) */
  estimatedCost: number;
  /** Estimated value generated */
  estimatedValue: number;
  /** ROI percentage */
  roiPercent: number;
  /** Payback period */
  paybackPeriod?: string;
  /** Calculation methodology */
  methodology: string;
}

// ============================================================================
// Impact Summary Types
// ============================================================================

export interface CompanyImpactSummary {
  /** Company ID */
  companyId: string;
  /** Summary period */
  period: {
    start: string;
    end: string;
  };
  /** Total work items completed */
  totalCompleted: number;
  /** Work items with measured impact */
  measuredCount: number;
  /** Aggregate impact by category */
  byCategory: Record<ImpactCategory, CategoryImpactSummary>;
  /** Top performing work items */
  topPerformers: WorkItemImpact[];
  /** Aggregate ROI */
  aggregateROI: AggregateROI;
  /** Score impact */
  scoreImpact: ScoreImpactSummary;
}

export interface CategoryImpactSummary {
  category: ImpactCategory;
  workItemCount: number;
  averageImpactLevel: ImpactLevel;
  totalEstimatedChange: number;
  totalMeasuredChange?: number;
}

export interface AggregateROI {
  totalEstimatedCost: number;
  totalEstimatedValue: number;
  overallROIPercent: number;
  costPerPointImprovement: number;
}

export interface ScoreImpactSummary {
  /** Starting overall score */
  startingScore: number | null;
  /** Current overall score */
  currentScore: number | null;
  /** Score change */
  scoreChange: number | null;
  /** Attributed work items */
  attributedWorkItems: string[];
  /** Estimated vs actual comparison */
  estimatedVsActual?: {
    estimated: number;
    actual: number;
    accuracy: number;
  };
}

// ============================================================================
// Impact Attribution Types
// ============================================================================

export interface ImpactAttribution {
  /** Finding ID that was addressed */
  findingId: string;
  /** Work item that addressed it */
  workItemId: string;
  /** Lab affected */
  labSlug: string;
  /** Before score for this area */
  beforeScore?: number;
  /** After score for this area */
  afterScore?: number;
  /** Confidence in attribution 0-100 */
  confidence: number;
  /** Other factors that may have contributed */
  confoundingFactors: string[];
}

// ============================================================================
// ROI Configuration
// ============================================================================

export interface ROIConfig {
  /** Default hourly rate for effort calculation */
  hourlyRate: number;
  /** Value per traffic visit */
  valuePerVisit: number;
  /** Value per conversion */
  valuePerConversion: number;
  /** Value per score point improvement */
  valuePerScorePoint: number;
  /** Default hours by effort level */
  effortHours: Record<EffortLevel, number>;
}

export const DEFAULT_ROI_CONFIG: ROIConfig = {
  hourlyRate: 100,
  valuePerVisit: 0.50,
  valuePerConversion: 50,
  valuePerScorePoint: 500,
  effortHours: {
    'quick-win': 2,
    'moderate': 8,
    'significant': 24,
    'major': 80,
  },
};

// ============================================================================
// Impact Model Types (for prediction)
// ============================================================================

export interface ImpactModel {
  /** Category this model applies to */
  category: ImpactCategory;
  /** Typical KPIs affected */
  typicalKPIs: string[];
  /** Impact multipliers by finding severity */
  severityMultipliers: Record<string, number>;
  /** Timeframes for different impact types */
  timeframes: {
    immediate: string[];   // KPIs that change immediately
    shortTerm: string[];   // 1-2 weeks
    mediumTerm: string[];  // 1-3 months
    longTerm: string[];    // 3+ months
  };
}

// Default impact models by category
export const IMPACT_MODELS: Record<ImpactCategory, ImpactModel> = {
  traffic: {
    category: 'traffic',
    typicalKPIs: ['sessions', 'users', 'pageviews', 'organic_traffic'],
    severityMultipliers: { critical: 1.5, high: 1.2, medium: 1.0, low: 0.7 },
    timeframes: {
      immediate: ['pageviews'],
      shortTerm: ['sessions', 'users'],
      mediumTerm: ['organic_traffic'],
      longTerm: [],
    },
  },
  conversions: {
    category: 'conversions',
    typicalKPIs: ['conversion_rate', 'leads', 'form_submissions', 'calls'],
    severityMultipliers: { critical: 2.0, high: 1.5, medium: 1.0, low: 0.5 },
    timeframes: {
      immediate: ['form_submissions'],
      shortTerm: ['leads', 'calls'],
      mediumTerm: ['conversion_rate'],
      longTerm: [],
    },
  },
  visibility: {
    category: 'visibility',
    typicalKPIs: ['ranking_positions', 'impressions', 'click_through_rate', 'featured_snippets'],
    severityMultipliers: { critical: 1.3, high: 1.1, medium: 1.0, low: 0.8 },
    timeframes: {
      immediate: [],
      shortTerm: ['impressions'],
      mediumTerm: ['ranking_positions', 'click_through_rate'],
      longTerm: ['featured_snippets'],
    },
  },
  engagement: {
    category: 'engagement',
    typicalKPIs: ['bounce_rate', 'time_on_page', 'pages_per_session', 'scroll_depth'],
    severityMultipliers: { critical: 1.4, high: 1.2, medium: 1.0, low: 0.6 },
    timeframes: {
      immediate: ['bounce_rate', 'time_on_page'],
      shortTerm: ['pages_per_session', 'scroll_depth'],
      mediumTerm: [],
      longTerm: [],
    },
  },
  brand_trust: {
    category: 'brand_trust',
    typicalKPIs: ['review_rating', 'review_count', 'brand_mentions', 'sentiment_score'],
    severityMultipliers: { critical: 1.5, high: 1.2, medium: 1.0, low: 0.7 },
    timeframes: {
      immediate: [],
      shortTerm: [],
      mediumTerm: ['review_rating', 'review_count'],
      longTerm: ['brand_mentions', 'sentiment_score'],
    },
  },
  local_presence: {
    category: 'local_presence',
    typicalKPIs: ['local_pack_ranking', 'gbp_views', 'direction_requests', 'local_calls'],
    severityMultipliers: { critical: 1.6, high: 1.3, medium: 1.0, low: 0.5 },
    timeframes: {
      immediate: [],
      shortTerm: ['gbp_views'],
      mediumTerm: ['local_pack_ranking', 'direction_requests'],
      longTerm: ['local_calls'],
    },
  },
  technical_health: {
    category: 'technical_health',
    typicalKPIs: ['page_speed', 'core_web_vitals', 'mobile_usability', 'crawl_errors'],
    severityMultipliers: { critical: 1.8, high: 1.4, medium: 1.0, low: 0.6 },
    timeframes: {
      immediate: ['page_speed', 'core_web_vitals'],
      shortTerm: ['mobile_usability'],
      mediumTerm: ['crawl_errors'],
      longTerm: [],
    },
  },
};
