# Running Inngest Locally for Debugging

## Quick Start

1. **Start your Next.js dev server** (in one terminal):
   ```bash
   npm run dev
   ```
   This will run on `http://localhost:3000`
   
   **Verify it's working**: Open `http://localhost:3000/api/inngest` in your browser. You should see a JSON response with `function_count: 16`.

2. **Start Inngest Dev Server** (in another terminal):
   ```bash
   npm run dev:inngest
   ```
   
   **If that doesn't work, try specifying the URL explicitly:**
   ```bash
   npx inngest-cli@latest dev --url http://localhost:3000/api/inngest
   ```
   
   This will:
   - Start the Inngest Dev Server (usually on `http://localhost:8288`)
   - Open the Inngest Dev UI in your browser automatically
   - Connect to your local Next.js app at `http://localhost:3000/api/inngest`

## What You'll See

The Inngest Dev UI shows:
- **Functions**: All registered Inngest functions (including `runPendingDeliveriesScheduled`)
- **Events**: Events being sent to Inngest
- **Runs**: Function execution history with detailed logs
- **Logs**: Real-time logs from function executions

## Debugging Delivery Worker

1. Open the Inngest Dev UI (usually `http://localhost:8288`)
2. Navigate to **Functions** → `partner-delivery-run-pending`
3. You can:
   - **Trigger manually**: Click "Run" to trigger the function immediately
   - **View logs**: See detailed logs from `runPendingDeliveries` including:
     - How many records were found
     - Which records are being processed
     - WIF/ADC authentication errors
     - Delivery success/failure details
   - **Inspect runs**: See the full execution history

## Environment Variables

Make sure your `.env.local` has:
- `INNGEST_EVENT_KEY` (optional for local dev, but needed for production)
- All Airtable credentials (`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, etc.)
- Google credentials (`GOOGLE_APPLICATION_CREDENTIALS_JSON`, etc.)

## Troubleshooting

- **"Cannot connect to Inngest"**: 
  - Make sure both servers are running
  - Verify `http://localhost:3000/api/inngest` returns JSON (not 404)
  - Try explicitly specifying the URL: `npx inngest-cli@latest dev --url http://localhost:3000/api/inngest`
  
- **Functions not showing**: 
  - Check that `npm run dev` is running and accessible at `http://localhost:3000`
  - Verify the `/api/inngest` endpoint shows `function_count: 16` in the response
  - Check the Inngest dev server terminal for connection errors
  
- **Dev UI not opening**: 
  - Manually open `http://localhost:8288` in your browser
  - Check the terminal output for the actual URL (it might be different)
  
- **No logs**: 
  - Check that your `.env.local` has the required credentials
  - Make sure you're looking at the correct function in the Inngest Dev UI
  - Check both the Next.js terminal (for `console.log`) and Inngest Dev UI (for function runs)

- **"authentication_succeeded: null"**: This is normal in dev mode - authentication is optional for local development
