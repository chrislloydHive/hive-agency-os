// lib/os/context/labCoverageCheck.ts
// Lab Coverage Check - verifies domain coverage after Labs run
//
// After running Labs, this module:
// 1. Checks each required domain for the chosen flow has meaningful canonical fields
// 2. If missing, marks domain as missing and suggests "Run X Lab" CTA
//
// Example: if brand_lab not run → brand.* all empty → suggest 'Run Brand Lab'

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { LAB_DOMAINS, DOMAIN_AUTHORITY, type DomainKey } from './domainAuthority';

// ============================================================================
// Types
// ============================================================================

export type LabKey =
  | 'brand_lab'
  | 'website_lab'
  | 'seo_lab'
  | 'content_lab'
  | 'ops_lab'
  | 'demand_lab'
  | 'audience_lab'
  | 'media_lab'
  | 'competition_lab';

export interface DomainCoverageResult {
  domain: DomainKey;
  hasMeaningfulData: boolean;
  fieldsCovered: string[];
  fieldsMissing: string[];
  coveragePercent: number;
  canonicalLab: LabKey | null;
  suggestedAction?: string;
}

export interface LabCoverageReport {
  timestamp: string;
  companyId: string;
  totalDomains: number;
  coveredDomains: number;
  missingDomains: DomainKey[];
  domainResults: DomainCoverageResult[];
  suggestedLabs: Array<{
    lab: LabKey;
    reason: string;
    domains: DomainKey[];
  }>;
  overallCoverage: number;
}

// ============================================================================
// Configuration: Required Fields per Domain
// ============================================================================

/**
 * Minimum required fields per domain to be considered "covered"
 * If a domain has at least one of these fields with meaningful data, it's covered
 */
const DOMAIN_REQUIRED_FIELDS: Partial<Record<DomainKey, string[]>> = {
  brand: ['brandScore', 'brandSummary', 'brandPerception', 'brandVoice', 'visualIdentity'],
  website: ['websiteScore', 'websiteSummary', 'currentSiteUrl', 'websiteStrengths', 'websiteIssues'],
  seo: ['seoScore', 'seoSummary', 'technicalSeo', 'keywordStrategy', 'backlinks'],
  content: ['contentScore', 'contentSummary', 'contentPillars', 'contentGaps', 'contentStrengths'],
  audience: ['audienceScore', 'audienceSummary', 'primaryAudience', 'audienceSegments'],
  competitive: ['competitorCount', 'competitiveSummary', 'competitors', 'competitivePosition'],
  performanceMedia: ['demandScore', 'demandSummary', 'channelPerformance', 'conversionMetrics'],
  ops: ['opsScore', 'opsSummary', 'teamStructure', 'processMaturity', 'toolStack'],
  identity: ['businessName', 'industry', 'domain'],
  objectives: ['primaryBusinessGoal', 'kpiLabels', 'targetMetrics'],
};

/**
 * Map from Lab key to the domains it populates
 */
const LAB_TO_DOMAINS: Record<LabKey, DomainKey[]> = {
  brand_lab: ['brand'],
  website_lab: ['website'],
  seo_lab: ['seo'],
  content_lab: ['content'],
  ops_lab: ['ops'],
  demand_lab: ['performanceMedia', 'audience'],
  audience_lab: ['audience'],
  media_lab: ['performanceMedia'],
  competition_lab: ['competitive'],
};

/**
 * Human-readable lab names for CTAs
 */
const LAB_DISPLAY_NAMES: Record<LabKey, string> = {
  brand_lab: 'Brand Lab',
  website_lab: 'Website Lab',
  seo_lab: 'SEO Lab',
  content_lab: 'Content Lab',
  ops_lab: 'Ops Lab',
  demand_lab: 'Demand Lab',
  audience_lab: 'Audience Lab',
  media_lab: 'Media Lab',
  competition_lab: 'Competition Lab',
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a value is meaningful (not empty/placeholder)
 */
function isMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;

  // Check for placeholder text
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('[placeholder]')) return false;
    if (lower.includes('n/a') && lower.length < 10) return false;
    if (lower.includes('not available')) return false;
    if (lower.includes('to be determined')) return false;
    if (lower.includes('unknown')) return false;
  }

  return true;
}

/**
 * Get the canonical Lab for a domain
 */
function getCanonicalLabForDomain(domain: DomainKey): LabKey | null {
  const authority = DOMAIN_AUTHORITY[domain];
  if (!authority?.canonicalSource) return null;

  const source = authority.canonicalSource;
  if (source.endsWith('_lab') && Object.keys(LAB_TO_DOMAINS).includes(source)) {
    return source as LabKey;
  }
  return null;
}

/**
 * Extract field values from a domain in the context graph
 */
function getDomainFieldValues(
  graph: CompanyContextGraph,
  domain: DomainKey
): Record<string, unknown> {
  const domainData = (graph as Record<string, unknown>)[domain];
  if (!domainData || typeof domainData !== 'object') return {};

  const fieldValues: Record<string, unknown> = {};
  for (const [fieldName, fieldData] of Object.entries(domainData as Record<string, unknown>)) {
    if (fieldData && typeof fieldData === 'object' && 'value' in (fieldData as object)) {
      fieldValues[fieldName] = (fieldData as { value: unknown }).value;
    } else {
      fieldValues[fieldName] = fieldData;
    }
  }
  return fieldValues;
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Check coverage for a single domain
 */
export function checkDomainCoverage(
  graph: CompanyContextGraph,
  domain: DomainKey
): DomainCoverageResult {
  const requiredFields = DOMAIN_REQUIRED_FIELDS[domain] || [];
  const fieldValues = getDomainFieldValues(graph, domain);

  const fieldsCovered: string[] = [];
  const fieldsMissing: string[] = [];

  for (const field of requiredFields) {
    const value = fieldValues[field];
    if (isMeaningfulValue(value)) {
      fieldsCovered.push(field);
    } else {
      fieldsMissing.push(field);
    }
  }

  const coveragePercent = requiredFields.length > 0
    ? Math.round((fieldsCovered.length / requiredFields.length) * 100)
    : 0;

  const hasMeaningfulData = fieldsCovered.length > 0;
  const canonicalLab = getCanonicalLabForDomain(domain);

  const result: DomainCoverageResult = {
    domain,
    hasMeaningfulData,
    fieldsCovered,
    fieldsMissing,
    coveragePercent,
    canonicalLab,
  };

  // Add suggested action if domain is not covered
  if (!hasMeaningfulData && canonicalLab) {
    result.suggestedAction = `Run ${LAB_DISPLAY_NAMES[canonicalLab]} to populate ${domain} data`;
  }

  return result;
}

/**
 * Check coverage for all Lab domains
 * Returns a comprehensive report of which domains need Lab runs
 */
export function checkLabCoverage(
  graph: CompanyContextGraph,
  companyId: string,
  requiredDomains?: DomainKey[]
): LabCoverageReport {
  // Default to all Lab domains if not specified
  const domainsToCheck = requiredDomains || (Object.keys(LAB_DOMAINS) as DomainKey[]);

  const domainResults: DomainCoverageResult[] = [];
  const missingDomains: DomainKey[] = [];

  for (const domain of domainsToCheck) {
    const result = checkDomainCoverage(graph, domain);
    domainResults.push(result);

    if (!result.hasMeaningfulData) {
      missingDomains.push(domain);
    }
  }

  // Group missing domains by suggested Lab
  const labSuggestions: Map<LabKey, DomainKey[]> = new Map();
  for (const domain of missingDomains) {
    const lab = getCanonicalLabForDomain(domain);
    if (lab) {
      const domains = labSuggestions.get(lab) || [];
      domains.push(domain);
      labSuggestions.set(lab, domains);
    }
  }

  const suggestedLabs = Array.from(labSuggestions.entries()).map(([lab, domains]) => ({
    lab,
    reason: `${LAB_DISPLAY_NAMES[lab]} populates: ${domains.join(', ')}`,
    domains,
  }));

  const coveredDomains = domainResults.filter(r => r.hasMeaningfulData).length;
  const overallCoverage = domainsToCheck.length > 0
    ? Math.round((coveredDomains / domainsToCheck.length) * 100)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    companyId,
    totalDomains: domainsToCheck.length,
    coveredDomains,
    missingDomains,
    domainResults,
    suggestedLabs,
    overallCoverage,
  };
}

/**
 * Get CTAs for missing Labs based on coverage check
 * Returns user-facing suggestions for which Labs to run
 */
export function getLabCTAs(report: LabCoverageReport): Array<{
  labKey: LabKey;
  displayName: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}> {
  return report.suggestedLabs.map(suggestion => {
    // Prioritize based on number of domains affected
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (suggestion.domains.length >= 2) {
      priority = 'high';
    } else if (suggestion.domains.length === 1) {
      // Some domains are more critical
      const criticalDomains: DomainKey[] = ['brand', 'website', 'audience'];
      if (suggestion.domains.some(d => criticalDomains.includes(d))) {
        priority = 'medium';
      }
    }

    return {
      labKey: suggestion.lab,
      displayName: LAB_DISPLAY_NAMES[suggestion.lab],
      reason: suggestion.reason,
      priority,
    };
  }).sort((a, b) => {
    // Sort by priority: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Check if a specific flow has required domains covered
 * Different flows may require different domains
 */
export function checkFlowReadiness(
  graph: CompanyContextGraph,
  companyId: string,
  flowType: 'gap_full' | 'gap_ia' | 'brief_generation' | 'strategy_generation'
): {
  ready: boolean;
  missingDomains: DomainKey[];
  suggestedLabs: LabKey[];
  report: LabCoverageReport;
} {
  // Define required domains per flow type
  const flowRequirements: Record<string, DomainKey[]> = {
    gap_full: ['brand', 'website', 'seo', 'content', 'audience', 'competitive'],
    gap_ia: ['identity', 'objectives'],
    brief_generation: ['brand', 'audience', 'objectives'],
    strategy_generation: ['identity', 'objectives', 'brand', 'audience'],
  };

  const requiredDomains = flowRequirements[flowType] || [];
  const report = checkLabCoverage(graph, companyId, requiredDomains);

  const suggestedLabs = report.suggestedLabs.map(s => s.lab);

  return {
    ready: report.missingDomains.length === 0,
    missingDomains: report.missingDomains,
    suggestedLabs,
    report,
  };
}

export default {
  checkDomainCoverage,
  checkLabCoverage,
  getLabCTAs,
  checkFlowReadiness,
};
