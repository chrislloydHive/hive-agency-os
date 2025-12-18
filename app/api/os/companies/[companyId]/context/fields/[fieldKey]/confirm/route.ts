// app/api/os/companies/[companyId]/context/fields/[fieldKey]/confirm/route.ts
// Canonical Context Fields API - Confirm a field

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createProvenance } from '@/lib/contextGraph/types';
import { readCanonicalFields } from '@/lib/os/context/upsertContextFields';
import {
  CANONICAL_FIELD_DEFINITIONS,
  getContextGraphPath,
  type CanonicalFieldKey,
} from '@/lib/os/context/schema';

// POST /api/os/companies/[companyId]/context/fields/[fieldKey]/confirm
// Confirm a proposed field (changes status to confirmed)
export async function POST(
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

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // Get the graph path for this field
    const graphPath = getContextGraphPath(fieldKey as CanonicalFieldKey);
    if (!graphPath) {
      return NextResponse.json(
        { error: `No graph path for field: ${fieldKey}` },
        { status: 400 }
      );
    }

    // Parse path and navigate to field
    const pathParts = graphPath.split('.');
    if (pathParts.length < 2) {
      return NextResponse.json(
        { error: `Invalid graph path: ${graphPath}` },
        { status: 400 }
      );
    }

    const [domain, ...fieldParts] = pathParts;
    const domainObj = (graph as any)[domain];
    if (!domainObj) {
      return NextResponse.json(
        { error: `Domain ${domain} not found in graph` },
        { status: 404 }
      );
    }

    // Navigate to the field
    let target = domainObj;
    for (let i = 0; i < fieldParts.length - 1; i++) {
      target = target[fieldParts[i]];
      if (!target) {
        return NextResponse.json(
          { error: `Path ${graphPath} not found` },
          { status: 404 }
        );
      }
    }

    const finalField = fieldParts[fieldParts.length - 1];
    const fieldData = target[finalField];

    if (!fieldData || fieldData.value === null || fieldData.value === undefined) {
      return NextResponse.json(
        { error: 'Field has no value to confirm' },
        { status: 400 }
      );
    }

    // Add confirmation provenance (user source marks as confirmed)
    const confirmProvenance = createProvenance('user', 1.0, {
      notes: 'User confirmed',
    });

    // Update provenance - user source at front = confirmed status
    target[finalField] = {
      ...fieldData,
      provenance: [confirmProvenance, ...(fieldData.provenance || [])].slice(0, 5),
    };

    // Save the graph
    await saveContextGraph(graph, 'user');

    // Read the updated field
    const fields = await readCanonicalFields(companyId);
    const confirmedField = fields.find((f) => f.key === fieldKey);

    console.log(`[Context Fields API] Confirmed field: ${fieldKey}`);

    return NextResponse.json({
      success: true,
      field: confirmedField,
    });
  } catch (error) {
    console.error('[Context Fields API] Error confirming field:', error);
    return NextResponse.json(
      { error: 'Failed to confirm context field' },
      { status: 500 }
    );
  }
}
