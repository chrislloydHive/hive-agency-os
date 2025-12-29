// app/api/os/companies/[companyId]/context/v4/health/route.ts
// Context V4 Healthcheck API
//
// Returns a stable contract summarizing V4 health status:
// - GREEN: Healthy and ready
// - YELLOW: Needs attention but not broken
// - RED: Broken or disabled
//
// Reuses existing helpers from fieldStoreV4 and runs

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextFieldsV4, getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { hydrateContextGraph } from '@/lib/contextGraph/nodes/hydration';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
} from '@/lib/types/contextField';
import {
  extractWebsiteLabResult,
  buildWebsiteLabCandidates,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import type {
  V4HealthReason,
  V4HealthResponse,
} from '@/lib/types/contextV4Health';
import { WEBSITELAB_STALE_THRESHOLD_MINUTES } from '@/lib/types/contextV4Health';

// Force dynamic rendering - never cache this endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Compute age in minutes from a date string
 */
function computeAgeMinutes(createdAt: string | null): number | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
}

/**
 * GET /api/os/companies/[companyId]/context/v4/health
 * Returns V4 health status
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;
  const now = new Date().toISOString();

  // Initialize response with defaults
  const response: V4HealthResponse = {
    healthVersion: 1,
    companyId,
    timestamp: now,
    status: 'GREEN',
    reasons: [],
    flags: {
      CONTEXT_V4_ENABLED: isContextV4Enabled(),
      CONTEXT_V4_INGEST_WEBSITELAB: isContextV4IngestWebsiteLabEnabled(),
    },
    websiteLab: {
      hasRun: false,
      runId: null,
      createdAt: null,
      ageMinutes: null,
      staleThresholdMinutes: WEBSITELAB_STALE_THRESHOLD_MINUTES,
    },
    propose: {
      lastReason: null,
      proposedCount: null,
      createdCount: null,
      skippedCount: null,
      lastRunId: null,
    },
    store: {
      total: null,
      proposed: null,
      confirmed: null,
      rejected: null,
    },
    links: {
      inspectorPath: `/c/${companyId}/admin/context-inspector`,
      proposeApiPath: `/api/os/companies/${companyId}/context/v4/propose-website-lab`,
    },
  };

  const reasons: V4HealthReason[] = [];

  try {
    // Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      response.status = 'RED';
      response.reasons = ['UNKNOWN'];
      response.error = 'Company not found';
      return NextResponse.json(response, {
        status: 404,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      });
    }

    // ========================================================================
    // Check 1: Feature Flags (RED if disabled)
    // ========================================================================
    if (!isContextV4IngestWebsiteLabEnabled()) {
      reasons.push('FLAG_DISABLED');
    }

    // ========================================================================
    // Check 2: V4 Store (RED if unavailable)
    // ========================================================================
    let storeAvailable = false;
    let v4ConfirmedCount = 0;
    try {
      const store = await loadContextFieldsV4(companyId);
      if (store) {
        storeAvailable = true;
        const counts = await getFieldCountsV4(companyId);
        v4ConfirmedCount = counts.confirmed;
        response.store = {
          total: counts.total,
          proposed: counts.proposed,
          confirmed: counts.confirmed,
          rejected: counts.rejected,
        };
      } else if (isContextV4Enabled()) {
        // Store doesn't exist yet but could be created - not an error
        response.store = { total: 0, proposed: 0, confirmed: 0, rejected: 0 };
        storeAvailable = true;
      }
    } catch (storeError) {
      console.error('[V4 Health] Store error:', storeError);
      reasons.push('NO_V4_STORE');
    }

    // ========================================================================
    // Check 2b: Legacy ContextGraphs fallback for confirmed count
    // If V4 store has 0 confirmed, check legacy ContextGraphs for user's
    // confirmed context fields. This ensures Strategy tab is available
    // when user has confirmed context via the legacy system.
    // ========================================================================
    if (v4ConfirmedCount === 0) {
      try {
        const legacyGraph = await loadContextGraph(companyId);
        if (legacyGraph) {
          const nodeMap = await hydrateContextGraph(legacyGraph);
          const allNodes = Array.from(nodeMap.values());
          // Count nodes that are 'confirmed' status (not 'proposed' or 'missing')
          const confirmedNodes = allNodes.filter(
            node => node.status === 'confirmed' && node.value !== null
          );
          if (confirmedNodes.length > 0) {
            // Use legacy confirmed count as fallback
            response.store = {
              total: allNodes.length,
              proposed: allNodes.filter(n => n.status === 'proposed').length,
              confirmed: confirmedNodes.length,
              rejected: 0,
            };
            console.log(`[V4 Health] Using legacy fallback: ${confirmedNodes.length} confirmed from ContextGraphs`);
          }
        }
      } catch (legacyError) {
        console.warn('[V4 Health] Legacy fallback failed:', legacyError);
        // Continue without fallback - V4 counts remain
      }
    }

    if (!storeAvailable && !reasons.includes('NO_V4_STORE')) {
      // Only add if V4 is enabled but store is truly unavailable
      if (isContextV4Enabled()) {
        reasons.push('NO_V4_STORE');
      }
    }

    // ========================================================================
    // Check 3: WebsiteLab Run (YELLOW if missing or stale)
    // ========================================================================
    try {
      const latestRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');

      if (!latestRun) {
        reasons.push('NO_WEBSITELAB_RUN');
      } else {
        response.websiteLab.hasRun = true;
        response.websiteLab.runId = latestRun.id;
        response.websiteLab.createdAt = latestRun.createdAt;
        response.websiteLab.ageMinutes = computeAgeMinutes(latestRun.createdAt);

        // Check if stale
        if (
          response.websiteLab.ageMinutes !== null &&
          response.websiteLab.ageMinutes > WEBSITELAB_STALE_THRESHOLD_MINUTES
        ) {
          reasons.push('WEBSITELAB_STALE');
        }

        // ====================================================================
        // Check 4: Proposal Analysis (compute what would happen)
        // ====================================================================
        if (latestRun.rawJson) {
          response.propose.lastRunId = latestRun.id;

          // Try to extract and see what reason we'd get
          const extraction = extractWebsiteLabResult(latestRun.rawJson);

          if (!extraction) {
            response.propose.lastReason = 'EXTRACT_PATH_MISSING';
            reasons.push('PROPOSE_ZERO_EXTRACT_MISSING');
          } else {
            // Build candidates to see what we'd get
            const candidateResult = buildWebsiteLabCandidates(latestRun.rawJson);

            if (candidateResult.candidates.length === 0) {
              response.propose.lastReason = 'NO_CANDIDATES';
              reasons.push('PROPOSE_ZERO_NO_CANDIDATES');
            } else {
              // We have candidates - check if they'd all be duplicates
              // This requires comparing against existing store
              const store = await loadContextFieldsV4(companyId);
              if (store) {
                const existingKeys = new Set(Object.keys(store.fields));
                const allDuplicates = candidateResult.candidates.every(c =>
                  existingKeys.has(c.key)
                );

                if (allDuplicates && candidateResult.candidates.length > 0) {
                  response.propose.lastReason = 'ALL_DUPLICATES';
                  reasons.push('PROPOSE_ZERO_ALL_DUPLICATES');
                } else {
                  response.propose.lastReason = 'SUCCESS';
                }

                response.propose.proposedCount = candidateResult.candidates.length;
                response.propose.skippedCount = allDuplicates
                  ? candidateResult.candidates.length
                  : 0;
              } else {
                // No store yet, so these would be new proposals
                response.propose.lastReason = 'SUCCESS';
                response.propose.proposedCount = candidateResult.candidates.length;
                response.propose.createdCount = candidateResult.candidates.length;
              }
            }
          }
        }
      }
    } catch (runError) {
      console.error('[V4 Health] Run fetch error:', runError);
      // Don't add a reason for this - it's transient
    }

    // ========================================================================
    // Compute Final Status
    // ========================================================================
    // RED conditions
    const redReasons: V4HealthReason[] = [
      'FLAG_DISABLED',
      'NO_V4_STORE',
      'INSPECT_UNAVAILABLE',
      'PROPOSE_ZERO_STORE_WRITE_FAILED',
      'PROPOSE_ENDPOINT_ERROR',
    ];

    // YELLOW conditions
    const yellowReasons: V4HealthReason[] = [
      'NO_WEBSITELAB_RUN',
      'WEBSITELAB_STALE',
      'PROPOSE_ZERO_NO_CANDIDATES',
      'PROPOSE_ZERO_EXTRACT_MISSING',
      'PROPOSE_ZERO_ALL_DUPLICATES',
    ];

    const hasRed = reasons.some(r => redReasons.includes(r));
    const hasYellow = reasons.some(r => yellowReasons.includes(r));

    if (hasRed) {
      response.status = 'RED';
    } else if (hasYellow) {
      response.status = 'YELLOW';
    } else {
      response.status = 'GREEN';
    }

    response.reasons = reasons;

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[V4 Health] Error:', errorMessage);

    response.status = 'RED';
    response.reasons = ['INSPECT_UNAVAILABLE'];
    response.error = errorMessage;

    return NextResponse.json(response, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
