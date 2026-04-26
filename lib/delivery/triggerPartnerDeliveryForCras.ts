/**
 * Resolve Partner Delivery Batch for a CRAS row and send `partner.delivery.requested`
 * to Inngest (copy to partner + production assets in `partner-delivery-requested`).
 * Shared by POST /api/delivery/partner/approved and review portal approve routes.
 */

import { inngest } from '@/lib/inngest/client';
import { getProjectsBase } from '@/lib/airtable';
import { CREATIVE_REVIEW_ASSET_STATUS_TABLE } from '@/lib/airtable/deliveryWriteBack';
import { DELIVERY_BATCH_ID_FIELD } from '@/lib/airtable/reviewAssetStatus';
import {
  getBatchDetails,
  getDeliveryContextByProjectId,
  listBatchesByProjectId,
} from '@/lib/airtable/partnerDeliveryBatches';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';

function normalizeLinkedOrScalarString(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    if (typeof first === 'object' && first !== null && 'name' in first) {
      const n = (first as { name?: string }).name;
      if (typeof n === 'string' && n.trim()) return n.trim();
    }
  }
  return null;
}

/** Portal token on CRAS — try plain + configured lookup field names. */
function reviewTokenFromCrasFields(fields: Record<string, unknown>): string | null {
  const plain = process.env.REVIEW_CRAS_PLAIN_TOKEN_FIELD?.trim() || 'Review Token';
  const configured =
    process.env.REVIEW_CRAS_TOKEN_FIELD?.trim() || 'Review Portal Token (lookup)';
  for (const key of [plain, configured, 'Review Token', 'Review Portal Token (lookup)']) {
    const s = normalizeLinkedOrScalarString(fields[key]);
    if (s) return s;
  }
  return null;
}

function projectRecordIdFromCrasFields(fields: Record<string, unknown>): string | null {
  const raw = fields['Project'];
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0];
    if (typeof first === 'string' && first.startsWith('rec')) return first;
    if (typeof first === 'object' && first !== null && 'id' in first) {
      const id = (first as { id?: string }).id;
      if (typeof id === 'string' && id.startsWith('rec')) return id;
    }
  }
  if (typeof raw === 'string' && raw.startsWith('rec')) return raw;
  return null;
}

export interface TriggerPartnerDeliveryForCrasInput {
  crasRecordId: string;
  requestId?: string;
  deliveryBatchId?: string;
  /** Alias for deliveryBatchId */
  batchId?: string;
  deliveryBatchRecordId?: string;
  triggeredBy?: string;
}

export type TriggerPartnerDeliveryForCrasResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      error: string;
      statusCode: 400 | 422 | 500;
      crasFields?: unknown;
    };

export async function triggerPartnerDeliveryForCras(
  body: TriggerPartnerDeliveryForCrasInput
): Promise<TriggerPartnerDeliveryForCrasResult> {
  const requestId = body.requestId ? String(body.requestId).trim() : undefined;
  const crasRecordId = body.crasRecordId ? String(body.crasRecordId).trim() : undefined;
  const deliveryBatchId =
    body.deliveryBatchId || body.batchId
      ? String(body.deliveryBatchId || body.batchId).trim()
      : undefined;
  const deliveryBatchRecordId = body.deliveryBatchRecordId
    ? String(body.deliveryBatchRecordId).trim()
    : undefined;

  if (!crasRecordId) {
    return { ok: false, error: 'Missing crasRecordId', statusCode: 400 };
  }

  try {
    let batchRecordId: string | undefined = deliveryBatchRecordId;
    let crasRecord: { fields: Record<string, unknown> } | null = null;

    let resolutionPath = 'request-body';
    if (!batchRecordId) {
      const projectsBase = getProjectsBase();
      crasRecord = (await projectsBase(CREATIVE_REVIEW_ASSET_STATUS_TABLE).find(
        crasRecordId,
      )) as { fields: Record<string, unknown> };

      const partnerDeliveryBatchField = crasRecord?.fields?.['Partner Delivery Batch'];
      const deliveryBatchIdField = crasRecord?.fields?.[DELIVERY_BATCH_ID_FIELD];

      if (Array.isArray(partnerDeliveryBatchField) && partnerDeliveryBatchField.length > 0) {
        const firstLink = partnerDeliveryBatchField[0];
        if (typeof firstLink === 'string' && firstLink.startsWith('rec')) {
          batchRecordId = firstLink;
          resolutionPath = 'cras-linked-record:Partner Delivery Batch';
        } else if (typeof firstLink === 'object' && firstLink !== null && 'id' in firstLink) {
          batchRecordId = (firstLink as { id: string }).id;
          resolutionPath = 'cras-linked-record:Partner Delivery Batch';
        }
      } else if (
        typeof partnerDeliveryBatchField === 'string' &&
        partnerDeliveryBatchField.startsWith('rec')
      ) {
        batchRecordId = partnerDeliveryBatchField;
        resolutionPath = 'cras-linked-record:Partner Delivery Batch';
      }

      if (!batchRecordId) {
        if (Array.isArray(deliveryBatchIdField) && deliveryBatchIdField.length > 0) {
          const firstLink = deliveryBatchIdField[0];
          if (typeof firstLink === 'string' && firstLink.startsWith('rec')) {
            batchRecordId = firstLink;
            resolutionPath = 'cras-linked-record:Delivery Batch ID';
          } else if (typeof firstLink === 'object' && firstLink !== null && 'id' in firstLink) {
            batchRecordId = (firstLink as { id: string }).id;
            resolutionPath = 'cras-linked-record:Delivery Batch ID';
          } else if (typeof firstLink === 'string' && firstLink.trim()) {
            const batchDetails = await getBatchDetails(firstLink.trim());
            if (batchDetails) {
              batchRecordId = batchDetails.recordId;
              resolutionPath = `cras-text-lookup:Delivery Batch ID (value="${firstLink.trim()}")`;
            }
          }
        } else if (typeof deliveryBatchIdField === 'string' && deliveryBatchIdField.trim()) {
          const textBatchId = deliveryBatchIdField.trim();
          if (textBatchId.startsWith('rec')) {
            batchRecordId = textBatchId;
            resolutionPath = 'cras-record-id:Delivery Batch ID';
          } else {
            const batchDetails = await getBatchDetails(textBatchId);
            if (batchDetails) {
              batchRecordId = batchDetails.recordId;
              resolutionPath = `cras-text-lookup:Delivery Batch ID (value="${textBatchId}")`;
            } else {
              console.warn(
                `[triggerPartnerDeliveryForCras] Delivery Batch ID text value "${textBatchId}" not found in Partner Delivery Batches table`,
              );
            }
          }
        }
      }

      if (!batchRecordId) {
        const reviewToken = crasRecord ? reviewTokenFromCrasFields(crasRecord.fields) : null;
        if (reviewToken) {
          console.log(
            '[triggerPartnerDeliveryForCras] Path 3: Resolving batch via Review Token → Project → Batch',
          );
          try {
            const projectsBase = getProjectsBase();
            const tokenEsc = reviewToken.replace(/"/g, '\\"');
            const REVIEW_TOKEN_FIELD =
              process.env.REVIEW_PORTAL_TOKEN_FIELD?.trim() || 'Client Review Portal Token';
            const projectRecords = await projectsBase(AIRTABLE_TABLES.PROJECTS)
              .select({
                filterByFormula: `{${REVIEW_TOKEN_FIELD}} = "${tokenEsc}"`,
                maxRecords: 1,
              })
              .firstPage();

            if (projectRecords.length > 0) {
              const projectRecordId = projectRecords[0].id;
              console.log(
                `[triggerPartnerDeliveryForCras] Path 3: Found project ${projectRecordId} from token`,
              );

              const batches = await listBatchesByProjectId(projectRecordId);
              if (batches.length > 0) {
                batchRecordId = batches[0].batchRecordId;
                resolutionPath = `cras-review-token:listBatchesByProjectId (project=${projectRecordId}, batch=${batches[0].batchId})`;
              } else {
                const ctx = await getDeliveryContextByProjectId(projectRecordId);
                if (ctx) {
                  batchRecordId = ctx.recordId;
                  resolutionPath = `cras-review-token:getDeliveryContextByProjectId (project=${projectRecordId}, batch=${ctx.deliveryBatchId})`;
                }
              }
            } else {
              console.warn(
                `[triggerPartnerDeliveryForCras] Path 3: No project found for portal token "${reviewToken.slice(0, 12)}..."`,
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[triggerPartnerDeliveryForCras] Path 3 failed:`, msg);
          }
        }
      }

      // Path 4: CRAS has Project link but no batch fields / token (common for webhook-only rows).
      if (!batchRecordId && crasRecord) {
        const projectId = projectRecordIdFromCrasFields(crasRecord.fields);
        if (projectId) {
          console.log(
            `[triggerPartnerDeliveryForCras] Path 4: Resolving batch via CRAS Project link ${projectId}`,
          );
          try {
            const batches = await listBatchesByProjectId(projectId);
            if (batches.length > 0 && batches[0].batchRecordId) {
              batchRecordId = batches[0].batchRecordId;
              resolutionPath = `cras-project-link:listBatchesByProjectId (project=${projectId}, batch=${batches[0].batchId})`;
            }
            if (!batchRecordId) {
              const ctx = await getDeliveryContextByProjectId(projectId);
              if (ctx?.recordId) {
                batchRecordId = ctx.recordId;
                resolutionPath = `cras-project-link:getDeliveryContextByProjectId (project=${projectId})`;
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[triggerPartnerDeliveryForCras] Path 4 failed:`, msg);
          }
        }
      }

      console.log('[triggerPartnerDeliveryForCras] CRAS field lookup', {
        crasRecordId,
        resolutionPath,
        partnerDeliveryBatchField: partnerDeliveryBatchField ?? null,
        deliveryBatchIdField: deliveryBatchIdField ?? null,
        resolvedBatchRecordId: batchRecordId ?? null,
      });
    }

    console.log('[triggerPartnerDeliveryForCras] batch resolution', {
      resolutionPath,
      fromRequest: deliveryBatchRecordId ?? null,
      resolvedBatchRecordId: batchRecordId ?? null,
    });

    if (!batchRecordId) {
      const debugFields = crasRecord?.fields
        ? {
            'Partner Delivery Batch': crasRecord.fields['Partner Delivery Batch'] ?? null,
            'Delivery Batch ID': crasRecord.fields[DELIVERY_BATCH_ID_FIELD] ?? null,
            Project: crasRecord.fields['Project'] ?? null,
            'Review token (resolved)': reviewTokenFromCrasFields(crasRecord.fields)?.slice(0, 16) ?? null,
            'Delivery Status': crasRecord.fields['Delivery Status'] ?? null,
            Filename: crasRecord.fields['Filename'] ?? null,
            'Source Folder ID': crasRecord.fields['Source Folder ID'] ?? null,
            'Ready to Deliver (Webhook)': crasRecord.fields['Ready to Deliver (Webhook)'] ?? null,
          }
        : 'CRAS record not fetched';
      const errorMsg = `No Partner Delivery Batch resolved for CRAS ${crasRecordId}`;
      console.error(`[triggerPartnerDeliveryForCras] ${errorMsg}`, { debugFields });
      return {
        ok: false,
        error: `Failed to trigger delivery: ${errorMsg}`,
        statusCode: 422,
        crasFields: debugFields,
      };
    }

    const finalRequestId = requestId || `approved-${Date.now().toString(36)}-${crasRecordId.slice(-8)}`;
    const eventPayload = {
      name: 'partner.delivery.requested' as const,
      data: {
        crasRecordId,
        batchId: deliveryBatchId,
        batchRecordId,
        requestId: finalRequestId,
        triggeredBy: body.triggeredBy || 'approval',
      },
    };

    console.log('[triggerPartnerDeliveryForCras] sending event', {
      name: eventPayload.name,
      requestId: finalRequestId,
      crasRecordId,
      deliveryBatchId,
    });

    await inngest.send(eventPayload);

    console.log(
      `[triggerPartnerDeliveryForCras] Event sent for CRAS record ${crasRecordId}, requestId=${finalRequestId}`,
    );

    return { ok: true, requestId: finalRequestId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[triggerPartnerDeliveryForCras] Failed to send event for ${crasRecordId}:`, message);
    return {
      ok: false,
      error: `Failed to trigger delivery: ${message}`,
      statusCode: 500,
    };
  }
}
