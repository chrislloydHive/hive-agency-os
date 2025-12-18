// lib/os/flow/readiness.shared.ts
// Client-safe types and pure functions for Flow Readiness
// These can be safely imported in client components without pulling in server-only code

import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import type { DomainKey } from '@/lib/os/context/domainAuthority';

// ============================================================================
// Types (client-safe)
// ============================================================================

/**
 * Flow types that can be gated
 */
export type FlowType = 'strategy' | 'gap_ia' | 'gap_full' | 'programs' | 'website_optimization';

/**
 * Lab CTA for missing data
 */
export interface LabCTA {
  labKey: string;
  labName: string;
  domain: DomainKey;
  description: string;
  action: 'run' | 'rerun' | 'view';
  href: string;
  priority: 'critical' | 'recommended' | 'optional';
}

/**
 * Domain requirement status
 */
export interface DomainRequirement {
  domain: DomainKey;
  label: string;
  required: boolean;
  present: boolean;
  hasCanonicalData: boolean;
  sourceLabKey: string | null;
  lastUpdated: string | null;
}

/**
 * Flow readiness result
 */
export interface FlowReadiness {
  flow: FlowType;
  isReady: boolean;
  completenessPercent: number;
  requirements: DomainRequirement[];
  missingCritical: DomainRequirement[];
  missingRecommended: DomainRequirement[];
  labCTAs: LabCTA[];
  canProceedAnyway: boolean;
  proceedAnywayWarning: string | null;
}

// ============================================================================
// Flow Requirements Configuration
// ============================================================================

/**
 * Domain requirements per flow type
 * critical: Must have data to proceed
 * recommended: Should have data for quality output
 * optional: Nice to have
 */
export const FLOW_REQUIREMENTS: Record<FlowType, Record<DomainKey, 'critical' | 'recommended' | 'optional'>> = {
  strategy: {
    identity: 'critical',
    brand: 'recommended',
    audience: 'recommended',
    productOffer: 'recommended',
    competitive: 'recommended',
    website: 'optional',
    seo: 'optional',
    content: 'optional',
    objectives: 'optional',
    budgetOps: 'optional',
    operationalConstraints: 'optional',
    digitalInfra: 'optional',
    ops: 'optional',
    performanceMedia: 'optional',
    capabilities: 'optional',
  },
  gap_ia: {
    identity: 'critical',
    brand: 'critical',
    website: 'critical',
    audience: 'recommended',
    productOffer: 'recommended',
    competitive: 'optional',
    seo: 'optional',
    content: 'optional',
    objectives: 'optional',
    budgetOps: 'optional',
    operationalConstraints: 'optional',
    digitalInfra: 'optional',
    ops: 'optional',
    performanceMedia: 'optional',
    capabilities: 'optional',
  },
  gap_full: {
    identity: 'critical',
    brand: 'critical',
    website: 'critical',
    seo: 'critical',
    content: 'recommended',
    audience: 'recommended',
    productOffer: 'recommended',
    competitive: 'recommended',
    objectives: 'recommended',
    budgetOps: 'optional',
    operationalConstraints: 'optional',
    digitalInfra: 'optional',
    ops: 'optional',
    performanceMedia: 'optional',
    capabilities: 'optional',
  },
  programs: {
    identity: 'critical',
    brand: 'recommended',
    website: 'recommended',
    objectives: 'recommended',
    competitive: 'optional',
    audience: 'optional',
    productOffer: 'optional',
    seo: 'optional',
    content: 'optional',
    budgetOps: 'optional',
    operationalConstraints: 'optional',
    digitalInfra: 'optional',
    ops: 'optional',
    performanceMedia: 'optional',
    capabilities: 'optional',
  },
  website_optimization: {
    identity: 'critical',
    website: 'critical',
    brand: 'recommended',
    seo: 'recommended',
    audience: 'recommended',
    content: 'recommended',
    productOffer: 'optional',
    competitive: 'optional',
    objectives: 'optional',
    budgetOps: 'optional',
    operationalConstraints: 'optional',
    digitalInfra: 'optional',
    ops: 'optional',
    performanceMedia: 'optional',
    capabilities: 'optional',
  },
};

/**
 * Domain to Lab mapping
 */
export const DOMAIN_TO_LAB: Record<DomainKey, { labKey: string; labName: string } | null> = {
  identity: null, // User-provided
  brand: { labKey: 'brand_lab', labName: 'Brand Lab' },
  audience: { labKey: 'audience_lab', labName: 'Audience Lab' },
  productOffer: { labKey: 'brand_lab', labName: 'Brand Lab' },
  website: { labKey: 'website_lab', labName: 'Website Lab' },
  seo: { labKey: 'seo_lab', labName: 'SEO Lab' },
  content: { labKey: 'content_lab', labName: 'Content Lab' },
  competitive: { labKey: 'competition_lab', labName: 'Competition Lab' },
  objectives: null, // User-provided
  budgetOps: null, // User-provided
  operationalConstraints: null, // User-provided
  digitalInfra: { labKey: 'website_lab', labName: 'Website Lab' },
  ops: { labKey: 'ops_lab', labName: 'Ops Lab' },
  performanceMedia: { labKey: 'demand_lab', labName: 'Demand Lab' },
  capabilities: null, // Hive Brain config
};

/**
 * Domain labels
 */
export const DOMAIN_LABELS: Record<DomainKey, string> = {
  identity: 'Business Identity',
  brand: 'Brand & Positioning',
  audience: 'Target Audience',
  productOffer: 'Product/Offer',
  website: 'Website Assessment',
  seo: 'SEO Analysis',
  content: 'Content Analysis',
  competitive: 'Competitive Landscape',
  objectives: 'Business Objectives',
  budgetOps: 'Budget',
  operationalConstraints: 'Constraints',
  digitalInfra: 'Digital Infrastructure',
  ops: 'Marketing Ops',
  performanceMedia: 'Demand Generation',
  capabilities: 'Execution Capabilities',
};

// ============================================================================
// Domain Check Helpers (client-safe - pure functions)
// ============================================================================

/**
 * Check if a domain has canonical data in the graph
 */
export function hasDomainData(graph: CompanyContextGraph, domain: DomainKey): boolean {
  const domainData = graph[domain];
  if (!domainData) return false;

  // Check for meaningful data (not just empty objects)
  if (typeof domainData === 'object') {
    const entries = Object.entries(domainData);
    // Need at least one field with a non-null value
    return entries.some(([key, field]) => {
      if (key === 'meta' || key === '__typename') return false;
      if (field && typeof field === 'object' && 'value' in field) {
        const val = (field as { value: unknown }).value;
        if (val === null || val === undefined) return false;
        if (Array.isArray(val)) return val.length > 0;
        if (typeof val === 'string') return val.trim() !== '';
        return true;
      }
      return false;
    });
  }

  return false;
}

/**
 * Get the source lab from provenance
 */
export function getSourceLab(graph: CompanyContextGraph, domain: DomainKey): string | null {
  const domainData = graph[domain];
  if (!domainData || typeof domainData !== 'object') return null;

  // Look for provenance in any field
  for (const [key, field] of Object.entries(domainData)) {
    if (key === 'meta') continue;
    if (field && typeof field === 'object' && 'provenance' in field) {
      const provenance = (field as { provenance: Array<{ source: string }> }).provenance;
      if (provenance && provenance.length > 0) {
        return provenance[0].source;
      }
    }
  }

  return null;
}

/**
 * Get the last updated timestamp for a domain
 */
export function getLastUpdated(graph: CompanyContextGraph, domain: DomainKey): string | null {
  const domainData = graph[domain];
  if (!domainData || typeof domainData !== 'object') return null;

  let latestDate: string | null = null;

  for (const [key, field] of Object.entries(domainData)) {
    if (key === 'meta') continue;
    if (field && typeof field === 'object' && 'provenance' in field) {
      const provenance = (field as { provenance: Array<{ updatedAt?: string }> }).provenance;
      if (provenance && provenance.length > 0 && provenance[0].updatedAt) {
        if (!latestDate || provenance[0].updatedAt > latestDate) {
          latestDate = provenance[0].updatedAt;
        }
      }
    }
  }

  return latestDate;
}

/**
 * Deduplicate Lab CTAs (same lab may serve multiple domains)
 */
export function deduplicateLabCTAs(ctas: LabCTA[]): LabCTA[] {
  const seen = new Map<string, LabCTA>();

  for (const cta of ctas) {
    const existing = seen.get(cta.labKey);
    if (!existing) {
      seen.set(cta.labKey, cta);
    } else if (cta.priority === 'critical' && existing.priority !== 'critical') {
      // Upgrade priority
      seen.set(cta.labKey, cta);
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// Main Readiness Functions (client-safe - pure functions)
// ============================================================================

/**
 * Check flow readiness from an existing graph (sync, client-safe version)
 * NOTE: This version does not log events. Use the server-side version for logging.
 */
export function checkFlowReadinessFromGraph(
  graph: CompanyContextGraph,
  flow: FlowType,
  companyId: string
): FlowReadiness {
  const flowReqs = FLOW_REQUIREMENTS[flow];
  const requirements: DomainRequirement[] = [];
  const missingCritical: DomainRequirement[] = [];
  const missingRecommended: DomainRequirement[] = [];
  const labCTAs: LabCTA[] = [];

  // Check each domain
  for (const [domain, importance] of Object.entries(flowReqs) as [DomainKey, 'critical' | 'recommended' | 'optional'][]) {
    if (importance === 'optional') continue;

    const hasData = hasDomainData(graph, domain);
    const sourceLab = getSourceLab(graph, domain);
    const lastUpdated = getLastUpdated(graph, domain);
    const labInfo = DOMAIN_TO_LAB[domain];

    const req: DomainRequirement = {
      domain,
      label: DOMAIN_LABELS[domain],
      required: importance === 'critical',
      present: hasData,
      hasCanonicalData: hasData && sourceLab !== null,
      sourceLabKey: sourceLab,
      lastUpdated,
    };

    requirements.push(req);

    if (!hasData) {
      if (importance === 'critical') {
        missingCritical.push(req);
      } else if (importance === 'recommended') {
        missingRecommended.push(req);
      }

      // Add Lab CTA if available
      if (labInfo) {
        labCTAs.push({
          labKey: labInfo.labKey,
          labName: labInfo.labName,
          domain,
          description: `Run ${labInfo.labName} to populate ${DOMAIN_LABELS[domain]}`,
          action: 'run',
          href: `/c/${companyId}/diagnostics/${labInfo.labKey.replace('_lab', '')}`,
          priority: importance === 'critical' ? 'critical' : 'recommended',
        });
      }
    }
  }

  // Calculate completeness
  const totalRequired = requirements.filter(r => r.required).length;
  const presentRequired = requirements.filter(r => r.required && r.present).length;
  const completenessPercent = totalRequired > 0
    ? Math.round((presentRequired / totalRequired) * 100)
    : 100;

  const isReady = missingCritical.length === 0;
  const canProceedAnyway = missingCritical.length <= 1;
  const deduplicatedLabCTAs = deduplicateLabCTAs(labCTAs);

  return {
    flow,
    isReady,
    completenessPercent,
    requirements,
    missingCritical,
    missingRecommended,
    labCTAs: deduplicatedLabCTAs,
    canProceedAnyway,
    proceedAnywayWarning: !isReady
      ? `Missing critical data: ${missingCritical.map(r => r.label).join(', ')}. Output quality will be reduced.`
      : null,
  };
}

/**
 * Get Lab CTAs for a flow
 */
export function getLabCTAs(
  graph: CompanyContextGraph,
  flow: FlowType,
  companyId: string
): LabCTA[] {
  const readiness = checkFlowReadinessFromGraph(graph, flow, companyId);
  return readiness.labCTAs;
}

/**
 * Create empty readiness (no graph exists)
 */
export function createEmptyReadiness(flow: FlowType): FlowReadiness {
  const flowReqs = FLOW_REQUIREMENTS[flow];
  const requirements: DomainRequirement[] = [];
  const missingCritical: DomainRequirement[] = [];

  for (const [domain, importance] of Object.entries(flowReqs) as [DomainKey, 'critical' | 'recommended' | 'optional'][]) {
    if (importance !== 'critical') continue;

    const req: DomainRequirement = {
      domain,
      label: DOMAIN_LABELS[domain],
      required: true,
      present: false,
      hasCanonicalData: false,
      sourceLabKey: null,
      lastUpdated: null,
    };

    requirements.push(req);
    missingCritical.push(req);
  }

  return {
    flow,
    isReady: false,
    completenessPercent: 0,
    requirements,
    missingCritical,
    missingRecommended: [],
    labCTAs: [],
    canProceedAnyway: false,
    proceedAnywayWarning: 'No context data found. Run initial diagnostics first.',
  };
}

// ============================================================================
// UI Helpers (client-safe - pure functions)
// ============================================================================

/**
 * Get flow display name
 */
export function getFlowDisplayName(flow: FlowType): string {
  switch (flow) {
    case 'strategy':
      return 'Strategy Generation';
    case 'gap_ia':
      return 'GAP Initial Assessment';
    case 'gap_full':
      return 'Full GAP Analysis';
    case 'programs':
      return 'Program Generation';
    case 'website_optimization':
      return 'Website Optimization';
    default:
      return flow;
  }
}

/**
 * Format readiness for display
 */
export function formatReadinessMessage(readiness: FlowReadiness): {
  title: string;
  message: string;
  level: 'ready' | 'warning' | 'blocked';
} {
  if (readiness.isReady) {
    return {
      title: 'Ready',
      message: `All required data is present. ${getFlowDisplayName(readiness.flow)} can proceed.`,
      level: 'ready',
    };
  }

  if (readiness.canProceedAnyway) {
    return {
      title: 'Missing Data',
      message: `${readiness.missingCritical.length} critical field${readiness.missingCritical.length > 1 ? 's' : ''} missing. You can proceed, but output quality may be reduced.`,
      level: 'warning',
    };
  }

  return {
    title: 'Blocked',
    message: `Cannot proceed. Missing: ${readiness.missingCritical.map(r => r.label).join(', ')}`,
    level: 'blocked',
  };
}
