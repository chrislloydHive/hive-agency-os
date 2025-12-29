// app/api/context/temporal/route.ts
// Temporal reasoning and history API
//
// Phase 4: Time-series storage per field

import { NextRequest, NextResponse } from 'next/server';
import {
  recordFieldChange,
  getFieldHistory,
  getDomainHistory,
  getChangeVelocity,
  getStalenessTrend,
  getCompanyChangeSummary,
  generateStrategicNarrative,
  generateQuickInsight,
} from '@/lib/contextGraph/temporal';
import { loadContextGraphRecord } from '@/lib/contextGraph/storage';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const runtime = 'nodejs';

/**
 * GET /api/context/temporal
 *
 * Query temporal data for a company's context graph.
 *
 * Query params:
 * - companyId: Company ID (required)
 * - mode: 'field_history' | 'domain_history' | 'velocity' | 'staleness' | 'narrative' | 'insight'
 * - domain: Domain name (for domain_history)
 * - path: Field path (for field_history)
 * - limit: Max entries to return (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const mode = searchParams.get('mode') || 'field_history';
    const domain = searchParams.get('domain') as DomainName | null;
    const path = searchParams.get('path');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    let result: Record<string, unknown>;

    switch (mode) {
      case 'field_history': {
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for field_history mode' },
            { status: 400 }
          );
        }
        const fieldHistory = await getFieldHistory(companyId, path, { limit });
        result = {
          history: fieldHistory.entries,
          stats: fieldHistory.stats,
          count: fieldHistory.entries.length,
        };
        break;
      }

      case 'domain_history': {
        if (!domain) {
          return NextResponse.json(
            { error: 'domain is required for domain_history mode' },
            { status: 400 }
          );
        }
        const domainHistory = await getDomainHistory(companyId, domain, { limit });
        result = {
          history: domainHistory.recentChanges,
          summary: domainHistory,
          count: domainHistory.totalChanges,
        };
        break;
      }

      case 'velocity': {
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for velocity mode' },
            { status: 400 }
          );
        }
        const velocity = await getChangeVelocity(companyId, path);
        result = { velocity };
        break;
      }

      case 'staleness': {
        if (!path) {
          return NextResponse.json(
            { error: 'path is required for staleness mode' },
            { status: 400 }
          );
        }
        const staleness = await getStalenessTrend(companyId, path);
        result = { staleness };
        break;
      }

      case 'narrative': {
        // Generate AI narrative - needs company graph
        const graphRecord = await loadContextGraphRecord(companyId);
        if (!graphRecord) {
          return NextResponse.json(
            { error: 'Company not found' },
            { status: 404 }
          );
        }
        const narrative = await generateStrategicNarrative(
          companyId,
          graphRecord.companyName,
          'quarter',
          graphRecord.graph
        );
        result = { narrative };
        break;
      }

      case 'insight': {
        // Generate a quick insight based on recent changes
        const insightEndDate = new Date().toISOString();
        const insightStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const insightSummary = await getCompanyChangeSummary(companyId, insightStartDate, insightEndDate);
        const insight = generateQuickInsight(insightSummary, 'month');
        result = { insight };
        break;
      }

      case 'summary': {
        // Get change summary for last 30 days
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const summary = await getCompanyChangeSummary(companyId, startDate, endDate);
        result = { summary };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid mode: ${mode}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      mode,
      companyId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[temporal] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context/temporal
 *
 * Record a field change for temporal tracking.
 *
 * Body:
 * - companyId: Company ID
 * - path: Field path (e.g., 'brand.positioning')
 * - domain: Domain name
 * - value: New value
 * - previousValue: Previous value
 * - updatedBy: 'human' | 'ai' | 'system'
 * - updatedByUser?: User ID
 * - reason?: Reason for change
 * - source?: Source tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      path,
      domain,
      value,
      previousValue,
      updatedBy = 'human',
      reason,
      sourceTool,
      sourceRunId,
    } = body;

    if (!companyId || !path || !domain) {
      return NextResponse.json(
        { error: 'companyId, path, and domain are required' },
        { status: 400 }
      );
    }

    const entry = await recordFieldChange(
      companyId,
      path,
      domain as DomainName,
      value,
      previousValue,
      {
        updatedBy,
        reason,
        sourceTool,
        sourceRunId,
      }
    );

    return NextResponse.json({
      entry,
      recorded: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[temporal] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
