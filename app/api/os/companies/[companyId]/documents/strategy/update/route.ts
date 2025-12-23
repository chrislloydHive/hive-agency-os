// app/api/os/companies/[companyId]/documents/strategy/update/route.ts
// Insert Updates to Strategy Document
//
// POST - Appends an "Updates — {date}" section to the existing Google Doc
//
// Key Behavior:
// - NEVER overwrites existing content
// - Computes diff between last synced snapshot and current context
// - Appends updates section at the end of the document
// - Updates snapshot reference and resets staleness count

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getCompanyById } from '@/lib/airtable/companies';
import { getConfirmedFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getCompanyOAuthClient } from '@/lib/integrations/googleDrive';
import {
  getStrategyDocFields,
  updateStrategyDocFields,
  createContextSnapshot,
  buildUpdateSection,
  computeSnapshotDiff,
  resetStrategyDocStaleness,
  type ContextSnapshot,
  type UpdateStrategyDocResult,
} from '@/lib/documents/strategyDoc';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { ContextFieldV4 } from '@/lib/types/contextField';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/documents/strategy/update
 * Insert updates to existing Strategy Document
 *
 * Response:
 * - success: boolean
 * - updatesApplied: number (count of changed fields inserted)
 * - newSnapshotId: string (new context snapshot)
 */
export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<UpdateStrategyDocResult>> {
  try {
    const { companyId } = await params;

    // Check feature flags
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED || !FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      return NextResponse.json({
        success: false,
        updatesApplied: 0,
        error: 'Artifacts feature is not enabled',
      }, { status: 403 });
    }

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({
        success: false,
        updatesApplied: 0,
        error: 'Company not found',
      }, { status: 404 });
    }

    // Check if Strategy Doc exists
    const docFields = await getStrategyDocFields(companyId);
    if (!docFields?.strategyDocId) {
      return NextResponse.json({
        success: false,
        updatesApplied: 0,
        error: 'Strategy Document does not exist. Use create endpoint first.',
      }, { status: 400 });
    }

    // Create current context snapshot
    const currentSnapshot = await createContextSnapshot(companyId);
    if (!currentSnapshot) {
      return NextResponse.json({
        success: false,
        updatesApplied: 0,
        error: 'No confirmed context fields found.',
      }, { status: 400 });
    }

    // Load previous snapshot for comparison
    const previousSnapshot = await loadPreviousSnapshot(companyId, docFields.strategyDocSnapshotId);

    // Compute diff
    const changedFields = computeSnapshotDiff(previousSnapshot, currentSnapshot);

    // If no changes, just update the snapshot reference
    if (changedFields.length === 0) {
      await resetStrategyDocStaleness(companyId, currentSnapshot.id);

      return NextResponse.json({
        success: true,
        updatesApplied: 0,
        newSnapshotId: currentSnapshot.id,
      });
    }

    // Build update section content
    const today = new Date().toISOString().split('T')[0];
    const updateSection = buildUpdateSection(changedFields, today);

    // Append to Google Doc
    const auth = await getCompanyOAuthClient(companyId);
    const docs = google.docs({ version: 'v1', auth });

    // Get document to find end position
    const docResponse = await docs.documents.get({
      documentId: docFields.strategyDocId,
    });

    const endIndex = docResponse.data.body?.content
      ?.slice(-1)[0]?.endIndex || 1;

    // Insert the update section at the end
    const updateText = `\n\n${updateSection.heading}\n\n${updateSection.body}`;

    await docs.documents.batchUpdate({
      documentId: docFields.strategyDocId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: endIndex - 1 },
              text: updateText,
            },
          },
        ],
      },
    });

    // Update snapshot reference and reset staleness
    await resetStrategyDocStaleness(companyId, currentSnapshot.id);

    console.log(`[StrategyDoc] Updated doc for ${company.name}:`, {
      docId: docFields.strategyDocId,
      newSnapshotId: currentSnapshot.id,
      changesApplied: changedFields.length,
    });

    return NextResponse.json({
      success: true,
      updatesApplied: changedFields.length,
      newSnapshotId: currentSnapshot.id,
    });
  } catch (error) {
    console.error('[API StrategyDoc Update] Error:', error);
    return NextResponse.json({
      success: false,
      updatesApplied: 0,
      error: error instanceof Error ? error.message : 'Failed to update Strategy Document',
    }, { status: 500 });
  }
}

/**
 * Load previous snapshot from stored snapshot ID
 * Returns null if no previous snapshot (treat all current fields as new)
 */
async function loadPreviousSnapshot(
  companyId: string,
  snapshotId: string | null
): Promise<ContextSnapshot | null> {
  if (!snapshotId) {
    return null;
  }

  // For now, we reconstruct by loading current confirmed fields
  // In a full implementation, we'd store historical snapshots
  // But since we only need to detect changes, we compare IDs

  // If the snapshot ID matches current, no changes
  const currentFields = await getConfirmedFieldsV4(companyId);
  const currentSnapshotId = generateSimpleHash(currentFields);

  if (snapshotId === currentSnapshotId) {
    // Build snapshot from current fields (no changes)
    const fieldsMap: Record<string, ContextFieldV4> = {};
    for (const field of currentFields) {
      fieldsMap[field.key] = field;
    }
    return {
      id: snapshotId,
      createdAt: new Date().toISOString(),
      fields: fieldsMap,
      confirmedCount: currentFields.length,
    };
  }

  // Different snapshot ID means changes occurred
  // Return null to treat all current fields as potentially changed
  // (This is a simplification - full impl would store snapshots)
  return null;
}

/**
 * Generate simple hash for snapshot comparison
 */
function generateSimpleHash(fields: ContextFieldV4[]): string {
  const content = fields
    .map(f => `${f.key}:${JSON.stringify(f.value)}`)
    .sort()
    .join('|');

  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return `snap_${Math.abs(hash).toString(36)}`;
}
