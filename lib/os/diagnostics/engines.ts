// lib/os/diagnostics/engines.ts
// Engine wrappers for diagnostic tools
//
// This module provides a unified interface for running diagnostic engines.
// Each function wraps the underlying engine implementation and returns
// consistent results that can be stored in DiagnosticRuns.
//
// GAP engines support a modelCaller parameter to allow memory-aware AI calls
// via aiForCompany() when called from API routes.

import { getCompanyById, type CompanyRecord } from '@/lib/airtable/companies';
import { runBrandLab as runBrandLabV2, type BrandLabEngineResult } from '@/lib/diagnostics/brand-lab';
import { runWebsiteLabV4 } from '@/lib/gap-heavy/modules/website';
import { runHeavyWorkerV4 } from '@/lib/gap-heavy/orchestratorV4';
import { runStrategicOrchestrator } from '@/lib/gap-heavy/strategicOrchestrator';
import type { GapHeavyResult } from '@/lib/gap-heavy/strategicTypes';
import { runInitialAssessment, runFullGap, type GapModelCaller } from '@/lib/gap/core';
import type { DiagnosticToolId } from './runs';
import type {
  SeoLabReport,
  SeoLabSubscore,
  SeoIssue,
  SeoLabQuickWin,
  SeoLabProject,
  SeoLabEngineResult,
  SeoAnalyticsSnapshot,
  DataConfidence,
  SeoMaturityStage,
  SeoIssueEffort,
} from './seoLabTypes';
import {
  getStatusFromScore,
  generateIssueId,
  computeDataConfidence,
  computeSearchPerformanceScore,
  deriveSeoMaturityStage,
  computeOverallScore,
  isSearchDataSparse,
} from './seoLabTypes';
import { getWorkspaceGscSummary } from '@/lib/os/analytics/gsc';
import { createDateRange } from '@/lib/os/analytics/ga4';

// ============================================================================
// Types
// ============================================================================

export interface EngineResult {
  success: boolean;
  score?: number;
  summary?: string;
  data?: unknown;
  error?: string;
}

export interface EngineInput {
  companyId: string;
  company: CompanyRecord;
  websiteUrl: string;
}

/**
 * Extended input for GAP engines with optional model caller.
 * When modelCaller is provided, GAP engines will use it for AI calls,
 * enabling memory injection via aiForCompany().
 */
export interface GapEngineInput extends EngineInput {
  /**
   * Optional model caller for AI operations.
   * If provided, GAP engines will use this instead of direct OpenAI calls.
   * Use aiForCompany() to create a memory-aware model caller.
   */
  modelCaller?: GapModelCaller;
}

// ============================================================================
// GAP Snapshot Engine (GAP-IA)
// ============================================================================

/**
 * Run GAP Snapshot (Initial Assessment)
 * Quick assessment of marketing presence and maturity
 *
 * @param input.modelCaller - Optional model caller for memory-aware AI calls via aiForCompany()
 */
export async function runGapSnapshotEngine(input: GapEngineInput): Promise<EngineResult> {
  console.log('[GAP Snapshot Engine] Starting for:', input.websiteUrl);
  console.log('[GAP Snapshot Engine] Using modelCaller:', input.modelCaller ? 'custom (aiForCompany)' : 'default (direct OpenAI)');

  try {
    const result = await runInitialAssessment({
      url: input.websiteUrl,
      modelCaller: input.modelCaller,
    });

    // Extract score and summary from initialAssessment
    // The result has structure: { initialAssessment, businessContext, metadata }
    // initialAssessment is a GapIaV2AiOutput with summary.overallScore
    const ia = result.initialAssessment as any;
    const overallScore = ia?.summary?.overallScore ?? ia?.scores?.overall ?? ia?.overallScore ?? ia?.score;
    const maturityStage = ia?.summary?.maturityStage ?? ia?.maturityStage;
    const summary = maturityStage
      ? `${maturityStage} maturity stage - Score: ${overallScore}/100`
      : `Overall Score: ${overallScore}/100`;

    console.log('[GAP Snapshot Engine] ✓ Complete:', { score: overallScore });

    return {
      success: true,
      score: typeof overallScore === 'number' ? overallScore : undefined,
      summary,
      data: result,
    };
  } catch (error) {
    console.error('[GAP Snapshot Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// GAP Plan Engine (Full GAP)
// ============================================================================

/**
 * Run Full GAP Plan generation
 * Comprehensive growth acceleration plan with roadmap
 *
 * This runs Initial Assessment first, then uses it for Full GAP Plan
 *
 * @param input.modelCaller - Optional model caller for memory-aware AI calls via aiForCompany()
 */
export async function runGapPlanEngine(input: GapEngineInput): Promise<EngineResult> {
  console.log('[GAP Plan Engine] Starting for:', input.websiteUrl);
  console.log('[GAP Plan Engine] Using modelCaller:', input.modelCaller ? 'custom (aiForCompany)' : 'default (direct OpenAI)');

  try {
    // First, run initial assessment to get the base analysis
    console.log('[GAP Plan Engine] Running initial assessment...');
    const iaResult = await runInitialAssessment({
      url: input.websiteUrl,
      modelCaller: input.modelCaller,
    });

    // Then run full GAP with the initial assessment
    console.log('[GAP Plan Engine] Generating full GAP plan...');
    const result = await runFullGap({
      url: input.websiteUrl,
      initialAssessment: iaResult.initialAssessment,
      modelCaller: input.modelCaller,
    });

    // Extract score and summary from fullGap
    const fg = result.fullGap as any;
    const overallScore = fg?.scorecard?.overall ?? fg?.executiveSummary?.overallScore;
    const summary = fg?.executiveSummary?.narrative
      ?? fg?.executiveSummary?.companyOverview
      ?? `Growth Plan generated - Score: ${overallScore}/100`;

    console.log('[GAP Plan Engine] ✓ Complete:', { score: overallScore });

    return {
      success: true,
      score: typeof overallScore === 'number' ? overallScore : undefined,
      summary: typeof summary === 'string' ? summary.substring(0, 500) : undefined,
      data: { ...result, initialAssessment: iaResult },
    };
  } catch (error) {
    console.error('[GAP Plan Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Website Lab Engine
// ============================================================================

/**
 * Run Website Lab V4 diagnostic
 * Multi-page UX & conversion analysis
 */
export async function runWebsiteLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Website Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Create an empty evidence pack for standalone runs
    const emptyEvidencePack = {
      runId: `standalone-${Date.now()}`,
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      createdAt: new Date().toISOString(),
      status: 'running' as const,
      modules: [],
    };

    const result = await runWebsiteLabV4({
      company: input.company,
      websiteUrl: input.websiteUrl,
      evidence: emptyEvidencePack,
    });

    // Extract score and summary from DiagnosticModuleResult
    const score = result.score;
    const summary = result.summary ?? `Website diagnostic complete - Score: ${score}/100`;

    console.log('[Website Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary: typeof summary === 'string' ? summary.substring(0, 500) : undefined,
      data: result,
    };
  } catch (error) {
    console.error('[Website Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Brand Lab Engine (V2)
// ============================================================================

/**
 * Run Brand Lab V2 diagnostic
 * Brand health, clarity, and positioning analysis with dimension-based scoring
 */
export async function runBrandLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Brand Lab Engine V2] Starting for:', input.websiteUrl);

  try {
    const result = await runBrandLabV2({
      company: input.company,
      websiteUrl: input.websiteUrl,
      companyId: input.companyId,
    });

    console.log('[Brand Lab Engine V2] ✓ Complete:', {
      score: result.overallScore,
      maturityStage: result.maturityStage,
      dimensions: result.dimensions.length,
      issues: result.issues.length,
    });

    return {
      success: true,
      score: result.overallScore,
      summary: result.narrativeSummary,
      data: result,
    };
  } catch (error) {
    console.error('[Brand Lab Engine V2] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Content Lab Engine (Stub)
// ============================================================================

/**
 * Run Content Lab diagnostic
 * Content inventory and quality assessment
 *
 * TODO: Implement full content diagnostic using existing content module
 */
export async function runContentLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Content Lab Engine] Starting for:', input.websiteUrl);

  try {
    // For now, run the Heavy Worker V4 with just the content module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['content'],
    });

    // Find content module result
    const contentModule = result.evidencePack.modules?.find(m => m.module === 'content');
    const score = contentModule?.score;
    const summary = contentModule?.summary || `Content diagnostic complete`;

    console.log('[Content Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: contentModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Content Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SEO Lab Engine
// ============================================================================

/**
 * Extended input for SEO Lab engine with workspace ID for GSC
 */
export interface SeoLabEngineInput extends EngineInput {
  workspaceId?: string;
}

/**
 * Run SEO Lab diagnostic
 * Comprehensive SEO analysis combining:
 * - Heavy orchestrator SEO module (crawl, technical signals, page analysis)
 * - Google Search Console data (queries, pages, CTR, position)
 * - Split scoring: on-site vs search performance
 * - Data confidence indicators
 * - Comprehensive subscores, issues, quick wins, and projects
 */
export async function runSeoLabEngine(input: SeoLabEngineInput): Promise<SeoLabEngineResult> {
  console.log('[SEO Lab Engine] Starting for:', input.websiteUrl);

  try {
    // 1. Run Heavy Worker V4 with SEO module
    console.log('[SEO Lab Engine] Running Heavy Worker V4 with SEO module...');
    const heavyResult = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['seo'],
    });

    // Extract SEO module result
    const seoModule = heavyResult.evidencePack.modules?.find(m => m.module === 'seo');
    if (!seoModule) {
      throw new Error('SEO module did not produce results');
    }

    const seoEvidence = seoModule.rawEvidence as any;

    // 2. Fetch GSC data for analytics snapshot
    console.log('[SEO Lab Engine] Fetching GSC data...');
    let analyticsSnapshot: SeoAnalyticsSnapshot | undefined;
    try {
      const dateRange = createDateRange('30d');
      const gscData = await getWorkspaceGscSummary(dateRange, input.workspaceId);

      // Always create snapshot even with minimal data so we can show the state
      analyticsSnapshot = {
        periodLabel: 'Last 30 days',
        clicks: gscData.totals.clicks ?? 0,
        impressions: gscData.totals.impressions ?? 0,
        ctr: gscData.totals.avgCtr ?? undefined,
        avgPosition: gscData.totals.avgPosition ?? undefined,
        topQueries: gscData.queries.slice(0, 10).map(q => ({
          query: q.query,
          clicks: q.clicks,
          impressions: q.impressions,
          ctr: q.ctr ?? 0,
          position: q.position ?? 0,
        })),
        topLandingPages: gscData.pages.slice(0, 10).map(p => ({
          url: p.url,
          sessions: p.clicks, // Using clicks as proxy for sessions
        })),
      };
      console.log('[SEO Lab Engine] GSC data fetched:', {
        clicks: analyticsSnapshot.clicks,
        impressions: analyticsSnapshot.impressions,
        queries: analyticsSnapshot.topQueries?.length,
      });
    } catch (gscError) {
      console.warn('[SEO Lab Engine] GSC data fetch failed (continuing without):', gscError);
    }

    // 3. Compute data confidence from analytics
    const dataConfidence = computeDataConfidence(analyticsSnapshot);
    console.log('[SEO Lab Engine] Data confidence:', {
      score: dataConfidence.score,
      level: dataConfidence.level,
    });

    // 4. Compute on-site score from crawl evidence
    // This is the raw score from the crawl module - represents technical/on-page quality
    const onSiteScore = seoModule.score ?? 50;

    // 5. Compute search performance score from GSC analytics
    const searchPerformanceScore = computeSearchPerformanceScore(analyticsSnapshot);
    console.log('[SEO Lab Engine] Search performance score:', searchPerformanceScore);

    // 6. Compute overall score with data-sparse vs data-rich logic
    const overallScore = computeOverallScore(
      onSiteScore,
      searchPerformanceScore,
      dataConfidence
    );
    const isFoundationsOnly = searchPerformanceScore === null || dataConfidence.score < 30;
    console.log('[SEO Lab Engine] Overall score:', {
      onSiteScore,
      searchPerformanceScore,
      overallScore,
      isFoundationsOnly,
      dataConfidenceScore: dataConfidence.score,
    });

    // 7. Derive maturity stage from overall score, search score, and data confidence
    const maturityStage = deriveSeoMaturityStage(overallScore, searchPerformanceScore, dataConfidence.score);
    console.log('[SEO Lab Engine] Maturity stage:', maturityStage);

    // 8. Build subscores from evidence (excluding Local & GBP from overall)
    const subscores = buildSeoSubscores(seoEvidence, onSiteScore, analyticsSnapshot);

    // 9. Build issues from module output with effort levels
    const issues = buildSeoIssues(seoModule.issues || [], seoEvidence);

    // 10. Build quick wins DERIVED from issues (not duplicates)
    const quickWins = buildSeoQuickWinsFromIssues(issues);

    // 11. Build projects by grouping issues
    const projects = buildSeoProjectsFromIssues(issues);

    // 12. Extract top strengths and gaps
    const { topStrengths, topGaps } = extractStrengthsAndGaps(seoEvidence, seoModule, analyticsSnapshot);

    // 13. Build narrative summary with new maturity-aware logic
    const narrativeSummary = buildNarrativeSummary(
      onSiteScore,
      searchPerformanceScore,
      maturityStage,
      dataConfidence,
      topStrengths,
      topGaps,
      analyticsSnapshot
    );

    // 14. Construct final report
    const report: SeoLabReport = {
      onSiteScore,
      searchPerformanceScore,
      overallScore,
      dataConfidence,
      maturityStage,
      narrativeSummary,
      subscores,
      topStrengths,
      topGaps,
      quickWins,
      projects,
      issues,
      analyticsSnapshot,
      generatedAt: new Date().toISOString(),
      companyId: input.companyId,
      url: input.websiteUrl,
    };

    console.log('[SEO Lab Engine] ✓ Complete:', {
      onSiteScore: report.onSiteScore,
      searchPerformanceScore: report.searchPerformanceScore,
      overallScore: report.overallScore,
      maturityStage: report.maturityStage,
      dataConfidenceLevel: report.dataConfidence.level,
      issues: issues.length,
      quickWins: quickWins.length,
      projects: projects.length,
    });

    return {
      success: true,
      score: report.overallScore,
      summary: narrativeSummary,
      report,
    };
  } catch (error) {
    console.error('[SEO Lab Engine] Error:', error);
    return {
      success: false,
      score: undefined,
      summary: undefined,
      report: undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SEO Lab Helper Functions
// ============================================================================

/**
 * Build subscores from SEO evidence data
 * Note: Local & GBP is marked as "not_evaluated" and excluded from overall score
 */
function buildSeoSubscores(evidence: any, onSiteScore: number, analytics?: SeoAnalyticsSnapshot): SeoLabSubscore[] {
  const subscores: SeoLabSubscore[] = [];

  // Technical SEO subscore
  const technicalSignals = evidence?.technicalSignals || {};
  const technicalScore = calculateTechnicalScore(technicalSignals, evidence);
  subscores.push({
    label: 'Technical SEO',
    score: technicalScore,
    status: getStatusFromScore(technicalScore),
    summary: buildTechnicalSummary(technicalSignals, evidence),
  });

  // On-page & Content subscore
  const onPageScore = calculateOnPageScore(evidence);
  subscores.push({
    label: 'On-page & Content',
    score: onPageScore,
    status: getStatusFromScore(onPageScore),
    summary: buildOnPageSummary(evidence),
  });

  // Internal Linking & Structure subscore
  // NOTE: Renamed from "Authority & Links" because we only measure internal linking,
  // not external backlinks or domain authority. This avoids implying off-site authority.
  const internalLinkingScore = calculateAuthorityScore(evidence);
  subscores.push({
    label: 'Internal Linking & Structure',
    score: internalLinkingScore,
    status: getStatusFromScore(internalLinkingScore),
    summary: buildInternalLinkingSummary(evidence),
  });

  // SERP & Visibility subscore - must align with searchPerformanceScore
  // When data is sparse, this should be not_evaluated (not a numeric score)
  const isSparse = isSearchDataSparse(analytics);
  if (isSparse) {
    subscores.push({
      label: 'SERP & Visibility',
      score: null,
      status: 'not_evaluated',
      summary: 'Search data is too sparse to meaningfully evaluate visibility. Treat search-related insights as directional only.',
    });
  } else {
    const serpScore = calculateSerpScore(analytics);
    subscores.push({
      label: 'SERP & Visibility',
      score: serpScore,
      status: getStatusFromScore(serpScore),
      summary: buildSerpSummary(analytics),
    });
  }

  // Local & GBP subscore - NOT EVALUATED
  // This dimension is excluded from overall score calculation
  subscores.push({
    label: 'Local & GBP',
    score: null,
    status: 'not_evaluated',
    summary: 'Local SEO/GBP analysis is not yet implemented in this version. This dimension is not included in your overall score.',
  });

  return subscores;
}

/**
 * Calculate SERP & Visibility score from GSC analytics
 */
function calculateSerpScore(analytics?: SeoAnalyticsSnapshot): number | null {
  if (!analytics) return null;

  const impressions = analytics.impressions ?? 0;
  const clicks = analytics.clicks ?? 0;
  const ctr = analytics.ctr ?? 0;
  const avgPosition = analytics.avgPosition;

  // If very low data, return null (not enough to score)
  if (impressions < 10) return null;

  let score = 0;

  // Impressions contribution (0-30 pts)
  // 100 impressions = 10pts, 1000 = 20pts, 10000 = 30pts
  score += Math.min(30, Math.log10(impressions + 1) * 7.5);

  // Clicks contribution (0-30 pts)
  score += Math.min(30, clicks > 0 ? Math.log10(clicks + 1) * 10 : 0);

  // CTR contribution (0-20 pts)
  // CTR of 2-3% is benchmark, so scale accordingly
  score += Math.min(20, ctr * 666); // 0.03 * 666 = 20

  // Position contribution (0-20 pts)
  if (avgPosition !== undefined && avgPosition > 0) {
    if (avgPosition <= 3) score += 20;
    else if (avgPosition <= 10) score += 15;
    else if (avgPosition <= 20) score += 10;
    else if (avgPosition <= 50) score += 5;
  }

  return Math.round(Math.min(100, score));
}

/**
 * Build SERP summary from analytics
 */
function buildSerpSummary(analytics?: SeoAnalyticsSnapshot): string {
  if (!analytics) {
    return 'No search analytics data available. Connect Google Search Console for visibility insights.';
  }

  const impressions = analytics.impressions ?? 0;
  const clicks = analytics.clicks ?? 0;
  const avgPosition = analytics.avgPosition;

  if (impressions < 10) {
    return 'Very limited search visibility. The site is not yet ranking for meaningful search queries.';
  }

  if (clicks === 0) {
    return `The site appeared ${impressions.toLocaleString()} times in search results but received 0 clicks. Focus on improving title tags and meta descriptions to increase CTR.`;
  }

  let summary = `${clicks.toLocaleString()} clicks from ${impressions.toLocaleString()} impressions`;
  if (avgPosition !== undefined) {
    summary += ` with average position ${avgPosition.toFixed(1)}`;
  }
  summary += '.';

  return summary;
}

function calculateTechnicalScore(signals: any, evidence: any): number {
  let score = 100;

  // Penalize for issues
  if (signals.hasMultipleH1) score -= 15;
  if (signals.hasCanonicalTagIssues) score -= 20;
  if (signals.indexabilityIssues?.length > 0) score -= 25;
  if (!signals.metaTagsPresent) score -= 15;

  // Factor in sitemap
  if (!evidence?.hasSitemap) score -= 10;

  return Math.max(0, Math.min(100, score));
}

function calculateOnPageScore(evidence: any): number {
  if (!evidence || !evidence.pagesAnalyzed) return 50;

  const titleCoverage = evidence.pagesWithTitles / evidence.pagesAnalyzed;
  const metaCoverage = evidence.pagesWithMetaDescriptions / evidence.pagesAnalyzed;
  const canonicalCoverage = evidence.pagesWithCanonicals / evidence.pagesAnalyzed;

  return Math.round((titleCoverage * 35 + metaCoverage * 35 + canonicalCoverage * 30));
}

function calculateAuthorityScore(evidence: any): number {
  if (!evidence) return 50;

  const avgLinks = evidence.avgInternalLinksPerPage || 0;
  // Good internal linking is 10-20 links per page
  const linkScore = Math.min(100, (avgLinks / 15) * 100);

  return Math.round(linkScore);
}

function buildTechnicalSummary(signals: any, evidence: any): string {
  const issues: string[] = [];

  if (signals.hasMultipleH1) issues.push('multiple H1 tags detected');
  if (signals.hasCanonicalTagIssues) issues.push('canonical tag issues');
  if (!evidence?.hasSitemap) issues.push('no sitemap found');
  if (signals.indexabilityIssues?.length > 0) issues.push('indexability issues');

  if (issues.length === 0) return 'Technical SEO fundamentals are solid.';
  return `Issues: ${issues.join(', ')}.`;
}

function buildOnPageSummary(evidence: any): string {
  if (!evidence || !evidence.pagesAnalyzed) return 'Unable to analyze on-page elements.';

  const titlePct = Math.round((evidence.pagesWithTitles / evidence.pagesAnalyzed) * 100);
  const metaPct = Math.round((evidence.pagesWithMetaDescriptions / evidence.pagesAnalyzed) * 100);

  return `${titlePct}% of pages have title tags, ${metaPct}% have meta descriptions.`;
}

/**
 * Build summary for Internal Linking & Structure subscore
 * NOTE: This only measures internal linking, not external backlinks or domain authority.
 */
function buildInternalLinkingSummary(evidence: any): string {
  const avgLinks = evidence?.avgInternalLinksPerPage || 0;
  if (avgLinks >= 10) return `Strong internal linking structure with ${avgLinks} average links per page. (Note: This measures internal linking only, not external backlinks.)`;
  if (avgLinks >= 5) return `Moderate internal linking with ${avgLinks} average links per page. Consider adding more contextual internal links.`;
  return `Weak internal linking with only ${avgLinks} average links per page. Improving internal linking structure is a quick win.`;
}

/**
 * Build issues from module output with effort levels for quick win derivation
 */
function buildSeoIssues(moduleIssues: string[], evidence: any): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Convert module issues to structured format
  moduleIssues.forEach((issueText, index) => {
    const severity = determineSeverity(issueText);
    const category = determineCategory(issueText);
    const effort = determineEffort(issueText);

    issues.push({
      id: generateIssueId(category, index),
      severity,
      category,
      title: issueText.length > 60 ? issueText.substring(0, 57) + '...' : issueText,
      description: issueText,
      recommendedAction: generateActionFromIssue(issueText),
      timeHorizon: severity === 'critical' ? 'now' : severity === 'high' ? 'next' : 'later',
      impact: severity === 'critical' || severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low',
      effort,
    });
  });

  return issues;
}

/**
 * Determine effort level for an issue
 */
function determineEffort(issueText: string): SeoIssueEffort {
  const lowerText = issueText.toLowerCase();

  // Low effort: Simple fixes that can be done quickly
  if (
    lowerText.includes('title') ||
    lowerText.includes('meta description') ||
    lowerText.includes('alt text') ||
    lowerText.includes('h1') ||
    lowerText.includes('canonical')
  ) {
    return 'low';
  }

  // High effort: Structural changes or external dependencies
  if (
    lowerText.includes('architecture') ||
    lowerText.includes('migration') ||
    lowerText.includes('redesign') ||
    lowerText.includes('backlink') ||
    lowerText.includes('content strategy')
  ) {
    return 'high';
  }

  // Default to medium
  return 'medium';
}

function determineSeverity(issueText: string): 'critical' | 'high' | 'medium' | 'low' {
  const lowerText = issueText.toLowerCase();
  if (lowerText.includes('missing') && (lowerText.includes('sitemap') || lowerText.includes('robots'))) return 'critical';
  if (lowerText.includes('noindex') || lowerText.includes('blocked')) return 'critical';
  if (lowerText.includes('missing title') || lowerText.includes('missing meta')) return 'high';
  if (lowerText.includes('multiple h1') || lowerText.includes('canonical')) return 'medium';
  return 'low';
}

function determineCategory(issueText: string): 'technical' | 'onpage' | 'content' | 'authority' | 'serp' | 'local' {
  const lowerText = issueText.toLowerCase();
  if (lowerText.includes('sitemap') || lowerText.includes('robots') || lowerText.includes('canonical') || lowerText.includes('noindex')) return 'technical';
  if (lowerText.includes('title') || lowerText.includes('meta') || lowerText.includes('h1')) return 'onpage';
  if (lowerText.includes('link') || lowerText.includes('internal')) return 'authority';
  if (lowerText.includes('content') || lowerText.includes('text')) return 'content';
  return 'technical';
}

function generateActionFromIssue(issueText: string): string {
  const lowerText = issueText.toLowerCase();
  if (lowerText.includes('title')) return 'Add unique, descriptive title tags (50-60 characters)';
  if (lowerText.includes('meta description')) return 'Write compelling meta descriptions (150-160 characters)';
  if (lowerText.includes('canonical')) return 'Implement canonical tags on all pages';
  if (lowerText.includes('h1')) return 'Ensure each page has exactly one H1 tag';
  if (lowerText.includes('sitemap')) return 'Create and submit XML sitemap to Google Search Console';
  if (lowerText.includes('link')) return 'Strengthen internal linking structure';
  return 'Review and address this SEO issue';
}

/**
 * Build quick wins DERIVED from issues
 *
 * A quick win is an issue where:
 * - Impact is "high" or "medium" AND
 * - Effort is "low" AND
 * - TimeHorizon is "now" or "next"
 *
 * This avoids duplicate content between issues and quick wins.
 */
function buildSeoQuickWinsFromIssues(issues: SeoIssue[]): SeoLabQuickWin[] {
  // Filter to quick win candidates
  const candidates = issues.filter(issue =>
    (issue.impact === 'high' || issue.impact === 'medium') &&
    issue.effort === 'low' &&
    (issue.timeHorizon === 'now' || issue.timeHorizon === 'next')
  );

  // Sort by impact (high first) then by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  candidates.sort((a, b) => {
    if (a.impact !== b.impact) {
      return a.impact === 'high' ? -1 : 1;
    }
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  // Convert top 5 to quick wins, reusing issue content
  return candidates.slice(0, 5).map(issue => ({
    title: issue.title,
    description: issue.recommendedAction, // Use the action, not the description
    reason: `Addresses ${issue.severity} severity ${issue.category} issue with low effort.`,
    impact: issue.impact,
    effort: issue.effort,
    sourceIssueId: issue.id,
  }));
}

/**
 * Build projects by grouping issues by category/theme
 *
 * Each project contains references to its underlying issues,
 * avoiding duplicate descriptions.
 */
function buildSeoProjectsFromIssues(issues: SeoIssue[]): SeoLabProject[] {
  // Group issues by category
  const categoryGroups: Record<string, SeoIssue[]> = {};
  for (const issue of issues) {
    if (!categoryGroups[issue.category]) categoryGroups[issue.category] = [];
    categoryGroups[issue.category].push(issue);
  }

  const projects: SeoLabProject[] = [];

  // Create project for each category with issues
  for (const [category, categoryIssues] of Object.entries(categoryGroups)) {
    if (categoryIssues.length === 0) continue;

    const themeName = getCategoryThemeName(category);
    const hasHighPriority = categoryIssues.some(i => i.severity === 'critical' || i.severity === 'high');
    const issueIds = categoryIssues.map(i => i.id);

    // Build a summary that references issues without duplicating all content
    const issueTitles = categoryIssues.slice(0, 3).map(i => i.title);
    const moreCount = categoryIssues.length > 3 ? categoryIssues.length - 3 : 0;
    let description = `Address ${categoryIssues.length} ${category} issue${categoryIssues.length > 1 ? 's' : ''}: ${issueTitles.join('; ')}`;
    if (moreCount > 0) {
      description += `; and ${moreCount} more`;
    }

    projects.push({
      title: themeName,
      description,
      theme: themeName,
      timeHorizon: hasHighPriority ? 'now' : 'next',
      impact: hasHighPriority ? 'high' : 'medium',
      issueIds,
      issueCount: categoryIssues.length,
    });
  }

  // Sort by impact and priority
  projects.sort((a, b) => {
    if (a.impact !== b.impact) return a.impact === 'high' ? -1 : 1;
    if (a.timeHorizon !== b.timeHorizon) return a.timeHorizon === 'now' ? -1 : 1;
    return 0;
  });

  return projects.slice(0, 5); // Limit to 5 projects
}

function getCategoryThemeName(category: string): string {
  const themes: Record<string, string> = {
    technical: 'Technical SEO Cleanup',
    onpage: 'On-page Optimization',
    content: 'Content Enhancement',
    authority: 'Link Building & Authority',
    serp: 'SERP Optimization',
    local: 'Local SEO Setup',
  };
  return themes[category] || 'SEO Improvement';
}

/**
 * Extract top strengths and gaps from evidence, considering analytics
 */
function extractStrengthsAndGaps(
  evidence: any,
  seoModule: any,
  analytics?: SeoAnalyticsSnapshot
): { topStrengths: string[]; topGaps: string[] } {
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (!evidence) {
    return { topStrengths: [], topGaps: seoModule?.issues?.slice(0, 3) || [] };
  }

  // Analyze title coverage
  const titleCoverage = evidence.pagesWithTitles / evidence.pagesAnalyzed;
  if (titleCoverage >= 0.9) strengths.push('Strong title tag coverage across pages');
  else if (titleCoverage < 0.5) gaps.push('Low title tag coverage');

  // Analyze meta description coverage
  const metaCoverage = evidence.pagesWithMetaDescriptions / evidence.pagesAnalyzed;
  if (metaCoverage >= 0.9) strengths.push('Good meta description coverage');
  else if (metaCoverage < 0.5) gaps.push('Missing meta descriptions on many pages');

  // Analyze canonical coverage
  const canonicalCoverage = evidence.pagesWithCanonicals / evidence.pagesAnalyzed;
  if (canonicalCoverage >= 0.8) strengths.push('Canonical tags properly implemented');
  else if (canonicalCoverage < 0.5) gaps.push('Canonical tags missing on many pages');

  // Analyze H1 structure
  if (evidence.pagesWithMultipleH1s === 0) strengths.push('Clean H1 heading structure');
  else gaps.push('Multiple H1 tags on some pages');

  // Analyze internal linking
  if (evidence.avgInternalLinksPerPage >= 10) strengths.push('Strong internal linking structure');
  else if (evidence.avgInternalLinksPerPage < 5) gaps.push('Weak internal linking');

  // Sitemap
  if (evidence.hasSitemap) strengths.push('XML sitemap present');
  else gaps.push('No XML sitemap detected');

  // Add analytics-based gaps/strengths
  if (analytics) {
    const clicks = analytics.clicks ?? 0;
    const impressions = analytics.impressions ?? 0;

    if (clicks === 0 && impressions > 0) {
      gaps.push('Zero organic clicks despite search impressions - visibility without engagement');
    } else if (clicks > 100) {
      strengths.push(`Generating ${clicks.toLocaleString()} organic clicks monthly`);
    }

    if (impressions < 100) {
      gaps.push('Very low search visibility - not appearing in search results');
    }
  }

  // Add module issues as gaps if we need more
  const moduleIssues = seoModule?.issues || [];
  for (const issue of moduleIssues) {
    if (gaps.length < 5 && !gaps.some(g => g.toLowerCase().includes(issue.toLowerCase().substring(0, 20)))) {
      gaps.push(issue);
    }
  }

  return {
    topStrengths: strengths.slice(0, 5),
    topGaps: gaps.slice(0, 5),
  };
}

/**
 * Build narrative summary for the report
 *
 * Uses maturity-aware templates:
 * - Case A: Strong on-site, weak/zero search → Focus on visibility
 * - Case B: Weak on-site, weak search → Fix fundamentals
 * - Case C: Strong both → Optimization and expansion
 */
function buildNarrativeSummary(
  onSiteScore: number,
  searchPerformanceScore: number | null,
  maturityStage: SeoMaturityStage,
  dataConfidence: DataConfidence,
  strengths: string[],
  gaps: string[],
  analytics?: SeoAnalyticsSnapshot
): string {
  const clicks = analytics?.clicks ?? 0;
  const impressions = analytics?.impressions ?? 0;
  const hasSearchData = searchPerformanceScore !== null;

  let summary = '';

  // Opening based on maturity stage and score combination
  switch (maturityStage) {
    case 'unproven':
      // Strong on-site, weak/zero search OR insufficient data to evaluate
      if (onSiteScore >= 70) {
        summary = `This site has solid SEO foundations (on-site score: ${onSiteScore}/100) but has not yet gained meaningful search visibility. `;
        summary += `The priority is to get indexed and start ranking for relevant queries. `;
      } else {
        summary = `SEO is in early stages with limited on-site optimization (${onSiteScore}/100) and minimal search visibility. `;
        summary += `Focus on fixing technical fundamentals while building content for target keywords. `;
      }
      break;

    case 'emerging':
      summary = `SEO is emerging with some early traction (search performance: ${searchPerformanceScore ?? 'N/A'}/100, on-site: ${onSiteScore}/100). `;
      summary += `Continue improving on-site factors while expanding keyword targeting. `;
      break;

    case 'scaling':
      summary = `SEO performance is scaling well with decent traffic and growing visibility. `;
      summary += `On-site score of ${onSiteScore}/100 and search performance of ${searchPerformanceScore ?? 'N/A'}/100 show a healthy foundation. `;
      break;

    case 'established':
      summary = `SEO performance is strong, with healthy traffic and well-optimized pages. `;
      summary += `On-site score: ${onSiteScore}/100, Search performance: ${searchPerformanceScore ?? 'N/A'}/100. `;
      summary += `Focus moves toward expansion and optimization rather than fundamentals. `;
      break;
  }

  // Add analytics context with appropriate messaging
  if (analytics && impressions !== undefined) {
    if (clicks === 0 && impressions > 0) {
      summary += `Organic visibility is currently near zero (0 clicks from ${impressions.toLocaleString()} impressions in ${analytics.periodLabel || 'the last 30 days'}). `;
      summary += `Focus should be on getting indexed and ranking for a few targeted queries before deeper optimization. `;
    } else if (impressions < 20) {
      summary += `Sample size is very small (${impressions} impressions); treat these metrics as directional. `;
    } else if (clicks > 0) {
      summary += `GSC shows ${clicks.toLocaleString()} clicks from ${impressions.toLocaleString()} impressions`;
      if (analytics.avgPosition) {
        summary += ` with average position ${analytics.avgPosition.toFixed(1)}`;
      }
      summary += '. ';
    }
  }

  // Add key strength if we have one (but not if maturity is unproven and no traffic)
  if (strengths.length > 0 && maturityStage !== 'unproven') {
    summary += `Key strength: ${strengths[0].toLowerCase()}. `;
  }

  // Add priority gap
  if (gaps.length > 0) {
    summary += `Priority fix: ${gaps[0].toLowerCase()}. `;
  }

  // Add data confidence caveat for low confidence
  if (dataConfidence.level === 'low') {
    summary += `Note: These findings are based on limited recent data.`;
  }

  return summary.trim();
}

// ============================================================================
// Demand Lab Engine
// ============================================================================

/**
 * Run Demand Lab diagnostic
 * Demand generation, funnel, and campaign analysis
 */
export async function runDemandLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Demand Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Run the Heavy Worker V4 with just the demand module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['demand'],
    });

    // Find demand module result
    const demandModule = result.evidencePack.modules?.find(m => m.module === 'demand');
    const score = demandModule?.score;
    const summary = demandModule?.summary || `Demand diagnostic complete`;

    console.log('[Demand Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: demandModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Demand Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Ops Lab Engine
// ============================================================================

/**
 * Run Ops Lab diagnostic
 * Marketing operations and process assessment
 */
export async function runOpsLabEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[Ops Lab Engine] Starting for:', input.websiteUrl);

  try {
    // Run the Heavy Worker V4 with just the ops module
    const result = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      requestedModules: ['ops'],
    });

    // Find ops module result
    const opsModule = result.evidencePack.modules?.find(m => m.module === 'ops');
    const score = opsModule?.score;
    const summary = opsModule?.summary || `Ops diagnostic complete`;

    console.log('[Ops Lab Engine] ✓ Complete:', { score });

    return {
      success: true,
      score,
      summary,
      data: {
        moduleResult: opsModule,
        heavyRunId: result.runId,
      },
    };
  } catch (error) {
    console.error('[Ops Lab Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// GAP Heavy Engine - Strategic Intelligence
// ============================================================================

/**
 * Run GAP Heavy Strategic Intelligence Engine
 *
 * GAP Heavy is a multi-source strategic intelligence engine focused on:
 * - Competitors and category positioning
 * - Search visibility and market mapping
 * - Growth opportunities and gaps
 * - Strategic priorities and narratives
 *
 * This is NOT another diagnostic with per-dimension scores (those are handled by Labs).
 * It synthesizes multiple data sources into strategic priorities and "how we win" narratives.
 */
export async function runGapHeavyEngine(input: EngineInput): Promise<EngineResult> {
  console.log('[GAP Heavy Engine] Starting strategic intelligence analysis for:', input.websiteUrl);

  try {
    // Step 1: Run Heavy Worker V4 to collect evidence from all modules
    // This gathers the raw data needed for strategic synthesis
    const heavyResult = await runHeavyWorkerV4({
      companyId: input.companyId,
      websiteUrl: input.websiteUrl,
      enableWebsiteLabV4: true,
      // Request core modules for evidence collection
      // Note: These modules provide diagnostic data that feeds strategic analysis
      requestedModules: ['website', 'brand', 'content', 'seo', 'demand'],
    });

    console.log('[GAP Heavy Engine] Evidence collection complete:', {
      heavyRunId: heavyResult.runId,
      modulesCompleted: heavyResult.modulesCompleted.length,
    });

    // Step 2: Run Strategic Orchestrator to synthesize intelligence
    const strategicResult = await runStrategicOrchestrator({
      company: input.company,
      websiteUrl: input.websiteUrl,
      evidencePack: heavyResult.evidencePack,
      heavyRunId: heavyResult.runId,
    });

    if (!strategicResult.success || !strategicResult.result) {
      console.error('[GAP Heavy Engine] Strategic orchestrator failed:', strategicResult.error);
      return {
        success: false,
        error: strategicResult.error || 'Strategic analysis failed',
      };
    }

    const result = strategicResult.result;

    // Build summary from strategic priorities
    const summaryParts: string[] = [];
    summaryParts.push(`Data Confidence: ${result.dataConfidence}/100`);
    summaryParts.push(`${result.competitorLandscape.length} competitors identified`);
    summaryParts.push(`${result.strategicPriorities.length} strategic priorities`);

    console.log('[GAP Heavy Engine] ✓ Strategic intelligence complete:', {
      dataConfidence: result.dataConfidence,
      competitors: result.competitorLandscape.length,
      opportunities: result.categoryOpportunities.length + result.contentOpportunities.length,
      funnelGaps: result.funnelGaps.length,
      priorities: result.strategicPriorities.length,
    });

    return {
      success: true,
      // GAP Heavy no longer returns a "score" - it returns strategic intelligence
      // The dataConfidence indicates how much evidence was available
      score: result.dataConfidence,
      summary: summaryParts.join(' | '),
      data: {
        // Include the full strategic result
        strategicResult: result,
        // Also include raw evidence pack for downstream use
        evidencePack: heavyResult.evidencePack,
        heavyRunId: heavyResult.runId,
        // Structured outputs for easy access
        competitorLandscape: result.competitorLandscape,
        searchVisibilityMap: result.searchVisibilityMap,
        categoryOpportunities: result.categoryOpportunities,
        contentOpportunities: result.contentOpportunities,
        funnelGaps: result.funnelGaps,
        localAndSocialSignals: result.localAndSocialSignals,
        strategicPriorities: result.strategicPriorities,
        strategistNarrative: result.strategistNarrative,
        evidence: result.evidence,
        dataConfidence: result.dataConfidence,
        dataSignals: result.dataSignals,
      },
    };
  } catch (error) {
    console.error('[GAP Heavy Engine] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Engine Router
// ============================================================================

/**
 * Run a diagnostic engine by tool ID
 */
export async function runDiagnosticEngine(
  toolId: DiagnosticToolId,
  companyId: string
): Promise<EngineResult> {
  // Get company data
  const company = await getCompanyById(companyId);
  if (!company) {
    return { success: false, error: 'Company not found' };
  }

  if (!company.website) {
    return { success: false, error: 'Company has no website URL' };
  }

  const input: EngineInput = {
    companyId,
    company,
    websiteUrl: company.website,
  };

  // Route to appropriate engine
  switch (toolId) {
    case 'gapSnapshot':
      return runGapSnapshotEngine(input);
    case 'gapPlan':
      return runGapPlanEngine(input);
    case 'gapHeavy':
      return runGapHeavyEngine(input);
    case 'websiteLab':
      return runWebsiteLabEngine(input);
    case 'brandLab':
      return runBrandLabEngine(input);
    case 'contentLab':
      return runContentLabEngine(input);
    case 'seoLab':
      // SEO Lab returns SeoLabEngineResult, convert to EngineResult
      const seoLabResult = await runSeoLabEngine(input);
      return {
        success: seoLabResult.success,
        score: seoLabResult.score ?? undefined,
        summary: seoLabResult.summary ?? undefined,
        data: seoLabResult.report,
        error: seoLabResult.error,
      };
    case 'demandLab':
      return runDemandLabEngine(input);
    case 'opsLab':
      return runOpsLabEngine(input);
    default:
      return { success: false, error: `Unknown tool: ${toolId}` };
  }
}
