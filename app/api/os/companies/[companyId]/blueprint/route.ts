// app/api/os/companies/[companyId]/blueprint/route.ts
// API endpoint for the Blueprint v2 Strategic Layer
// GET: Retrieve blueprint, drift analysis, or benchmark data

import { NextResponse } from 'next/server';
import {
  generateBlueprint,
  analyzeDrift,
  benchmarkCompany,
  getProgressSnapshot,
} from '@/lib/os/blueprint';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);

    // Parse query parameters
    const format = url.searchParams.get('format') || 'blueprint'; // 'blueprint' | 'drift' | 'benchmark' | 'progress'

    console.log('[API blueprint] Request:', { companyId, format });

    switch (format) {
      case 'drift': {
        const driftAnalysis = await analyzeDrift(companyId);
        return NextResponse.json({
          success: true,
          data: driftAnalysis,
        });
      }

      case 'benchmark': {
        const benchmarkPosition = await benchmarkCompany(companyId);
        return NextResponse.json({
          success: true,
          data: benchmarkPosition,
        });
      }

      case 'progress': {
        const progressSnapshot = await getProgressSnapshot(companyId);
        return NextResponse.json({
          success: true,
          data: progressSnapshot,
        });
      }

      case 'blueprint':
      default: {
        const blueprint = await generateBlueprint(companyId);
        return NextResponse.json({
          success: true,
          data: blueprint,
        });
      }
    }
  } catch (error) {
    console.error('[API blueprint] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate blueprint',
      },
      { status: 500 }
    );
  }
}
