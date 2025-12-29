// app/api/media/benchmarks/route.ts
// API endpoint for AI-suggested industry benchmarks
//
// Usage: GET /api/media/benchmarks?companyId=xxx
// Returns recommended assumptions based on industry and historical data

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getIndustryBenchmarks,
  type MediaAssumptions,
  DEFAULT_SEARCH_ASSUMPTIONS,
  DEFAULT_SOCIAL_ASSUMPTIONS,
  DEFAULT_LSA_ASSUMPTIONS,
  DEFAULT_MAPS_ASSUMPTIONS,
  CAR_AUDIO_BENCHMARKS,
} from '@/lib/media/assumptions';

// ============================================================================
// Types
// ============================================================================

interface BenchmarkResponse {
  success: boolean;
  benchmarks?: Partial<MediaAssumptions>;
  industry?: string;
  source?: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string[];
  error?: string;
}

// ============================================================================
// GET Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<BenchmarkResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company info to determine industry
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Determine industry and get appropriate benchmarks
    const industryBenchmarks = getIndustryBenchmarks(company.industry ?? undefined);

    // Build the recommended assumptions
    const benchmarks: Partial<MediaAssumptions> = {
      search: {
        ...DEFAULT_SEARCH_ASSUMPTIONS,
        ...industryBenchmarks.search,
      },
      social: {
        ...DEFAULT_SOCIAL_ASSUMPTIONS,
        ...industryBenchmarks.social,
      },
      lsa: {
        ...DEFAULT_LSA_ASSUMPTIONS,
        ...industryBenchmarks.lsa,
      },
      maps: {
        ...DEFAULT_MAPS_ASSUMPTIONS,
        ...industryBenchmarks.maps,
      },
    };

    // Generate notes based on industry
    const notes: string[] = [];
    const isCarAudio = industryBenchmarks.industry === CAR_AUDIO_BENCHMARKS.industry;

    if (isCarAudio) {
      notes.push('Benchmarks optimized for 12V/Car Audio industry');
      notes.push('Higher conversion rates expected due to specialty service nature');
      notes.push('Consider seasonal adjustments for remote start season (Oct-Feb)');
    } else {
      notes.push('Using general local services benchmarks');
      notes.push('Consider adjusting based on your specific service category');
    }

    // Add geo-specific notes if we have market data
    notes.push('Store-level modifiers can be configured for market type variations');

    return NextResponse.json({
      success: true,
      benchmarks,
      industry: industryBenchmarks.industry,
      source: 'industry_benchmarks',
      confidence: isCarAudio ? 'high' : 'medium',
      notes,
    });
  } catch (error) {
    console.error('[API] Error fetching benchmarks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch benchmarks',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Future: Accept historical data for custom calibration
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<BenchmarkResponse>> {
  try {
    const body = await request.json();
    const { companyId, historicalData } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company info
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // For now, return industry benchmarks
    // Future: Calibrate based on historicalData if provided
    const industryBenchmarks = getIndustryBenchmarks(company.industry ?? undefined);

    const benchmarks: Partial<MediaAssumptions> = {
      search: {
        ...DEFAULT_SEARCH_ASSUMPTIONS,
        ...industryBenchmarks.search,
      },
      social: {
        ...DEFAULT_SOCIAL_ASSUMPTIONS,
        ...industryBenchmarks.social,
      },
      lsa: {
        ...DEFAULT_LSA_ASSUMPTIONS,
        ...industryBenchmarks.lsa,
      },
      maps: {
        ...DEFAULT_MAPS_ASSUMPTIONS,
        ...industryBenchmarks.maps,
      },
    };

    const notes: string[] = [];

    if (historicalData && Array.isArray(historicalData) && historicalData.length > 0) {
      notes.push('Historical data received - calibration will be implemented in future update');
      notes.push('Currently returning industry benchmarks');
    }

    notes.push(`Benchmarks based on ${industryBenchmarks.industry} industry`);

    return NextResponse.json({
      success: true,
      benchmarks,
      industry: industryBenchmarks.industry,
      source: historicalData?.length > 0 ? 'hybrid' : 'industry_benchmarks',
      confidence: 'medium',
      notes,
    });
  } catch (error) {
    console.error('[API] Error processing benchmark request:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process request',
      },
      { status: 500 }
    );
  }
}
