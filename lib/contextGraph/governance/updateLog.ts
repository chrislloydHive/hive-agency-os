// lib/contextGraph/governance/updateLog.ts
// Graph Update Log System
//
// Tracks all changes to the context graph with full audit trail.
// Logs human edits, AI suggestions, system updates, and tool writes.

import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

// ============================================================================
// Types
// ============================================================================

export interface UpdateLogEntry {
  updateId: string;
  companyId: string;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  updatedBy: 'human' | 'ai' | 'system';
  updatedAt: string;
  sourceTool?: string;           // audience_lab, media_lab, brand_lab, etc.
  reasoning?: string;            // Why the update was made
  acceptedBy?: string;           // When human accepts an AI suggestion
  rejectedBy?: string;           // When human rejects an AI suggestion
  status: 'applied' | 'pending' | 'rejected';
  metadata?: Record<string, unknown>;
}

export interface UpdateLogStore {
  entries: UpdateLogEntry[];
  updatedAt: string;
}

export interface UpdateLogQuery {
  companyId: string;
  path?: string;                 // Filter by field path
  domain?: string;               // Filter by domain
  updatedBy?: 'human' | 'ai' | 'system';
  status?: 'applied' | 'pending' | 'rejected';
  since?: string;                // ISO date
  limit?: number;
}

// ============================================================================
// Storage
// ============================================================================

const LOG_DIR = path.join(process.cwd(), '.cache', 'context-update-logs');

async function ensureLogDir(): Promise<void> {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

function getLogPath(companyId: string): string {
  return path.join(LOG_DIR, `${companyId}.json`);
}

async function loadLogStore(companyId: string): Promise<UpdateLogStore> {
  try {
    await ensureLogDir();
    const filePath = getLogPath(companyId);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { entries: [], updatedAt: new Date().toISOString() };
  }
}

async function saveLogStore(companyId: string, store: UpdateLogStore): Promise<void> {
  await ensureLogDir();
  const filePath = getLogPath(companyId);

  // Keep only last 1000 entries to prevent unbounded growth
  if (store.entries.length > 1000) {
    store.entries = store.entries.slice(-1000);
  }

  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

// ============================================================================
// Log Operations
// ============================================================================

/**
 * Log an update to the graph
 */
export async function logUpdate(entry: Omit<UpdateLogEntry, 'updateId' | 'updatedAt'>): Promise<UpdateLogEntry> {
  const store = await loadLogStore(entry.companyId);

  const now = new Date().toISOString();
  const fullEntry: UpdateLogEntry = {
    ...entry,
    updateId: nanoid(),
    updatedAt: now,
  };

  store.entries.push(fullEntry);
  store.updatedAt = now;

  await saveLogStore(entry.companyId, store);
  return fullEntry;
}

/**
 * Query update logs
 */
export async function queryUpdateLogs(query: UpdateLogQuery): Promise<UpdateLogEntry[]> {
  const store = await loadLogStore(query.companyId);
  let entries = store.entries;

  // Filter by path
  if (query.path) {
    entries = entries.filter(e => e.path === query.path);
  }

  // Filter by domain
  if (query.domain) {
    entries = entries.filter(e => e.path.startsWith(query.domain + '.'));
  }

  // Filter by updatedBy
  if (query.updatedBy) {
    entries = entries.filter(e => e.updatedBy === query.updatedBy);
  }

  // Filter by status
  if (query.status) {
    entries = entries.filter(e => e.status === query.status);
  }

  // Filter by date
  if (query.since) {
    const sinceDate = new Date(query.since);
    entries = entries.filter(e => new Date(e.updatedAt) >= sinceDate);
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Apply limit
  if (query.limit) {
    entries = entries.slice(0, query.limit);
  }

  return entries;
}

/**
 * Get recent updates for a company
 */
export async function getRecentUpdates(
  companyId: string,
  limit: number = 20
): Promise<UpdateLogEntry[]> {
  return queryUpdateLogs({ companyId, limit });
}

/**
 * Get update history for a specific field
 */
export async function getFieldHistory(
  companyId: string,
  path: string,
  limit: number = 10
): Promise<UpdateLogEntry[]> {
  return queryUpdateLogs({ companyId, path, limit });
}

/**
 * Get pending AI suggestions
 */
export async function getPendingSuggestions(companyId: string): Promise<UpdateLogEntry[]> {
  return queryUpdateLogs({
    companyId,
    updatedBy: 'ai',
    status: 'pending',
  });
}

/**
 * Mark a pending update as applied
 */
export async function markUpdateApplied(
  companyId: string,
  updateId: string,
  acceptedBy?: string
): Promise<UpdateLogEntry | null> {
  const store = await loadLogStore(companyId);

  const entry = store.entries.find(e => e.updateId === updateId);
  if (!entry) return null;

  entry.status = 'applied';
  entry.acceptedBy = acceptedBy;
  store.updatedAt = new Date().toISOString();

  await saveLogStore(companyId, store);
  return entry;
}

/**
 * Mark a pending update as rejected
 */
export async function markUpdateRejected(
  companyId: string,
  updateId: string,
  rejectedBy?: string
): Promise<UpdateLogEntry | null> {
  const store = await loadLogStore(companyId);

  const entry = store.entries.find(e => e.updateId === updateId);
  if (!entry) return null;

  entry.status = 'rejected';
  entry.rejectedBy = rejectedBy;
  store.updatedAt = new Date().toISOString();

  await saveLogStore(companyId, store);
  return entry;
}

/**
 * Get statistics about updates
 */
export async function getUpdateStats(companyId: string): Promise<{
  totalUpdates: number;
  humanUpdates: number;
  aiUpdates: number;
  systemUpdates: number;
  pendingCount: number;
  rejectedCount: number;
  lastUpdateAt: string | null;
}> {
  const store = await loadLogStore(companyId);
  const entries = store.entries;

  return {
    totalUpdates: entries.filter(e => e.status === 'applied').length,
    humanUpdates: entries.filter(e => e.updatedBy === 'human' && e.status === 'applied').length,
    aiUpdates: entries.filter(e => e.updatedBy === 'ai' && e.status === 'applied').length,
    systemUpdates: entries.filter(e => e.updatedBy === 'system' && e.status === 'applied').length,
    pendingCount: entries.filter(e => e.status === 'pending').length,
    rejectedCount: entries.filter(e => e.status === 'rejected').length,
    lastUpdateAt: entries.length > 0 ? entries[entries.length - 1].updatedAt : null,
  };
}

/**
 * Get updates by tool
 */
export async function getUpdatesByTool(
  companyId: string,
  sourceTool: string,
  limit: number = 20
): Promise<UpdateLogEntry[]> {
  const store = await loadLogStore(companyId);

  return store.entries
    .filter(e => e.sourceTool === sourceTool)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * Clear old rejected entries (cleanup)
 */
export async function cleanupOldRejected(
  companyId: string,
  olderThanDays: number = 30
): Promise<number> {
  const store = await loadLogStore(companyId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const originalLength = store.entries.length;
  store.entries = store.entries.filter(e => {
    if (e.status === 'rejected' && new Date(e.updatedAt) < cutoff) {
      return false;
    }
    return true;
  });

  const removedCount = originalLength - store.entries.length;

  if (removedCount > 0) {
    store.updatedAt = new Date().toISOString();
    await saveLogStore(companyId, store);
  }

  return removedCount;
}
