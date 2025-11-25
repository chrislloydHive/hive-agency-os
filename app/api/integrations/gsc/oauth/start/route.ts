// app/api/integrations/gsc/oauth/start/route.ts
// Start Google Search Console OAuth flow

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Google Search Console required scope
const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Get the callback URL from the request origin
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/integrations/gsc/oauth/callback`;

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate the authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required for refresh token
      prompt: 'consent', // Force consent to get refresh token
      scope: GSC_SCOPES,
      state: JSON.stringify({
        workspaceId: 'hive-os', // For now, single workspace
        timestamp: Date.now(),
      }),
    });

    // Redirect to Google's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[GSC OAuth Start] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start OAuth flow' },
      { status: 500 }
    );
  }
}
