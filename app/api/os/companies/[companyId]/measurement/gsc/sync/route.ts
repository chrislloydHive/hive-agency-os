// app/api/os/companies/[companyId]/measurement/gsc/sync/route.ts
// GSC Sync API - Refresh GSC data from the connected site

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { syncGscData } from '@/lib/os/integrations/companyGscClient';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * POST /api/os/companies/[companyId]/measurement/gsc/sync
 *
 * Refresh GSC data from the connected site.
 * Requires GSC to be connected first.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected" | "error";
 *   gsc?: GSCIntegration;
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

    // Check if GSC is connected
    const integrations = await getCompanyIntegrations(companyId);
    if (!integrations?.google?.gsc?.connected || !integrations.google.gsc.siteUrl) {
      return NextResponse.json(
        {
          status: 'not_connected',
          error: 'GSC not connected. Connect GSC first.',
        },
        { status: 400 }
      );
    }

    const siteUrl = integrations.google.gsc.siteUrl;
    console.log(`[GSC Sync] Syncing site ${siteUrl} for company ${companyId}`);

    // Do a full sync
    const gscData = await syncGscData(companyId, siteUrl);

    console.log(`[GSC Sync] Successfully synced site ${siteUrl} for company ${companyId}`);

    return NextResponse.json({
      status: 'ok',
      gsc: gscData,
    });
  } catch (error) {
    console.error('[GSC Sync] Error:', error);
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
 * GET /api/os/companies/[companyId]/measurement/gsc/sync
 *
 * Get current GSC connection status and data.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected";
 *   connected: boolean;
 *   gsc?: GSCIntegration;
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
    const gsc = integrations?.google?.gsc;

    if (!gsc?.connected) {
      return NextResponse.json({
        status: 'not_connected',
        connected: false,
      });
    }

    return NextResponse.json({
      status: 'ok',
      connected: true,
      gsc,
    });
  } catch (error) {
    console.error('[GSC Sync] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
