// lib/contextGraph/collaboration/presence.ts
// Multi-user presence tracking and conflict resolution
//
// Phase 4: Real-time collaboration support

import { randomUUID } from 'crypto';
import type { DomainName } from '../companyContextGraph';

// ============================================================================
// Types
// ============================================================================

/**
 * User presence state
 */
export interface UserPresenceState {
  userId: string;
  userName: string;
  userAvatar?: string;
  userColor: string;  // Assigned color for visual identification

  // Connection state
  companyId: string;
  sessionId: string;
  connectedAt: string;
  lastActivityAt: string;
  status: 'active' | 'idle' | 'away';

  // Current focus
  selectedDomain?: DomainName;
  selectedPath?: string;

  // Editing state
  isEditing: boolean;
  editingPath?: string;
  editStartedAt?: string;
}

/**
 * Edit lock on a field
 */
export interface EditLock {
  path: string;
  lockedBy: string;
  lockedByName: string;
  lockedAt: string;
  expiresAt: string;
  sessionId: string;
}

/**
 * Conflict when two users edit the same field
 */
export interface EditConflict {
  id: string;
  path: string;
  domain: DomainName;

  // Users involved
  users: Array<{
    userId: string;
    userName: string;
    editStartedAt: string;
    proposedValue: unknown;
  }>;

  // Original value
  originalValue: unknown;

  // Resolution
  status: 'pending' | 'resolved' | 'expired';
  resolvedBy?: string;
  resolvedAt?: string;
  winningValue?: unknown;

  createdAt: string;
  expiresAt: string;
}

/**
 * Merge suggestion for resolving conflicts
 */
export interface MergeSuggestion {
  conflictId: string;
  strategy: 'keep_first' | 'keep_last' | 'merge' | 'manual';
  suggestedValue: unknown;
  reasoning: string;
  confidence: number;
}

// ============================================================================
// Presence Store
// ============================================================================

/** Active users by companyId -> sessionId */
const presenceStore = new Map<string, Map<string, UserPresenceState>>();

/** Edit locks by path */
const editLocks = new Map<string, EditLock>();

/** Active conflicts */
const conflicts = new Map<string, EditConflict>();

/** Color palette for users */
const USER_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#EC4899',
];

let colorIndex = 0;

function getNextColor(): string {
  const color = USER_COLORS[colorIndex % USER_COLORS.length];
  colorIndex++;
  return color;
}

// ============================================================================
// Presence Management
// ============================================================================

/**
 * Add a user to presence tracking
 */
export function addUserPresence(
  companyId: string,
  userId: string,
  userName: string,
  userAvatar?: string
): UserPresenceState {
  const sessionId = `session_${randomUUID()}`;
  const now = new Date().toISOString();

  const presence: UserPresenceState = {
    userId,
    userName,
    userAvatar,
    userColor: getNextColor(),
    companyId,
    sessionId,
    connectedAt: now,
    lastActivityAt: now,
    status: 'active',
    isEditing: false,
  };

  if (!presenceStore.has(companyId)) {
    presenceStore.set(companyId, new Map());
  }
  presenceStore.get(companyId)!.set(sessionId, presence);

  return presence;
}

/**
 * Remove a user from presence tracking
 */
export function removeUserPresence(companyId: string, sessionId: string): boolean {
  const companyPresence = presenceStore.get(companyId);
  if (!companyPresence) return false;

  const presence = companyPresence.get(sessionId);
  if (!presence) return false;

  // Release any edit locks
  if (presence.editingPath) {
    releaseEditLock(presence.editingPath, sessionId);
  }

  companyPresence.delete(sessionId);

  if (companyPresence.size === 0) {
    presenceStore.delete(companyId);
  }

  return true;
}

/**
 * Update user's current focus
 */
export function updateUserFocus(
  companyId: string,
  sessionId: string,
  domain?: DomainName,
  path?: string
): void {
  const companyPresence = presenceStore.get(companyId);
  if (!companyPresence) return;

  const presence = companyPresence.get(sessionId);
  if (!presence) return;

  presence.selectedDomain = domain;
  presence.selectedPath = path;
  presence.lastActivityAt = new Date().toISOString();
  presence.status = 'active';
}

/**
 * Get all users viewing a company
 */
export function getCompanyUsers(companyId: string): UserPresenceState[] {
  const companyPresence = presenceStore.get(companyId);
  if (!companyPresence) return [];
  return Array.from(companyPresence.values());
}

/**
 * Get users viewing a specific domain
 */
export function getDomainViewers(companyId: string, domain: DomainName): UserPresenceState[] {
  return getCompanyUsers(companyId).filter(u => u.selectedDomain === domain);
}

/**
 * Get user editing a specific path
 */
export function getPathEditor(companyId: string, path: string): UserPresenceState | null {
  const users = getCompanyUsers(companyId);
  return users.find(u => u.isEditing && u.editingPath === path) || null;
}

// ============================================================================
// Edit Lock Management
// ============================================================================

const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Acquire an edit lock on a field
 */
export function acquireEditLock(
  companyId: string,
  sessionId: string,
  path: string
): { success: boolean; lock?: EditLock; existingLock?: EditLock } {
  const lockKey = `${companyId}:${path}`;
  const existingLock = editLocks.get(lockKey);

  // Check if already locked by another user
  if (existingLock) {
    if (existingLock.sessionId !== sessionId) {
      // Check if lock expired
      if (new Date(existingLock.expiresAt) > new Date()) {
        return { success: false, existingLock };
      }
      // Lock expired, can take over
    }
  }

  // Find user presence
  const companyPresence = presenceStore.get(companyId);
  const presence = companyPresence?.get(sessionId);
  if (!presence) {
    return { success: false };
  }

  const now = new Date();
  const lock: EditLock = {
    path,
    lockedBy: presence.userId,
    lockedByName: presence.userName,
    lockedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + LOCK_DURATION_MS).toISOString(),
    sessionId,
  };

  editLocks.set(lockKey, lock);

  // Update presence
  presence.isEditing = true;
  presence.editingPath = path;
  presence.editStartedAt = now.toISOString();

  return { success: true, lock };
}

/**
 * Release an edit lock
 */
export function releaseEditLock(path: string, sessionId: string): boolean {
  // Find the lock
  for (const [key, lock] of editLocks) {
    if (key.endsWith(`:${path}`) && lock.sessionId === sessionId) {
      editLocks.delete(key);

      // Update presence
      const companyId = key.split(':')[0];
      const companyPresence = presenceStore.get(companyId);
      const presence = companyPresence?.get(sessionId);
      if (presence) {
        presence.isEditing = false;
        presence.editingPath = undefined;
        presence.editStartedAt = undefined;
      }

      return true;
    }
  }

  return false;
}

/**
 * Extend an edit lock
 */
export function extendEditLock(path: string, sessionId: string): boolean {
  for (const [key, lock] of editLocks) {
    if (key.endsWith(`:${path}`) && lock.sessionId === sessionId) {
      lock.expiresAt = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
      return true;
    }
  }
  return false;
}

/**
 * Check if a path is locked
 */
export function isPathLocked(companyId: string, path: string): { locked: boolean; lock?: EditLock } {
  const lockKey = `${companyId}:${path}`;
  const lock = editLocks.get(lockKey);

  if (!lock) {
    return { locked: false };
  }

  // Check if expired
  if (new Date(lock.expiresAt) <= new Date()) {
    editLocks.delete(lockKey);
    return { locked: false };
  }

  return { locked: true, lock };
}

// ============================================================================
// Conflict Detection & Resolution
// ============================================================================

/**
 * Create a conflict when two users edit the same field
 */
export function createConflict(
  companyId: string,
  path: string,
  domain: DomainName,
  originalValue: unknown,
  users: Array<{ userId: string; userName: string; proposedValue: unknown }>
): EditConflict {
  const now = new Date();
  const conflict: EditConflict = {
    id: `conflict_${randomUUID()}`,
    path,
    domain,
    users: users.map(u => ({
      ...u,
      editStartedAt: now.toISOString(),
    })),
    originalValue,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000).toISOString(), // 10 min
  };

  conflicts.set(conflict.id, conflict);
  return conflict;
}

/**
 * Get pending conflicts for a company
 */
export function getPendingConflicts(companyId: string): EditConflict[] {
  const result: EditConflict[] = [];

  for (const conflict of conflicts.values()) {
    if (conflict.status === 'pending') {
      // Check if any user is from this company
      const companyUsers = getCompanyUsers(companyId);
      const userIds = new Set(companyUsers.map(u => u.userId));

      if (conflict.users.some(u => userIds.has(u.userId))) {
        result.push(conflict);
      }
    }
  }

  return result;
}

/**
 * Resolve a conflict
 */
export function resolveConflict(
  conflictId: string,
  resolvedBy: string,
  winningValue: unknown
): boolean {
  const conflict = conflicts.get(conflictId);
  if (!conflict) return false;

  conflict.status = 'resolved';
  conflict.resolvedBy = resolvedBy;
  conflict.resolvedAt = new Date().toISOString();
  conflict.winningValue = winningValue;

  return true;
}

/**
 * Generate merge suggestions for a conflict
 */
export function generateMergeSuggestion(conflict: EditConflict): MergeSuggestion {
  const { users, originalValue } = conflict;

  // Simple strategy selection based on timing
  if (users.length === 2) {
    const [first, second] = users;

    // If values are strings, try to merge
    if (typeof first.proposedValue === 'string' && typeof second.proposedValue === 'string') {
      // Check if one is a subset of the other
      if (first.proposedValue.includes(second.proposedValue as string)) {
        return {
          conflictId: conflict.id,
          strategy: 'keep_first',
          suggestedValue: first.proposedValue,
          reasoning: 'First edit contains the second edit',
          confidence: 0.7,
        };
      }
      if ((second.proposedValue as string).includes(first.proposedValue)) {
        return {
          conflictId: conflict.id,
          strategy: 'keep_last',
          suggestedValue: second.proposedValue,
          reasoning: 'Second edit contains the first edit',
          confidence: 0.7,
        };
      }
    }

    // Default to last write wins
    return {
      conflictId: conflict.id,
      strategy: 'keep_last',
      suggestedValue: second.proposedValue,
      reasoning: 'Most recent edit (last write wins)',
      confidence: 0.5,
    };
  }

  // Multiple users - require manual resolution
  return {
    conflictId: conflict.id,
    strategy: 'manual',
    suggestedValue: originalValue,
    reasoning: 'Multiple conflicting edits require manual review',
    confidence: 0.3,
  };
}

// ============================================================================
// Activity Status
// ============================================================================

const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const AWAY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Update activity status for all users
 */
export function updateActivityStatus(): void {
  const now = Date.now();

  for (const companyPresence of presenceStore.values()) {
    for (const presence of companyPresence.values()) {
      const lastActivity = new Date(presence.lastActivityAt).getTime();
      const inactivityMs = now - lastActivity;

      if (inactivityMs > AWAY_THRESHOLD_MS) {
        presence.status = 'away';
      } else if (inactivityMs > IDLE_THRESHOLD_MS) {
        presence.status = 'idle';
      } else {
        presence.status = 'active';
      }
    }
  }
}

/**
 * Clean up expired locks and conflicts
 */
export function cleanupExpired(): { locksRemoved: number; conflictsExpired: number } {
  const now = new Date();
  let locksRemoved = 0;
  let conflictsExpired = 0;

  // Clean locks
  for (const [key, lock] of editLocks) {
    if (new Date(lock.expiresAt) <= now) {
      editLocks.delete(key);
      locksRemoved++;
    }
  }

  // Clean conflicts
  for (const conflict of conflicts.values()) {
    if (conflict.status === 'pending' && new Date(conflict.expiresAt) <= now) {
      conflict.status = 'expired';
      conflictsExpired++;
    }
  }

  return { locksRemoved, conflictsExpired };
}

// ============================================================================
// Stats
// ============================================================================

export function getCollaborationStats(): {
  activeUsers: number;
  activeLocks: number;
  pendingConflicts: number;
  companiesWithUsers: number;
} {
  let activeUsers = 0;
  let activeLocks = 0;
  let pendingConflicts = 0;

  for (const companyPresence of presenceStore.values()) {
    activeUsers += companyPresence.size;
  }

  for (const lock of editLocks.values()) {
    if (new Date(lock.expiresAt) > new Date()) {
      activeLocks++;
    }
  }

  for (const conflict of conflicts.values()) {
    if (conflict.status === 'pending') {
      pendingConflicts++;
    }
  }

  return {
    activeUsers,
    activeLocks,
    pendingConflicts,
    companiesWithUsers: presenceStore.size,
  };
}
