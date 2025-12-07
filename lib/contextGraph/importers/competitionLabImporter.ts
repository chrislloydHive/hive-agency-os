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
      const provenance = createProvenance('competitor_lab', {
        confidence: 0.9,
        runId: run.id,
        validForDays: 30,
      });

      // Get active competitors (not removed)
      const activeCompetitors = run.competitors.filter((c) => !c.provenance.removed);

      if (activeCompetitors.length === 0) {
        result.errors.push('No active competitors in the run');
        return result;
      }

      // Map competitors to CompetitorProfile
      const competitorProfiles = activeCompetitors.map(mapToCompetitorProfile);

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
