// app/api/gap-ia/run/route.ts
//
// Canonical GAP-IA (Initial Assessment) endpoint.
// Runs the complete GAP-IA pipeline for any URL.
//
// This is the public-facing endpoint for running GAP-IA assessments.
// It uses the same engine as the OS baseline and DMA pipelines.
//
// Request:
// POST /api/gap-ia/run
// { "url": "https://example.com", "companyId"?: "rec123" }
//
// Response:
// {
//   "success": true,
//   "initialAssessment": { ... },
//   "businessContext": { ... },
//   "dataConfidence": { ... },
//   "socialFootprint": { ... },
//   "metadata": { ... }
// }

import { NextRequest, NextResponse } from 'next/server';
import { runInitialAssessment } from '@/lib/gap/core';

export const dynamic = 'force-dynamic';

// Increase timeout for GAP-IA (analysis can take 30-60 seconds)
export const maxDuration = 120;

interface GapIaRunRequest {
  url: string;
  companyId?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body: GapIaRunRequest = await request.json().catch(() => ({ url: '' }));
    const { url, companyId } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Validate URL format
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log('[gap-ia/run] Starting GAP-IA for URL:', normalizedUrl);
    if (companyId) {
      console.log('[gap-ia/run] Company context:', companyId);
    }

    // Run the GAP-IA pipeline
    // Uses the canonical runInitialAssessment() from lib/gap/core.ts
    // This includes:
    // - HTML fetching and signal extraction
    // - Multi-page discovery
    // - Digital footprint collection
    // - V5 Social footprint detection (GBP, Instagram, YouTube, LinkedIn, etc.)
    // - Business context inference
    // - LLM analysis with V3 prompts (6 dimensions, businessModelCategory support)
    // - Data confidence computation
    const result = await runInitialAssessment({
      url: normalizedUrl,
      // modelCaller is optional - defaults to OpenAI gpt-4o
    });

    const durationMs = Date.now() - startTime;
    console.log('[gap-ia/run] GAP-IA complete:', {
      url: normalizedUrl,
      overallScore: result.initialAssessment?.summary?.overallScore ?? result.initialAssessment?.core?.overallScore,
      maturityStage: result.initialAssessment?.core?.marketingMaturity,
      durationMs,
    });

    // Return full result
    return NextResponse.json({
      success: true,
      ...result,
      metadata: {
        ...result.metadata,
        companyId,
        durationMs,
      },
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error('[gap-ia/run] Error:', error);

    // Extract meaningful error message
    let errorMessage = 'An error occurred during analysis';
    if (error instanceof Error) {
      errorMessage = error.message;
      // Preserve user-friendly error messages from core.ts
      // (e.g., "Please enter a URL to analyze", "This website is blocking automated access")
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        metadata: {
          durationMs,
        },
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation/health check
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/gap-ia/run',
    method: 'POST',
    description: 'Run GAP-IA (Initial Assessment) for any URL',
    request: {
      url: 'string (required) - The website URL to analyze',
      companyId: 'string (optional) - Company ID for context',
    },
    response: {
      success: 'boolean',
      initialAssessment: {
        summary: {
          overallScore: 'number (0-100)',
          maturityStage: 'string',
          topOpportunities: 'string[]',
        },
        dimensions: {
          brand: '{ score, oneLiner, issues, narrative }',
          content: '{ score, oneLiner, issues, narrative }',
          seo: '{ score, oneLiner, issues, narrative }',
          website: '{ score, oneLiner, issues, narrative }',
          digitalFootprint: '{ score, oneLiner, issues, subscores }',
          authority: '{ score, oneLiner, issues, subscores }',
        },
        quickWins: '{ bullets: [{ action, category, impact, effort }] }',
        core: '{ businessName, companyType, brandTier, ... }',
      },
      businessContext: '{ businessType, ... }',
      dataConfidence: '{ score, level, ... }',
      socialFootprint: '{ gbp, socials, dataConfidence }',
      metadata: '{ url, domain, analyzedAt, durationMs }',
    },
    dimensions: [
      'brand - Narrative clarity, differentiation, positioning',
      'content - Depth, consistency, educational value',
      'seo - Keywords, indexing, metadata, on-page optimization',
      'website - Navigation, UX, CTAs, conversion flows',
      'digitalFootprint - GBP, reviews, social presence',
      'authority - Press, backlinks, credibility indicators',
    ],
    maturityStages: [
      'Foundational',
      'Emerging',
      'Established',
      'Advanced',
      'CategoryLeader',
    ],
  });
}
