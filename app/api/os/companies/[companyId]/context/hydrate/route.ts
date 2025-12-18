// app/api/os/companies/[companyId]/context/hydrate/route.ts
// Hydrate Context from Historical Lab Runs
//
// POST - Import context data from existing diagnostic runs (GAP, Labs, etc.)
//
// This imports from EXISTING data, unlike auto-fill which generates NEW data via AI.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { hydrateContextFromHistory, checkAvailableImporters } from '@/lib/contextGraph/importers';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/hydrate
 *
 * Check which data sources are available for hydration
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    const domain = company.domain || company.website || '';
    const available = await checkAvailableImporters(companyId, domain);

    const sourcesWithData = available.filter(s => s.hasData);

    return NextResponse.json({
      status: 'ok',
      companyName: company.name,
      totalImporters: available.length,
      importersWithData: sourcesWithData.length,
      sources: available,
    });
  } catch (error) {
    console.error('[Hydrate API] GET error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/os/companies/[companyId]/context/hydrate
 *
 * Run hydration to import context from historical lab runs
 *
 * Response:
 * {
 *   status: "ok" | "error";
 *   fieldsUpdated: number;
 *   importerResults: Array<{ name: string; fieldsUpdated: number; errors: number }>;
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log(`[Hydrate API] Starting hydration for ${company.name} (${companyId})`);

    const result = await hydrateContextFromHistory(companyId);

    const importerResults = result.importerResults.map(ir => ({
      name: ir.importerLabel,
      fieldsUpdated: ir.result.fieldsUpdated,
      errors: ir.result.errors.length,
      errorMessages: ir.result.errors,
    }));

    console.log(`[Hydrate API] Complete for ${companyId}:`, {
      success: result.success,
      totalFieldsUpdated: result.totalFieldsUpdated,
      totalErrors: result.totalErrors,
    });

    if (!result.success && result.totalFieldsUpdated === 0) {
      return NextResponse.json({
        status: 'error',
        error: 'Hydration failed - no data imported',
        fieldsUpdated: 0,
        importerResults,
        telemetry: result.telemetry,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: 'ok',
      fieldsUpdated: result.totalFieldsUpdated,
      importerResults,
      telemetry: result.telemetry,
    });
  } catch (error) {
    console.error('[Hydrate API] POST error:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
