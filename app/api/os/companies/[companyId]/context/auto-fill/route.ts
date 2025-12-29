// app/api/os/companies/[companyId]/context/auto-fill/route.ts
// Smart Auto-Fill Context API
//
// POST - Trigger silent bulk refinement to fill context gaps
//
// This is OS-only - does NOT touch lead magnet GAP endpoints.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { runSmartAutoFillContext, type SmartAutoFillOptions } from '@/lib/contextGraph/autoFill';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/context/auto-fill
 *
 * Trigger Smart Auto-Fill Context
 *
 * Request body (optional):
 * {
 *   forceRunFCB?: boolean;     // Force run FCB even if ran recently
 *   includeGAPIA?: boolean;    // Include GAP IA pass (default true)
 *   forceRunGAPIA?: boolean;   // Force run GAP IA even if ran recently
 *   forceRunLabs?: boolean;    // Force run Labs even if completeness is high
 * }
 *
 * Response:
 * {
 *   status: "ok" | "error";
 *   result?: SmartAutoFillResult;
 *   error?: string;
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    // Parse options from body
    let options: SmartAutoFillOptions = {};
    try {
      const body = await request.json();
      options = {
        forceRunFCB: body.forceRunFCB ?? false,
        includeGAPIA: body.includeGAPIA !== false, // Default true
        forceRunGAPIA: body.forceRunGAPIA ?? false,
        forceRunLabs: body.forceRunLabs ?? false,
      };
    } catch {
      // Empty body is fine, use defaults
    }

    console.log(`[AutoFill API] Starting for ${company.name} (${companyId})`, options);

    // Run Smart Auto-Fill
    const result = await runSmartAutoFillContext(companyId, options);

    // Check for error
    if (result.error) {
      console.error(`[AutoFill API] Error for ${companyId}:`, result.error);
      return NextResponse.json(
        {
          status: 'error',
          error: result.error,
          result,
        },
        { status: 500 }
      );
    }

    console.log(`[AutoFill API] Complete for ${companyId}:`, {
      fieldsUpdated: result.fieldsUpdated,
      healthBefore: result.contextHealthBefore?.overallScore,
      healthAfter: result.contextHealthAfter?.overallScore,
      durationMs: result.durationMs,
    });

    return NextResponse.json({
      status: 'ok',
      result,
    });
  } catch (error) {
    console.error('[AutoFill API] Unexpected error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
