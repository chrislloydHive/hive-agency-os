/**
 * Google OAuth Refresh Token Generator
 *
 * Run this script to get a refresh token for GA4 and Search Console:
 *
 * npx tsx scripts/get-google-refresh-token.ts
 *
 * Prerequisites:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Create a project (or use existing)
 * 3. Enable APIs:
 *    - Google Analytics Data API
 *    - Google Search Console API
 * 4. Create OAuth 2.0 credentials:
 *    - Go to APIs & Services > Credentials
 *    - Create OAuth client ID (Desktop app type)
 *    - Download the credentials JSON
 *    - Copy client_id and client_secret to your .env.local
 */

import { google } from 'googleapis';
import * as http from 'http';
import open from 'open';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Scopes needed for GA4 and Search Console
const SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

async function main() {
  console.log('\n🔐 Google OAuth Refresh Token Generator\n');
  console.log('─'.repeat(50));

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('\n❌ Missing credentials!');
    console.log('\nPlease set these in your .env.local:');
    console.log('  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
    console.log('  GOOGLE_CLIENT_SECRET=your-client-secret\n');
    console.log('Get these from: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
  }

  console.log('✅ GOOGLE_CLIENT_ID:', CLIENT_ID.substring(0, 20) + '...');
  console.log('✅ GOOGLE_CLIENT_SECRET:', CLIENT_SECRET.substring(0, 10) + '...');

  // Create OAuth client
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    'http://localhost:3333/callback'
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to ensure refresh token is returned
  });

  console.log('\n📋 Scopes requested:');
  SCOPES.forEach(scope => console.log('   -', scope.split('/').pop()));

  // Create a simple server to receive the callback
  return new Promise<void>((resolve) => {
    const server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || '', 'http://localhost:3333');

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.searchParams.get('code');

        if (code) {
          try {
            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>✅ Success!</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);

            console.log('\n' + '─'.repeat(50));
            console.log('✅ Successfully obtained tokens!\n');

            if (tokens.refresh_token) {
              console.log('📋 Add this to your .env.local:\n');
              console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
              console.log('\n' + '─'.repeat(50));
            } else {
              console.log('⚠️  No refresh token returned.');
              console.log('This happens if you already granted access before.');
              console.log('To get a new refresh token:');
              console.log('1. Go to https://myaccount.google.com/permissions');
              console.log('2. Remove access for this app');
              console.log('3. Run this script again');
            }

            server.close();
            resolve();
          } catch (error) {
            console.error('Error exchanging code:', error);
            res.writeHead(500);
            res.end('Error exchanging code');
            server.close();
            resolve();
          }
        }
      }
    });

    server.listen(3333, async () => {
      console.log('\n🌐 Opening browser for Google sign-in...\n');
      console.log('If browser does not open, visit:');
      console.log(authUrl);

      // Try to open the browser
      try {
        await open(authUrl);
      } catch {
        console.log('\n(Could not auto-open browser)');
      }
    });
  });
}

main().catch(console.error);
