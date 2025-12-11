// lib/os/findings/standardizeFindings.ts
// Standardize findings from all labs into consistent format

import type {
  Finding,
  FindingCategory,
  FindingDimension,
  FindingSeverity,
  FindingImpact,
  FindingLocation,
  LabSlug,
  StandardizationResult,
} from './types';
import {
  SEVERITY_RULES,
  CATEGORY_MAPPINGS,
  DIMENSION_MAPPINGS,
  ISSUE_KEYS,
} from './types';

/**
 * Generate a unique finding ID
 */
function generateFindingId(labSlug: LabSlug, issueKey: string, location?: string): string {
  const base = `${labSlug}-${issueKey}`;
  const locationHash = location ? `-${hashString(location).toString(36)}` : '';
  const timestamp = Date.now().toString(36);
  return `${base}${locationHash}-${timestamp}`;
}

/**
 * Simple string hash for deduplication
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Compute text similarity (simple Jaccard similarity)
 */
function computeSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Infer category from issue key or content
 */
function inferCategory(issueKey: string, description: string): FindingCategory {
  // Check issue key prefixes
  const prefix = issueKey.split('-')[0];
  if (CATEGORY_MAPPINGS[prefix]) {
    return CATEGORY_MAPPINGS[prefix];
  }

  // Infer from description keywords
  const desc = description.toLowerCase();
  if (desc.includes('google business') || desc.includes('gbp') || desc.includes('listing')) {
    return 'listings';
  }
  if (desc.includes('social') || desc.includes('facebook') || desc.includes('instagram')) {
    return 'social';
  }
  if (desc.includes('website') || desc.includes('page') || desc.includes('site')) {
    return 'website';
  }
  if (desc.includes('review') || desc.includes('rating') || desc.includes('reputation')) {
    return 'reputation';
  }
  if (desc.includes('schema') || desc.includes('technical') || desc.includes('seo')) {
    return 'technical';
  }
  if (desc.includes('content') || desc.includes('blog') || desc.includes('article')) {
    return 'content';
  }
  if (desc.includes('competitor') || desc.includes('competition')) {
    return 'competitive';
  }

  return 'seo'; // Default fallback
}

/**
 * Infer dimension from issue key or content
 */
function inferDimension(issueKey: string, description: string): FindingDimension {
  const desc = description.toLowerCase();
  const key = issueKey.toLowerCase();

  // Check for dimension keywords
  for (const [keyword, dimension] of Object.entries(DIMENSION_MAPPINGS)) {
    if (key.includes(keyword) || desc.includes(keyword)) {
      return dimension;
    }
  }

  // Additional inference
  if (desc.includes('not found') || desc.includes('missing') || desc.includes('no ')) {
    return 'presence';
  }
  if (desc.includes('wrong') || desc.includes('incorrect') || desc.includes('outdated')) {
    return 'accuracy';
  }
  if (desc.includes('partial') || desc.includes('incomplete') || desc.includes('empty')) {
    return 'completeness';
  }
  if (desc.includes('different') || desc.includes('mismatch') || desc.includes('inconsistent')) {
    return 'consistency';
  }
  if (desc.includes('slow') || desc.includes('speed') || desc.includes('performance')) {
    return 'performance';
  }

  return 'completeness'; // Default
}

/**
 * Infer severity from issue key or content
 */
function inferSeverity(issueKey: string, description: string): FindingSeverity {
  // Check predefined rules
  if (SEVERITY_RULES[issueKey]) {
    return SEVERITY_RULES[issueKey];
  }

  const desc = description.toLowerCase();

  // Critical indicators
  if (desc.includes('not indexed') || desc.includes('blocked') || desc.includes('no ssl') ||
      desc.includes('site down') || desc.includes('critical')) {
    return 'critical';
  }

  // High indicators
  if (desc.includes('not claimed') || desc.includes('major issue') || desc.includes('significantly') ||
      desc.includes('negative review') || desc.includes('incorrect address')) {
    return 'high';
  }

  // Medium indicators
  if (desc.includes('missing') || desc.includes('incomplete') || desc.includes('outdated') ||
      desc.includes('should have') || desc.includes('recommended')) {
    return 'medium';
  }

  // Low indicators
  if (desc.includes('could improve') || desc.includes('consider') || desc.includes('minor') ||
      desc.includes('optional')) {
    return 'low';
  }

  return 'medium'; // Default
}

/**
 * Estimate impact based on finding characteristics
 */
function estimateImpact(
  category: FindingCategory,
  severity: FindingSeverity,
  issueKey: string
): FindingImpact {
  // Impact level based on severity
  const levelMap: Record<FindingSeverity, 'high' | 'medium' | 'low'> = {
    critical: 'high',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'low',
  };

  // Effort estimation
  let effort: 'quick' | 'moderate' | 'significant' = 'moderate';

  // Quick fixes
  const quickFixes = [
    ISSUE_KEYS.GBP_INCOMPLETE_HOURS,
    ISSUE_KEYS.GBP_MISSING_PHOTOS,
    ISSUE_KEYS.WEBSITE_MISSING_META,
    ISSUE_KEYS.SOCIAL_MISSING_LINK,
  ];

  // Significant effort
  const significantEffort = [
    ISSUE_KEYS.WEBSITE_NOT_MOBILE,
    ISSUE_KEYS.CONTENT_THIN,
    ISSUE_KEYS.TECHNICAL_REDIRECT_CHAIN,
    ISSUE_KEYS.SCHEMA_MISSING,
  ];

  if ((quickFixes as string[]).includes(issueKey)) {
    effort = 'quick';
  } else if ((significantEffort as string[]).includes(issueKey)) {
    effort = 'significant';
  }

  // Metric affected
  let metric: string | undefined;
  switch (category) {
    case 'listings':
      metric = 'local-visibility';
      break;
    case 'social':
      metric = 'engagement';
      break;
    case 'website':
      metric = 'user-experience';
      break;
    case 'reputation':
      metric = 'trust';
      break;
    case 'technical':
      metric = 'indexability';
      break;
    case 'content':
      metric = 'rankings';
      break;
    case 'competitive':
      metric = 'market-position';
      break;
    default:
      metric = 'visibility';
  }

  // Results timeline
  let resultsTimeline: 'immediate' | 'weeks' | 'months' = 'weeks';
  if (effort === 'quick' && severity === 'critical') {
    resultsTimeline = 'immediate';
  } else if (effort === 'significant' || category === 'content') {
    resultsTimeline = 'months';
  }

  return {
    level: levelMap[severity],
    metric,
    effort,
    resultsTimeline,
  };
}

/**
 * Extract location from raw data
 */
function extractLocation(rawData: unknown): FindingLocation {
  const location: FindingLocation = {};

  if (typeof rawData === 'object' && rawData !== null) {
    const data = rawData as Record<string, unknown>;

    if (typeof data.url === 'string') location.url = data.url;
    if (typeof data.path === 'string') location.path = data.path;
    if (typeof data.platform === 'string') location.platform = data.platform;
    if (typeof data.element === 'string') location.element = data.element;
    if (typeof data.line === 'number') location.line = data.line;

    // Try alternate field names
    if (!location.url && typeof data.pageUrl === 'string') location.url = data.pageUrl;
    if (!location.platform && typeof data.source === 'string') location.platform = data.source;
  }

  return location;
}

/**
 * Standardize a single raw finding
 */
function standardizeSingleFinding(
  labSlug: LabSlug,
  rawData: unknown,
  index: number
): Finding | null {
  try {
    const data = typeof rawData === 'object' && rawData !== null
      ? rawData as Record<string, unknown>
      : { value: rawData };

    // Extract core fields
    const issueKey = (typeof data.issueKey === 'string' ? data.issueKey :
                     typeof data.key === 'string' ? data.key :
                     typeof data.type === 'string' ? data.type :
                     `${labSlug}-issue-${index}`) as string;

    const description = (typeof data.description === 'string' ? data.description :
                        typeof data.message === 'string' ? data.message :
                        typeof data.issue === 'string' ? data.issue :
                        typeof data.text === 'string' ? data.text :
                        `Issue detected in ${labSlug} analysis`) as string;

    const recommendation = (typeof data.recommendation === 'string' ? data.recommendation :
                           typeof data.fix === 'string' ? data.fix :
                           typeof data.action === 'string' ? data.action :
                           typeof data.suggestion === 'string' ? data.suggestion :
                           `Review and address this ${labSlug} issue`) as string;

    const confidence = (typeof data.confidence === 'number' ? data.confidence :
                       typeof data.score === 'number' ? data.score : 70);

    // Infer structured fields
    const category = (typeof data.category === 'string' ? data.category as FindingCategory :
                     inferCategory(issueKey, description));

    const dimension = (typeof data.dimension === 'string' ? data.dimension as FindingDimension :
                      inferDimension(issueKey, description));

    const severity = (typeof data.severity === 'string' ? data.severity as FindingSeverity :
                     inferSeverity(issueKey, description));

    const location = extractLocation(rawData);
    const estimatedImpact = estimateImpact(category, severity, issueKey);

    // Extract tags
    const tags: string[] = [];
    if (Array.isArray(data.tags)) {
      tags.push(...data.tags.filter((t): t is string => typeof t === 'string'));
    }
    if (typeof data.tag === 'string') {
      tags.push(data.tag);
    }

    return {
      id: generateFindingId(labSlug, issueKey, location.url),
      labSlug,
      category,
      dimension,
      severity,
      location,
      issueKey,
      description,
      recommendation,
      estimatedImpact,
      confidence: Math.min(100, Math.max(0, confidence)),
      rawData,
      detectedAt: new Date().toISOString(),
      tags: tags.length > 0 ? tags : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Parse summary text into findings when structured data is missing
 */
function parseSummaryText(labSlug: LabSlug, summaryText: string): Finding[] {
  const findings: Finding[] = [];

  // Split by common delimiters
  const lines = summaryText.split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.match(/^[-=*]+$/));

  // Look for bullet points or numbered items
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers
    if (line.match(/^#+\s/) || line.match(/^(summary|overview|findings|issues):/i)) {
      continue;
    }

    // Check if it's a finding-like line
    const cleanLine = line.replace(/^[\d\.\-\*\•]\s*/, '').trim();
    if (cleanLine.length < 10) continue;

    // Extract issue key from common patterns
    let issueKey = `${labSlug}-parsed-${i}`;
    const keyMatch = cleanLine.match(/^(\w+[\-_]\w+):/);
    if (keyMatch) {
      issueKey = keyMatch[1].toLowerCase();
    }

    const finding = standardizeSingleFinding(labSlug, {
      description: cleanLine,
      issueKey,
    }, i);

    if (finding) {
      findings.push(finding);
    }
  }

  return findings;
}

/**
 * Merge duplicate findings
 */
function mergeDuplicates(findings: Finding[]): { merged: Finding[]; mergeCount: number } {
  const merged: Finding[] = [];
  const seen = new Map<string, Finding>();
  let mergeCount = 0;

  for (const finding of findings) {
    // Check for exact issueKey match
    const keyMatch = seen.get(finding.issueKey);
    if (keyMatch) {
      // Merge: keep higher confidence, combine sources
      if (finding.confidence > keyMatch.confidence) {
        seen.set(finding.issueKey, {
          ...finding,
          tags: [...new Set([...(keyMatch.tags || []), ...(finding.tags || [])])],
        });
      }
      mergeCount++;
      continue;
    }

    // Check for similar descriptions
    let foundSimilar = false;
    for (const [key, existing] of seen) {
      const similarity = computeSimilarity(finding.description, existing.description);
      if (similarity > 0.8) {
        // Very similar - merge
        if (finding.confidence > existing.confidence) {
          seen.set(key, {
            ...finding,
            tags: [...new Set([...(existing.tags || []), ...(finding.tags || [])])],
          });
        }
        mergeCount++;
        foundSimilar = true;
        break;
      }
    }

    if (!foundSimilar) {
      seen.set(finding.issueKey, finding);
    }
  }

  merged.push(...seen.values());
  return { merged, mergeCount };
}

/**
 * Sort findings by severity and impact
 */
function sortFindings(findings: Finding[]): Finding[] {
  const severityOrder: Record<FindingSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return [...findings].sort((a, b) => {
    // First by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by confidence (higher first)
    const confidenceDiff = b.confidence - a.confidence;
    if (confidenceDiff !== 0) return confidenceDiff;

    // Then by impact level
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.estimatedImpact.level] - impactOrder[b.estimatedImpact.level];
  });
}

/**
 * Main standardization function
 *
 * Input: raw lab result (any shape from any lab), optional summaryText
 * Output: Array<Finding> with standardized fields
 */
export function standardizeFindings(
  labSlug: LabSlug,
  rawResult: unknown,
  summaryText?: string
): StandardizationResult {
  const warnings: string[] = [];
  let rawItems: unknown[] = [];

  // Extract raw items from various result shapes
  if (Array.isArray(rawResult)) {
    rawItems = rawResult;
  } else if (typeof rawResult === 'object' && rawResult !== null) {
    const result = rawResult as Record<string, unknown>;

    // Try common field names
    if (Array.isArray(result.findings)) {
      rawItems = result.findings;
    } else if (Array.isArray(result.issues)) {
      rawItems = result.issues;
    } else if (Array.isArray(result.results)) {
      rawItems = result.results;
    } else if (Array.isArray(result.items)) {
      rawItems = result.items;
    } else if (Array.isArray(result.data)) {
      rawItems = result.data;
    } else {
      // Treat the whole object as a single finding
      rawItems = [rawResult];
    }
  } else if (rawResult !== undefined && rawResult !== null) {
    rawItems = [rawResult];
  }

  // Standardize each item
  let findings: Finding[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const finding = standardizeSingleFinding(labSlug, rawItems[i], i);
    if (finding) {
      findings.push(finding);
    } else {
      warnings.push(`Failed to standardize item ${i} from ${labSlug}`);
    }
  }

  // If no findings but have summary text, parse it
  if (findings.length === 0 && summaryText) {
    findings = parseSummaryText(labSlug, summaryText);
    if (findings.length > 0) {
      warnings.push(`Parsed ${findings.length} findings from summary text`);
    }
  }

  // Merge duplicates
  const { merged, mergeCount } = mergeDuplicates(findings);

  // Sort by severity and impact
  const sorted = sortFindings(merged);

  return {
    findings: sorted,
    rawCount: rawItems.length,
    standardizedCount: sorted.length,
    mergedCount: mergeCount,
    warnings,
  };
}

/**
 * Standardize findings from multiple labs
 */
export function standardizeMultipleLabFindings(
  labResults: Array<{ labSlug: LabSlug; rawResult: unknown; summaryText?: string }>
): StandardizationResult {
  const allFindings: Finding[] = [];
  const allWarnings: string[] = [];
  let totalRaw = 0;
  let totalMerged = 0;

  for (const { labSlug, rawResult, summaryText } of labResults) {
    const result = standardizeFindings(labSlug, rawResult, summaryText);
    allFindings.push(...result.findings);
    allWarnings.push(...result.warnings.map(w => `[${labSlug}] ${w}`));
    totalRaw += result.rawCount;
    totalMerged += result.mergedCount;
  }

  // Cross-lab deduplication
  const { merged, mergeCount } = mergeDuplicates(allFindings);
  totalMerged += mergeCount;

  // Final sort
  const sorted = sortFindings(merged);

  return {
    findings: sorted,
    rawCount: totalRaw,
    standardizedCount: sorted.length,
    mergedCount: totalMerged,
    warnings: allWarnings,
  };
}

/**
 * Filter findings by criteria
 */
export function filterFindings(
  findings: Finding[],
  criteria: {
    labSlug?: LabSlug;
    category?: FindingCategory;
    dimension?: FindingDimension;
    severity?: FindingSeverity | FindingSeverity[];
    minConfidence?: number;
    tags?: string[];
  }
): Finding[] {
  return findings.filter(f => {
    if (criteria.labSlug && f.labSlug !== criteria.labSlug) return false;
    if (criteria.category && f.category !== criteria.category) return false;
    if (criteria.dimension && f.dimension !== criteria.dimension) return false;

    if (criteria.severity) {
      const severities = Array.isArray(criteria.severity) ? criteria.severity : [criteria.severity];
      if (!severities.includes(f.severity)) return false;
    }

    if (criteria.minConfidence && f.confidence < criteria.minConfidence) return false;

    if (criteria.tags && criteria.tags.length > 0) {
      const findingTags = f.tags || [];
      if (!criteria.tags.some(t => findingTags.includes(t))) return false;
    }

    return true;
  });
}

/**
 * Group findings by a field
 */
export function groupFindings<K extends keyof Finding>(
  findings: Finding[],
  field: K
): Map<Finding[K], Finding[]> {
  const groups = new Map<Finding[K], Finding[]>();

  for (const finding of findings) {
    const key = finding[field];
    const existing = groups.get(key) || [];
    existing.push(finding);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Get findings summary statistics
 */
export function getFindingsSummary(findings: Finding[]): {
  total: number;
  bySeverity: Record<FindingSeverity, number>;
  byCategory: Record<FindingCategory, number>;
  byLab: Record<LabSlug, number>;
  criticalCount: number;
  highImpactCount: number;
  averageConfidence: number;
} {
  const bySeverity: Record<FindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byCategory: Record<FindingCategory, number> = {
    seo: 0,
    listings: 0,
    social: 0,
    website: 0,
    reputation: 0,
    content: 0,
    technical: 0,
    competitive: 0,
  };

  const byLab: Partial<Record<LabSlug, number>> = {};
  let totalConfidence = 0;
  let highImpactCount = 0;

  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byCategory[finding.category]++;
    byLab[finding.labSlug] = (byLab[finding.labSlug] || 0) + 1;
    totalConfidence += finding.confidence;
    if (finding.estimatedImpact.level === 'high') {
      highImpactCount++;
    }
  }

  return {
    total: findings.length,
    bySeverity,
    byCategory,
    byLab: byLab as Record<LabSlug, number>,
    criticalCount: bySeverity.critical,
    highImpactCount,
    averageConfidence: findings.length > 0 ? totalConfidence / findings.length : 0,
  };
}
