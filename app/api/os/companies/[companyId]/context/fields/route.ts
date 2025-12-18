// app/api/os/companies/[companyId]/context/fields/route.ts
// Canonical Context Fields API - List all fields

import { NextRequest, NextResponse } from 'next/server';
import { readCanonicalFields } from '@/lib/os/context/upsertContextFields';

// GET /api/os/companies/[companyId]/context/fields
// Returns all canonical fields for the company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;

    const fields = await readCanonicalFields(companyId);

    return NextResponse.json({
      fields,
      count: fields.length,
    });
  } catch (error) {
    console.error('[Context Fields API] Error listing fields:', error);
    return NextResponse.json(
      { error: 'Failed to list context fields' },
      { status: 500 }
    );
  }
}
