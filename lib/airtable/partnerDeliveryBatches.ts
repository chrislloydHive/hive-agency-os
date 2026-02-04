// lib/airtable/partnerDeliveryBatches.ts
// Lookup destination folder by Batch ID for partner delivery webhook.

import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

const TABLE = AIRTABLE_TABLES.PARTNER_DELIVERY_BATCHES;

const BATCH_ID_FIELD = 'Batch ID';
const DESTINATION_FOLDER_ID_FIELD = 'Destination Folder ID';

/**
 * Get Destination Folder ID for a delivery batch by Batch ID.
 * Returns null if no record found or field is empty.
 */
export async function getDestinationFolderIdByBatchId(
  batchId: string
): Promise<string | null> {
  const id = String(batchId).trim();
  if (!id) return null;

  const base = getBase();
  const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const formula = `{${BATCH_ID_FIELD}} = "${escaped}"`;
  const records = await base(TABLE)
    .select({ filterByFormula: formula, maxRecords: 1 })
    .firstPage();

  if (records.length === 0) return null;

  const raw = (records[0].fields as Record<string, unknown>)[DESTINATION_FOLDER_ID_FIELD];
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}
