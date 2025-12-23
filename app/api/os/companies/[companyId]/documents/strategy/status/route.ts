// app/api/os/companies/[companyId]/documents/strategy/status/route.ts
// Strategy Document Status API
//
// GET - Returns current state of Strategy Document for a company
//
// Status can be:
// - not_created: No Strategy Doc exists yet
// - up_to_date: Doc exists and staleness count is 0
// - out_of_date: Doc exists but context has changed since last sync

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getStrategyDocState,
  getStrategyDocFields,
  type StrategyDocState,
} from '@/lib/documents/strategyDoc';
import { getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { FEATURE_FLAGS } from '@/lib/config/featureFlags';

type Params = { params: Promise<{ companyId: string }> };

export interface StrategyDocStatusResponse {
  /** Whether a Strategy Doc exists */
  exists: boolean;
  /** Status: not_created, up_to_date, or out_of_date */
  status: 'not_created' | 'up_to_date' | 'out_of_date';
  /** Number of context changes since last sync */
  stalenessCount: number;
  /** Direct URL to the Google Doc */
  docUrl: string | null;
  /** Last sync timestamp */
  lastSyncedAt: string | null;
  /** Whether Context V4 is ready (has enough confirmed fields) */
  contextReady: boolean;
  /** Number of confirmed fields */
  confirmedFieldCount: number;
  /** Minimum required fields for doc creation */
  minRequiredFields: number;
  /** Whether Google Drive is available */
  googleDriveAvailable: boolean;
  /** Error message if any */
  error?: string;
}

const MIN_CONFIRMED_FIELDS = 3;

/**
 * GET /api/os/companies/[companyId]/documents/strategy/status
 * Get current Strategy Document status
 */
export async function GET(
  request: NextRequest,
  { params }: Params
): Promise<NextResponse<StrategyDocStatusResponse>> {
  try {
    const { companyId } = await params;

    // Check feature flags
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json({
        exists: false,
        status: 'not_created',
        stalenessCount: 0,
        docUrl: null,
        lastSyncedAt: null,
        contextReady: false,
        confirmedFieldCount: 0,
        minRequiredFields: MIN_CONFIRMED_FIELDS,
        googleDriveAvailable: false,
        error: 'Artifacts feature is not enabled',
      });
    }

    // Get company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({
        exists: false,
        status: 'not_created',
        stalenessCount: 0,
        docUrl: null,
        lastSyncedAt: null,
        contextReady: false,
        confirmedFieldCount: 0,
        minRequiredFields: MIN_CONFIRMED_FIELDS,
        googleDriveAvailable: false,
        error: 'Company not found',
      }, { status: 404 });
    }

    // Get Strategy Doc state
    const state = await getStrategyDocState(companyId);

    // Get Context V4 field counts
    const fieldCounts = await getFieldCountsV4(companyId);
    const contextReady = fieldCounts.confirmed >= MIN_CONFIRMED_FIELDS;

    // Determine status
    let status: 'not_created' | 'up_to_date' | 'out_of_date';
    if (!state.exists) {
      status = 'not_created';
    } else if (state.stalenessCount > 0) {
      status = 'out_of_date';
    } else {
      status = 'up_to_date';
    }

    return NextResponse.json({
      exists: state.exists,
      status,
      stalenessCount: state.stalenessCount,
      docUrl: state.docUrl,
      lastSyncedAt: state.lastSyncedAt,
      contextReady,
      confirmedFieldCount: fieldCounts.confirmed,
      minRequiredFields: MIN_CONFIRMED_FIELDS,
      googleDriveAvailable: FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED,
    });
  } catch (error) {
    console.error('[API StrategyDoc Status] Error:', error);
    return NextResponse.json({
      exists: false,
      status: 'not_created',
      stalenessCount: 0,
      docUrl: null,
      lastSyncedAt: null,
      contextReady: false,
      confirmedFieldCount: 0,
      minRequiredFields: MIN_CONFIRMED_FIELDS,
      googleDriveAvailable: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    }, { status: 500 });
  }
}
