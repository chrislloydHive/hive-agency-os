# Running Inngest Locally for Debugging

## Quick Start

1. **Start your Next.js dev server** (in one terminal):
   ```bash
   npm run dev
   ```
   This will run on `http://localhost:3000`

2. **Start Inngest Dev Server** (in another terminal):
   ```bash
   npm run dev:inngest
   ```
   This will:
   - Start the Inngest Dev Server (usually on `http://localhost:8288`)
   - Open the Inngest Dev UI in your browser
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

- **"Cannot connect to Inngest"**: Make sure both servers are running
- **Functions not showing**: Check that `npm run dev` is running and accessible at `http://localhost:3000`
- **No logs**: Check that your `.env.local` has the required credentials
