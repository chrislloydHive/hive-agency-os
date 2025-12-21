// app/api/os/companies/[companyId]/context/v4/propose-gap-plan/route.ts
// Context V4: Manual GAP Plan Proposal Trigger
//
// Proposes GAP Plan findings into the V4 Review Queue.
// Maps required strategy fields:
// - productOffer.primaryProducts
// - productOffer.valueProposition
// - audience.primaryAudience
// - audience.icpDescription
// - competitive.competitors
//
// Idempotent: Re-running against the same GAP Plan run will skip duplicates.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import {
  buildGapPlanCandidates,
  extractGapPlanStructured,
} from '@/lib/contextGraph/v4/gapPlanCandidates';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';
import { getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  isContextV4IngestGapPlanEnabled,
} from '@/lib/types/contextField';
import type {
  ProposalReason,
  V4StoreCounts,
} from '@/lib/types/contextV4Debug';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Response type for propose-gap-plan endpoint
 */
interface ProposeGapPlanResponse {
  ok: boolean;
  runId: string | null;
  runCreatedAt?: string | null;
  proposedCount: number;
  createdCount: number;
  skippedCount: number;
  reason: ProposalReason;
  extractionPath?: string;
  flags?: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_GAPPLAN: boolean;
  };
  debug?: {
    candidatesCount?: number;
    skippedKeysSample?: string[];
    storeBefore?: V4StoreCounts;
    storeAfter?: V4StoreCounts;
    topLevelKeys?: string[];
    extractionFailureReason?: string;
  };
  error?: string;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/propose-gap-plan
 *
 * Manually trigger GAP Plan V4 proposal flow.
 * Proposes required strategy fields from the latest GAP Plan run.
 *
 * Idempotent: Re-running will skip already-proposed/confirmed fields.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  // Initialize response with defaults
  const response: ProposeGapPlanResponse = {
    ok: false,
    runId: null,
    proposedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    reason: 'UNKNOWN',
    flags: {
      CONTEXT_V4_ENABLED: isContextV4Enabled(),
      CONTEXT_V4_INGEST_GAPPLAN: isContextV4IngestGapPlanEnabled(),
    },
  };

  try {
    // Check feature flag for GAP Plan ingestion
    if (!isContextV4IngestGapPlanEnabled()) {
      response.reason = 'FLAG_DISABLED';
      response.error = 'CONTEXT_V4_INGEST_GAPPLAN is disabled';
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      response.error = 'Company not found';
      return NextResponse.json(response, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Get latest GAP Plan run
    const gapRuns = await getGapPlanRunsForCompany(companyId, 1);
    const latestRun = gapRuns.find((r) => r.status === 'completed' && r.dataJson);

    if (!latestRun) {
      response.reason = 'NO_RUN';
      response.error = 'No completed GAP Plan run found for this company';
      return NextResponse.json(response, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    response.runId = latestRun.id;
    response.runCreatedAt = latestRun.createdAt;

    // Check for dataJson
    if (!latestRun.dataJson) {
      response.reason = 'EXTRACT_PATH_MISSING';
      response.error = 'GAP Plan run has no dataJson';
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Try to extract the structured data
    const extraction = extractGapPlanStructured(latestRun.dataJson);
    if (!extraction) {
      const rawData = latestRun.dataJson as Record<string, unknown>;
      const topLevelKeys = Object.keys(rawData).slice(0, 15);
      response.reason = 'EXTRACT_PATH_MISSING';
      response.error = `Could not locate GAP Plan structured output in dataJson. Top-level keys: ${topLevelKeys.join(', ')}`;
      response.debug = {
        candidatesCount: 0,
        topLevelKeys,
      };
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Build candidates from the run's dataJson
    const candidateResult = buildGapPlanCandidates(latestRun.dataJson);
    response.extractionPath = candidateResult.extractionPath;

    // Initialize debug info
    response.debug = {
      candidatesCount: candidateResult.candidates.length,
    };

    if (candidateResult.candidates.length === 0) {
      response.reason = 'NO_CANDIDATES';
      response.error = `Extraction succeeded but 0 candidates produced.`;
      if (candidateResult.debug) {
        response.debug.topLevelKeys = candidateResult.debug.rootTopKeys;
      }
      return NextResponse.json(response, {
        status: 200, // Not an error, just no data
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Get store counts BEFORE proposal
    const storeBefore = await getFieldCountsV4(companyId);
    response.debug.storeBefore = storeBefore;

    // Propose to V4 (idempotent - will skip duplicates)
    // Note: GAP Plan uses source: 'gap' (not 'lab')
    const proposalResult = await proposeFromLabResult({
      companyId,
      importerId: 'gapPlan',
      source: 'gap',
      sourceId: latestRun.id,
      extractionPath: candidateResult.extractionPath,
      candidates: candidateResult.candidates,
    });

    // Get store counts AFTER proposal
    const storeAfter = await getFieldCountsV4(companyId);
    response.debug.storeAfter = storeAfter;

    // Calculate actual changes
    const actualCreated = storeAfter.proposed - storeBefore.proposed;

    // Populate response
    response.ok = true;
    response.proposedCount = proposalResult.proposed;
    response.createdCount = Math.max(0, actualCreated);
    response.skippedCount = proposalResult.blocked;

    // Cap skipped keys sample at 20
    if (proposalResult.blockedKeys.length > 0) {
      response.debug.skippedKeysSample = proposalResult.blockedKeys.slice(0, 20);
    }

    // Determine reason
    if (response.proposedCount > 0) {
      response.reason = 'SUCCESS';
    } else if (response.skippedCount > 0 && candidateResult.candidates.length > 0) {
      response.reason = 'ALL_DUPLICATES';
      response.debug.skippedKeysSample = proposalResult.blockedKeys.slice(0, 20);
    } else if (
      candidateResult.candidates.length > 0 &&
      response.proposedCount === 0 &&
      response.skippedCount === 0 &&
      storeBefore.total === storeAfter.total
    ) {
      response.reason = 'STORE_WRITE_FAILED';
    } else {
      response.reason = 'UNKNOWN';
    }

    console.log('[propose-gap-plan] Complete:', {
      companyId,
      runId: latestRun.id,
      reason: response.reason,
      proposedCount: response.proposedCount,
      createdCount: response.createdCount,
      skippedCount: response.skippedCount,
    });

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[propose-gap-plan] Error:', errorMessage);
    response.error = errorMessage;
    response.reason = 'UNKNOWN';
    return NextResponse.json(response, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
