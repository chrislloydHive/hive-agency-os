// lib/competition-v3/ui-types.ts
// V3 Competition Lab UI Types
//
// Normalized types for the Competition Lab UI to consume from API

// ============================================================================
// Competitor Types
// ============================================================================

export type CompetitorType =
  | 'direct'
  | 'partial'
  | 'fractional'
  | 'internal'
  | 'platform'
  | 'irrelevant';

export interface CompetitionCompetitor {
  id: string;
  name: string;
  url?: string;
  domain?: string;
  type: CompetitorType;
  summary: string;
  coordinates: {
    valueModelFit: number; // 0-100 → X axis
    icpFit: number;        // 0-100 → Y axis
  };
  scores: {
    icp: number;           // 0-100
    businessModel: number; // 0-100
    services: number;      // 0-100
    valueModel: number;    // 0-100
    aiOrientation: number; // 0-100
    geography: number;     // 0-100
    threat: number;        // 0-100
    relevance: number;     // 0-100
  };
  classification: {
    confidence: number;    // 0-1
    reasoning?: string;
  };
  meta?: {
    teamSize?: string;
    priceBand?: string;
    regions?: string[];
    hasAI?: boolean;
    businessModel?: string;
  };
  analysis?: {
    strengths?: string[];
    weaknesses?: string[];
    whyCompetitor?: string;
  };
  // V3.5 debug signals
  signals?: {
    businessModelCategory?: string;
    jtbdMatches?: number;
    offerOverlapScore?: number;
    signalsVerified?: number;
    geoScore?: number;
  };
}

// ============================================================================
// Insights Types
// ============================================================================

export interface CompetitionInsights {
  landscapeSummary: string;
  categoryBreakdown: string;
  keyRisks: string[];
  keyOpportunities: string[];
  recommendedMoves: {
    now: string[];
    next: string[];
    later: string[];
  };
}

// ============================================================================
// Run Types
// ============================================================================

export interface CompetitionRunV3Response {
  runId: string;
  companyId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  competitors: CompetitionCompetitor[];
  insights: CompetitionInsights;
  summary: {
    totalCandidates: number;
    totalCompetitors: number;
    byType: {
      direct: number;
      partial: number;
      fractional: number;
      platform: number;
      internal: number;
    };
    avgThreatScore: number;
  };
}

// ============================================================================
// UI Constants
// ============================================================================

export const TYPE_COLORS: Record<CompetitorType, { bg: string; text: string; fill: string }> = {
  direct: {
    bg: 'bg-red-500',
    text: 'text-red-400',
    fill: 'fill-red-500/80 stroke-red-800',
  },
  partial: {
    bg: 'bg-orange-400',
    text: 'text-orange-400',
    fill: 'fill-orange-400/80 stroke-orange-800',
  },
  fractional: {
    bg: 'bg-sky-400',
    text: 'text-sky-400',
    fill: 'fill-sky-400/80 stroke-sky-800',
  },
  internal: {
    bg: 'bg-blue-400',
    text: 'text-blue-400',
    fill: 'fill-blue-400/80 stroke-blue-800',
  },
  platform: {
    bg: 'bg-amber-300',
    text: 'text-amber-400',
    fill: 'fill-amber-300/80 stroke-amber-700',
  },
  irrelevant: {
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    fill: 'fill-slate-500/40 stroke-slate-600',
  },
};

export const TYPE_LABELS: Record<CompetitorType, string> = {
  direct: 'Direct Competitor',
  partial: 'Partial Overlap',
  fractional: 'Fractional Alternative',
  internal: 'Internal Hire Alternative',
  platform: 'Platform Alternative',
  irrelevant: 'Low Relevance',
};

export const TYPE_DESCRIPTIONS: Record<CompetitorType, string> = {
  direct: 'Same business model, same ICP, overlapping services',
  partial: 'Shares ICP or services but not both',
  fractional: 'Fractional executive services (CMO, advisor)',
  internal: 'What they might hire internally instead',
  platform: 'SaaS tools that replace part of your service',
  irrelevant: 'Not actually a competitor',
};

// ============================================================================
// Positioning Map Constants
// ============================================================================

export const MAP_AXES = {
  x: {
    label: 'Value Model Similarity',
    description: 'How closely their value model matches yours (AI, efficiency, pricing)',
    lowLabel: 'Different Value Model',
    highLabel: 'Similar Value Model',
  },
  y: {
    label: 'ICP Alignment',
    description: 'How closely they target the same types of customers',
    lowLabel: 'Different Target Customer',
    highLabel: 'Same Target Customer',
  },
};

export const QUADRANT_LABELS = {
  topRight: { name: 'Direct Threats', description: 'High ICP + High Value alignment' },
  topLeft: { name: 'Different Value', description: 'High ICP + Low Value alignment' },
  bottomRight: { name: 'Different ICP', description: 'Low ICP + High Value alignment' },
  bottomLeft: { name: 'Distant', description: 'Low overlap on both dimensions' },
};
