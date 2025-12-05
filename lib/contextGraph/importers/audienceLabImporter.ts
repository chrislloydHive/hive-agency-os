// lib/contextGraph/importers/audienceLabImporter.ts
// Audience Lab Importer - imports data from Audience Lab into Context Graph
//
// Uses the existing AudienceLabWriter mappings to import the current canonical
// audience model (segments, personas, demand states) for a company.

import type { DomainImporter, ImportResult } from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { getCurrentAudienceModel } from '@/lib/audience/storage';
import { writeAudienceLabToGraph } from '../audienceLabWriter';

/**
 * Audience Lab Importer
 *
 * Imports the current canonical audience model into the context graph.
 * Uses segments, personas, pain points, and demand states as data sources.
 */
export const audienceLabImporter: DomainImporter = {
  id: 'audienceLab',
  label: 'Audience Lab',

  async supports(companyId: string, domain: string): Promise<boolean> {
    try {
      const model = await getCurrentAudienceModel(companyId);
      // Check if model exists and has at least one segment
      return model !== null && model.segments && model.segments.length > 0;
    } catch (error) {
      console.warn('[audienceLabImporter] Error checking support:', error);
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
      // Fetch the current canonical audience model for this company
      const model = await getCurrentAudienceModel(companyId);

      if (!model) {
        result.errors.push('No audience model found for company');
        return result;
      }

      if (!model.segments || model.segments.length === 0) {
        result.errors.push('Audience model has no segments');
        return result;
      }

      // Use the model ID as the "run ID" for provenance
      result.sourceRunIds.push(model.id);

      // Use the existing AudienceLabWriter to map the data
      const writerResult = writeAudienceLabToGraph(graph, model, model.id);

      result.fieldsUpdated = writerResult.fieldsUpdated;
      result.updatedPaths = writerResult.updatedPaths;
      result.errors.push(...writerResult.errors);

      result.success = writerResult.fieldsUpdated > 0;
      console.log(`[audienceLabImporter] Imported ${result.fieldsUpdated} fields from Audience Lab for ${companyId}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Import failed: ${errorMsg}`);
      console.error('[audienceLabImporter] Import error:', error);
    }

    return result;
  },
};

export default audienceLabImporter;
