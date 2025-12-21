// app/api/os/companies/[companyId]/context/v4/inspect/route.ts
// Context V4 Inspector API: "Truth Packet" endpoint
//
// Returns comprehensive debugging info to prove V4 state:
// - Feature flags status
// - Latest WebsiteLab run info with extraction validation
// - V4 store counts by status
// - Proposed fields by source
// - Sample of WebsiteLab proposed fields
// - Legacy context graph snapshot
// - Proposal summary (computed from current state)

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getGapPlanRunsForCompany } from '@/lib/airtable/gapPlanRuns';
import { loadContextFieldsV4WithError, getV4StoreDebugInfo, type V4StoreErrorCode } from '@/lib/contextGraph/fieldStoreV4';
import { getProposalStoreDebugInfo } from '@/lib/contextGraph/nodes/proposalStorage';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
  isContextV4IngestBrandLabEnabled,
  isContextV4IngestGapPlanEnabled,
  type ContextFieldSourceV4,
} from '@/lib/types/contextField';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import {
  extractWebsiteLabResult,
  buildWebsiteLabCandidates,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import {
  extractBrandLabResult,
  buildBrandLabCandidates,
} from '@/lib/contextGraph/v4/brandLabCandidates';
import {
  extractGapPlanStructured,
  buildGapPlanCandidates,
} from '@/lib/contextGraph/v4/gapPlanCandidates';
import type {
  InspectV4Response,
  ProposalReason,
} from '@/lib/types/contextV4Debug';

// Force dynamic rendering - never cache this endpoint
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * GET /api/os/companies/[companyId]/context/v4/inspect
 * Returns a "truth packet" for debugging V4 state
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { ok: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Build response
    const response: InspectV4Response = {
      ok: true,
      inspectVersion: 1,
      companyId,
      companyName: company.name,
      timestamp: new Date().toISOString(),

      // Feature flags
      flags: {
        CONTEXT_V4_ENABLED: isContextV4Enabled(),
        CONTEXT_V4_INGEST_WEBSITELAB: isContextV4IngestWebsiteLabEnabled(),
        CONTEXT_V4_INGEST_BRANDLAB: isContextV4IngestBrandLabEnabled(),
        CONTEXT_V4_INGEST_GAPPLAN: isContextV4IngestGapPlanEnabled(),
        envVars: {
          CONTEXT_V4_ENABLED: process.env.CONTEXT_V4_ENABLED,
          CONTEXT_V4_INGEST_WEBSITELAB: process.env.CONTEXT_V4_INGEST_WEBSITELAB,
          CONTEXT_V4_INGEST_BRANDLAB: process.env.CONTEXT_V4_INGEST_BRANDLAB,
          CONTEXT_V4_INGEST_GAPPLAN: process.env.CONTEXT_V4_INGEST_GAPPLAN,
        },
      },

      // Initialize with defaults - will be populated below
      latestWebsiteLab: {
        runId: null,
        createdAt: null,
        status: null,
        score: null,
        hasRawJson: false,
        extractionPathOk: false,
        extractionPath: null,
        candidatesCount: null,
      },
      latestBrandLab: {
        runId: null,
        createdAt: null,
        status: null,
        score: null,
        hasRawJson: false,
        extractionPathOk: false,
        extractionPath: null,
        candidatesCount: null,
      },
      latestGapPlan: {
        runId: null,
        createdAt: null,
        status: null,
        overallScore: null,
        hasDataJson: false,
        extractionPathOk: false,
        extractionPath: null,
        candidatesCount: null,
      },
      v4StoreCounts: {
        confirmed: 0,
        proposed: 0,
        rejected: 0,
        total: 0,
        storeExists: false,
        loadErrorCode: null,
        loadErrorMessage: null,
      },
      proposedBySource: {
        user: 0,
        lab: 0,
        gap: 0,
        ai: 0,
        import: 0,
        crm: 0,
      },
      proposedWebsiteLabSample: [],
      materializedGraphSnapshot: {
        websiteKeysPresent: 0,
        sampleKeys: [],
        graphExists: false,
      },
      cachingHints: {
        dynamicRoute: true,
        noStoreFetchUsed: true,
      },
    };

    // Add runtime env consistency info (for debugging authorization issues)
    const v4StoreDebug = getV4StoreDebugInfo();
    const proposalStoreDebug = getProposalStoreDebugInfo();
    response.envConsistency = {
      v4Store: {
        baseId: v4StoreDebug.baseId,
        tableName: v4StoreDebug.tableName,
        tokenEnvVar: v4StoreDebug.tokenEnvVar,
      },
      proposalStore: {
        baseId: proposalStoreDebug.baseId,
        tableName: proposalStoreDebug.tableName,
        tokenEnvVar: proposalStoreDebug.tokenEnvVar,
      },
      consistent: v4StoreDebug.baseId === proposalStoreDebug.baseId &&
                  v4StoreDebug.tokenEnvVar === proposalStoreDebug.tokenEnvVar,
    };

    // Get latest WebsiteLab run
    const latestRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
    if (latestRun) {
      response.latestWebsiteLab.runId = latestRun.id;
      response.latestWebsiteLab.createdAt = latestRun.createdAt;
      response.latestWebsiteLab.status = latestRun.status;
      response.latestWebsiteLab.score = latestRun.score;
      response.latestWebsiteLab.hasRawJson = !!latestRun.rawJson;

      // Check extraction path and candidates
      if (latestRun.rawJson) {
        const extraction = extractWebsiteLabResult(latestRun.rawJson);
        if (extraction) {
          response.latestWebsiteLab.extractionPathOk = true;
          response.latestWebsiteLab.extractionPath = extraction.extractionPath;

          // Build candidates to get count and debug info
          const candidateResult = buildWebsiteLabCandidates(latestRun.rawJson);
          response.latestWebsiteLab.candidatesCount = candidateResult.candidates.length;

          // Attach error state if detected (blocks proposals)
          if (candidateResult.errorState?.isError) {
            response.latestWebsiteLab.errorState = {
              isError: true,
              errorType: candidateResult.errorState.errorType,
              errorMessage: candidateResult.errorState.errorMessage,
              httpStatus: candidateResult.errorState.httpStatus,
            };
          }

          // Attach debug info if NO_CANDIDATES
          if (candidateResult.candidates.length === 0 && candidateResult.debug) {
            response.latestWebsiteLab.debug = candidateResult.debug;
          }
        }
      }
    }

    // Get latest Brand Lab run
    const latestBrandLabRun = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
    if (latestBrandLabRun) {
      response.latestBrandLab!.runId = latestBrandLabRun.id;
      response.latestBrandLab!.createdAt = latestBrandLabRun.createdAt;
      response.latestBrandLab!.status = latestBrandLabRun.status;
      response.latestBrandLab!.score = latestBrandLabRun.score;
      response.latestBrandLab!.hasRawJson = !!latestBrandLabRun.rawJson;

      // Check extraction path and candidates
      if (latestBrandLabRun.rawJson) {
        const extraction = extractBrandLabResult(latestBrandLabRun.rawJson);
        if (extraction) {
          response.latestBrandLab!.extractionPathOk = true;
          response.latestBrandLab!.extractionPath = extraction.extractionPath;

          // Build candidates to get count and debug info
          const candidateResult = buildBrandLabCandidates(latestBrandLabRun.rawJson);
          response.latestBrandLab!.candidatesCount = candidateResult.candidates.length;

          // Attach debug info if NO_CANDIDATES
          if (candidateResult.candidates.length === 0 && candidateResult.debug) {
            response.latestBrandLab!.debug = candidateResult.debug;
          }
        }
      }
    }

    // Get latest GAP Plan run
    const gapPlanRuns = await getGapPlanRunsForCompany(companyId, 1);
    const latestGapPlanRun = gapPlanRuns.find((r) => r.status === 'completed' && r.dataJson);
    if (latestGapPlanRun) {
      response.latestGapPlan!.runId = latestGapPlanRun.id;
      response.latestGapPlan!.createdAt = latestGapPlanRun.createdAt || null;
      response.latestGapPlan!.status = latestGapPlanRun.status;
      response.latestGapPlan!.overallScore = latestGapPlanRun.overallScore || null;
      response.latestGapPlan!.hasDataJson = !!latestGapPlanRun.dataJson;

      // Check extraction path and candidates
      if (latestGapPlanRun.dataJson) {
        const extraction = extractGapPlanStructured(latestGapPlanRun.dataJson);
        if (extraction) {
          response.latestGapPlan!.extractionPathOk = true;
          response.latestGapPlan!.extractionPath = 'gapStructured';

          // Build candidates to get count and debug info
          const candidateResult = buildGapPlanCandidates(latestGapPlanRun.dataJson);
          response.latestGapPlan!.candidatesCount = candidateResult.candidates.length;

          // Attach debug info if NO_CANDIDATES
          if (candidateResult.candidates.length === 0 && candidateResult.debug) {
            response.latestGapPlan!.debug = candidateResult.debug;
          }
        }
      }
    }

    // Get V4 store (with error details)
    const storeResult = await loadContextFieldsV4WithError(companyId);
    const store = storeResult.store;

    // Record any load errors
    if (storeResult.error) {
      response.v4StoreCounts.loadErrorCode = storeResult.error;
      response.v4StoreCounts.loadErrorMessage = storeResult.errorMessage;
    }

    if (store) {
      response.v4StoreCounts.storeExists = true;
      const fields = Object.values(store.fields);

      response.v4StoreCounts.confirmed = fields.filter(f => f.status === 'confirmed').length;
      response.v4StoreCounts.proposed = fields.filter(f => f.status === 'proposed').length;
      response.v4StoreCounts.rejected = fields.filter(f => f.status === 'rejected').length;
      response.v4StoreCounts.total = fields.length;

      // Count proposed by source
      const proposedFields = fields.filter(f => f.status === 'proposed');
      for (const field of proposedFields) {
        const source = field.source as ContextFieldSourceV4;
        if (response.proposedBySource[source] !== undefined) {
          response.proposedBySource[source]++;
        }
      }

      // Get sample of WebsiteLab proposed fields
      const websiteLabProposed = proposedFields.filter(
        f => f.evidence?.importerId === 'websiteLab' || f.evidence?.originalSource === 'websiteLab'
      );
      response.proposedWebsiteLabSample = websiteLabProposed.slice(0, 10).map(f => ({
        key: f.key,
        domain: f.domain,
        status: f.status,
        confidence: f.confidence,
        updatedAt: f.updatedAt,
        evidence: {
          runId: f.evidence?.runId,
          rawPath: f.evidence?.rawPath,
          importerId: f.evidence?.importerId,
        },
      }));

      // Proposal persistence tracking
      response.persistedProposalsCount = proposedFields.length;

      // Find the most recent auto-proposed field (from lab sources)
      // Auto-proposed = proposed by lab/gap source (not user)
      const autoProposedFields = proposedFields.filter(
        f => f.source === 'lab' || f.source === 'gap'
      );
      response.autoProposedCount = autoProposedFields.length;

      if (autoProposedFields.length > 0) {
        // Sort by updatedAt descending to find most recent
        const sortedByDate = [...autoProposedFields].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        response.lastAutoProposeAt = sortedByDate[0].updatedAt;
      } else {
        response.lastAutoProposeAt = null;
      }
    } else {
      // No store exists - set defaults
      response.persistedProposalsCount = 0;
      response.autoProposedCount = 0;
      response.lastAutoProposeAt = null;
    }

    // ====================================================================
    // Compute WebsiteLab proposal summary
    // ====================================================================
    // Check for store errors first - they affect all proposals
    const storeErrorReason: ProposalReason | null =
      storeResult.error === 'UNAUTHORIZED' ? 'STORE_UNAUTHORIZED' :
      storeResult.error === 'NOT_FOUND' ? 'STORE_NOT_FOUND' :
      null;

    if (latestRun && response.latestWebsiteLab.hasRawJson) {
      let reason: ProposalReason = 'UNKNOWN';

      // Store errors take precedence
      if (storeErrorReason) {
        reason = storeErrorReason;
      } else if (!isContextV4IngestWebsiteLabEnabled()) {
        reason = 'FLAG_DISABLED';
      } else if (response.latestWebsiteLab.errorState?.isError) {
        // ERROR STATE - lab output contains error messages, do not propose
        reason = 'ERROR_STATE';
      } else if (!response.latestWebsiteLab.extractionPathOk) {
        reason = 'EXTRACT_PATH_MISSING';
      } else if (response.latestWebsiteLab.candidatesCount === 0) {
        reason = 'NO_CANDIDATES';
      } else if (response.latestWebsiteLab.candidatesCount !== null && response.latestWebsiteLab.candidatesCount > 0) {
        // Would have candidates - check if they'd be duplicates
        const websiteLabProposedCount = response.proposedWebsiteLabSample.length;
        if (websiteLabProposedCount > 0) {
          reason = 'SUCCESS';
        } else {
          reason = 'SUCCESS';
        }
      }

      // If error state, wouldPropose should be 0 (we blocked proposals)
      const wouldPropose = response.latestWebsiteLab.errorState?.isError
        ? 0
        : response.latestWebsiteLab.candidatesCount ?? 0;

      const websiteLabSummary = {
        wouldPropose,
        reason,
      };
      response.proposeSummary = websiteLabSummary; // backward compat
      response.proposeSummaryWebsiteLab = websiteLabSummary;
    } else if (!latestRun) {
      const noRunSummary = {
        wouldPropose: 0,
        reason: storeErrorReason || 'NO_RUN' as ProposalReason,
      };
      response.proposeSummary = noRunSummary;
      response.proposeSummaryWebsiteLab = noRunSummary;
    }

    // ====================================================================
    // Compute BrandLab proposal summary
    // ====================================================================
    if (latestBrandLabRun && response.latestBrandLab?.hasRawJson) {
      let reason: ProposalReason = 'UNKNOWN';

      // Store errors take precedence
      if (storeErrorReason) {
        reason = storeErrorReason;
      } else if (!isContextV4IngestBrandLabEnabled()) {
        reason = 'FLAG_DISABLED';
      } else if (!response.latestBrandLab.extractionPathOk) {
        reason = 'EXTRACT_PATH_MISSING';
      } else if (response.latestBrandLab.candidatesCount === 0) {
        reason = 'NO_CANDIDATES';
      } else if (response.latestBrandLab.candidatesCount !== null && response.latestBrandLab.candidatesCount > 0) {
        reason = 'SUCCESS';
      }

      response.proposeSummaryBrandLab = {
        wouldPropose: response.latestBrandLab.candidatesCount ?? 0,
        reason,
      };
    } else if (!latestBrandLabRun) {
      response.proposeSummaryBrandLab = {
        wouldPropose: 0,
        reason: storeErrorReason || 'NO_RUN',
      };
    }

    // ====================================================================
    // Compute GAP Plan proposal summary
    // ====================================================================
    if (response.latestGapPlan?.hasDataJson) {
      let reason: ProposalReason = 'UNKNOWN';

      // Store errors take precedence
      if (storeErrorReason) {
        reason = storeErrorReason;
      } else if (!isContextV4IngestGapPlanEnabled()) {
        reason = 'FLAG_DISABLED';
      } else if (!response.latestGapPlan.extractionPathOk) {
        reason = 'EXTRACT_PATH_MISSING';
      } else if (response.latestGapPlan.candidatesCount === 0) {
        reason = 'NO_CANDIDATES';
      } else if (response.latestGapPlan.candidatesCount !== null && response.latestGapPlan.candidatesCount > 0) {
        reason = 'SUCCESS';
      }

      response.proposeSummaryGapPlan = {
        wouldPropose: response.latestGapPlan.candidatesCount ?? 0,
        reason,
      };
    } else {
      response.proposeSummaryGapPlan = {
        wouldPropose: 0,
        reason: storeErrorReason || 'NO_RUN',
      };
    }

    // Get legacy context graph
    try {
      const graph = await loadContextGraph(companyId);
      if (graph) {
        response.materializedGraphSnapshot.graphExists = true;

        // Get all website.* keys
        const websiteKeys: string[] = [];

        // Check website domain
        if (graph.website) {
          for (const [key, value] of Object.entries(graph.website)) {
            if (value !== null && value !== undefined) {
              websiteKeys.push(`website.${key}`);
            }
          }
        }

        response.materializedGraphSnapshot.websiteKeysPresent = websiteKeys.length;
        response.materializedGraphSnapshot.sampleKeys = websiteKeys.slice(0, 20);
      }
    } catch (graphError) {
      console.warn('[V4 Inspect] Failed to load legacy graph:', graphError);
    }

    // ====================================================================
    // Compute next action hint
    // ====================================================================
    // If wouldPropose > 0 but store.proposed = 0, proposals haven't been generated
    const totalWouldPropose =
      (response.proposeSummaryWebsiteLab?.wouldPropose || 0) +
      (response.proposeSummaryBrandLab?.wouldPropose || 0) +
      (response.proposeSummaryGapPlan?.wouldPropose || 0);

    const persistedProposed = response.v4StoreCounts.proposed;

    if (totalWouldPropose > 0 && persistedProposed === 0 && !storeErrorReason) {
      response.nextAction = {
        type: 'GENERATE_PROPOSALS',
        message: `${totalWouldPropose} candidates detected but not yet proposed. Call POST /context/v4/propose to generate proposals.`,
        endpoint: `/api/os/companies/${companyId}/context/v4/propose`,
      };
    } else if (persistedProposed > 0) {
      response.nextAction = {
        type: 'REVIEW_PROPOSALS',
        message: `${persistedProposed} proposals ready for review.`,
        endpoint: `/context-v4/${companyId}/review`,
      };
    } else if (storeErrorReason) {
      response.nextAction = {
        type: 'FIX_STORE_ACCESS',
        message: storeResult.errorMessage || 'Store access error',
        endpoint: null,
      };
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[V4 Inspect] Error:', errorMessage);

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
