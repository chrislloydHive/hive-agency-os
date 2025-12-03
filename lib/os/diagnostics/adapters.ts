// lib/os/diagnostics/adapters.ts
// Tool-specific adapters for extracting report data from diagnostic runs
//
// Each adapter transforms the raw JSON from a diagnostic run into a
// standardized format for the ToolReportLayout component.

import * as React from 'react';
import type { DiagnosticToolId, DiagnosticRun } from './runs';
import type { ScoreItem, ReportSection } from '@/lib/types/toolReport';
import { normalizeBrandLab, DIMENSION_LABELS } from '@/lib/brandLab/normalizeBrandLab';

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

  // =========================================================================
  // Key Findings - Extract from breakdown bullets (most specific) or gaps
  // =========================================================================

  // Prefer breakdown bullets as Key Findings (V2 format) - they're categorized and prioritized
  if (ia.breakdown?.bullets && Array.isArray(ia.breakdown.bullets)) {
    // Sort by impact level (high first) and take top findings
    const sortedBullets = [...ia.breakdown.bullets].sort((a: any, b: any) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.impactLevel] ?? 2) - (order[b.impactLevel] ?? 2);
    });

    sortedBullets.slice(0, 5).forEach((bullet: any) => {
      const text = bullet?.statement || bullet?.description;
      const category = bullet?.category;
      if (text) {
        keyFindings.push(category ? `${category}: ${text}` : text);
      }
    });
  }
  // Fallback: Use gaps as key findings
  else if (ia.gaps && Array.isArray(ia.gaps)) {
    ia.gaps.slice(0, 5).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.title || g?.description;
      if (text) keyFindings.push(text);
    });
  }
  // Fallback: Extract from dimension issues
  else if (ia.dimensions && typeof ia.dimensions === 'object') {
    Object.entries(ia.dimensions).forEach(([key, dim]: [string, any]) => {
      if (dim?.issues && Array.isArray(dim.issues)) {
        dim.issues.slice(0, 1).forEach((issue: string) => {
          if (issue && keyFindings.length < 5) {
            keyFindings.push(`${formatLabel(key)}: ${issue}`);
          }
        });
      }
    });
  }

  // =========================================================================
  // Top Opportunities - Extract from topOpportunities or quickWins
  // =========================================================================

  // Prefer top opportunities from summary (V2 format) - strategic level
  if (ia.summary?.topOpportunities && Array.isArray(ia.summary.topOpportunities)) {
    ia.summary.topOpportunities.slice(0, 5).forEach((opp: any) => {
      const text = typeof opp === 'string' ? opp : opp?.title || opp?.opportunity || opp?.description;
      if (text && !opportunities.includes(text)) opportunities.push(text);
    });
  }

  // Add quick wins if we need more opportunities (V2 format: bullets array with action field)
  if (opportunities.length < 3) {
    if (ia.quickWins?.bullets && Array.isArray(ia.quickWins.bullets)) {
      ia.quickWins.bullets.slice(0, 5 - opportunities.length).forEach((w: any) => {
        const text = w?.action || w?.title || w?.description;
        if (text && !opportunities.includes(text)) opportunities.push(text);
      });
    } else if (ia.quickWins && Array.isArray(ia.quickWins)) {
      // Legacy format
      ia.quickWins.slice(0, 5 - opportunities.length).forEach((w: any) => {
        const text = typeof w === 'string' ? w : w?.title || w?.description || w?.action;
        if (text && !opportunities.includes(text)) opportunities.push(text);
      });
    }
  }

  // =========================================================================
  // Sections - Maturity stage and strategic recommendations
  // =========================================================================

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

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// GAP Plan Adapter
// ============================================================================

function extractGapPlanData(rawJson: any): ToolReportData {
  // Handle multiple data locations:
  // - OS V4 multi-pass: data is under rawJson.growthPlan (from runGapPlanEngine)
  // - OS V3 format: data is under rawJson.fullGap
  // - DMA V4 format: data is at rawJson directly (scorecard, executiveSummary, etc.)
  const plan = rawJson.growthPlan || rawJson.fullGap || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // =========================================================================
  // Scores Extraction
  // =========================================================================

  // V4 multi-pass format: scorecard is on plan (growthPlan.scorecard)
  // Also check rawJson for DMA V4 format where scorecard is at root
  const scorecard = plan.scorecard || rawJson.scorecard;
  if (scorecard && typeof scorecard === 'object') {
    Object.entries(scorecard).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({
          label: formatLabel(key),
          value: value,
          maxValue: 100,
          group: key === 'overall' ? 'Summary' : 'Dimensions',
        });
      }
    });
  }
  // OS V3 format: overallScore directly on plan
  else if (typeof plan.overallScore === 'number') {
    scores.push({
      label: 'Overall',
      value: plan.overallScore,
      maxValue: 100,
      group: 'Summary',
    });

    // Extract dimension scores from dimensionAnalyses (V3 raw format)
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
    // V3 API mapped format: dimensionScores object
    else if (plan.dimensionScores && typeof plan.dimensionScores === 'object') {
      Object.entries(plan.dimensionScores).forEach(([key, value]) => {
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
  }
  // Legacy scorecard format (nested under plan)
  else if (plan.scorecard && typeof plan.scorecard === 'object') {
    Object.entries(plan.scorecard).forEach(([key, value]) => {
      if (typeof value === 'number') {
        scores.push({
          label: formatLabel(key),
          value: value,
          maxValue: 100,
          group: key === 'overall' ? 'Summary' : 'Scorecard',
        });
      }
    });
  }

  // =========================================================================
  // Key Findings Extraction
  // =========================================================================

  // V4 multi-pass format: executiveSummary is on plan (growthPlan.executiveSummary)
  // Also check rawJson for DMA V4 format where it's at root
  const execSummary = plan.executiveSummary || rawJson.executiveSummary;
  if (execSummary && typeof execSummary === 'object') {
    // Key issues from executive summary
    if (execSummary.keyIssues && Array.isArray(execSummary.keyIssues)) {
      execSummary.keyIssues.slice(0, 3).forEach((issue: string) => {
        if (issue && !keyFindings.includes(issue)) keyFindings.push(issue);
      });
    }
    // Strategic priorities from executive summary
    if (execSummary.strategicPriorities && Array.isArray(execSummary.strategicPriorities)) {
      execSummary.strategicPriorities.slice(0, 3).forEach((p: string) => {
        if (p && !keyFindings.includes(p)) keyFindings.push(p);
      });
    }
  }

  // V4 multi-pass format: strategicInitiatives is on plan (growthPlan.strategicInitiatives)
  const strategicInitiatives = plan.strategicInitiatives || rawJson.strategicInitiatives;
  if (strategicInitiatives && Array.isArray(strategicInitiatives)) {
    strategicInitiatives.slice(0, 5).forEach((si: any) => {
      const text = si?.title || si?.description;
      if (text && !keyFindings.includes(text)) keyFindings.push(text);
    });
  }

  // OS V3 format: strategicPriorities on plan
  if (keyFindings.length === 0 && plan.strategicPriorities && Array.isArray(plan.strategicPriorities)) {
    plan.strategicPriorities.slice(0, 5).forEach((p: any) => {
      const text = typeof p === 'string' ? p : p?.title || p?.name || p?.description;
      if (text) keyFindings.push(text);
    });
  }
  // V3 API mapped format: strategicPrioritiesSummary
  else if (keyFindings.length === 0 && plan.strategicPrioritiesSummary && Array.isArray(plan.strategicPrioritiesSummary)) {
    plan.strategicPrioritiesSummary.slice(0, 5).forEach((p: any) => {
      const text = typeof p === 'string' ? p : p?.title || p?.name || p?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Extract key findings from dimension analyses (V3 and DMA V4 format)
  const dimAnalyses = plan.dimensionAnalyses || rawJson.dimensionAnalyses;
  if (dimAnalyses && Array.isArray(dimAnalyses)) {
    dimAnalyses.forEach((dim: any) => {
      if (dim?.keyFindings && Array.isArray(dim.keyFindings)) {
        dim.keyFindings.slice(0, 2).forEach((finding: string) => {
          if (finding && !keyFindings.includes(finding)) {
            keyFindings.push(finding);
          }
        });
      }
    });
  }
  // Limit total key findings
  keyFindings.splice(6);

  // =========================================================================
  // Opportunities Extraction
  // =========================================================================

  // V4 multi-pass format: quickWins is on plan (growthPlan.quickWins)
  const quickWins = plan.quickWins || rawJson.quickWins;
  if (quickWins && Array.isArray(quickWins)) {
    quickWins.slice(0, 5).forEach((w: any) => {
      const text = typeof w === 'string' ? w : w?.action || w?.title || w?.description;
      if (text) opportunities.push(text);
    });
  }
  // V3 API mapped format: quickWinsSummary
  else if (plan.quickWinsSummary && Array.isArray(plan.quickWinsSummary)) {
    plan.quickWinsSummary.slice(0, 5).forEach((w: any) => {
      const text = typeof w === 'string' ? w : w?.action || w?.title || w?.description;
      if (text) opportunities.push(text);
    });
  }

  // =========================================================================
  // Sections Extraction
  // =========================================================================

  // Executive Summary section
  // DMA V4 format: executiveSummary is an object with narrative, companyOverview, etc.
  if (execSummary && typeof execSummary === 'object' && execSummary.narrative) {
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      icon: 'FileText',
      body: createTextSection(execSummary.narrative),
    });
  }
  // OS V3 format: executiveSummary is a string
  else if (plan.executiveSummary && typeof plan.executiveSummary === 'string') {
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      icon: 'FileText',
      body: createTextSection(plan.executiveSummary),
    });
  }

  // Maturity Stage section
  // DMA V4 format: maturityStage in executiveSummary or businessContext
  const maturityStage = execSummary?.maturityStage || rawJson.businessContext?.maturityStage || plan.maturityStage;
  if (maturityStage) {
    sections.push({
      id: 'maturity',
      title: 'Marketing Maturity',
      icon: 'Target',
      body: createMaturityStageContent(maturityStage),
    });
  }

  // 90-Day Roadmap section
  // V4 multi-pass format: roadmap is on plan (growthPlan.roadmap)
  const roadmap = plan.roadmap || rawJson.roadmap;
  if (roadmap && Array.isArray(roadmap)) {
    sections.push({
      id: 'roadmap',
      title: '90-Day Roadmap',
      icon: 'Map',
      body: createDmaRoadmapSection(roadmap),
    });
  }
  // OS V3 raw format: roadmap90Days object
  else if (plan.roadmap90Days && typeof plan.roadmap90Days === 'object') {
    sections.push({
      id: 'roadmap',
      title: '90-Day Roadmap',
      icon: 'Map',
      body: createRoadmap90DaysSection(plan.roadmap90Days),
    });
  }
  // V3 API mapped format: roadmapPhases
  else if (plan.roadmapPhases && typeof plan.roadmapPhases === 'object') {
    sections.push({
      id: 'roadmap',
      title: '90-Day Roadmap',
      icon: 'Map',
      body: createRoadmapPhasesSection(plan.roadmapPhases),
    });
  }

  // Strategic Initiatives / Priorities section
  // V4 multi-pass format: strategicInitiatives is on plan (already extracted above)
  if (strategicInitiatives && Array.isArray(strategicInitiatives) && strategicInitiatives.length > 0) {
    sections.push({
      id: 'initiatives',
      title: 'Strategic Initiatives',
      icon: 'Rocket',
      body: createDmaStrategicInitiativesSection(strategicInitiatives),
    });
  }
  // OS V3 raw format: strategicPriorities
  else if (plan.strategicPriorities && Array.isArray(plan.strategicPriorities)) {
    sections.push({
      id: 'priorities',
      title: 'Strategic Priorities',
      icon: 'Rocket',
      body: createStrategicPrioritiesSection(plan.strategicPriorities),
    });
  }
  // V3 API mapped format: strategicPrioritiesSummary
  else if (plan.strategicPrioritiesSummary && Array.isArray(plan.strategicPrioritiesSummary)) {
    sections.push({
      id: 'priorities',
      title: 'Strategic Priorities',
      icon: 'Rocket',
      body: createStrategicPrioritiesSummarySection(plan.strategicPrioritiesSummary),
    });
  }
  // Legacy: initiatives section
  else if (plan.initiatives && Array.isArray(plan.initiatives)) {
    sections.push({
      id: 'initiatives',
      title: 'Strategic Initiatives',
      icon: 'Rocket',
      body: createInitiativesSection(plan.initiatives),
    });
  }

  // KPIs section
  // V4 multi-pass format: kpis is on plan (growthPlan.kpis)
  const kpis = plan.kpis || rawJson.kpis;
  if (kpis && Array.isArray(kpis)) {
    sections.push({
      id: 'kpis',
      title: 'Key Performance Indicators',
      icon: 'BarChart2',
      body: createKpisSection(kpis),
    });
  }
  // V3 API mapped format: kpisSummary
  else if (plan.kpisSummary && Array.isArray(plan.kpisSummary)) {
    sections.push({
      id: 'kpis',
      title: 'Key Performance Indicators',
      icon: 'BarChart2',
      body: createKpisSummarySection(plan.kpisSummary),
    });
  }

  // Quick Wins section (already extracted quickWins above)
  const qwList = quickWins;
  if (qwList && Array.isArray(qwList) && qwList.length > 0) {
    sections.push({
      id: 'quick-wins',
      title: 'Quick Wins',
      icon: 'Zap',
      body: createQuickWinsSection(qwList),
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
  // Use the normalizer to get a consistent, deduped result
  const normalized = normalizeBrandLab(rawJson);

  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // =========================================================================
  // A) Dimension scores - Using standardized labels from DIMENSION_LABELS
  // =========================================================================
  normalized.dimensions.forEach((dim) => {
    scores.push({
      label: dim.label, // Already standardized: "Identity & Promise", etc.
      value: dim.score,
      maxValue: 100,
      group: 'Brand Dimensions',
    });
  });

  // =========================================================================
  // B) Key Findings - From issues[], sorted by severity then category
  // =========================================================================
  normalized.issues.forEach((issue) => {
    const severityMarker = issue.severity === 'high' ? '!' : issue.severity === 'medium' ? '*' : '';
    keyFindings.push(`${severityMarker} ${issue.title}`);
  });

  // =========================================================================
  // C) Top Opportunities - Deduped quickWins then projects, limit 5
  // =========================================================================
  normalized.topOpportunities.forEach((opp) => {
    const prefix = opp.type === 'project' ? 'Project: ' : '';
    opportunities.push(`${prefix}${opp.title}`);
  });

  // =========================================================================
  // D) Brand Maturity Section - Using JSON-provided maturityStage
  // =========================================================================
  sections.push({
    id: 'maturity',
    title: 'Brand Maturity',
    icon: 'Target',
    body: createBrandMaturitySectionNormalized(normalized),
  });

  // =========================================================================
  // E) Positioning Section - Using JSON-driven data
  // =========================================================================
  if (normalized.positioning.theme || normalized.positioning.competitiveAngle) {
    sections.push({
      id: 'positioning',
      title: 'Brand Positioning',
      icon: 'Crosshair',
      body: createPositioningSectionNormalized(normalized.positioning, normalized.audienceFit),
    });
  }

  // =========================================================================
  // F) Messaging Section - Using JSON-driven data
  // =========================================================================
  if (normalized.messaging.valueProps.length > 0 || normalized.messaging.messagingFocus > 0) {
    sections.push({
      id: 'messaging',
      title: 'Messaging Analysis',
      icon: 'MessageSquare',
      body: createMessagingSectionNormalized(normalized.messaging),
    });
  }

  // =========================================================================
  // G) Identity Section - Using JSON-driven data
  // =========================================================================
  if (normalized.identity.tagline || normalized.identity.corePromise) {
    sections.push({
      id: 'identity',
      title: 'Brand Identity',
      icon: 'Fingerprint',
      body: createIdentitySectionNormalized(normalized.identity),
    });
  }

  // =========================================================================
  // H) Trust Section - Using JSON-driven data
  // =========================================================================
  if (normalized.trust.trustArchetype || normalized.trust.trustSignalsScore > 0) {
    sections.push({
      id: 'trust',
      title: 'Trust & Proof',
      icon: 'Shield',
      body: createTrustSectionNormalized(normalized.trust),
    });
  }

  return { scores, keyFindings, opportunities, sections };
}

// ============================================================================
// Normalized Section Creators for Brand Lab
// ============================================================================

/**
 * Create Brand Maturity Section using normalized data
 */
function createBrandMaturitySectionNormalized(normalized: ReturnType<typeof normalizeBrandLab>): React.ReactNode {
  const maturityLabels: Record<string, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };

  const maturityColors: Record<string, string> = {
    unproven: 'bg-red-400/10 text-red-400 border-red-400/30',
    emerging: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    scaling: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    established: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const confidenceColors: Record<string, string> = {
    low: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    medium: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    high: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const { maturityStage, dataConfidence, narrativeSummary, brandPillars } = normalized;

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

    // Narrative summary - directly from JSON, no regeneration
    narrativeSummary && React.createElement('p', { className: 'text-sm text-slate-300 leading-relaxed' }, narrativeSummary),

    // Brand Pillars (if available) - exactly from JSON
    brandPillars.length > 0 && React.createElement('div', { className: 'mt-4 pt-4 border-t border-slate-700/50' },
      React.createElement('h4', { className: 'text-xs uppercase tracking-wider text-slate-500 mb-3' }, 'Brand Pillars'),
      React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
        brandPillars.map((pillar, idx) =>
          React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
            React.createElement('div', { className: 'flex items-center justify-between mb-1' },
              React.createElement('span', { className: 'text-sm font-medium text-slate-200' }, pillar.name),
              React.createElement('span', { className: `text-xs font-semibold ${pillar.strengthScore >= 70 ? 'text-emerald-400' : pillar.strengthScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${pillar.strengthScore}/100`)
            ),
            pillar.description && React.createElement('p', { className: 'text-xs text-slate-400' }, pillar.description),
            React.createElement('div', { className: 'flex gap-2 mt-1' },
              pillar.isExplicit && React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400' }, 'Explicit'),
              pillar.isPerceived && React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400' }, 'Perceived')
            )
          )
        )
      )
    ),

    // Data confidence reason (if low)
    dataConfidence.level === 'low' && dataConfidence.reason && React.createElement('p', { className: 'text-xs text-amber-400/80 italic mt-2' }, dataConfidence.reason)
  );
}

/**
 * Create Positioning Section using normalized data
 */
function createPositioningSectionNormalized(
  positioning: ReturnType<typeof normalizeBrandLab>['positioning'],
  audienceFit: ReturnType<typeof normalizeBrandLab>['audienceFit']
): React.ReactNode {
  const { theme, competitiveAngle, clarityScore, risks } = positioning;
  const { primaryICPDescription, alignmentScore, icpSignals } = audienceFit;

  return React.createElement('div', { className: 'space-y-4' },
    // Two-column layout for theme and angle
    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
      theme && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Positioning Theme'),
        React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, theme)
      ),
      competitiveAngle && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Competitive Angle'),
        React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, competitiveAngle)
      )
    ),

    // Clarity score
    clarityScore > 0 && React.createElement('div', { className: 'flex items-center gap-2' },
      React.createElement('span', { className: 'text-xs text-slate-500' }, 'Clarity Score:'),
      React.createElement('span', { className: `text-sm font-semibold ${clarityScore >= 70 ? 'text-emerald-400' : clarityScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${clarityScore}/100`)
    ),

    // Target Audience section
    primaryICPDescription && React.createElement('div', { className: 'rounded-lg bg-purple-500/10 border border-purple-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-2' },
        React.createElement('span', { className: 'text-xs text-purple-400 uppercase tracking-wider' }, 'Target Audience'),
        alignmentScore > 0 && React.createElement('span', { className: `text-xs font-semibold ${alignmentScore >= 70 ? 'text-emerald-400' : alignmentScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${alignmentScore}/100 alignment`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200' }, primaryICPDescription),
      icpSignals.length > 0 && React.createElement('div', { className: 'flex flex-wrap gap-1 mt-2' },
        icpSignals.slice(0, 4).map((signal, idx) =>
          React.createElement('span', { key: idx, className: 'text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300' }, signal)
        )
      )
    ),

    // Positioning risks
    risks.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Risks:'),
      React.createElement('ul', { className: 'space-y-1' },
        risks.slice(0, 3).map((risk, idx) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, risk)
          )
        )
      )
    )
  );
}

/**
 * Create Messaging Section using normalized data
 */
function createMessagingSectionNormalized(messaging: ReturnType<typeof normalizeBrandLab>['messaging']): React.ReactNode {
  const { benefitVsFeature, icpClarity, messagingFocus, valueProps, clarityIssues, differentiators, headlines } = messaging;

  return React.createElement('div', { className: 'space-y-4' },
    // Scores row
    (messagingFocus > 0 || icpClarity > 0 || benefitVsFeature > 0) && React.createElement('div', { className: 'flex flex-wrap gap-4' },
      messagingFocus > 0 && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'Messaging Focus:'),
        React.createElement('span', { className: `text-sm font-semibold ${messagingFocus >= 70 ? 'text-emerald-400' : messagingFocus >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${messagingFocus}/100`)
      ),
      icpClarity > 0 && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'ICP Clarity:'),
        React.createElement('span', { className: `text-sm font-semibold ${icpClarity >= 70 ? 'text-emerald-400' : icpClarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${icpClarity}/100`)
      ),
      benefitVsFeature > 0 && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'Benefit vs Feature:'),
        React.createElement('span', { className: `text-sm font-semibold ${benefitVsFeature >= 70 ? 'text-emerald-400' : benefitVsFeature >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${benefitVsFeature}/100`)
      )
    ),

    // Value Propositions
    valueProps.length > 0 && React.createElement('div', { className: 'rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3' },
      React.createElement('p', { className: 'text-xs text-emerald-400 uppercase tracking-wider mb-2' }, 'Value Propositions'),
      React.createElement('div', { className: 'space-y-2' },
        valueProps.slice(0, 3).map((vp, idx) =>
          React.createElement('div', { key: idx, className: 'text-sm text-slate-200' },
            React.createElement('p', null, vp.statement),
            (vp.clarityScore != null || vp.uniquenessScore != null) && React.createElement('div', { className: 'flex gap-3 mt-1 text-xs' },
              vp.clarityScore != null && React.createElement('span', { className: `${vp.clarityScore >= 70 ? 'text-emerald-400' : vp.clarityScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `Clarity: ${vp.clarityScore}`),
              vp.uniquenessScore != null && React.createElement('span', { className: `${vp.uniquenessScore >= 70 ? 'text-emerald-400' : vp.uniquenessScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `Uniqueness: ${vp.uniquenessScore}`)
            )
          )
        )
      )
    ),

    // Sample headlines
    headlines.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Sample Headlines'),
      React.createElement('ul', { className: 'space-y-1' },
        headlines.slice(0, 3).map((h, idx) =>
          React.createElement('li', { key: idx, className: 'text-sm text-slate-300 italic' }, `"${h}"`)
        )
      )
    ),

    // Differentiators
    differentiators.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Differentiators'),
      React.createElement('div', { className: 'flex flex-wrap gap-1' },
        differentiators.slice(0, 5).map((d, idx) =>
          React.createElement('span', { key: idx, className: 'text-xs px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/30' }, d)
        )
      )
    ),

    // Clarity issues
    clarityIssues.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Clarity Issues'),
      React.createElement('ul', { className: 'space-y-1' },
        clarityIssues.slice(0, 3).map((issue, idx) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, issue)
          )
        )
      )
    )
  );
}

/**
 * Create Identity Section using normalized data
 */
function createIdentitySectionNormalized(identity: ReturnType<typeof normalizeBrandLab>['identity']): React.ReactNode {
  const { tagline, taglineClarityScore, corePromise, corePromiseClarityScore, toneOfVoice, toneConsistencyScore, personalityTraits, identityGaps } = identity;

  return React.createElement('div', { className: 'space-y-4' },
    // Tagline with clarity score
    tagline && React.createElement('div', { className: 'rounded-lg bg-blue-500/10 border border-blue-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-1' },
        React.createElement('span', { className: 'text-xs text-blue-400 uppercase tracking-wider' }, 'Tagline'),
        taglineClarityScore > 0 && React.createElement('span', { className: `text-xs font-semibold ${taglineClarityScore >= 70 ? 'text-emerald-400' : taglineClarityScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${taglineClarityScore}/100 clarity`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, `"${tagline}"`)
    ),

    // Core Promise with clarity score
    corePromise && React.createElement('div', { className: 'rounded-lg bg-purple-500/10 border border-purple-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-1' },
        React.createElement('span', { className: 'text-xs text-purple-400 uppercase tracking-wider' }, 'Core Promise'),
        corePromiseClarityScore > 0 && React.createElement('span', { className: `text-xs font-semibold ${corePromiseClarityScore >= 70 ? 'text-emerald-400' : corePromiseClarityScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${corePromiseClarityScore}/100 clarity`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200' }, corePromise)
    ),

    // Tone and personality
    (toneOfVoice || personalityTraits.length > 0) && React.createElement('div', { className: 'flex flex-wrap gap-4' },
      toneOfVoice && React.createElement('div', null,
        React.createElement('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Tone of Voice'),
        React.createElement('span', { className: 'text-sm text-slate-200' }, toneOfVoice),
        toneConsistencyScore > 0 && React.createElement('span', { className: `ml-2 text-xs ${toneConsistencyScore >= 70 ? 'text-emerald-400' : toneConsistencyScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `(${toneConsistencyScore}/100)`)
      ),
      personalityTraits.length > 0 && React.createElement('div', null,
        React.createElement('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Personality Traits'),
        React.createElement('div', { className: 'flex flex-wrap gap-1' },
          personalityTraits.map((trait, idx) =>
            React.createElement('span', { key: idx, className: 'text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300' }, trait)
          )
        )
      )
    ),

    // Identity gaps
    identityGaps.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Identity Gaps'),
      React.createElement('ul', { className: 'space-y-1' },
        identityGaps.slice(0, 3).map((gap, idx) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, gap)
          )
        )
      )
    )
  );
}

/**
 * Create Trust Section using normalized data
 */
function createTrustSectionNormalized(trust: ReturnType<typeof normalizeBrandLab>['trust']): React.ReactNode {
  const { trustArchetype, trustSignalsScore, humanPresenceScore, credibilityGaps } = trust;

  return React.createElement('div', { className: 'space-y-4' },
    // Trust archetype badge
    trustArchetype && React.createElement('div', { className: 'flex items-center gap-2' },
      React.createElement('span', { className: 'text-xs text-slate-500' }, 'Trust Archetype:'),
      React.createElement('span', { className: 'text-sm font-medium text-cyan-400 px-2 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/30' }, trustArchetype)
    ),

    // Score meters
    (trustSignalsScore > 0 || humanPresenceScore > 0) && React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
      trustSignalsScore > 0 && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
          React.createElement('span', { className: 'text-xs text-slate-400' }, 'Trust Signals'),
          React.createElement('span', { className: `text-lg font-bold ${trustSignalsScore >= 70 ? 'text-emerald-400' : trustSignalsScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, trustSignalsScore)
        ),
        React.createElement('div', { className: 'h-1.5 bg-slate-700 rounded-full overflow-hidden' },
          React.createElement('div', { className: `h-full rounded-full ${trustSignalsScore >= 70 ? 'bg-emerald-400' : trustSignalsScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`, style: { width: `${trustSignalsScore}%` } })
        )
      ),
      humanPresenceScore > 0 && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
          React.createElement('span', { className: 'text-xs text-slate-400' }, 'Human Presence'),
          React.createElement('span', { className: `text-lg font-bold ${humanPresenceScore >= 70 ? 'text-emerald-400' : humanPresenceScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, humanPresenceScore)
        ),
        React.createElement('div', { className: 'h-1.5 bg-slate-700 rounded-full overflow-hidden' },
          React.createElement('div', { className: `h-full rounded-full ${humanPresenceScore >= 70 ? 'bg-emerald-400' : humanPresenceScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`, style: { width: `${humanPresenceScore}%` } })
        )
      )
    ),

    // Credibility gaps
    credibilityGaps.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Credibility Gaps'),
      React.createElement('ul', { className: 'space-y-1' },
        credibilityGaps.slice(0, 3).map((gap, idx) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, gap)
          )
        )
      )
    )
  );
}

/**
 * Create Identity Section for V1 Brand Lab reports
 */
function createIdentitySection(identity: any): React.ReactNode {
  const items: string[] = [];

  if (identity.tagline) {
    items.push(`Tagline: "${identity.tagline}"`);
  }
  if (identity.corePromise) {
    items.push(`Core Promise: "${identity.corePromise}"`);
  }
  if (identity.toneOfVoice) {
    items.push(`Tone: ${identity.toneOfVoice}`);
  }
  if (identity.personalityTraits && Array.isArray(identity.personalityTraits)) {
    items.push(`Personality: ${identity.personalityTraits.join(', ')}`);
  }

  if (items.length === 0) return null;

  return React.createElement('div', { className: 'space-y-2' },
    items.map((item, i) =>
      React.createElement('p', { key: i, className: 'text-sm text-slate-300' }, item)
    )
  );
}

/**
 * Create Trust Section for V1 Brand Lab reports (legacy)
 */
function createTrustSection(trust: any): React.ReactNode {
  const items: string[] = [];

  if (trust.trustArchetype) {
    items.push(`Trust Archetype: ${trust.trustArchetype}`);
  }
  if (typeof trust.trustSignalsScore === 'number') {
    items.push(`Trust Signals: ${trust.trustSignalsScore}/100`);
  }
  if (typeof trust.humanPresenceScore === 'number') {
    items.push(`Human Presence: ${trust.humanPresenceScore}/100`);
  }
  if (trust.credibilityGaps && Array.isArray(trust.credibilityGaps) && trust.credibilityGaps.length > 0) {
    items.push(`Gaps: ${trust.credibilityGaps.join('; ')}`);
  }

  if (items.length === 0) return null;

  return React.createElement('div', { className: 'space-y-2' },
    items.map((item, i) =>
      React.createElement('p', { key: i, className: 'text-sm text-slate-300' }, item)
    )
  );
}

/**
 * Create enhanced Identity Section for Brand Lab V2
 */
function createIdentitySectionEnhanced(identity: any): React.ReactNode {
  const tagline = identity.tagline;
  const corePromise = identity.corePromise;
  const toneOfVoice = identity.toneOfVoice;
  const personalityTraits = identity.personalityTraits || [];
  const taglineClarity = identity.taglineClarityScore;
  const promiseClarity = identity.corePromiseClarityScore;
  const toneConsistency = identity.toneConsistencyScore;
  const identityGaps = identity.identityGaps || [];

  if (!tagline && !corePromise && !toneOfVoice) {
    return React.createElement('p', { className: 'text-sm text-slate-500 italic' }, 'No identity data available');
  }

  return React.createElement('div', { className: 'space-y-4' },
    // Tagline with clarity score
    tagline && React.createElement('div', { className: 'rounded-lg bg-blue-500/10 border border-blue-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-1' },
        React.createElement('span', { className: 'text-xs text-blue-400 uppercase tracking-wider' }, 'Tagline'),
        taglineClarity != null && React.createElement('span', { className: `text-xs font-semibold ${taglineClarity >= 70 ? 'text-emerald-400' : taglineClarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${taglineClarity}/100 clarity`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, `"${tagline}"`)
    ),

    // Core Promise with clarity score
    corePromise && React.createElement('div', { className: 'rounded-lg bg-purple-500/10 border border-purple-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-1' },
        React.createElement('span', { className: 'text-xs text-purple-400 uppercase tracking-wider' }, 'Core Promise'),
        promiseClarity != null && React.createElement('span', { className: `text-xs font-semibold ${promiseClarity >= 70 ? 'text-emerald-400' : promiseClarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${promiseClarity}/100 clarity`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200' }, corePromise)
    ),

    // Tone and personality
    (toneOfVoice || personalityTraits.length > 0) && React.createElement('div', { className: 'flex flex-wrap gap-4' },
      toneOfVoice && React.createElement('div', null,
        React.createElement('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Tone of Voice'),
        React.createElement('span', { className: 'text-sm text-slate-200' }, toneOfVoice),
        toneConsistency != null && React.createElement('span', { className: `ml-2 text-xs ${toneConsistency >= 70 ? 'text-emerald-400' : toneConsistency >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `(${toneConsistency}/100)`)
      ),
      personalityTraits.length > 0 && React.createElement('div', null,
        React.createElement('span', { className: 'text-xs text-slate-500 block mb-1' }, 'Personality Traits'),
        React.createElement('div', { className: 'flex flex-wrap gap-1' },
          personalityTraits.map((trait: string, idx: number) =>
            React.createElement('span', { key: idx, className: 'text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300' }, trait)
          )
        )
      )
    ),

    // Identity gaps
    identityGaps.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Identity Gaps'),
      React.createElement('ul', { className: 'space-y-1' },
        identityGaps.slice(0, 3).map((gap: string, idx: number) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, gap)
          )
        )
      )
    )
  );
}

/**
 * Create enhanced Trust Section for Brand Lab V2
 */
function createTrustSectionEnhanced(trust: any): React.ReactNode {
  const trustArchetype = trust.trustArchetype;
  const trustSignals = trust.trustSignalsScore;
  const humanPresence = trust.humanPresenceScore;
  const credibilityGaps = trust.credibilityGaps || [];

  if (!trustArchetype && trustSignals == null && humanPresence == null) {
    return React.createElement('p', { className: 'text-sm text-slate-500 italic' }, 'No trust data available');
  }

  return React.createElement('div', { className: 'space-y-4' },
    // Trust archetype badge
    trustArchetype && React.createElement('div', { className: 'flex items-center gap-2' },
      React.createElement('span', { className: 'text-xs text-slate-500' }, 'Trust Archetype:'),
      React.createElement('span', { className: 'text-sm font-medium text-cyan-400 px-2 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/30' }, trustArchetype)
    ),

    // Score meters
    (trustSignals != null || humanPresence != null) && React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
      trustSignals != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
          React.createElement('span', { className: 'text-xs text-slate-400' }, 'Trust Signals'),
          React.createElement('span', { className: `text-lg font-bold ${trustSignals >= 70 ? 'text-emerald-400' : trustSignals >= 50 ? 'text-amber-400' : 'text-red-400'}` }, trustSignals)
        ),
        React.createElement('div', { className: 'h-1.5 bg-slate-700 rounded-full overflow-hidden' },
          React.createElement('div', { className: `h-full rounded-full ${trustSignals >= 70 ? 'bg-emerald-400' : trustSignals >= 50 ? 'bg-amber-400' : 'bg-red-400'}`, style: { width: `${trustSignals}%` } })
        )
      ),
      humanPresence != null && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
          React.createElement('span', { className: 'text-xs text-slate-400' }, 'Human Presence'),
          React.createElement('span', { className: `text-lg font-bold ${humanPresence >= 70 ? 'text-emerald-400' : humanPresence >= 50 ? 'text-amber-400' : 'text-red-400'}` }, humanPresence)
        ),
        React.createElement('div', { className: 'h-1.5 bg-slate-700 rounded-full overflow-hidden' },
          React.createElement('div', { className: `h-full rounded-full ${humanPresence >= 70 ? 'bg-emerald-400' : humanPresence >= 50 ? 'bg-amber-400' : 'bg-red-400'}`, style: { width: `${humanPresence}%` } })
        )
      )
    ),

    // Credibility gaps
    credibilityGaps.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Credibility Gaps'),
      React.createElement('ul', { className: 'space-y-1' },
        credibilityGaps.slice(0, 3).map((gap: string, idx: number) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, gap)
          )
        )
      )
    )
  );
}

/**
 * Create Brand Maturity Section for V2 reports
 */
function createBrandMaturitySection(content: any): React.ReactNode {
  const maturityLabels: Record<string, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };

  const maturityColors: Record<string, string> = {
    unproven: 'bg-red-400/10 text-red-400 border-red-400/30',
    emerging: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    scaling: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    established: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const confidenceColors: Record<string, string> = {
    low: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    medium: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    high: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const maturityStage = content.maturityStage || 'unproven';
  const dataConfidence = content.dataConfidence || { score: 0, level: 'low', reason: 'No data available' };

  // Extract brand pillars from findings
  const brandPillars = content.findings?.brandPillars || [];

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

    // Narrative summary
    content.narrativeSummary && React.createElement('p', { className: 'text-sm text-slate-300 leading-relaxed' }, content.narrativeSummary),

    // Brand Pillars (if available)
    brandPillars.length > 0 && React.createElement('div', { className: 'mt-4 pt-4 border-t border-slate-700/50' },
      React.createElement('h4', { className: 'text-xs uppercase tracking-wider text-slate-500 mb-3' }, 'Brand Pillars'),
      React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
        brandPillars.map((pillar: any, idx: number) =>
          React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
            React.createElement('div', { className: 'flex items-center justify-between mb-1' },
              React.createElement('span', { className: 'text-sm font-medium text-slate-200' }, pillar.name),
              React.createElement('span', { className: `text-xs font-semibold ${pillar.strengthScore >= 70 ? 'text-emerald-400' : pillar.strengthScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${pillar.strengthScore}/100`)
            ),
            React.createElement('p', { className: 'text-xs text-slate-400' }, pillar.description),
            React.createElement('div', { className: 'flex gap-2 mt-1' },
              pillar.isExplicit && React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400' }, 'Explicit'),
              pillar.isPerceived && React.createElement('span', { className: 'text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400' }, 'Perceived')
            )
          )
        )
      )
    ),

    // Data confidence reason (if low)
    dataConfidence.level === 'low' && React.createElement('p', { className: 'text-xs text-amber-400/80 italic mt-2' }, dataConfidence.reason)
  );
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

  // V2: dimensions is an array with { key, label, score, status, summary }
  if (content.dimensions && Array.isArray(content.dimensions)) {
    content.dimensions.forEach((dim: any) => {
      // Skip not_evaluated dimensions or null scores
      if (dim?.score != null && dim.status !== 'not_evaluated') {
        scores.push({
          label: dim.label || formatLabel(dim.key || 'unknown'),
          value: dim.score,
          maxValue: 100,
          group: 'Content Dimensions',
        });
      } else if (dim.status === 'not_evaluated') {
        // Add with special metadata for not_evaluated
        scores.push({
          label: dim.label || formatLabel(dim.key || 'unknown'),
          value: 0,
          maxValue: 100,
          group: 'Content Dimensions',
          metadata: { notEvaluated: true, reason: dim.summary },
        });
      }
    });
  } else if (content.dimensions && typeof content.dimensions === 'object') {
    // Legacy object format fallback
    Object.entries(content.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: dim.label || formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Content Dimensions',
        });
      }
    });
  }

  // V2: Extract issues as key findings
  if (content.issues && Array.isArray(content.issues)) {
    content.issues.slice(0, 5).forEach((issue: any) => {
      if (issue?.title) {
        const severity = issue.severity === 'high' ? '⚠️' : issue.severity === 'medium' ? '⚡' : '';
        keyFindings.push(`${severity} ${issue.title}`);
      }
    });
  }

  // V2: Extract quick wins as opportunities
  if (content.quickWins && Array.isArray(content.quickWins)) {
    content.quickWins.slice(0, 5).forEach((win: any) => {
      if (win?.action) {
        opportunities.push(win.action);
      }
    });
  }

  // V2: Extract projects as additional opportunities
  if (content.projects && Array.isArray(content.projects)) {
    content.projects.slice(0, 3).forEach((proj: any) => {
      if (proj?.title) {
        opportunities.push(`Project: ${proj.title}`);
      }
    });
  }

  // Legacy: Extract findings
  if (content.findings && typeof content.findings === 'object' && !Array.isArray(content.findings)) {
    // V2 findings object with topics, contentUrls, articleTitles
    if (content.findings.topics && Array.isArray(content.findings.topics) && content.findings.topics.length > 0) {
      sections.push({
        id: 'topics',
        title: 'Identified Topics',
        icon: 'Hash',
        body: createTopicCoverageSection(content.findings.topics),
      });
    }
  } else if (content.findings && Array.isArray(content.findings)) {
    content.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // Legacy: Extract content gaps as findings
  if (content.gaps && Array.isArray(content.gaps)) {
    content.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.gap || g?.description;
      if (text) keyFindings.push(`Content Gap: ${text}`);
    });
  }

  // V2: Add maturity stage section
  if (content.maturityStage) {
    sections.push({
      id: 'maturity',
      title: 'Content Maturity',
      icon: 'Target',
      body: createContentMaturitySection(content),
    });
  }

  // Legacy: Add content inventory section
  if (content.inventory) {
    sections.push({
      id: 'inventory',
      title: 'Content Inventory',
      icon: 'FolderOpen',
      body: createContentInventorySection(content.inventory),
    });
  }

  // Legacy: Add topic coverage section
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

/**
 * Create Content Lab maturity section
 */
function createContentMaturitySection(content: any): React.ReactNode {
  const maturityLabels: Record<string, string> = {
    unproven: 'Unproven',
    emerging: 'Emerging',
    scaling: 'Scaling',
    established: 'Established',
  };

  const maturityColors: Record<string, string> = {
    unproven: 'bg-red-400/10 text-red-400 border-red-400/30',
    emerging: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    scaling: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    established: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const confidenceColors: Record<string, string> = {
    low: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
    medium: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    high: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  };

  const maturityStage = content.maturityStage || 'unproven';
  const dataConfidence = content.dataConfidence || { score: 0, level: 'low', reason: 'No data available' };

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
      ),
      content.companyType && React.createElement('div', { className: 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-700/50' },
        React.createElement('span', { className: 'text-xs uppercase tracking-wider text-slate-500' }, 'Type'),
        React.createElement('span', { className: 'text-sm font-medium text-slate-300' }, formatCompanyType(content.companyType))
      )
    ),

    // Narrative summary
    content.narrativeSummary && React.createElement('p', { className: 'text-sm text-slate-300 leading-relaxed' }, content.narrativeSummary),

    // Data confidence reason (if low)
    dataConfidence.level === 'low' && React.createElement('p', { className: 'text-xs text-amber-400/80 italic' }, dataConfidence.reason)
  );
}

/**
 * Format company type for display
 */
function formatCompanyType(type: string): string {
  const labels: Record<string, string> = {
    b2b_services: 'B2B Services',
    local_service: 'Local Service',
    ecommerce: 'E-commerce',
    saas: 'SaaS',
    other: 'Other',
    unknown: 'Unknown',
  };
  return labels[type] || type;
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
  // V2 dimensions is an array with label/key/score properties
  if (demand.dimensions && Array.isArray(demand.dimensions)) {
    demand.dimensions.forEach((dim: any) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: dim.label || formatLabel(dim.key || 'unknown'),
          value: dim.score,
          maxValue: 100,
          group: 'Demand Dimensions',
        });
      }
    });
  } else if (demand.dimensions && typeof demand.dimensions === 'object') {
    // Legacy object format fallback
    Object.entries(demand.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: dim.label || formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Demand Dimensions',
        });
      }
    });
  }

  // V2: Extract issues as key findings
  if (demand.issues && Array.isArray(demand.issues)) {
    demand.issues.slice(0, 5).forEach((issue: any) => {
      if (issue?.title) {
        const severity = issue.severity ? `${issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}:` : '';
        keyFindings.push(`${severity} ${issue.title}`);
      }
    });
  }

  // V2: Extract quick wins as opportunities
  if (demand.quickWins && Array.isArray(demand.quickWins)) {
    demand.quickWins.slice(0, 5).forEach((win: any) => {
      if (win?.action) {
        opportunities.push(win.action);
      }
    });
  }

  // V2: Extract projects as additional opportunities
  if (demand.projects && Array.isArray(demand.projects)) {
    demand.projects.slice(0, 3).forEach((proj: any) => {
      if (proj?.title) {
        opportunities.push(`Project: ${proj.title}`);
      }
    });
  }

  // V2: Add detailed findings section
  if (demand.findings && typeof demand.findings === 'object' && !Array.isArray(demand.findings)) {
    const findingsBody = createDemandFindingsSection(demand.findings);
    if (findingsBody) {
      sections.push({
        id: 'findings',
        title: 'Analysis Findings',
        icon: 'Search',
        body: findingsBody,
      });
    }
  } else if (demand.findings && Array.isArray(demand.findings)) {
    // Legacy V1 format
    demand.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // V2: Add analytics snapshot section
  if (demand.analyticsSnapshot) {
    const snapshotBody = createDemandAnalyticsSection(demand.analyticsSnapshot);
    if (snapshotBody) {
      sections.push({
        id: 'analytics',
        title: 'Analytics Snapshot',
        icon: 'BarChart',
        body: snapshotBody,
      });
    }
  }

  // Legacy: Extract gaps
  if (demand.gaps && Array.isArray(demand.gaps)) {
    demand.gaps.slice(0, 3).forEach((g: any) => {
      const text = typeof g === 'string' ? g : g?.gap || g?.description;
      if (text) keyFindings.push(`Gap: ${text}`);
    });
  }

  // Legacy: Add lead capture section
  if (demand.leadCapture) {
    sections.push({
      id: 'leads',
      title: 'Lead Capture Analysis',
      icon: 'UserPlus',
      body: createLeadCaptureSection(demand.leadCapture),
    });
  }

  // Legacy: Add conversion paths section
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
// Demand Lab V2 Section Helpers
// ============================================================================

function createDemandFindingsSection(findings: any): React.ReactElement | null {
  const items: React.ReactElement[] = [];

  // Pages analyzed
  if (findings.pagesAnalyzed && Array.isArray(findings.pagesAnalyzed) && findings.pagesAnalyzed.length > 0) {
    items.push(
      React.createElement('div', { key: 'pages', className: 'mb-3' },
        React.createElement('p', { className: 'text-xs font-medium text-slate-400 mb-1' },
          `${findings.pagesAnalyzed.length} Pages Analyzed`
        ),
        React.createElement('div', { className: 'flex flex-wrap gap-1' },
          findings.pagesAnalyzed.slice(0, 5).map((page: any, i: number) =>
            React.createElement('span', {
              key: i,
              className: 'text-[10px] bg-slate-800 rounded px-1.5 py-0.5 text-slate-300'
            }, page.type || 'page')
          )
        )
      )
    );
  }

  // CTAs found
  if (findings.ctasFound && Array.isArray(findings.ctasFound) && findings.ctasFound.length > 0) {
    items.push(
      React.createElement('div', { key: 'ctas', className: 'mb-3' },
        React.createElement('p', { className: 'text-xs font-medium text-slate-400 mb-1' },
          `${findings.ctasFound.length} CTAs Found`
        ),
        React.createElement('div', { className: 'space-y-1' },
          findings.ctasFound.slice(0, 3).map((cta: any, i: number) =>
            React.createElement('p', {
              key: i,
              className: `text-xs ${cta.isPrimary ? 'text-emerald-400' : 'text-slate-400'}`
            }, `${cta.isPrimary ? '★ ' : ''}${cta.text} (${cta.type})`)
          )
        )
      )
    );
  }

  // Tracking detected
  if (findings.trackingDetected && Array.isArray(findings.trackingDetected)) {
    const detected = findings.trackingDetected.filter((t: any) => t.detected);
    if (detected.length > 0) {
      items.push(
        React.createElement('div', { key: 'tracking', className: 'mb-3' },
          React.createElement('p', { className: 'text-xs font-medium text-slate-400 mb-1' }, 'Tracking Detected'),
          React.createElement('div', { className: 'flex flex-wrap gap-1' },
            detected.map((t: any, i: number) =>
              React.createElement('span', {
                key: i,
                className: 'text-[10px] bg-emerald-900/30 text-emerald-300 rounded px-1.5 py-0.5'
              }, t.name)
            )
          )
        )
      );
    }
  }

  if (items.length === 0) return null;

  return React.createElement('div', { className: 'space-y-2' }, ...items);
}

function createDemandAnalyticsSection(snapshot: any): React.ReactElement | null {
  const items: React.ReactElement[] = [];

  // Session volume
  const sessions = snapshot.sessionVolume ?? snapshot.totalSessions;
  if (sessions != null) {
    items.push(
      React.createElement('div', { key: 'sessions', className: 'flex justify-between text-xs' },
        React.createElement('span', { className: 'text-slate-500' }, 'Sessions (30d)'),
        React.createElement('span', { className: 'text-slate-300 tabular-nums' }, sessions.toLocaleString())
      )
    );
  }

  // Conversion rate
  if (snapshot.conversionRate != null) {
    const cr = snapshot.conversionRate > 1 ? snapshot.conversionRate : snapshot.conversionRate * 100;
    items.push(
      React.createElement('div', { key: 'cr', className: 'flex justify-between text-xs' },
        React.createElement('span', { className: 'text-slate-500' }, 'Conversion Rate'),
        React.createElement('span', { className: 'text-slate-300 tabular-nums' }, `${cr.toFixed(2)}%`)
      )
    );
  }

  // Paid share
  const paidShare = snapshot.paidShare ?? snapshot.paidTrafficShare;
  if (paidShare != null) {
    items.push(
      React.createElement('div', { key: 'paid', className: 'flex justify-between text-xs' },
        React.createElement('span', { className: 'text-slate-500' }, 'Paid Traffic'),
        React.createElement('span', { className: 'text-slate-300 tabular-nums' }, `${(paidShare * 100).toFixed(1)}%`)
      )
    );
  }

  // Top channels
  if (snapshot.topChannels && Array.isArray(snapshot.topChannels) && snapshot.topChannels.length > 0) {
    items.push(
      React.createElement('div', { key: 'channels', className: 'mt-2' },
        React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Top Channels'),
        React.createElement('p', { className: 'text-xs text-slate-300' }, snapshot.topChannels.slice(0, 4).join(', '))
      )
    );
  }

  if (items.length === 0) return null;

  return React.createElement('div', { className: 'space-y-2' }, ...items);
}

// ============================================================================
// Ops Lab Adapter (V1)
// ============================================================================

function extractOpsLabData(rawJson: any): ToolReportData {
  // Support both new V1 format and legacy formats
  const ops = rawJson.report || rawJson.diagnostic || rawJson.opsAssessment || rawJson;
  const scores: ScoreItem[] = [];
  const keyFindings: string[] = [];
  const opportunities: string[] = [];
  const sections: ReportSection[] = [];

  // V1: Extract overall score
  if (ops.overallScore != null) {
    scores.push({
      label: 'Overall',
      value: ops.overallScore,
      maxValue: 100,
      group: 'Summary',
    });
  }

  // V1: Extract dimension scores (array format)
  if (ops.dimensions && Array.isArray(ops.dimensions)) {
    ops.dimensions.forEach((dim: any) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: dim.label || formatLabel(dim.key || 'unknown'),
          value: dim.score,
          maxValue: 100,
          group: 'Ops Dimensions',
        });
      }
    });
  } else if (ops.dimensions && typeof ops.dimensions === 'object') {
    // Legacy object format fallback
    Object.entries(ops.dimensions).forEach(([key, dim]: [string, any]) => {
      if (typeof dim?.score === 'number') {
        scores.push({
          label: dim.label || formatLabel(key),
          value: dim.score,
          maxValue: 100,
          group: 'Ops Dimensions',
        });
      }
    });
  }

  // V1: Extract issues as key findings
  if (ops.issues && Array.isArray(ops.issues)) {
    ops.issues.slice(0, 5).forEach((issue: any) => {
      if (issue?.title) {
        const severity = issue.severity ? `${issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}:` : '';
        keyFindings.push(`${severity} ${issue.title}`);
      }
    });
  }

  // V1: Extract quick wins as opportunities
  if (ops.quickWins && Array.isArray(ops.quickWins)) {
    ops.quickWins.slice(0, 5).forEach((win: any) => {
      if (win?.action) {
        opportunities.push(win.action);
      }
    });
  }

  // V1: Extract projects as additional opportunities
  if (ops.projects && Array.isArray(ops.projects)) {
    ops.projects.slice(0, 3).forEach((proj: any) => {
      if (proj?.title) {
        opportunities.push(`Project: ${proj.title}`);
      }
    });
  }

  // V1: Add findings section with tracking/CRM/automation signals
  if (ops.findings && typeof ops.findings === 'object' && !Array.isArray(ops.findings)) {
    const findingsBody = createOpsFindingsSection(ops.findings);
    if (findingsBody) {
      sections.push({
        id: 'findings',
        title: 'Analysis Findings',
        icon: 'Search',
        body: findingsBody,
      });
    }
  } else if (ops.findings && Array.isArray(ops.findings)) {
    // Legacy array format
    ops.findings.slice(0, 5).forEach((f: any) => {
      const text = typeof f === 'string' ? f : f?.finding || f?.description;
      if (text) keyFindings.push(text);
    });
  }

  // V1: Add analytics snapshot section (stack & signals)
  if (ops.analyticsSnapshot) {
    const snapshotBody = createOpsStackSection(ops.analyticsSnapshot);
    if (snapshotBody) {
      sections.push({
        id: 'stack',
        title: 'Stack & Signals',
        icon: 'Settings',
        body: snapshotBody,
      });
    }
  }

  // Legacy: Extract inefficiencies as findings
  if (ops.inefficiencies && Array.isArray(ops.inefficiencies)) {
    ops.inefficiencies.slice(0, 3).forEach((i: any) => {
      const text = typeof i === 'string' ? i : i?.issue || i?.description;
      if (text) keyFindings.push(`Inefficiency: ${text}`);
    });
  }

  // Legacy: Extract recommendations as opportunities
  if (ops.recommendations && Array.isArray(ops.recommendations)) {
    ops.recommendations.slice(0, 5).forEach((r: any) => {
      const text = typeof r === 'string' ? r : r?.title || r?.description;
      if (text) opportunities.push(text);
    });
  }

  // Legacy: Add tooling section
  if (ops.tooling) {
    sections.push({
      id: 'tooling',
      title: 'Marketing Tech Stack',
      icon: 'Layers',
      body: createToolingSection(ops.tooling),
    });
  }

  // Legacy: Add automation section
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
// Ops Lab V1 Section Helpers
// ============================================================================

function createOpsFindingsSection(findings: any): React.ReactElement | null {
  // Define all categories with their styling
  const categories = [
    {
      key: 'tracking',
      label: 'Tracking & Analytics',
      color: 'blue',
      tools: findings.trackingDetected?.tools || [],
      notes: findings.trackingDetected?.notes || [],
    },
    {
      key: 'crm',
      label: 'CRM & Pipeline',
      color: 'purple',
      tools: findings.crmSignals?.tools || [],
      notes: findings.crmSignals?.notes || [],
    },
    {
      key: 'automation',
      label: 'Automation & Journeys',
      color: 'amber',
      tools: findings.automationSignals?.tools || [],
      notes: findings.automationSignals?.notes || [],
    },
    {
      key: 'process',
      label: 'Data & Process',
      color: 'cyan',
      tools: [],
      notes: findings.processSignals?.notes || [],
    },
  ];

  const colorStyles: Record<string, { bg: string; text: string; border: string; badgeBg: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20', badgeBg: 'bg-blue-900/30' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20', badgeBg: 'bg-purple-900/30' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20', badgeBg: 'bg-amber-900/30' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-300', border: 'border-cyan-500/20', badgeBg: 'bg-cyan-900/30' },
  };

  // Filter to only show categories with content
  const activeCategories = categories.filter(cat => cat.tools.length > 0 || cat.notes.length > 0);

  if (activeCategories.length === 0) return null;

  return React.createElement('div', { className: 'space-y-3' },
    activeCategories.map((category) => {
      const styles = colorStyles[category.color];
      const categoryItems: React.ReactElement[] = [];

      // Category header
      categoryItems.push(
        React.createElement('p', {
          key: 'header',
          className: `text-xs font-medium ${styles.text} mb-2`
        }, category.label)
      );

      // Tools badges
      if (category.tools.length > 0) {
        categoryItems.push(
          React.createElement('div', { key: 'tools', className: 'mb-2' },
            React.createElement('p', { className: 'text-[10px] text-slate-500 uppercase tracking-wider mb-1' }, 'Detected'),
            React.createElement('div', { className: 'flex flex-wrap gap-1' },
              category.tools.map((tool: string, i: number) =>
                React.createElement('span', {
                  key: i,
                  className: `text-[10px] ${styles.badgeBg} ${styles.text} rounded px-1.5 py-0.5`
                }, tool)
              )
            )
          )
        );
      }

      // Notes
      if (category.notes.length > 0) {
        categoryItems.push(
          React.createElement('ul', { key: 'notes', className: 'space-y-1' },
            category.notes.slice(0, 3).map((note: string, i: number) =>
              React.createElement('li', {
                key: i,
                className: 'text-xs text-slate-300'
              }, `• ${note}`)
            )
          )
        );
      }

      return React.createElement('div', {
        key: category.key,
        className: `rounded-lg border ${styles.border} ${styles.bg} p-3`
      }, ...categoryItems);
    })
  );
}

function createOpsStackSection(snapshot: any): React.ReactElement | null {
  const items: React.ReactElement[] = [];

  // Define all core signals with descriptions
  const coreSignals = [
    { label: 'Google Analytics 4', key: 'hasGa4', active: snapshot.hasGa4, description: 'Web analytics & conversion tracking' },
    { label: 'Google Search Console', key: 'hasGsc', active: snapshot.hasGsc, description: 'Search performance & indexing' },
    { label: 'Google Tag Manager', key: 'hasGtm', active: snapshot.hasGtm, description: 'Tag deployment & governance' },
    { label: 'Facebook Pixel', key: 'hasFacebookPixel', active: snapshot.hasFacebookPixel, description: 'Meta retargeting & attribution' },
    { label: 'LinkedIn Insight', key: 'hasLinkedinInsight', active: snapshot.hasLinkedinInsight, description: 'B2B retargeting & attribution' },
    { label: 'CRM Integration', key: 'hasCrm', active: snapshot.hasCrm, description: 'Lead capture & pipeline tracking' },
    { label: 'Marketing Automation', key: 'hasAutomationPlatform', active: snapshot.hasAutomationPlatform, description: 'Email & journey automation' },
  ];

  const detectedCount = coreSignals.filter(s => s.active).length;
  const totalCount = coreSignals.length;

  // Summary header with detected count
  const countColor = detectedCount === 0 ? 'text-red-400' : detectedCount < 3 ? 'text-amber-400' : 'text-emerald-400';
  items.push(
    React.createElement('div', { key: 'header', className: 'flex items-center justify-between mb-3 pb-3 border-b border-slate-700/50' },
      React.createElement('div', null,
        React.createElement('p', { className: 'text-xs font-medium text-slate-300' }, 'Marketing Stack Coverage'),
        React.createElement('p', { className: 'text-[10px] text-slate-500 mt-0.5' }, 'Core infrastructure signals')
      ),
      React.createElement('div', { className: 'text-right' },
        React.createElement('p', { className: `text-lg font-bold tabular-nums ${countColor}` }, `${detectedCount}/${totalCount}`),
        React.createElement('p', { className: 'text-[9px] text-slate-500 uppercase tracking-wider' }, 'Detected')
      )
    )
  );

  // Active tools badges (if any)
  if (snapshot.trackingStack && Array.isArray(snapshot.trackingStack) && snapshot.trackingStack.length > 0) {
    items.push(
      React.createElement('div', { key: 'stack', className: 'mb-3' },
        React.createElement('p', { className: 'text-[10px] text-slate-500 uppercase tracking-wider mb-1.5' }, 'Active Tools'),
        React.createElement('div', { className: 'flex flex-wrap gap-1' },
          snapshot.trackingStack.map((tool: string, i: number) =>
            React.createElement('span', {
              key: i,
              className: 'text-[10px] bg-emerald-900/30 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5'
            }, tool)
          )
        )
      )
    );
  }

  // Signal grid with descriptions
  items.push(
    React.createElement('div', { key: 'signals', className: 'grid grid-cols-2 gap-2 mb-3' },
      coreSignals.map((sig, i) =>
        React.createElement('div', {
          key: i,
          className: `rounded-lg p-2 ${sig.active ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-slate-800/30 border border-slate-700/30'}`
        },
          React.createElement('div', { className: 'flex items-center gap-1.5 mb-0.5' },
            React.createElement('span', {
              className: `w-1.5 h-1.5 rounded-full flex-shrink-0 ${sig.active ? 'bg-emerald-400' : 'bg-slate-600'}`
            }),
            React.createElement('span', {
              className: `text-[10px] font-medium ${sig.active ? 'text-emerald-300' : 'text-slate-500'}`
            }, sig.label)
          ),
          React.createElement('p', {
            className: `text-[9px] ml-3 ${sig.active ? 'text-emerald-400/60' : 'text-slate-600'}`
          }, sig.description)
        )
      )
    )
  );

  // UTM usage section with more detail
  const utmStyles: Record<string, { label: string; color: string; bg: string; description: string }> = {
    none: { label: 'Not Detected', color: 'text-red-300', bg: 'bg-red-900/30', description: 'No UTM parameters found. Campaign attribution will be limited.' },
    basic: { label: 'Partial', color: 'text-amber-300', bg: 'bg-amber-900/30', description: 'Some UTM usage but inconsistent across campaigns.' },
    consistent: { label: 'Consistent', color: 'text-emerald-300', bg: 'bg-emerald-900/30', description: 'UTM parameters consistently used for attribution.' },
  };

  const utmLevel = snapshot.utmUsageLevel || 'none';
  const utmStyle = utmStyles[utmLevel] || utmStyles.none;

  items.push(
    React.createElement('div', { key: 'utm', className: 'pt-3 border-t border-slate-700/50' },
      React.createElement('div', { className: 'flex items-center justify-between mb-1' },
        React.createElement('span', { className: 'text-xs font-medium text-slate-300' }, 'UTM Parameter Usage'),
        React.createElement('span', {
          className: `text-[10px] font-medium rounded px-1.5 py-0.5 ${utmStyle.bg} ${utmStyle.color}`
        }, utmStyle.label)
      ),
      React.createElement('p', { className: 'text-[10px] text-slate-500' }, utmStyle.description)
    )
  );

  return React.createElement('div', { className: 'space-y-2' }, ...items);
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

function createPositioningSection(positioning: any, audienceFit?: any): React.ReactNode {
  // Support both V1 (positioningTheme, competitiveAngle) and V2 (statement, category) field names
  const theme = positioning.positioningTheme || positioning.statement;
  const angle = positioning.competitiveAngle || positioning.category;
  const clarity = positioning.positioningClarityScore;
  const risks = positioning.positioningRisks;
  const isClearTarget = positioning.isClearWhoThisIsFor;

  // Audience info
  const primaryICP = audienceFit?.primaryICPDescription;
  const icpSignals = audienceFit?.icpSignals || [];
  const alignmentScore = audienceFit?.alignmentScore;

  // Check if we have any content to display
  if (!theme && !angle && clarity == null && !primaryICP) {
    return React.createElement('p', { className: 'text-sm text-slate-500 italic' }, 'No positioning data available');
  }

  return React.createElement('div', { className: 'space-y-4' },
    // Two-column layout for theme and angle
    React.createElement('div', { className: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
      // Positioning theme/statement
      theme && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Positioning Theme'),
        React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, theme)
      ),
      // Competitive angle/category
      angle && React.createElement('div', { className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Competitive Angle'),
        React.createElement('p', { className: 'text-sm text-slate-200 font-medium' }, angle)
      )
    ),

    // Clarity score and target clarity indicator
    React.createElement('div', { className: 'flex flex-wrap items-center gap-4' },
      clarity != null && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'Clarity Score:'),
        React.createElement('span', { className: `text-sm font-semibold ${clarity >= 70 ? 'text-emerald-400' : clarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${clarity}/100`)
      ),
      isClearTarget != null && React.createElement('div', { className: `flex items-center gap-1.5 text-xs ${isClearTarget ? 'text-emerald-400' : 'text-amber-400'}` },
        React.createElement('span', null, isClearTarget ? '✓' : '⚠'),
        React.createElement('span', null, isClearTarget ? 'Clear target audience' : 'Target audience unclear')
      )
    ),

    // Target Audience section (from audienceFit)
    primaryICP && React.createElement('div', { className: 'rounded-lg bg-purple-500/10 border border-purple-500/30 p-3' },
      React.createElement('div', { className: 'flex items-center justify-between mb-2' },
        React.createElement('span', { className: 'text-xs text-purple-400 uppercase tracking-wider' }, 'Target Audience'),
        alignmentScore != null && React.createElement('span', { className: `text-xs font-semibold ${alignmentScore >= 70 ? 'text-emerald-400' : alignmentScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${alignmentScore}/100 alignment`)
      ),
      React.createElement('p', { className: 'text-sm text-slate-200' }, primaryICP),
      icpSignals.length > 0 && React.createElement('div', { className: 'flex flex-wrap gap-1 mt-2' },
        icpSignals.slice(0, 4).map((signal: string, idx: number) =>
          React.createElement('span', { key: idx, className: 'text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300' }, signal)
        )
      )
    ),

    // Positioning risks
    risks && Array.isArray(risks) && risks.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Risks:'),
      React.createElement('ul', { className: 'space-y-1' },
        risks.slice(0, 3).map((risk: string, idx: number) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, risk)
          )
        )
      )
    )
  );
}

function createMessagingSection(messaging: any): React.ReactNode {
  // Support V1 Brand Lab fields: headlinePatterns, valueProps, differentiators, messagingFocusScore
  const headlines = messaging.headlinePatterns || [];
  const valueProps = messaging.valueProps || [];
  const differentiators = messaging.differentiators || [];
  const focusScore = messaging.messagingFocusScore ?? messaging.clarity;
  const icpClarity = messaging.icpClarityScore;
  const benefitRatio = messaging.benefitVsFeatureRatio;
  const clarityIssues = messaging.clarityIssues || [];

  // Check if we have any content to display
  if (!headlines.length && !valueProps.length && !differentiators.length && focusScore == null) {
    return React.createElement('p', { className: 'text-sm text-slate-500 italic' }, 'No messaging data available');
  }

  return React.createElement('div', { className: 'space-y-4' },
    // Scores row
    (focusScore != null || icpClarity != null || benefitRatio != null) && React.createElement('div', { className: 'flex flex-wrap gap-4' },
      focusScore != null && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'Messaging Focus:'),
        React.createElement('span', { className: `text-sm font-semibold ${focusScore >= 70 ? 'text-emerald-400' : focusScore >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${focusScore}/100`)
      ),
      icpClarity != null && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'ICP Clarity:'),
        React.createElement('span', { className: `text-sm font-semibold ${icpClarity >= 70 ? 'text-emerald-400' : icpClarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${icpClarity}/100`)
      ),
      benefitRatio != null && React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xs text-slate-500' }, 'Benefit vs Feature:'),
        React.createElement('span', { className: `text-sm font-semibold ${benefitRatio >= 70 ? 'text-emerald-400' : benefitRatio >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `${benefitRatio}/100`)
      )
    ),

    // Value Propositions (if available and have good content)
    valueProps.length > 0 && React.createElement('div', { className: 'rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3' },
      React.createElement('p', { className: 'text-xs text-emerald-400 uppercase tracking-wider mb-2' }, 'Value Propositions'),
      React.createElement('div', { className: 'space-y-2' },
        valueProps.slice(0, 3).map((vp: any, idx: number) => {
          const statement = typeof vp === 'string' ? vp : vp.statement;
          const clarity = typeof vp === 'object' ? vp.clarityScore : null;
          const uniqueness = typeof vp === 'object' ? vp.uniquenessScore : null;
          return React.createElement('div', { key: idx, className: 'text-sm text-slate-200' },
            React.createElement('p', null, statement),
            (clarity != null || uniqueness != null) && React.createElement('div', { className: 'flex gap-3 mt-1 text-xs' },
              clarity != null && React.createElement('span', { className: `${clarity >= 70 ? 'text-emerald-400' : clarity >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `Clarity: ${clarity}`),
              uniqueness != null && React.createElement('span', { className: `${uniqueness >= 70 ? 'text-emerald-400' : uniqueness >= 50 ? 'text-amber-400' : 'text-red-400'}` }, `Uniqueness: ${uniqueness}`)
            )
          );
        })
      )
    ),

    // Sample headlines
    headlines.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Sample Headlines'),
      React.createElement('ul', { className: 'space-y-1' },
        headlines.slice(0, 3).map((h: string, idx: number) =>
          React.createElement('li', { key: idx, className: 'text-sm text-slate-300 italic' }, `"${h}"`)
        )
      )
    ),

    // Differentiators
    differentiators.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Differentiators'),
      React.createElement('div', { className: 'flex flex-wrap gap-1' },
        differentiators.slice(0, 5).map((d: string, idx: number) =>
          React.createElement('span', { key: idx, className: 'text-xs px-2 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/30' }, d)
        )
      )
    ),

    // Clarity issues
    clarityIssues.length > 0 && React.createElement('div', null,
      React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Clarity Issues'),
      React.createElement('ul', { className: 'space-y-1' },
        clarityIssues.slice(0, 3).map((issue: string, idx: number) =>
          React.createElement('li', { key: idx, className: 'text-xs text-amber-400/80 flex items-start gap-1' },
            React.createElement('span', null, '•'),
            React.createElement('span', null, issue)
          )
        )
      )
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

/**
 * Create a roadmap phases section from V3 API mapped format
 * V3 API mapped: roadmapPhases: { phase0_30: { actions: [], rationale }, ... }
 */
function createRoadmapPhasesSection(roadmapPhases: any): React.ReactNode {
  const phases = [
    { key: 'phase0_30', label: 'Days 1-30' },
    { key: 'phase30_60', label: 'Days 31-60' },
    { key: 'phase60_90', label: 'Days 61-90' },
  ];

  return React.createElement('div', { className: 'space-y-4' },
    phases.map(({ key, label }) => {
      const phase = roadmapPhases[key];
      if (!phase) return null;

      const actions = phase.actions || [];
      const rationale = phase.rationale;

      return React.createElement('div', { key, className: 'rounded-lg bg-slate-800/50 p-4' },
        React.createElement('div', { className: 'flex items-center gap-2 mb-2' },
          React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30' }, label)
        ),
        rationale && React.createElement('p', { className: 'text-sm text-slate-400 mb-3 italic' }, rationale),
        actions.length > 0 && React.createElement('ul', { className: 'space-y-2' },
          actions.slice(0, 5).map((action: string, idx: number) =>
            React.createElement('li', { key: idx, className: 'text-sm text-slate-300 flex items-start gap-2' },
              React.createElement('span', { className: 'text-amber-400 mt-0.5' }, '→'),
              React.createElement('span', null, action)
            )
          )
        )
      );
    })
  );
}

/**
 * Create a strategic priorities summary section from V3 API mapped format
 * V3 API mapped: strategicPrioritiesSummary: [{ title, description }]
 */
function createStrategicPrioritiesSummarySection(priorities: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-3' },
    priorities.slice(0, 5).map((priority, idx) => {
      const title = priority?.title || priority?.name;
      const description = priority?.description;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-4' },
        React.createElement('h4', { className: 'text-sm font-semibold text-slate-200' }, title),
        description && React.createElement('p', { className: 'text-sm text-slate-400 mt-2' }, description)
      );
    })
  );
}

/**
 * Create a KPIs summary section from V3 API mapped format
 * V3 API mapped: kpisSummary: [{ name, description }]
 */
function createKpisSummarySection(kpis: any[]): React.ReactNode {
  return React.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' },
    kpis.slice(0, 6).map((kpi, idx) => {
      const name = kpi?.name;
      const description = kpi?.description;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('h4', { className: 'text-sm font-medium text-slate-200 mb-2' }, name),
        description && React.createElement('p', { className: 'text-xs text-slate-400' }, description)
      );
    })
  );
}

/**
 * Create a roadmap section from DMA V4 format
 * DMA V4: roadmap: [{ name, weeks, focus, actions: string[], kpis: string[] }]
 */
function createDmaRoadmapSection(roadmap: any[]): React.ReactNode {
  return React.createElement('div', { className: 'space-y-4' },
    roadmap.slice(0, 3).map((phase, idx) => {
      const name = phase?.name || `Phase ${idx + 1}`;
      const weeks = phase?.weeks;
      const focus = phase?.focus;
      const actions = phase?.actions || [];
      const phaseKpis = phase?.kpis || [];

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-4' },
        // Phase header with name and weeks
        React.createElement('div', { className: 'flex items-center justify-between mb-2' },
          React.createElement('h4', { className: 'text-sm font-semibold text-slate-200' }, name),
          weeks && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-blue-400/10 text-blue-400' }, weeks)
        ),
        // Focus area
        focus && React.createElement('p', { className: 'text-sm text-slate-300 mb-3' }, focus),
        // Actions list
        actions.length > 0 && React.createElement('div', { className: 'mb-3' },
          React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'Actions'),
          React.createElement('ul', { className: 'space-y-1' },
            actions.slice(0, 4).map((action: string, i: number) =>
              React.createElement('li', { key: i, className: 'text-xs text-slate-400 flex items-start gap-2' },
                React.createElement('span', { className: 'text-emerald-400' }, '→'),
                React.createElement('span', null, action)
              )
            )
          )
        ),
        // KPIs list
        phaseKpis.length > 0 && React.createElement('div', null,
          React.createElement('p', { className: 'text-xs text-slate-500 mb-1' }, 'KPIs'),
          React.createElement('ul', { className: 'flex flex-wrap gap-2' },
            phaseKpis.slice(0, 3).map((kpi: string, i: number) =>
              React.createElement('li', { key: i, className: 'text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300' }, kpi)
            )
          )
        )
      );
    })
  );
}

/**
 * Create a strategic initiatives section from DMA V4 format
 * DMA V4: strategicInitiatives: [{ title, description, priority, expectedOutcome }]
 */
function createDmaStrategicInitiativesSection(initiatives: any[]): React.ReactNode {
  const priorityColors: Record<string, string> = {
    high: 'text-red-400 bg-red-400/10',
    medium: 'text-amber-400 bg-amber-400/10',
    low: 'text-slate-400 bg-slate-400/10',
  };

  return React.createElement('div', { className: 'space-y-3' },
    initiatives.slice(0, 5).map((init, idx) => {
      const title = init?.title || `Initiative ${idx + 1}`;
      const description = init?.description;
      const priority = init?.priority?.toLowerCase();
      const outcome = init?.expectedOutcome;
      const colorClass = priorityColors[priority] || 'text-slate-400 bg-slate-400/10';

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-4' },
        React.createElement('div', { className: 'flex items-start justify-between gap-2 mb-2' },
          React.createElement('h4', { className: 'text-sm font-semibold text-slate-200' }, title),
          priority && React.createElement('span', { className: `text-xs px-2 py-0.5 rounded capitalize ${colorClass}` }, priority)
        ),
        description && React.createElement('p', { className: 'text-sm text-slate-400 mb-2' }, description),
        outcome && React.createElement('p', { className: 'text-xs text-slate-500' },
          React.createElement('span', { className: 'text-slate-400' }, 'Expected: '),
          outcome
        )
      );
    })
  );
}

/**
 * Create a quick wins section
 * Both formats: quickWins: [{ action, impact, effort, timeline } | string]
 */
function createQuickWinsSection(quickWins: any[]): React.ReactNode {
  return React.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' },
    quickWins.slice(0, 6).map((qw, idx) => {
      const isString = typeof qw === 'string';
      const action = isString ? qw : qw?.action || qw?.title || qw?.description;
      const impact = !isString && qw?.impact;
      const effort = !isString && qw?.effort;
      const timeline = !isString && qw?.timeline;

      return React.createElement('div', { key: idx, className: 'rounded-lg bg-slate-800/50 p-3' },
        React.createElement('p', { className: 'text-sm text-slate-200 mb-2' }, action),
        !isString && (impact || effort || timeline) && React.createElement('div', { className: 'flex flex-wrap gap-2' },
          impact && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400' }, `Impact: ${impact}`),
          effort && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-blue-400/10 text-blue-400' }, `Effort: ${effort}`),
          timeline && React.createElement('span', { className: 'text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300' }, timeline)
        )
      );
    })
  );
}
