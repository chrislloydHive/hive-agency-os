// app/api/review/assets/approve/route.ts
// POST: Set Asset Approved (Client) = true for a single asset. Optionally sets Approved At
// from client so the timestamp reflects when the user clicked (avoids automation timezone skew).

import { NextRequest, NextResponse } from 'next/server';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { resolveApprovedAt } from '@/lib/review/approvedAt';
import { setSingleAssetApprovedClient, ensureCrasRecord } from '@/lib/airtable/reviewAssetStatus';
import { getBase, getBaseId } from '@/lib/airtable';
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

  // Resolve deliveryBatchId from CRAS Project link → Partner Delivery Batches query
  if (!finalDeliveryBatchId && 'recordId' in result) {
    console.log(`[approve] deliveryBatchId not in request, resolving from CRAS Project link`);
    try {
      const base = getBase();
      const baseId = getBaseId() || 'unknown';
      const record = await base(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(result.recordId);
      const fields = record.fields as Record<string, unknown>;
      
      // Get Project linked record(s) from CRAS
      const projectField = fields['Project'] as string[] | string | undefined;
      const projectIds = Array.isArray(projectField) ? projectField : (typeof projectField === 'string' ? [projectField] : []);
      
      if (projectIds.length === 0) {
        console.error(`[approve] ❌ CRAS record ${result.recordId} has no Project link`);
      } else {
        // Use the first Project ID (CRAS should only link to one Project)
        const projectId = projectIds[0];
        console.log(`[approve] CRAS record ${result.recordId} links to Project: ${projectId}`);
        
        // Query Partner Delivery Batches table in the same base as CRAS
        const { AIRTABLE_TABLES: TABLES } = await import('@/lib/airtable/tables');
        const tableName = TABLES.PARTNER_DELIVERY_BATCHES;
        const projectLinkField = 'Project'; // Field name in Partner Delivery Batches table
        
        // Escape projectId for formula
        const escapedProjectId = projectId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const formula = `FIND("${escapedProjectId}", ARRAYJOIN({${projectLinkField}})) > 0`;
        
        console.log(`[approve] Querying Partner Delivery Batches:`, {
          baseId: `${baseId.substring(0, 20)}...`,
          tableName,
          projectId,
          formula,
        });
        
        try {
          const records = await base(tableName)
            .select({ filterByFormula: formula })
            .all();
          
          console.log(`[approve] Found ${records.length} Partner Delivery Batch(es) linked to Project ${projectId}`);
          
          if (records.length === 0) {
            console.error(`[approve] ❌ No Partner Delivery Batches found:`, {
              crasRecordId: result.recordId,
              projectId,
              baseId: `${baseId.substring(0, 20)}...`,
              tableName,
              formula,
            });
          } else {
            // Map records to batch items with Batch ID
            const batches: Array<{ batchId: string; status: string; createdTime: string; recordId: string }> = [];
            for (const rec of records) {
              const batchFields = rec.fields as Record<string, unknown>;
              const batchIdRaw = batchFields['Batch ID'];
              const batchId = typeof batchIdRaw === 'string' && batchIdRaw.trim() ? batchIdRaw.trim() : null;
              if (batchId) {
                const statusRaw = batchFields['Status'] ?? batchFields['Delivery Status'];
                const status = typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim().toLowerCase() : '';
                const createdTime = typeof (rec as { createdTime?: string }).createdTime === 'string'
                  ? (rec as { createdTime: string }).createdTime
                  : '';
                batches.push({ batchId, status, createdTime, recordId: rec.id });
              }
            }
            
            if (batches.length === 0) {
              console.error(`[approve] ❌ Partner Delivery Batch records found but none have Batch ID field`);
            } else {
              // Sort deterministically: Active status first, then newest Created time, else first
              batches.sort((a, b) => {
                const aActive = a.status === 'active' ? 0 : 1;
                const bActive = b.status === 'active' ? 0 : 1;
                if (aActive !== bActive) return aActive - bActive;
                const aTime = a.createdTime ? new Date(a.createdTime).getTime() : 0;
                const bTime = b.createdTime ? new Date(b.createdTime).getTime() : 0;
                return bTime - aTime; // Newest first
              });
              
              finalDeliveryBatchId = batches[0].batchId;
              console.log(`[approve] ✅ Resolved deliveryBatchId from Partner Delivery Batch: ${finalDeliveryBatchId}`, {
                selectedBatch: batches[0].recordId,
                status: batches[0].status,
                totalMatches: batches.length,
              });
            }
          }
        } catch (queryErr) {
          const queryErrMsg = queryErr instanceof Error ? queryErr.message : String(queryErr);
          console.error(`[approve] ❌ Failed to query Partner Delivery Batches:`, {
            crasRecordId: result.recordId,
            projectId,
            baseId: `${baseId.substring(0, 20)}...`,
            tableName,
            formula,
            error: queryErrMsg,
          });
        }
      }
    } catch (fetchErr) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.error(`[approve] ❌ Failed to resolve deliveryBatchId:`, errMsg);
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
