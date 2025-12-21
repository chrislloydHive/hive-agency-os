// app/api/os/companies/[companyId]/context/v4/snapshot/route.ts
// Context V4: Confirmed Snapshot Artifact
//
// Returns a snapshot of confirmed-only fields for Strategy generation.
// This ensures Strategy uses a stable point-in-time view, not the live store.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { loadContextFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  type ContextFieldV4,
} from '@/lib/types/contextField';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/** Snapshot field - confirmed value with metadata */
interface SnapshotFieldV4 {
  key: string;
  domain: string;
  value: unknown;
  source: string;
  confidence: number;
  confirmedAt: string;
  confirmedBy?: string;
}

/** Snapshot response */
interface ContextSnapshotV4 {
  /** Unique snapshot identifier (hash of contents + timestamp) */
  snapshotId: string;
  /** Company ID */
  companyId: string;
  /** When the snapshot was created */
  createdAt: string;
  /** Number of confirmed fields */
  fieldCount: number;
  /** Confirmed fields only, grouped by domain */
  fields: Record<string, SnapshotFieldV4[]>;
  /** Flat array of all confirmed fields */
  confirmedFieldsOnly: SnapshotFieldV4[];
  /** Domains with confirmed fields */
  domains: string[];
}

/**
 * Generate a stable snapshot ID from content hash + timestamp
 */
function generateSnapshotId(companyId: string, fields: SnapshotFieldV4[], timestamp: string): string {
  const contentHash = createHash('sha256')
    .update(JSON.stringify({ companyId, fields, timestamp }))
    .digest('hex')
    .slice(0, 16);

  return `snap_${contentHash}`;
}

/**
 * GET /api/os/companies/[companyId]/context/v4/snapshot
 *
 * Returns a point-in-time snapshot of confirmed fields only.
 * Strategy should use this for stable context during generation.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Check feature flag
  if (!isContextV4Enabled()) {
    return NextResponse.json({
      ok: false,
      error: 'Context V4 is not enabled',
    }, { status: 404 });
  }

  try {
    const { companyId } = await params;
    const now = new Date().toISOString();

    // Load V4 store
    const store = await loadContextFieldsV4(companyId);

    // Extract confirmed fields only
    const confirmedFields: SnapshotFieldV4[] = [];
    const fieldsByDomain: Record<string, SnapshotFieldV4[]> = {};
    const domains = new Set<string>();

    if (store) {
      for (const [key, field] of Object.entries(store.fields)) {
        if (field.status === 'confirmed') {
          const snapshotField: SnapshotFieldV4 = {
            key: field.key,
            domain: field.domain,
            value: field.value,
            source: field.source,
            confidence: field.confidence,
            confirmedAt: field.updatedAt,
            confirmedBy: field.lockedBy,
          };

          confirmedFields.push(snapshotField);
          domains.add(field.domain);

          if (!fieldsByDomain[field.domain]) {
            fieldsByDomain[field.domain] = [];
          }
          fieldsByDomain[field.domain].push(snapshotField);
        }
      }
    }

    // Generate snapshot ID
    const snapshotId = generateSnapshotId(companyId, confirmedFields, now);

    // Sort fields by key for consistency
    confirmedFields.sort((a, b) => a.key.localeCompare(b.key));
    for (const domain of Object.keys(fieldsByDomain)) {
      fieldsByDomain[domain].sort((a, b) => a.key.localeCompare(b.key));
    }

    const snapshot: ContextSnapshotV4 = {
      snapshotId,
      companyId,
      createdAt: now,
      fieldCount: confirmedFields.length,
      fields: fieldsByDomain,
      confirmedFieldsOnly: confirmedFields,
      domains: Array.from(domains).sort(),
    };

    return NextResponse.json({
      ok: true,
      ...snapshot,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ContextV4 Snapshot] Error:', errorMessage);

    return NextResponse.json({
      ok: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
