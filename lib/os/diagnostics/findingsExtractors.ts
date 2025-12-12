// lib/os/diagnostics/findingsExtractors.ts
// Helper functions to extract structured findings from Lab JSON results
//
// These extractors convert the raw JSON output from each Lab into
// standardized DiagnosticDetailFinding records that can be stored
// in the Diagnostic Details table for easy querying and filtering.

import type {
  CreateDiagnosticFindingInput,
  DiagnosticFindingCategory,
  DiagnosticFindingSeverity,
} from '@/lib/airtable/diagnosticDetails';

// ============================================================================
// Severity Mapping
// ============================================================================

/**
 * Map various severity strings to standard DiagnosticFindingSeverity
 */
export function mapSeverity(raw: string | undefined | null): DiagnosticFindingSeverity {
  if (!raw) return 'medium';

  const normalized = raw.toLowerCase().trim();

  // Direct matches
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
    return normalized as DiagnosticFindingSeverity;
  }

  // Aliases
  const aliases: Record<string, DiagnosticFindingSeverity> = {
    'severe': 'critical',
    'urgent': 'critical',
    'important': 'high',
    'warning': 'medium',
    'minor': 'low',
    'info': 'low',
    'informational': 'low',
  };

  return aliases[normalized] || 'medium';
}

/**
 * Determine worst severity from a list of findings
 */
export function getWorstSeverity(findings: CreateDiagnosticFindingInput[]): DiagnosticFindingSeverity | null {
  if (findings.length === 0) return null;

  const order: DiagnosticFindingSeverity[] = ['critical', 'high', 'medium', 'low'];

  for (const severity of order) {
    if (findings.some(f => f.severity === severity)) {
      return severity;
    }
  }

  return 'medium';
}

// ============================================================================
// Website Lab Extractor
// ============================================================================

/**
 * Extract findings from Website Lab results
 *
 * Handles multiple data formats:
 * 1. V4 nested structure (WebsiteUXLabResultV4):
 *    - siteAssessment.issues[], siteAssessment.recommendations[]
 *    - heuristics.findings[], impactMatrix.items[]
 * 2. DiagnosticModuleResult format (flattened):
 *    - issues[], recommendations[] at top level
 *    - rawEvidence may contain nested V4 data
 * 3. rawEvidence wrapper containing V4 data
 */
export function extractWebsiteLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  const seenKeys = new Set<string>();

  // Detect the data format and normalize access paths
  // Format 1: V4 nested (siteAssessment.issues exists)
  // Format 2: Module result (top-level issues/recommendations)
  // Format 3: rawEvidence contains V4 data
  const v4Data = raw.siteAssessment
    ? raw
    : raw.rawEvidence?.siteAssessment
      ? raw.rawEvidence
      : null;

  const moduleData = raw.issues || raw.recommendations ? raw : null;

  console.log('[findingsExtractors] Detected format:', {
    hasV4Data: !!v4Data,
    hasModuleData: !!moduleData,
    topLevelKeys: Object.keys(raw).slice(0, 10),
  });

  // ============================================================
  // Extract from V4 nested structure (if available)
  // ============================================================
  if (v4Data) {
    // 1a. Extract from siteAssessment.issues (V4 structure)
    const siteIssues = v4Data.siteAssessment?.issues || [];
    for (const issue of siteIssues) {
      const issueKey = issue.id || `website-issue-${issue.tag || 'general'}-${(issue.description || '').slice(0, 50)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category: mapWebsiteCategory(issue.tag),
        dimension: issue.tag || 'General',
        severity: mapSeverity(issue.severity),
        location: v4Data.siteAssessment?.url || undefined,
        issueKey,
        description: issue.description,
        recommendation: issue.evidence ? `Evidence: ${issue.evidence}` : undefined,
        estimatedImpact: undefined,
      });
    }

    // 1b. Extract from siteAssessment.recommendations
    const siteRecs = v4Data.siteAssessment?.recommendations || [];
    for (const rec of siteRecs) {
      const issueKey = rec.id || `website-rec-${rec.tag || 'general'}-${(rec.description || '').slice(0, 50)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      const severity = rec.priority === 'now' ? 'high' : rec.priority === 'next' ? 'medium' : 'low';

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category: mapWebsiteCategory(rec.tag),
        dimension: rec.tag || 'Recommendation',
        severity,
        location: v4Data.siteAssessment?.url || undefined,
        issueKey,
        description: rec.description,
        recommendation: rec.evidence ? `Evidence: ${rec.evidence}` : undefined,
        estimatedImpact: `Priority: ${rec.priority || 'medium'}`,
      });
    }

    // 1c. Extract from heuristics.findings
    const heuristicFindings = v4Data.heuristics?.findings || [];
    for (const hf of heuristicFindings) {
      const issueKey = hf.id || `website-heuristic-${(hf.heuristic || 'general').slice(0, 30)}-${(hf.description || '').slice(0, 30)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category: mapWebsiteCategory(hf.category || hf.heuristic),
        dimension: hf.heuristic || 'Heuristic',
        severity: mapSeverity(hf.severity),
        location: hf.pageUrl || undefined,
        issueKey,
        description: hf.description || hf.title || hf.finding,
        recommendation: hf.recommendation || hf.fix,
        estimatedImpact: hf.impact,
      });
    }

    // 1d. Extract from impactMatrix.items
    const impactItems = v4Data.impactMatrix?.items || [];
    for (const item of impactItems) {
      const issueKey = item.id || `website-impact-${(item.title || item.description || '').slice(0, 50)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      const severity = item.impact === 'high' ? 'high' : item.impact === 'medium' ? 'medium' : 'low';

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category: mapWebsiteCategory(item.category),
        dimension: item.category || 'Opportunity',
        severity,
        location: item.url || undefined,
        issueKey,
        description: item.title || item.description,
        recommendation: item.recommendation || item.action,
        estimatedImpact: item.effort ? `Impact: ${item.impact}, Effort: ${item.effort}` : undefined,
      });
    }

    // 1e. Extract from pageLevelScores
    const pageLevelScores = v4Data.siteAssessment?.pageLevelScores || [];
    for (const pageScore of pageLevelScores) {
      if (!Array.isArray(pageScore.issues)) continue;

      for (const issue of pageScore.issues) {
        const issueKey = `website-page-${pageScore.url || 'unknown'}-${(issue.description || issue).slice(0, 40)}`;

        if (seenKeys.has(issueKey)) continue;
        seenKeys.add(issueKey);

        const description = typeof issue === 'string' ? issue : issue.description;
        const severity = typeof issue === 'object' ? mapSeverity(issue.severity) : 'medium';

        findings.push({
          labRunId: runId,
          companyId,
          labSlug: 'website',
          category: 'UX',
          dimension: 'Page-Specific',
          severity,
          location: pageScore.url,
          issueKey,
          description,
          recommendation: undefined,
          estimatedImpact: pageScore.score ? `Page score: ${pageScore.score}/100` : undefined,
        });
      }
    }

    console.log('[findingsExtractors] V4 format extracted:', findings.length, 'findings');
  }

  // ============================================================
  // Extract from DiagnosticModuleResult format (top-level arrays)
  // ============================================================
  if (moduleData && findings.length === 0) {
    // 2a. Extract from top-level issues array
    const topLevelIssues = Array.isArray(moduleData.issues) ? moduleData.issues : [];
    for (const issue of topLevelIssues) {
      // Issue might be a string or object
      const issueText = typeof issue === 'string' ? issue : (issue.description || issue.title || issue.issue || JSON.stringify(issue));
      const issueKey = `website-module-issue-${issueText.slice(0, 60)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      // Try to extract severity from object, default to medium
      const severity = typeof issue === 'object' ? mapSeverity(issue.severity) : 'medium';
      const category = typeof issue === 'object' ? mapWebsiteCategory(issue.category || issue.tag) : 'UX';

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category,
        dimension: typeof issue === 'object' ? (issue.dimension || issue.tag || 'General') : 'General',
        severity,
        location: undefined,
        issueKey,
        description: issueText,
        recommendation: typeof issue === 'object' ? issue.recommendation : undefined,
        estimatedImpact: typeof issue === 'object' ? issue.impact : undefined,
      });
    }

    // 2b. Extract from top-level recommendations array
    const topLevelRecs = Array.isArray(moduleData.recommendations) ? moduleData.recommendations : [];
    for (const rec of topLevelRecs) {
      const recText = typeof rec === 'string' ? rec : (rec.description || rec.title || rec.recommendation || JSON.stringify(rec));
      const issueKey = `website-module-rec-${recText.slice(0, 60)}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      const severity = typeof rec === 'object' && rec.priority === 'now' ? 'high' : 'medium';
      const category = typeof rec === 'object' ? mapWebsiteCategory(rec.category || rec.tag) : 'UX';

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'website',
        category,
        dimension: typeof rec === 'object' ? (rec.dimension || rec.tag || 'Recommendation') : 'Recommendation',
        severity,
        location: undefined,
        issueKey,
        description: recText,
        recommendation: typeof rec === 'object' ? rec.action : undefined,
        estimatedImpact: typeof rec === 'object' ? rec.impact : undefined,
      });
    }

    console.log('[findingsExtractors] Module format extracted:', findings.length, 'findings from:', {
      issues: topLevelIssues.length,
      recommendations: topLevelRecs.length,
    });
  }

  console.log('[findingsExtractors] Website Lab total findings:', findings.length);

  return findings;
}

function mapWebsiteCategory(raw: string | undefined): DiagnosticFindingCategory {
  if (!raw) return 'UX';

  const normalized = raw.toLowerCase();

  // V3/V4 sectionScores tags
  if (normalized === 'hierarchy' || normalized === 'visual hierarchy') {
    return 'UX';
  }
  if (normalized === 'clarity' || normalized === 'message clarity') {
    return 'Content';
  }
  if (normalized === 'trust' || normalized === 'trust signals') {
    return 'Brand';
  }
  if (normalized === 'navigation') {
    return 'UX';
  }
  if (normalized === 'conversion' || normalized === 'cta') {
    return 'UX';
  }
  if (normalized === 'visualdesign' || normalized === 'visual design' || normalized === 'visual') {
    return 'Brand';
  }
  if (normalized === 'mobile' || normalized === 'mobile experience') {
    return 'Technical';
  }
  if (normalized === 'intentalignment' || normalized === 'intent alignment') {
    return 'UX';
  }

  // Keyword-based fallbacks
  if (normalized.includes('tech') || normalized.includes('performance') || normalized.includes('speed') || normalized.includes('load')) {
    return 'Technical';
  }
  if (normalized.includes('seo') || normalized.includes('search')) {
    return 'SEO';
  }
  if (normalized.includes('content') || normalized.includes('copy') || normalized.includes('message')) {
    return 'Content';
  }
  if (normalized.includes('brand') || normalized.includes('trust')) {
    return 'Brand';
  }

  return 'UX';
}

// ============================================================================
// Brand Lab Extractor
// ============================================================================

/**
 * Extract findings from Brand Lab results
 */
export function extractBrandLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  // Try different paths - including 'insights' from V4 snapshot format
  const issuesSources = [
    raw.diagnostic?.issues,
    raw.diagnostic?.gaps,
    raw.issues,
    raw.gaps,
    raw.insights, // V4 snapshot format stores findings in insights array
  ];

  const seenKeys = new Set<string>();

  for (const issues of issuesSources) {
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      const issueKey = issue.id || `brand-${issue.dimension || 'general'}-${issue.title || issue.description}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'brand',
        category: 'Brand',
        dimension: issue.dimension || issue.area || issue.category || 'General',
        severity: mapSeverity(issue.severity || issue.priority),
        location: issue.element || issue.location,
        issueKey,
        // V4 format uses 'title' + 'body', legacy uses 'description' + 'recommendation'
        description: issue.title || issue.description || issue.gap,
        recommendation: issue.recommendation || issue.suggestion || issue.body,
        estimatedImpact: issue.impact,
      });
    }
  }

  console.log('[findingsExtractors] Brand Lab extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// SEO Lab Extractor
// ============================================================================

/**
 * Extract findings from SEO Lab results
 */
export function extractSeoLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  const issuesSources = [
    raw.issues,
    raw.technicalIssues,
    raw.contentIssues,
    raw.seoIssues,
  ];

  const seenKeys = new Set<string>();

  for (const issues of issuesSources) {
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      const issueKey = issue.id || `seo-${issue.type || 'general'}-${issue.title || issue.url}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'seo',
        category: 'SEO',
        dimension: issue.type || issue.category || 'General',
        severity: mapSeverity(issue.severity || issue.priority),
        location: issue.url || issue.page,
        issueKey,
        description: issue.title || issue.description || issue.issue,
        recommendation: issue.recommendation || issue.fix,
        estimatedImpact: issue.impact || issue.estimatedTrafficImpact,
      });
    }
  }

  console.log('[findingsExtractors] SEO Lab extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// Content Lab Extractor
// ============================================================================

/**
 * Extract findings from Content Lab results
 */
export function extractContentLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  const issuesSources = [
    raw.issues,
    raw.gaps,
    raw.contentGaps,
  ];

  const seenKeys = new Set<string>();

  for (const issues of issuesSources) {
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      const issueKey = issue.id || `content-${issue.dimension || 'general'}-${issue.title}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'content',
        category: 'Content',
        dimension: issue.dimension || issue.type || 'General',
        severity: mapSeverity(issue.severity),
        location: issue.url || issue.asset,
        issueKey,
        description: issue.title || issue.description,
        recommendation: issue.recommendation,
        estimatedImpact: issue.impact,
      });
    }
  }

  console.log('[findingsExtractors] Content Lab extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// Demand Lab Extractor
// ============================================================================

/**
 * Map Demand Lab issue category to a dimension string
 */
function mapDemandDimension(category: string | undefined): string {
  if (!category) return 'General';

  // DemandIssueCategory: 'Channel Mix' | 'Targeting' | 'Creative' | 'Funnel' | 'Measurement'
  const dimensionMap: Record<string, string> = {
    'channel mix': 'Channel Mix & Budget',
    'channelmix': 'Channel Mix & Budget',
    'targeting': 'Targeting & Segmentation',
    'creative': 'Creative & Messaging',
    'funnel': 'Funnel Architecture',
    'measurement': 'Measurement & Optimization',
  };

  const normalized = category.toLowerCase().replace(/\s+/g, '');
  return dimensionMap[normalized] || category;
}

/**
 * Extract findings from Demand Lab results
 *
 * Demand Lab JSON structure (DemandLabResult):
 * - issues: DemandLabIssue[] (global issues array)
 * - dimensions: DemandLabDimension[] (each has issues array)
 * - quickWins: DemandLabQuickWin[]
 * - projects: DemandLabProject[]
 *
 * DemandLabIssue: { id, category, severity, title, description }
 */
export function extractDemandLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  // Try to get the report object (might be nested under 'report' or at root)
  const report = raw.report || raw;

  const seenKeys = new Set<string>();

  // Extract from global issues array
  const issuesSources = [
    report.issues,
    // Also check dimensions for nested issues
    ...(Array.isArray(report.dimensions) ? report.dimensions.map((d: any) => d.issues) : []),
  ];

  for (const issues of issuesSources) {
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      const issueKey = issue.id || `demand-${issue.category || 'general'}-${issue.title || issue.description}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'demand',
        category: 'Demand',
        dimension: mapDemandDimension(issue.category),
        severity: mapSeverity(issue.severity),
        location: report.url || undefined,
        issueKey,
        description: issue.title || issue.description,
        recommendation: issue.recommendation || issue.description,
        estimatedImpact: issue.impact,
      });
    }
  }

  // If no issues found but we have a report, create a summary finding
  if (findings.length === 0 && report.overallScore !== undefined) {
    const severity = report.overallScore < 40 ? 'high' : report.overallScore < 60 ? 'medium' : 'low';
    findings.push({
      labRunId: runId,
      companyId,
      labSlug: 'demand',
      category: 'Demand',
      dimension: 'Summary',
      severity: severity as DiagnosticFindingSeverity,
      location: report.url || undefined,
      issueKey: `demand-summary-${runId}`,
      description: report.narrativeSummary || `Demand Lab score: ${report.overallScore}/100 (${report.maturityStage || 'unknown'} maturity)`,
      recommendation: 'Review the Demand Lab report for detailed recommendations.',
      estimatedImpact: undefined,
    });
  }

  console.log('[findingsExtractors] Demand Lab extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// Ops Lab Extractor
// ============================================================================

/**
 * Map Ops Lab dimension key to a readable dimension string
 */
function mapOpsDimension(category: string | undefined): string {
  if (!category) return 'General';

  // OpsDimensionKey: 'tracking' | 'data' | 'crm' | 'automation' | 'experimentation'
  const dimensionMap: Record<string, string> = {
    'tracking': 'Tracking & Instrumentation',
    'data': 'Data Quality & Governance',
    'crm': 'CRM & Pipeline Hygiene',
    'automation': 'Automation & Journeys',
    'experimentation': 'Experimentation & Optimization',
  };

  const normalized = category.toLowerCase();
  return dimensionMap[normalized] || category;
}

/**
 * Extract findings from Ops Lab results
 *
 * Ops Lab JSON structure (OpsLabResult):
 * - issues: OpsLabIssue[] (global issues array)
 * - dimensions: OpsLabDimension[] (each has issues array)
 * - quickWins: OpsLabQuickWin[]
 * - projects: OpsLabProject[]
 *
 * OpsLabIssue: { id, category (OpsDimensionKey), severity, title, description }
 */
export function extractOpsLabFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  // Try to get the report object (might be nested under 'report' or at root)
  const report = raw.report || raw;

  const seenKeys = new Set<string>();

  // Extract from global issues array
  const issuesSources = [
    report.issues,
    // Also check dimensions for nested issues
    ...(Array.isArray(report.dimensions) ? report.dimensions.map((d: any) => d.issues) : []),
  ];

  for (const issues of issuesSources) {
    if (!Array.isArray(issues)) continue;

    for (const issue of issues) {
      const issueKey = issue.id || `ops-${issue.category || 'general'}-${issue.title || issue.description}`;

      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'ops',
        category: 'Ops',
        dimension: mapOpsDimension(issue.category),
        severity: mapSeverity(issue.severity),
        location: report.url || undefined,
        issueKey,
        description: issue.title || issue.description,
        recommendation: issue.recommendation || issue.description,
        estimatedImpact: issue.impact,
      });
    }
  }

  // If no issues found but we have a report, create a summary finding
  if (findings.length === 0 && report.overallScore !== undefined) {
    const severity = report.overallScore < 40 ? 'high' : report.overallScore < 60 ? 'medium' : 'low';
    findings.push({
      labRunId: runId,
      companyId,
      labSlug: 'ops',
      category: 'Ops',
      dimension: 'Summary',
      severity: severity as DiagnosticFindingSeverity,
      location: report.url || undefined,
      issueKey: `ops-summary-${runId}`,
      description: report.narrativeSummary || `Ops Lab score: ${report.overallScore}/100 (${report.maturityStage || 'unknown'} maturity)`,
      recommendation: 'Review the Ops Lab report for detailed recommendations.',
      estimatedImpact: undefined,
    });
  }

  console.log('[findingsExtractors] Ops Lab extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// GAP-IA Extractor
// ============================================================================

/**
 * Map GAP diagnostic category to a FindingCategory
 */
function mapGapCategory(category: string | undefined): DiagnosticFindingCategory {
  if (!category) return 'Brand';

  const normalized = category.toLowerCase();

  if (normalized.includes('brand')) return 'Brand';
  if (normalized.includes('content')) return 'Content';
  if (normalized.includes('seo')) return 'SEO';
  if (normalized.includes('website') || normalized.includes('conversion')) return 'UX';
  if (normalized.includes('technical')) return 'Technical';
  if (normalized.includes('analytics')) return 'Analytics';

  return 'Brand';
}

/**
 * Map GAP impact level to severity
 */
function mapGapImpactToSeverity(impact: string | undefined): DiagnosticFindingSeverity {
  if (!impact) return 'medium';

  const normalized = impact.toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';

  return 'medium';
}

/**
 * Extract findings from GAP-IA results
 *
 * GAP-IA JSON structure (GapIaRun / GapIaV2Result):
 * - dimensions: { brand, content, seo, website, digitalFootprint, authority }
 *   - Each dimension has: score, label, oneLiner, issues[], narrative
 * - breakdown: { bullets: BreakdownItem[] }
 *   - BreakdownItem: { category, statement, impactLevel }
 * - quickWins: { bullets: QuickWinItem[] }
 *   - QuickWinItem: { category, action, expectedImpact, effortLevel }
 */
export function extractGapIaFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  const seenKeys = new Set<string>();

  // Try to get the result object (might be at root or nested)
  const result = raw.summary ? raw : (raw.result || raw);

  // 1. Extract from dimension issues
  const dimensions = result.dimensions || {};
  const dimensionNames = ['brand', 'content', 'seo', 'website', 'digitalFootprint', 'authority'];

  for (const dimName of dimensionNames) {
    const dim = dimensions[dimName];
    if (!dim || !Array.isArray(dim.issues)) continue;

    for (const issue of dim.issues) {
      const issueText = typeof issue === 'string' ? issue : issue.description || issue.title;
      if (!issueText) continue;

      const issueKey = `gap-${dimName}-${issueText.slice(0, 50)}`;
      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      // Map dimension to category
      const category = mapGapCategory(dimName);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'gap',
        category,
        dimension: dim.label || dimName,
        severity: dim.score < 40 ? 'high' : dim.score < 60 ? 'medium' : 'low',
        location: raw.url || raw.domain,
        issueKey,
        description: issueText,
        recommendation: dim.oneLiner || undefined,
        estimatedImpact: dim.score ? `Score: ${dim.score}/100` : undefined,
      });
    }
  }

  // 2. Extract from breakdown bullets
  const breakdown = result.breakdown?.bullets || [];
  for (const item of breakdown) {
    const issueKey = `gap-breakdown-${item.category || 'general'}-${item.statement?.slice(0, 50) || ''}`;
    if (seenKeys.has(issueKey)) continue;
    seenKeys.add(issueKey);

    findings.push({
      labRunId: runId,
      companyId,
      labSlug: 'gap',
      category: mapGapCategory(item.category),
      dimension: item.category || 'General',
      severity: mapGapImpactToSeverity(item.impactLevel),
      location: raw.url || raw.domain,
      issueKey,
      description: item.statement,
      recommendation: undefined,
      estimatedImpact: item.impactLevel,
    });
  }

  // 3. Extract from quickWins as lower-severity actionable items
  const quickWins = result.quickWins?.bullets || [];
  for (const win of quickWins) {
    const issueKey = `gap-quickwin-${win.category || 'general'}-${win.action?.slice(0, 50) || ''}`;
    if (seenKeys.has(issueKey)) continue;
    seenKeys.add(issueKey);

    findings.push({
      labRunId: runId,
      companyId,
      labSlug: 'gap',
      category: mapGapCategory(win.category),
      dimension: 'Quick Win',
      severity: win.expectedImpact === 'high' ? 'medium' : 'low',
      location: raw.url || raw.domain,
      issueKey,
      description: `Quick Win: ${win.action}`,
      recommendation: win.action,
      estimatedImpact: `Impact: ${win.expectedImpact || 'medium'}, Effort: ${win.effortLevel || 'low'}`,
    });
  }

  console.log('[findingsExtractors] GAP-IA extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// GAP-Plan Extractor
// ============================================================================

/**
 * Extract findings from GAP-Plan results
 *
 * GAP-Plan focuses on priorities and initiatives rather than issues,
 * so we convert priorities into findings for tracking.
 */
export function extractGapPlanFindings(
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  const findings: CreateDiagnosticFindingInput[] = [];
  const raw = rawJson as any;

  if (!raw) return findings;

  const seenKeys = new Set<string>();

  // Extract from priorities
  const priorities = raw.priorities?.items || raw.priorities || [];
  if (Array.isArray(priorities)) {
    for (const priority of priorities) {
      const issueKey = priority.id || `gap-plan-priority-${priority.title?.slice(0, 50) || ''}`;
      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      // Map severity from GAP priority
      let severity: DiagnosticFindingSeverity = 'medium';
      if (priority.severity) {
        const sev = priority.severity.toLowerCase();
        if (sev === 'critical') severity = 'critical';
        else if (sev === 'high') severity = 'high';
        else if (sev === 'medium') severity = 'medium';
        else if (sev === 'low') severity = 'low';
      }

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'gap-plan',
        category: mapGapCategory(priority.area),
        dimension: priority.area || 'Strategic',
        severity,
        location: raw.url || raw.domain,
        issueKey,
        description: priority.title || priority.summary,
        recommendation: priority.description || priority.expectedOutcome,
        estimatedImpact: priority.impact,
      });
    }
  }

  // Extract from plan initiatives
  const initiatives = raw.plan?.initiatives || [];
  if (Array.isArray(initiatives)) {
    for (const init of initiatives) {
      const issueKey = init.id || `gap-plan-init-${init.title?.slice(0, 50) || ''}`;
      if (seenKeys.has(issueKey)) continue;
      seenKeys.add(issueKey);

      findings.push({
        labRunId: runId,
        companyId,
        labSlug: 'gap-plan',
        category: mapGapCategory(init.area),
        dimension: init.timeHorizon || 'Initiative',
        severity: 'medium',
        location: raw.url || raw.domain,
        issueKey,
        description: init.title,
        recommendation: init.summary || init.detail,
        estimatedImpact: init.impact,
      });
    }
  }

  console.log('[findingsExtractors] GAP-Plan extracted:', findings.length, 'findings');
  return findings;
}

// ============================================================================
// Unified Extractor
// ============================================================================

/**
 * Extract findings from any Lab result based on labSlug
 */
export function extractFindingsForLab(
  labSlug: string,
  runId: string,
  companyId: string,
  rawJson: unknown
): CreateDiagnosticFindingInput[] {
  switch (labSlug) {
    case 'website':
      return extractWebsiteLabFindings(runId, companyId, rawJson);
    case 'brand':
      return extractBrandLabFindings(runId, companyId, rawJson);
    case 'seo':
      return extractSeoLabFindings(runId, companyId, rawJson);
    case 'content':
      return extractContentLabFindings(runId, companyId, rawJson);
    case 'demand':
      return extractDemandLabFindings(runId, companyId, rawJson);
    case 'ops':
      return extractOpsLabFindings(runId, companyId, rawJson);
    case 'gap':
    case 'gap-ia':
      return extractGapIaFindings(runId, companyId, rawJson);
    case 'gap-plan':
      return extractGapPlanFindings(runId, companyId, rawJson);
    default:
      console.log('[findingsExtractors] No extractor for lab:', labSlug);
      return [];
  }
}
