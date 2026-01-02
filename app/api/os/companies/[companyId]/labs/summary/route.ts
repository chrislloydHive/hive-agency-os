// app/api/os/companies/[companyId]/labs/summary/route.ts
// Lab Coverage Summary API
//
// Returns summary of all labs that have run for a company, including:
// - Status, completion time
// - Findings count from lab output
// - Proposed facts count from V4 store
// - Pending review count
//
// Used by the Lab Coverage Summary panel in the Review Queue.

import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestRunForCompanyAndTool,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getOrCreateFieldStoreV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import {
  getCurrentQualityScores,
  buildQualityInline,
} from '@/lib/os/diagnostics/qualityScoreStore';
import type {
  LabCoverageSummaryResponse,
  LabRunSummary,
  LabKey,
} from '@/lib/types/labSummary';
import { LAB_DISPLAY_NAMES, LAB_DESCRIPTIONS } from '@/lib/types/labSummary';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string }>;
}

/**
 * Count findings from WebsiteLab raw JSON
 */
function countWebsiteLabFindings(rawJson: unknown): number {
  if (!rawJson || typeof rawJson !== 'object') return 0;

  const raw = rawJson as Record<string, unknown>;
  let count = 0;

  // Count from various structures
  // DiagnosticModuleResult format
  const labResult = (raw.rawEvidence as Record<string, unknown>)?.labResultV4 || raw;
  const lab = labResult as Record<string, unknown>;

  // Count issues
  if (Array.isArray(lab.issues)) count += lab.issues.length;
  if (Array.isArray((lab.siteAssessment as Record<string, unknown>)?.issues)) {
    count += ((lab.siteAssessment as Record<string, unknown>).issues as unknown[]).length;
  }
  if (Array.isArray((lab.siteAssessment as Record<string, unknown>)?.criticalIssues)) {
    count += ((lab.siteAssessment as Record<string, unknown>).criticalIssues as unknown[]).length;
  }

  // Count recommendations
  if (Array.isArray(lab.recommendations)) count += lab.recommendations.length;
  if (Array.isArray((lab.siteAssessment as Record<string, unknown>)?.recommendations)) {
    count += ((lab.siteAssessment as Record<string, unknown>).recommendations as unknown[]).length;
  }
  if (Array.isArray((lab.siteAssessment as Record<string, unknown>)?.quickWins)) {
    count += ((lab.siteAssessment as Record<string, unknown>).quickWins as unknown[]).length;
  }

  // Count page assessments
  if (Array.isArray((lab.siteAssessment as Record<string, unknown>)?.pageAssessments)) {
    count += ((lab.siteAssessment as Record<string, unknown>).pageAssessments as unknown[]).length;
  }

  // Count trust analysis findings
  if (lab.trustAnalysis && typeof lab.trustAnalysis === 'object') {
    const trust = lab.trustAnalysis as Record<string, unknown>;
    if (Array.isArray(trust.issues)) count += trust.issues.length;
    if (Array.isArray(trust.findings)) count += trust.findings.length;
  }

  // Count content intelligence findings
  if (lab.contentIntelligence && typeof lab.contentIntelligence === 'object') {
    const content = lab.contentIntelligence as Record<string, unknown>;
    if (Array.isArray(content.issues)) count += content.issues.length;
    if (Array.isArray(content.findings)) count += content.findings.length;
  }

  return count;
}

/**
 * Count findings from BrandLab raw JSON
 */
function countBrandLabFindings(rawJson: unknown): number {
  if (!rawJson || typeof rawJson !== 'object') return 0;

  const raw = rawJson as Record<string, unknown>;
  let count = 0;

  // Count issues
  if (Array.isArray(raw.issues)) count += raw.issues.length;

  // Count quick wins
  if (Array.isArray(raw.quickWins)) count += raw.quickWins.length;

  // Count projects
  if (Array.isArray(raw.projects)) count += raw.projects.length;

  // Count from findings object
  if (raw.findings && typeof raw.findings === 'object') {
    const findings = raw.findings as Record<string, unknown>;
    if (Array.isArray(findings.inconsistencies)) count += findings.inconsistencies.length;
    if (Array.isArray(findings.opportunities)) count += findings.opportunities.length;
    if (Array.isArray(findings.risks)) count += findings.risks.length;
  }

  return count;
}

/**
 * Count findings from Competition Lab
 */
function countCompetitionLabFindings(runPayload: unknown): number {
  if (!runPayload || typeof runPayload !== 'object') return 0;

  const run = runPayload as Record<string, unknown>;
  let count = 0;

  // Count competitors
  if (Array.isArray(run.competitors)) count += run.competitors.length;

  // Count insights
  if (Array.isArray(run.insights)) count += run.insights.length;

  // Count recommendations
  if (Array.isArray(run.recommendations)) count += run.recommendations.length;

  return count;
}

/**
 * Count findings from GAP Plan raw JSON
 */
function countGapPlanFindings(rawJson: unknown): number {
  if (!rawJson || typeof rawJson !== 'object') return 0;

  const raw = rawJson as Record<string, unknown>;
  let count = 0;

  // Count from gapStructured
  if (raw.gapStructured && typeof raw.gapStructured === 'object') {
    const gap = raw.gapStructured as Record<string, unknown>;
    if (Array.isArray(gap.primaryOffers)) count += gap.primaryOffers.length;
    if (Array.isArray(gap.competitors)) count += gap.competitors.length;
    if (gap.audienceSummary) count += 1;
    if (gap.scores) count += 1;
  }

  // Count initiatives/recommendations
  if (Array.isArray(raw.initiatives)) count += raw.initiatives.length;
  if (Array.isArray(raw.recommendations)) count += raw.recommendations.length;

  return count;
}

/**
 * GET /api/os/companies/[companyId]/labs/summary
 *
 * Returns lab coverage summary with findings and proposed facts counts
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId } = await params;

    // Fetch lab runs and quality scores in parallel
    const [websiteLabRun, brandLabRun, gapPlanRun, competitionRun, qualityScores] = await Promise.all([
      getLatestRunForCompanyAndTool(companyId, 'websiteLab'),
      getLatestRunForCompanyAndTool(companyId, 'brandLab'),
      getLatestRunForCompanyAndTool(companyId, 'gapPlan'),
      getLatestCompetitionRunV3(companyId),
      getCurrentQualityScores(companyId).catch(() => ({
        websiteLab: null,
        competitionLab: null,
        brandLab: null,
        gapPlan: null,
      })),
    ]);

    // Load V4 store for proposed/confirmed counts
    const store = await getOrCreateFieldStoreV4(companyId);
    const allProposed = store ? Object.values(store.fields).filter((f: { status: string }) => f.status === 'proposed') : [];
    const allConfirmed = store ? Object.values(store.fields).filter((f: { status: string }) => f.status === 'confirmed') : [];
    const allRejected = store ? Object.values(store.fields).filter((f: { status: string }) => f.status === 'rejected') : [];

    // Helper to count proposed/confirmed by importer
    type FieldWithImporter = { importerId?: string; evidence?: { importerId?: string } };
    const countByImporter = (importerId: string, fields: FieldWithImporter[]) => {
      return fields.filter((f: FieldWithImporter) =>
        f.importerId === importerId ||
        f.evidence?.importerId === importerId
      ).length;
    };

    // Build lab summaries
    const labs: LabRunSummary[] = [];

    // Website Lab
    const websiteLabFindings = websiteLabRun?.rawJson
      ? countWebsiteLabFindings(websiteLabRun.rawJson)
      : 0;
    const websiteQuality = buildQualityInline(qualityScores.websiteLab);
    labs.push({
      labKey: 'websiteLab',
      displayName: LAB_DISPLAY_NAMES.websiteLab,
      status: websiteLabRun
        ? websiteLabRun.status === 'complete' ? 'completed'
          : websiteLabRun.status === 'failed' ? 'failed'
            : websiteLabRun.status === 'running' ? 'running'
              : 'pending'
        : 'not_run',
      runId: websiteLabRun?.id,
      completedAt: websiteLabRun?.status === 'complete' ? websiteLabRun.updatedAt : undefined,
      findingsCount: websiteLabFindings,
      proposedFactsCount: countByImporter('websiteLab', [...allProposed, ...allConfirmed, ...allRejected]),
      pendingReviewCount: countByImporter('websiteLab', allProposed),
      confirmedCount: countByImporter('websiteLab', allConfirmed),
      rejectedCount: countByImporter('websiteLab', allRejected),
      errorMessage: websiteLabRun?.status === 'failed' ? websiteLabRun.summary || undefined : undefined,
      description: LAB_DESCRIPTIONS.websiteLab,
      quality: websiteQuality ?? undefined,
    });

    // Competition Lab
    const competitionFindings = competitionRun
      ? countCompetitionLabFindings(competitionRun)
      : 0;
    const competitionQuality = buildQualityInline(qualityScores.competitionLab);
    labs.push({
      labKey: 'competitionLab',
      displayName: LAB_DISPLAY_NAMES.competitionLab,
      status: competitionRun
        ? competitionRun.status === 'completed' ? 'completed'
          : competitionRun.status === 'failed' ? 'failed'
            : competitionRun.status === 'running' ? 'running'
              : 'pending'
        : 'not_run',
      runId: competitionRun?.runId,
      completedAt: competitionRun?.status === 'completed' && competitionRun.completedAt ? competitionRun.completedAt : undefined,
      findingsCount: competitionFindings,
      proposedFactsCount: countByImporter('competitionLab', [...allProposed, ...allConfirmed, ...allRejected]),
      pendingReviewCount: countByImporter('competitionLab', allProposed),
      confirmedCount: countByImporter('competitionLab', allConfirmed),
      rejectedCount: countByImporter('competitionLab', allRejected),
      errorMessage: competitionRun?.status === 'failed' ? competitionRun.error || undefined : undefined,
      description: LAB_DESCRIPTIONS.competitionLab,
      quality: competitionQuality ?? undefined,
    });

    // Brand Lab
    const brandLabFindings = brandLabRun?.rawJson
      ? countBrandLabFindings(brandLabRun.rawJson)
      : 0;
    const brandQuality = buildQualityInline(qualityScores.brandLab);
    labs.push({
      labKey: 'brandLab',
      displayName: LAB_DISPLAY_NAMES.brandLab,
      status: brandLabRun
        ? brandLabRun.status === 'complete' ? 'completed'
          : brandLabRun.status === 'failed' ? 'failed'
            : brandLabRun.status === 'running' ? 'running'
              : 'pending'
        : 'not_run',
      runId: brandLabRun?.id,
      completedAt: brandLabRun?.status === 'complete' ? brandLabRun.updatedAt : undefined,
      findingsCount: brandLabFindings,
      proposedFactsCount: countByImporter('brandLab', [...allProposed, ...allConfirmed, ...allRejected]),
      pendingReviewCount: countByImporter('brandLab', allProposed),
      confirmedCount: countByImporter('brandLab', allConfirmed),
      rejectedCount: countByImporter('brandLab', allRejected),
      errorMessage: brandLabRun?.status === 'failed' ? brandLabRun.summary || undefined : undefined,
      description: LAB_DESCRIPTIONS.brandLab,
      quality: brandQuality ?? undefined,
    });

    // GAP Plan
    const gapPlanFindings = gapPlanRun?.rawJson
      ? countGapPlanFindings(gapPlanRun.rawJson)
      : 0;
    const gapQuality = buildQualityInline(qualityScores.gapPlan);
    labs.push({
      labKey: 'gapPlan',
      displayName: LAB_DISPLAY_NAMES.gapPlan,
      status: gapPlanRun
        ? gapPlanRun.status === 'complete' ? 'completed'
          : gapPlanRun.status === 'failed' ? 'failed'
            : gapPlanRun.status === 'running' ? 'running'
              : 'pending'
        : 'not_run',
      runId: gapPlanRun?.id,
      completedAt: gapPlanRun?.status === 'complete' ? gapPlanRun.updatedAt : undefined,
      findingsCount: gapPlanFindings,
      proposedFactsCount: countByImporter('gapPlan', [...allProposed, ...allConfirmed, ...allRejected]),
      pendingReviewCount: countByImporter('gapPlan', allProposed),
      confirmedCount: countByImporter('gapPlan', allConfirmed),
      rejectedCount: countByImporter('gapPlan', allRejected),
      errorMessage: gapPlanRun?.status === 'failed' ? gapPlanRun.summary || undefined : undefined,
      description: LAB_DESCRIPTIONS.gapPlan,
      quality: gapQuality ?? undefined,
    });

    // Calculate totals
    const totalFindings = labs.reduce((sum, lab) => sum + lab.findingsCount, 0);
    const totalProposedFacts = labs.reduce((sum, lab) => sum + lab.proposedFactsCount, 0);
    const totalPendingReview = labs.reduce((sum, lab) => sum + lab.pendingReviewCount, 0);

    // Find labs with unmapped findings (has findings but 0 proposed facts)
    const labsWithUnmappedFindings = labs
      .filter(lab => lab.findingsCount > 0 && lab.proposedFactsCount === 0)
      .map(lab => lab.labKey);

    const response: LabCoverageSummaryResponse = {
      ok: true,
      companyId,
      labs,
      totalFindings,
      totalProposedFacts,
      totalPendingReview,
      labsWithUnmappedFindings,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Labs Summary API] Error:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        companyId: '',
        labs: [],
        totalFindings: 0,
        totalProposedFacts: 0,
        totalPendingReview: 0,
        labsWithUnmappedFindings: [],
        lastUpdated: new Date().toISOString(),
        error: errorMessage,
      } as LabCoverageSummaryResponse,
      { status: 500 }
    );
  }
}
