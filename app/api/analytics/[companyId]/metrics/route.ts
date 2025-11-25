// app/api/analytics/[companyId]/metrics/route.ts
// API Route: Fetch analytics metrics for a company
//
// Supports fetching individual metrics or batches of metrics
// with caching and normalized data output.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { fetchMetrics, fetchMetricsFromConfigs } from '@/lib/analytics/fetchers';
import { isSupportedMetric, type SupportedMetricId } from '@/lib/analytics/metricCatalog';
import { getCacheStats, clearCache } from '@/lib/analytics/cache';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ============================================================================
// GET /api/analytics/[companyId]/metrics
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const metricIdsParam = searchParams.get('metrics');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const skipCache = searchParams.get('skipCache') === 'true';
    const showStats = searchParams.get('stats') === 'true';

    // If stats requested, return cache stats
    if (showStats) {
      return NextResponse.json({
        ok: true,
        stats: getCacheStats(),
      });
    }

    // Validate required params
    if (!metricIdsParam) {
      return NextResponse.json(
        { ok: false, error: 'Missing metrics query parameter. Provide comma-separated metric IDs.' },
        { status: 400 }
      );
    }

    // Parse metric IDs
    const metricIds = metricIdsParam.split(',').map((id) => id.trim());
    const validMetricIds: SupportedMetricId[] = [];
    const invalidMetricIds: string[] = [];

    for (const id of metricIds) {
      if (isSupportedMetric(id)) {
        validMetricIds.push(id);
      } else {
        invalidMetricIds.push(id);
      }
    }

    if (validMetricIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No valid metric IDs provided',
          invalidMetricIds,
        },
        { status: 400 }
      );
    }

    // Default to last 30 days if no dates provided
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    now.setDate(now.getDate() - 30);
    const defaultStart = now.toISOString().split('T')[0];

    const resolvedStartDate = startDate || defaultStart;
    const resolvedEndDate = endDate || defaultEnd;

    // Fetch company to get GA4/GSC credentials
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Resolve GA4 property ID
    const ga4PropertyId = company.ga4PropertyId
      ? company.ga4PropertyId.startsWith('properties/')
        ? company.ga4PropertyId
        : `properties/${company.ga4PropertyId}`
      : process.env.GA4_PROPERTY_ID;

    // Resolve GSC site URL
    const gscSiteUrl = company.searchConsoleSiteUrl || process.env.SEARCH_CONSOLE_SITE_URL;

    console.log('[Metrics API] Fetching metrics:', {
      companyId,
      companyName: company.name,
      metricIds: validMetricIds,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      hasGa4: !!ga4PropertyId,
      hasGsc: !!gscSiteUrl,
    });

    // Fetch metrics
    const results = await fetchMetrics(companyId, validMetricIds, {
      ga4PropertyId,
      gscSiteUrl,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      skipCache,
    });

    // Build response
    const metrics: Record<string, any> = {};
    const errors: string[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const [metricId, result] of results.entries()) {
      metrics[metricId] = {
        data: result.data,
        fromCache: result.fromCache,
      };

      if (result.error) {
        errors.push(`${metricId}: ${result.error}`);
      }

      if (result.fromCache) {
        cacheHits++;
      } else {
        cacheMisses++;
      }
    }

    return NextResponse.json({
      ok: true,
      metrics,
      dateRange: {
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      },
      company: {
        id: company.id,
        name: company.name,
        hasGa4: !!ga4PropertyId,
        hasGsc: !!gscSiteUrl,
      },
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
      },
      warnings: invalidMetricIds.length > 0
        ? { invalidMetricIds }
        : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Metrics API] Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/analytics/[companyId]/metrics
// ============================================================================
// Alternative endpoint for fetching metrics with a request body
// (useful for complex queries or when URL length is a concern)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const {
      metrics: metricIds,
      startDate,
      endDate,
      skipCache = false,
    } = body;

    // Validate
    if (!metricIds || !Array.isArray(metricIds) || metricIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Missing or invalid metrics array in request body' },
        { status: 400 }
      );
    }

    // Parse and validate metric IDs
    const validMetricIds: SupportedMetricId[] = [];
    const invalidMetricIds: string[] = [];

    for (const id of metricIds) {
      if (isSupportedMetric(id)) {
        validMetricIds.push(id);
      } else {
        invalidMetricIds.push(id);
      }
    }

    if (validMetricIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No valid metric IDs provided',
          invalidMetricIds,
        },
        { status: 400 }
      );
    }

    // Default to last 30 days
    const now = new Date();
    const defaultEnd = now.toISOString().split('T')[0];
    now.setDate(now.getDate() - 30);
    const defaultStart = now.toISOString().split('T')[0];

    const resolvedStartDate = startDate || defaultStart;
    const resolvedEndDate = endDate || defaultEnd;

    // Fetch company
    const company = await getCompanyById(companyId);

    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Resolve credentials
    const ga4PropertyId = company.ga4PropertyId
      ? company.ga4PropertyId.startsWith('properties/')
        ? company.ga4PropertyId
        : `properties/${company.ga4PropertyId}`
      : process.env.GA4_PROPERTY_ID;

    const gscSiteUrl = company.searchConsoleSiteUrl || process.env.SEARCH_CONSOLE_SITE_URL;

    // Fetch metrics
    const results = await fetchMetrics(companyId, validMetricIds, {
      ga4PropertyId,
      gscSiteUrl,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      skipCache,
    });

    // Build response
    const metrics: Record<string, any> = {};
    const errors: string[] = [];

    for (const [metricId, result] of results.entries()) {
      metrics[metricId] = {
        data: result.data,
        fromCache: result.fromCache,
      };

      if (result.error) {
        errors.push(`${metricId}: ${result.error}`);
      }
    }

    return NextResponse.json({
      ok: true,
      metrics,
      dateRange: {
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      },
      company: {
        id: company.id,
        name: company.name,
      },
      warnings: invalidMetricIds.length > 0
        ? { invalidMetricIds }
        : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Metrics API] Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/analytics/[companyId]/metrics
// ============================================================================
// Clear cache for this company (admin utility)

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get('all') === 'true';

    if (clearAll) {
      clearCache();
      return NextResponse.json({
        ok: true,
        message: 'All cache cleared',
      });
    }

    // For now, just clear all (company-specific clearing would need cache key iteration)
    clearCache();

    return NextResponse.json({
      ok: true,
      message: `Cache cleared for company ${companyId}`,
    });
  } catch (error) {
    console.error('[Metrics API] Cache clear error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
