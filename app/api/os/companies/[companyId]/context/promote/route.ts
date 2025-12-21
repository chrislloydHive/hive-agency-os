// app/api/os/companies/[companyId]/context/promote/route.ts
// Context Promotion API - Hydrates context graph from raw diagnostic data
//
// Uses the production hydrateContextFromHistory function to promote
// raw findings from diagnostic runs, GAP runs, and labs into the
// canonical context graph.
//
// Supports proof mode for debugging promotion issues:
// - Query param: ?debug=1
// - Header: x-debug-proof: 1

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { hydrateContextFromHistory, runSingleImporter } from '@/lib/contextGraph/importers/registry';
import type { AggregatedProof } from '@/lib/contextGraph/importers/types';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

// ============================================================================
// Types
// ============================================================================

interface PromoteRequest {
  // Optional: specific importer to run (e.g., 'gap', 'websiteLab', 'brandLab')
  // If not specified, runs all enabled importers
  importerId?: string;

  // Optional: dry run mode - returns what would be promoted without saving
  dryRun?: boolean;
}

interface PromoteResponse {
  success: boolean;
  companyId: string;
  companyName: string;

  // Hydration results
  totalFieldsUpdated: number;
  totalErrors: number;

  // Importer breakdown
  importerResults: Array<{
    importerId: string;
    importerLabel: string;
    fieldsUpdated: number;
    updatedPaths: string[];
    errors: string[];
    sourceRunIds: string[];
  }>;

  // Before/after completeness
  completenessBefore: number;
  completenessAfter: number;

  // Duration
  durationMs: number;

  // Proof data (only present when debug=1 or x-debug-proof header)
  proof?: AggregatedProof;
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  const startTime = Date.now();

  try {
    const { companyId } = await params;

    // Check for debug/proof mode
    const debugParam = req.nextUrl.searchParams.get('debug');
    const debugHeader = req.headers.get('x-debug-proof');
    const proofMode = debugParam === '1' || debugHeader === '1';

    // Parse request body
    let body: PromoteRequest = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine
    }

    const { importerId, dryRun } = body;

    // 1. Validate company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log(`[promote] Starting promotion for ${company.name} (${companyId})`);
    if (proofMode) {
      console.log('[promote] PROOF MODE enabled');
    }
    if (dryRun) {
      console.log('[promote] DRY RUN mode - no changes will be saved');
    }

    // 2. Run hydration
    let hydrationResult;

    if (importerId) {
      // Run single importer
      console.log(`[promote] Running single importer: ${importerId}`);
      // Note: runSingleImporter doesn't support proofMode yet - use full hydration for proof
      if (proofMode) {
        // Set env var for importer to pick up
        process.env.DEBUG_CONTEXT_PROOF = '1';
      }
      const importResult = await runSingleImporter(companyId, importerId);

      hydrationResult = {
        success: importResult.success,
        importerResults: [{
          importerId,
          importerLabel: importerId,
          result: importResult,
        }],
        totalFieldsUpdated: importResult.fieldsUpdated,
        totalErrors: importResult.errors.length,
        telemetry: {
          completenessBefore: 0,
          completenessAfter: 0,
          completenessChange: 0,
          durationMs: Date.now() - startTime,
        },
        // Include proof from single importer if present
        proof: proofMode && importResult.proof ? {
          perImporter: [{ importerId, proof: importResult.proof }],
          totalCandidateWrites: importResult.proof.candidateWrites.length,
          totalPersistedWrites: importResult.proof.persistedWrites.length,
          aggregatedDroppedByReason: importResult.proof.droppedByReason,
        } : undefined,
      };
    } else {
      // Run all importers
      console.log('[promote] Running all enabled importers');
      hydrationResult = await hydrateContextFromHistory(companyId, { proofMode });
    }

    const durationMs = Date.now() - startTime;

    // 3. Build response
    const response: PromoteResponse = {
      success: hydrationResult.success,
      companyId,
      companyName: company.name,
      totalFieldsUpdated: hydrationResult.totalFieldsUpdated,
      totalErrors: hydrationResult.totalErrors,
      importerResults: hydrationResult.importerResults.map(ir => ({
        importerId: ir.importerId,
        importerLabel: ir.importerLabel,
        fieldsUpdated: ir.result.fieldsUpdated,
        updatedPaths: ir.result.updatedPaths,
        errors: ir.result.errors,
        sourceRunIds: ir.result.sourceRunIds || [],
      })),
      completenessBefore: hydrationResult.telemetry?.completenessBefore ?? 0,
      completenessAfter: hydrationResult.telemetry?.completenessAfter ?? 0,
      durationMs,
      // Include proof data when in proof mode
      proof: hydrationResult.proof,
    };

    console.log(`[promote] Completed in ${durationMs}ms:`, {
      fieldsUpdated: response.totalFieldsUpdated,
      errors: response.totalErrors,
      completenessChange: response.completenessAfter - response.completenessBefore,
    });

    if (proofMode && response.proof) {
      console.log('[promote] Proof summary:', {
        totalCandidateWrites: response.proof.totalCandidateWrites,
        totalPersistedWrites: response.proof.totalPersistedWrites,
        droppedByReason: response.proof.aggregatedDroppedByReason,
      });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[promote] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to promote context',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
