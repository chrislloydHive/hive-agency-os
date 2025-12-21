// tests/context/health-helpers.ts
// Helper for testing health computation logic
//
// This extracts the core health computation logic from the endpoint
// so it can be tested directly without HTTP layer.

import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextFieldsV4, getFieldCountsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
} from '@/lib/types/contextField';
import {
  extractWebsiteLabResult,
  buildWebsiteLabCandidates,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import type {
  V4HealthStatus,
  V4HealthReason,
  V4HealthResponse,
} from '@/lib/types/contextV4Health';
import { WEBSITELAB_STALE_THRESHOLD_MINUTES } from '@/lib/types/contextV4Health';

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
 * Core health computation logic - extracted for testing
 */
export async function computeHealthStatus(companyId: string): Promise<V4HealthResponse> {
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

  // Check 1: Feature Flags (RED if disabled)
  if (!isContextV4IngestWebsiteLabEnabled()) {
    reasons.push('FLAG_DISABLED');
  }

  // Check 2: V4 Store
  let storeAvailable = false;
  try {
    const store = await loadContextFieldsV4(companyId);
    if (store) {
      storeAvailable = true;
      const counts = await getFieldCountsV4(companyId);
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
    reasons.push('NO_V4_STORE');
  }

  // Check 3: WebsiteLab Run
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

      // Check 4: Proposal Analysis
      if (latestRun.rawJson) {
        response.propose.lastRunId = latestRun.id;

        const extraction = extractWebsiteLabResult(latestRun.rawJson);

        if (!extraction) {
          response.propose.lastReason = 'EXTRACT_PATH_MISSING';
          reasons.push('PROPOSE_ZERO_EXTRACT_MISSING');
        } else {
          const candidateResult = buildWebsiteLabCandidates(latestRun.rawJson);

          if (candidateResult.candidates.length === 0) {
            response.propose.lastReason = 'NO_CANDIDATES';
            reasons.push('PROPOSE_ZERO_NO_CANDIDATES');
          } else {
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
              response.propose.lastReason = 'SUCCESS';
              response.propose.proposedCount = candidateResult.candidates.length;
              response.propose.createdCount = candidateResult.candidates.length;
            }
          }
        }
      }
    }
  } catch (runError) {
    // Don't add a reason for transient errors
  }

  // Compute Final Status
  const redReasons: V4HealthReason[] = [
    'FLAG_DISABLED',
    'NO_V4_STORE',
    'INSPECT_UNAVAILABLE',
    'PROPOSE_ZERO_STORE_WRITE_FAILED',
    'PROPOSE_ENDPOINT_ERROR',
  ];

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

  return response;
}
