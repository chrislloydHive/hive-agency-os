// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient, ensureCrasRecord, DELIVERY_BATCH_ID_FIELD } from '@/lib/airtable/reviewAssetStatus';
import { getBase } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';

// Field name for Source Folder ID (matches reviewAssetStatus.ts)
const SOURCE_FOLDER_ID_FIELD = 'Source Folder ID';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function POST(req: NextRequest) {
  let body: {
    token?: string;
    driveFileId?: string;
    fileId?: string;
    approvedAt?: string;
    approvedByName?: string;
    approvedByEmail?: string;
    deliveryBatchId?: string | null;
    tactic?: string;
    variant?: string;
    filename?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const token = (body.token ?? '').toString().trim();
  const driveFileId = (body.driveFileId ?? body.fileId ?? '').toString().trim();
  const approvedAt = resolveApprovedAt(body.approvedAt);
  const approvedByName = (body.approvedByName ?? '').toString().trim() || undefined;
  const approvedByEmail = (body.approvedByEmail ?? '').toString().trim() || undefined;
  
  // Debug: Log raw deliveryBatchId from body
  console.log(`[approve] Raw body.deliveryBatchId:`, body.deliveryBatchId, `type:`, typeof body.deliveryBatchId);
  const deliveryBatchId = body.deliveryBatchId != null ? String(body.deliveryBatchId).trim() || undefined : undefined;
  console.log(`[approve] Parsed deliveryBatchId:`, deliveryBatchId);
  
  const tactic = (body.tactic ?? '').toString().trim() || undefined;
  const variant = (body.variant ?? '').toString().trim() || undefined;
  const filename = (body.filename ?? '').toString().trim() || undefined;

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }
  if (!driveFileId) {
    return NextResponse.json({ error: 'Missing driveFileId or fileId' }, { status: 400 });
  }

  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  if (tactic && variant) {
    await ensureCrasRecord({
      token,
      projectId: resolved.project.recordId,
      driveFileId,
      filename,
      tactic,
      variant,
    });
  }

  // Use deliveryBatchId from request if provided
  let finalDeliveryBatchId = deliveryBatchId;
  if (finalDeliveryBatchId) {
    console.log(`[approve] Using deliveryBatchId from request: ${finalDeliveryBatchId}`);
  }

  const result = await setSingleAssetApprovedClient({
    token,
    driveFileId,
    approvedAt,
    approvedByName,
    approvedByEmail,
    deliveryBatchId: finalDeliveryBatchId ?? undefined,
  });

  if ('error' in result) {
    const status = result.error === 'Record not found' ? 404 : 500;
    const payload: { error: string; airtableError?: unknown } = { error: result.error };
    if (result.airtableError !== undefined) payload.airtableError = result.airtableError;
    return NextResponse.json(payload, { status, headers: NO_STORE });
  }

  // Fetch deliveryBatchId from CRAS record AFTER approval (if not in request)
  // Airtable automation/formula may set it during/after approval write
  if (!finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] deliveryBatchId not in request, fetching from CRAS record AFTER approval`);
    try {
      const base = getBase();
      const record = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(result.recordId);
      const fields = record.fields as Record<string, unknown>;
      
      // Debug: Log all field names to see what's actually available
      const fieldNames = Object.keys(fields);
      console.log(`[approve] CRAS record ${result.recordId} has ${fieldNames.length} fields:`, fieldNames.sort().join(', '));
      
      // Check for variations of the field name (case/spacing)
      const partnerBatchVariations = [
        'Partner Delivery Batch',
        'partner delivery batch',
        'PartnerDeliveryBatch',
        'Partner Delivery Batch ID',
        'Delivery Batch',
      ];
      for (const variant of partnerBatchVariations) {
        if (fields[variant] !== undefined) {
          console.log(`[approve] Found field "${variant}":`, fields[variant], `type:`, typeof fields[variant]);
        }
      }
      
      // First check: "Partner Delivery Batch" linked record on CRAS
      const partnerBatchLink = fields['Partner Delivery Batch'] as string[] | undefined;
      console.log(`[approve] CRAS Partner Delivery Batch link:`, partnerBatchLink, `type:`, typeof partnerBatchLink, `isArray:`, Array.isArray(partnerBatchLink));
      if (Array.isArray(partnerBatchLink) && partnerBatchLink.length > 0) {
        const batchRecordId = partnerBatchLink[0];
        console.log(`[approve] Found CRAS Partner Delivery Batch link: ${batchRecordId}`);
        try {
          const { AIRTABLE_TABLES: TABLES } = await import('@/lib/airtable/tables');
          const batchRecord = await base(TABLES.PARTNER_DELIVERY_BATCHES).find(batchRecordId);
          const batchFields = batchRecord.fields as Record<string, unknown>;
          const batchId = typeof batchFields['Batch ID'] === 'string' ? (batchFields['Batch ID'] as string).trim() : null;
          if (batchId) {
            finalDeliveryBatchId = batchId;
            console.log(`[approve] ✅ Extracted deliveryBatchId from CRAS Partner Delivery Batch link: ${finalDeliveryBatchId}`);
          } else {
            console.log(`[approve] ⚠️ CRAS Partner Delivery Batch record ${batchRecordId} has no Batch ID field`);
          }
        } catch (batchErr) {
          const batchErrMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
          console.error(`[approve] ❌ Failed to fetch Batch ID from CRAS Partner Delivery Batch link:`, batchErrMsg);
        }
      }
      
      // Second check: "Delivery Batch ID" text field on CRAS (if not found via link)
      if (!finalDeliveryBatchId) {
        // Check for variations of Delivery Batch ID field name
        const deliveryBatchIdVariations = [
          'Delivery Batch ID',
          'delivery batch id',
          'DeliveryBatchID',
          'Delivery Batch Id',
        ];
        let batchRaw: unknown = undefined;
        let foundFieldName: string | undefined = undefined;
        for (const variant of deliveryBatchIdVariations) {
          if (fields[variant] !== undefined) {
            batchRaw = fields[variant];
            foundFieldName = variant;
            console.log(`[approve] Found Delivery Batch ID field "${variant}":`, batchRaw, `type:`, typeof batchRaw);
            break;
          }
        }
        if (!foundFieldName) {
          batchRaw = fields[DELIVERY_BATCH_ID_FIELD];
        }
        console.log(`[approve] Fetched CRAS record ${result.recordId} after approval, checking field "${foundFieldName || DELIVERY_BATCH_ID_FIELD}"`);
        console.log(`[approve] Raw batch field value:`, batchRaw, `type:`, typeof batchRaw, `isArray:`, Array.isArray(batchRaw));
        
        if (Array.isArray(batchRaw) && batchRaw.length > 0 && typeof batchRaw[0] === 'string') {
          finalDeliveryBatchId = (batchRaw[0] as string).trim();
          console.log(`[approve] ✅ Extracted deliveryBatchId from CRAS array AFTER approval: ${finalDeliveryBatchId}`);
        } else if (typeof batchRaw === 'string' && batchRaw.trim()) {
          finalDeliveryBatchId = (batchRaw as string).trim();
          console.log(`[approve] ✅ Extracted deliveryBatchId from CRAS string AFTER approval: ${finalDeliveryBatchId}`);
        } else {
          console.log(`[approve] ⚠️ CRAS Delivery Batch ID field is still empty/null AFTER approval:`, batchRaw);
          
          // Fallback: Try fetching from Project record (automation might be async)
          // Use resolved.project.recordId directly (we already have it from earlier)
          // Match the logic from getDeliveryContextByProjectId: check linked "Partner Delivery Batch" first, then "Delivery Batch ID" text field
          const projectId = resolved?.project?.recordId;
          console.log(`[approve] Using projectId from resolved project:`, projectId);
          if (projectId) {
            console.log(`[approve] Attempting fallback: fetching Delivery Batch ID from Project record ${projectId}`);
            try {
              const { AIRTABLE_TABLES } = await import('@/lib/airtable/tables');
              const projectRecord = await base(AIRTABLE_TABLES.PROJECTS).find(projectId);
              const fields = projectRecord.fields as Record<string, unknown>;
              
              // First check: "Partner Delivery Batch" linked record
              const partnerBatchLink = fields['Partner Delivery Batch'] as string[] | undefined;
              console.log(`[approve] Project Partner Delivery Batch link:`, partnerBatchLink, `type:`, typeof partnerBatchLink, `isArray:`, Array.isArray(partnerBatchLink));
              if (Array.isArray(partnerBatchLink) && partnerBatchLink.length > 0) {
                const batchRecordId = partnerBatchLink[0];
                console.log(`[approve] Found Partner Delivery Batch link: ${batchRecordId}`);
                try {
                  const { AIRTABLE_TABLES: TABLES } = await import('@/lib/airtable/tables');
                  const batchRecord = await base(TABLES.PARTNER_DELIVERY_BATCHES).find(batchRecordId);
                  const batchFields = batchRecord.fields as Record<string, unknown>;
                  const batchId = typeof batchFields['Batch ID'] === 'string' ? (batchFields['Batch ID'] as string).trim() : null;
                  if (batchId) {
                    finalDeliveryBatchId = batchId;
                    console.log(`[approve] ✅ Extracted deliveryBatchId from Partner Delivery Batch link: ${finalDeliveryBatchId}`);
                  } else {
                    console.log(`[approve] ⚠️ Partner Delivery Batch record ${batchRecordId} has no Batch ID field`);
                  }
                } catch (batchErr) {
                  const batchErrMsg = batchErr instanceof Error ? batchErr.message : String(batchErr);
                  console.error(`[approve] ❌ Failed to fetch Batch ID from linked Partner Delivery Batch:`, batchErrMsg);
                }
              }
              
              // Second check: "Delivery Batch ID" text field (if not found via link)
              if (!finalDeliveryBatchId) {
                const projectBatchRaw = fields['Delivery Batch ID'];
                console.log(`[approve] Project record Delivery Batch ID (text):`, projectBatchRaw, `type:`, typeof projectBatchRaw);
                
                if (Array.isArray(projectBatchRaw) && projectBatchRaw.length > 0 && typeof projectBatchRaw[0] === 'string') {
                  finalDeliveryBatchId = (projectBatchRaw[0] as string).trim();
                  console.log(`[approve] ✅ Extracted deliveryBatchId from Project array: ${finalDeliveryBatchId}`);
                } else if (typeof projectBatchRaw === 'string' && projectBatchRaw.trim()) {
                  finalDeliveryBatchId = (projectBatchRaw as string).trim();
                  console.log(`[approve] ✅ Extracted deliveryBatchId from Project string: ${finalDeliveryBatchId}`);
                } else {
                  console.log(`[approve] ⚠️ Project record also has no Delivery Batch ID`);
                }
              }
            } catch (projectErr) {
              const projectErrMsg = projectErr instanceof Error ? projectErr.message : String(projectErr);
              console.error(`[approve] ❌ Failed to fetch Delivery Batch ID from Project:`, projectErrMsg);
            }
          } else {
            console.log(`[approve] ⚠️ No projectId available, cannot fetch from Project`);
          }
        }
      }
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(`[approve] ❌ Failed to fetch deliveryBatchId from record after approval:`, errMsg);
      if (fetchErr instanceof Error && fetchErr.stack) {
        console.error(`[approve] Error stack:`, fetchErr.stack);
      }
    }
  }
  
  console.log(`[approve] Final deliveryBatchId after approval: ${finalDeliveryBatchId || 'undefined'}`);

  if ('alreadyApproved' in result) {
    // Still trigger delivery if batchId is set (idempotency will handle duplicates)
    if (finalDeliveryBatchId && 'recordId' in result) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        fetch(`${baseUrl}/api/delivery/partner/approved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            crasRecordId: result.recordId,
            batchId: finalDeliveryBatchId,
          }),
        }).catch((err) => {
          console.error('[approve] Failed to trigger delivery (already approved):', err);
        });
      } catch (err) {
        console.error('[approve] Error triggering delivery (already approved):', err);
      }
    }
    return NextResponse.json(
      { ok: true, alreadyApproved: true },
      { headers: NO_STORE }
    );
  }

  // Trigger delivery via event-driven endpoint (if deliveryBatchId is set)
  if (finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] Triggering delivery: crasRecordId=${result.recordId}, batchId=${finalDeliveryBatchId}`);
    try {
      // Fire-and-forget: call delivery endpoint asynchronously
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const deliveryUrl = `${baseUrl}/api/delivery/partner/approved`;
      console.log(`[approve] Calling delivery endpoint: ${deliveryUrl}`);
      fetch(deliveryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crasRecordId: result.recordId,
          batchId: finalDeliveryBatchId,
        }),
      })
        .then(async (res) => {
          const text = await res.text();
          if (res.ok) {
            console.log(`[approve] Delivery triggered successfully: ${text}`);
          } else {
            console.error(`[approve] Delivery endpoint returned ${res.status}: ${text}`);
          }
        })
        .catch((err) => {
          console.error('[approve] Failed to trigger delivery:', err);
        });
    } catch (err) {
      // Non-blocking: log error but don't fail the approval
      console.error('[approve] Error triggering delivery:', err);
    }
  } else {
    if (!finalDeliveryBatchId) {
      console.log(`[approve] No deliveryBatchId available (not in request and not in record), skipping delivery trigger`);
    }
    if (!('recordId' in result)) {
      console.log(`[approve] No recordId in result, skipping delivery trigger`);
    }
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
