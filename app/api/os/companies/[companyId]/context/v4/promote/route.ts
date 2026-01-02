// app/api/os/companies/[companyId]/context/v4/promote/route.ts
// Promote Finding to Proposed Fact API
//
// Allows users to manually promote a lab finding to a proposed fact.
// This creates a proposed field in the V4 store with the specified target field key.
//
// Respects Context Graph V4 rules:
// - Cannot overwrite human-confirmed fields
// - Uses canonical finding hash for deduplication
// - Attaches evidence from the original finding

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getOrCreateFieldStoreV4,
  saveContextFieldsV4,
  canPropose,
} from '@/lib/contextGraph/fieldStoreV4';
import { generateDedupeKey } from '@/lib/contextGraph/v4/propose';
import type {
  ContextFieldV4,
  ContextFieldEvidenceV4,
} from '@/lib/types/contextField';
import type {
  PromoteToFactRequest,
  PromoteToFactResponse,
  LabKey,
} from '@/lib/types/labSummary';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Map lab key to source identifier
 */
const LAB_KEY_TO_IMPORTER: Record<LabKey, string> = {
  websiteLab: 'websiteLab',
  competitionLab: 'competitionLab',
  brandLab: 'brandLab',
  gapPlan: 'gapPlan',
  audienceLab: 'audienceLab',
};

/**
 * Generate a canonical finding hash for deduplication
 * This is the same hash used in the findings viewer
 */
function generateCanonicalFindingHash(
  text: string,
  labKey: string,
  findingType: string,
  evidenceUrl?: string
): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const input = `${normalized}|${labKey}|${findingType}|${evidenceUrl || ''}`;
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

/**
 * POST /api/os/companies/[companyId]/context/v4/promote
 *
 * Promote a lab finding to a proposed fact
 *
 * Body:
 * {
 *   labKey: "websiteLab" | "competitionLab" | "brandLab" | "gapPlan",
 *   findingId: string,
 *   targetFieldKey: string,  // e.g., "website.executiveSummary"
 *   summary: string,         // The fact value
 *   detailedText?: string,   // Optional longer text
 *   evidenceRefs?: string[], // Evidence URLs
 *   confidence?: number      // Optional confidence override
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;
    const body = await request.json() as PromoteToFactRequest;

    // Validate required fields
    if (!body.labKey || !body.findingId || !body.targetFieldKey || !body.summary) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required fields: labKey, findingId, targetFieldKey, summary',
        } as PromoteToFactResponse,
        { status: 400 }
      );
    }

    // Validate lab key
    const validLabKeys: LabKey[] = ['websiteLab', 'competitionLab', 'brandLab', 'gapPlan'];
    if (!validLabKeys.includes(body.labKey)) {
      return NextResponse.json(
        { ok: false, error: `Invalid lab key: ${body.labKey}` } as PromoteToFactResponse,
        { status: 400 }
      );
    }

    // Validate field key format
    if (!body.targetFieldKey.includes('.')) {
      return NextResponse.json(
        { ok: false, error: `Invalid field key format: ${body.targetFieldKey}` } as PromoteToFactResponse,
        { status: 400 }
      );
    }

    const domain = body.targetFieldKey.split('.')[0];
    const importerId = LAB_KEY_TO_IMPORTER[body.labKey];
    const now = new Date().toISOString();

    // Generate canonical hash from the summary text
    const canonicalHash = generateCanonicalFindingHash(
      body.summary,
      body.labKey,
      'promoted',
      body.evidenceRefs?.[0]
    );

    // Generate dedupe key for the proposed field
    const dedupeKey = generateDedupeKey({
      companyId,
      fieldKey: body.targetFieldKey,
      source: 'lab',
      sourceId: `promoted-${body.findingId}`,
      value: body.summary,
    });

    // Load existing store
    const store = await getOrCreateFieldStoreV4(companyId);

    // Check if exact duplicate already exists
    const existing = store.fields[body.targetFieldKey];
    if (existing?.dedupeKey === dedupeKey) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        proposedFact: {
          key: body.targetFieldKey,
          value: body.summary,
          dedupeKey,
        },
      } as PromoteToFactResponse);
    }

    // Build incoming field for merge check
    const incoming = {
      key: body.targetFieldKey,
      domain,
      value: body.summary,
      source: 'lab' as const,
      sourceId: `promoted-${body.findingId}`,
      confidence: body.confidence ?? 0.75,
      updatedAt: now,
    };

    // Check merge rules
    const check = canPropose(existing, incoming);

    if (!check.canPropose) {
      // Check if blocked by confirmed field
      if (check.reason === 'existing_confirmed' || check.reason === 'human_confirmed') {
        return NextResponse.json({
          ok: false,
          blocked: true,
          blockReason: 'This field has a confirmed value that cannot be overwritten',
          error: `Field ${body.targetFieldKey} is already confirmed`,
        } as PromoteToFactResponse);
      }

      // Other block reasons
      return NextResponse.json({
        ok: false,
        blocked: true,
        blockReason: check.reason,
        error: `Cannot propose to ${body.targetFieldKey}: ${check.reason}`,
      } as PromoteToFactResponse);
    }

    // Build evidence
    const evidence: ContextFieldEvidenceV4 = {
      runId: body.findingId,
      importerId,
      rawPath: 'user-promoted',
      originalSource: body.labKey,
    };

    // Add evidence URLs
    if (body.evidenceRefs && body.evidenceRefs.length > 0) {
      evidence.url = body.evidenceRefs[0];
      if (body.detailedText) {
        evidence.snippet = body.detailedText.slice(0, 500);
      }
    }

    // Create the proposed field
    const field: ContextFieldV4 = {
      key: body.targetFieldKey,
      domain,
      value: body.summary,
      status: 'proposed',
      source: 'lab',
      sourceId: `promoted-${body.findingId}`,
      confidence: body.confidence ?? 0.75,
      updatedAt: now,
      evidence,
      dedupeKey,
      runCreatedAt: now,
      schemaVariant: 'user-promoted',
      importerId,
      // Track previous value if replacing
      previousValue: existing?.value,
      previousSource: existing?.source,
      // Conflict metadata
      conflictsWithConfirmed: check.conflictsWithConfirmed,
      confirmedValuePreview: check.confirmedValuePreview,
    };

    // Save to store
    store.fields[body.targetFieldKey] = field;
    await saveContextFieldsV4(companyId, store);

    console.log('[Promote API] Promoted finding to fact:', {
      companyId,
      labKey: body.labKey,
      findingId: body.findingId,
      targetFieldKey: body.targetFieldKey,
      canonicalHash,
    });

    return NextResponse.json({
      ok: true,
      proposedFact: {
        key: body.targetFieldKey,
        value: body.summary,
        dedupeKey,
      },
    } as PromoteToFactResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Promote API] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage } as PromoteToFactResponse,
      { status: 500 }
    );
  }
}
