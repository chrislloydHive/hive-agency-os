// lib/os/qbr/types.ts
// QBR Story View - Types
//
// Types for the QBR narrative view that synthesizes existing outputs.

// ============================================================================
// QBR Data Structure
// ============================================================================

/**
 * Executive summary bullet
 */
export interface ExecutiveBullet {
  text: string;
  category: 'opportunity' | 'risk' | 'decision' | 'insight';
}

/**
 * Current state snapshot
 */
export interface CurrentStateSnapshot {
  // Context
  businessModel?: string;
  valueProposition?: string;
  primaryAudience?: string;

  // Competition
  competitiveCategory?: string;
  competitivePositioning?: string;
  topCompetitors?: string[];

  // Audience insight
  primarySegment?: string;
  audienceInsight?: string;
}

/**
 * What changed this period
 */
export interface WhatChanged {
  strategyUpdates: string[];
  mediaScenarioSelected?: string;
  majorAssumptions: string[];
}

/**
 * Decisions made
 */
export interface DecisionsMade {
  strategyPillars: Array<{
    title: string;
    description: string;
    priority: string;
  }>;
  mediaApproach?: {
    objective?: string;
    topChannels: string[];
    budgetFocus?: string;
  };
  executionPriorities: string[];
}

/**
 * What's next
 */
export interface WhatsNext {
  days30: string[];
  days60: string[];
  days90: string[];
  topWorkItems: Array<{
    title: string;
    status: string;
    priority?: string;
  }>;
}

/**
 * Risks and confidence
 */
export interface RisksAndConfidence {
  keyRisks: string[];
  needsValidation: string[];
}

/**
 * Data freshness info
 */
export interface DataFreshness {
  contextUpdatedAt?: string;
  strategyUpdatedAt?: string;
  competitionUpdatedAt?: string;
  labsUpdatedAt?: string;
}

/**
 * Complete QBR data
 */
export interface QBRData {
  companyId: string;
  companyName: string;
  generatedAt: string;

  // Sections
  executiveSummary: ExecutiveBullet[];
  currentState: CurrentStateSnapshot;
  whatChanged: WhatChanged;
  decisionsMade: DecisionsMade;
  whatsNext: WhatsNext;
  risksAndConfidence: RisksAndConfidence;

  // Meta
  dataFreshness: DataFreshness;
  dataSources: string[];
}
