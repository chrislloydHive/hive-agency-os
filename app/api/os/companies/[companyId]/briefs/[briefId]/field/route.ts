// app/api/os/companies/[companyId]/briefs/[briefId]/field/route.ts
// Field-level AI helper for briefs
//
// POST /api/os/companies/[companyId]/briefs/[briefId]/field
//
// IMPORTANT: Never overwrites the field. UI must apply explicitly.

import { NextRequest, NextResponse } from 'next/server';
import { getBriefById, updateBriefFieldWithAudit } from '@/lib/airtable/briefs';
import { getBriefFieldSuggestion } from '@/lib/os/briefs/fieldHelper';
import type { BriefFieldAction, BriefChangeSource } from '@/lib/types/brief';
import { getLockedBriefError } from '@/lib/types/brief';

export const maxDuration = 60;

type Params = { params: Promise<{ companyId: string; briefId: string }> };

/**
 * POST /api/os/companies/[companyId]/briefs/[briefId]/field
 *
 * Get AI suggestion for a specific field
 *
 * Body:
 * - fieldPath: string (e.g., "core.singleMindedFocus" or "extension.visualDirection")
 * - action: "suggest" | "refine" | "shorten" | "expand" | "variants"
 * - currentValue: string
 * - guidance?: string
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    const {
      fieldPath,
      action,
      currentValue,
      guidance,
    } = body as {
      fieldPath: string;
      action: BriefFieldAction;
      currentValue: string;
      guidance?: string;
    };

    // Validate inputs
    if (!fieldPath) {
      return NextResponse.json(
        { error: 'fieldPath is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    const validActions: BriefFieldAction[] = ['suggest', 'refine', 'shorten', 'expand', 'variants'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Check brief exists
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Get AI suggestion
    const result = await getBriefFieldSuggestion({
      briefId,
      fieldPath,
      action,
      currentValue: currentValue || '',
      guidance,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate suggestion' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      fieldPath,
      action,
      suggestion: result.output,
    });
  } catch (error) {
    console.error('[API] Field helper error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/os/companies/[companyId]/briefs/[briefId]/field
 *
 * Apply a value to a specific field (explicit update with audit log)
 *
 * Body:
 * - fieldPath: string
 * - value: string | string[]
 * - source: "user" | "ai" (defaults to "user")
 * - actor?: string (user identifier)
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { briefId } = await params;
    const body = await request.json();

    const { fieldPath, value, source = 'user', actor } = body as {
      fieldPath: string;
      value: string | string[];
      source?: BriefChangeSource;
      actor?: string;
    };

    if (!fieldPath) {
      return NextResponse.json(
        { error: 'fieldPath is required' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'value is required' },
        { status: 400 }
      );
    }

    // Check brief exists and is editable
    const brief = await getBriefById(briefId);
    if (!brief) {
      return NextResponse.json(
        { error: 'Brief not found' },
        { status: 404 }
      );
    }

    // Return 409 Conflict if brief is locked
    if (brief.isLocked || brief.status === 'locked') {
      const lockedError = getLockedBriefError();
      return NextResponse.json(
        { error: lockedError },
        { status: 409 }
      );
    }

    // Parse field path
    const [section, fieldName] = fieldPath.split('.') as ['core' | 'extension', string];
    if (!section || !fieldName) {
      return NextResponse.json(
        { error: 'Invalid fieldPath. Use format: core.fieldName or extension.fieldName' },
        { status: 400 }
      );
    }

    // Update the field with audit logging
    const updated = await updateBriefFieldWithAudit(
      briefId,
      fieldPath,
      value,
      source,
      actor
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update field' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      brief: updated,
      fieldPath,
      value,
      audited: true,
    });
  } catch (error) {
    console.error('[API] Field update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
