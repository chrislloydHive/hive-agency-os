// lib/os/diagnostics/adapters.ts
// Tool-specific adapters for extracting report data from diagnostic runs
//
// Each adapter transforms the raw JSON from a diagnostic run into a
// standardized format for the ToolReportLayout component.

import * as React from 'react';
import type { DiagnosticToolId, DiagnosticRun } from './runs';
import type { ScoreItem, ReportSection } from '@/lib/types/toolReport';

// ============================================================================
// Types
// ============================================================================

export interface ToolReportData {
  scores: ScoreItem[];
  keyFindings: string[];
  opportunities: string[];
  sections: ReportSection[];
}

// Types for GAP IA breakdown bullets
type ImpactLevel = 'high' | 'medium' | 'low';

interface GapIaIssueBullet {
  category: string;
  impactLevel: ImpactLevel;
  statement: string;
}

interface GroupedIssues {
  category: string;
  impactLevel: ImpactLevel; // highest impact in this group
  statements: string[];
}

/**
 * Group GAP IA breakdown bullets by category and order by impact level
 */
function groupIssuesByCategory(bullets: GapIaIssueBullet[] = []): GroupedIssues[] {
  const map = new Map<string, GroupedIssues>();

  for (const b of bullets) {
    const existing = map.get(b.category);
    if (!existing) {
      map.set(b.category, {
        category: b.category,
        impactLevel: b.impactLevel,
        statements: [b.statement],
      });
    } else {
      existing.statements.push(b.statement);
      // Keep the highest impact level for the group
      const order: ImpactLevel[] = ['low', 'medium', 'high'];
      if (order.indexOf(b.impactLevel) > order.indexOf(existing.impactLevel)) {
        existing.impactLevel = b.impactLevel;
      }
    }
  }

  const groups = Array.from(map.values());

  // Sort: high → medium → low
  const order: ImpactLevel[] = ['high', 'medium', 'low'];
  groups.sort((a, b) => order.indexOf(a.impactLevel) - order.indexOf(b.impactLevel));

  return groups;
}

// ============================================================================
// Main Adapter Function
// ============================================================================

/**
 * Extract report data from a diagnostic run based on its tool type
 */
export function extractReportData(run: DiagnosticRun): ToolReportData {
  const rawJson = run.rawJson;
  if (!rawJson) {
    return { scores: [], keyFindings: [], opportunities: [], sections: [] };
  }

  switch (run.toolId) {
    case 'gapSnapshot':
      return extractGapSnapshotData(rawJson);
    case 'gapPlan':
      return extractGapPlanData(rawJson);
    case 'gapHeavy':
      return extractGapHeavyData(rawJson);
    case 'websiteLab':
      return extractWebsiteLabData(rawJson);
    case 'brandLab':
      return extractBrandLabData(rawJson);
    case 'contentLab':
      return extractContentLabData(rawJson);
    case 'seoLab':
      return extractSeoLabData(rawJson);
    case 'demandLab':
      return extractDemandLabData(rawJson);
    case 'opsLab':
      return extractOpsLabData(rawJson);
    default:
      return extractGenericData(rawJson);
  }
}

// ============================================================================
// GAP Snapshot Adapter
// ============================================================================

function extractGapSnapshotData(rawJson: any): ToolReportData {
  const ia = rawJson.initialAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract overall score from summary (V2 format)
  if (ia.summary?.overallScore != null) {
    scores.push({
      label: 'Overall',
      value: ia.summary.overallScore,
      maxValue: 100,
      group: 'Summary',
    });
  }

  // Extract dimension scores from dimensions object (V2 format)
  if (ia.dimensions && typeof ia.dimensions === 'object') {
    Object.entries(ia.dimensions).forEach(([key, dim]: [string, any]) => {
      if (dim?.score != null) {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Dimensions',
        });
      }
    });
  }

  // Fallback: Extract dimension scores from scores object (legacy format)
  if (ia.scores && typeof ia.scores === 'object') {
    Object.entries(ia.scores).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({
          label: formatLabel(key),
          value: value,
          maxValue: 100,
          group: 'Dimensions',
        });
      }
    });
  }

  // Extract strengths as key findings
  if (ia.strengths && Array.isArray(ia.strengths)) {
    ia.strengths.slice(0, 5).forEach((s: any) => {
      const text = typeof s === 'string' ? s : s?.title || s?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract gaps as key findings (negative)
  if (ia.gaps && Array.isArray(ia.gaps)) {
    ia.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.title || g?.description;
      if (text) keyFindings.push(`Gap: ${text}`);
    });
  }

  // Extract quick wins as opportunities (V2 format: bullets array with action field)
  if (ia.quickWins?.bullets && Array.isArray(ia.quickWins.bullets)) {
    ia.quickWins.bullets.slice(0, 5).forEach((w: any) => {
      const text = w?.action || w?.title || w?.description;
      if (text) opportunities.push(text);
    });
  } else if (ia.quickWins && Array.isArray(ia.quickWins)) {
    // Legacy format
    ia.quickWins.slice(0, 5).forEach((w: any) => {
      const text = typeof w === 'string' ? w : w?.title || w?.description || w?.action;
      if (text) opportunities.push(text);
    });
  }

  // Extract top opportunities from summary (V2 format)
  if (ia.summary?.topOpportunities && Array.isArray(ia.summary.topOpportunities)) {
    ia.summary.topOpportunities.slice(0, 3).forEach((opp: any) => {
      const text = typeof opp === 'string' ? opp : opp?.title || opp?.opportunity || opp?.description;
      if (text && !opportunities.includes(text)) opportunities.push(text);
    });
  }

  // Add maturity stage section if available (V2 format: in summary)
  const maturityStage = ia.summary?.maturityStage ?? ia.maturityStage;
  if (maturityStage) {
    sections.push({
      id: 'maturity',
      title: 'Maturity Stage',
      icon: 'Target',
      body: createMaturityStageContent(maturityStage, ia.summary?.narrative || ia.maturityDescription),
    });
  }

  // Add strategic recommendations section
  if (ia.strategicRecommendations && Array.isArray(ia.strategicRecommendations)) {
    sections.push({
      id: 'recommendations',
      title: 'Strategic Recommendations',
      icon: 'Compass',
      body: createListSection(ia.strategicRecommendations),
    });
  }

  // Add breakdown section (V2 format) - uses breakdown.bullets with category/impactLevel/statement
  if (ia.breakdown?.bullets && Array.isArray(ia.breakdown.bullets)) {
    // Group bullets by category and sort by impact level (high → medium → low)
    const grouped = groupIssuesByCategory(ia.breakdown.bullets);

    // Create formatted items - one item per category with all statements combined
    const breakdownItems = grouped.map((group) => {
      const impactLabel = group.impactLevel === 'high' ? 'high' : group.impactLevel === 'medium' ? 'medium' : 'lower';
      if (group.statements.length === 1) {
        return `${group.category}: ${group.statements[0]} — ${impactLabel} impact`;
      }
      // Multiple statements: combine with semicolons
      return `${group.category}: ${group.statements.join('; ')} — ${impactLabel} impact`;
    });

    sections.push({
      id: 'breakdown',
      title: 'Key Issues Breakdown',
      icon: 'AlertCircle',
      body: createListSection(breakdownItems),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// GAP Plan Adapter
// ============================================================================

function extractGapPlanData(rawJson: any): ToolReportData {
  const plan = rawJson.growthPlan || rawJson.fullGap || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract overall score (V3 format)
  if (typeof plan.overallScore === 'number') {
    scores.push({
      label: 'Overall',
      value: plan.overallScore,
      maxValue: 100,
      group: 'Summary',
    });
  }

  // Extract dimension scores from dimensionAnalyses (V3 format)
  if (plan.dimensionAnalyses && Array.isArray(plan.dimensionAnalyses)) {
    plan.dimensionAnalyses.forEach((dim: any) => {
      if (dim?.id && typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(dim.id),
          value: dim.score,
          maxValue: 100,
          group: 'Dimensions',
        });
      }
    });
  }

  // Fallback: Extract scorecard (legacy format)
  if (plan.scorecard && typeof plan.scorecard === 'object') {
    Object.entries(plan.scorecard).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({
          label: formatLabel(key),
          value: value,
          maxValue: 100,
          group: 'Scorecard',
        });
      }
    });
  }

  // Extract strategic priorities as key findings
  if (plan.strategicPriorities && Array.isArray(plan.strategicPriorities)) {
    plan.strategicPriorities.slice(0, 5).forEach((p: any) => {
      const text = typeof p === 'string' ? p : p?.title || p?.name || p?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract key findings from dimension analyses (V3 format)
  if (plan.dimensionAnalyses && Array.isArray(plan.dimensionAnalyses)) {
    plan.dimensionAnalyses.forEach((dim: any) => {
      if (dim?.keyFindings && Array.isArray(dim.keyFindings)) {
        dim.keyFindings.slice(0, 2).forEach((finding: string) => {
          if (finding && !keyFindings.includes(finding)) {
            keyFindings.push(finding);
          }
        });
      }
    });
    // Limit total key findings
    keyFindings.splice(6);
  }

  // Extract quick wins as opportunities
  if (plan.quickWins && Array.isArray(plan.quickWins)) {
    plan.quickWins.slice(0, 5).forEach((w: any) => {
      const text = typeof w === 'string' ? w : w?.action || w?.title || w?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add executive summary section (V3 format)
  if (plan.executiveSummary && typeof plan.executiveSummary === 'string') {
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      icon: 'FileText',
      body: createTextSection(plan.executiveSummary),
    });
  }

  // Add maturity stage section (V3 format)
  if (plan.maturityStage) {
    sections.push({
      id: 'maturity',
      title: 'Marketing Maturity',
      icon: 'Target',
      body: createMaturityStageContent(plan.maturityStage),
    });
  }

  // Add 90-day roadmap section (V3 format: roadmap90Days object)
  if (plan.roadmap90Days && typeof plan.roadmap90Days === 'object') {
    sections.push({
      id: 'roadmap',
      title: '90-Day Roadmap',
      icon: 'Map',
      body: createRoadmap90DaysSection(plan.roadmap90Days),
    });
  }
  // Fallback: legacy roadmap array format
  else if (plan.roadmap && Array.isArray(plan.roadmap)) {
    sections.push({
      id: 'roadmap',
      title: '90-Day Roadmap',
      icon: 'Map',
      body: createRoadmapSection(plan.roadmap),
    });
  }

  // Add strategic priorities section (V3 format)
  if (plan.strategicPriorities && Array.isArray(plan.strategicPriorities)) {
    sections.push({
      id: 'priorities',
      title: 'Strategic Priorities',
      icon: 'Rocket',
      body: createStrategicPrioritiesSection(plan.strategicPriorities),
    });
  }

  // Add KPIs section (V3 format)
  if (plan.kpis && Array.isArray(plan.kpis)) {
    sections.push({
      id: 'kpis',
      title: 'Key Performance Indicators',
      icon: 'BarChart2',
      body: createKpisSection(plan.kpis),
    });
  }

  // Legacy: Add initiatives section
  if (plan.initiatives && Array.isArray(plan.initiatives)) {
    sections.push({
      id: 'initiatives',
      title: 'Strategic Initiatives',
      icon: 'Rocket',
      body: createInitiativesSection(plan.initiatives),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// GAP Heavy Adapter
// ============================================================================

function extractGapHeavyData(rawJson: any): ToolReportData {
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract dimension scores from modules
  if (rawJson.dimensions && typeof rawJson.dimensions === 'object') {
    Object.entries(rawJson.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Marketing Dimensions',
        });
      }
    });
  }

  // Extract key findings
  if (rawJson.keyFindings && Array.isArray(rawJson.keyFindings)) {
    rawJson.keyFindings.slice(0, 6).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.title || f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract strategic themes as opportunities
  if (rawJson.strategicThemes && Array.isArray(rawJson.strategicThemes)) {
    rawJson.strategicThemes.slice(0, 5).forEach((t: any) => {
      const text = typeof t === 'string' ? t : t?.theme || t?.title || t?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add module results sections
  if (rawJson.modules && typeof rawJson.modules === 'object') {
    Object.entries(rawJson.modules).forEach(([moduleKey, moduleData]: [string, any]) => {
      if (moduleData && typeof moduleData === 'object') {
        const moduleName = formatLabel(moduleKey);
        const findings = moduleData.findings || moduleData.keyFindings || [];

        if (findings.length > 0 || moduleData.score != null) {
          sections.push({
            id: moduleKey,
            title: `${moduleName} Analysis`,
            icon: getModuleIcon(moduleKey),
            body: createModuleSection(moduleData, moduleName),
          });
        }
      }
    });
  }

  // Add roadmap section
  if (rawJson.roadmap && Array.isArray(rawJson.roadmap)) {
    sections.push({
      id: 'roadmap',
      title: 'Recommended Roadmap',
      icon: 'Map',
      body: createRoadmapSection(rawJson.roadmap),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Website Lab Adapter
// ============================================================================

function extractWebsiteLabData(rawJson: any): ToolReportData {
  const site = rawJson.siteAssessment || rawJson.diagnostic || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract page scores
  if (site.pageScores && Array.isArray(site.pageScores)) {
    site.pageScores.slice(0, 6).forEach((p: any) => {
      if (p.pagePath && typeof p.score === 'number') {
        scores.push({
          label: p.pagePath === '/' ? 'Homepage' : p.pagePath.replace(/^\//, ''),
          value: p.score,
          maxValue: 100,
          group: 'Page Scores',
        });
      }
    });
  }

  // Extract dimension scores
  if (site.dimensions && typeof site.dimensions === 'object') {
    Object.entries(site.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Dimensions',
        });
      }
    });
  }

  // Extract findings
  if (site.findings && Array.isArray(site.findings)) {
    site.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.title || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract UX issues as findings
  if (site.uxIssues && Array.isArray(site.uxIssues)) {
    site.uxIssues.slice(0, 3).forEach((issue: any) => {
      const text = typeof issue === 'string' ? issue : issue?.description;
      if (text) keyFindings.push(`UX Issue: ${text}`);
    });
  }

  // Extract recommendations as opportunities
  if (site.recommendations && Array.isArray(site.recommendations)) {
    site.recommendations.slice(0, 5).forEach((r: any) => {
      const text = typeof r === 'string' ? r : r?.title || r?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add conversion section
  if (site.conversionAnalysis) {
    sections.push({
      id: 'conversion',
      title: 'Conversion Analysis',
      icon: 'Target',
      body: createConversionSection(site.conversionAnalysis),
    });
  }

  // Add page details section
  if (site.pageDetails && Array.isArray(site.pageDetails)) {
    sections.push({
      id: 'pages',
      title: 'Page-by-Page Analysis',
      icon: 'Layout',
      body: createPageDetailsSection(site.pageDetails),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Brand Lab Adapter
// ============================================================================

function extractBrandLabData(rawJson: any): ToolReportData {
  const brand = rawJson.diagnostic || rawJson.brandAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract dimension scores
  if (brand.dimensions && typeof brand.dimensions === 'object') {
    Object.entries(brand.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Brand Dimensions',
        });
      }
    });
  }

  // Extract brand scores (alternative structure)
  if (brand.scores && typeof brand.scores === 'object') {
    Object.entries(brand.scores).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({
          label: formatLabel(key),
          value: value,
          maxValue: 100,
          group: 'Brand Scores',
        });
      }
    });
  }

  // Extract strengths
  if (brand.strengths && Array.isArray(brand.strengths)) {
    brand.strengths.slice(0, 4).forEach((s: any) => {
      const text = typeof s === 'string' ? s : s?.strength || s?.description;
      if (text) keyFindings.push(`✓ ${text}`);
    });
  }

  // Extract gaps
  if (brand.gaps && Array.isArray(brand.gaps)) {
    brand.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.gap || g?.description;
      if (text) keyFindings.push(`Gap: ${text}`);
    });
  }

  // Extract recommendations as opportunities
  if (brand.recommendations && Array.isArray(brand.recommendations)) {
    brand.recommendations.slice(0, 5).forEach((r: any) => {
      const text = typeof r === 'string' ? r : r?.title || r?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add positioning section
  if (brand.positioning) {
    sections.push({
      id: 'positioning',
      title: 'Brand Positioning',
      icon: 'Crosshair',
      body: createPositioningSection(brand.positioning),
    });
  }

  // Add messaging section
  if (brand.messaging) {
    sections.push({
      id: 'messaging',
      title: 'Messaging Analysis',
      icon: 'MessageSquare',
      body: createMessagingSection(brand.messaging),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Content Lab Adapter
// ============================================================================

function extractContentLabData(rawJson: any): ToolReportData {
  const content = rawJson.diagnostic || rawJson.contentAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract content dimension scores
  if (content.dimensions && typeof content.dimensions === 'object') {
    Object.entries(content.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Content Dimensions',
        });
      }
    });
  }

  // Extract content type scores
  if (content.contentTypes && typeof content.contentTypes === 'object') {
    Object.entries(content.contentTypes).forEach(([key, ct]: [string, any]) => {
      if (typeof ct?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: ct.score,
          maxValue: 100,
          group: 'Content Types',
        });
      }
    });
  }

  // Extract findings
  if (content.findings && Array.isArray(content.findings)) {
    content.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract content gaps as findings
  if (content.gaps && Array.isArray(content.gaps)) {
    content.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.gap || g?.description;
      if (text) keyFindings.push(`Content Gap: ${text}`);
    });
  }

  // Extract opportunities
  if (content.opportunities && Array.isArray(content.opportunities)) {
    content.opportunities.slice(0, 5).forEach((o: any) => {
      const text = typeof o === 'string' ? o : o?.title || o?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add content inventory section
  if (content.inventory) {
    sections.push({
      id: 'inventory',
      title: 'Content Inventory',
      icon: 'FolderOpen',
      body: createContentInventorySection(content.inventory),
    });
  }

  // Add topic coverage section
  if (content.topicCoverage && Array.isArray(content.topicCoverage)) {
    sections.push({
      id: 'topics',
      title: 'Topic Coverage',
      icon: 'Hash',
      body: createTopicCoverageSection(content.topicCoverage),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// SEO Lab Adapter
// ============================================================================

function extractSeoLabData(rawJson: any): ToolReportData {
  // SEO Lab uses SeoLabReport structure with split scoring
  const report = rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract split scores (new format)
  if (report.onSiteScore != null) {
    scores.push({
      label: 'On-site SEO',
      value: report.onSiteScore,
      maxValue: 100,
      group: 'Core Scores',
    });
  }

  if (report.searchPerformanceScore != null) {
    scores.push({
      label: 'Search Performance',
      value: report.searchPerformanceScore,
      maxValue: 100,
      group: 'Core Scores',
    });
  }

  // Overall score (capped)
  if (report.overallScore != null) {
    scores.push({
      label: 'Overall',
      value: report.overallScore,
      maxValue: 100,
      group: 'Summary',
    });
  }

  // Extract subscores (skip Local & GBP if not_evaluated)
  if (report.subscores && Array.isArray(report.subscores)) {
    report.subscores.forEach((sub: any) => {
      // Include all subscores, even not_evaluated ones, for display
      if (sub.label && (sub.score != null || sub.status === 'not_evaluated')) {
        scores.push({
          label: sub.label,
          value: sub.score ?? 0, // Use 0 for not_evaluated
          maxValue: 100,
          group: 'SEO Dimensions',
          // Add metadata for special handling
          metadata: sub.status === 'not_evaluated' ? { notEvaluated: true } : undefined,
        });
      }
    });
  }

  // Extract top strengths as positive findings
  if (report.topStrengths && Array.isArray(report.topStrengths)) {
    report.topStrengths.slice(0, 3).forEach((s: string) => {
      if (s) keyFindings.push(`✓ ${s}`);
    });
  }

  // Extract top gaps as findings
  if (report.topGaps && Array.isArray(report.topGaps)) {
    report.topGaps.slice(0, 3).forEach((g: string) => {
      if (g) keyFindings.push(`Gap: ${g}`);
    });
  }

  // Extract quick wins as opportunities (now derived from issues)
  if (report.quickWins && Array.isArray(report.quickWins)) {
    report.quickWins.slice(0, 5).forEach((qw: any) => {
      const text = typeof qw === 'string' ? qw : qw?.title || qw?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add maturity stage and data confidence section
  if (report.maturityStage) {
    sections.push({
      id: 'maturity',
      title: 'SEO Assessment',
      icon: 'Target',
      body: createSeoAssessmentSection(report),
    });
  }

  // Add issues section
  if (report.issues && Array.isArray(report.issues) && report.issues.length > 0) {
    sections.push({
      id: 'issues',
      title: 'SEO Issues',
      icon: 'AlertCircle',
      body: createSeoIssuesSection(report.issues),
    });
  }

  // Add projects section (now with issue counts)
  if (report.projects && Array.isArray(report.projects) && report.projects.length > 0) {
    sections.push({
      id: 'projects',
      title: 'SEO Projects',
      icon: 'FolderKanban',
      body: createSeoProjectsSection(report.projects),
    });
  }

  // Add analytics snapshot section with context-aware messaging
  if (report.analyticsSnapshot) {
    sections.push({
      id: 'analytics',
      title: 'Search Console Snapshot',
      icon: 'BarChart2',
      body: createGscSnapshotSection(report.analyticsSnapshot, report.dataConfidence),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

/**
 * Create SEO Assessment section with maturity stage and data confidence
 */
function createSeoAssessmentSection(report: any): React.ReactNode {
  const maturityLabels: Record<string, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };

  const maturityColors: Record<string, string> = {
    unproven: 'bg-slate-400/10 text-slate-400 border-slate-400/30',
    emerging: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    scaling: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    established: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const confidenceColors: Record<string, string> = {
    low: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    medium: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    high: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const maturityStage = report.maturityStage || 'unproven';
  const dataConfidence = report.dataConfidence || { score: 0, level: 'low', reason: 'No data available' };

  return React.createElement('div', { className: 'space-y-4' },
    // Maturity and Confidence badges
    React.createElement('div', { className: 'flex flex-wrap items-center gap-3' },
      React.createElement('div', { className: `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${maturityColors[maturityStage] || maturityColors.unproven}` },
        React.createElement('span', { className: 'text-xs uppercase tracking-wider opacity-70' }, 'Maturity'),
        React.createElement('span', { className: 'text-sm font-semibold' }, maturityLabels[maturityStage] || maturityStage)
      ),
      React.createElement('div', { className: `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${confidenceColors[dataConfidence.level] || confidenceColors.low}` },
        React.createElement('span', { className: 'text-xs uppercase tracking-wider opacity-70' }, 'Data Confidence'),
        React.createElement('span', { className: 'text-sm font-semibold' }, `${dataConfidence.score}/100`),
        React.createElement('span', { className: 'text-xs opacity-70' }, `(${dataConfidence.level.charAt(0).toUpperCase() + dataConfidence.level.slice(1)})`)
      )
    ),

    // Split scores display
    (report.onSiteScore != null || report.searchPerformanceScore != null) && React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
      report.onSiteScore != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-400 mb-1' }, 'On-site SEO'),
        React.createElement('p', { className: `text-2xl font-bold ${report.onSiteScore >= 70 ? 'text-emerald-400' : report.onSiteScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${report.onSiteScore}/100`)
      ),
      report.searchPerformanceScore != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-400 mb-1' }, 'Search Performance'),
        React.createElement('p', { className: `text-2xl font-bold ${report.searchPerformanceScore >= 70 ? 'text-emerald-400' : report.searchPerformanceScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${report.searchPerformanceScore}/100`)
      )
    ),

    // Narrative summary
    report.narrativeSummary && React.createElement('p', { className: 'text-sm text-slate-300 leading-relaxed' }, report.narrativeSummary),

    // Data confidence reason (if low)
    dataConfidence.level === 'low' && React.createElement('p', { className: 'text-xs text-amber-400/80 italic' }, dataConfidence.reason)
  );
}

/**
 * Create SEO issues section
 */
function createSeoIssuesSection(issues: any[]): React.ReactNode {
  // Group issues by severity
  const critical = issues.filter((i: any) => i.severity === 'critical');
  const high = issues.filter((i: any) => i.severity === 'high');
  const medium = issues.filter((i: any) => i.severity === 'medium');
  const low = issues.filter((i: any) => i.severity === 'low');

  const severityOrder = [
    { label: 'Critical', items: critical, color: 'text-red-400' },
    { label: 'High', items: high, color: 'text-orange-400' },
    { label: 'Medium', items: medium, color: 'text-amber-400' },
    { label: 'Low', items: low, color: 'text-slate-400' },
  ].filter(g => g.items.length > 0);

  return React.createElement('div', { className: 'space-y-4' },
    severityOrder.map((group) =>
      React.createElement('div', { key: group.label, className: 'space-y-2' },
        React.createElement('h4', { className: `text-sm font-medium ${group.color}` }, `${group.label} (${group.items.length})`),
        React.createElement('ul', { className: 'space-y-1' },
          group.items.slice(0, 5).map((issue: any, idx: number) =>
            React.createElement('li', { key: idx, className: 'text-sm text-slate-400 flex items-start gap-2 pl-2' },
              React.createElement('span', { className: group.color }, '•'),
              React.createElement('span', null, issue.title || issue.description)
            )
          )
        )
      )
    )
  );
}

/**
 * Create SEO projects section (now with issue counts)
 */
function createSeoProjectsSection(projects: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-3' },
    projects.slice(0, 5).map((project: any, idx: number) => {
      const impactColor = project.impact === 'high' ? 'text-emerald-400' : project.impact === 'medium' ? 'text-amber-400' : 'text-slate-400';
      const horizonLabel = project.timeHorizon === 'now' ? 'Now' : project.timeHorizon === 'next' ? 'Next' : 'Later';
      const issueCount = project.issueCount || project.issueIds?.length || 0;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-start justify-between gap-2' },
          React.createElement('h4', { className: 'text-sm font-medium text-slate-200' }, project.title),
          React.createElement('div', { className: 'flex items-center gap-2' },
            issueCount > 0 && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400' }, `${issueCount} issue${issueCount > 1 ? 's' : ''}`),
            React.createElement('span', { className: `text-xs px-2 py-0.5 rounded ${project.timeHorizon === 'now' ? 'bg-amber-400/10 text-amber-400' : 'bg-slate-700 text-slate-400'}` }, horizonLabel)
          )
        ),
        project.description && React.createElement('p', { className: 'text-xs text-slate-400 mt-1' }, project.description),
        React.createElement('p', { className: `text-xs mt-2 ${impactColor}` }, `Impact: ${project.impact}`)
      );
    })
  );
}

/**
 * Create GSC snapshot section with context-aware messaging for data confidence
 */
function createGscSnapshotSection(snapshot: any, dataConfidence?: any): React.ReactNode {
  const isLowConfidence = dataConfidence?.level === 'low';
  const clicks = snapshot.clicks ?? 0;
  const impressions = snapshot.impressions ?? 0;

  return React.createElement('div', { className: 'space-y-4' },
    // Low data warning (context-aware messaging)
    isLowConfidence && React.createElement('div', { className: 'rounded-lg bg-amber-400/10 border border-amber-400/30 p-3' },
      React.createElement('p', { className: 'text-xs text-amber-400' },
        clicks === 0 && impressions < 100
          ? 'Limited search data available. This site has very low or no organic search traffic yet. Metrics below are directional only.'
          : 'Sample size is small. Treat these metrics as directional rather than statistically significant.'
      )
    ),

    // Metrics summary
    React.createElement('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
      snapshot.clicks != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3 text-center' },
        React.createElement('p', { className: 'text-xl font-bold text-slate-200' }, snapshot.clicks.toLocaleString()),
        React.createElement('p', { className: 'text-xs text-slate-400' }, 'Clicks')
      ),
      snapshot.impressions != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3 text-center' },
        React.createElement('p', { className: 'text-xl font-bold text-slate-200' }, snapshot.impressions.toLocaleString()),
        React.createElement('p', { className: 'text-xs text-slate-400' }, 'Impressions')
      ),
      snapshot.ctr != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3 text-center' },
        React.createElement('p', { className: 'text-xl font-bold text-slate-200' }, `${(snapshot.ctr * 100).toFixed(1)}%`),
        React.createElement('p', { className: 'text-xs text-slate-400' }, 'CTR')
      ),
      snapshot.avgPosition != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3 text-center' },
        React.createElement('p', { className: 'text-xl font-bold text-slate-200' }, snapshot.avgPosition.toFixed(1)),
        React.createElement('p', { className: 'text-xs text-slate-400' }, 'Avg Position')
      )
    ),

    // Top queries
    snapshot.topQueries && snapshot.topQueries.length > 0 && React.createElement('div', null,
      React.createElement('h4', { className: 'text-sm font-medium text-slate-300 mb-2' }, 'Top Queries'),
      React.createElement('div', { className: 'space-y-1' },
        snapshot.topQueries.slice(0, 5).map((q: any, idx: number) =>
          React.createElement('div', { key: idx, className: 'flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0' },
            React.createElement('span', { className: 'text-slate-300 truncate max-w-[60%]' }, q.query),
            React.createElement('span', { className: 'text-slate-400' }, `${q.clicks} clicks`)
          )
        )
      )
    ),

    // No queries message for low data scenarios
    (!snapshot.topQueries || snapshot.topQueries.length === 0) && React.createElement('p', { className: 'text-xs text-slate-500 italic' },
      'No search queries recorded yet.'
    )
  );
}

// ============================================================================
// Demand Lab Adapter
// ============================================================================

function extractDemandLabData(rawJson: any): ToolReportData {
  const demand = rawJson.diagnostic || rawJson.demandAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract demand dimension scores
  if (demand.dimensions && typeof demand.dimensions === 'object') {
    Object.entries(demand.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Demand Gen Dimensions',
        });
      }
    });
  }

  // Extract funnel stage scores
  if (demand.funnelStages && typeof demand.funnelStages === 'object') {
    Object.entries(demand.funnelStages).forEach(([stage, data]: [string, any]) => {
      if (typeof data?.score === 'number') {
        scores.push({
          label: formatLabel(stage),
          value: data.score,
          maxValue: 100,
          group: 'Funnel Stages',
        });
      }
    });
  }

  // Extract findings
  if (demand.findings && Array.isArray(demand.findings)) {
    demand.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract gaps
  if (demand.gaps && Array.isArray(demand.gaps)) {
    demand.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.gap || g?.description;
      if (text) keyFindings.push(`Gap: ${text}`);
    });
  }

  // Extract opportunities
  if (demand.opportunities && Array.isArray(demand.opportunities)) {
    demand.opportunities.slice(0, 5).forEach((o: any) => {
      const text = typeof o === 'string' ? o : o?.title || o?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add lead capture section
  if (demand.leadCapture) {
    sections.push({
      id: 'leads',
      title: 'Lead Capture Analysis',
      icon: 'UserPlus',
      body: createLeadCaptureSection(demand.leadCapture),
    });
  }

  // Add conversion paths section
  if (demand.conversionPaths && Array.isArray(demand.conversionPaths)) {
    sections.push({
      id: 'paths',
      title: 'Conversion Paths',
      icon: 'GitBranch',
      body: createConversionPathsSection(demand.conversionPaths),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Ops Lab Adapter
// ============================================================================

function extractOpsLabData(rawJson: any): ToolReportData {
  const ops = rawJson.diagnostic || rawJson.opsAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Extract ops dimension scores
  if (ops.dimensions && typeof ops.dimensions === 'object') {
    Object.entries(ops.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Ops Dimensions',
        });
      }
    });
  }

  // Extract process scores
  if (ops.processes && typeof ops.processes === 'object') {
    Object.entries(ops.processes).forEach(([key, proc]: [string, any]) => {
      if (typeof proc?.score === 'number') {
        scores.push({
          label: formatLabel(key),
          value: proc.score,
          maxValue: 100,
          group: 'Processes',
        });
      }
    });
  }

  // Extract findings
  if (ops.findings && Array.isArray(ops.findings)) {
    ops.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract inefficiencies as findings
  if (ops.inefficiencies && Array.isArray(ops.inefficiencies)) {
    ops.inefficiencies.slice(0, 3).forEach((i: any) => {
      const text = typeof i === 'string' ? i : i?.issue || i?.description;
      if (text) keyFindings.push(`Inefficiency: ${text}`);
    });
  }

  // Extract recommendations as opportunities
  if (ops.recommendations && Array.isArray(ops.recommendations)) {
    ops.recommendations.slice(0, 5).forEach((r: any) => {
      const text = typeof r === 'string' ? r : r?.title || r?.description;
      if (text) opportunities.push(text);
    });
  }

  // Add tooling section
  if (ops.tooling) {
    sections.push({
      id: 'tooling',
      title: 'Marketing Tech Stack',
      icon: 'Layers',
      body: createToolingSection(ops.tooling),
    });
  }

  // Add automation section
  if (ops.automation) {
    sections.push({
      id: 'automation',
      title: 'Automation Assessment',
      icon: 'Zap',
      body: createAutomationSection(ops.automation),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Generic Adapter (Fallback)
// ============================================================================

function extractGenericData(rawJson: any): ToolReportData {
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // Try to extract any scores
  if (rawJson.scores && typeof rawJson.scores === 'object') {
    Object.entries(rawJson.scores).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({ label: formatLabel(key), value, maxValue: 100 });
      }
    });
  }

  // Try to extract findings
  const findingsArrays = ['findings', 'issues', 'problems', 'observations'];
  for (const arrayName of findingsArrays) {
    if (rawJson[arrayName] && Array.isArray(rawJson[arrayName])) {
      rawJson[arrayName].slice(0, 5).forEach((f: any) => {
        const text = typeof f === 'string' ? f : f?.title || f?.description;
        if (text) keyFindings.push(text);
      });
      break;
    }
  }

  // Try to extract opportunities
  const oppsArrays = ['opportunities', 'recommendations', 'suggestions', 'quickWins'];
  for (const arrayName of oppsArrays) {
    if (rawJson[arrayName] && Array.isArray(rawJson[arrayName])) {
      rawJson[arrayName].slice(0, 5).forEach((o: any) => {
        const text = typeof o === 'string' ? o : o?.title || o?.description;
        if (text) opportunities.push(text);
      });
      break;
    }
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function getModuleIcon(moduleKey: string): string {
  const icons: Record<string, string> = {
    website: 'Globe',
    brand: 'Sparkles',
    content: 'FileText',
    seo: 'Search',
    demand: 'TrendingUp',
    ops: 'Settings',
    competitors: 'Users',
    social: 'Share2',
    analytics: 'BarChart2',
  };
  return icons[moduleKey.toLowerCase()] || 'Circle';
}

// ============================================================================
// Section Content Creators (React Nodes)
// ============================================================================

function createMaturityStageContent(stage: string, description?: string): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    React.createElement('div', { className: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30' },
      React.createElement('span', { className: 'text-lg font-semibold text-amber-400' }, stage)
    ),
    description && React.createElement('p', { className: 'text-sm text-slate-400' }, description)
  );
}

function createListSection(items: any[]): React.ReactNode {
  return React.createElement('ul', { className: 'space-y-2' },
    items.slice(0, 6).map((item, idx) => {
      const text = typeof item === 'string' ? item : item?.title || item?.description || JSON.stringify(item);
      return React.createElement('li', { key: idx, className: 'flex items-start gap-2 text-sm text-slate-400' },
        React.createElement('span', { className: 'text-slate-600 mt-1' }, '•'),
        React.createElement('span', null, text)
      );
    })
  );
}

function createRoadmapSection(roadmap: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-3' },
    roadmap.slice(0, 4).map((phase, idx) => {
      const title = typeof phase === 'string' ? phase : phase?.title || phase?.phase || `Phase ${idx + 1}`;
      const items = phase?.items || phase?.actions || [];
      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('h4', { className: 'text-sm font-medium text-slate-200 mb-2' }, title),
        Array.isArray(items) && items.length > 0 && React.createElement('ul', { className: 'space-y-1' },
          items.slice(0, 4).map((item: any, i: number) => {
            const text = typeof item === 'string' ? item : item?.title || item?.description;
            return React.createElement('li', { key: i, className: 'text-xs text-slate-400 flex items-start gap-2' },
              React.createElement('span', { className: 'text-slate-600' }, '→'),
              React.createElement('span', null, text)
            );
          })
        )
      );
    })
  );
}

function createInitiativesSection(initiatives: any[]): React.ReactNode {
  return React.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' },
    initiatives.slice(0, 6).map((init, idx) => {
      const title = typeof init === 'string' ? init : init?.title || init?.name || `Initiative ${idx + 1}`;
      const description = init?.description || init?.summary || '';
      const priority = init?.priority || '';
      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-start justify-between gap-2' },
          React.createElement('h4', { className: 'text-sm font-medium text-slate-200' }, title),
          priority && React.createElement('span', { className: 'text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400' }, priority)
        ),
        description && React.createElement('p', { className: 'mt-1 text-xs text-slate-400' }, description)
      );
    })
  );
}

function createModuleSection(moduleData: any, moduleName: string): React.ReactNode {
  const findings = moduleData.findings || moduleData.keyFindings || [];
  const score = moduleData.score;

  return React.createElement('div', { className: 'space-y-3' },
    score != null && React.createElement('div', { className: 'flex items-center gap-2' },
      React.createElement('span', { className: 'text-sm text-slate-400' }, 'Score:'),
      React.createElement('span', { className: `text-lg font-semibold ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}` }, score)
    ),
    findings.length > 0 && React.createElement('ul', { className: 'space-y-1' },
      findings.slice(0, 4).map((f: any, idx: number) => {
        const text = typeof f === 'string' ? f : f?.finding || f?.description;
        return React.createElement('li', { key: idx, className: 'text-sm text-slate-400 flex items-start gap-2' },
          React.createElement('span', { className: 'text-slate-600 mt-0.5' }, '•'),
          React.createElement('span', null, text)
        );
      })
    )
  );
}

function createConversionSection(analysis: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    analysis.score != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Conversion Score: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, analysis.score)
    ),
    analysis.ctas && React.createElement('p', { className: 'text-sm text-slate-400' },
      'CTAs Found: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, analysis.ctas)
    ),
    analysis.issues && Array.isArray(analysis.issues) && React.createElement('ul', { className: 'space-y-1 mt-2' },
      analysis.issues.slice(0, 3).map((issue: string, idx: number) =>
        React.createElement('li', { key: idx, className: 'text-sm text-amber-400' }, `⚠ ${issue}`)
      )
    )
  );
}

function createPageDetailsSection(pages: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    pages.slice(0, 5).map((page, idx) => {
      const path = page.path || page.url || `Page ${idx + 1}`;
      const score = page.score;
      return React.createElement('div', { key: idx, className: 'flex items-center justify-between py-2 border-b border-slate-800 last:border-0' },
        React.createElement('span', { className: 'text-sm text-slate-300 truncate' }, path),
        score != null && React.createElement('span', { className: `text-sm font-medium ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}` }, score)
      );
    })
  );
}

function createPositioningSection(positioning: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    positioning.statement && React.createElement('p', { className: 'text-sm text-slate-300 italic' }, `"${positioning.statement}"`),
    positioning.category && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Category: ', React.createElement('span', { className: 'text-slate-200' }, positioning.category)
    ),
    positioning.differentiators && Array.isArray(positioning.differentiators) && React.createElement('div', { className: 'mt-2' },
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Differentiators:'),
      React.createElement('div', { className: 'flex flex-wrap gap-1' },
        positioning.differentiators.slice(0, 4).map((d: string, idx: number) =>
          React.createElement('span', { key: idx, className: 'text-xs px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/30' }, d)
        )
      )
    )
  );
}

function createMessagingSection(messaging: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    messaging.headline && React.createElement('p', { className: 'text-sm font-medium text-slate-200' }, messaging.headline),
    messaging.subheadline && React.createElement('p', { className: 'text-sm text-slate-400' }, messaging.subheadline),
    messaging.clarity != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Clarity Score: ', React.createElement('span', { className: 'font-semibold' }, messaging.clarity)
    )
  );
}

function createContentInventorySection(inventory: any): React.ReactNode {
  return React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
    Object.entries(inventory).slice(0, 6).map(([key, value]: [string, any]) =>
      React.createElement('div', { key, className: 'rounded-lg bg-slate-800/50 p-3 text-center' },
        React.createElement('p', { className: 'text-2xl font-bold text-slate-200' }, typeof value === 'number' ? value : value?.count || 0),
        React.createElement('p', { className: 'text-xs text-slate-400' }, formatLabel(key))
      )
    )
  );
}

function createTopicCoverageSection(topics: any[]): React.ReactNode {
  return React.createElement('div', { className: 'flex flex-wrap gap-2' },
    topics.slice(0, 10).map((topic, idx) => {
      const name = typeof topic === 'string' ? topic : topic?.name || topic?.topic;
      const count = topic?.count;
      return React.createElement('span', { key: idx, className: 'text-xs px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/30' },
        name, count != null && ` (${count})`
      );
    })
  );
}

function createKeywordSection(keywords: any): React.ReactNode {
  if (Array.isArray(keywords)) {
    return React.createElement('div', { className: 'flex flex-wrap gap-2' },
      keywords.slice(0, 10).map((kw, idx) => {
        const text = typeof kw === 'string' ? kw : kw?.keyword || kw?.term;
        return React.createElement('span', { key: idx, className: 'text-xs px-2 py-1 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30' }, text);
      })
    );
  }
  return React.createElement('p', { className: 'text-sm text-slate-400' }, 'No keyword data available');
}

function createTechnicalAuditSection(audit: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    audit.score != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Technical Score: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, audit.score)
    ),
    audit.issues && Array.isArray(audit.issues) && React.createElement('ul', { className: 'space-y-1' },
      audit.issues.slice(0, 5).map((issue: any, idx: number) => {
        const text = typeof issue === 'string' ? issue : issue?.issue || issue?.description;
        return React.createElement('li', { key: idx, className: 'text-sm text-amber-400 flex items-start gap-2' },
          React.createElement('span', null, '⚠'),
          React.createElement('span', null, text)
        );
      })
    )
  );
}

function createLeadCaptureSection(leadCapture: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    leadCapture.formsFound != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Forms Found: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, leadCapture.formsFound)
    ),
    leadCapture.score != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Lead Capture Score: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, leadCapture.score)
    ),
    leadCapture.issues && Array.isArray(leadCapture.issues) && React.createElement('ul', { className: 'space-y-1 mt-2' },
      leadCapture.issues.slice(0, 3).map((issue: string, idx: number) =>
        React.createElement('li', { key: idx, className: 'text-sm text-amber-400' }, `⚠ ${issue}`)
      )
    )
  );
}

function createConversionPathsSection(paths: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    paths.slice(0, 4).map((path, idx) => {
      const name = typeof path === 'string' ? path : path?.name || path?.path || `Path ${idx + 1}`;
      const steps = path?.steps || [];
      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('h4', { className: 'text-sm font-medium text-slate-200 mb-1' }, name),
        steps.length > 0 && React.createElement('div', { className: 'flex items-center gap-1 text-xs text-slate-400' },
          steps.slice(0, 4).map((step: string, i: number) =>
            React.createElement(React.Fragment, { key: i },
              i > 0 && React.createElement('span', { className: 'text-slate-600' }, '→'),
              React.createElement('span', null, step)
            )
          )
        )
      );
    })
  );
}

function createToolingSection(tooling: any): React.ReactNode {
  if (Array.isArray(tooling)) {
    return React.createElement('div', { className: 'flex flex-wrap gap-2' },
      tooling.slice(0, 10).map((tool, idx) => {
        const name = typeof tool === 'string' ? tool : tool?.name || tool?.tool;
        return React.createElement('span', { key: idx, className: 'text-xs px-2 py-1 rounded-full bg-orange-400/10 text-orange-400 border border-orange-400/30' }, name);
      })
    );
  }
  return React.createElement('p', { className: 'text-sm text-slate-400' }, 'No tooling data available');
}

function createAutomationSection(automation: any): React.ReactNode {
  return React.createElement('div', { className: 'space-y-2' },
    automation.score != null && React.createElement('p', { className: 'text-sm text-slate-400' },
      'Automation Score: ', React.createElement('span', { className: 'font-semibold text-slate-200' }, automation.score)
    ),
    automation.opportunities && Array.isArray(automation.opportunities) && React.createElement('ul', { className: 'space-y-1 mt-2' },
      automation.opportunities.slice(0, 4).map((opp: any, idx: number) => {
        const text = typeof opp === 'string' ? opp : opp?.opportunity || opp?.description;
        return React.createElement('li', { key: idx, className: 'text-sm text-emerald-400 flex items-start gap-2' },
          React.createElement('span', null, '✓'),
          React.createElement('span', null, text)
        );
      })
    )
  );
}

// ============================================================================
// V3 GAP Plan Section Creators
// ============================================================================

/**
 * Create a simple text paragraph section (for executive summary, etc.)
 */
function createTextSection(text: string): React.ReactNode {
  // Split into paragraphs if there are multiple
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  return React.createElement('div', { className: 'space-y-3' },
    paragraphs.map((para, idx) =>
      React.createElement('p', { key: idx, className: 'text-sm text-slate-300 leading-relaxed' }, para.trim())
    )
  );
}

/**
 * Create a 90-day roadmap section from V3 format
 * V3 roadmap90Days: { phase1: { title, focus, actions[] }, phase2: {...}, phase3: {...} }
 */
function createRoadmap90DaysSection(roadmap: any): React.ReactNode {
  const phases = ['phase1', 'phase2', 'phase3'];
  const phaseLabels: Record<string, string> = {
    phase1: 'Days 1-30',
    phase2: 'Days 31-60',
    phase3: 'Days 61-90',
  };

  return React.createElement('div', { className: 'space-y-4' },
    phases.map((phaseKey) => {
      const phase = roadmap[phaseKey];
      if (!phase) return null;

      const title = phase.title || phaseLabels[phaseKey];
      const focus = phase.focus;
      const actions = phase.actions || [];

      return React.createElement('div', { key: phaseKey, className: 'rounded-lg bg-slate-800/50 p-4' },
        React.createElement('div', { className: 'flex items-center gap-2 mb-2' },
          React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30' }, phaseLabels[phaseKey]),
          React.createElement('h4', { className: 'text-sm font-semibold text-slate-200' }, title)
        ),
        focus && React.createElement('p', { className: 'text-sm text-slate-400 mb-3' }, focus),
        actions.length > 0 && React.createElement('ul', { className: 'space-y-2' },
          actions.slice(0, 5).map((action: any, idx: number) => {
            const text = typeof action === 'string' ? action : action?.action || action?.title || action?.description;
            return React.createElement('li', { key: idx, className: 'text-sm text-slate-300 flex items-start gap-2' },
              React.createElement('span', { className: 'text-amber-400 mt-0.5' }, '→'),
              React.createElement('span', null, text)
            );
          })
        )
      );
    })
  );
}

/**
 * Create a strategic priorities section from V3 format
 * V3 strategicPriorities: [{ title, description, timeline?, impact? }]
 */
function createStrategicPrioritiesSection(priorities: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-3' },
    priorities.slice(0, 5).map((priority, idx) => {
      const title = typeof priority === 'string' ? priority : priority?.title || priority?.name;
      const description = priority?.description || priority?.rationale;
      const timeline = priority?.timeline;
      const impact = priority?.impact;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-4' },
        React.createElement('div', { className: 'flex items-start justify-between gap-3' },
          React.createElement('h4', { className: 'text-sm font-semibold text-slate-200' }, title),
          timeline && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400 whitespace-nowrap' }, timeline)
        ),
        description && React.createElement('p', { className: 'text-sm text-slate-400 mt-2' }, description),
        impact && React.createElement('p', { className: 'text-xs text-emerald-400 mt-2' }, `Impact: ${impact}`)
      );
    })
  );
}

/**
 * Create a KPIs section from V3 format
 * V3 kpis: [{ metric, currentBaseline?, target?, timeframe? }]
 */
function createKpisSection(kpis: any[]): React.ReactNode {
  return React.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' },
    kpis.slice(0, 6).map((kpi, idx) => {
      const metric = typeof kpi === 'string' ? kpi : kpi?.metric || kpi?.name || kpi?.kpi;
      const baseline = kpi?.currentBaseline || kpi?.baseline || kpi?.current;
      const target = kpi?.target;
      const timeframe = kpi?.timeframe;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('h4', { className: 'text-sm font-medium text-slate-200 mb-2' }, metric),
        React.createElement('div', { className: 'flex items-center gap-3 text-xs' },
          baseline && React.createElement('div', { className: 'text-slate-400' },
            React.createElement('span', { className: 'text-slate-500' }, 'Now: '),
            React.createElement('span', { className: 'text-slate-300' }, baseline)
          ),
          target && React.createElement('div', { className: 'text-slate-400' },
            React.createElement('span', { className: 'text-slate-500' }, 'Target: '),
            React.createElement('span', { className: 'text-emerald-400 font-medium' }, target)
          )
        ),
        timeframe && React.createElement('p', { className: 'text-xs text-slate-500 mt-1' }, timeframe)
      );
    })
  );
}
