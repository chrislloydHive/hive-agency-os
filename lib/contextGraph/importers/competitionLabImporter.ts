// lib/contextGraph/importers/competitionLabImporter.ts
// Competition Lab Importer - imports data from Competition Lab v2 into Context Graph
//
// Maps Competition Lab results to context graph fields:
// - competitive.competitors / primaryCompetitors
// - competitive.threatScores
// - competitive.dataConfidence
// - competitive.positionSummary

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import type { CompetitorProfile, ThreatScore, PriceTier } from '../domains/competitive';
import { getLatestCompetitionRun, type ScoredCompetitor } from '@/lib/competition';
import { setFieldUntyped, createProvenance } from '../mutate';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getCompanyCategoryFingerprint,
  filterCompetitorsByCategory,
} from '@/lib/gap/orchestrator/competitionGap';
import { filterOutAgencies } from '@/lib/labs/competitor/mergeCompetitors';

// ============================================================================
// Domain Normalization Helpers
// ============================================================================

/**
 * Normalize a domain for comparison - removes protocol, www, and trailing slashes
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  let normalized = domain.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  normalized = normalized.replace(/\/$/, '');
  normalized = normalized.split('/')[0];
  return normalized || null;
}

/**
 * Check if two domains are the same company
 */
function isSameDomain(domain1: string | null | undefined, domain2: string | null | undefined): boolean {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2;
}

/**
 * Check if a competitor is likely the same company (self-competitor)
 * Handles cases like "Crunchbase Pro" being listed as competitor for "Crunchbase"
 */
function isSelfCompetitor(
  competitorName: string,
  competitorDomain: string | null | undefined,
  companyName: string | null,
  companyDomain: string | null
): { isSelf: boolean; reason?: string } {
  // 1. Domain match (exact or subdomain)
  const normCompetitorDomain = normalizeDomain(competitorDomain);
  if (normCompetitorDomain && companyDomain) {
    // Exact match
    if (normCompetitorDomain === companyDomain) {
      return { isSelf: true, reason: 'exact domain match' };
    }
    // Subdomain of company (e.g., pro.crunchbase.com for crunchbase.com)
    if (normCompetitorDomain.endsWith(`.${companyDomain}`)) {
      return { isSelf: true, reason: 'subdomain of company' };
    }
    // Company is subdomain of competitor (e.g., crunchbase.com matches pro.crunchbase.com)
    if (companyDomain.endsWith(`.${normCompetitorDomain}`)) {
      return { isSelf: true, reason: 'company is subdomain' };
    }
  }

  // 2. Name contains company name strongly
  if (companyName) {
    const normalizedCompetitorName = competitorName.toLowerCase().trim();
    const normalizedCompanyName = companyName.toLowerCase().trim();

    // Competitor name starts with company name (e.g., "Crunchbase Pro" for "Crunchbase")
    if (normalizedCompetitorName.startsWith(normalizedCompanyName)) {
      return { isSelf: true, reason: `name starts with company name: "${companyName}"` };
    }

    // Company name is the same with minor suffix
    if (normalizedCompanyName.startsWith(normalizedCompetitorName) && normalizedCompanyName.length <= normalizedCompetitorName.length + 15) {
      return { isSelf: true, reason: `company name variant: "${companyName}"` };
    }

    // Fuzzy match: competitor name equals company name
    if (normalizedCompetitorName === normalizedCompanyName) {
      return { isSelf: true, reason: 'exact name match' };
    }
  }

  return { isSelf: false };
}

/**
 * Map Competition Lab competitor to Context Graph CompetitorProfile
 */
function mapToCompetitorProfile(competitor: ScoredCompetitor): CompetitorProfile {
  // Map brandScale to category
  const categoryMap: Record<string, 'direct' | 'indirect' | 'emerging'> = {
    core: 'direct',
    secondary: 'indirect',
    alternative: 'indirect',
  };

  // Map priceTier
  const priceTierMap: Record<string, PriceTier> = {
    budget: 'low',
    mid: 'medium',
    premium: 'premium',
    enterprise: 'enterprise',
  };

  return {
    name: competitor.competitorName,
    domain: competitor.competitorDomain,
    website: competitor.competitorDomain,
    category: categoryMap[competitor.role] || 'direct',
    positioning: competitor.enrichedData.positioning,
    estimatedBudget: null,
    primaryChannels: competitor.enrichedData.primaryChannels || [],
    strengths: competitor.enrichedData.differentiators || [],
    weaknesses: competitor.enrichedData.weaknesses || [],
    uniqueClaims: [],
    offers: competitor.enrichedData.primaryOffers || [],
    pricingSummary: competitor.enrichedData.estimatedPriceRange,
    pricingNotes: competitor.enrichedData.estimatedPriceRange,
    notes: competitor.whyThisCompetitorMatters,
    xPosition: competitor.xPosition,
    yPosition: competitor.yPosition,
    positionPrimary: competitor.offerSimilarity,
    positionSecondary: competitor.audienceSimilarity,
    confidence: competitor.overallScore / 100,
    lastValidatedAt: competitor.createdAt,
    trajectory: null,
    trajectoryReason: null,
    provenance: [],
    threatLevel: competitor.threatLevel,
    threatDrivers: competitor.threatDrivers,
    autoSeeded: !competitor.provenance.humanOverride,
    // V3.5 fields
    businessModelCategory: null,
    jtbdMatches: null,
    offerOverlapScore: null,
    signalsVerified: null,
    // Vertical classification
    verticalCategory: null,
    subVertical: null,
  };
}

/**
 * Map Competition Lab competitor to ThreatScore
 */
function mapToThreatScore(competitor: ScoredCompetitor): ThreatScore | null {
  if (competitor.threatLevel === null) return null;

  return {
    competitorName: competitor.competitorName,
    threatLevel: competitor.threatLevel,
    threatDrivers: competitor.threatDrivers,
    timeHorizon: null,
    defensiveActions: [],
  };
}

/**
 * Competition Lab Importer
 *
 * Imports Competition Lab v2 run results into the context graph.
 * Uses the most recent completed competition run.
 */
export const competitionLabImporter: DomainImporter = {
  id: 'competitionLab',
  label: 'Competition Lab',

  async supports(companyId: string): Promise<boolean> {
    try {
      const run = await getLatestCompetitionRun(companyId);
      return run !== null && run.status === 'completed' && run.competitors.length > 0;
    } catch (error) {
      console.warn('[competitionLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    _domain: string // Required by DomainImporter interface, not used here
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      const run = await getLatestCompetitionRun(companyId);

      if (!run || run.status !== 'completed') {
        result.errors.push('No completed competition run found');
        return result;
      }

      result.sourceRunIds.push(run.id);

      // Create provenance for competition lab source
      // CANONICAL SOURCE: competition_lab is the ONLY authorized writer for competitive.* fields
      const provenance = createProvenance('competition_lab', {
        confidence: 0.9,
        runId: run.id,
        validForDays: 30,
      });

      // Get active competitors (not removed)
      let activeCompetitors = run.competitors.filter((c) => !c.provenance.removed);

      // CRITICAL: Filter out self-competitors before writing to context graph
      // The company should NEVER appear as its own competitor
      let companyDomain: string | null = null;
      let companyNameForFilter: string | null = null;
      let companyIndustry: string | null = null;
      let companyBusinessModel: string | null = null;
      try {
        const company = await getCompanyById(companyId);
        companyDomain = normalizeDomain(company?.domain || company?.website);
        companyNameForFilter = company?.name?.toLowerCase().trim() || null;
        companyIndustry = company?.industry || null;
        companyBusinessModel = company?.companyType || null;
      } catch (e) {
        console.warn('[competitionLabImporter] Could not fetch company for self-filtering:', e);
      }

      // FILTER 1: Remove self-competitors (same company, subdomains, name variants)
      if (companyDomain || companyNameForFilter) {
        const beforeCount = activeCompetitors.length;
        activeCompetitors = activeCompetitors.filter((c) => {
          const selfCheck = isSelfCompetitor(
            c.competitorName,
            c.competitorDomain,
            companyNameForFilter,
            companyDomain
          );
          if (selfCheck.isSelf) {
            console.log(`[competitionLabImporter] Filtered out self-competitor: ${c.competitorName} (${c.competitorDomain}) - ${selfCheck.reason}`);
            return false;
          }
          return true;
        });
        if (beforeCount !== activeCompetitors.length) {
          console.log(`[competitionLabImporter] Removed ${beforeCount - activeCompetitors.length} self-competitor(s)`);
        }
      }

      // NEW: Apply category guardrails to filter cross-industry competitors
      // This prevents agencies/services from appearing as competitors for platform companies
      const categoryFingerprint = getCompanyCategoryFingerprint({
        industry: companyIndustry || undefined,
        businessModel: companyBusinessModel || undefined,
        domain: companyDomain || undefined,
      });

      // Build a minimal array for category filtering to avoid type issues
      const competitorsForCategoryFilter = activeCompetitors.map(c => ({
        name: c.competitorName,
        competitorName: c.competitorName,
        domain: c.competitorDomain ?? undefined,
        competitorDomain: c.competitorDomain ?? undefined,
        category: c.role,
        positioning: c.enrichedData?.positioning ?? undefined,
      }));

      const { valid: validCompetitorMetas, rejected: categoryRejected } = filterCompetitorsByCategory(
        competitorsForCategoryFilter,
        categoryFingerprint
      );

      if (categoryRejected.length > 0) {
        console.log(`[competitionLabImporter] Rejected ${categoryRejected.length} competitors by category guardrails:`);
        for (const { competitor, reason } of categoryRejected.slice(0, 5)) {
          console.log(`  - ${competitor.name || competitor.competitorName}: ${reason}`);
        }
      }

      // Filter original activeCompetitors to only include those that passed category filter
      const validNames = new Set(validCompetitorMetas.map(c => c.name));
      activeCompetitors = activeCompetitors.filter(c => validNames.has(c.competitorName));

      if (activeCompetitors.length === 0) {
        result.errors.push('No active competitors in the run');
        return result;
      }

      // Map competitors to CompetitorProfile
      let competitorProfiles = activeCompetitors.map(mapToCompetitorProfile);

      // FILTER 3: Remove agencies and service providers
      // This is the final filtering step before persistence
      const { competitors: nonAgencyProfiles, rejectedAgencies } = filterOutAgencies(competitorProfiles);
      if (rejectedAgencies.length > 0) {
        console.log(`[competitionLabImporter] Filtered out ${rejectedAgencies.length} agencies/service providers:`);
        for (const { competitor, reason } of rejectedAgencies.slice(0, 5)) {
          console.log(`  - ${competitor.name}: ${reason}`);
        }
      }
      competitorProfiles = nonAgencyProfiles;

      if (competitorProfiles.length === 0) {
        result.errors.push('No competitors remaining after agency filtering');
        return result;
      }

      // Import competitors array
      setFieldUntyped(graph, 'competitive', 'competitors', competitorProfiles, provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.competitors');

      // Also update primaryCompetitors for backwards compatibility
      setFieldUntyped(graph, 'competitive', 'primaryCompetitors', competitorProfiles, provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.primaryCompetitors');

      // Import threat scores
      const threatScores = activeCompetitors
        .map(mapToThreatScore)
        .filter((t): t is ThreatScore => t !== null);

      if (threatScores.length > 0) {
        setFieldUntyped(graph, 'competitive', 'threatScores', threatScores, provenance);
        result.fieldsUpdated++;
        result.updatedPaths.push('competitive.threatScores');

        // Calculate and set overall threat level
        const avgThreat = Math.round(
          threatScores.reduce((sum, t) => sum + t.threatLevel, 0) / threatScores.length
        );
        setFieldUntyped(graph, 'competitive', 'overallThreatLevel', avgThreat, provenance);
        result.fieldsUpdated++;
        result.updatedPaths.push('competitive.overallThreatLevel');
      }

      // Import data confidence
      const confidence = run.dataConfidenceScore / 100;
      setFieldUntyped(graph, 'competitive', 'dataConfidence', confidence, provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.dataConfidence');

      // Import last validated timestamp
      setFieldUntyped(graph, 'competitive', 'lastValidatedAt', run.completedAt || run.startedAt, provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.lastValidatedAt');

      // Generate position summary
      const coreCount = activeCompetitors.filter((c) => c.role === 'core').length;
      const secondaryCount = activeCompetitors.filter((c) => c.role === 'secondary').length;
      const alternativeCount = activeCompetitors.filter((c) => c.role === 'alternative').length;
      const positionSummary = `Competitive landscape includes ${coreCount} core competitors, ${secondaryCount} secondary competitors, and ${alternativeCount} alternatives. Average offer similarity: ${Math.round(activeCompetitors.reduce((sum, c) => sum + c.offerSimilarity, 0) / activeCompetitors.length)}%. Average audience overlap: ${Math.round(activeCompetitors.reduce((sum, c) => sum + c.audienceSimilarity, 0) / activeCompetitors.length)}%.`;

      setFieldUntyped(graph, 'competitive', 'positionSummary', positionSummary, provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.positionSummary');

      // Set positioning axes based on scoring dimensions
      setFieldUntyped(graph, 'competitive', 'primaryAxis', 'Offer Similarity (0-100)', provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.primaryAxis');

      setFieldUntyped(graph, 'competitive', 'secondaryAxis', 'Audience Similarity (0-100)', provenance);
      result.fieldsUpdated++;
      result.updatedPaths.push('competitive.secondaryAxis');

      result.success = result.fieldsUpdated > 0;
      console.log(`[competitionLabImporter] Imported ${result.fieldsUpdated} fields from Competition Lab`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[competitionLabImporter] Import error:', error);
    }

    return result;
  },
};
