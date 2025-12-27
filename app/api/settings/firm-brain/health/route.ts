// app/api/settings/firm-brain/health/route.ts
// Firm Brain Health Check API

import { NextResponse } from 'next/server';
import { getFirmBrainSnapshot } from '@/lib/airtable/firmBrain';
import { computeFirmBrainHealth } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/firm-brain/health
 * Get the health status of the Firm Brain configuration
 * Used to determine if RFP generation can proceed
 */
export async function GET() {
  try {
    const snapshot = await getFirmBrainSnapshot();
    const health = computeFirmBrainHealth(snapshot);

    return NextResponse.json({
      health,
      counts: {
        teamMembers: snapshot.teamMembers.length,
        caseStudies: snapshot.caseStudies.length,
        references: snapshot.references.length,
        pricingTemplates: snapshot.pricingTemplates.length,
        planTemplates: snapshot.planTemplates.length,
      },
      snapshotAt: snapshot.snapshotAt,
    });
  } catch (error) {
    console.error('[firm-brain/health] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to compute Firm Brain health' },
      { status: 500 }
    );
  }
}
