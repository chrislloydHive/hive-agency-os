// app/api/os/companies/[companyId]/strategy/snapshot/route.ts
// Strategy Snapshot API - Create and list strategy snapshots

import { NextRequest, NextResponse } from 'next/server';
import {
  createContextSnapshot,
  getSnapshotMetaForCompany,
  getSnapshotsByType,
  type SnapshotType,
} from '@/lib/contextGraph/snapshots';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/strategy/snapshot
 * List strategy snapshots (QBR and SSM types)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as SnapshotType | null;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    let snapshots;
    if (typeFilter) {
      snapshots = await getSnapshotsByType(companyId, typeFilter, limit);
    } else {
      // Default to QBR and SSM snapshots
      const all = await getSnapshotMetaForCompany(companyId, limit * 2);
      snapshots = all.filter((s) => s.type === 'qbr' || s.type === 'ssm').slice(0, limit);
    }

    return NextResponse.json({
      companyId,
      snapshots,
      count: snapshots.length,
    });
  } catch (error) {
    console.error('[API] Strategy snapshot list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/strategy/snapshot
 * Create a new strategy snapshot
 *
 * Body: {
 *   type: 'qbr' | 'ssm' | 'manual',
 *   label: string,
 *   sourceRunId?: string,
 *   description?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { companyId } = await params;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { type, label, sourceRunId, description } = body;

    // Validate type
    const validTypes: SnapshotType[] = ['qbr', 'ssm', 'manual'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid snapshot type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate label if not provided
    const snapshotLabel = label || generateDefaultLabel(type);

    console.log(`[API] Creating ${type} snapshot for ${companyId}:`, {
      label: snapshotLabel,
      sourceRunId,
    });

    const result = await createContextSnapshot({
      companyId,
      snapshotType: type,
      label: snapshotLabel,
      sourceRunId,
      description,
    });

    return NextResponse.json({
      success: true,
      snapshotId: result.snapshotId,
      label: result.label,
      completenessScore: result.completenessScore,
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error('[API] Strategy snapshot create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Generate a default label based on snapshot type
 */
function generateDefaultLabel(type: SnapshotType): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const year = now.getFullYear();
  const dateStr = now.toISOString().split('T')[0];

  switch (type) {
    case 'qbr':
      return `Q${quarter} ${year} Strategic Plan`;
    case 'ssm':
      return `SSM Baseline – ${dateStr}`;
    case 'manual':
      return `Manual Checkpoint – ${dateStr}`;
    default:
      return `Snapshot – ${dateStr}`;
  }
}
