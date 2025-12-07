// app/api/os/companies/[companyId]/measurement/ga4/sync/route.ts
// GA4 Sync API - Refresh GA4 data from the connected property

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { syncGa4Data } from '@/lib/os/integrations/companyGa4Client';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/measurement/ga4/sync
 *
 * Refresh GA4 data from the connected property.
 * Requires GA4 to be connected first.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected" | "error";
 *   ga4?: GA4Integration;
 *   error?: string;
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check if GA4 is connected
    const integrations = await getCompanyIntegrations(companyId);
    if (!integrations?.google?.ga4?.connected || !integrations.google.ga4.propertyId) {
      return NextResponse.json(
        {
          status: 'not_connected',
          error: 'GA4 not connected. Connect GA4 first.',
        },
        { status: 400 }
      );
    }

    const propertyId = integrations.google.ga4.propertyId;
    console.log(`[GA4 Sync] Syncing property ${propertyId} for company ${companyId}`);

    // Do a full sync
    const ga4Data = await syncGa4Data(companyId, propertyId);

    console.log(`[GA4 Sync] Successfully synced property ${propertyId} for company ${companyId}`);

    return NextResponse.json({
      status: 'ok',
      ga4: ga4Data,
    });
  } catch (error) {
    console.error('[GA4 Sync] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/os/companies/[companyId]/measurement/ga4/sync
 *
 * Get current GA4 connection status and data.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected";
 *   connected: boolean;
 *   ga4?: GA4Integration;
 * }
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { status: 'error', error: 'Company not found' },
        { status: 404 }
      );
    }

    // Get current integration status
    const integrations = await getCompanyIntegrations(companyId);
    const ga4 = integrations?.google?.ga4;

    if (!ga4?.connected) {
      return NextResponse.json({
        status: 'not_connected',
        connected: false,
      });
    }

    return NextResponse.json({
      status: 'ok',
      connected: true,
      ga4,
    });
  } catch (error) {
    console.error('[GA4 Sync] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
