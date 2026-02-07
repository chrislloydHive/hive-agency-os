// app/api/delivery/diagnose/route.ts
// GET: Diagnostic endpoint to check why delivery isn't working
// Shows CRAS records and their delivery status

import { NextRequest, NextResponse } from 'next/server';
import { getBase } from '@/lib/airtable';
import { READY_TO_DELIVER_WEBHOOK_FIELD, DELIVERY_BATCH_ID_FIELD, DELIVERED_AT_FIELD } from '@/lib/airtable/reviewAssetStatus';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';

const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(req: NextRequest) {
  try {
    const base = getBase();
    
    // Get all records with Ready to Deliver (Webhook) = TRUE
    const readyRecords = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE)
      .select({
        filterByFormula: `{${READY_TO_DELIVER_WEBHOOK_FIELD}} = TRUE()`,
        maxRecords: 100,
      })
      .all();

    const diagnostics = readyRecords.map((record) => {
      const fields = record.fields as Record<string, unknown>;
      const sourceFolderId = typeof fields[SOURCE_FOLDER_ID_FIELD] === 'string' ? (fields[SOURCE_FOLDER_ID_FIELD] as string).trim() : '';
      const deliveredAt = typeof fields[DELIVERED_AT_FIELD] === 'string' ? (fields[DELIVERED_AT_FIELD] as string).trim() : '';
      const batchRaw = fields[DELIVERY_BATCH_ID_FIELD];
      let deliveryBatchId = '';
      if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
        deliveryBatchId = (batchRaw[0] as string).trim();
      } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
        deliveryBatchId = (batchRaw as string).trim();
      }

      const issues: string[] = [];
      if (!sourceFolderId) issues.push('Missing Source Folder ID');
      if (!deliveryBatchId) issues.push('Missing Delivery Batch ID');
      if (deliveredAt) issues.push('Already delivered (has Delivered At)');

      return {
        recordId: record.id,
        sourceFolderId: sourceFolderId || null,
        deliveryBatchId: deliveryBatchId || null,
        deliveredAt: deliveredAt || null,
        issues,
        wouldBeProcessed: sourceFolderId && deliveryBatchId && !deliveredAt,
      };
    });

    const wouldBeProcessed = diagnostics.filter((d) => d.wouldBeProcessed);
    const blocked = diagnostics.filter((d) => !d.wouldBeProcessed);

    return NextResponse.json(
      {
        summary: {
          totalWithFlag: readyRecords.length,
          wouldBeProcessed: wouldBeProcessed.length,
          blocked: blocked.length,
        },
        wouldBeProcessed,
        blocked,
      },
      { headers: NO_STORE }
    );
  } catch (error) {
    console.error('[delivery/diagnose] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to diagnose' },
      { status: 500, headers: NO_STORE }
    );
  }
}
