/**
 * Snapshot API Types
 */

export interface SnapshotRequest {
  website_url: string;
  email?: string;
  google_business_url?: string;
  linkedin_url?: string;
}

export interface ScoreBreakdown {
  score: number;
  reasons: string[];
  potential: number; // Potential score if issues fixed
}

export interface GoogleBusinessAnalysis {
  found: boolean;
  url?: string;
  rating?: number;
  reviewCount?: number;
  completeness?: number; // 0-100
  insights?: string[];
  recommendations?: string[];
}

export interface LinkedInAnalysis {
  found: boolean;
  url?: string;
  completeness?: number; // 0-100
  followerCount?: number;
  insights?: string[];
  recommendations?: string[];
}

export interface SnapshotResponse {
  ok: true;
  snapshotId: string;
  companyId?: string; // Canonical company ID (UUID) - stable across all tables
  shareUrl?: string; // Unique shareable URL
  companyName?: string; // Extracted from website
  overall: number;
  seo: number;
  content: number;
  conversion: number;
  performance: number;
  quickWins: string[];
  strengths: string[];
  contentInsights?: string;
  // Unified assessment fields (from generateFullAssessment)
  brandScore?: number;
  contentScore?: number;
  websiteScore?: number;
  summary?: string;
  emergingRisks?: string[];
  competitorTeaser?: string | string[]; // Can be string (legacy) or array of bullets
  scoreBreakdowns?: {
    seo: ScoreBreakdown;
    content: ScoreBreakdown;
    conversion: ScoreBreakdown;
    performance: ScoreBreakdown;
  };
  priorityActions?: Array<{
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'low' | 'medium' | 'high';
    potentialGain: number; // Points this could add to overall score
  }>;
  industryBenchmark?: {
    overall: number;
    seo: number;
    content: number;
    conversion: number;
  };
  // New rubric-based data (optional for backward compatibility)
  rubric?: {
    scorecard: {
      overallScore: number;
      maturityStage: 'Foundational' | 'Emerging' | 'Scaling' | 'Advanced' | 'Basic' | 'Developing' | 'Good' | 'World-Class';
      pillars: Array<{
        id: string;
        score: number;
        weightedScore: number;
        subpillarScores: Array<{
          id: string;
          score: number;
          notes?: string;
        }>;
        notes?: string;
      }>;
    };
    strategy: {
      summary: string;
      top_opportunities: Array<{
        issue: string;
        why_it_matters: string;
        evidence: string;
        recommendation: string;
      }>;
      prioritized_roadmap: Array<{
        priority: number;
        action: string;
        impact: string;
        specific_changes: string;
      }>;
      rewrite_suggestions: Array<{
        element: string;
        current: string;
        recommended: string;
      }>;
      competitor_analysis: {
        competitors: string[];
        positioning_summary: string;
        gaps: string[];
      };
    };
    extraction?: any; // Full extraction data (can be large)
  };
  // Growth Acceleration Plan (GAP) (optional, full strategic plan)
  growthActionPlan?: import('@/lib/growth-plan/schema').GrowthAccelerationPlan;
}

export interface SnapshotError {
  ok: false;
  error: string;
}

export type SnapshotApiResponse = SnapshotResponse | SnapshotError;

export interface SnapshotScores {
  overall: number;
  seo: number;
  content: number;
  conversion: number;
  performance: number;
}

export interface SnapshotInsights {
  strengths: string[];
  quickWins: string[];
}

export interface PageSpeedResult {
  performance: number; // 0-100
  url: string;
}

export interface ScoreBreakdown {
  score: number;
  reasons: string[];
  potential: number;
}

export interface PriorityAction {
  action: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  potentialGain: number;
}

export interface AISnapshotAnalysis {
  seo: number;
  content: number;
  conversion: number;
  strengths: string[];
  quickWins: string[];
  contentInsights?: string;
  scoreBreakdowns?: {
    seo: ScoreBreakdown;
    content: ScoreBreakdown;
    conversion: ScoreBreakdown;
    performance: ScoreBreakdown;
  };
  priorityActions?: PriorityAction[];
  industryBenchmark?: {
    overall: number;
    seo: number;
    content: number;
    conversion: number;
  };
}

