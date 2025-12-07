// app/api/os/companies/[companyId]/measurement/ga4/connect/route.ts
// GA4 Connect API - List available properties and select one

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getCompanyIntegrations, updateGA4Integration } from '@/lib/airtable/companyIntegrations';
import {
  listGa4Properties,
  listGa4DataStreams,
  syncGa4Data,
} from '@/lib/os/integrations/companyGa4Client';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/measurement/ga4/connect
 *
 * List available GA4 properties for selection.
 * Requires Google OAuth to be connected first.
 *
 * Response:
 * {
 *   status: "ok" | "not_connected" | "error";
 *   accounts?: Array<{ name, displayName, properties: Array<{ name, displayName }> }>;
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

    // List available GA4 properties
    console.log(`[GA4 Connect] Listing properties for company ${companyId}`);
    const propertiesResult = await listGa4Properties(companyId);

    if (!propertiesResult) {
      return NextResponse.json(
        { status: 'error', error: 'Failed to list GA4 properties' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      accounts: propertiesResult.accounts,
    });
  } catch (error) {
    console.error('[GA4 Connect] Error:', error);
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
 * POST /api/os/companies/[companyId]/measurement/ga4/connect
 *
 * Connect a specific GA4 property to this company.
 *
 * Request body:
 * {
 *   propertyId: string;  // e.g., "properties/123456789"
 * }
 *
 * Response:
 * {
 *   status: "ok" | "error";
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
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { status: 'error', error: 'propertyId is required' },
        { status: 400 }
      );
    }

    console.log(`[GA4 Connect] Connecting property ${propertyId} to company ${companyId}`);

    // Get data streams to find measurement ID
    const streams = await listGa4DataStreams(companyId, propertyId);
    const webStream = streams?.find((s) => s.webStreamData?.measurementId);

    // Store initial connection
    await updateGA4Integration(companyId, {
      propertyId,
      webStreamId: webStream?.name,
      measurementId: webStream?.webStreamData?.measurementId,
    });

    // Do a full sync to get all data
    const ga4Data = await syncGa4Data(companyId, propertyId);

    console.log(`[GA4 Connect] Successfully connected property ${propertyId} to company ${companyId}`);

    return NextResponse.json({
      status: 'ok',
      ga4: ga4Data,
    });
  } catch (error) {
    console.error('[GA4 Connect] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
