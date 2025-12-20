// app/api/pipeline/opportunity-score/route.ts
// @deprecated - Opportunity scoring has been deprecated in favor of Airtable-managed Deal Health
// This route is kept for backwards compatibility but does nothing.

import { NextResponse } from 'next/server';

export const maxDuration = 5;

/**
 * @deprecated Opportunity scoring is no longer computed by the OS.
 * Deal Health is now managed directly in Airtable.
 * This endpoint returns a no-op response for backwards compatibility.
 */
export async function POST() {
  console.warn('[OpportunityScore] DEPRECATED: Opportunity scoring has been disabled. Use Airtable Deal Health instead.');

  return NextResponse.json(
    {
      deprecated: true,
      message: 'Opportunity scoring has been deprecated. Deal Health is now managed in Airtable.',
      score: null,
      explanation: null,
    },
    { status: 410 } // Gone - resource no longer available
  );
}
