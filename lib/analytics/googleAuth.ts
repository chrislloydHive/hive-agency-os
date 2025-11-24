// lib/analytics/googleAuth.ts
// Shared Google OAuth authentication for GA4 and Search Console

import { google } from 'googleapis';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

/**
 * Creates and returns a configured Google OAuth2 client
 * Uses credentials from environment variables
 */
export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required Google OAuth credentials. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your environment variables.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // redirect URI for installed apps
  );

  // Set the refresh token
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Creates and returns a configured GA4 Analytics Data API client
 * Uses OAuth credentials for authentication
 */
export function getGa4Client(): BetaAnalyticsDataClient {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required Google OAuth credentials for GA4. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN.'
    );
  }

  // Create GA4 client with OAuth credentials
  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      type: 'authorized_user',
    },
  });

  return analyticsDataClient;
}

/**
 * Get the GA4 property ID from environment
 */
export function getGa4PropertyId(): string {
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!propertyId) {
    throw new Error(
      'GA4_PROPERTY_ID is not set in environment variables. Please configure it (format: properties/XXXXXXXXX).'
    );
  }

  return propertyId;
}

/**
 * Get the Search Console site URL from environment
 */
export function getSearchConsoleSiteUrl(): string {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;

  if (!siteUrl) {
    throw new Error(
      'SEARCH_CONSOLE_SITE_URL is not set in environment variables. Please configure it (e.g., https://example.com/).'
    );
  }

  return siteUrl;
}
