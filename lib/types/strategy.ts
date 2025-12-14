// lib/types/strategy.ts
// MVP Strategy types for Company Strategy Workspace
//
// These types define the marketing strategy structure with pillars,
// objectives, and AI-assisted planning capabilities.

// ============================================================================
// Core Strategy Types
// ============================================================================

/**
 * Strategy pillar - a key area of strategic focus
 */
export interface StrategyPillar {
  id: string;
  title: string;
  description: string;
  kpis?: string[];
  services?: StrategyService[];
  priority: 'low' | 'medium' | 'high';
  status?: 'draft' | 'active' | 'completed';
  order?: number;
  /** Source artifact ID if this pillar was promoted from an artifact */
  sourceArtifactId?: string;
}

/**
 * Services that can be associated with pillars
 */
export type StrategyService =
  | 'website'
  | 'seo'
  | 'content'
  | 'media'
  | 'brand'
  | 'social'
  | 'email'
  | 'analytics'
  | 'conversion'
  | 'other';

/**
 * Strategy status
 */
export type StrategyStatus = 'draft' | 'finalized' | 'archived';

/**
 * Company marketing strategy
 */
export interface CompanyStrategy {
  id: string;
  companyId: string;

  // Strategy identity
  title: string;
  summary: string;

  // Objectives (aligned with Context objectives)
  objectives: string[];

  // Strategic pillars
  pillars: StrategyPillar[];

  // Status & lifecycle
  status: StrategyStatus;
  version?: number;

  // Timeline
  startDate?: string;
  endDate?: string;
  quarterLabel?: string;

  // Version Metadata (for traceability)
  /** Context revision ID this strategy was generated from */
  baseContextRevisionId?: string;
  /** Hive Brain revision ID (hash) used for generation */
  hiveBrainRevisionId?: string;
  /** Competition source used: 'v3' | 'v4' | null */
  competitionSourceUsed?: 'v3' | 'v4' | null;
  /** Whether this strategy was generated with incomplete SRM fields */
  generatedWithIncompleteContext?: boolean;
  /** Missing SRM fields at generation time (for transparency) */
  missingSrmFields?: string[];

  // Artifact Lineage (for Strategy Workspace V4)
  /** IDs of artifacts that were promoted to create/update this strategy */
  sourceArtifactIds?: string[];
  /** Whether this strategy was created via promotion (vs direct generation) */
  promotedFromArtifacts?: boolean;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  finalizedAt?: string;
  finalizedBy?: string;
}

/**
 * Create strategy request
 */
export interface CreateStrategyRequest {
  companyId: string;
  title?: string;
  summary?: string;
  objectives?: string[];
  pillars?: Omit<StrategyPillar, 'id'>[];
  // Version metadata (for traceability)
  baseContextRevisionId?: string;
  hiveBrainRevisionId?: string;
  competitionSourceUsed?: 'v3' | 'v4' | null;
  generatedWithIncompleteContext?: boolean;
  missingSrmFields?: string[];
  // Artifact lineage (for promotion from workspace)
  sourceArtifactIds?: string[];
  promotedFromArtifacts?: boolean;
}

/**
 * Update strategy request
 */
export interface UpdateStrategyRequest {
  strategyId: string;
  updates: Partial<Omit<CompanyStrategy, 'id' | 'companyId' | 'createdAt'>>;
}

/**
 * Finalize strategy request
 */
export interface FinalizeStrategyRequest {
  strategyId: string;
  generateWork?: boolean;
}

// ============================================================================
// AI Strategy Proposal
// ============================================================================

/**
 * AI-proposed strategy (before saving)
 */
export interface AiStrategyProposal {
  title: string;
  summary: string;
  objectives: string[];
  pillars: Omit<StrategyPillar, 'id'>[];
  reasoning: string;
  generatedAt: string;
  /** Missing Inputs section (only present when SRM not ready) */
  missingInputs?: string;
  /** Explicit assumptions made due to missing context */
  assumptions?: string[];
  /** Whether this proposal was generated with incomplete SRM fields */
  generatedWithIncompleteContext?: boolean;
  /** Context fields that were confirmed and used */
  confirmedFieldsUsed?: string[];
}

/**
 * AI strategy propose request
 */
export interface AiStrategyProposeRequest {
  companyId: string;
  contextOverride?: Record<string, string>;
}

/**
 * AI strategy propose response
 */
export interface AiStrategyProposeResponse {
  proposal: AiStrategyProposal;
  confidence: number;
  sources: string[];
}

// ============================================================================
// Strategy Summary (for Overview and Reports)
// ============================================================================

/**
 * Lightweight strategy summary for display
 */
export interface StrategySummary {
  id: string;
  companyId: string;
  title: string;
  status: StrategyStatus;
  pillarCount: number;
  topPillars: Array<{ title: string; priority: string }>;
  lastUpdated: string;
}

/**
 * Create a strategy summary from full strategy
 */
export function createStrategySummary(strategy: CompanyStrategy): StrategySummary {
  return {
    id: strategy.id,
    companyId: strategy.companyId,
    title: strategy.title,
    status: strategy.status,
    pillarCount: strategy.pillars.length,
    topPillars: strategy.pillars
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3)
      .map(p => ({ title: p.title, priority: p.priority })),
    lastUpdated: strategy.updatedAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for strategy items
 */
export function generateStrategyItemId(): string {
  return `si_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Service display labels
 */
export const SERVICE_LABELS: Record<StrategyService, string> = {
  website: 'Website',
  seo: 'SEO',
  content: 'Content',
  media: 'Media',
  brand: 'Brand',
  social: 'Social',
  email: 'Email',
  analytics: 'Analytics',
  conversion: 'Conversion',
  other: 'Other',
};

/**
 * Priority display colors (Tailwind classes)
 */
export const PRIORITY_COLORS: Record<StrategyPillar['priority'], string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};
