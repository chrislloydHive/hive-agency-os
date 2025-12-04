// app/api/context/benchmarks/route.ts
// Cross-company benchmarking API
//
// Phase 4: Multi-company learning and benchmarks

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCompanyEmbedding,
  findSimilarCompanies,
  getCompanyEmbedding,
  getCompanyClassification,
  getEmbeddingStats,
  recordCompanyValues,
  computeBenchmarks,
  getBenchmarkPosition,
  generateBenchmarkReport,
  compareCompanies,
  getAllBenchmarks,
  getBenchmarkStats,
  registerCompanyGraph,
  discoverPatterns,
  generateRecommendations,
  getAllPatterns,
  getLearningStats,
} from '@/lib/contextGraph/benchmarks';
import { loadContextGraphRecord } from '@/lib/contextGraph/storage';

export const runtime = 'nodejs';

/**
 * GET /api/context/benchmarks
 *
 * Query benchmarks and similar companies.
 *
 * Query params:
 * - companyId: Company ID (required for most operations)
 * - mode: 'similar' | 'embedding' | 'benchmark' | 'report' | 'compare' | 'patterns' | 'recommendations' | 'stats'
 * - otherCompanyId: For compare mode
 * - metricId: For specific benchmark position
 * - limit: Max results to return
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const mode = searchParams.get('mode') || 'similar';
    const otherCompanyId = searchParams.get('otherCompanyId');
    const metricId = searchParams.get('metricId');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    let result: Record<string, unknown>;

    switch (mode) {
      case 'similar':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }
        const similar = findSimilarCompanies(companyId, { limit });
        result = {
          similar,
          count: similar.length,
        };
        break;

      case 'embedding':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }
        const embedding = getCompanyEmbedding(companyId);
        const classification = getCompanyClassification(companyId);
        result = {
          embedding: embedding ? {
            companyId: embedding.companyId,
            companyName: embedding.companyName,
            completeness: embedding.completeness,
            confidence: embedding.confidence,
            generatedAt: embedding.generatedAt,
          } : null,
          classification,
        };
        break;

      case 'benchmark':
        if (!companyId || !metricId) {
          return NextResponse.json(
            { error: 'companyId and metricId are required' },
            { status: 400 }
          );
        }
        const position = getBenchmarkPosition(companyId, metricId);
        result = { position };
        break;

      case 'report':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }
        const graphRecord = await loadContextGraphRecord(companyId);
        const companyName = graphRecord?.companyName || graphRecord?.graph.identity?.businessName?.value as string || 'Unknown';
        const report = generateBenchmarkReport(companyId, companyName);
        result = { report };
        break;

      case 'compare':
        if (!companyId || !otherCompanyId) {
          return NextResponse.json(
            { error: 'companyId and otherCompanyId are required' },
            { status: 400 }
          );
        }
        const comparison = compareCompanies(companyId, otherCompanyId);
        result = { comparison };
        break;

      case 'patterns':
        const patterns = getAllPatterns();
        result = {
          patterns: patterns.slice(0, limit),
          totalPatterns: patterns.length,
        };
        break;

      case 'recommendations':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }
        const graphForRecs = await loadContextGraphRecord(companyId);
        if (!graphForRecs) {
          return NextResponse.json(
            { error: 'Company not found' },
            { status: 404 }
          );
        }
        const recommendations = await generateRecommendations(companyId, graphForRecs.graph, limit);
        result = {
          recommendations,
          count: recommendations.length,
        };
        break;

      case 'stats':
        const embeddingStats = getEmbeddingStats();
        const benchmarkStats = getBenchmarkStats();
        const learningStats = getLearningStats();
        result = {
          embeddings: embeddingStats,
          benchmarks: benchmarkStats,
          learning: learningStats,
        };
        break;

      case 'metrics':
        const allBenchmarks = getAllBenchmarks();
        result = {
          metrics: allBenchmarks,
          count: allBenchmarks.length,
        };
        break;

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
    console.error('[benchmarks] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/context/benchmarks
 *
 * Register a company for benchmarking or trigger computation.
 *
 * Body:
 * - companyId: Company ID
 * - action: 'register' | 'compute' | 'discover_patterns'
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, action = 'register' } = body;

    let result: Record<string, unknown>;

    switch (action) {
      case 'register':
        if (!companyId) {
          return NextResponse.json(
            { error: 'companyId is required' },
            { status: 400 }
          );
        }

        // Get company graph
        const registerGraphRecord = await loadContextGraphRecord(companyId);
        if (!registerGraphRecord) {
          return NextResponse.json(
            { error: 'Company not found' },
            { status: 404 }
          );
        }

        const registerCompanyName = registerGraphRecord.companyName || registerGraphRecord.graph.identity?.businessName?.value as string || 'Unknown';

        // Generate embedding
        const embedding = await generateCompanyEmbedding(
          companyId,
          registerCompanyName,
          registerGraphRecord.graph
        );

        // Record values for benchmarking
        recordCompanyValues(companyId, registerGraphRecord.graph);

        // Register for pattern learning
        registerCompanyGraph(companyId, registerGraphRecord.graph);

        result = {
          registered: true,
          embedding: {
            companyId: embedding.companyId,
            completeness: embedding.completeness,
            confidence: embedding.confidence,
          },
          classification: getCompanyClassification(companyId),
        };
        break;

      case 'compute':
        // Compute all benchmarks
        const benchmarks = computeBenchmarks();
        result = {
          computed: true,
          benchmarksCount: benchmarks.length,
        };
        break;

      case 'discover_patterns':
        // Discover patterns across companies
        const patterns = await discoverPatterns();
        result = {
          discovered: true,
          patternsCount: patterns.length,
          patterns: patterns.slice(0, 5),
        };
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      ...result,
      action,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[benchmarks] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
