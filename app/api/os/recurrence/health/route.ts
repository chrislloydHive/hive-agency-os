// app/api/os/recurrence/health/route.ts
// Recurrence Health / SLO API
//
// GET: Get recurrence system health summary

import { NextRequest, NextResponse } from 'next/server';
import {
  getRecurrenceHealthSummary,
  getRecurrenceWarning,
  getRecentJobs,
} from '@/lib/os/programs/recurrenceHealth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeJobs = searchParams.get('includeJobs') === 'true';
    const jobLimit = parseInt(searchParams.get('jobLimit') || '10', 10);

    const health = getRecurrenceHealthSummary();
    const warning = getRecurrenceWarning();

    const response: {
      success: boolean;
      health: typeof health;
      warning: typeof warning;
      recentJobs?: ReturnType<typeof getRecentJobs>;
    } = {
      success: true,
      health,
      warning,
    };

    if (includeJobs) {
      response.recentJobs = getRecentJobs({ limit: jobLimit });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Recurrence Health GET] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
