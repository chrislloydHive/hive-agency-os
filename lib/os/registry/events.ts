// lib/os/registry/events.ts
// Context-Strategy Event Broadcasting
//
// Provides simple event broadcasting for context changes that affect
// Strategy Inputs and Program readiness. Components can subscribe
// to receive instant updates when proposals are accepted/rejected.

import { EventEmitter } from 'events';
import type { StrategySection, RequiredForDomain } from './contextStrategyRegistry';

// ============================================================================
// Event Types
// ============================================================================

export type ContextStrategyEventType =
  | 'context:field_updated'
  | 'context:proposal_accepted'
  | 'context:proposal_rejected'
  | 'context:proposal_created'
  | 'strategy:section_invalidated'
  | 'readiness:changed';

export interface ContextFieldUpdatedEvent {
  type: 'context:field_updated';
  companyId: string;
  fieldKey: string;
  newValue: unknown;
  source: 'user' | 'ai' | 'lab' | 'strategy';
  timestamp: string;
}

export interface ProposalAcceptedEvent {
  type: 'context:proposal_accepted';
  companyId: string;
  batchId: string;
  proposalId: string;
  fieldKey: string;
  acceptedValue: unknown;
  timestamp: string;
}

export interface ProposalRejectedEvent {
  type: 'context:proposal_rejected';
  companyId: string;
  batchId: string;
  proposalId: string;
  fieldKey: string;
  timestamp: string;
}

export interface ProposalCreatedEvent {
  type: 'context:proposal_created';
  companyId: string;
  batchId: string;
  fieldKeys: string[];
  trigger: 'strategy_gap' | 'ai_assist' | 'lab_inference';
  timestamp: string;
}

export interface StrategySectionInvalidatedEvent {
  type: 'strategy:section_invalidated';
  companyId: string;
  section: StrategySection;
  reason: 'context_updated' | 'proposal_accepted' | 'proposal_rejected';
  timestamp: string;
}

export interface ReadinessChangedEvent {
  type: 'readiness:changed';
  companyId: string;
  domain: RequiredForDomain;
  oldScore: number;
  newScore: number;
  isNowReady: boolean;
  wasReady: boolean;
  timestamp: string;
}

export type ContextStrategyEvent =
  | ContextFieldUpdatedEvent
  | ProposalAcceptedEvent
  | ProposalRejectedEvent
  | ProposalCreatedEvent
  | StrategySectionInvalidatedEvent
  | ReadinessChangedEvent;

// ============================================================================
// Event Bus (Singleton)
// ============================================================================

/**
 * Global event bus for Context-Strategy events
 * Singleton pattern ensures all components share the same bus
 */
class ContextStrategyEventBus extends EventEmitter {
  private static instance: ContextStrategyEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Allow many components to subscribe
  }

  static getInstance(): ContextStrategyEventBus {
    if (!ContextStrategyEventBus.instance) {
      ContextStrategyEventBus.instance = new ContextStrategyEventBus();
    }
    return ContextStrategyEventBus.instance;
  }

  /**
   * Emit a typed event
   */
  emitEvent(event: ContextStrategyEvent): void {
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard for components that want all events
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends ContextStrategyEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): () => void {
    this.on(eventType, handler);
    return () => this.off(eventType, handler);
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: (event: ContextStrategyEvent) => void): () => void {
    this.on('*', handler);
    return () => this.off('*', handler);
  }
}

// Export singleton instance
export const contextStrategyEventBus = ContextStrategyEventBus.getInstance();

// ============================================================================
// Broadcast Helper Functions
// ============================================================================

/**
 * Broadcast that a context field was updated
 */
export function broadcastFieldUpdate(
  companyId: string,
  fieldKey: string,
  newValue: unknown,
  source: 'user' | 'ai' | 'lab' | 'strategy'
): void {
  contextStrategyEventBus.emitEvent({
    type: 'context:field_updated',
    companyId,
    fieldKey,
    newValue,
    source,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a proposal was accepted
 */
export function broadcastProposalAccepted(
  companyId: string,
  batchId: string,
  proposalId: string,
  fieldKey: string,
  acceptedValue: unknown
): void {
  contextStrategyEventBus.emitEvent({
    type: 'context:proposal_accepted',
    companyId,
    batchId,
    proposalId,
    fieldKey,
    acceptedValue,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that a proposal was rejected
 */
export function broadcastProposalRejected(
  companyId: string,
  batchId: string,
  proposalId: string,
  fieldKey: string
): void {
  contextStrategyEventBus.emitEvent({
    type: 'context:proposal_rejected',
    companyId,
    batchId,
    proposalId,
    fieldKey,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast that new proposals were created
 */
export function broadcastProposalsCreated(
  companyId: string,
  batchId: string,
  fieldKeys: string[],
  trigger: 'strategy_gap' | 'ai_assist' | 'lab_inference'
): void {
  contextStrategyEventBus.emitEvent({
    type: 'context:proposal_created',
    companyId,
    batchId,
    fieldKeys,
    trigger,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Invalidate a strategy section's cached data
 * Components displaying this section should re-fetch
 */
export function invalidateStrategySection(
  companyId: string,
  section: StrategySection,
  reason: 'context_updated' | 'proposal_accepted' | 'proposal_rejected'
): void {
  if (!section) return;

  contextStrategyEventBus.emitEvent({
    type: 'strategy:section_invalidated',
    companyId,
    section,
    reason,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast a readiness change for a domain
 */
export function broadcastReadinessChange(
  companyId: string,
  domain: RequiredForDomain,
  oldScore: number,
  newScore: number,
  isNowReady: boolean,
  wasReady: boolean
): void {
  contextStrategyEventBus.emitEvent({
    type: 'readiness:changed',
    companyId,
    domain,
    oldScore,
    newScore,
    isNowReady,
    wasReady,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// React Hook for Subscribing
// ============================================================================

/**
 * Create a subscription callback for use in React useEffect
 *
 * Usage in component:
 * ```
 * useEffect(() => {
 *   return subscribeToReadinessChanges(companyId, 'strategy', (event) => {
 *     // Handle readiness change
 *     refetch();
 *   });
 * }, [companyId]);
 * ```
 */
export function subscribeToReadinessChanges(
  companyId: string,
  domain: RequiredForDomain,
  handler: (event: ReadinessChangedEvent) => void
): () => void {
  const wrappedHandler = (event: ReadinessChangedEvent) => {
    if (event.companyId === companyId && event.domain === domain) {
      handler(event);
    }
  };

  return contextStrategyEventBus.subscribe('readiness:changed', wrappedHandler);
}

/**
 * Subscribe to all context changes for a company
 */
export function subscribeToContextChanges(
  companyId: string,
  handler: (event: ContextStrategyEvent) => void
): () => void {
  const wrappedHandler = (event: ContextStrategyEvent) => {
    if ('companyId' in event && event.companyId === companyId) {
      handler(event);
    }
  };

  return contextStrategyEventBus.subscribeAll(wrappedHandler);
}

/**
 * Subscribe to strategy section invalidation
 */
export function subscribeToStrategySectionInvalidation(
  companyId: string,
  section: StrategySection,
  handler: (event: StrategySectionInvalidatedEvent) => void
): () => void {
  const wrappedHandler = (event: StrategySectionInvalidatedEvent) => {
    if (event.companyId === companyId && event.section === section) {
      handler(event);
    }
  };

  return contextStrategyEventBus.subscribe('strategy:section_invalidated', wrappedHandler);
}
