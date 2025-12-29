// app/api/os/blueprint/route.ts
// Unified Strategic Blueprint API
//
// Single endpoint for generating/fetching Blueprints from any source:
// - DMA Funnel
// - Company (via company funnel data)
// - Workspace (aggregated)
//
// Query params:
// - sourceType: "dma" | "company" | "workspace" | "gap"
// - companyId: required for "company" and "gap" sources
// - period: "7d" | "30d" | "90d" (default: "30d")
// - regenerate: "true" to force regeneration (skips cache)

import { NextRequest, NextResponse } from 'next/server';
import {
  generateBlueprintFromFunnel,
  generateQuickBlueprint,
  type Blueprint,
  type BlueprintSourceType,
  type FunnelBlueprintInput,
} from '@/lib/os/analytics/blueprint';
import {
  getDmaFunnelDataset,
  getCompanyFunnelDataset,
  getWorkspaceFunnelDataset,
  type FunnelDataset,
} from '@/lib/os/analytics/funnel';
import type { WorkspaceDateRange } from '@/lib/os/analytics/types';
import { getCompanyById } from '@/lib/airtable/companies';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Simple in-memory cache for blueprints (could be Redis in production)
const blueprintCache = new Map<string, { blueprint: Blueprint; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(sourceType: string, sourceId: string | null, period: string): string {
  return `blueprint:${sourceType}:${sourceId || 'default'}:${period}`;
}

function getCachedBlueprint(key: string): Blueprint | null {
  const cached = blueprintCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.blueprint;
  }
  blueprintCache.delete(key);
  return null;
}

function setCachedBlueprint(key: string, blueprint: Blueprint): void {
  blueprintCache.set(key, {
    blueprint,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Resolved period with start/end dates and preset
 */
interface ResolvedPeriod {
  startDate: string;
  endDate: string;
  preset: '7d' | '30d' | '90d';
}

/**
 * Resolve period string to date range
 */
function resolvePeriod(periodParam: string): ResolvedPeriod {
  const today = new Date();
  let days = 30;
  let preset: '7d' | '30d' | '90d' = '30d';

  if (periodParam === '7d') {
    days = 7;
    preset = '7d';
  } else if (periodParam === '90d') {
    days = 90;
    preset = '90d';
  } else {
    days = 30;
    preset = '30d';
  }

  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days + 1);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate,
    preset,
  };
}

// ============================================================================
// GET Handler - Generate or fetch Blueprint
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType') as BlueprintSourceType | null;
    const companyId = searchParams.get('companyId');
    const periodParam = searchParams.get('period') ?? '30d';
    const regenerate = searchParams.get('regenerate') === 'true';
    const quick = searchParams.get('quick') === 'true';

    // Validate sourceType
    const validSourceTypes: BlueprintSourceType[] = ['dma', 'company', 'workspace', 'gap'];
    if (!sourceType || !validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid sourceType. Must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Require companyId for company and gap sources
    if ((sourceType === 'company' || sourceType === 'gap') && !companyId) {
      return NextResponse.json(
        { ok: false, error: 'companyId is required for company and gap sources' },
        { status: 400 }
      );
    }

    console.log('[Blueprint API] Request:', { sourceType, companyId, periodParam, regenerate, quick });

    // Check cache unless regenerate is requested
    const cacheKey = getCacheKey(sourceType, companyId, periodParam);
    if (!regenerate && !quick) {
      const cached = getCachedBlueprint(cacheKey);
      if (cached) {
        console.log('[Blueprint API] Returning cached blueprint');
        return NextResponse.json({
          ok: true,
          blueprint: cached,
          cached: true,
        });
      }
    }

    // Resolve period
    const period = resolvePeriod(periodParam);

    // Fetch funnel dataset based on source type
    let dataset: FunnelDataset | null = null;
    let companyName: string | undefined;
    const workspaceName: string | undefined = 'Hive OS Workspace';

    switch (sourceType) {
      case 'dma':
        dataset = await getDmaFunnelDataset(period.startDate, period.endDate, period.preset);
        break;

      case 'workspace': {
        const workspaceRange: WorkspaceDateRange = {
          startDate: period.startDate,
          endDate: period.endDate,
          preset: period.preset,
        };
        dataset = await getWorkspaceFunnelDataset(workspaceRange);
        break;
      }

      case 'company': {
        if (!companyId) {
          return NextResponse.json(
            { ok: false, error: 'companyId required for company source' },
            { status: 400 }
          );
        }
        // Get company name
        const company = await getCompanyById(companyId);
        if (!company) {
          return NextResponse.json(
            { ok: false, error: 'Company not found' },
            { status: 404 }
          );
        }
        companyName = company.name;
        dataset = await getCompanyFunnelDataset(companyId, period.startDate, period.endDate, period.preset);
        break;
      }

      case 'gap':
        // GAP blueprint not yet implemented - would pull from GAP analysis
        return NextResponse.json(
          { ok: false, error: 'GAP blueprint source not yet implemented' },
          { status: 501 }
        );

      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid sourceType' },
          { status: 400 }
        );
    }

    if (!dataset) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No funnel data available for this source',
          suggestion: sourceType === 'company'
            ? 'Connect GA4 and/or run DMA audits to generate funnel data'
            : 'No funnel events have been tracked yet',
        },
        { status: 404 }
      );
    }

    // Build input for generator
    const input: FunnelBlueprintInput = {
      dataset,
      context: {
        sourceType,
        companyId: companyId || undefined,
        companyName,
        workspaceName,
      },
    };

    // Generate blueprint
    let blueprint: Blueprint;
    if (quick) {
      // Quick rule-based blueprint (no AI)
      blueprint = generateQuickBlueprint(input);
    } else {
      // Full AI-powered blueprint
      blueprint = await generateBlueprintFromFunnel(input);
      // Cache the result
      setCachedBlueprint(cacheKey, blueprint);
    }

    console.log('[Blueprint API] Blueprint generated:', {
      title: blueprint.summary.title,
      themes: blueprint.themes.length,
      cached: !quick && !regenerate,
    });

    return NextResponse.json({
      ok: true,
      blueprint,
      cached: false,
    });
  } catch (error) {
    console.error('[Blueprint API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST Handler - Force regenerate Blueprint
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceType, companyId, period = '30d' } = body as {
      sourceType?: BlueprintSourceType;
      companyId?: string;
      period?: string;
    };

    // Validate sourceType
    const validSourceTypes: BlueprintSourceType[] = ['dma', 'company', 'workspace', 'gap'];
    if (!sourceType || !validSourceTypes.includes(sourceType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid sourceType. Must be one of: ${validSourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Require companyId for company and gap sources
    if ((sourceType === 'company' || sourceType === 'gap') && !companyId) {
      return NextResponse.json(
        { ok: false, error: 'companyId is required for company and gap sources' },
        { status: 400 }
      );
    }

    console.log('[Blueprint API] POST regenerate:', { sourceType, companyId, period });

    // Clear cache
    const cacheKey = getCacheKey(sourceType, companyId || null, period);
    blueprintCache.delete(cacheKey);

    // Redirect to GET with regenerate flag
    const url = new URL(request.url);
    url.searchParams.set('sourceType', sourceType);
    if (companyId) url.searchParams.set('companyId', companyId);
    url.searchParams.set('period', period);
    url.searchParams.set('regenerate', 'true');

    // Fetch via GET logic
    const response = await GET(new NextRequest(url));
    return response;
  } catch (error) {
    console.error('[Blueprint API] POST Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
