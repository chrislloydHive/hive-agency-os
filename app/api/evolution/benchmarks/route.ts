// app/api/evolution/benchmarks/route.ts
// Query industry benchmarks and compare company performance

import { NextRequest, NextResponse } from 'next/server';
import {
  getBenchmark,
  getAllBenchmarks,
  getBenchmarksByIndustry,
  compareCompanyToBenchmarks,
} from '@/lib/evolution/benchmarkEngine';
import { loadContextGraph } from '@/lib/contextGraph';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const industry = searchParams.get('industry');
    const businessModel = searchParams.get('businessModel');
    const period = searchParams.get('period');
    const companyId = searchParams.get('companyId');

    // Compare company to benchmarks
    if (companyId) {
      const graph = await loadContextGraph(companyId);
      if (!graph) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }
      const companyIndustry = graph.identity?.industry?.value as string || industry || 'General';
      const companyBusinessModel = graph.identity?.businessModel?.value as string || businessModel || 'General';

      // Get performance from URL params or defaults
      const performance = {
        cpa: parseFloat(searchParams.get('cpa') || '50'),
        ctr: parseFloat(searchParams.get('ctr') || '0.01'),
        conversionRate: parseFloat(searchParams.get('conversionRate') || '0.025'),
        roas: parseFloat(searchParams.get('roas') || '3'),
        cpc: parseFloat(searchParams.get('cpc') || '1.5'),
      };

      const comparison = compareCompanyToBenchmarks(
        companyId,
        companyIndustry,
        companyBusinessModel,
        performance
      );

      if (!comparison) {
        return NextResponse.json(
          { error: 'No benchmark found for this industry/model' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        comparison,
        benchmark: getBenchmark(companyIndustry, companyBusinessModel),
      });
    }

    // Get benchmarks by industry
    if (industry) {
      const benchmark = getBenchmark(industry, businessModel || undefined, period || undefined);

      if (!benchmark) {
        // Return all benchmarks for the industry
        const industryBenchmarks = getBenchmarksByIndustry(industry);
        return NextResponse.json({
          benchmarks: industryBenchmarks,
          total: industryBenchmarks.length,
        });
      }

      return NextResponse.json({ benchmark });
    }

    // Get all benchmarks
    const allBenchmarks = getAllBenchmarks();

    // Group by industry
    const byIndustry: Record<string, typeof allBenchmarks> = {};
    for (const benchmark of allBenchmarks) {
      if (!byIndustry[benchmark.industry]) {
        byIndustry[benchmark.industry] = [];
      }
      byIndustry[benchmark.industry].push(benchmark);
    }

    return NextResponse.json({
      benchmarks: allBenchmarks,
      byIndustry,
      industries: Object.keys(byIndustry),
      total: allBenchmarks.length,
    });
  } catch (error) {
    console.error('Error fetching benchmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benchmarks' },
      { status: 500 }
    );
  }
}
