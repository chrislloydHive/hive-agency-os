// app/api/os/companies/[companyId]/context/v4/propose-brand-lab/route.ts
// Context V4: Manual Brand Lab Proposal Trigger
//
// Proposes Brand Lab findings into the V4 Review Queue.
// Maps required strategy fields:
// - brand.positioning
// - productOffer.valueProposition
// - audience.primaryAudience
// - audience.icpDescription
//
// Idempotent: Re-running against the same Brand Lab run will skip duplicates.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import {
  buildBrandLabCandidates,
  extractBrandLabResult,
} from '@/lib/contextGraph/v4/brandLabCandidates';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';
import { getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  isContextV4IngestBrandLabEnabled,
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
 * Response type for propose-brand-lab endpoint
 */
interface ProposeBrandLabResponse {
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
    CONTEXT_V4_INGEST_BRANDLAB: boolean;
  };
  debug?: {
    candidatesCount?: number;
    skippedKeysSample?: string[];
    storeBefore?: V4StoreCounts;
    storeAfter?: V4StoreCounts;
    topLevelKeys?: string[];
    extractionFailureReason?: string;
    errors?: string[];
  };
  error?: string;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/propose-brand-lab
 *
 * Manually trigger Brand Lab V4 proposal flow.
 * Proposes required strategy fields from the latest Brand Lab run.
 *
 * Idempotent: Re-running will skip already-proposed/confirmed fields.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  // Initialize response with defaults
  const response: ProposeBrandLabResponse = {
    ok: false,
    runId: null,
    proposedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    reason: 'UNKNOWN',
    flags: {
      CONTEXT_V4_ENABLED: isContextV4Enabled(),
      CONTEXT_V4_INGEST_BRANDLAB: isContextV4IngestBrandLabEnabled(),
    },
  };

  try {
    // Check feature flag for Brand Lab ingestion
    if (!isContextV4IngestBrandLabEnabled()) {
      response.reason = 'FLAG_DISABLED';
      response.error = 'CONTEXT_V4_INGEST_BRANDLAB is disabled';
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

    // Get latest Brand Lab run
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
    if (!latestRun) {
      response.reason = 'NO_RUN';
      response.error = 'No Brand Lab diagnostic run found for this company';
      return NextResponse.json(response, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    response.runId = latestRun.id;
    response.runCreatedAt = latestRun.createdAt;

    // Check for rawJson
    if (!latestRun.rawJson) {
      response.reason = 'EXTRACT_PATH_MISSING';
      response.error = 'Brand Lab run has no rawJson data';
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Try to extract the lab result
    const extraction = extractBrandLabResult(latestRun.rawJson);
    if (!extraction) {
      const rawData = latestRun.rawJson as Record<string, unknown>;
      const topLevelKeys = Object.keys(rawData).slice(0, 15);
      response.reason = 'EXTRACT_PATH_MISSING';
      response.error = `Could not locate Brand Lab output in rawJson. Top-level keys: ${topLevelKeys.join(', ')}`;
      response.debug = {
        candidatesCount: 0,
        topLevelKeys,
      };
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Build candidates from the run's rawJson
    const candidateResult = buildBrandLabCandidates(latestRun.rawJson);
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
    const proposalResult = await proposeFromLabResult({
      companyId,
      importerId: 'brandLab',
      source: 'lab',
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

    // Surface any errors from the proposal process
    if (proposalResult.errors.length > 0) {
      response.debug.errors = proposalResult.errors;
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

    console.log('[propose-brand-lab] Complete:', {
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
    console.error('[propose-brand-lab] Error:', errorMessage);
    response.error = errorMessage;
    response.reason = 'UNKNOWN';
    return NextResponse.json(response, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
