// lib/contextGraph/importers/mediaLabImporter.ts
// Media Lab Importer - imports data from Media Lab into Context Graph
//
// Uses the existing MediaLabWriter mappings to import current Media Lab data
// (plans, channels, flights) for a company.

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getMediaLabForCompany, companyHasMediaLab } from '@/lib/mediaLab';
import { writeMediaLabToGraph } from '../mediaLabWriter';

/**
 * Media Lab Importer
 *
 * Imports current Media Lab data (media plans, channels, flights) into the context graph.
 * Uses the company's active/proposed media plans as the data source.
 */
export const mediaLabImporter: DomainImporter = {
  id: 'mediaLab',
  label: 'Media Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      const hasData = await companyHasMediaLab(companyId);
      return hasData;
    } catch (error) {
      console.warn('[mediaLabImporter] Error checking support:', error);
      return false;
    }
  },

  async importAll(
    graph: CompanyContextGraph,
    companyId: string,
    domain: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [],
      sourceRunIds: [],
    };

    try {
      // Fetch the current Media Lab data for this company
      const mediaLabData = await getMediaLabForCompany(companyId);

      if (!mediaLabData || mediaLabData.plans.length === 0) {
        result.errors.push('No Media Lab plans found for company');
        return result;
      }

      // Use the first active plan's ID as the "run ID" for provenance
      const activePlan = mediaLabData.plans.find(p => p.status === 'active');
      const runId = activePlan?.id || mediaLabData.plans[0]?.id;

      if (runId) {
        result.sourceRunIds.push(runId);
      }

      // Use the existing MediaLabWriter to map the data
      const writerResult = writeMediaLabToGraph(graph, mediaLabData, runId);

      result.fieldsUpdated = writerResult.fieldsUpdated;
      result.updatedPaths = writerResult.updatedPaths;
      result.errors.push(...writerResult.errors);

      result.success = writerResult.fieldsUpdated > 0;
      console.log(`[mediaLabImporter] Imported ${result.fieldsUpdated} fields from Media Lab for ${companyId}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[mediaLabImporter] Import error:', error);
    }

    return result;
  },
};

export default mediaLabImporter;
