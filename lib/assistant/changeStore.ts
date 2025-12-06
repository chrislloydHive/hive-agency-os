// lib/assistant/changeStore.ts
// Temporary storage for proposed changes pending approval
//
// Uses file-based storage in development to persist across HMR restarts.
// In production, this could use Redis or a database table.

import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ProposedChanges } from './types';

interface StoredChange {
  companyId: string;
  proposedChanges: ProposedChanges;
  createdAt: number;
  expiresAt: number;
}

// File path for persistent storage in dev
const CACHE_DIR = join(process.cwd(), '.cache');
const STORE_FILE = join(CACHE_DIR, 'assistant-changes.json');

// Load from file on startup
function loadStoreFromFile(): Map<string, StoredChange> {
  try {
    if (existsSync(STORE_FILE)) {
      const data = JSON.parse(readFileSync(STORE_FILE, 'utf-8'));
      const now = Date.now();
      // Filter out expired entries
      const entries = Object.entries(data).filter(
        ([_, change]) => (change as StoredChange).expiresAt > now
      );
      return new Map(entries as [string, StoredChange][]);
    }
  } catch (error) {
    console.error('[ChangeStore] Failed to load from file:', error);
  }
  return new Map();
}

// Save to file
function saveStoreToFile(store: Map<string, StoredChange>) {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    const data = Object.fromEntries(store.entries());
    writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ChangeStore] Failed to save to file:', error);
  }
}

// Initialize store from file
const changeStore = loadStoreFromFile();

// TTL for stored changes (15 minutes)
const CHANGE_TTL_MS = 15 * 60 * 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Start cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [token, change] of changeStore.entries()) {
      if (change.expiresAt < now) {
        changeStore.delete(token);
        console.log(`[ChangeStore] Expired change token: ${token}`);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Store proposed changes and return a token
 */
export function storeProposedChanges(
  companyId: string,
  proposedChanges: ProposedChanges
): string {
  startCleanupTimer();

  const token = randomUUID();
  const now = Date.now();

  changeStore.set(token, {
    companyId,
    proposedChanges,
    createdAt: now,
    expiresAt: now + CHANGE_TTL_MS,
  });

  // Persist to file
  saveStoreToFile(changeStore);

  console.log(`[ChangeStore] Stored changes for ${companyId} with token ${token}`);
  return token;
}

/**
 * Retrieve stored changes by token
 */
export function getStoredChanges(
  token: string,
  companyId: string
): ProposedChanges | null {
  const stored = changeStore.get(token);

  if (!stored) {
    console.log(`[ChangeStore] Token not found: ${token}`);
    return null;
  }

  // Validate company ID matches
  if (stored.companyId !== companyId) {
    console.log(`[ChangeStore] Company ID mismatch for token ${token}`);
    return null;
  }

  // Check expiration
  if (stored.expiresAt < Date.now()) {
    changeStore.delete(token);
    console.log(`[ChangeStore] Token expired: ${token}`);
    return null;
  }

  return stored.proposedChanges;
}

/**
 * Remove a token after it's been applied
 */
export function removeStoredChanges(token: string): void {
  changeStore.delete(token);
  saveStoreToFile(changeStore);
  console.log(`[ChangeStore] Removed token: ${token}`);
}

/**
 * Get store stats (for debugging)
 */
export function getStoreStats(): { count: number; oldestAge: number } {
  const now = Date.now();
  let oldestAge = 0;

  for (const change of changeStore.values()) {
    const age = now - change.createdAt;
    if (age > oldestAge) oldestAge = age;
  }

  return {
    count: changeStore.size,
    oldestAge: Math.round(oldestAge / 1000), // seconds
  };
}
