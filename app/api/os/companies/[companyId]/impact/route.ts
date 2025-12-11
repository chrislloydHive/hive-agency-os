// app/api/os/companies/[companyId]/impact/route.ts
// API endpoint for the Impact & ROI Engine
// GET: Retrieve impact analysis, ROI projections, and summaries

import { NextResponse } from 'next/server';
import {
  analyzeCompanyImpact,
  generateCompanyImpactSummary,
  getQuickWins,
  getHighImpactOpportunities,
  getImpactsByCategory,
  projectROI,
  type ImpactCategory,
} from '@/lib/os/impact';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const url = new URL(request.url);

    // Parse query parameters
    const format = url.searchParams.get('format') || 'impacts'; // 'impacts' | 'summary' | 'quick-wins' | 'high-impact'
    const category = url.searchParams.get('category') as ImpactCategory | null;
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const periodDays = parseInt(url.searchParams.get('period') || '30', 10);

    console.log('[API impact] Request:', { companyId, format, category, limit });

    // Handle different formats
    switch (format) {
      case 'summary': {
        const summary = await generateCompanyImpactSummary(companyId, periodDays);
        return NextResponse.json({
          success: true,
          data: summary,
        });
      }

      case 'quick-wins': {
        const quickWins = await getQuickWins(companyId, limit);
        const projection = projectROI(quickWins);
        return NextResponse.json({
          success: true,
          data: {
            companyId,
            quickWins,
            count: quickWins.length,
            projection,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      case 'high-impact': {
        const highImpact = await getHighImpactOpportunities(companyId, limit);
        const projection = projectROI(highImpact);
        return NextResponse.json({
          success: true,
          data: {
            companyId,
            opportunities: highImpact,
            count: highImpact.length,
            projection,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      case 'by-category': {
        if (!category) {
          return NextResponse.json(
            { success: false, error: 'Category parameter required for by-category format' },
            { status: 400 }
          );
        }
        const impacts = await getImpactsByCategory(companyId, category);
        return NextResponse.json({
          success: true,
          data: {
            companyId,
            category,
            impacts: impacts.slice(0, limit),
            count: impacts.length,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      case 'impacts':
      default: {
        let impacts = await analyzeCompanyImpact(companyId);

        // Filter by category if specified
        if (category) {
          impacts = impacts.filter(i => i.primaryImpact === category);
        }

        // Apply limit
        impacts = impacts.slice(0, limit);

        // Calculate overall projection
        const projection = projectROI(impacts);

        return NextResponse.json({
          success: true,
          data: {
            companyId,
            impacts,
            count: impacts.length,
            projection,
            generatedAt: new Date().toISOString(),
          },
        });
      }
    }
  } catch (error) {
    console.error('[API impact] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze impact',
      },
      { status: 500 }
    );
  }
}
