// app/api/media/planner/route.ts
// API route for AI media planner - generates plan options
//
// This server-side route handles the generateMediaPlanOptions call
// which requires Airtable access for company MediaProfile data.

import { NextResponse } from 'next/server';
import { generateMediaPlanOptions, type MediaPlannerInput } from '@/lib/media/aiPlanner';

export async function POST(request: Request) {
  try {
    const input: MediaPlannerInput = await request.json();

    // Validate required fields
    if (!input.companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!input.objective) {
      return NextResponse.json(
        { success: false, error: 'objective is required' },
        { status: 400 }
      );
    }

    if (!input.monthlyBudget || input.monthlyBudget <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid monthlyBudget is required' },
        { status: 400 }
      );
    }

    const result = await generateMediaPlanOptions(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Media planner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate plan options'
      },
      { status: 500 }
    );
  }
}
