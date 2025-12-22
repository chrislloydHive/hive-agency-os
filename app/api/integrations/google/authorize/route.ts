// app/api/integrations/google/authorize/route.ts
// Google OAuth Authorization Endpoint
//
// GET - Initiates Google OAuth flow with GA4 + GSC scopes
//
// Query params:
//   companyId: string (required) - Company to associate the connection with
//   redirect?: string (optional) - URL to redirect to after callback

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCompanyById } from '@/lib/airtable/companies';

const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit', // For Admin API - list accounts/properties
  'https://www.googleapis.com/auth/webmasters.readonly',
];

/**
 * GET /api/integrations/google/authorize
 *
 * Initiates Google OAuth flow for GA4 + GSC access.
 *
 * Query params:
 * - companyId (required): The company to associate this connection with
 * - redirect (optional): Where to redirect after successful auth (defaults to setup page)
 *
 * Returns: Redirect to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const redirectUrl = searchParams.get('redirect');

    // Validate companyId
    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Check for required env vars
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Google OAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Determine callback URL based on environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/api/integrations/google/callback`;

    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      callbackUrl
    );

    // Build state parameter with companyId and optional redirect
    const state = JSON.stringify({
      companyId,
      redirect: redirectUrl || `/c/${companyId}/brain/setup?step=9`,
    });

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent to ensure refresh token is returned
      state: Buffer.from(state).toString('base64'),
    });

    console.log(`[Google OAuth] Redirecting company ${companyId} to Google consent`);

    // Redirect to Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[Google OAuth] Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth' },
      { status: 500 }
    );
  }
}
