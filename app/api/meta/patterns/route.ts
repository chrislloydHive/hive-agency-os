// app/api/meta/patterns/route.ts
// API route for pattern discovery operations

import { NextRequest, NextResponse } from 'next/server';
import {
  discoverPatterns,
  discoverVerticalPatterns,
  validatePattern,
  storePatternMemory,
} from '@/lib/meta';
import type { MetaPattern } from '@/lib/meta/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vertical = searchParams.get('vertical');
    const types = searchParams.get('types')?.split(',');
    const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.6');
    const minSampleSize = parseInt(searchParams.get('minSampleSize') || '3', 10);

    const patterns = vertical
      ? await discoverVerticalPatterns(vertical)
      : await discoverPatterns({
          patternTypes: types as MetaPattern['type'][],
          minConfidence,
          minSampleSize,
        });

    return NextResponse.json({
      success: true,
      patterns,
      count: patterns.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Pattern discovery error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Pattern discovery failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pattern } = body;

    if (action === 'validate') {
      if (!pattern) {
        return NextResponse.json(
          { success: false, error: 'Pattern required for validation' },
          { status: 400 }
        );
      }

      const result = await validatePattern(pattern as MetaPattern);
      return NextResponse.json({
        success: true,
        validation: result,
      });
    }

    if (action === 'store') {
      if (!pattern) {
        return NextResponse.json(
          { success: false, error: 'Pattern required for storage' },
          { status: 400 }
        );
      }

      const memory = await storePatternMemory(pattern as MetaPattern);
      return NextResponse.json({
        success: true,
        memory,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Pattern operation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      },
      { status: 500 }
    );
  }
}
