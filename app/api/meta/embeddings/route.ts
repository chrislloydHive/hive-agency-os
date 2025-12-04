// app/api/meta/embeddings/route.ts
// API route for global embedding operations

import { NextRequest, NextResponse } from 'next/server';
import {
  generateGlobalEmbedding,
  findSimilarCompaniesGlobal,
  findClusters,
  calculateCompanyOutlierScore,
} from '@/lib/meta';
import { loadContextGraph } from '@/lib/contextGraph';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.5');
    const industry = searchParams.get('industry');
    const numberOfClusters = parseInt(searchParams.get('clusters') || '5', 10);

    // Find similar companies
    if (action === 'similar' && companyId) {
      const similar = await findSimilarCompaniesGlobal(companyId, {
        limit,
        minSimilarity,
        sameIndustryOnly: !!industry,
      });

      return NextResponse.json({
        success: true,
        companyId,
        similarCompanies: similar,
        count: similar.length,
      });
    }

    // Calculate outlier score
    if (action === 'outlier' && companyId) {
      const outlierScore = await calculateCompanyOutlierScore(companyId);

      if (!outlierScore) {
        return NextResponse.json(
          { success: false, error: 'Could not calculate outlier score' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        companyId,
        outlierScore,
      });
    }

    // Find clusters
    if (action === 'clusters') {
      const clusters = await findClusters(numberOfClusters, {
        industry: industry || undefined,
        minClusterSize: 2,
      });

      return NextResponse.json({
        success: true,
        clusters,
        count: clusters.length,
      });
    }

    // Get embedding for a company
    if (companyId) {
      const graph = await loadContextGraph(companyId);

      if (!graph) {
        return NextResponse.json(
          { success: false, error: 'Company not found' },
          { status: 404 }
        );
      }

      const companyName = graph.identity?.businessName?.value || 'Unknown';
      const embedding = await generateGlobalEmbedding(
        companyId,
        typeof companyName === 'string' ? companyName : 'Unknown',
        graph
      );

      return NextResponse.json({
        success: true,
        companyId,
        embedding: {
          companyName: embedding.companyName,
          industry: embedding.industry,
          businessModel: embedding.businessModel,
          companySize: embedding.companySize,
          maturityStage: embedding.maturityStage,
          completeness: embedding.completeness,
          confidence: embedding.confidence,
          lastUpdated: embedding.lastUpdated,
          // Not returning raw vectors for API
          hasBrandVector: embedding.brandVector.length > 0,
          hasAudienceVector: embedding.audienceVector.length > 0,
          hasProductVector: embedding.productVector.length > 0,
          hasMediaVector: embedding.mediaVector.length > 0,
          hasPerformanceVector: embedding.performanceVector.length > 0,
          hasTemporalVector: embedding.temporalVector.length > 0,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'companyId required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Embedding error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Embedding operation failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, companyId } = body;

    if (action === 'update' && companyId) {
      const graph = await loadContextGraph(companyId);

      if (!graph) {
        return NextResponse.json(
          { success: false, error: 'Company not found' },
          { status: 404 }
        );
      }

      const companyName = graph.identity?.businessName?.value || 'Unknown';
      const embedding = await generateGlobalEmbedding(
        companyId,
        typeof companyName === 'string' ? companyName : 'Unknown',
        graph
      );

      return NextResponse.json({
        success: true,
        message: 'Embedding updated',
        companyId,
        completeness: embedding.completeness,
        confidence: embedding.confidence,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Embedding update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Update failed',
      },
      { status: 500 }
    );
  }
}
