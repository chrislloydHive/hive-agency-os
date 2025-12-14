// lib/contextGraph/nodes/types.ts
// ContextNode Abstraction for AI-First Context Graph
//
// Core Rules:
// - AI proposes, never persists directly
// - Human confirmation required for all AI proposals
// - Confirmed values are protected from AI overwrite
// - AI may only suggest new proposals alongside confirmed values

import { z } from 'zod';
import type { ContextSource, ProvenanceTag } from '../types';

// ============================================================================
// ContextNode Status
// ============================================================================

/**
 * Node status determines whether a value is proposed, confirmed, or missing
 */
export const ContextNodeStatus = z.enum([
  'proposed',   // AI-proposed, awaiting human review
  'confirmed',  // Human-confirmed, protected from AI overwrite
  'missing',    // Required field that doesn't exist yet (ghost node)
]);

export type ContextNodeStatus = z.infer<typeof ContextNodeStatus>;

/**
 * Source of the node value
 */
export const ContextNodeSource = z.enum([
  'user',       // Direct user input (highest priority)
  'ai',         // AI-generated proposal
  'lab',        // From diagnostic lab (Website Lab, Content Lab, etc.)
  'strategy',   // Strategy-derived value
  'import',     // Imported from external source
  'system',     // System-generated (e.g., ghost nodes for missing required fields)
]);

export type ContextNodeSource = z.infer<typeof ContextNodeSource>;

// ============================================================================
// ContextNode
// ============================================================================

/**
 * ContextNode wraps any context field value with:
 * - Status (proposed vs confirmed)
 * - Source tracking (user, ai, lab, strategy)
 * - Confidence score
 * - Full provenance chain
 *
 * This is the internal abstraction that maps to existing context fields.
 * No schema rewrite needed - existing fields hydrate nodes.
 */
export interface ContextNode<T = unknown> {
  /** Unique key matching the context graph path (e.g., 'identity.businessModel') */
  key: string;

  /** Category/domain the field belongs to */
  category: string;

  /** The actual value */
  value: T | null;

  /** Status: proposed (awaiting confirmation) or confirmed (protected) */
  status: ContextNodeStatus;

  /** Source of the value */
  source: ContextNodeSource;

  /** Confidence score 0-1 (1 = highest confidence) */
  confidence: number;

  /** ISO timestamp when last updated */
  lastUpdated: string;

  /** Who confirmed (if confirmed) */
  confirmedBy?: string;

  /** When confirmed */
  confirmedAt?: string;

  /** Full provenance chain from original context field */
  provenance: ProvenanceTag[];

  /** If this is a proposal, what's the reasoning? */
  proposalReason?: string;
}

// ============================================================================
// AI Proposal
// ============================================================================

/**
 * An AI proposal for a context field value
 * Stored separately from canonical context until confirmed
 */
export interface ContextProposal {
  /** Unique proposal ID */
  id: string;

  /** Company ID */
  companyId: string;

  /** Context path being proposed (e.g., 'identity.businessModel') */
  fieldPath: string;

  /** Human-readable field label */
  fieldLabel: string;

  /** Proposed value */
  proposedValue: unknown;

  /** Current canonical value (if any) */
  currentValue: unknown | null;

  /** AI reasoning for the proposal */
  reasoning: string;

  /** Confidence score 0-1 */
  confidence: number;

  /** What triggered this proposal */
  trigger: 'strategy_gap' | 'program_prerequisite' | 'lab_inference' | 'ai_assist' | 'refresh';

  /** Source context (e.g., which strategy run, which lab) */
  triggerSource?: string;

  /** Status */
  status: 'pending' | 'accepted' | 'rejected' | 'edited';

  /** When created */
  createdAt: string;

  /** When resolved (accepted/rejected) */
  resolvedAt?: string;

  /** Who resolved */
  resolvedBy?: string;

  /** If edited, what was the final value */
  editedValue?: unknown;
}

// ============================================================================
// Proposal Batch
// ============================================================================

/**
 * A batch of proposals from a single AI action
 */
export interface ContextProposalBatch {
  /** Batch ID */
  id: string;

  /** Company ID */
  companyId: string;

  /** Individual proposals */
  proposals: ContextProposal[];

  /** What triggered this batch */
  trigger: ContextProposal['trigger'];

  /** Source context */
  triggerSource?: string;

  /** Overall reasoning */
  batchReasoning: string;

  /** When created */
  createdAt: string;

  /** Batch status */
  status: 'pending' | 'partial' | 'complete' | 'rejected';
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map a context source to a node source
 */
export function mapContextSourceToNodeSource(source: ContextSource): ContextNodeSource {
  switch (source) {
    case 'user':
    case 'manual':
    case 'setup_wizard':
      return 'user';
    case 'inferred':
      return 'ai';
    case 'website_lab':
    case 'brand_lab':
    case 'content_lab':
    case 'seo_lab':
    case 'demand_lab':
    case 'ops_lab':
    case 'competition_lab':
    case 'competition_v4':
    case 'audience_lab':
    case 'media_lab':
    case 'creative_lab':
    case 'analytics_ga4':
    case 'analytics_gsc':
    case 'analytics_gads':
    case 'analytics_gbp':
    case 'analytics_lsa':
      return 'lab';
    case 'strategy':
    case 'qbr':
      return 'strategy';
    default:
      return 'import';
  }
}

/**
 * Determine if a node is protected (confirmed and cannot be AI-overwritten)
 */
export function isNodeProtected(node: ContextNode): boolean {
  return node.status === 'confirmed';
}

/**
 * Determine if a node is a ghost (missing required field placeholder)
 */
export function isGhostNode(node: ContextNode): boolean {
  return node.status === 'missing';
}

/**
 * Create a ghost node for a missing required field
 */
export function createGhostNode(
  key: string,
  category: string,
  label?: string,
  reason?: string
): ContextNode {
  return {
    key,
    category,
    value: null,
    status: 'missing',
    source: 'system',
    confidence: 0,
    lastUpdated: new Date().toISOString(),
    provenance: [],
    proposalReason: reason || `Required field: ${label || key}`,
  };
}

/**
 * Determine if a node can receive AI proposals
 * - Missing values: yes
 * - Proposed values: yes (can propose update)
 * - Confirmed values: yes, but as a new proposal alongside
 */
export function canReceiveAIProposal(node: ContextNode | null): boolean {
  // Missing or null node - can propose
  if (!node || node.value === null || node.value === undefined) {
    return true;
  }
  // Proposed values can be updated
  if (node.status === 'proposed') {
    return true;
  }
  // Confirmed values - AI can propose but not overwrite
  // The proposal will be shown alongside the confirmed value
  return true;
}

/**
 * Create a proposal from a node suggestion
 */
export function createProposal(
  companyId: string,
  fieldPath: string,
  fieldLabel: string,
  proposedValue: unknown,
  currentValue: unknown | null,
  reasoning: string,
  confidence: number,
  trigger: ContextProposal['trigger'],
  triggerSource?: string
): ContextProposal {
  return {
    id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    fieldPath,
    fieldLabel,
    proposedValue,
    currentValue,
    reasoning,
    confidence,
    trigger,
    triggerSource,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}
