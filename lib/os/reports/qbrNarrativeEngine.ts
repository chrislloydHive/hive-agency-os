// lib/os/reports/qbrNarrativeEngine.ts
// QBR Narrative Generation Engine
//
// This module generates QBR narrative content from the unified QBR data.
// It produces structured narrative sections that can be displayed in the UI
// or exported as reports.

import Anthropic from '@anthropic-ai/sdk';
import type {
  QBRData,
  QBRWorkSummary,
  DiagnosticsSnapshot,
  ContextGraphHealth,
  PlanSynthesisData,
} from './qbrData';
import { calculateOverallHealthScore } from './qbrData';
import type { FindingsSummary } from '@/lib/os/findings/companyFindings';
import type { DiagnosticDetailFinding } from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Types
// ============================================================================

/**
 * A single narrative section in the QBR
 */
export interface QBRNarrativeSection {
  id: string;
  title: string;
  subtitle?: string;
  type: 'summary' | 'insights' | 'work' | 'diagnostics' | 'context' | 'recommendations' | 'callout' | 'wins' | 'challenges' | 'focus';
  content: string;
  bullets?: string[];
  tone?: 'neutral' | 'positive' | 'warning' | 'critical';
  order: number;
}

/**
 * Cross-link badge for referencing related items
 */
export interface CrossLinkBadge {
  type: 'finding' | 'work' | 'diagnostic';
  id: string;
  label: string;
  href: string;
}

/**
 * Structured item with cross-links
 */
export interface NarrativeItem {
  title: string;
  description?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  area?: string;
  crossLinks?: CrossLinkBadge[];
}

/**
 * Theme deep dive section
 */
export interface ThemeDeepDive {
  theme: string;
  summary: string;
  findings: NarrativeItem[];
  workItems: NarrativeItem[];
  recommendations: string[];
}

/**
 * Sequenced recommendation with priority tier
 */
export interface SequencedRecommendation {
  tier: 'immediate' | 'short-term' | 'mid-term';
  tierLabel: string;
  recommendations: string[];
}

/**
 * Diagnostic trend data
 */
export interface DiagnosticTrend {
  toolId: string;
  label: string;
  currentScore: number | null;
  previousScore: number | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
}

/**
 * Quarter-over-quarter change summary
 */
export interface QuarterChange {
  metric: string;
  previousValue: string | number | null;
  currentValue: string | number | null;
  delta: number | null;
  deltaPercent: number | null;
  trend: 'up' | 'down' | 'flat' | 'new';
  significance: 'major' | 'minor' | 'neutral';
  narrative: string;
}

/**
 * Quarter changes section
 */
export interface QuarterChangesSection {
  quarterLabel: string;
  previousQuarterLabel: string;
  changes: QuarterChange[];
  summaryNarrative: string;
  overallTrend: 'improving' | 'declining' | 'stable' | 'new';
}

/**
 * Complete QBR narrative output
 */
export interface QBRNarrative {
  /** Company name */
  companyName: string;
  /** Quarter label (e.g., "Q4 2024") */
  quarterLabel: string;
  /** Overall health score */
  healthScore: number;
  /** Executive summary section */
  executiveSummary: QBRNarrativeSection;
  /** Diagnostics overview section */
  diagnosticsSection: QBRNarrativeSection;
  /** Work status section */
  workSection: QBRNarrativeSection;
  /** Context graph health section */
  contextSection: QBRNarrativeSection | null;
  /** Findings & insights section */
  findingsSection: QBRNarrativeSection;
  /** Recommendations section */
  recommendationsSection: QBRNarrativeSection;
  /** Key wins this quarter */
  keyWins: QBRNarrativeSection;
  /** Key challenges identified */
  keyChallenges: QBRNarrativeSection;
  /** Next quarter focus areas */
  nextQuarterFocus: QBRNarrativeSection;
  /** Theme deep dives */
  themeDeepDives: ThemeDeepDive[];
  /** Sequenced recommendations by priority */
  sequencedRecommendations: SequencedRecommendation[];
  /** Diagnostic trends (score changes) */
  diagnosticTrends: DiagnosticTrend[];
  /** Quarter-over-quarter changes */
  quarterChanges: QuarterChangesSection | null;
  /** Full narrative text for export/display */
  fullNarrativeText: string;
  /** All sections in display order */
  sections: QBRNarrativeSection[];
  /** When the narrative was generated */
  generatedAt: string;
  /** Whether AI was used for generation */
  aiGenerated: boolean;
  /** Any warnings during generation */
  warnings: string[];
}

/**
 * Options for narrative generation
 */
export interface GenerateNarrativeOptions {
  /** Use AI for richer narrative (requires ANTHROPIC_API_KEY) */
  useAI?: boolean;
  /** Custom quarter label override */
  quarterLabel?: string;
  /** Include context graph section even if no data */
  includeEmptyContext?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current quarter label
 */
function getCurrentQuarterLabel(): string {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const year = now.getFullYear();
  return `Q${quarter} ${year}`;
}

/**
 * Format a score with color indication
 */
function formatScore(score: number | null): string {
  if (score === null) return 'N/A';
  if (score >= 80) return `${score}% (Excellent)`;
  if (score >= 60) return `${score}% (Good)`;
  if (score >= 40) return `${score}% (Needs Work)`;
  return `${score}% (Critical)`;
}

/**
 * Get tone based on score
 */
function getToneFromScore(score: number | null): 'neutral' | 'positive' | 'warning' | 'critical' {
  if (score === null) return 'neutral';
  if (score >= 80) return 'positive';
  if (score >= 60) return 'neutral';
  if (score >= 40) return 'warning';
  return 'critical';
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ============================================================================
// Section Generators (Non-AI)
// ============================================================================

/**
 * Generate executive summary section
 */
function generateExecutiveSummary(data: QBRData, healthScore: number, quarterLabel: string): QBRNarrativeSection {
  const diagnosticsScore = data.diagnostics.averageScore;
  const contextScore = data.contextHealth?.completenessScore ?? null;
  const workActive = data.work.counts.inProgress + data.work.counts.planned;
  const findingsUnresolved = data.findingsSummary.unconverted;

  const bullets: string[] = [];

  // Overall health
  if (healthScore >= 80) {
    bullets.push(`Overall marketing health is strong at ${healthScore}%.`);
  } else if (healthScore >= 60) {
    bullets.push(`Overall marketing health is good at ${healthScore}%, with room for improvement.`);
  } else if (healthScore >= 40) {
    bullets.push(`Overall marketing health needs attention at ${healthScore}%.`);
  } else {
    bullets.push(`Overall marketing health requires urgent attention at ${healthScore}%.`);
  }

  // Diagnostics insight
  if (diagnosticsScore !== null) {
    bullets.push(`Diagnostic modules average score: ${formatScore(diagnosticsScore)}.`);
  } else if (data.diagnostics.totalModuleCount === 0) {
    bullets.push(`No diagnostic runs completed yet. Run diagnostics to get baseline scores.`);
  }

  // Work status
  if (workActive > 0) {
    bullets.push(`${workActive} work items are active (${data.work.counts.inProgress} in progress, ${data.work.counts.planned} planned).`);
  }
  if (data.work.counts.done > 0) {
    bullets.push(`${data.work.counts.done} work items completed.`);
  }

  // Findings
  if (findingsUnresolved > 0) {
    bullets.push(`${findingsUnresolved} diagnostic findings pending conversion to work items.`);
  }

  const content = `${data.company.name} ${quarterLabel} Marketing Health Report. This QBR summarizes the current state of marketing operations, diagnostics, and strategic priorities.`;

  return {
    id: generateId(),
    title: `${quarterLabel} Quarterly Business Review`,
    subtitle: data.company.name,
    type: 'summary',
    content,
    bullets,
    tone: getToneFromScore(healthScore),
    order: 0,
  };
}

/**
 * Generate diagnostics section
 */
function generateDiagnosticsSection(diagnostics: DiagnosticsSnapshot): QBRNarrativeSection {
  const bullets: string[] = [];

  if (diagnostics.totalModuleCount === 0) {
    return {
      id: generateId(),
      title: 'Diagnostics Overview',
      subtitle: 'No diagnostic runs yet',
      type: 'diagnostics',
      content: 'No diagnostic modules have been run. Run diagnostics from the Labs to establish baseline scores and identify areas for improvement.',
      bullets: ['Run Website Lab to assess site health', 'Run Brand Lab to evaluate brand strength', 'Run SEO Lab to check organic visibility'],
      tone: 'warning',
      order: 1,
    };
  }

  // List modules with scores
  const scoredModules = diagnostics.modules.filter(m => m.score !== null);
  const unscoredModules = diagnostics.modules.filter(m => m.score === null);

  for (const mod of scoredModules.slice(0, 6)) {
    const status = mod.status === 'complete' ? '' : ` (${mod.status})`;
    bullets.push(`${mod.label}: ${mod.score}%${status}`);
  }

  if (unscoredModules.length > 0) {
    bullets.push(`${unscoredModules.length} module(s) pending scoring`);
  }

  const avgText = diagnostics.averageScore !== null
    ? `Average score across ${diagnostics.scoredModuleCount} modules: ${diagnostics.averageScore}%.`
    : 'Scores pending.';

  const lastRun = diagnostics.latestRunDate
    ? new Date(diagnostics.latestRunDate).toLocaleDateString()
    : 'N/A';

  const content = `${avgText} Last diagnostic run: ${lastRun}. ${diagnostics.totalModuleCount} total modules tracked.`;

  return {
    id: generateId(),
    title: 'Diagnostics Overview',
    subtitle: `${diagnostics.scoredModuleCount} of ${diagnostics.totalModuleCount} modules scored`,
    type: 'diagnostics',
    content,
    bullets,
    tone: getToneFromScore(diagnostics.averageScore),
    order: 1,
  };
}

/**
 * Generate work section
 */
function generateWorkSection(work: QBRWorkSummary): QBRNarrativeSection {
  const bullets: string[] = [];

  // Status breakdown
  bullets.push(`Total work items: ${work.counts.total}`);
  if (work.counts.inProgress > 0) {
    bullets.push(`In Progress: ${work.counts.inProgress}`);
  }
  if (work.counts.planned > 0) {
    bullets.push(`Planned: ${work.counts.planned}`);
  }
  if (work.counts.backlog > 0) {
    bullets.push(`Backlog: ${work.counts.backlog}`);
  }
  if (work.counts.done > 0) {
    bullets.push(`Completed: ${work.counts.done}`);
  }

  // Recent completions
  if (work.recentlyCompleted.length > 0) {
    bullets.push(`Recently completed: ${work.recentlyCompleted.slice(0, 3).map(w => w.title).join(', ')}`);
  }

  // By area breakdown
  const topAreas = Object.entries(work.byArea)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topAreas.length > 0) {
    const areaText = topAreas.map(([area, count]) => `${area} (${count})`).join(', ');
    bullets.push(`Top areas: ${areaText}`);
  }

  const completionRate = work.counts.total > 0
    ? Math.round((work.counts.done / work.counts.total) * 100)
    : 0;

  let content = `Work completion rate: ${completionRate}%. `;
  if (work.counts.inProgress > 0) {
    content += `${work.counts.inProgress} items currently in progress. `;
  }
  if (work.counts.backlog > 0) {
    content += `${work.counts.backlog} items in backlog awaiting prioritization.`;
  }

  const tone: 'neutral' | 'positive' | 'warning' | 'critical' =
    completionRate >= 70 ? 'positive' :
    completionRate >= 40 ? 'neutral' :
    completionRate >= 20 ? 'warning' : 'critical';

  return {
    id: generateId(),
    title: 'Work Status',
    subtitle: `${work.counts.inProgress + work.counts.planned} active items`,
    type: 'work',
    content,
    bullets,
    tone,
    order: 2,
  };
}

/**
 * Generate context graph section
 */
function generateContextSection(contextHealth: ContextGraphHealth | null): QBRNarrativeSection | null {
  if (!contextHealth) {
    return null;
  }

  const bullets: string[] = [];
  bullets.push(`Overall completeness: ${contextHealth.completenessScore}%`);

  // Domain coverage
  const domains = Object.entries(contextHealth.domainCoverage)
    .filter(([, coverage]) => coverage > 0)
    .sort((a, b) => b[1] - a[1]);

  if (domains.length > 0) {
    const strongDomains = domains.filter(([, c]) => c >= 70);
    const weakDomains = domains.filter(([, c]) => c < 30 && c > 0);

    if (strongDomains.length > 0) {
      bullets.push(`Strong coverage: ${strongDomains.map(([d]) => d).join(', ')}`);
    }
    if (weakDomains.length > 0) {
      bullets.push(`Needs data: ${weakDomains.map(([d]) => d).join(', ')}`);
    }
  }

  if (contextHealth.lastFusionAt) {
    bullets.push(`Last updated: ${new Date(contextHealth.lastFusionAt).toLocaleDateString()}`);
  }

  if (contextHealth.nodeCount) {
    bullets.push(`${contextHealth.nodeCount} context fields populated`);
  }

  const content = `Context Graph completeness is ${contextHealth.completenessScore}%. ${
    contextHealth.completenessScore >= 70
      ? 'The context graph has good coverage for AI-powered insights.'
      : 'Consider running more diagnostics or completing the Setup Wizard to improve context coverage.'
  }`;

  return {
    id: generateId(),
    title: 'Context Graph Health',
    subtitle: `${contextHealth.completenessScore}% complete`,
    type: 'context',
    content,
    bullets,
    tone: getToneFromScore(contextHealth.completenessScore),
    order: 3,
  };
}

/**
 * Generate findings section
 */
function generateFindingsSection(findings: DiagnosticDetailFinding[], summary: FindingsSummary): QBRNarrativeSection {
  const bullets: string[] = [];

  if (summary.total === 0) {
    return {
      id: generateId(),
      title: 'Diagnostic Findings',
      subtitle: 'No findings yet',
      type: 'insights',
      content: 'No diagnostic findings have been generated. Run diagnostics from the Labs to identify issues and opportunities.',
      bullets: [],
      tone: 'neutral',
      order: 4,
    };
  }

  // By severity
  const critical = summary.bySeverity['critical'] || 0;
  const high = summary.bySeverity['high'] || 0;
  const medium = summary.bySeverity['medium'] || 0;
  const low = summary.bySeverity['low'] || 0;

  if (critical > 0) bullets.push(`Critical: ${critical}`);
  if (high > 0) bullets.push(`High priority: ${high}`);
  if (medium > 0) bullets.push(`Medium priority: ${medium}`);
  if (low > 0) bullets.push(`Low priority: ${low}`);

  bullets.push(`Converted to work: ${summary.converted}`);
  bullets.push(`Pending conversion: ${summary.unconverted}`);

  // By lab
  const topLabs = Object.entries(summary.byLab)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topLabs.length > 0) {
    bullets.push(`Top sources: ${topLabs.map(([lab, count]) => `${lab} (${count})`).join(', ')}`);
  }

  const urgentCount = critical + high;
  let content = `${summary.total} total findings from diagnostic runs. `;
  if (urgentCount > 0) {
    content += `${urgentCount} urgent items (critical + high) require attention. `;
  }
  content += `${summary.unconverted} findings pending conversion to actionable work items.`;

  const tone: 'neutral' | 'positive' | 'warning' | 'critical' =
    critical > 0 ? 'critical' :
    high > 3 ? 'warning' :
    summary.unconverted > 10 ? 'warning' : 'neutral';

  return {
    id: generateId(),
    title: 'Diagnostic Findings',
    subtitle: `${summary.total} findings, ${summary.unconverted} pending`,
    type: 'insights',
    content,
    bullets,
    tone,
    order: 4,
  };
}

/**
 * Generate recommendations section
 */
function generateRecommendationsSection(data: QBRData, healthScore: number): QBRNarrativeSection {
  const bullets: string[] = [];

  // Priority recommendations based on data
  const critical = data.findingsSummary.bySeverity['critical'] || 0;
  const high = data.findingsSummary.bySeverity['high'] || 0;

  if (critical > 0) {
    bullets.push(`Address ${critical} critical findings immediately`);
  }

  if (high > 0) {
    bullets.push(`Review and prioritize ${high} high-priority findings`);
  }

  if (data.findingsSummary.unconverted > 5) {
    bullets.push(`Convert pending findings to work items for tracking`);
  }

  if (data.diagnostics.totalModuleCount < 3) {
    bullets.push(`Run additional diagnostic labs to get comprehensive coverage`);
  }

  if (data.contextHealth && data.contextHealth.completenessScore < 50) {
    bullets.push(`Complete the Setup Wizard to improve context graph coverage`);
  }

  if (data.work.counts.backlog > 10) {
    bullets.push(`Review and prioritize backlog items (${data.work.counts.backlog} items)`);
  }

  if (data.work.counts.inProgress > 5) {
    bullets.push(`Consider completing in-progress items before starting new work`);
  }

  // Always include forward-looking items
  if (bullets.length < 3) {
    bullets.push(`Schedule regular diagnostic runs to track progress`);
    bullets.push(`Review and update strategic priorities quarterly`);
  }

  const content = healthScore >= 70
    ? `Marketing operations are in good shape. Focus on continuous improvement and addressing remaining gaps.`
    : healthScore >= 40
    ? `There are opportunities to improve marketing effectiveness. Prioritize the recommendations below.`
    : `Significant work is needed to improve marketing health. Focus on critical items first.`;

  return {
    id: generateId(),
    title: 'Recommendations',
    subtitle: 'Priority actions',
    type: 'recommendations',
    content,
    bullets: bullets.slice(0, 6),
    tone: healthScore >= 60 ? 'neutral' : 'warning',
    order: 5,
  };
}

/**
 * Generate key wins section
 */
function generateKeyWins(data: QBRData, companyId: string): QBRNarrativeSection {
  const bullets: string[] = [];

  // Completed work items
  if (data.work.recentlyCompleted.length > 0) {
    const completed = data.work.recentlyCompleted.slice(0, 3);
    for (const item of completed) {
      bullets.push(`Completed: ${item.title}`);
    }
  }

  // Good diagnostic scores
  const goodScores = data.diagnostics.modules.filter(m => m.score !== null && m.score >= 70);
  if (goodScores.length > 0) {
    const topModules = goodScores.slice(0, 2);
    for (const mod of topModules) {
      bullets.push(`Strong ${mod.label} score: ${mod.score}%`);
    }
  }

  // High findings resolution
  if (data.findingsSummary.total > 0) {
    const resolutionRate = Math.round((data.findingsSummary.converted / data.findingsSummary.total) * 100);
    if (resolutionRate >= 50) {
      bullets.push(`${resolutionRate}% findings converted to actionable work`);
    }
  }

  // Good context coverage
  if (data.contextHealth && data.contextHealth.completenessScore >= 60) {
    bullets.push(`Context graph at ${data.contextHealth.completenessScore}% completeness`);
  }

  const hasWins = bullets.length > 0;
  const content = hasWins
    ? `This quarter saw progress in several key areas. These wins demonstrate momentum and should be celebrated.`
    : `No major wins captured this quarter. Focus on completing in-progress work to build momentum.`;

  return {
    id: generateId(),
    title: 'Key Wins',
    subtitle: hasWins ? `${bullets.length} highlights` : 'Building momentum',
    type: 'wins',
    content,
    bullets: bullets.length > 0 ? bullets : ['No completed work items this period', 'Focus on closing active work'],
    tone: hasWins ? 'positive' : 'neutral',
    order: 6,
  };
}

/**
 * Generate key challenges section
 */
function generateKeyChallenges(data: QBRData, companyId: string): QBRNarrativeSection {
  const bullets: string[] = [];

  // Critical findings
  const critical = data.findingsSummary.bySeverity['critical'] || 0;
  const high = data.findingsSummary.bySeverity['high'] || 0;
  if (critical > 0) {
    bullets.push(`${critical} critical findings require immediate attention`);
  }
  if (high > 0) {
    bullets.push(`${high} high-priority findings to address`);
  }

  // Low diagnostic scores
  const lowScores = data.diagnostics.modules.filter(m => m.score !== null && m.score < 50);
  if (lowScores.length > 0) {
    const worstModules = lowScores.sort((a, b) => (a.score || 0) - (b.score || 0)).slice(0, 2);
    for (const mod of worstModules) {
      bullets.push(`${mod.label} needs work: ${mod.score}%`);
    }
  }

  // Large backlog
  if (data.work.counts.backlog > 10) {
    bullets.push(`${data.work.counts.backlog} items in backlog need prioritization`);
  }

  // Low context coverage
  if (data.contextHealth && data.contextHealth.completenessScore < 40) {
    bullets.push(`Context graph at only ${data.contextHealth.completenessScore}% - limits AI insights`);
  }

  // Stalled work
  if (data.work.counts.inProgress > 5) {
    bullets.push(`${data.work.counts.inProgress} items in progress - consider focus`);
  }

  const hasChallenges = bullets.length > 0;
  const tone = critical > 0 ? 'critical' : (high > 0 || lowScores.length > 2) ? 'warning' : 'neutral';

  const content = hasChallenges
    ? `Several areas require attention this quarter. Addressing these challenges will improve overall marketing health.`
    : `No significant challenges identified. Continue monitoring for emerging issues.`;

  return {
    id: generateId(),
    title: 'Key Challenges',
    subtitle: hasChallenges ? `${bullets.length} areas to address` : 'Looking good',
    type: 'challenges',
    content,
    bullets: bullets.length > 0 ? bullets : ['No critical issues identified', 'Maintain current progress'],
    tone,
    order: 7,
  };
}

/**
 * Generate next quarter focus section
 */
function generateNextQuarterFocus(data: QBRData, healthScore: number): QBRNarrativeSection {
  const bullets: string[] = [];

  // Based on current state, recommend focus areas
  const critical = data.findingsSummary.bySeverity['critical'] || 0;
  const high = data.findingsSummary.bySeverity['high'] || 0;

  if (critical > 0 || high > 3) {
    bullets.push('Resolve critical and high-priority findings');
  }

  if (data.work.counts.inProgress > 3) {
    bullets.push('Complete in-progress work before starting new initiatives');
  }

  if (data.diagnostics.totalModuleCount < 5) {
    bullets.push('Expand diagnostic coverage with additional lab runs');
  }

  if (data.contextHealth && data.contextHealth.completenessScore < 60) {
    bullets.push('Improve context graph data for better AI insights');
  }

  // Strategic recommendations based on low-scoring areas
  const lowAreas = data.diagnostics.modules
    .filter(m => m.score !== null && m.score < 60)
    .map(m => m.label);
  if (lowAreas.length > 0) {
    bullets.push(`Focus on improving: ${lowAreas.slice(0, 2).join(', ')}`);
  }

  if (bullets.length < 3) {
    bullets.push('Maintain current momentum and track key metrics');
    bullets.push('Conduct quarterly diagnostic refresh');
  }

  const content = healthScore >= 60
    ? `Next quarter should focus on optimization and addressing remaining gaps.`
    : `Next quarter should prioritize resolving foundational issues to improve marketing effectiveness.`;

  return {
    id: generateId(),
    title: 'Next Quarter Focus',
    subtitle: 'Recommended priorities',
    type: 'focus',
    content,
    bullets: bullets.slice(0, 5),
    tone: 'neutral',
    order: 8,
  };
}

/**
 * Generate theme deep dives from findings
 */
function generateThemeDeepDives(data: QBRData, companyId: string): ThemeDeepDive[] {
  const themes: ThemeDeepDive[] = [];

  // Group findings by category/area
  const findingsByCategory: Record<string, typeof data.findings> = {};
  for (const finding of data.findings) {
    const category = finding.category || finding.labSlug || 'General';
    if (!findingsByCategory[category]) {
      findingsByCategory[category] = [];
    }
    findingsByCategory[category].push(finding);
  }

  // Create deep dives for top categories
  const sortedCategories = Object.entries(findingsByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  for (const [category, categoryFindings] of sortedCategories) {
    if (categoryFindings.length < 2) continue;

    const criticalCount = categoryFindings.filter(f => f.severity === 'critical').length;
    const highCount = categoryFindings.filter(f => f.severity === 'high').length;

    // Find related work items
    const relatedWork = data.work.items.filter(w =>
      w.area?.toLowerCase().includes(category.toLowerCase()) ||
      w.title?.toLowerCase().includes(category.toLowerCase())
    );

    themes.push({
      theme: category,
      summary: `${categoryFindings.length} findings identified${criticalCount > 0 ? `, ${criticalCount} critical` : ''}${highCount > 0 ? `, ${highCount} high priority` : ''}`,
      findings: categoryFindings.slice(0, 5).map(f => ({
        title: f.description || 'Finding',
        description: f.recommendation?.slice(0, 150),
        severity: f.severity as 'critical' | 'high' | 'medium' | 'low' | undefined,
        crossLinks: f.id ? [{
          type: 'finding' as const,
          id: f.id,
          label: 'View Finding',
          href: `/c/${companyId}/findings?id=${f.id}`,
        }] : undefined,
      })),
      workItems: relatedWork.slice(0, 3).map(w => ({
        title: w.title,
        description: w.notes?.slice(0, 100),
        area: w.area,
        crossLinks: [{
          type: 'work' as const,
          id: w.id,
          label: 'View Work Item',
          href: `/c/${companyId}/work?id=${w.id}`,
        }],
      })),
      recommendations: [
        criticalCount > 0 ? `Address ${criticalCount} critical ${category} issues first` : '',
        highCount > 0 ? `Review ${highCount} high-priority items` : '',
        `Consider dedicated ${category} improvement sprint`,
      ].filter(Boolean),
    });
  }

  return themes;
}

/**
 * Generate sequenced recommendations by priority tier
 */
function generateSequencedRecommendations(data: QBRData, healthScore: number): SequencedRecommendation[] {
  const immediate: string[] = [];
  const shortTerm: string[] = [];
  const midTerm: string[] = [];

  // Immediate priorities (critical issues)
  const critical = data.findingsSummary.bySeverity['critical'] || 0;
  if (critical > 0) {
    immediate.push(`Resolve ${critical} critical findings`);
  }

  const highPriority = data.findingsSummary.bySeverity['high'] || 0;
  if (highPriority > 3) {
    immediate.push(`Triage ${highPriority} high-priority findings`);
  }

  if (data.work.counts.inProgress > 5) {
    immediate.push('Focus on completing in-progress work');
  }

  // Short-term priorities (1-2 weeks)
  if (data.diagnostics.totalModuleCount < 3) {
    shortTerm.push('Run additional diagnostic labs');
  }

  if (data.findingsSummary.unconverted > 5) {
    shortTerm.push(`Convert ${data.findingsSummary.unconverted} pending findings to work items`);
  }

  if (data.work.counts.backlog > 10) {
    shortTerm.push('Prioritize and trim backlog');
  }

  const lowModules = data.diagnostics.modules.filter(m => m.score !== null && m.score < 50);
  if (lowModules.length > 0) {
    shortTerm.push(`Address low-scoring areas: ${lowModules.slice(0, 2).map(m => m.label).join(', ')}`);
  }

  // Mid-term priorities (30-60 days)
  if (data.contextHealth && data.contextHealth.completenessScore < 60) {
    midTerm.push('Complete context graph with missing data');
  }

  midTerm.push('Schedule quarterly diagnostic refresh');
  midTerm.push('Review and update strategic priorities');

  if (healthScore < 60) {
    midTerm.push('Establish baseline metrics for improvement tracking');
  }

  return [
    {
      tier: 'immediate',
      tierLabel: 'Immediate Priority (This Week)',
      recommendations: immediate.length > 0 ? immediate : ['No critical items - maintain current progress'],
    },
    {
      tier: 'short-term',
      tierLabel: 'Short-Term (1-2 Weeks)',
      recommendations: shortTerm.length > 0 ? shortTerm.slice(0, 4) : ['Continue steady progress on work items'],
    },
    {
      tier: 'mid-term',
      tierLabel: 'Mid-Term (30-60 Days)',
      recommendations: midTerm.slice(0, 4),
    },
  ];
}

/**
 * Get previous quarter label
 */
function getPreviousQuarterLabel(currentLabel: string): string {
  const match = currentLabel.match(/Q(\d)\s+(\d{4})/);
  if (!match) return 'Previous Quarter';

  const quarter = parseInt(match[1]);
  const year = parseInt(match[2]);

  if (quarter === 1) {
    return `Q4 ${year - 1}`;
  }
  return `Q${quarter - 1} ${year}`;
}

/**
 * Generate quarter-over-quarter changes section
 */
function generateQuarterChanges(data: QBRData, healthScore: number, quarterLabel: string): QuarterChangesSection | null {
  const previousQuarterLabel = getPreviousQuarterLabel(quarterLabel);
  const changes: QuarterChange[] = [];

  // Calculate trends from diagnostic data if available
  const diagnosticTrends = data.diagnosticsEnhanced?.trends || data.diagnostics.trends || [];

  // Health score change (we don't have historical data for this yet, but structure is ready)
  // For now, we'll compute trends from diagnostic modules that have previous scores

  let improvingCount = 0;
  let decliningCount = 0;
  let stableCount = 0;

  // Diagnostic module changes
  for (const trend of diagnosticTrends) {
    if (trend.previousScore !== null && trend.currentScore !== null) {
      const delta = trend.delta ?? (trend.currentScore - trend.previousScore);
      const deltaPercent = trend.previousScore > 0
        ? Math.round((delta / trend.previousScore) * 100)
        : null;

      let significance: 'major' | 'minor' | 'neutral' = 'neutral';
      if (Math.abs(delta) >= 10) significance = 'major';
      else if (Math.abs(delta) >= 5) significance = 'minor';

      let narrative = '';
      if (trend.trend === 'up') {
        narrative = `${trend.label} improved from ${trend.previousScore}% to ${trend.currentScore}% (+${delta} points)`;
        improvingCount++;
      } else if (trend.trend === 'down') {
        narrative = `${trend.label} declined from ${trend.previousScore}% to ${trend.currentScore}% (${delta} points)`;
        decliningCount++;
      } else {
        narrative = `${trend.label} remained stable at ${trend.currentScore}%`;
        stableCount++;
      }

      changes.push({
        metric: trend.label,
        previousValue: trend.previousScore,
        currentValue: trend.currentScore,
        delta,
        deltaPercent,
        trend: trend.trend,
        significance,
        narrative,
      });
    }
  }

  // Work completion change (if we have enhanced work data)
  if (data.workEnhanced) {
    const completedCount = data.workEnhanced.completedThisQuarter.length;
    if (completedCount > 0) {
      changes.push({
        metric: 'Work Completed This Quarter',
        previousValue: null,
        currentValue: completedCount,
        delta: null,
        deltaPercent: null,
        trend: 'new',
        significance: completedCount >= 5 ? 'major' : 'minor',
        narrative: `${completedCount} work items completed this quarter`,
      });
    }
  }

  // If no changes tracked, return null
  if (changes.length === 0) {
    return null;
  }

  // Determine overall trend
  let overallTrend: 'improving' | 'declining' | 'stable' | 'new' = 'new';
  if (improvingCount > decliningCount + 1) {
    overallTrend = 'improving';
  } else if (decliningCount > improvingCount + 1) {
    overallTrend = 'declining';
  } else if (changes.length > 0) {
    overallTrend = 'stable';
  }

  // Generate summary narrative
  let summaryNarrative = '';
  if (overallTrend === 'improving') {
    summaryNarrative = `Marketing health is improving. ${improvingCount} metrics showed improvement while ${decliningCount} declined.`;
  } else if (overallTrend === 'declining') {
    summaryNarrative = `Marketing health needs attention. ${decliningCount} metrics declined while only ${improvingCount} improved.`;
  } else if (overallTrend === 'stable') {
    summaryNarrative = `Marketing health is stable with ${stableCount} metrics unchanged, ${improvingCount} improving, and ${decliningCount} declining.`;
  } else {
    summaryNarrative = `This is the first quarter with tracked metrics. ${changes.length} metrics are now being monitored.`;
  }

  return {
    quarterLabel,
    previousQuarterLabel,
    changes,
    summaryNarrative,
    overallTrend,
  };
}

/**
 * Generate full narrative text for export
 */
function generateFullNarrativeText(
  narrative: Omit<QBRNarrative, 'fullNarrativeText'>,
  data: QBRData
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${narrative.companyName} - ${narrative.quarterLabel} Quarterly Business Review`);
  lines.push('');
  lines.push(`Generated: ${new Date(narrative.generatedAt).toLocaleDateString()}`);
  lines.push(`Overall Health Score: ${narrative.healthScore}%`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(narrative.executiveSummary.content);
  if (narrative.executiveSummary.bullets && narrative.executiveSummary.bullets.length > 0) {
    lines.push('');
    for (const bullet of narrative.executiveSummary.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Quarter Changes (if available)
  if (narrative.quarterChanges) {
    lines.push('## Quarter-over-Quarter Changes');
    lines.push('');
    lines.push(narrative.quarterChanges.summaryNarrative);
    lines.push('');
    for (const change of narrative.quarterChanges.changes) {
      lines.push(`- ${change.narrative}`);
    }
    lines.push('');
  }

  // Key Wins
  lines.push('## Key Wins');
  lines.push('');
  lines.push(narrative.keyWins.content);
  if (narrative.keyWins.bullets) {
    for (const bullet of narrative.keyWins.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Key Challenges
  lines.push('## Key Challenges');
  lines.push('');
  lines.push(narrative.keyChallenges.content);
  if (narrative.keyChallenges.bullets) {
    for (const bullet of narrative.keyChallenges.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Diagnostics Overview
  lines.push('## Diagnostics Overview');
  lines.push('');
  lines.push(narrative.diagnosticsSection.content);
  if (narrative.diagnosticsSection.bullets) {
    for (const bullet of narrative.diagnosticsSection.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Diagnostic Trends
  if (narrative.diagnosticTrends.length > 0) {
    lines.push('### Diagnostic Trends');
    lines.push('');
    for (const trend of narrative.diagnosticTrends) {
      const arrow = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→';
      const delta = trend.delta !== null ? ` (${trend.delta > 0 ? '+' : ''}${trend.delta})` : '';
      lines.push(`- ${trend.label}: ${trend.currentScore ?? 'N/A'}%${delta} ${arrow}`);
    }
    lines.push('');
  }

  // Work Status
  lines.push('## Work Status');
  lines.push('');
  lines.push(narrative.workSection.content);
  if (narrative.workSection.bullets) {
    for (const bullet of narrative.workSection.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Findings
  lines.push('## Diagnostic Findings');
  lines.push('');
  lines.push(narrative.findingsSection.content);
  if (narrative.findingsSection.bullets) {
    for (const bullet of narrative.findingsSection.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Theme Deep Dives
  if (narrative.themeDeepDives.length > 0) {
    lines.push('## Theme Deep Dives');
    lines.push('');
    for (const theme of narrative.themeDeepDives) {
      lines.push(`### ${theme.theme}`);
      lines.push('');
      lines.push(theme.summary);
      if (theme.recommendations.length > 0) {
        lines.push('');
        lines.push('**Recommendations:**');
        for (const rec of theme.recommendations) {
          lines.push(`- ${rec}`);
        }
      }
      lines.push('');
    }
  }

  // Next Quarter Focus
  lines.push('## Next Quarter Focus');
  lines.push('');
  lines.push(narrative.nextQuarterFocus.content);
  if (narrative.nextQuarterFocus.bullets) {
    for (const bullet of narrative.nextQuarterFocus.bullets) {
      lines.push(`- ${bullet}`);
    }
  }
  lines.push('');

  // Sequenced Recommendations
  lines.push('## Recommendations');
  lines.push('');
  for (const tier of narrative.sequencedRecommendations) {
    lines.push(`### ${tier.tierLabel}`);
    for (const rec of tier.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*This report was ${narrative.aiGenerated ? 'AI-enhanced' : 'template-generated'} by Hive OS.*`);

  return lines.join('\n');
}

// ============================================================================
// AI-Enhanced Generation
// ============================================================================

/**
 * Generate AI-enhanced narrative using Claude
 */
async function generateAINarrative(data: QBRData, healthScore: number, quarterLabel: string): Promise<{
  executiveSummary: string;
  recommendations: string[];
} | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[QBRNarrative] No ANTHROPIC_API_KEY, skipping AI generation');
    return null;
  }

  try {
    const anthropic = new Anthropic();

    const systemPrompt = `You are a senior marketing strategist writing a Quarterly Business Review summary.
Be concise, specific, and actionable. Focus on insights that drive decisions.
Output valid JSON only. No markdown, no explanation.`;

    const userPrompt = `Generate a QBR summary for ${data.company.name}.

CURRENT STATE (${quarterLabel}):
- Overall Health Score: ${healthScore}%
- Diagnostics Average: ${data.diagnostics.averageScore ?? 'N/A'}%
- Context Completeness: ${data.contextHealth?.completenessScore ?? 'N/A'}%

WORK STATUS:
- Total Items: ${data.work.counts.total}
- In Progress: ${data.work.counts.inProgress}
- Completed: ${data.work.counts.done}

FINDINGS:
- Total: ${data.findingsSummary.total}
- Critical: ${data.findingsSummary.bySeverity['critical'] || 0}
- High: ${data.findingsSummary.bySeverity['high'] || 0}
- Unconverted: ${data.findingsSummary.unconverted}

DIAGNOSTICS RUN:
${data.diagnostics.modules.slice(0, 5).map(m => `- ${m.label}: ${m.score ?? 'pending'}%`).join('\n')}

Output JSON format:
{
  "executiveSummary": "2-3 sentence executive summary highlighting key insights and state",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const parsed = JSON.parse(responseText);

    return {
      executiveSummary: parsed.executiveSummary || '',
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error('[QBRNarrative] AI generation failed:', error);
    return null;
  }
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate QBR narrative from QBR data
 *
 * @param data - The QBR data from loadQBRData
 * @param options - Generation options
 * @returns Complete QBR narrative
 */
export async function generateQBRNarrative(
  data: QBRData,
  options: GenerateNarrativeOptions = {}
): Promise<QBRNarrative> {
  const { useAI = true, quarterLabel = getCurrentQuarterLabel(), includeEmptyContext = false } = options;

  console.log('[QBRNarrative] Generating narrative for:', data.company.name);

  const healthScore = calculateOverallHealthScore(data);
  const warnings: string[] = [...data.warnings];
  const companyId = data.companyId;

  // Try AI-enhanced generation
  let aiContent: { executiveSummary: string; recommendations: string[] } | null = null;
  if (useAI) {
    aiContent = await generateAINarrative(data, healthScore, quarterLabel);
  }

  // Generate core sections
  let executiveSummary = generateExecutiveSummary(data, healthScore, quarterLabel);
  const diagnosticsSection = generateDiagnosticsSection(data.diagnostics);
  const workSection = generateWorkSection(data.work);
  const contextSection = generateContextSection(data.contextHealth);
  const findingsSection = generateFindingsSection(data.findings, data.findingsSummary);
  let recommendationsSection = generateRecommendationsSection(data, healthScore);

  // Generate new sections
  const keyWins = generateKeyWins(data, companyId);
  const keyChallenges = generateKeyChallenges(data, companyId);
  const nextQuarterFocus = generateNextQuarterFocus(data, healthScore);
  const themeDeepDives = generateThemeDeepDives(data, companyId);
  const sequencedRecommendations = generateSequencedRecommendations(data, healthScore);

  // Generate diagnostic trends
  const diagnosticTrends: DiagnosticTrend[] = data.diagnostics.modules.map(mod => ({
    toolId: mod.toolId,
    label: mod.label,
    currentScore: mod.score,
    previousScore: null, // Will be populated from historical data in qbrData.ts
    delta: null,
    trend: 'new' as const,
  }));

  // Enhance with AI content if available
  if (aiContent) {
    if (aiContent.executiveSummary) {
      executiveSummary = {
        ...executiveSummary,
        content: aiContent.executiveSummary,
      };
    }
    if (aiContent.recommendations && aiContent.recommendations.length > 0) {
      recommendationsSection = {
        ...recommendationsSection,
        bullets: aiContent.recommendations.slice(0, 6),
      };
    }
  }

  // Assemble all sections in chapter order
  const sections: QBRNarrativeSection[] = [
    executiveSummary,
    diagnosticsSection,
    workSection,
    keyWins,
    keyChallenges,
    findingsSection,
    nextQuarterFocus,
    recommendationsSection,
  ];

  // Include context section if available or requested
  if (contextSection || includeEmptyContext) {
    const ctx = contextSection || {
      id: generateId(),
      title: 'Context Graph Health',
      subtitle: 'No context data',
      type: 'context' as const,
      content: 'Context graph has not been initialized. Complete the Setup Wizard to enable AI-powered insights.',
      bullets: [],
      tone: 'warning' as const,
      order: 3,
    };
    sections.splice(3, 0, ctx);
  }

  // Re-order sections
  sections.forEach((section, index) => {
    section.order = index;
  });

  // Generate quarter changes
  const quarterChanges = generateQuarterChanges(data, healthScore, quarterLabel);

  // Build the narrative object (without fullNarrativeText first)
  const generatedAt = new Date().toISOString();
  const narrativeBase = {
    companyName: data.company.name,
    quarterLabel,
    healthScore,
    executiveSummary,
    diagnosticsSection,
    workSection,
    contextSection,
    findingsSection,
    recommendationsSection,
    keyWins,
    keyChallenges,
    nextQuarterFocus,
    themeDeepDives,
    sequencedRecommendations,
    diagnosticTrends,
    quarterChanges,
    sections,
    generatedAt,
    aiGenerated: !!aiContent,
    warnings,
  };

  // Generate full narrative text for export
  const fullNarrativeText = generateFullNarrativeText(narrativeBase, data);

  console.log('[QBRNarrative] Generated', sections.length, 'sections', aiContent ? '(AI-enhanced)' : '(template)', quarterChanges ? 'with quarter changes' : '');

  return {
    ...narrativeBase,
    fullNarrativeText,
  };
}

/**
 * Generate a quick narrative summary (no AI, fast)
 */
export function generateQuickNarrativeSummary(data: QBRData): {
  healthScore: number;
  headline: string;
  keyStats: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[];
} {
  const healthScore = calculateOverallHealthScore(data);

  let headline = '';
  if (healthScore >= 80) {
    headline = 'Marketing operations are performing well.';
  } else if (healthScore >= 60) {
    headline = 'Marketing health is good with opportunities for improvement.';
  } else if (healthScore >= 40) {
    headline = 'Marketing operations need attention in key areas.';
  } else {
    headline = 'Significant work needed to improve marketing effectiveness.';
  }

  const keyStats: { label: string; value: string; trend?: 'up' | 'down' | 'flat' }[] = [
    { label: 'Health Score', value: `${healthScore}%` },
    { label: 'Active Work', value: `${data.work.counts.inProgress + data.work.counts.planned}` },
  ];

  if (data.diagnostics.averageScore !== null) {
    keyStats.push({ label: 'Diagnostics Avg', value: `${data.diagnostics.averageScore}%` });
  }

  if (data.findingsSummary.unconverted > 0) {
    keyStats.push({ label: 'Pending Findings', value: `${data.findingsSummary.unconverted}` });
  }

  return { healthScore, headline, keyStats };
}
