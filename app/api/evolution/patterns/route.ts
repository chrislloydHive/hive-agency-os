// app/api/evolution/patterns/route.ts
// Query and manage cross-company patterns

import { NextRequest, NextResponse } from 'next/server';
import {
  getPatterns,
  getPattern,
  updatePatternStatus,
  captureLearning,
  getLearnings,
} from '@/lib/evolution/patternDiscovery';
import type { PatternType, Pattern, LearningType } from '@/lib/evolution/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patternId = searchParams.get('patternId');
    const type = searchParams.get('type') as PatternType | null;
    const status = searchParams.get('status') as Pattern['status'] | null;
    const minConfidence = searchParams.get('minConfidence');

    // Get specific pattern
    if (patternId) {
      const pattern = getPattern(patternId);
      if (!pattern) {
        return NextResponse.json(
          { error: 'Pattern not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ pattern });
    }

    // Get patterns with filters
    const patterns = getPatterns({
      type: type || undefined,
      status: status || undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
    });

    return NextResponse.json({
      patterns,
      total: patterns.length,
    });
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patterns' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternId, status, validationResult } = body;

    if (!patternId) {
      return NextResponse.json(
        { error: 'patternId is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const updated = updatePatternStatus(patternId, status, validationResult);
    if (!updated) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      pattern: updated,
    });
  } catch (error) {
    console.error('Error updating pattern:', error);
    return NextResponse.json(
      { error: 'Failed to update pattern' },
      { status: 500 }
    );
  }
}
