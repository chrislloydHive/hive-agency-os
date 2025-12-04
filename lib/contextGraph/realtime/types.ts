// lib/contextGraph/realtime/types.ts
// Real-time streaming types for Context Graph
//
// Phase 4: WebSocket-based real-time updates

import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Event Types
// ============================================================================

/**
 * Types of real-time events that can be broadcast
 */
export type RealtimeEventType =
  | 'field_updated'
  | 'field_locked'
  | 'field_unlocked'
  | 'user_joined'
  | 'user_left'
  | 'user_cursor_moved'
  | 'user_editing_started'
  | 'user_editing_stopped'
  | 'validation_changed'
  | 'health_changed'
  | 'suggestion_added'
  | 'healing_started'
  | 'healing_completed';

/**
 * Base event structure
 */
export interface RealtimeEventBase {
  eventId: string;
  eventType: RealtimeEventType;
  companyId: string;
  timestamp: string;
  userId?: string;
  userName?: string;
}

/**
 * Field update event - sent when any field value changes
 */
export interface FieldUpdateEvent extends RealtimeEventBase {
  eventType: 'field_updated';
  path: string;
  domain: DomainName;
  oldValue: unknown;
  newValue: unknown;
  updatedBy: 'human' | 'ai' | 'system';
  sourceTool?: string;
}

/**
 * Field lock event
 */
export interface FieldLockEvent extends RealtimeEventBase {
  eventType: 'field_locked' | 'field_unlocked';
  path: string;
  domain: DomainName;
  lockedBy?: string;
  lockSeverity?: 'soft' | 'hard';
  lockReason?: string;
}

/**
 * User presence event
 */
export interface UserPresenceEvent extends RealtimeEventBase {
  eventType: 'user_joined' | 'user_left';
  userId: string;
  userName: string;
  userAvatar?: string;
}

/**
 * User cursor/editing event
 */
export interface UserCursorEvent extends RealtimeEventBase {
  eventType: 'user_cursor_moved' | 'user_editing_started' | 'user_editing_stopped';
  userId: string;
  userName: string;
  selectedDomain?: DomainName;
  selectedPath?: string;
  cursorPosition?: { x: number; y: number };
}

/**
 * Validation status changed
 */
export interface ValidationEvent extends RealtimeEventBase {
  eventType: 'validation_changed';
  issueCount: number;
  criticalCount: number;
  newIssues?: Array<{ path: string; issue: string }>;
  resolvedIssues?: Array<{ path: string }>;
}

/**
 * Context health changed
 */
export interface HealthEvent extends RealtimeEventBase {
  eventType: 'health_changed';
  oldScore: number;
  newScore: number;
  status: 'healthy' | 'fair' | 'needs_attention' | 'critical';
}

/**
 * AI suggestion added
 */
export interface SuggestionEvent extends RealtimeEventBase {
  eventType: 'suggestion_added';
  suggestionId: string;
  path: string;
  suggestedValue: unknown;
  confidence: number;
  reasoning?: string;
}

/**
 * Auto-healing events
 */
export interface HealingEvent extends RealtimeEventBase {
  eventType: 'healing_started' | 'healing_completed';
  fixCount?: number;
  appliedCount?: number;
  rejectedCount?: number;
}

/**
 * Union type of all events
 */
export type RealtimeEvent =
  | FieldUpdateEvent
  | FieldLockEvent
  | UserPresenceEvent
  | UserCursorEvent
  | ValidationEvent
  | HealthEvent
  | SuggestionEvent
  | HealingEvent;

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  companyId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  domains?: DomainName[];  // Subscribe to specific domains only
  eventTypes?: RealtimeEventType[];  // Subscribe to specific event types
}

/**
 * Active subscription
 */
export interface ActiveSubscription {
  subscriptionId: string;
  companyId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  connectedAt: string;
  lastActivityAt: string;
  domains: DomainName[];
  eventTypes: RealtimeEventType[];
}

// ============================================================================
// Presence Types
// ============================================================================

/**
 * User presence state
 */
export interface UserPresence {
  userId: string;
  userName: string;
  userAvatar?: string;
  companyId: string;
  connectedAt: string;
  lastActivityAt: string;
  status: 'active' | 'idle' | 'away';
  selectedDomain?: DomainName;
  selectedPath?: string;
  isEditing: boolean;
  editingPath?: string;
}

/**
 * Company presence state (all users viewing a company)
 */
export interface CompanyPresence {
  companyId: string;
  users: UserPresence[];
  activeEditors: Array<{
    userId: string;
    userName: string;
    path: string;
    startedAt: string;
  }>;
}

// ============================================================================
// Message Types (Client <-> Server)
// ============================================================================

/**
 * Message from client to server
 */
export type ClientMessage =
  | { type: 'subscribe'; options: SubscriptionOptions }
  | { type: 'unsubscribe'; subscriptionId: string }
  | { type: 'cursor_move'; domain?: DomainName; path?: string }
  | { type: 'start_editing'; path: string }
  | { type: 'stop_editing'; path: string }
  | { type: 'ping' };

/**
 * Message from server to client
 */
export type ServerMessage =
  | { type: 'subscribed'; subscriptionId: string; presence: CompanyPresence }
  | { type: 'unsubscribed' }
  | { type: 'event'; event: RealtimeEvent }
  | { type: 'presence_update'; presence: CompanyPresence }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' };
