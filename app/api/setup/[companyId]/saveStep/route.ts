// app/api/setup/[companyId]/saveStep/route.ts
// Save a single step's data to the Context Graph
//
// NOTE: This API route is deprecated. Use the server action from
// app/c/[companyId]/setup/actions.ts instead.

import { NextRequest, NextResponse } from 'next/server';
import { saveSetupStep } from '@/app/c/[companyId]/brain/setup/actions';
import type { SetupFormData, SetupStepId } from '@/app/c/[companyId]/brain/setup/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();
    const { stepId, data } = body as {
      stepId: SetupStepId;
      data: Partial<SetupFormData>;
      companyName: string;
    };

    // Map step ID to form key
    const stepIdToKey: Record<SetupStepId, keyof SetupFormData> = {
      'business-identity': 'businessIdentity',
      'objectives': 'objectives',
      'audience': 'audience',
      'personas': 'personas',
      'website': 'website',
      'media-foundations': 'mediaFoundations',
      'budget-scenarios': 'budgetScenarios',
      'creative-strategy': 'creativeStrategy',
      'measurement': 'measurement',
      'summary': 'summary',
    };

    const stepKey = stepIdToKey[stepId];
    const stepData = data[stepKey];

    if (!stepData) {
      return NextResponse.json(
        { error: 'No data for step' },
        { status: 400 }
      );
    }

    // Use the centralized server action
    const result = await saveSetupStep(
      companyId,
      stepId,
      stepData as Record<string, unknown>
    );

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to save', errors: result.errors },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fieldsWritten: result.fieldsWritten,
      fieldsBlocked: result.fieldsBlocked,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Save step error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
