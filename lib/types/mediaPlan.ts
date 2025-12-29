// lib/types/mediaPlan.ts
// Media Plan Draft Types
//
// Used for Strategy → Media Plan bridge.
// Minimal structure for skeletal media plan generation.

import type { StrategyLink } from './work';

// ============================================================================
// Media Plan Status
// ============================================================================

export type MediaPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

// ============================================================================
// Media Plan Draft
// ============================================================================

/**
 * Media Plan Draft - skeletal structure for paid media work
 */
export interface MediaPlanDraft {
  id: string;
  companyId: string;
  strategyId: string;
  title: string;
  status: MediaPlanStatus;

  // Strategy context
  strategyLink?: StrategyLink;

  // Tactic reference
  tacticId?: string;
  tacticTitle?: string;

  // Budget placeholder
  budget?: {
    total?: number;
    currency?: string;
    period?: 'monthly' | 'quarterly' | 'campaign';
  };

  // Channel allocation placeholder
  channels?: {
    channel: string;
    allocation?: number; // percentage
  }[];

  // Timeline
  startDate?: string;
  endDate?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// ============================================================================
// Create Input
// ============================================================================

/**
 * Input for creating a new media plan draft
 */
export interface CreateMediaPlanDraftInput {
  companyId: string;
  strategyId: string;
  title: string;
  strategyLink?: StrategyLink;
  tacticId?: string;
  tacticTitle?: string;
}

// ============================================================================
// API Response
// ============================================================================

export interface MediaPlanDraftResponse {
  status: 'ok';
  mediaPlanDraft: MediaPlanDraft;
  alreadyExists?: boolean;
}
