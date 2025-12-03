// app/c/[companyId]/diagnostics/brand/page.tsx
// Brand Lab - Brand Diagnostic Tool (V5: Action-First View + Narrative + Competitive)
//
// PRIMARY VIEW: Actions (Now / Next / Later)
// SECONDARY VIEW: Narrative Report
// COMPETITIVE: Snapshot in Actions tab
//
// Compatible with both V1 (diagnostic + actionPlan) and V2 (dimensions + findings) structures

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCompanyById } from '@/lib/airtable/companies';
import { getHeavyGapRunsByCompanyId } from '@/lib/airtable/gapHeavyRuns';
import { buildBrandActionPlan } from '@/lib/gap-heavy/modules/brandActionPlanBuilder';
import type {
  BrandLabResult as BrandLabResultV1,
  BrandDiagnosticResultWithCompetitive,
  BrandNarrativeReport,
} from '@/lib/gap-heavy/modules/brandLab';
import type { BrandLabResult as BrandLabResultV2 } from '@/lib/diagnostics/brand-lab/types';
import { BrandLabTabs } from './BrandLabTabs';

// Type guard for V2 format
function isV2Format(result: any): result is BrandLabResultV2 {
  return result && 'dimensions' in result && Array.isArray(result.dimensions) && !('diagnostic' in result);
}

// Type guard for V1 format
function isV1Format(result: any): result is BrandLabResultV1 {
  return result && 'diagnostic' in result && 'actionPlan' in result;
}

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function BrandDiagnosticPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Fetch most recent Heavy Run
  const heavyRuns = await getHeavyGapRunsByCompanyId(companyId, 1);
  const latestHeavyRun = heavyRuns[0] || null;

  // Extract Brand Lab result from evidence pack (supports V1 and V2 formats)
  let brandLabResult: BrandLabResultV1 | BrandLabResultV2 | null = null;
  let narrativeReport: BrandNarrativeReport | null = null;

  if (latestHeavyRun?.evidencePack?.brandLab) {
    brandLabResult = latestHeavyRun.evidencePack.brandLab;
    // Check for existing narrative (V1 format)
    narrativeReport = (latestHeavyRun.evidencePack.brandLab as any)?.narrativeReport || null;
  }

  // Also check for brand module results (from Heavy Worker V4)
  const brandModule = latestHeavyRun?.evidencePack?.modules?.find(
    (m: any) => m.module === 'brand'
  );

  // Debug logging
  console.log('[Brand Page] Latest run:', {
    hasRun: !!latestHeavyRun,
    hasEvidencePack: !!latestHeavyRun?.evidencePack,
    hasBrandLab: !!latestHeavyRun?.evidencePack?.brandLab,
    hasBrandModule: !!brandModule,
    hasNarrative: !!narrativeReport,
    brandModuleScore: brandModule?.score,
    evidencePackKeys: latestHeavyRun?.evidencePack ? Object.keys(latestHeavyRun.evidencePack) : [],
  });

  // If no Brand Lab diagnostics run yet, show runner
  if (!brandLabResult) {
    // Dynamic import of client component
    const { BrandDiagnosticRunner } = await import('./BrandDiagnosticRunner');

    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="mb-6">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-slate-100">
            Brand Diagnostics
          </h1>

          {/* Show info if brand module exists but not Brand Lab */}
          {brandModule && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-300 mb-1">
                    Basic Brand Module Results Available
                  </p>
                  <p className="text-xs text-blue-200/80">
                    You have brand module results (Score: {brandModule.score}/100) from Heavy Worker V4.
                    The Brand Lab below provides a more detailed, action-first diagnostic with prioritized work items.
                  </p>
                </div>
              </div>
            </div>
          )}

          <BrandDiagnosticRunner companyId={companyId} />
        </div>
      </div>
    );
  }

  // Build action plan from brand lab result (handle V1 and V2 formats)
  const displayUrl = company.website?.replace(/^https?:\/\//, '') || '';
  let actionPlan;
  let competitiveLandscape;
  let labResultForMapper: BrandLabResultV1;

  if (isV2Format(brandLabResult)) {
    // V2 format: extract V1 from findings.diagnosticV1
    const v1Result = brandLabResult.findings?.diagnosticV1 as BrandLabResultV1 | undefined;
    if (v1Result?.diagnostic) {
      actionPlan = buildBrandActionPlan(v1Result.diagnostic);
      competitiveLandscape = (v1Result.diagnostic as BrandDiagnosticResultWithCompetitive).competitiveLandscape;
      labResultForMapper = v1Result;
    } else {
      // Fallback: construct minimal V1-like structure from V2
      const benchmarkLabel = (
        brandLabResult.maturityStage === 'established' ? 'strong' :
        brandLabResult.maturityStage === 'scaling' ? 'solid' :
        brandLabResult.maturityStage === 'emerging' ? 'developing' : 'weak'
      ) as 'weak' | 'developing' | 'solid' | 'strong' | 'category_leader';

      actionPlan = {
        summary: brandLabResult.narrativeSummary,
        overallScore: brandLabResult.overallScore,
        benchmarkLabel,
        keyThemes: [],
        now: brandLabResult.quickWins.map((qw, i) => ({
          id: qw.id,
          title: qw.action,
          description: '',
          rationale: '',
          evidenceRefs: [],
          dimension: qw.category as any,
          serviceArea: 'brand' as any,
          impactScore: qw.expectedImpact === 'high' ? 5 : qw.expectedImpact === 'medium' ? 3 : 1,
          effortScore: qw.effortLevel === 'high' ? 5 : qw.effortLevel === 'medium' ? 3 : 1,
          priority: 'now' as const,
          status: 'backlog' as const,
          tags: [],
        })),
        next: brandLabResult.projects.filter(p => p.timeHorizon === 'mid-term').map((p, i) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          rationale: '',
          evidenceRefs: [],
          dimension: p.category as any,
          serviceArea: 'brand' as any,
          impactScore: p.impact === 'high' ? 5 : p.impact === 'medium' ? 3 : 1,
          effortScore: 3,
          priority: 'next' as const,
          status: 'backlog' as const,
          tags: [],
        })),
        later: brandLabResult.projects.filter(p => p.timeHorizon === 'long-term').map((p, i) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          rationale: '',
          evidenceRefs: [],
          dimension: p.category as any,
          serviceArea: 'brand' as any,
          impactScore: p.impact === 'high' ? 5 : p.impact === 'medium' ? 3 : 1,
          effortScore: 4,
          priority: 'later' as const,
          status: 'backlog' as const,
          tags: [],
        })),
        strategicChanges: [],
      };
      competitiveLandscape = brandLabResult.findings?.competitiveLandscape;
      // Create a minimal V1 labResultForMapper
      labResultForMapper = {
        diagnostic: {
          score: brandLabResult.overallScore,
          benchmarkLabel,
          summary: brandLabResult.narrativeSummary,
          brandPillars: [],
          identitySystem: brandLabResult.findings?.identitySystem || {},
          messagingSystem: brandLabResult.findings?.messagingSystem || {},
          positioning: brandLabResult.findings?.positioning || {},
          audienceFit: brandLabResult.findings?.audienceFit || {},
          trustAndProof: brandLabResult.findings?.trustAndProof || {},
          visualSystem: brandLabResult.findings?.visualSystem || {},
          brandAssets: brandLabResult.findings?.brandAssets || {},
          inconsistencies: brandLabResult.findings?.inconsistencies || [],
          opportunities: brandLabResult.findings?.opportunities || [],
          risks: brandLabResult.findings?.risks || [],
        },
        actionPlan,
      } as BrandLabResultV1;
    }
  } else {
    // V1 format: use directly
    actionPlan = buildBrandActionPlan(brandLabResult.diagnostic);
    competitiveLandscape = (brandLabResult.diagnostic as BrandDiagnosticResultWithCompetitive).competitiveLandscape;
    labResultForMapper = brandLabResult;
  }

  // Map to generic Action Board format
  const { mapBrandToActionBoard } = await import('@/lib/diagnostics/mappers/brandMapper');

  // Extract maturity and data confidence from V2 format
  let maturityStage: string | null = null;
  let dataConfidence: { level: 'low' | 'medium' | 'high'; score: number; reason?: string } | null = null;

  if (isV2Format(brandLabResult)) {
    maturityStage = brandLabResult.maturityStage;
    dataConfidence = brandLabResult.dataConfidence;
  }

  const actionBoard = mapBrandToActionBoard(actionPlan, companyId, {
    labResult: labResultForMapper,
    companyName: company.name,
    companyUrl: displayUrl,
    runId: latestHeavyRun.id,
    maturityStage,
    dataConfidence,
  });

  return (
    <div className="min-h-screen bg-[#050509]">
      {/* Header Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link
            href={`/c/${companyId}/blueprint`}
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            ← Back to Blueprint
          </Link>
          <span className="text-xs font-medium text-slate-500">
            Brand Lab V2
          </span>
        </div>
      </div>

      {/* TABBED VIEW: Actions | Narrative */}
      <BrandLabTabs
        actionBoard={actionBoard}
        competitiveLandscape={competitiveLandscape}
        initialNarrative={narrativeReport}
        companyId={companyId}
      />
    </div>
  );
}
