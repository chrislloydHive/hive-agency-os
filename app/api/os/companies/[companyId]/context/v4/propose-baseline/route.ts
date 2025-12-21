// app/api/os/companies/[companyId]/context/v4/propose-baseline/route.ts
// Context V4: Batch Baseline Proposal
//
// Proposes all missing required strategy fields from available lab sources.
// This is a one-click action to generate baseline proposals for review.
// Includes per-company cooldown to prevent rapid re-generation.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextFieldsV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import {
  buildWebsiteLabCandidates,
  extractWebsiteLabResult,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import { proposeFromLabResult, type LabCandidate } from '@/lib/contextGraph/v4/propose';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
} from '@/lib/types/contextField';
import {
  V4_REQUIRED_STRATEGY_FIELDS,
  getMissingRequiredV4,
} from '@/lib/contextGraph/v4/requiredStrategyFields';
import {
  getCooldownRemaining,
  setCooldown,
  getCooldownInfo,
  DEFAULT_COOLDOWN_SECONDS,
} from '@/lib/contextGraph/v4/cooldown';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

interface ProposeBaselineRequest {
  mode?: 'required-only'; // default required-only
}

interface ProposeFieldResult {
  fieldKey: string;
  status: 'created' | 'skipped' | 'failed';
  reason?: string;
}

interface ProposeBaselineResponse {
  ok: boolean;
  attempted: number;
  created: number;
  skipped: number;
  failed: number;
  results: ProposeFieldResult[];
  reviewUrl?: string;
  error?: string;
  // Cooldown info
  cooldown?: {
    active: boolean;
    remainingSeconds: number | null;
    generatedAt: string | null;
    expiresAt: string | null;
  };
}

/**
 * POST /api/os/companies/[companyId]/context/v4/propose-baseline
 *
 * Batch proposal for all missing required strategy fields.
 * Uses available lab sources to propose values.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  const response: ProposeBaselineResponse = {
    ok: false,
    attempted: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  try {
    // Check cooldown FIRST - before any expensive operations
    const cooldownRemaining = getCooldownRemaining(companyId);
    if (cooldownRemaining !== null) {
      const cooldownInfo = getCooldownInfo(companyId);
      response.error = `Proposals recently generated. Please wait ${cooldownRemaining} seconds.`;
      response.cooldown = {
        active: true,
        remainingSeconds: cooldownRemaining,
        generatedAt: cooldownInfo.generatedAt,
        expiresAt: cooldownInfo.expiresAt,
      };

      // Return 429 Too Many Requests with Retry-After header
      return NextResponse.json(response, {
        status: 429,
        headers: {
          'Retry-After': String(cooldownRemaining),
        },
      });
    }

    // Parse request body (optional)
    let body: ProposeBaselineRequest = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    // Check feature flags
    if (!isContextV4Enabled()) {
      response.error = 'Context V4 is not enabled';
      return NextResponse.json(response, { status: 400 });
    }

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      response.error = 'Company not found';
      return NextResponse.json(response, { status: 404 });
    }

    // Load V4 store to get current field status
    const store = await loadContextFieldsV4(companyId);
    const confirmedKeys = new Set<string>();
    const proposedKeys = new Set<string>();

    if (store) {
      for (const [key, field] of Object.entries(store.fields)) {
        if (field.status === 'confirmed') {
          confirmedKeys.add(key);
        } else if (field.status === 'proposed') {
          proposedKeys.add(key);
        }
      }
    }

    // Get missing required fields
    const missingRequired = getMissingRequiredV4(confirmedKeys, proposedKeys);
    const missingPaths = new Set(missingRequired.map((f) => f.path));

    // Also include alternatives that are missing
    for (const field of missingRequired) {
      if (field.alternatives) {
        for (const alt of field.alternatives) {
          if (!confirmedKeys.has(alt) && !proposedKeys.has(alt)) {
            missingPaths.add(alt);
          }
        }
      }
    }

    if (missingPaths.size === 0) {
      response.ok = true;
      response.results.push({
        fieldKey: '*',
        status: 'skipped',
        reason: 'All required fields are already populated',
      });
      return NextResponse.json(response);
    }

    // Collect candidates from available lab sources
    const allCandidates: LabCandidate[] = [];
    let sourceId: string | null = null;
    let extractionPath: string | undefined;

    // Try WebsiteLab
    if (isContextV4IngestWebsiteLabEnabled()) {
      const websiteLabRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
      if (websiteLabRun?.rawJson) {
        const extraction = extractWebsiteLabResult(websiteLabRun.rawJson);
        if (extraction) {
          const candidateResult = buildWebsiteLabCandidates(websiteLabRun.rawJson);
          // Filter to only missing required fields
          const filtered = candidateResult.candidates.filter((c) =>
            missingPaths.has(c.key)
          );
          allCandidates.push(...filtered);
          sourceId = websiteLabRun.id;
          extractionPath = candidateResult.extractionPath;
        }
      }
    }

    // TODO: Add other lab sources (brandLab, gapPlan) when available

    // Track which fields we're attempting
    response.attempted = missingPaths.size;

    if (allCandidates.length === 0) {
      // No candidates found from labs
      response.ok = true;
      for (const path of missingPaths) {
        response.results.push({
          fieldKey: path,
          status: 'skipped',
          reason: 'No lab signal available',
        });
        response.skipped++;
      }
      return NextResponse.json(response);
    }

    // Propose candidates sequentially (safe, respects trust rules)
    if (sourceId && extractionPath) {
      const proposalResult = await proposeFromLabResult({
        companyId,
        importerId: 'websiteLab',
        source: 'lab',
        sourceId,
        extractionPath,
        candidates: allCandidates,
      });

      // Map results
      for (const key of proposalResult.proposedKeys) {
        response.results.push({
          fieldKey: key,
          status: 'created',
        });
        response.created++;
      }

      for (const key of proposalResult.blockedKeys) {
        response.results.push({
          fieldKey: key,
          status: 'skipped',
          reason: 'Blocked by trust rules',
        });
        response.skipped++;
      }

      // Mark fields without candidates as skipped
      const processedKeys = new Set([
        ...proposalResult.proposedKeys,
        ...proposalResult.blockedKeys,
      ]);
      for (const path of missingPaths) {
        if (!processedKeys.has(path)) {
          response.results.push({
            fieldKey: path,
            status: 'skipped',
            reason: 'No lab signal available',
          });
          response.skipped++;
        }
      }
    }

    response.ok = true;
    response.reviewUrl = `/context-v4/${companyId}/review`;

    // Set cooldown after successful proposal generation
    const cooldownEntry = setCooldown(companyId, DEFAULT_COOLDOWN_SECONDS);
    response.cooldown = {
      active: true,
      remainingSeconds: DEFAULT_COOLDOWN_SECONDS,
      generatedAt: new Date(cooldownEntry.generatedAt).toISOString(),
      expiresAt: new Date(cooldownEntry.expiresAt).toISOString(),
    };

    console.log('[propose-baseline] Complete:', {
      companyId,
      attempted: response.attempted,
      created: response.created,
      skipped: response.skipped,
      failed: response.failed,
      cooldownUntil: response.cooldown.expiresAt,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[propose-baseline] Error:', errorMessage);
    response.error = errorMessage;
    return NextResponse.json(response, { status: 500 });
  }
}
