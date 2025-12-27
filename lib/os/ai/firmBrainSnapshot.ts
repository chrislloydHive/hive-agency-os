// lib/os/ai/firmBrainSnapshot.ts
// Firm Brain Snapshot Utilities
//
// Creates lightweight hashes of Firm Brain state for drift detection.
// Does NOT duplicate all data - just creates a fingerprint.

import type { FirmBrainSnapshot } from '@/lib/types/firmBrain';
import type { FirmBrainSnapshotRef } from '@/lib/types/rfp';

/**
 * Create a simple hash from a string
 * Uses a fast, non-cryptographic hash suitable for change detection
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string and ensure it's positive
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Create a snapshot reference from Firm Brain data
 *
 * The hash is based on:
 * - Agency profile updated timestamp
 * - Count and IDs of team members
 * - Count and IDs of case studies
 * - Count and IDs of references
 * - Count and IDs of pricing templates
 * - Count and IDs of plan templates
 *
 * This creates a fingerprint that changes when any resource is added,
 * removed, or updated.
 */
export function createFirmBrainSnapshotRef(snapshot: FirmBrainSnapshot): FirmBrainSnapshotRef {
  // Build a fingerprint string from the snapshot
  const parts: string[] = [];

  // Agency profile
  if (snapshot.agencyProfile) {
    parts.push(`ap:${snapshot.agencyProfile.id}:${snapshot.agencyProfile.updatedAt || ''}`);
  } else {
    parts.push('ap:null');
  }

  // Team members (sorted IDs + updated timestamps)
  const teamIds = snapshot.teamMembers
    .map(t => `${t.id}:${t.updatedAt || ''}`)
    .sort()
    .join(',');
  parts.push(`tm:${snapshot.teamMembers.length}:${teamIds}`);

  // Case studies
  const caseIds = snapshot.caseStudies
    .map(c => `${c.id}:${c.updatedAt || ''}`)
    .sort()
    .join(',');
  parts.push(`cs:${snapshot.caseStudies.length}:${caseIds}`);

  // References
  const refIds = snapshot.references
    .map(r => `${r.id}:${r.updatedAt || ''}`)
    .sort()
    .join(',');
  parts.push(`rf:${snapshot.references.length}:${refIds}`);

  // Pricing templates
  const pricingIds = snapshot.pricingTemplates
    .map(p => `${p.id}:${p.updatedAt || ''}`)
    .sort()
    .join(',');
  parts.push(`pr:${snapshot.pricingTemplates.length}:${pricingIds}`);

  // Plan templates
  const planIds = snapshot.planTemplates
    .map(p => `${p.id}:${p.updatedAt || ''}`)
    .sort()
    .join(',');
  parts.push(`pl:${snapshot.planTemplates.length}:${planIds}`);

  // Create hash
  const fingerprint = parts.join('|');
  const hash = simpleHash(fingerprint);

  return {
    hash,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Check if Firm Brain has drifted from a snapshot
 *
 * @param currentSnapshot - Current Firm Brain data
 * @param savedRef - Snapshot reference saved on an RFP
 * @returns Object with drift status and details
 */
export function checkFirmBrainDrift(
  currentSnapshot: FirmBrainSnapshot,
  savedRef: FirmBrainSnapshotRef | null | undefined
): FirmBrainDriftResult {
  // No saved snapshot - can't check drift
  if (!savedRef) {
    return {
      hasDrifted: false,
      reason: null,
      savedAt: null,
      currentHash: null,
    };
  }

  // Create current hash
  const currentRef = createFirmBrainSnapshotRef(currentSnapshot);

  // Compare hashes
  const hasDrifted = currentRef.hash !== savedRef.hash;

  return {
    hasDrifted,
    reason: hasDrifted ? 'Firm Brain has been updated since this RFP was created' : null,
    savedAt: savedRef.createdAt,
    currentHash: currentRef.hash,
    savedHash: savedRef.hash,
  };
}

/**
 * Result of drift check
 */
export interface FirmBrainDriftResult {
  /** Whether Firm Brain has changed */
  hasDrifted: boolean;
  /** Human-readable reason */
  reason: string | null;
  /** When the snapshot was taken */
  savedAt: string | null;
  /** Current hash (for debugging) */
  currentHash: string | null;
  /** Saved hash (for debugging) */
  savedHash?: string;
}

/**
 * Get detailed drift information for UI display
 */
export function getDriftDetails(
  currentSnapshot: FirmBrainSnapshot,
  savedRef: FirmBrainSnapshotRef | null | undefined
): FirmBrainDriftDetails {
  const driftResult = checkFirmBrainDrift(currentSnapshot, savedRef);

  if (!driftResult.hasDrifted) {
    return {
      hasDrifted: false,
      message: null,
      recommendation: null,
      severity: 'none',
    };
  }

  // Determine severity based on how much might have changed
  // For now, we just have the hash - we could track more details later
  return {
    hasDrifted: true,
    message: 'Firm Brain has changed since this RFP was created',
    recommendation: 'Consider regenerating sections to include the latest information',
    severity: 'warning',
  };
}

/**
 * Detailed drift information for UI
 */
export interface FirmBrainDriftDetails {
  hasDrifted: boolean;
  message: string | null;
  recommendation: string | null;
  severity: 'none' | 'info' | 'warning' | 'error';
}
