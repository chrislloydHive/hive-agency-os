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
        // Note: Airtable formulas resolve {Project} to primary field values (names), not record IDs
        // So we query with a coarse server-side filter, then filter client-side by record ID
        const { AIRTABLE_TABLES: TABLES } = await import('@/lib/airtable/tables');
        const tableName = TABLES.PARTNER_DELIVERY_BATCHES;
        const projectLinkField = 'Project';
        
        // Optional coarse server-side filter for performance (Active or Delivering batches)
        const coarseFormula = 'OR({Status}="Active",{Status}="Delivering")';
        
        console.log(`[approve] Querying Partner Delivery Batches:`, {
          baseId: `${baseId.substring(0, 20)}...`,
          tableName,
          projectId,
          coarseFormula,
        });
        
        try {
          // Query with coarse filter (or no filter if we want all batches)
          const records = await base(tableName)
            .select({ filterByFormula: coarseFormula })
            .all();
          
          console.log(`[approve] Found ${records.length} Partner Delivery Batch(es) (coarse filter)`);
          
          // Filter client-side: keep only batches where Project linked record array includes projectId
          const batches: Array<{ batchId: string; status: string; createdTime: string; recordId: string }> = [];
          for (const rec of records) {
            const batchFields = rec.fields as Record<string, unknown>;
            
            // Check if Project linked record array includes our projectId
            const projectField = batchFields[projectLinkField];
            const projectArray = Array.isArray(projectField) ? projectField : [];
            if (!projectArray.includes(projectId)) {
              continue; // Skip batches not linked to this project
            }
            
            // Extract Batch ID
            const batchIdRaw = batchFields['Batch ID'];
            const batchId = typeof batchIdRaw === 'string' && batchIdRaw.trim() ? batchIdRaw.trim() : null;
            if (!batchId) {
              continue; // Skip batches without Batch ID
            }
            
            // Extract status
            const statusRaw = batchFields['Status'] ?? batchFields['Delivery Status'];
            const status = typeof statusRaw === 'string' && statusRaw.trim() ? statusRaw.trim() : '';
            
            // Extract created time
            const recWithTime = rec as unknown as { id: string; fields: Record<string, unknown>; createdTime?: string };
            const createdTime = typeof recWithTime.createdTime === 'string' ? recWithTime.createdTime : '';
            
            // Also check for "Batch Created At" field if createdTime is missing
            const batchCreatedAtRaw = batchFields['Batch Created At'];
            const batchCreatedAt = typeof batchCreatedAtRaw === 'string' && batchCreatedAtRaw.trim() ? batchCreatedAtRaw.trim() : '';
            const finalCreatedTime = createdTime || batchCreatedAt;
            
            batches.push({ batchId, status, createdTime: finalCreatedTime, recordId: rec.id });
          }
          
          console.log(`[approve] Filtered to ${batches.length} batch(es) linked to Project ${projectId}`);
          
          if (batches.length === 0) {
            console.error(`[approve] ❌ No Partner Delivery Batches found linked to Project:`, {
              crasRecordId: result.recordId,
              projectId,
              baseId: `${baseId.substring(0, 20)}...`,
              tableName,
              batchesScanned: records.length,
            });
          } else {
            // Sort deterministically: Active first, then Delivering, then newest Created time
            batches.sort((a, b) => {
              // Status priority: Active (0) > Delivering (1) > others (2)
              const statusPriority = (s: string) => {
                const lower = s.toLowerCase();
                if (lower === 'active') return 0;
                if (lower === 'delivering') return 1;
                return 2;
              };
              const aPriority = statusPriority(a.status);
              const bPriority = statusPriority(b.status);
              if (aPriority !== bPriority) return aPriority - bPriority;
              
              // Then by newest Created time
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
        } catch (queryErr) {
          const queryErrMsg = queryErr instanceof Error ? queryErr.message : String(queryErr);
          console.error(`[approve] ❌ Failed to query Partner Delivery Batches:`, {
            crasRecordId: result.recordId,
            projectId,
            baseId: `${baseId.substring(0, 20)}...`,
            tableName,
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

  // Generate requestId for correlation tracing
  let requestId: string | undefined = undefined;
  if ('recordId' in result) {
    requestId = `approved-${result.recordId}-${Date.now()}`;
    console.log(`[approve] requestId=${requestId}`);
  }

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
            requestId,
          }),
        })
          .then(async (res) => {
            const text = await res.text();
            const textPreview = text.length > 500 ? text.substring(0, 500) + '...' : text;
            console.log(`[approve] delivery endpoint response`, { requestId, status: res.status, ok: res.ok, textPreview });
          })
          .catch((err) => {
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
          requestId,
        }),
      })
        .then(async (res) => {
          const text = await res.text();
          const textPreview = text.length > 500 ? text.substring(0, 500) + '...' : text;
          console.log(`[approve] delivery endpoint response`, { requestId, status: res.status, ok: res.ok, textPreview });
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
