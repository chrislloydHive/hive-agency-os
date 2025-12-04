// lib/contextGraph/realtime/server.ts
// Real-time server for Context Graph streaming
//
// Phase 4: Server-side WebSocket management
// Uses an in-memory pub/sub pattern that can be upgraded to Redis for scale

import { randomUUID } from 'crypto';
import type {
  RealtimeEvent,
  ActiveSubscription,
  SubscriptionOptions,
  UserPresence,
  CompanyPresence,
  FieldUpdateEvent,
  UserPresenceEvent,
  UserCursorEvent,
} from './types';
import type { DomainName } from '../companyContextGraph';

// ============================================================================
// In-Memory State (can be replaced with Redis for horizontal scaling)
// ============================================================================

/** Active subscriptions by subscriptionId */
const subscriptions = new Map<string, ActiveSubscription>();

/** Subscriptions grouped by companyId for efficient broadcasting */
const companySubscriptions = new Map<string, Set<string>>();

/** User presence by companyId -> userId */
const presenceByCompany = new Map<string, Map<string, UserPresence>>();

/** Event listeners for SSE/WebSocket connections */
type EventHandler = (event: RealtimeEvent) => void;
const eventHandlers = new Map<string, EventHandler>();

// ============================================================================
// Subscription Management
// ============================================================================

/**
 * Create a new subscription for a user
 */
export function createSubscription(options: SubscriptionOptions): ActiveSubscription {
  const subscriptionId = `sub_${randomUUID()}`;
  const now = new Date().toISOString();

  const subscription: ActiveSubscription = {
    subscriptionId,
    companyId: options.companyId,
    userId: options.userId,
    userName: options.userName,
    userAvatar: options.userAvatar,
    connectedAt: now,
    lastActivityAt: now,
    domains: options.domains || [],
    eventTypes: options.eventTypes || [],
  };

  // Store subscription
  subscriptions.set(subscriptionId, subscription);

  // Add to company subscriptions
  if (!companySubscriptions.has(options.companyId)) {
    companySubscriptions.set(options.companyId, new Set());
  }
  companySubscriptions.get(options.companyId)!.add(subscriptionId);

  // Add user presence
  addUserPresence(options);

  // Broadcast user joined event
  broadcastToCompany(options.companyId, {
    eventId: `evt_${randomUUID()}`,
    eventType: 'user_joined',
    companyId: options.companyId,
    timestamp: now,
    userId: options.userId,
    userName: options.userName,
    userAvatar: options.userAvatar,
  } as UserPresenceEvent);

  return subscription;
}

/**
 * Remove a subscription
 */
export function removeSubscription(subscriptionId: string): boolean {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) return false;

  // Remove from subscriptions
  subscriptions.delete(subscriptionId);

  // Remove from company subscriptions
  const companySubs = companySubscriptions.get(subscription.companyId);
  if (companySubs) {
    companySubs.delete(subscriptionId);
    if (companySubs.size === 0) {
      companySubscriptions.delete(subscription.companyId);
    }
  }

  // Remove user presence (if no other subscriptions for this user/company)
  const hasOtherSubs = Array.from(subscriptions.values()).some(
    s => s.companyId === subscription.companyId && s.userId === subscription.userId
  );
  if (!hasOtherSubs) {
    removeUserPresence(subscription.companyId, subscription.userId);

    // Broadcast user left event
    broadcastToCompany(subscription.companyId, {
      eventId: `evt_${randomUUID()}`,
      eventType: 'user_left',
      companyId: subscription.companyId,
      timestamp: new Date().toISOString(),
      userId: subscription.userId,
      userName: subscription.userName,
    } as UserPresenceEvent);
  }

  // Remove event handler
  eventHandlers.delete(subscriptionId);

  return true;
}

/**
 * Get subscription by ID
 */
export function getSubscription(subscriptionId: string): ActiveSubscription | null {
  return subscriptions.get(subscriptionId) || null;
}

/**
 * Update subscription activity timestamp
 */
export function touchSubscription(subscriptionId: string): void {
  const subscription = subscriptions.get(subscriptionId);
  if (subscription) {
    subscription.lastActivityAt = new Date().toISOString();
  }
}

// ============================================================================
// Presence Management
// ============================================================================

function addUserPresence(options: SubscriptionOptions): void {
  if (!presenceByCompany.has(options.companyId)) {
    presenceByCompany.set(options.companyId, new Map());
  }

  const companyPresence = presenceByCompany.get(options.companyId)!;
  const now = new Date().toISOString();

  companyPresence.set(options.userId, {
    userId: options.userId,
    userName: options.userName,
    userAvatar: options.userAvatar,
    companyId: options.companyId,
    connectedAt: now,
    lastActivityAt: now,
    status: 'active',
    isEditing: false,
  });
}

function removeUserPresence(companyId: string, userId: string): void {
  const companyPresence = presenceByCompany.get(companyId);
  if (companyPresence) {
    companyPresence.delete(userId);
    if (companyPresence.size === 0) {
      presenceByCompany.delete(companyId);
    }
  }
}

/**
 * Get current presence for a company
 */
export function getCompanyPresence(companyId: string): CompanyPresence {
  const companyPresence = presenceByCompany.get(companyId);
  const users = companyPresence ? Array.from(companyPresence.values()) : [];

  const activeEditors = users
    .filter(u => u.isEditing && u.editingPath)
    .map(u => ({
      userId: u.userId,
      userName: u.userName,
      path: u.editingPath!,
      startedAt: u.lastActivityAt,
    }));

  return {
    companyId,
    users,
    activeEditors,
  };
}

/**
 * Update user's selected domain/path
 */
export function updateUserCursor(
  companyId: string,
  userId: string,
  domain?: DomainName,
  path?: string
): void {
  const companyPresence = presenceByCompany.get(companyId);
  if (!companyPresence) return;

  const user = companyPresence.get(userId);
  if (!user) return;

  user.selectedDomain = domain;
  user.selectedPath = path;
  user.lastActivityAt = new Date().toISOString();
  user.status = 'active';

  // Broadcast cursor move
  broadcastToCompany(companyId, {
    eventId: `evt_${randomUUID()}`,
    eventType: 'user_cursor_moved',
    companyId,
    timestamp: user.lastActivityAt,
    userId,
    userName: user.userName,
    selectedDomain: domain,
    selectedPath: path,
  } as UserCursorEvent);
}

/**
 * Mark user as editing a field
 */
export function startUserEditing(companyId: string, userId: string, path: string): void {
  const companyPresence = presenceByCompany.get(companyId);
  if (!companyPresence) return;

  const user = companyPresence.get(userId);
  if (!user) return;

  user.isEditing = true;
  user.editingPath = path;
  user.lastActivityAt = new Date().toISOString();

  // Broadcast editing started
  broadcastToCompany(companyId, {
    eventId: `evt_${randomUUID()}`,
    eventType: 'user_editing_started',
    companyId,
    timestamp: user.lastActivityAt,
    userId,
    userName: user.userName,
    selectedPath: path,
  } as UserCursorEvent);
}

/**
 * Mark user as stopped editing
 */
export function stopUserEditing(companyId: string, userId: string, path: string): void {
  const companyPresence = presenceByCompany.get(companyId);
  if (!companyPresence) return;

  const user = companyPresence.get(userId);
  if (!user) return;

  user.isEditing = false;
  user.editingPath = undefined;
  user.lastActivityAt = new Date().toISOString();

  // Broadcast editing stopped
  broadcastToCompany(companyId, {
    eventId: `evt_${randomUUID()}`,
    eventType: 'user_editing_stopped',
    companyId,
    timestamp: user.lastActivityAt,
    userId,
    userName: user.userName,
    selectedPath: path,
  } as UserCursorEvent);
}

// ============================================================================
// Event Broadcasting
// ============================================================================

/**
 * Register an event handler for a subscription
 */
export function registerEventHandler(subscriptionId: string, handler: EventHandler): void {
  eventHandlers.set(subscriptionId, handler);
}

/**
 * Broadcast an event to all subscribers of a company
 */
export function broadcastToCompany(companyId: string, event: RealtimeEvent): void {
  const companySubs = companySubscriptions.get(companyId);
  if (!companySubs) return;

  for (const subscriptionId of companySubs) {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) continue;

    // Check if subscription wants this event type
    if (subscription.eventTypes.length > 0 && !subscription.eventTypes.includes(event.eventType)) {
      continue;
    }

    // Check if subscription wants this domain (for field events)
    if ('domain' in event && subscription.domains.length > 0) {
      if (!subscription.domains.includes(event.domain as DomainName)) {
        continue;
      }
    }

    // Send to handler
    const handler = eventHandlers.get(subscriptionId);
    if (handler) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[realtime] Error in event handler for ${subscriptionId}:`, error);
      }
    }
  }
}

/**
 * Broadcast a field update event
 * Called from the governance pipeline when fields are updated
 */
export function broadcastFieldUpdate(
  companyId: string,
  path: string,
  domain: DomainName,
  oldValue: unknown,
  newValue: unknown,
  updatedBy: 'human' | 'ai' | 'system',
  sourceTool?: string,
  userId?: string,
  userName?: string
): void {
  const event: FieldUpdateEvent = {
    eventId: `evt_${randomUUID()}`,
    eventType: 'field_updated',
    companyId,
    timestamp: new Date().toISOString(),
    path,
    domain,
    oldValue,
    newValue,
    updatedBy,
    sourceTool,
    userId,
    userName,
  };

  broadcastToCompany(companyId, event);
}

// ============================================================================
// Conflict Detection
// ============================================================================

/**
 * Check if a field is currently being edited by another user
 */
export function getFieldEditor(companyId: string, path: string, excludeUserId?: string): UserPresence | null {
  const companyPresence = presenceByCompany.get(companyId);
  if (!companyPresence) return null;

  for (const user of companyPresence.values()) {
    if (user.isEditing && user.editingPath === path) {
      if (excludeUserId && user.userId === excludeUserId) continue;
      return user;
    }
  }

  return null;
}

/**
 * Check for potential conflicts before editing
 */
export function checkEditConflict(
  companyId: string,
  path: string,
  userId: string
): { hasConflict: boolean; editor?: UserPresence } {
  const editor = getFieldEditor(companyId, path, userId);
  return {
    hasConflict: editor !== null,
    editor: editor || undefined,
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Remove stale subscriptions (no activity for > 30 minutes)
 */
export function cleanupStaleSubscriptions(): number {
  const staleThreshold = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  let removedCount = 0;

  for (const [subscriptionId, subscription] of subscriptions) {
    const lastActivity = new Date(subscription.lastActivityAt).getTime();
    if (now - lastActivity > staleThreshold) {
      removeSubscription(subscriptionId);
      removedCount++;
    }
  }

  return removedCount;
}

/**
 * Get stats about current connections
 */
export function getConnectionStats(): {
  totalSubscriptions: number;
  companiesWithSubscriptions: number;
  totalUsers: number;
  activeEditors: number;
} {
  let totalUsers = 0;
  let activeEditors = 0;

  for (const companyPresence of presenceByCompany.values()) {
    totalUsers += companyPresence.size;
    for (const user of companyPresence.values()) {
      if (user.isEditing) activeEditors++;
    }
  }

  return {
    totalSubscriptions: subscriptions.size,
    companiesWithSubscriptions: companySubscriptions.size,
    totalUsers,
    activeEditors,
  };
}
