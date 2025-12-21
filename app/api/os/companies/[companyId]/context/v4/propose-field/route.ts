// app/api/os/companies/[companyId]/context/v4/propose-field/route.ts
// Context V4: Targeted Field Proposal
//
// Proposes a single field from available lab sources.
// This endpoint filters the existing lab data to a specific field key.

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { getLatestRunForCompanyAndTool } from '@/lib/os/diagnostics/runs';
import {
  buildWebsiteLabCandidates,
  extractWebsiteLabResult,
} from '@/lib/contextGraph/v4/websiteLabCandidates';
import { proposeFromLabResult } from '@/lib/contextGraph/v4/propose';
import {
  isContextV4Enabled,
  isContextV4IngestWebsiteLabEnabled,
} from '@/lib/types/contextField';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

interface ProposeFieldRequest {
  fieldKey: string;
  sources?: string[];
}

interface ProposeFieldResponse {
  ok: boolean;
  fieldKey: string;
  proposedCount: number;
  reason: string;
  error?: string;
}

/**
 * POST /api/os/companies/[companyId]/context/v4/propose-field
 *
 * Targeted proposal for a single field.
 *
 * Request body:
 *   - fieldKey: string (e.g., "website.websiteScore")
 *   - sources?: string[] (e.g., ["websiteLab", "brandLab"])
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { companyId } = await params;

  // Initialize response
  const response: ProposeFieldResponse = {
    ok: false,
    fieldKey: '',
    proposedCount: 0,
    reason: 'UNKNOWN',
  };

  try {
    // Parse request body
    const body: ProposeFieldRequest = await request.json();
    response.fieldKey = body.fieldKey;

    if (!body.fieldKey) {
      response.reason = 'MISSING_FIELD_KEY';
      response.error = 'fieldKey is required';
      return NextResponse.json(response, { status: 400 });
    }

    // Check feature flags
    if (!isContextV4Enabled()) {
      response.reason = 'FLAG_DISABLED';
      response.error = 'Context V4 is not enabled';
      return NextResponse.json(response, { status: 400 });
    }

    // Load company
    const company = await getCompanyById(companyId);
    if (!company) {
      response.reason = 'COMPANY_NOT_FOUND';
      response.error = 'Company not found';
      return NextResponse.json(response, { status: 404 });
    }

    // Determine which sources to use
    const sources = body.sources || ['websiteLab'];
    const domain = body.fieldKey.split('.')[0];

    // For now, we only support websiteLab for website/digitalInfra domains
    if (sources.includes('websiteLab') && (domain === 'website' || domain === 'digitalInfra')) {
      if (!isContextV4IngestWebsiteLabEnabled()) {
        response.reason = 'FLAG_DISABLED';
        response.error = 'WebsiteLab ingestion is disabled';
        return NextResponse.json(response, { status: 400 });
      }

      // Get latest WebsiteLab run
      const latestRun = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
      if (!latestRun || !latestRun.rawJson) {
        response.reason = 'NO_RUN';
        response.error = 'No WebsiteLab diagnostic run found';
        return NextResponse.json(response, { status: 404 });
      }

      // Extract candidates
      const extraction = extractWebsiteLabResult(latestRun.rawJson);
      if (!extraction) {
        response.reason = 'EXTRACT_PATH_MISSING';
        response.error = 'Could not extract lab data';
        return NextResponse.json(response, { status: 400 });
      }

      // Build all candidates, then filter to just the target field
      const candidateResult = buildWebsiteLabCandidates(latestRun.rawJson);
      const targetCandidate = candidateResult.candidates.find(
        (c) => c.key === body.fieldKey
      );

      if (!targetCandidate) {
        response.reason = 'NO_SIGNAL';
        response.error = `No lab signal found for ${body.fieldKey}`;
        return NextResponse.json(response, { status: 200 }); // Not an error, just no data
      }

      // Propose just this field
      const proposalResult = await proposeFromLabResult({
        companyId,
        importerId: 'websiteLab',
        source: 'lab',
        sourceId: latestRun.id,
        extractionPath: candidateResult.extractionPath,
        candidates: [targetCandidate],
      });

      response.ok = true;
      response.proposedCount = proposalResult.proposed;
      response.reason = proposalResult.proposed > 0 ? 'SUCCESS' : 'BLOCKED';

      if (proposalResult.blocked > 0) {
        response.error = 'Field already confirmed or rejected';
      }

      console.log('[propose-field] Complete:', {
        companyId,
        fieldKey: body.fieldKey,
        proposed: proposalResult.proposed,
        blocked: proposalResult.blocked,
      });

      return NextResponse.json(response);
    }

    // If no matching source handler, return not implemented
    response.reason = 'SOURCE_NOT_SUPPORTED';
    response.error = `Sources ${sources.join(', ')} not yet supported for domain ${domain}`;
    return NextResponse.json(response, { status: 400 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[propose-field] Error:', errorMessage);
    response.error = errorMessage;
    response.reason = 'UNKNOWN';
    return NextResponse.json(response, { status: 500 });
  }
}
