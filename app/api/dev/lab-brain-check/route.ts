// app/api/dev/lab-brain-check/route.ts
// Development diagnostic to verify Lab-Brain integration
//
// This endpoint checks:
// 1. labContext.ts is properly loading context for all Labs
// 2. Each Lab's critical fields are defined
// 3. Context integrity is computed correctly
// 4. Lab constraints are properly configured
//
// Usage: GET /api/dev/lab-brain-check?companyId=xxx

import { NextRequest, NextResponse } from 'next/server';
import {
  getLabContext,
  checkLabReadiness,
  getLabConstraints,
  getConfidenceCap,
  LAB_IDS,
  type LabId,
} from '@/lib/contextGraph/labContext';

export const dynamic = 'force-dynamic';

interface LabCheckResult {
  labId: LabId;
  contextLoaded: boolean;
  contextIntegrity: string;
  confidenceCap: number;
  canProceed: boolean;
  warning?: string;
  missingCritical: string[];
  hasConstraints: boolean;
  constraintCount: number;
  scopes: string[];
  criticalFieldCount: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('companyId');

  if (!companyId) {
    return NextResponse.json(
      { error: 'companyId query parameter is required' },
      { status: 400 }
    );
  }

  const results: LabCheckResult[] = [];

  for (const labId of LAB_IDS) {
    try {
      const labContext = await getLabContext(companyId, labId);
      const readiness = checkLabReadiness(labContext);
      const constraints = getLabConstraints(labId);
      const confidenceCap = getConfidenceCap(labContext);

      results.push({
        labId,
        contextLoaded: true,
        contextIntegrity: labContext.contextIntegrity,
        confidenceCap,
        canProceed: readiness.canProceed,
        warning: readiness.warning,
        missingCritical: readiness.missingCritical,
        hasConstraints: !!constraints.systemConstraints,
        constraintCount: Object.keys(constraints.fieldConstraints).length,
        scopes: labContext.scopes,
        criticalFieldCount: Object.keys(constraints.fieldConstraints).length,
      });
    } catch (error) {
      results.push({
        labId,
        contextLoaded: false,
        contextIntegrity: 'error',
        confidenceCap: 0,
        canProceed: false,
        missingCritical: [],
        hasConstraints: false,
        constraintCount: 0,
        scopes: [],
        criticalFieldCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Compute summary
  const summary = {
    totalLabs: results.length,
    labsWithContext: results.filter(r => r.contextLoaded).length,
    labsCanProceed: results.filter(r => r.canProceed).length,
    labsWithWarnings: results.filter(r => r.warning).length,
    labsWithErrors: results.filter(r => r.error).length,
    avgConfidenceCap: results
      .filter(r => r.contextLoaded)
      .reduce((sum, r) => sum + r.confidenceCap, 0) / results.filter(r => r.contextLoaded).length || 0,
    labsWithHighIntegrity: results.filter(r => r.contextIntegrity === 'high').length,
    labsWithMediumIntegrity: results.filter(r => r.contextIntegrity === 'medium').length,
    labsWithLowIntegrity: results.filter(r => r.contextIntegrity === 'low' || r.contextIntegrity === 'none').length,
  };

  return NextResponse.json({
    success: true,
    companyId,
    timestamp: new Date().toISOString(),
    summary,
    results,
  });
}
