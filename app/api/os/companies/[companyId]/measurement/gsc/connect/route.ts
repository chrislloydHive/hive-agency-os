// app/api/os/companies/[companyId]/measurement/gsc/connect/route.ts
// GSC Connect API - List available sites and select one

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import { listGscSites, syncGscData } from '@/lib/os/integrations/companyGscClient';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/measurement/gsc/connect
 *
 * List available GSC sites for selection.
 * Requires Google OAuth to be connected first.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected" | "error";
 *   sites?: Array<{ siteUrl, permissionLevel }>;
 *   error?: string;
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

    // Check if Google is connected
    const integrations = await getCompanyIntegrations(companyId);
    if (!integrations?.google?.connected || !integrations.google.refreshToken) {
      return NextResponse.json(
        {
          status: 'not_connected',
          error: 'Google OAuth not connected. Connect Google first.',
        },
        { status: 400 }
      );
    }

    // List available GSC sites
    console.log(`[GSC Connect] Listing sites for company ${companyId}`);
    const sites = await listGscSites(companyId);

    if (!sites) {
      return NextResponse.json(
        { status: 'error', error: 'Failed to list GSC sites' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      sites,
    });
  } catch (error) {
    console.error('[GSC Connect] Error:', error);
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
 * POST /api/os/companies/[companyId]/measurement/gsc/connect
 *
 * Connect a specific GSC site to this company.
 *
 * Request body:
 * {
 *   siteUrl: string;  // e.g., "https://example.com/"
 * }
 *
 * Response:
 * {
 *   status: "ok" | "error";
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

    // Check if Google is connected
    const integrations = await getCompanyIntegrations(companyId);
    if (!integrations?.google?.connected || !integrations.google.refreshToken) {
      return NextResponse.json(
        {
          status: 'not_connected',
          error: 'Google OAuth not connected. Connect Google first.',
        },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { siteUrl } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { status: 'error', error: 'siteUrl is required' },
        { status: 400 }
      );
    }

    console.log(`[GSC Connect] Connecting site ${siteUrl} to company ${companyId}`);

    // Do a full sync
    const gscData = await syncGscData(companyId, siteUrl);

    console.log(`[GSC Connect] Successfully connected site ${siteUrl} to company ${companyId}`);

    return NextResponse.json({
      status: 'ok',
      gsc: gscData,
    });
  } catch (error) {
    console.error('[GSC Connect] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
