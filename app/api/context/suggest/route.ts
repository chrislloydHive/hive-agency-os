// app/api/context/suggest/route.ts
// AI Suggestion API
//
// POST /api/context/suggest
// Generate AI suggestions for context graph field updates

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { generateSuggestions, suggestFieldValue } from '@/lib/contextGraph/inference/aiSuggest';
import type { DomainName } from '@/lib/contextGraph/companyContextGraph';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, fieldPath, domain, options } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'Context graph not found' },
        { status: 404 }
      );
    }

    // If specific field requested, get single suggestion
    if (fieldPath) {
      console.log('[API] Suggesting value for field:', fieldPath);

      const suggestion = await suggestFieldValue(companyId, graph, fieldPath);

      return NextResponse.json({
        ok: true,
        suggestion,
        companyId,
        fieldPath,
      });
    }

    // Otherwise, generate multiple suggestions
    console.log('[API] Generating suggestions for company:', companyId);

    const result = await generateSuggestions(companyId, graph, {
      targetDomain: domain as DomainName | undefined,
      includeStale: options?.includeStale ?? true,
      includeMissing: options?.includeMissing ?? true,
      maxSuggestions: options?.maxSuggestions ?? 10,
    });

    console.log('[API] Generated suggestions:', {
      companyId,
      count: result.suggestions.length,
      analyzedFields: result.analyzedFields,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      companyId,
    });
  } catch (error) {
    console.error('[API] Suggest error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
