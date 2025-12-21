// app/api/os/companies/[companyId]/context/v4/propose/route.ts
// Context V4: Combined Proposal Trigger
//
// Proposes candidates from all enabled lab sources (WebsiteLab, BrandLab, GAP Plan)
// into the V4 Review Queue in a single call.
//
// Idempotent: Re-running will skip already-proposed/confirmed fields.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { buildWebsiteLabCandidates } from '@/lib/contextGraph/v4/websiteLabCandidates';
import { buildBrandLabCandidates } from '@/lib/contextGraph/v4/brandLabCandidates';
import { buildGapPlanCandidates } from '@/lib/contextGraph/v4/gapPlanCandidates';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';
import { getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
  isContextV4IngestBrandLabEnabled,
  isContextV4IngestGapPlanEnabled,
} from '@/lib/types/contextField';
import type { V4StoreCounts } from '@/lib/types/contextV4Debug';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Per-source result
 */
interface SourceResult {
  enabled: boolean;
  runId: string | null;
  runCreatedAt?: string | null;
  candidatesCount: number;
  proposedCount: number;
  /** Blocked by merge rules (existing confirmed, rejected same source, lower confidence) */
  blockedCount: number;
  /** Skipped because exact duplicate already exists (same dedupeKey) */
  dedupedCount: number;
  /** Blocked because a confirmed field exists (subset of blockedCount) */
  conflictedCount: number;
  errors: string[];
}

/**
 * Combined propose response
 */
interface ProposeResponse {
  ok: boolean;
  companyId: string;
  writtenCount: number;
  /** Blocked by merge rules (existing confirmed, rejected same source, lower confidence) */
  blockedCount: number;
  /** Skipped because exact duplicate already exists (same dedupeKey) */
  dedupedCount: number;
  /** Blocked because a confirmed field exists (subset of blockedCount) */
  conflictedCount: number;
  totalCandidates: number;
  storeBefore: V4StoreCounts;
  storeAfter: V4StoreCounts;
  sources: {
    websiteLab: SourceResult;
    brandLab: SourceResult;
    gapPlan: SourceResult;
  };
  flags: {
    CONTEXT_V4_ENABLED: boolean;
    CONTEXT_V4_INGEST_WEBSITELAB: boolean;
    CONTEXT_V4_INGEST_BRANDLAB: boolean;
    CONTEXT_V4_INGEST_GAPPLAN: boolean;
  };
  error?: string;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/propose
 *
 * Combined proposal trigger for all lab sources.
 * Loads latest runs for WebsiteLab, BrandLab, and GAP Plan,
 * builds candidates, and proposes them to the V4 store.
 *
 * Idempotent: Re-running will skip already-proposed/confirmed fields.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  const flags = {
    CONTEXT_V4_ENABLED: isContextV4Enabled(),
    CONTEXT_V4_INGEST_WEBSITELAB: isContextV4IngestWebsiteLabEnabled(),
    CONTEXT_V4_INGEST_BRANDLAB: isContextV4IngestBrandLabEnabled(),
    CONTEXT_V4_INGEST_GAPPLAN: isContextV4IngestGapPlanEnabled(),
  };

  // Initialize response
  const response: ProposeResponse = {
    ok: false,
    companyId,
    writtenCount: 0,
    blockedCount: 0,
    dedupedCount: 0,
    conflictedCount: 0,
    totalCandidates: 0,
    storeBefore: { proposed: 0, confirmed: 0, rejected: 0, total: 0 },
    storeAfter: { proposed: 0, confirmed: 0, rejected: 0, total: 0 },
    sources: {
      websiteLab: { enabled: flags.CONTEXT_V4_INGEST_WEBSITELAB, runId: null, candidatesCount: 0, proposedCount: 0, blockedCount: 0, dedupedCount: 0, conflictedCount: 0, errors: [] },
      brandLab: { enabled: flags.CONTEXT_V4_INGEST_BRANDLAB, runId: null, candidatesCount: 0, proposedCount: 0, blockedCount: 0, dedupedCount: 0, conflictedCount: 0, errors: [] },
      gapPlan: { enabled: flags.CONTEXT_V4_INGEST_GAPPLAN, runId: null, candidatesCount: 0, proposedCount: 0, blockedCount: 0, dedupedCount: 0, conflictedCount: 0, errors: [] },
    },
    flags,
  };

  try {
    // Check master V4 flag
    if (!isContextV4Enabled()) {
      response.error = 'CONTEXT_V4_ENABLED is disabled';
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

    // Get store counts BEFORE proposals
    response.storeBefore = await getFieldCountsV4(companyId);

    // =========================================================================
    // WebsiteLab
    // =========================================================================
    if (flags.CONTEXT_V4_INGEST_WEBSITELAB) {
      try {
        const run = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
        if (run?.rawJson) {
          response.sources.websiteLab.runId = run.id;
          response.sources.websiteLab.runCreatedAt = run.createdAt;

          const candidateResult = buildWebsiteLabCandidates(run.rawJson);
          response.sources.websiteLab.candidatesCount = candidateResult.candidates.length;

          if (candidateResult.candidates.length > 0) {
            const proposalResult = await proposeFromLabResult({
              companyId,
              importerId: 'websiteLab',
              source: 'lab',
              sourceId: run.id,
              extractionPath: candidateResult.extractionPath,
              candidates: candidateResult.candidates,
            });

            response.sources.websiteLab.proposedCount = proposalResult.proposed;
            response.sources.websiteLab.blockedCount = proposalResult.blocked;
            response.sources.websiteLab.dedupedCount = proposalResult.deduped;
            response.sources.websiteLab.conflictedCount = proposalResult.conflicted;
            response.sources.websiteLab.errors = proposalResult.errors;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        response.sources.websiteLab.errors.push(msg);
        console.error('[propose] WebsiteLab error:', msg);
      }
    }

    // =========================================================================
    // BrandLab
    // =========================================================================
    if (flags.CONTEXT_V4_INGEST_BRANDLAB) {
      try {
        const run = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
        if (run?.rawJson) {
          response.sources.brandLab.runId = run.id;
          response.sources.brandLab.runCreatedAt = run.createdAt;

          const candidateResult = buildBrandLabCandidates(run.rawJson);
          response.sources.brandLab.candidatesCount = candidateResult.candidates.length;

          if (candidateResult.candidates.length > 0) {
            const proposalResult = await proposeFromLabResult({
              companyId,
              importerId: 'brandLab',
              source: 'lab',
              sourceId: run.id,
              extractionPath: candidateResult.extractionPath,
              candidates: candidateResult.candidates,
            });

            response.sources.brandLab.proposedCount = proposalResult.proposed;
            response.sources.brandLab.blockedCount = proposalResult.blocked;
            response.sources.brandLab.dedupedCount = proposalResult.deduped;
            response.sources.brandLab.conflictedCount = proposalResult.conflicted;
            response.sources.brandLab.errors = proposalResult.errors;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        response.sources.brandLab.errors.push(msg);
        console.error('[propose] BrandLab error:', msg);
      }
    }

    // =========================================================================
    // GAP Plan
    // =========================================================================
    if (flags.CONTEXT_V4_INGEST_GAPPLAN) {
      try {
        const run = await getLatestRunForCompanyAndTool(companyId, 'gapPlan');
        if (run?.rawJson) {
          response.sources.gapPlan.runId = run.id;
          response.sources.gapPlan.runCreatedAt = run.createdAt;

          const candidateResult = buildGapPlanCandidates(run.rawJson);
          response.sources.gapPlan.candidatesCount = candidateResult.candidates.length;

          if (candidateResult.candidates.length > 0) {
            const proposalResult = await proposeFromLabResult({
              companyId,
              importerId: 'gapPlan',
              source: 'gap',
              sourceId: run.id,
              extractionPath: candidateResult.extractionPath,
              candidates: candidateResult.candidates,
            });

            response.sources.gapPlan.proposedCount = proposalResult.proposed;
            response.sources.gapPlan.blockedCount = proposalResult.blocked;
            response.sources.gapPlan.dedupedCount = proposalResult.deduped;
            response.sources.gapPlan.conflictedCount = proposalResult.conflicted;
            response.sources.gapPlan.errors = proposalResult.errors;
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        response.sources.gapPlan.errors.push(msg);
        console.error('[propose] GAP Plan error:', msg);
      }
    }

    // Get store counts AFTER proposals
    response.storeAfter = await getFieldCountsV4(companyId);

    // Calculate totals
    response.totalCandidates =
      response.sources.websiteLab.candidatesCount +
      response.sources.brandLab.candidatesCount +
      response.sources.gapPlan.candidatesCount;

    response.writtenCount =
      response.sources.websiteLab.proposedCount +
      response.sources.brandLab.proposedCount +
      response.sources.gapPlan.proposedCount;

    response.blockedCount =
      response.sources.websiteLab.blockedCount +
      response.sources.brandLab.blockedCount +
      response.sources.gapPlan.blockedCount;

    response.dedupedCount =
      response.sources.websiteLab.dedupedCount +
      response.sources.brandLab.dedupedCount +
      response.sources.gapPlan.dedupedCount;

    response.conflictedCount =
      response.sources.websiteLab.conflictedCount +
      response.sources.brandLab.conflictedCount +
      response.sources.gapPlan.conflictedCount;

    response.ok = true;

    console.log('[propose] Complete:', {
      companyId,
      writtenCount: response.writtenCount,
      blockedCount: response.blockedCount,
      dedupedCount: response.dedupedCount,
      conflictedCount: response.conflictedCount,
      totalCandidates: response.totalCandidates,
      storeBefore: response.storeBefore.proposed,
      storeAfter: response.storeAfter.proposed,
    });

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[propose] Error:', errorMessage);
    response.error = errorMessage;
    return NextResponse.json(response, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
