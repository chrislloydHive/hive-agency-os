// app/api/os/companies/[companyId]/measurement/google/route.ts
// Google connection status endpoint

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGoogleConnectionStatus } from '@/lib/airtable/companyIntegrations';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/measurement/google
 *
 * Get Google OAuth and integration connection status.
 *
 * Response:
 * {
 *   connected: boolean;        // Google OAuth connected
 *   ga4Connected: boolean;     // GA4 property selected
 *   gscConnected: boolean;     // GSC site selected
 *   ga4PropertyId?: string;
 *   ga4MeasurementId?: string;
 *   gscSiteUrl?: string;
 *   connectedEmail?: string;
 *   connectedAt?: string;
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get Google connection status
    const status = await getGoogleConnectionStatus(companyId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Google Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
