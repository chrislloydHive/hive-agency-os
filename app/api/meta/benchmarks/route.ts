// app/api/meta/benchmarks/route.ts
// API route for global benchmarking operations

import { NextRequest, NextResponse } from 'next/server';
import {
  generateGlobalBenchmarks,
  compareToGlobalBenchmarks,
  getChannelBenchmarks,
  getBenchmarkPercentile,
} from '@/lib/meta';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vertical = searchParams.get('vertical');
    const businessModel = searchParams.get('businessModel');
    const companySize = searchParams.get('companySize');
    const channel = searchParams.get('channel');
    const companyId = searchParams.get('companyId');

    // Channel-specific benchmarks
    if (channel) {
      const channelBenchmarks = await getChannelBenchmarks(channel, {
        vertical: vertical || undefined,
        businessModel: businessModel || undefined,
        companySize: companySize || undefined,
      });

      if (!channelBenchmarks) {
        return NextResponse.json(
          { success: false, error: `No benchmarks found for channel: ${channel}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        channel,
        benchmarks: channelBenchmarks,
      });
    }

    // Company comparison
    if (companyId) {
      const comparison = await compareToGlobalBenchmarks(companyId, {
        vertical: vertical || undefined,
        businessModel: businessModel || undefined,
        companySize: companySize || undefined,
      });

      return NextResponse.json({
        success: true,
        companyId,
        comparisons: comparison,
      });
    }

    // Global benchmarks
    const benchmarks = await generateGlobalBenchmarks({
      vertical: vertical || undefined,
      businessModel: businessModel || undefined,
      companySize: companySize || undefined,
    });

    return NextResponse.json({
      success: true,
      benchmarks,
      filters: {
        vertical: vertical || 'all',
        businessModel: businessModel || 'all',
        companySize: companySize || 'all',
      },
    });
  } catch (error) {
    console.error('Benchmark error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Benchmarking failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metric, value, vertical, businessModel, companySize } = body;

    if (!metric || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Metric and value required' },
        { status: 400 }
      );
    }

    const result = await getBenchmarkPercentile(metric, value, {
      vertical,
      businessModel,
      companySize,
    });

    return NextResponse.json({
      success: true,
      metric,
      value,
      ...result,
    });
  } catch (error) {
    console.error('Percentile calculation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Calculation failed',
      },
      { status: 500 }
    );
  }
}
