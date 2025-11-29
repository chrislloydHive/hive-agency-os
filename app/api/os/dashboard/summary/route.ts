// app/api/os/dashboard/summary/route.ts
// Dashboard summary API for navigation badges

import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Implement actual stats fetching from Airtable
  // For now, return placeholder data to avoid 404s
  return NextResponse.json({
    clientHealth: {
      atRisk: [],
      total: 0,
    },
    work: {
      today: 0,
      thisWeek: 0,
      overdue: 0,
    },
    pipeline: {
      activeOpportunities: 0,
      newLeads: 0,
    },
  });
}
