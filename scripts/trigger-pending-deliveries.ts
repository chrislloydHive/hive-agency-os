#!/usr/bin/env tsx
// scripts/trigger-pending-deliveries.ts
// Manually trigger the pending deliveries worker
// Usage: tsx scripts/trigger-pending-deliveries.ts

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.local') });

import { runPendingDeliveries } from '@/lib/delivery/runPendingDeliveries';

async function main() {
  console.log('🚀 Triggering pending deliveries worker...\n');
  
  try {
    const result = await runPendingDeliveries({ oidcToken: undefined });
    
    console.log('\n✅ Worker completed:');
    console.log(`   Processed: ${result.processed}`);
    console.log(`   Succeeded: ${result.succeeded}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Skipped: ${result.skipped}`);
    
    if (result.results.length > 0) {
      console.log('\n📋 Results:');
      for (const r of result.results) {
        if (r.ok) {
          console.log(`   ✅ ${r.recordId}: ${r.deliveredFileUrl ? `Delivered → ${r.deliveredFileUrl}` : 'Already delivered (idempotent)'}`);
        } else {
          console.log(`   ❌ ${r.recordId}: ${r.error}`);
        }
      }
    }
    
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const errorObj = err && typeof err === 'object' ? err as Record<string, unknown> : null;
    
    console.error('\n❌ Worker failed:', message);
    
    if (errorObj) {
      if (errorObj.statusCode === 403 || errorObj.error === 'NOT_AUTHORIZED') {
        console.error('\n💡 This looks like an Airtable permissions issue.');
        console.error('   Check that your Airtable API token has read access to:');
        console.error('   - Creative Review Asset Status table');
        console.error('   - Partner Delivery Batches table');
        console.error('\n   Also check Google Drive service account permissions if the error occurs during Drive operations.');
      }
    }
    
    if (stack) console.error('\nStack trace:', stack);
    process.exit(1);
  }
}

main();
