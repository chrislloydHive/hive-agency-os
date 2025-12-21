// lib/gap/orchestrator/competitionGap.ts
// Competition GAP Runner - Ensures competitive context is always available
//
// Competition GAP is the ONLY authoritative source for competitive context fields:
// - competitive.competitors / primaryCompetitors
// - competitive.threatScores
// - competitive.positionSummary
// - competitive.overallThreatLevel
// - competitive.dataConfidence
// - competitive.differentiationAxes
// - competitive.whitespaceOpportunities
// - competitive.competitiveThreats

import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { getLatestCompetitionRun } from '@/lib/competition';
import { competitionLabImporter } from '@/lib/contextGraph/importers/competitionLabImporter';
import { runCompetitorLabEngine, type EngineInput } from '@/lib/os/diagnostics/engines';
import { getCompanyById } from '@/lib/airtable/companies';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { tryNormalizeWebsiteUrl } from '@/lib/utils/urls';

// ============================================================================
// Types
// ============================================================================

export interface CompetitionGapResult {
  success: boolean;
  error?: string;
  cached: boolean;
  validUntil?: string;
  fieldsUpdated: number;
  competitors: number;
  runId?: string;
  durationMs: number;
}

export interface CompetitionGapInput {
  companyId: string;
  forceRun?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Number of days Competition GAP results are considered valid */
const COMPETITION_GAP_VALID_DAYS = 30;

/** Competitive context fields that ONLY Competition GAP may write */
export const COMPETITION_GAP_EXCLUSIVE_FIELDS = [
  'competitive.competitors',
  'competitive.primaryCompetitors',
  'competitive.threatScores',
  'competitive.overallThreatLevel',
  'competitive.dataConfidence',
  'competitive.positionSummary',
  'competitive.primaryAxis',
  'competitive.secondaryAxis',
  'competitive.lastValidatedAt',
  'competitive.differentiationAxes',
  'competitive.whitespaceOpportunities',
  'competitive.competitiveThreats',
] as const;

// ============================================================================
// Caching Logic
// ============================================================================

/**
 * Check if Competition GAP cache is valid
 */
export function isCompetitionGapCacheValid(
  graph: CompanyContextGraph | null
): { valid: boolean; reason?: string; expiresAt?: string } {
  if (!graph) {
    return { valid: false, reason: 'No context graph' };
  }

  const competitive = graph.competitive;
  if (!competitive) {
    return { valid: false, reason: 'No competitive domain' };
  }

  // Check if we have competitors
  const competitors = competitive.competitors || competitive.primaryCompetitors;
  if (!competitors || (Array.isArray(competitors) && competitors.length === 0)) {
    return { valid: false, reason: 'No competitors in context' };
  }

  // Check provenance for expiration
  const competitorsField = competitive.competitors || competitive.primaryCompetitors;
  const provenance = Array.isArray((competitorsField as any)?.provenance)
    ? (competitorsField as any).provenance[0]
    : null;

  if (!provenance?.updatedAt) {
    return { valid: false, reason: 'No provenance timestamp' };
  }

  const updatedAt = new Date(provenance.updatedAt);
  const validForDays = provenance.validForDays ?? COMPETITION_GAP_VALID_DAYS;
  const expiresAt = new Date(updatedAt.getTime() + validForDays * 24 * 60 * 60 * 1000);

  if (new Date() > expiresAt) {
    return {
      valid: false,
      reason: `Cache expired (updated ${updatedAt.toISOString()}, expired ${expiresAt.toISOString()})`,
    };
  }

  return {
    valid: true,
    expiresAt: expiresAt.toISOString(),
  };
}

// ============================================================================
// Competition GAP Runner
// ============================================================================

/**
 * Run Competition GAP to ensure competitive context is available.
 *
 * This should be called BEFORE Full GAP runs. Competition GAP:
 * - Runs even if other labs fail
 * - Uses cached results if validForDays not expired
 * - Is the ONLY source for competitive context fields
 *
 * @param input - Company ID and optional forceRun flag
 * @returns Competition GAP result
 */
export async function runCompetitionGap(
  input: CompetitionGapInput
): Promise<CompetitionGapResult> {
  const startTime = Date.now();
  const { companyId, forceRun = false } = input;

  console.log('[Competition GAP] Starting for company:', companyId, { forceRun });

  try {
    // Load current context graph
    let graph = await loadContextGraph(companyId);

    // Check cache validity
    if (!forceRun) {
      const cacheStatus = isCompetitionGapCacheValid(graph);
      if (cacheStatus.valid) {
        console.log('[Competition GAP] Using cached results, valid until:', cacheStatus.expiresAt);

        // Count existing competitors
        const competitors = graph?.competitive?.competitors || graph?.competitive?.primaryCompetitors;
        const competitorCount = Array.isArray(competitors) ? competitors.length : 0;

        return {
          success: true,
          cached: true,
          validUntil: cacheStatus.expiresAt,
          fieldsUpdated: 0,
          competitors: competitorCount,
          durationMs: Date.now() - startTime,
        };
      }
      console.log('[Competition GAP] Cache invalid:', cacheStatus.reason);
    }

    // Get company for engine input
    const company = await getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // Try to import from existing Competition Lab run first
    const latestRun = await getLatestCompetitionRun(companyId).catch(() => null);

    if (latestRun?.status === 'completed' && latestRun.competitors.length > 0) {
      // Check if the existing run is fresh enough
      const runAge = latestRun.completedAt
        ? (Date.now() - new Date(latestRun.completedAt).getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (runAge < COMPETITION_GAP_VALID_DAYS) {
        console.log('[Competition GAP] Found fresh Competition Lab run:', latestRun.id);

        // Import from existing run
        if (!graph) {
          graph = await loadContextGraph(companyId);
          if (!graph) {
            throw new Error('Failed to load context graph');
          }
        }

        const importResult = await competitionLabImporter.importAll(graph, companyId, 'competitive');

        if (importResult.success) {
          // CANONICAL SOURCE: Use competition_lab as the single source of truth
          await saveContextGraph(graph, 'competition_lab');

          console.log('[Competition GAP] Imported from existing run:', {
            fieldsUpdated: importResult.fieldsUpdated,
            paths: importResult.updatedPaths,
          });

          const competitors = graph.competitive?.competitors || graph.competitive?.primaryCompetitors;
          const competitorCount = Array.isArray(competitors) ? competitors.length : 0;

          return {
            success: true,
            cached: false,
            fieldsUpdated: importResult.fieldsUpdated,
            competitors: competitorCount,
            runId: latestRun.id,
            durationMs: Date.now() - startTime,
          };
        }
      }
    }

    // Run full Competition Lab Engine
    console.log('[Competition GAP] Running Competition Lab Engine...');

    // Normalize the URL before passing to engine
    const rawUrl = company.website || company.domain || '';
    const urlResult = tryNormalizeWebsiteUrl(rawUrl);
    const websiteUrl = urlResult.ok ? urlResult.url : rawUrl;

    const engineInput: EngineInput = {
      companyId,
      company,
      websiteUrl,
    };

    const engineResult = await runCompetitorLabEngine(engineInput);

    if (!engineResult.success) {
      console.error('[Competition GAP] Competition Lab Engine failed:', engineResult.error);
      return {
        success: false,
        error: engineResult.error || 'Competition Lab Engine failed',
        cached: false,
        fieldsUpdated: 0,
        competitors: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // Reload graph to get updated competitive context
    graph = await loadContextGraph(companyId);

    const competitors = graph?.competitive?.competitors || graph?.competitive?.primaryCompetitors;
    const competitorCount = Array.isArray(competitors) ? competitors.length : 0;

    console.log('[Competition GAP] Complete:', {
      competitors: competitorCount,
      durationMs: Date.now() - startTime,
    });

    // Extract fields updated from engine result data
    const engineData = engineResult.data as { refinedContext?: unknown[] } | undefined;
    const fieldsUpdated = engineData?.refinedContext?.length ?? 0;

    return {
      success: true,
      cached: false,
      fieldsUpdated,
      competitors: competitorCount,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error('[Competition GAP] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      cached: false,
      fieldsUpdated: 0,
      competitors: 0,
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Category Guardrails for Competitor Filtering
// ============================================================================

/**
 * Category signals that indicate a services/agency business
 * If the TARGET COMPANY is NOT a services company, competitors with these
 * signals should be rejected.
 */
const SERVICES_AGENCY_SIGNALS = [
  'agency',
  'marketing agency',
  'digital agency',
  'creative agency',
  'advertising agency',
  'ppc agency',
  'seo agency',
  'seo services',
  'ppc services',
  'marketing services',
  'consulting',
  'consultancy',
  'professional services',
  'managed services',
  'freelancer',
  'freelance',
];

/**
 * Marketplace signals - reject if target is not a marketplace
 */
const MARKETPLACE_SIGNALS = [
  'fiverr',
  'upwork',
  'marketplace for',
  'freelancer marketplace',
  'talent marketplace',
];

/**
 * Generic marketing vendors that should almost never be competitors
 * unless the target company is also a generic marketing platform
 */
const GENERIC_MARKETING_VENDORS = [
  'disruptive advertising',
  'webfx',
  'ignite visibility',
  'power digital',
  'directive',
  'single grain',
  'thrive agency',
];

/**
 * Determine the category fingerprint of a company based on available context
 */
export function getCompanyCategoryFingerprint(
  context: {
    industry?: string;
    businessModel?: string;
    productOffer?: string[];
    domain?: string;
  }
): {
  isAgencyOrServices: boolean;
  isMarketplace: boolean;
  isPlatformOrSaas: boolean;
  keywords: string[];
} {
  const keywords: string[] = [];

  // Collect keywords from context
  if (context.industry) keywords.push(context.industry.toLowerCase());
  if (context.businessModel) keywords.push(context.businessModel.toLowerCase());
  if (context.productOffer) {
    keywords.push(...context.productOffer.map(p => p.toLowerCase()));
  }

  const keywordString = keywords.join(' ');

  // Detect if this company is an agency/services business
  const isAgencyOrServices = SERVICES_AGENCY_SIGNALS.some(signal =>
    keywordString.includes(signal)
  );

  // Detect if this is a marketplace
  const isMarketplace = keywordString.includes('marketplace') ||
    MARKETPLACE_SIGNALS.some(signal => keywordString.includes(signal));

  // Detect if this is a platform/SaaS
  const isPlatformOrSaas = keywordString.includes('saas') ||
    keywordString.includes('platform') ||
    keywordString.includes('software') ||
    keywordString.includes('data') ||
    keywordString.includes('database') ||
    keywordString.includes('intelligence');

  return {
    isAgencyOrServices,
    isMarketplace,
    isPlatformOrSaas,
    keywords,
  };
}

/**
 * Check if a competitor should be rejected based on category mismatch
 *
 * @param competitorName - Name of the competitor
 * @param competitorDomain - Domain of the competitor
 * @param competitorCategory - Category/positioning from analysis
 * @param targetFingerprint - Category fingerprint of the target company
 * @returns rejection reason if should be rejected, null if ok
 */
export function shouldRejectCompetitor(
  competitorName: string,
  competitorDomain: string,
  competitorCategory: string | undefined,
  targetFingerprint: ReturnType<typeof getCompanyCategoryFingerprint>
): string | null {
  const nameLower = competitorName?.toLowerCase() || '';
  const domainLower = competitorDomain?.toLowerCase() || '';
  const categoryLower = competitorCategory?.toLowerCase() || '';

  const competitorText = `${nameLower} ${domainLower} ${categoryLower}`;

  // Rule 1: If target is NOT an agency, reject agency competitors
  if (!targetFingerprint.isAgencyOrServices) {
    const isAgencyCompetitor = SERVICES_AGENCY_SIGNALS.some(signal =>
      competitorText.includes(signal)
    );
    if (isAgencyCompetitor) {
      return 'Agency/services competitor for non-agency company';
    }
  }

  // Rule 2: If target is NOT a marketplace, reject marketplace competitors
  if (!targetFingerprint.isMarketplace) {
    const isMarketplaceCompetitor = MARKETPLACE_SIGNALS.some(signal =>
      competitorText.includes(signal)
    );
    if (isMarketplaceCompetitor) {
      return 'Marketplace competitor for non-marketplace company';
    }
  }

  // Rule 3: Always reject known generic marketing vendors
  // (unless the target is also a marketing agency/vendor)
  if (!targetFingerprint.isAgencyOrServices) {
    const isGenericVendor = GENERIC_MARKETING_VENDORS.some(vendor =>
      nameLower.includes(vendor) || domainLower.includes(vendor.replace(' ', ''))
    );
    if (isGenericVendor) {
      return 'Generic marketing vendor (not a true competitor)';
    }
  }

  return null;
}

/**
 * Filter competitors based on category guardrails
 *
 * @param competitors - Array of competitors to filter
 * @param targetFingerprint - Category fingerprint of the target company
 * @returns filtered competitors and rejection log
 */
export function filterCompetitorsByCategory<T extends {
  name?: string;
  competitorName?: string;
  domain?: string;
  competitorDomain?: string;
  category?: string;
  positioning?: string;
}>(
  competitors: T[],
  targetFingerprint: ReturnType<typeof getCompanyCategoryFingerprint>
): {
  valid: T[];
  rejected: Array<{ competitor: T; reason: string }>;
} {
  const valid: T[] = [];
  const rejected: Array<{ competitor: T; reason: string }> = [];

  for (const competitor of competitors) {
    const name = competitor.name || competitor.competitorName || '';
    const domain = competitor.domain || competitor.competitorDomain || '';
    const category = competitor.category || competitor.positioning || '';

    const rejectionReason = shouldRejectCompetitor(
      name,
      domain,
      category,
      targetFingerprint
    );

    if (rejectionReason) {
      rejected.push({ competitor, reason: rejectionReason });
    } else {
      valid.push(competitor);
    }
  }

  return { valid, rejected };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a field key is a Competition GAP exclusive field
 */
export function isCompetitionGapExclusiveField(fieldKey: string): boolean {
  return COMPETITION_GAP_EXCLUSIVE_FIELDS.some(
    (f) => fieldKey === f || fieldKey.startsWith(f + '.')
  );
}

/**
 * Validate that competitive context is present and sufficient for strategy
 */
export function validateCompetitiveContextForStrategy(
  graph: CompanyContextGraph | null
): { ready: boolean; missingFields: string[]; message?: string } {
  if (!graph) {
    return {
      ready: false,
      missingFields: COMPETITION_GAP_EXCLUSIVE_FIELDS.slice(),
      message: 'No context graph available',
    };
  }

  const missing: string[] = [];
  const competitive = graph.competitive;

  if (!competitive) {
    return {
      ready: false,
      missingFields: COMPETITION_GAP_EXCLUSIVE_FIELDS.slice(),
      message: 'Competitive context missing — run Competition GAP',
    };
  }

  // Required fields for strategy
  const competitors = competitive.competitors || competitive.primaryCompetitors;
  if (!competitors || (Array.isArray(competitors) && competitors.length === 0)) {
    missing.push('competitive.competitors');
  }

  if (!competitive.positionSummary) {
    missing.push('competitive.positionSummary');
  }

  if (missing.length > 0) {
    return {
      ready: false,
      missingFields: missing,
      message: `Competitive context incomplete — missing ${missing.length} field(s). Run Competition GAP.`,
    };
  }

  return { ready: true, missingFields: [] };
}
