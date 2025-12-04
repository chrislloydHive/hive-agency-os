// app/api/evolution/learnings/route.ts
// Capture and query learnings

import { NextRequest, NextResponse } from 'next/server';
import {
  captureLearning,
  getLearnings,
  getAllLearnings,
} from '@/lib/evolution/patternDiscovery';
import type { LearningType } from '@/lib/evolution/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type') as LearningType | null;
    const domain = searchParams.get('domain');
    const limit = parseInt(searchParams.get('limit') || '50');
    const scope = searchParams.get('scope'); // 'company' | 'all'

    // Get all learnings (for cross-company analysis)
    if (scope === 'all' || !companyId) {
      const allLearnings = getAllLearnings();

      let filtered = allLearnings;
      if (type) {
        filtered = filtered.filter(l => l.type === type);
      }
      if (domain) {
        filtered = filtered.filter(l => l.domain === domain);
      }

      return NextResponse.json({
        learnings: filtered.slice(-limit),
        total: filtered.length,
      });
    }

    // Get learnings for a specific company
    const learnings = getLearnings(companyId, {
      type: type || undefined,
      domain: domain || undefined,
      limit,
    });

    return NextResponse.json({
      learnings,
      total: learnings.length,
    });
  } catch (error) {
    console.error('Error fetching learnings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learnings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      type,
      hypothesis,
      outcome,
      learning,
      domain,
      channels,
      audiences,
      experimentId,
      metrics,
      generalizable,
      applicableConditions,
      validityPeriod,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!type || !hypothesis || !outcome || !learning || !domain) {
      return NextResponse.json(
        { error: 'type, hypothesis, outcome, learning, and domain are required' },
        { status: 400 }
      );
    }

    const captured = captureLearning(companyId, {
      companyId,
      type,
      hypothesis,
      outcome,
      learning,
      domain,
      channels,
      audiences,
      experimentId,
      metrics: metrics || {},
      generalizable: generalizable ?? false,
      applicableConditions,
      validityPeriod,
    });

    return NextResponse.json({
      success: true,
      learning: captured,
    });
  } catch (error) {
    console.error('Error capturing learning:', error);
    return NextResponse.json(
      { error: 'Failed to capture learning' },
      { status: 500 }
    );
  }
}
