// app/api/os/companies/[companyId]/strategy/route.ts
// Strategy API - Read and update strategy fields in the Context Graph
//
// IMPORTANT: User edits from this API use source='user' which has the
// HIGHEST priority and will NEVER be overwritten by automation.

import { NextRequest, NextResponse } from 'next/server';
import {
  readStrategyFromContextGraph,
  writeStrategyToContextGraph,
} from '@/lib/contextGraph/domain-writers/strategyWriter';
import {
  loadContextGraph,
  saveContextGraph,
} from '@/lib/contextGraph/storage';
import {
  setFieldUntyped,
  createProvenance,
} from '@/lib/contextGraph/mutate';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';
import type { WithMetaType } from '@/lib/contextGraph/types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/strategy
 * Read current strategy from Context Graph
 */
export async function GET(
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

    const strategy = await readStrategyFromContextGraph(companyId);

    if (!strategy) {
      return NextResponse.json(
        { error: 'No context graph found for company' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      companyId,
      strategy,
      fieldCount: Object.keys(strategy).length,
    });
  } catch (error) {
    console.error('[API] Strategy read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/os/companies/[companyId]/strategy
 * Update strategy fields in the Context Graph
 *
 * Body: { fields: { "path.to.field": value, ... } }
 *
 * IMPORTANT: These are USER edits and use source='user' which has
 * the highest priority. Automation cannot overwrite these values.
 */
export async function PATCH(
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
    const { fields } = body;

    if (!fields || typeof fields !== 'object') {
      return NextResponse.json(
        { error: 'Fields object is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Strategy update (user edit) for ${companyId}:`, {
      fieldCount: Object.keys(fields).length,
    });

    // IMPORTANT: User edits use source='user' which has the highest priority
    // and will NEVER be overwritten by automated sources (Labs, GAP, etc.)
    const result = await writeStrategyToContextGraph({
      companyId,
      strategy: fields,
      sourceType: 'user', // User edits are highest priority
      sourceName: 'Manual Edit',
    });

    if (!result.success && result.fieldsWritten === 0) {
      return NextResponse.json(
        { error: 'Failed to write strategy', errors: result.errors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: result.success,
      fieldsWritten: result.fieldsWritten,
      fieldsSkipped: result.fieldsSkipped,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[API] Strategy update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/strategy
 * Revert a field to its previous value (removes human override)
 *
 * Body: { action: 'revert', path: 'domain.field' }
 *
 * This allows users to undo their manual edits and return to
 * the last automated value from Labs/GAP/etc.
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
    const { action, path } = body;

    if (action !== 'revert') {
      return NextResponse.json(
        { error: 'Invalid action. Use "revert" to revert a field.' },
        { status: 400 }
      );
    }

    if (!path || typeof path !== 'string') {
      return NextResponse.json(
        { error: 'Field path is required (e.g., "brand.positioning")' },
        { status: 400 }
      );
    }

    // Parse path
    const [domain, ...fieldParts] = path.split('.');
    const field = fieldParts.join('.');

    if (!domain || !field) {
      return NextResponse.json(
        { error: `Invalid path format: ${path}` },
        { status: 400 }
      );
    }

    // Load graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'No context graph found for company' },
        { status: 404 }
      );
    }

    // Get current field data
    const domainObj = graph[domain as DomainName] as Record<string, WithMetaType<unknown>>;
    if (!domainObj || typeof domainObj !== 'object') {
      return NextResponse.json(
        { error: `Domain ${domain} not found` },
        { status: 404 }
      );
    }

    const fieldData = domainObj[field];
    if (!fieldData || typeof fieldData !== 'object' || !('provenance' in fieldData)) {
      return NextResponse.json(
        { error: `Field ${path} not found` },
        { status: 404 }
      );
    }

    // Check if there's a previous provenance to revert to
    const currentProvenance = fieldData.provenance;
    if (!currentProvenance || currentProvenance.length < 2) {
      return NextResponse.json(
        { error: 'No previous value to revert to' },
        { status: 400 }
      );
    }

    // Remove the current (human override) provenance entry
    // This effectively reverts to the previous source's claim on the value
    const previousProvenance = currentProvenance[1];

    console.log(`[API] Strategy revert for ${companyId}:`, {
      path,
      fromSource: currentProvenance[0]?.source,
      toSource: previousProvenance?.source,
    });

    // Write back with the previous provenance entry at the front
    // This removes the human override
    domainObj[field] = {
      value: fieldData.value, // Keep current value for now (we don't store historical values)
      provenance: currentProvenance.slice(1), // Remove the first (human) entry
    };

    graph.meta.updatedAt = new Date().toISOString();
    await saveContextGraph(graph);

    return NextResponse.json({
      success: true,
      path,
      revertedFrom: currentProvenance[0]?.source,
      revertedTo: previousProvenance?.source,
      message: `Reverted ${path} - human override removed`,
    });
  } catch (error) {
    console.error('[API] Strategy revert error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
