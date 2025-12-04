// lib/contextGraph/governance/locks.ts
// Field-Level Locking System
//
// Manages locks on context graph fields to control who/what can modify them.
// Hard locks prevent all changes; soft locks allow human overrides but block AI.

import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export interface FieldLock {
  id: string;
  path: string;                    // e.g., "brand.positioning"
  lockedBy: string;                // userId or 'system'
  lockedAt: string;                // ISO timestamp
  reason?: string;
  severity: 'hard' | 'soft';       // hard = no changes, soft = human can override
  expiresAt?: string;              // Optional expiration
}

export interface LockStore {
  locks: FieldLock[];
  updatedAt: string;
}

export type LockCheckResult = {
  isLocked: boolean;
  lock?: FieldLock;
  canHumanOverride: boolean;
  canAIOverride: boolean;
};

// ============================================================================
// Storage
// ============================================================================

const LOCKS_DIR = path.join(process.cwd(), '.cache', 'context-locks');

async function ensureLocksDir(): Promise<void> {
  try {
    await fs.mkdir(LOCKS_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

function getLocksPath(companyId: string): string {
  return path.join(LOCKS_DIR, `${companyId}.json`);
}

async function loadLockStore(companyId: string): Promise<LockStore> {
  try {
    await ensureLocksDir();
    const filePath = getLocksPath(companyId);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { locks: [], updatedAt: new Date().toISOString() };
  }
}

async function saveLockStore(companyId: string, store: LockStore): Promise<void> {
  await ensureLocksDir();
  const filePath = getLocksPath(companyId);
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

// ============================================================================
// Lock Operations
// ============================================================================

/**
 * Lock a field in the context graph
 */
export async function lockField(
  companyId: string,
  fieldPath: string,
  lockData: {
    lockedBy: string;
    reason?: string;
    severity: 'hard' | 'soft';
    expiresAt?: string;
  }
): Promise<FieldLock> {
  const store = await loadLockStore(companyId);

  // Remove any existing lock on this path
  store.locks = store.locks.filter(l => l.path !== fieldPath);

  const now = new Date().toISOString();
  const newLock: FieldLock = {
    id: nanoid(),
    path: fieldPath,
    lockedBy: lockData.lockedBy,
    lockedAt: now,
    reason: lockData.reason,
    severity: lockData.severity,
    expiresAt: lockData.expiresAt,
  };

  store.locks.push(newLock);
  store.updatedAt = now;

  await saveLockStore(companyId, store);
  return newLock;
}

/**
 * Unlock a field
 */
export async function unlockField(
  companyId: string,
  fieldPath: string
): Promise<boolean> {
  const store = await loadLockStore(companyId);
  const originalLength = store.locks.length;

  store.locks = store.locks.filter(l => l.path !== fieldPath);

  if (store.locks.length === originalLength) {
    return false; // No lock was removed
  }

  store.updatedAt = new Date().toISOString();
  await saveLockStore(companyId, store);
  return true;
}

/**
 * Check if a field is locked and what can override it
 */
export async function checkLock(
  companyId: string,
  fieldPath: string
): Promise<LockCheckResult> {
  const store = await loadLockStore(companyId);
  const now = new Date();

  // Find lock for this exact path or any parent path
  const lock = store.locks.find(l => {
    // Check for expired locks
    if (l.expiresAt && new Date(l.expiresAt) < now) {
      return false;
    }
    // Exact match or parent path match
    return fieldPath === l.path || fieldPath.startsWith(l.path + '.');
  });

  if (!lock) {
    return {
      isLocked: false,
      canHumanOverride: true,
      canAIOverride: true,
    };
  }

  return {
    isLocked: true,
    lock,
    canHumanOverride: lock.severity === 'soft',
    canAIOverride: false, // AI can never override locks
  };
}

/**
 * Simple boolean check for locked status
 */
export async function isLocked(
  companyId: string,
  fieldPath: string
): Promise<boolean> {
  const result = await checkLock(companyId, fieldPath);
  return result.isLocked;
}

/**
 * Get all locks for a company
 */
export async function getLocks(companyId: string): Promise<FieldLock[]> {
  const store = await loadLockStore(companyId);
  const now = new Date();

  // Filter out expired locks
  return store.locks.filter(l => {
    if (l.expiresAt && new Date(l.expiresAt) < now) {
      return false;
    }
    return true;
  });
}

/**
 * Get locks for a specific domain
 */
export async function getLocksForDomain(
  companyId: string,
  domain: string
): Promise<FieldLock[]> {
  const locks = await getLocks(companyId);
  return locks.filter(l => l.path.startsWith(domain + '.') || l.path === domain);
}

/**
 * Clean up expired locks
 */
export async function cleanupExpiredLocks(companyId: string): Promise<number> {
  const store = await loadLockStore(companyId);
  const now = new Date();
  const originalLength = store.locks.length;

  store.locks = store.locks.filter(l => {
    if (l.expiresAt && new Date(l.expiresAt) < now) {
      return false;
    }
    return true;
  });

  const removedCount = originalLength - store.locks.length;

  if (removedCount > 0) {
    store.updatedAt = now.toISOString();
    await saveLockStore(companyId, store);
  }

  return removedCount;
}

/**
 * Bulk lock multiple fields at once
 */
export async function lockFields(
  companyId: string,
  locks: Array<{
    path: string;
    lockedBy: string;
    reason?: string;
    severity: 'hard' | 'soft';
  }>
): Promise<FieldLock[]> {
  const results: FieldLock[] = [];

  for (const lockData of locks) {
    const lock = await lockField(companyId, lockData.path, lockData);
    results.push(lock);
  }

  return results;
}
