// app/api/os/companies/[companyId]/context/v4/propose-website-lab/route.ts
// Context V4: Manual WebsiteLab Proposal Trigger
//
// Debug endpoint that bypasses postRunHooks to directly propose WebsiteLab
// results into the V4 Review Queue. Use this to prove data appears immediately.
//
// Idempotent: Re-running against the same WebsiteLab run will skip duplicates.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import {
  buildWebsiteLabCandidatesWithV5,
  extractWebsiteLabResult,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';
import { getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
} from '@/lib/types/contextField';
import type {
  ProposeWebsiteLabResponse,
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
 * POST /api/os/companies/[companyId]/context/v4/propose-website-lab
 *
 * Manually trigger WebsiteLab V4 proposal flow.
 * This bypasses postRunHooks and directly proposes from the latest WebsiteLab run.
 *
 * Idempotent: Re-running will skip already-proposed/confirmed fields.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  // Initialize response with defaults
  const response: ProposeWebsiteLabResponse = {
    ok: false,
    runId: null,
    proposedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    reason: 'UNKNOWN',
    flags: {
      CONTEXT_V4_ENABLED: isContextV4Enabled(),
      CONTEXT_V4_INGEST_WEBSITELAB: isContextV4IngestWebsiteLabEnabled(),
    },
  };

  try {
    // Check feature flag for WebsiteLab ingestion specifically
    if (!isContextV4IngestWebsiteLabEnabled()) {
      response.reason = 'FLAG_DISABLED';
      response.error = 'CONTEXT_V4_INGEST_WEBSITELAB is disabled';
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

    // Get latest WebsiteLab run
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
    if (!latestRun) {
      response.reason = 'NO_RUN';
      response.error = 'No WebsiteLab diagnostic run found for this company';
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
      response.error = 'WebsiteLab run has no rawJson data';
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Try to extract the lab result
    const extraction = extractWebsiteLabResult(latestRun.rawJson);
    if (!extraction) {
      const rawData = latestRun.rawJson as Record<string, unknown>;
      const topLevelKeys = Object.keys(rawData).slice(0, 15);
      response.reason = 'EXTRACT_PATH_MISSING';
      response.error = `Could not locate lab output in rawJson. Top-level keys: ${topLevelKeys.join(', ')}`;
      response.debug = {
        candidatesCount: 0,
        topLevelKeys,
      };
      return NextResponse.json(response, {
        status: 400,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // Build candidates from the run's rawJson (prefers V5 if available)
    const candidateResult = buildWebsiteLabCandidatesWithV5(latestRun.rawJson, latestRun.id);
    response.extractionPath = candidateResult.extractionPath;

    // Log V5 vs V4 extraction
    const isV5 = candidateResult.extractionPath.includes('v5Diagnostic');
    console.log(`[propose-website-lab] Using ${isV5 ? 'V5' : 'V4'} candidates:`, {
      extractionPath: candidateResult.extractionPath,
      candidateCount: candidateResult.candidates.length,
    });

    // Initialize debug info
    response.debug = {
      candidatesCount: candidateResult.candidates.length,
    };

    if (candidateResult.candidates.length === 0) {
      response.reason = 'NO_CANDIDATES';
      response.error = `Extraction succeeded but 0 candidates produced. ` +
        `Raw keys: ${candidateResult.rawKeysFound}, ` +
        `Skipped wrong domain: ${candidateResult.skipped.wrongDomain}, ` +
        `Skipped empty: ${candidateResult.skipped.emptyValue}`;
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
      importerId: 'websiteLab',
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
    const actualReplaced = proposalResult.replaced;

    // Populate response
    response.ok = true;
    response.proposedCount = proposalResult.proposed; // proposed + replaced
    response.createdCount = Math.max(0, actualCreated); // net new proposals
    response.skippedCount = proposalResult.blocked;

    // Cap skipped keys sample at 20
    if (proposalResult.blockedKeys.length > 0) {
      response.debug.skippedKeysSample = proposalResult.blockedKeys.slice(0, 20);
    }

    // Determine reason
    if (response.proposedCount > 0) {
      response.reason = 'SUCCESS';
    } else if (response.skippedCount > 0 && candidateResult.candidates.length > 0) {
      // Had candidates but all were blocked (duplicates/confirmed)
      response.reason = 'ALL_DUPLICATES';
      response.debug.skippedKeysSample = proposalResult.blockedKeys.slice(0, 20);
    } else if (
      candidateResult.candidates.length > 0 &&
      response.proposedCount === 0 &&
      response.skippedCount === 0 &&
      storeBefore.total === storeAfter.total
    ) {
      // Tried to write but nothing changed
      response.reason = 'STORE_WRITE_FAILED';
    } else {
      response.reason = 'UNKNOWN';
    }

    console.log('[propose-website-lab] Complete:', {
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
    console.error('[propose-website-lab] Error:', errorMessage);
    response.error = errorMessage;
    response.reason = 'UNKNOWN';
    return NextResponse.json(response, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
