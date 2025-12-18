// app/api/os/companies/[companyId]/context/fields/[fieldKey]/route.ts
// Canonical Context Fields API - Update a single field

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { upsertContextFields, readCanonicalFields } from '@/lib/os/context/upsertContextFields';
import {
  CANONICAL_FIELD_DEFINITIONS,
  type CanonicalFieldKey,
  type ContextFieldStatus,
  type UserFieldSource,
} from '@/lib/os/context/schema';

// GET /api/os/companies/[companyId]/context/fields/[fieldKey]
// Returns a single canonical field
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; fieldKey: string }> }
) {
  try {
    const { companyId, fieldKey } = await params;

    // Validate field key
    if (!CANONICAL_FIELD_DEFINITIONS[fieldKey as CanonicalFieldKey]) {
      return NextResponse.json(
        { error: `Invalid field key: ${fieldKey}` },
        { status: 400 }
      );
    }

    // Read all fields and find the requested one
    const fields = await readCanonicalFields(companyId);
    const field = fields.find((f) => f.key === fieldKey);

    if (!field) {
      return NextResponse.json({
        field: null,
        status: 'missing',
        key: fieldKey,
      });
    }

    return NextResponse.json({ field });
  } catch (error) {
    console.error('[Context Fields API] Error getting field:', error);
    return NextResponse.json(
      { error: 'Failed to get context field' },
      { status: 500 }
    );
  }
}

// PUT /api/os/companies/[companyId]/context/fields/[fieldKey]
// Update a canonical field value
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; fieldKey: string }> }
) {
  try {
    const { companyId, fieldKey } = await params;
    const body = await request.json();

    // Validate field key
    if (!CANONICAL_FIELD_DEFINITIONS[fieldKey as CanonicalFieldKey]) {
      return NextResponse.json(
        { error: `Invalid field key: ${fieldKey}` },
        { status: 400 }
      );
    }

    const { value, status = 'proposed' } = body as {
      value: string;
      status?: ContextFieldStatus;
    };

    if (!value || typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Value is required and must be a string' },
        { status: 400 }
      );
    }

    // Get company name for graph creation
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Build source
    const source: UserFieldSource = {
      type: 'user',
    };

    // Upsert the field
    const result = await upsertContextFields(
      companyId,
      company.name,
      [
        {
          key: fieldKey as CanonicalFieldKey,
          value,
          confidence: 0.9, // User edits have high confidence
          sources: [source],
        },
      ],
      { forceOverwrite: true, source: 'user' }
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to save field', details: result.errors },
        { status: 500 }
      );
    }

    // Read the updated field
    const fields = await readCanonicalFields(companyId);
    const updatedField = fields.find((f) => f.key === fieldKey);

    return NextResponse.json({
      success: true,
      field: updatedField,
    });
  } catch (error) {
    console.error('[Context Fields API] Error updating field:', error);
    return NextResponse.json(
      { error: 'Failed to update context field' },
      { status: 500 }
    );
  }
}
