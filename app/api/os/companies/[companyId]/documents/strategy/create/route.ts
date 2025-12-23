// app/api/os/companies/[companyId]/documents/strategy/create/route.ts
// Create Strategy Document from Context V4
//
// POST - Creates a Google Doc from confirmed Context V4 fields
//
// Requirements:
// - Context V4 must be ready (has confirmed fields)
// - Google must be connected (for Drive access)
// - Strategy Doc must not already exist (use update endpoint instead)

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getConfirmedFieldsV4, getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import {
  getStrategyDocFields,
  updateStrategyDocFields,
  createContextSnapshot,
  buildStrategyDocContent,
  type CreateStrategyDocResult,
} from '@/lib/documents/strategyDoc';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';

type Params = { params: Promise<{ companyId: string }> };

// Minimum confirmed fields required to create a doc
const MIN_CONFIRMED_FIELDS = 3;

/**
 * POST /api/os/companies/[companyId]/documents/strategy/create
 * Create a Strategy Document from Context V4 confirmed fields
 *
 * Response:
 * - success: boolean
 * - docId: string (Google Doc ID)
 * - docUrl: string (Direct URL to doc)
 * - snapshotId: string (Context snapshot used)
 */
export async function POST(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<CreateStrategyDocResult>> {
  try {
    const { companyId } = await params;

    // Check feature flags
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json({
        success: false,
        error: 'Artifacts feature is not enabled',
      }, { status: 403 });
    }

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company not found',
      }, { status: 404 });
    }

    // Check if Strategy Doc already exists
    const existingDoc = await getStrategyDocFields(companyId);
    if (existingDoc?.strategyDocId) {
      return NextResponse.json({
        success: false,
        error: 'Strategy Document already exists. Use the update endpoint instead.',
      }, { status: 400 });
    }

    // Check Context V4 readiness
    const fieldCounts = await getFieldCountsV4(companyId);
    if (fieldCounts.confirmed < MIN_CONFIRMED_FIELDS) {
      return NextResponse.json({
        success: false,
        error: `Context V4 not ready. Need at least ${MIN_CONFIRMED_FIELDS} confirmed fields (have ${fieldCounts.confirmed}).`,
      }, { status: 400 });
    }

    // Check Google Drive availability
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      const driveAvailable = await isGoogleDriveAvailable(companyId);
      if (!driveAvailable) {
        return NextResponse.json({
          success: false,
          error: 'Google Drive is not connected. Please connect Google first.',
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        success: false,
        error: 'Google Drive integration is not enabled.',
      }, { status: 400 });
    }

    // Create context snapshot
    const snapshot = await createContextSnapshot(companyId);
    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create context snapshot. No confirmed fields found.',
      }, { status: 400 });
    }

    // Build document content
    const content = buildStrategyDocContent(company.name, snapshot.fields);

    // Create Google Doc
    const driveClient = createGoogleDriveClient(companyId);
    const folder = await driveClient.getOrCreateCompanyFolder(company.name);
    const docTitle = `${company.name} - Strategy Document`;

    const doc = await driveClient.createDocument({
      title: docTitle,
      content,
      parentFolderId: folder.id,
    });

    // Store doc reference in company
    await updateStrategyDocFields(companyId, {
      strategyDocId: doc.id,
      strategyDocUrl: doc.webViewLink,
      strategyDocSnapshotId: snapshot.id,
      strategyDocLastSyncedAt: new Date().toISOString(),
      strategyDocStalenessCount: 0,
      driveFolderId: folder.id,
    });

    console.log(`[StrategyDoc] Created doc for ${company.name}:`, {
      docId: doc.id,
      snapshotId: snapshot.id,
      confirmedFields: snapshot.confirmedCount,
    });

    return NextResponse.json({
      success: true,
      docId: doc.id,
      docUrl: doc.webViewLink,
      snapshotId: snapshot.id,
    }, { status: 201 });
  } catch (error) {
    console.error('[API StrategyDoc Create] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Strategy Document',
    }, { status: 500 });
  }
}
