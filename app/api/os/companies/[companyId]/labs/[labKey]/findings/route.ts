// app/api/os/companies/[companyId]/labs/[labKey]/findings/route.ts
// Lab Findings API
//
// Returns detailed findings from a lab run for the Findings Viewer.
// Extracts structured findings from lab raw JSON, categorizes them,
// and indicates which have been promoted to proposed facts.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getLatestRunForCompanyAndTool,
  type DiagnosticToolId,
} from '@/lib/os/diagnostics/runs';
import { getOrCreateFieldStoreV4 } from '@/lib/contextGraph/fieldStoreV4';
import { getLatestCompetitionRunV3 } from '@/lib/competition-v3/store';
import type {
  LabFindingsResponse,
  LabFinding,
  FindingsGroup,
  FindingImpact,
  FindingCategory,
  FindingPromotionStatus,
  TargetFieldRecommendation,
  LabKey,
} from '@/lib/types/labSummary';
import { FINDING_CATEGORY_LABELS } from '@/lib/types/labSummary';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ companyId: string; labKey: string }>;
}

// ============================================================================
// Canonical Hash Generation
// ============================================================================

/**
 * Generate a canonical hash for deduplication
 * hash(normalizedText + labKey + findingType + keyEvidenceUrl)
 */
function generateCanonicalHash(
  text: string,
  labKey: string,
  findingType: string,
  evidenceUrl?: string
): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const input = `${normalized}|${labKey}|${findingType}|${evidenceUrl || ''}`;
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

// ============================================================================
// Field Recommendation Logic
// ============================================================================

/**
 * Get recommended target fields based on finding category and content
 */
function getRecommendedTargetFields(
  finding: Partial<LabFinding>,
  labKey: LabKey,
  existingFields: Map<string, { hasProposed: boolean; hasConfirmed: boolean }>
): TargetFieldRecommendation[] {
  const recommendations: TargetFieldRecommendation[] = [];

  // Map category to likely target fields
  const categoryFieldMap: Record<FindingCategory, string[]> = {
    conversion: ['website.conversionBlocks', 'website.quickWins', 'website.recommendations'],
    ux: ['website.uxAssessment', 'website.pageAssessments', 'website.recommendations'],
    messaging: ['brand.positioning', 'brand.valueProposition', 'productOffer.valueProposition'],
    local_seo: ['website.localSeoFindings', 'website.recommendations'],
    competitors: ['competition.primaryCompetitors', 'competition.threatSummary', 'competition.differentiationAxes'],
    brand: ['brand.positioning', 'brand.valueProposition', 'identity.companyDescription'],
    trust: ['website.trustAnalysis', 'website.recommendations'],
    content: ['website.contentFindings', 'content.strategy'],
    technical: ['digitalInfra.techStack', 'website.technicalIssues'],
    strategy: ['brand.positioning', 'productOffer.primaryOffer', 'audience.primaryAudience'],
    audience: ['audience.primaryAudience', 'audience.icpDescription', 'audience.painPoints'],
    positioning: ['brand.positioning', 'brand.valueProposition', 'competition.positioningMapSummary'],
    other: ['website.recommendations'],
  };

  const targetFields = categoryFieldMap[finding.category || 'other'] || categoryFieldMap.other;

  for (const fieldKey of targetFields) {
    const existing = existingFields.get(fieldKey);
    const domain = fieldKey.split('.')[0];
    const field = fieldKey.split('.')[1];

    // Calculate match score based on content similarity (simplified)
    let matchScore = 50; // Base score
    if (finding.title?.toLowerCase().includes(field.toLowerCase())) matchScore += 20;
    if (finding.description?.toLowerCase().includes(domain.toLowerCase())) matchScore += 15;
    if (labKey === 'websiteLab' && domain === 'website') matchScore += 15;
    if (labKey === 'competitionLab' && domain === 'competition') matchScore += 15;
    if (labKey === 'brandLab' && (domain === 'brand' || domain === 'audience')) matchScore += 15;

    recommendations.push({
      fieldKey,
      fieldLabel: `${domain}.${field}`,
      reason: `Based on ${finding.category} category`,
      matchScore: Math.min(matchScore, 100),
      hasConfirmedValue: existing?.hasConfirmed || false,
      hasProposedValue: existing?.hasProposed || false,
    });
  }

  // Sort by match score descending
  return recommendations.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

// ============================================================================
// WebsiteLab Findings Extraction
// ============================================================================

function extractWebsiteLabFindings(
  rawJson: unknown,
  runId: string,
  createdAt: string,
  existingFields: Map<string, { hasProposed: boolean; hasConfirmed: boolean }>,
  promotedHashes: Set<string>
): LabFinding[] {
  if (!rawJson || typeof rawJson !== 'object') return [];

  const findings: LabFinding[] = [];
  const raw = rawJson as Record<string, unknown>;

  // Get lab result from various structures
  const labResult = (raw.rawEvidence as Record<string, unknown>)?.labResultV4 || raw;
  const lab = labResult as Record<string, unknown>;
  const siteAssessment = lab.siteAssessment as Record<string, unknown> | undefined;

  // Extract critical issues (HIGH impact)
  const criticalIssues = (siteAssessment?.criticalIssues || lab.criticalIssues) as Array<{ title?: string; description?: string; issue?: string }> | undefined;
  if (Array.isArray(criticalIssues)) {
    for (const issue of criticalIssues) {
      const title = issue.title || issue.issue || 'Critical Issue';
      const description = issue.description || issue.issue || String(issue);
      const hash = generateCanonicalHash(description, 'websiteLab', 'critical_issue');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

      const finding: LabFinding = {
        findingId: `wl-crit-${hash}`,
        labKey: 'websiteLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Critical Issue',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact: 'high',
        category: 'conversion',
        confidence: 0.85,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'websiteLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract regular issues (MEDIUM impact)
  const issues = (siteAssessment?.issues || lab.issues) as Array<{ title?: string; description?: string; issue?: string; severity?: string }> | undefined;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      const title = issue.title || issue.issue || 'Issue';
      const description = issue.description || issue.issue || String(issue);
      const hash = generateCanonicalHash(description, 'websiteLab', 'issue');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';
      const impact: FindingImpact = issue.severity === 'high' ? 'high' : issue.severity === 'low' ? 'low' : 'medium';

      const finding: LabFinding = {
        findingId: `wl-issue-${hash}`,
        labKey: 'websiteLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Issue',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact,
        category: 'ux',
        confidence: 0.75,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'websiteLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract quick wins (HIGH value, actionable)
  const quickWins = (siteAssessment?.quickWins || lab.quickWins) as Array<string | { title?: string; description?: string }> | undefined;
  if (Array.isArray(quickWins)) {
    for (const win of quickWins) {
      const title = typeof win === 'string' ? win : win.title || win.description || 'Quick Win';
      const description = typeof win === 'string' ? win : win.description || win.title || String(win);
      const hash = generateCanonicalHash(description, 'websiteLab', 'quick_win');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

      const finding: LabFinding = {
        findingId: `wl-qw-${hash}`,
        labKey: 'websiteLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Quick Win',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact: 'high',
        category: 'conversion',
        confidence: 0.8,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'websiteLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract recommendations (MEDIUM impact)
  const recommendations = (siteAssessment?.recommendations || lab.recommendations) as Array<string | { title?: string; description?: string; text?: string }> | undefined;
  if (Array.isArray(recommendations)) {
    for (const rec of recommendations) {
      const title = typeof rec === 'string' ? rec : rec.title || rec.text || 'Recommendation';
      const description = typeof rec === 'string' ? rec : rec.description || rec.text || String(rec);
      const hash = generateCanonicalHash(description, 'websiteLab', 'recommendation');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

      const finding: LabFinding = {
        findingId: `wl-rec-${hash}`,
        labKey: 'websiteLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Recommendation',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact: 'medium',
        category: 'ux',
        confidence: 0.7,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'websiteLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract trust analysis findings
  const trustAnalysis = lab.trustAnalysis as Record<string, unknown> | undefined;
  if (trustAnalysis) {
    const trustIssues = (trustAnalysis.issues || trustAnalysis.findings) as Array<string | { title?: string; description?: string }> | undefined;
    if (Array.isArray(trustIssues)) {
      for (const issue of trustIssues) {
        const title = typeof issue === 'string' ? issue : issue.title || 'Trust Finding';
        const description = typeof issue === 'string' ? issue : issue.description || String(issue);
        const hash = generateCanonicalHash(description, 'websiteLab', 'trust');
        const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

        const finding: LabFinding = {
          findingId: `wl-trust-${hash}`,
          labKey: 'websiteLab',
          runId,
          title: typeof title === 'string' ? title.slice(0, 100) : 'Trust Finding',
          description: typeof description === 'string' ? description : JSON.stringify(description),
          impact: 'medium',
          category: 'trust',
          confidence: 0.75,
          evidence: [],
          canonicalHash: hash,
          promotionStatus: promotionStatus as FindingPromotionStatus,
          recommendedTargetFields: [],
          createdAt,
        };
        finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'websiteLab', existingFields);
        findings.push(finding);
      }
    }
  }

  return findings;
}

// ============================================================================
// CompetitionLab Findings Extraction
// ============================================================================

function extractCompetitionLabFindings(
  runPayload: unknown,
  runId: string,
  createdAt: string,
  existingFields: Map<string, { hasProposed: boolean; hasConfirmed: boolean }>,
  promotedHashes: Set<string>
): LabFinding[] {
  if (!runPayload || typeof runPayload !== 'object') return [];

  const findings: LabFinding[] = [];
  const run = runPayload as Record<string, unknown>;

  // Extract competitors as findings
  const competitors = run.competitors as Array<{
    name: string;
    domain?: string;
    summary?: string;
    classification?: { type?: string; confidence?: number };
    scores?: { threatScore?: number; relevanceScore?: number };
  }> | undefined;

  if (Array.isArray(competitors)) {
    for (const competitor of competitors) {
      const title = `Competitor: ${competitor.name}`;
      const description = competitor.summary || `${competitor.name} (${competitor.domain || 'Unknown domain'})`;
      const hash = generateCanonicalHash(competitor.name, 'competitionLab', 'competitor');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';
      const threatScore = competitor.scores?.threatScore || 0;
      const impact: FindingImpact = threatScore >= 60 ? 'high' : threatScore >= 30 ? 'medium' : 'low';

      const finding: LabFinding = {
        findingId: `cl-comp-${hash}`,
        labKey: 'competitionLab',
        runId,
        title,
        description,
        impact,
        category: 'competitors',
        confidence: competitor.classification?.confidence || 0.7,
        evidence: competitor.domain ? [{ type: 'url', url: `https://${competitor.domain}`, label: competitor.domain }] : [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'competitionLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract insights
  const insights = run.insights as Array<string | { title?: string; text?: string; description?: string }> | undefined;
  if (Array.isArray(insights)) {
    for (const insight of insights) {
      const title = typeof insight === 'string' ? insight : insight.title || 'Competitive Insight';
      const description = typeof insight === 'string' ? insight : insight.text || insight.description || String(insight);
      const hash = generateCanonicalHash(description, 'competitionLab', 'insight');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

      const finding: LabFinding = {
        findingId: `cl-ins-${hash}`,
        labKey: 'competitionLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Competitive Insight',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact: 'medium',
        category: 'positioning',
        confidence: 0.75,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'competitionLab', existingFields);
      findings.push(finding);
    }
  }

  return findings;
}

// ============================================================================
// BrandLab Findings Extraction
// ============================================================================

function extractBrandLabFindings(
  rawJson: unknown,
  runId: string,
  createdAt: string,
  existingFields: Map<string, { hasProposed: boolean; hasConfirmed: boolean }>,
  promotedHashes: Set<string>
): LabFinding[] {
  if (!rawJson || typeof rawJson !== 'object') return [];

  const findings: LabFinding[] = [];
  const raw = rawJson as Record<string, unknown>;

  // Extract issues
  const issues = raw.issues as Array<{ title?: string; description?: string; severity?: string }> | undefined;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      const title = issue.title || 'Brand Issue';
      const description = issue.description || String(issue);
      const hash = generateCanonicalHash(description, 'brandLab', 'issue');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';
      const impact: FindingImpact = issue.severity === 'high' ? 'high' : issue.severity === 'low' ? 'low' : 'medium';

      const finding: LabFinding = {
        findingId: `bl-issue-${hash}`,
        labKey: 'brandLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Brand Issue',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact,
        category: 'brand',
        confidence: 0.75,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'brandLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract quick wins
  const quickWins = raw.quickWins as Array<{ title?: string; description?: string }> | undefined;
  if (Array.isArray(quickWins)) {
    for (const win of quickWins) {
      const title = win.title || 'Brand Quick Win';
      const description = win.description || String(win);
      const hash = generateCanonicalHash(description, 'brandLab', 'quick_win');
      const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

      const finding: LabFinding = {
        findingId: `bl-qw-${hash}`,
        labKey: 'brandLab',
        runId,
        title: typeof title === 'string' ? title.slice(0, 100) : 'Brand Quick Win',
        description: typeof description === 'string' ? description : JSON.stringify(description),
        impact: 'high',
        category: 'brand',
        confidence: 0.8,
        evidence: [],
        canonicalHash: hash,
        promotionStatus: promotionStatus as FindingPromotionStatus,
        recommendedTargetFields: [],
        createdAt,
      };
      finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'brandLab', existingFields);
      findings.push(finding);
    }
  }

  // Extract from findings object
  const findingsObj = raw.findings as Record<string, unknown> | undefined;
  if (findingsObj) {
    // Opportunities
    const opportunities = findingsObj.opportunities as Array<{ title?: string; description?: string }> | undefined;
    if (Array.isArray(opportunities)) {
      for (const opp of opportunities) {
        const title = opp.title || 'Brand Opportunity';
        const description = opp.description || String(opp);
        const hash = generateCanonicalHash(description, 'brandLab', 'opportunity');
        const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

        const finding: LabFinding = {
          findingId: `bl-opp-${hash}`,
          labKey: 'brandLab',
          runId,
          title: typeof title === 'string' ? title.slice(0, 100) : 'Brand Opportunity',
          description: typeof description === 'string' ? description : JSON.stringify(description),
          impact: 'medium',
          category: 'strategy',
          confidence: 0.7,
          evidence: [],
          canonicalHash: hash,
          promotionStatus: promotionStatus as FindingPromotionStatus,
          recommendedTargetFields: [],
          createdAt,
        };
        finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'brandLab', existingFields);
        findings.push(finding);
      }
    }

    // Risks
    const risks = findingsObj.risks as Array<{ title?: string; description?: string }> | undefined;
    if (Array.isArray(risks)) {
      for (const risk of risks) {
        const title = risk.title || 'Brand Risk';
        const description = risk.description || String(risk);
        const hash = generateCanonicalHash(description, 'brandLab', 'risk');
        const promotionStatus = promotedHashes.has(hash) ? 'promoted_pending' : 'not_promoted';

        const finding: LabFinding = {
          findingId: `bl-risk-${hash}`,
          labKey: 'brandLab',
          runId,
          title: typeof title === 'string' ? title.slice(0, 100) : 'Brand Risk',
          description: typeof description === 'string' ? description : JSON.stringify(description),
          impact: 'high',
          category: 'brand',
          confidence: 0.75,
          evidence: [],
          canonicalHash: hash,
          promotionStatus: promotionStatus as FindingPromotionStatus,
          recommendedTargetFields: [],
          createdAt,
        };
        finding.recommendedTargetFields = getRecommendedTargetFields(finding, 'brandLab', existingFields);
        findings.push(finding);
      }
    }
  }

  return findings;
}

// ============================================================================
// Main API Handler
// ============================================================================

/**
 * GET /api/os/companies/[companyId]/labs/[labKey]/findings
 *
 * Returns detailed findings for a specific lab
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { companyId, labKey } = await params;

    // Validate labKey
    const validLabKeys: LabKey[] = ['websiteLab', 'competitionLab', 'brandLab', 'gapPlan'];
    if (!validLabKeys.includes(labKey as LabKey)) {
      return NextResponse.json(
        { ok: false, error: `Invalid lab key: ${labKey}` },
        { status: 400 }
      );
    }

    // Load V4 store to check existing fields and promotions
    const store = await getOrCreateFieldStoreV4(companyId);
    const existingFields = new Map<string, { hasProposed: boolean; hasConfirmed: boolean }>();
    const promotedHashes = new Set<string>();

    if (store) {
      for (const [key, field] of Object.entries(store.fields)) {
        const typedField = field as { status: string; dedupeKey?: string };
        existingFields.set(key, {
          hasProposed: typedField.status === 'proposed',
          hasConfirmed: typedField.status === 'confirmed',
        });
        // Track dedupeKeys that have been promoted
        if (typedField.dedupeKey) {
          promotedHashes.add(typedField.dedupeKey.slice(0, 16));
        }
      }
    }

    let findings: LabFinding[] = [];
    let runId: string | undefined;
    let completedAt: string | undefined;

    // Extract findings based on lab type
    if (labKey === 'websiteLab') {
      const run = await getLatestRunForCompanyAndTool(companyId, 'websiteLab');
      if (run?.rawJson) {
        runId = run.id;
        completedAt = run.status === 'complete' ? run.updatedAt : undefined;
        findings = extractWebsiteLabFindings(run.rawJson, run.id, run.createdAt, existingFields, promotedHashes);
      }
    } else if (labKey === 'competitionLab') {
      const run = await getLatestCompetitionRunV3(companyId);
      if (run) {
        runId = run.runId;
        completedAt = run.status === 'completed' && run.completedAt ? run.completedAt : undefined;
        findings = extractCompetitionLabFindings(run, run.runId, run.createdAt, existingFields, promotedHashes);
      }
    } else if (labKey === 'brandLab') {
      const run = await getLatestRunForCompanyAndTool(companyId, 'brandLab');
      if (run?.rawJson) {
        runId = run.id;
        completedAt = run.status === 'complete' ? run.updatedAt : undefined;
        findings = extractBrandLabFindings(run.rawJson, run.id, run.createdAt, existingFields, promotedHashes);
      }
    }

    // Group findings by category
    const groupsMap = new Map<FindingCategory, LabFinding[]>();
    for (const finding of findings) {
      const existing = groupsMap.get(finding.category) || [];
      existing.push(finding);
      groupsMap.set(finding.category, existing);
    }

    const groups: FindingsGroup[] = [];
    for (const [category, categoryFindings] of groupsMap) {
      groups.push({
        category,
        label: FINDING_CATEGORY_LABELS[category],
        findings: categoryFindings,
        highImpactCount: categoryFindings.filter(f => f.impact === 'high').length,
      });
    }

    // Sort groups by high impact count descending
    groups.sort((a, b) => b.highImpactCount - a.highImpactCount);

    // Calculate stats
    const stats = {
      byImpact: {
        high: findings.filter(f => f.impact === 'high').length,
        medium: findings.filter(f => f.impact === 'medium').length,
        low: findings.filter(f => f.impact === 'low').length,
      },
      byCategory: {} as Record<FindingCategory, number>,
      promoted: findings.filter(f => f.promotionStatus !== 'not_promoted').length,
      notPromoted: findings.filter(f => f.promotionStatus === 'not_promoted').length,
    };

    for (const group of groups) {
      stats.byCategory[group.category] = group.findings.length;
    }

    const response: LabFindingsResponse = {
      ok: true,
      companyId,
      labKey: labKey as LabKey,
      runId,
      completedAt,
      totalFindings: findings.length,
      groups,
      findings,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Lab Findings API] Error:', errorMessage);

    return NextResponse.json(
      {
        ok: false,
        companyId: '',
        labKey: 'websiteLab',
        totalFindings: 0,
        groups: [],
        findings: [],
        stats: {
          byImpact: { high: 0, medium: 0, low: 0 },
          byCategory: {} as Record<string, number>,
          promoted: 0,
          notPromoted: 0,
        },
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
