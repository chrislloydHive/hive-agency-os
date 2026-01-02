// lib/os/programs/governanceLog.ts
// Governance Change Log - Tracks program intensity and status changes
//
// Records all governance-level changes for audit trail and compliance:
// - Intensity level changes (Core, Standard, Aggressive)
// - Program status changes (committed, paused, archived)
// - Bundle instantiation changes (via operational events)
//
// Changes only affect FUTURE deliverable generation, never rewrite history.

import { z } from 'zod';
import type { PlanningProgram } from '@/lib/types/program';
import type { IntensityLevel } from '@/lib/types/programTemplate';
import {
  generateDebugId,
  type ProgramIntensityChangedPayload,
  type ProgramStatusChangedPayload,
} from '@/lib/types/operationalEvent';

// ============================================================================
// Types
// ============================================================================

export interface GovernanceChangeRecord {
  id: string;
  debugId: string;
  companyId: string;
  programId: string;
  programTitle: string;
  changeType: 'intensity_changed' | 'status_changed';
  timestamp: string;
  actorId?: string;
  payload: ProgramIntensityChangedPayload | ProgramStatusChangedPayload;
}

export interface IntensityChangeRequest {
  programId: string;
  newIntensity: IntensityLevel;
  reason?: string;
  actorId?: string;
}

export interface StatusChangeRequest {
  programId: string;
  newStatus: 'committed' | 'paused' | 'archived';
  reason?: string;
  actorId?: string;
}

// ============================================================================
// In-Memory Store (for demo/testing)
// In production, this would be persisted to Airtable or a database
// ============================================================================

const governanceStore = new Map<string, GovernanceChangeRecord>();
const changesByCompany = new Map<string, Set<string>>();
const changesByProgram = new Map<string, Set<string>>();

/**
 * Generate a unique change record ID
 */
function generateChangeId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `gov_${timestamp}_${random}`;
}

// ============================================================================
// Change Recording
// ============================================================================

/**
 * Record an intensity change for a program
 */
export function recordIntensityChange(
  program: PlanningProgram,
  fromIntensity: IntensityLevel,
  toIntensity: IntensityLevel,
  options: {
    reason?: string;
    actorId?: string;
    debugId?: string;
  } = {}
): GovernanceChangeRecord {
  const debugId = options.debugId || generateDebugId();
  const now = new Date().toISOString();

  const payload: ProgramIntensityChangedPayload = {
    programId: program.id,
    programTitle: program.title,
    domain: program.domain || null,
    fromIntensity,
    toIntensity,
    reason: options.reason,
    affectsDeliverables: true,
    // Next deliverable date would be calculated based on cadence
  };

  const record: GovernanceChangeRecord = {
    id: generateChangeId(),
    debugId,
    companyId: program.companyId,
    programId: program.id,
    programTitle: program.title,
    changeType: 'intensity_changed',
    timestamp: now,
    actorId: options.actorId,
    payload,
  };

  // Store the record
  governanceStore.set(record.id, record);

  // Index by company
  if (!changesByCompany.has(program.companyId)) {
    changesByCompany.set(program.companyId, new Set());
  }
  changesByCompany.get(program.companyId)!.add(record.id);

  // Index by program
  if (!changesByProgram.has(program.id)) {
    changesByProgram.set(program.id, new Set());
  }
  changesByProgram.get(program.id)!.add(record.id);

  return record;
}

/**
 * Record a status change for a program
 */
export function recordStatusChange(
  program: PlanningProgram,
  fromStatus: string,
  toStatus: string,
  options: {
    reason?: string;
    actorId?: string;
    debugId?: string;
  } = {}
): GovernanceChangeRecord {
  const debugId = options.debugId || generateDebugId();
  const now = new Date().toISOString();

  const payload: ProgramStatusChangedPayload = {
    programId: program.id,
    programTitle: program.title,
    domain: program.domain || null,
    fromStatus,
    toStatus,
    reason: options.reason,
  };

  const record: GovernanceChangeRecord = {
    id: generateChangeId(),
    debugId,
    companyId: program.companyId,
    programId: program.id,
    programTitle: program.title,
    changeType: 'status_changed',
    timestamp: now,
    actorId: options.actorId,
    payload,
  };

  // Store the record
  governanceStore.set(record.id, record);

  // Index by company
  if (!changesByCompany.has(program.companyId)) {
    changesByCompany.set(program.companyId, new Set());
  }
  changesByCompany.get(program.companyId)!.add(record.id);

  // Index by program
  if (!changesByProgram.has(program.id)) {
    changesByProgram.set(program.id, new Set());
  }
  changesByProgram.get(program.id)!.add(record.id);

  return record;
}

// ============================================================================
// Change Retrieval
// ============================================================================

/**
 * Get a change record by ID
 */
export function getChangeRecord(id: string): GovernanceChangeRecord | undefined {
  return governanceStore.get(id);
}

/**
 * Get all changes for a company
 */
export function getCompanyChanges(
  companyId: string,
  options: {
    limit?: number;
    since?: string;
    changeType?: 'intensity_changed' | 'status_changed';
  } = {}
): GovernanceChangeRecord[] {
  const { limit = 50, since, changeType } = options;
  const ids = changesByCompany.get(companyId);
  if (!ids) return [];

  let records = Array.from(ids)
    .map(id => governanceStore.get(id))
    .filter((r): r is GovernanceChangeRecord => r !== undefined)
    .filter(r => !since || new Date(r.timestamp) >= new Date(since))
    .filter(r => !changeType || r.changeType === changeType)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limit > 0) {
    records = records.slice(0, limit);
  }

  return records;
}

/**
 * Get all changes for a program
 */
export function getProgramChanges(
  programId: string,
  options: {
    limit?: number;
    since?: string;
  } = {}
): GovernanceChangeRecord[] {
  const { limit = 50, since } = options;
  const ids = changesByProgram.get(programId);
  if (!ids) return [];

  let records = Array.from(ids)
    .map(id => governanceStore.get(id))
    .filter((r): r is GovernanceChangeRecord => r !== undefined)
    .filter(r => !since || new Date(r.timestamp) >= new Date(since))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limit > 0) {
    records = records.slice(0, limit);
  }

  return records;
}

/**
 * Get recent changes across all companies (for admin view)
 */
export function getRecentChanges(
  options: {
    limit?: number;
    since?: string;
  } = {}
): GovernanceChangeRecord[] {
  const { limit = 50, since } = options;

  let records = Array.from(governanceStore.values())
    .filter(r => !since || new Date(r.timestamp) >= new Date(since))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (limit > 0) {
    records = records.slice(0, limit);
  }

  return records;
}

// ============================================================================
// Intensity Change Helpers
// ============================================================================

/**
 * Get the output multiplier difference between intensities
 */
export function getIntensityMultiplierChange(
  from: IntensityLevel,
  to: IntensityLevel
): { fromMultiplier: number; toMultiplier: number; changePercent: number } {
  const multipliers: Record<IntensityLevel, number> = {
    Core: 0.6,
    Standard: 1.0,
    Aggressive: 1.5,
  };

  const fromMultiplier = multipliers[from];
  const toMultiplier = multipliers[to];
  const changePercent = Math.round(((toMultiplier - fromMultiplier) / fromMultiplier) * 100);

  return { fromMultiplier, toMultiplier, changePercent };
}

/**
 * Validate an intensity change is allowed
 */
export function validateIntensityChange(
  program: PlanningProgram,
  newIntensity: IntensityLevel
): { valid: boolean; error?: string } {
  // Can't change intensity of archived programs
  if (program.status === 'archived') {
    return { valid: false, error: 'Cannot change intensity of archived programs' };
  }

  // Same intensity is a no-op
  if (program.intensity === newIntensity) {
    return { valid: false, error: 'Program already has this intensity level' };
  }

  return { valid: true };
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get summary statistics for governance changes
 */
export function getGovernanceStats(companyId: string): {
  totalChanges: number;
  intensityChanges: number;
  statusChanges: number;
  recentChanges: GovernanceChangeRecord[];
} {
  const changes = getCompanyChanges(companyId, { limit: 0 });

  return {
    totalChanges: changes.length,
    intensityChanges: changes.filter(c => c.changeType === 'intensity_changed').length,
    statusChanges: changes.filter(c => c.changeType === 'status_changed').length,
    recentChanges: changes.slice(0, 5),
  };
}

/**
 * Clear all governance records (for testing)
 */
export function clearGovernanceLog(): void {
  governanceStore.clear();
  changesByCompany.clear();
  changesByProgram.clear();
}
