// lib/contextGraph/importers/registry.ts
// Context Graph Importer Registry
//
// Central registry for all domain importers. Provides the hydrateContextFromHistory
// function that orchestrates importing data from all registered importers.

import type {
  DomainImporter,
  ImporterRegistryEntry,
  HydrationResult,
  ImportResult,
} from './types';
import type { CompanyContextGraph } from '../companyContextGraph';
import { loadContextGraph, saveContextGraph } from '../storage';
import { createEmptyContextGraph, calculateCompleteness } from '../companyContextGraph';
import { getCompanyById } from '@/lib/airtable/companies';

// Import all domain importers
import { gapImporter } from './gapImporter';
import { websiteLabImporter } from './websiteLabImporter';
import { brandLabImporter } from './brandLabImporter';
import { mediaLabImporter } from './mediaLabImporter';
import { audienceLabImporter } from './audienceLabImporter';
import { diagnosticModulesImporter } from './diagnosticModulesImporter';

// ============================================================================
// Importer Registry
// ============================================================================

/**
 * Registry of all domain importers
 * Priority determines execution order (lower = runs first)
 */
const IMPORTER_REGISTRY: ImporterRegistryEntry[] = [
  {
    importer: gapImporter,
    priority: 10, // GAP runs first (foundational data)
    enabled: true,
  },
  {
    importer: websiteLabImporter,
    priority: 20, // Website Lab runs second (enriches website data)
    enabled: true,
  },
  {
    importer: brandLabImporter,
    priority: 30, // Brand Lab runs third (brand & competitive data)
    enabled: true,
  },
  {
    importer: mediaLabImporter,
    priority: 40, // Media Lab runs fourth (media plans & budget data)
    enabled: true,
  },
  {
    importer: audienceLabImporter,
    priority: 50, // Audience Lab runs fifth (segments, personas, demand states)
    enabled: true,
  },
  {
    importer: diagnosticModulesImporter,
    priority: 15, // Diagnostic Modules runs early (foundational SEO/Content/Website/Brand data from GAP Heavy)
    enabled: true,
  },
  // Add more importers here as they are implemented:
  // { importer: contentLabImporter, priority: 60, enabled: true },
  // { importer: seoLabImporter, priority: 70, enabled: true },
];

/**
 * Get all enabled importers, sorted by priority
 */
export function getEnabledImporters(): DomainImporter[] {
  return IMPORTER_REGISTRY
    .filter(entry => entry.enabled)
    .sort((a, b) => a.priority - b.priority)
    .map(entry => entry.importer);
}

/**
 * Get importer by ID
 */
export function getImporterById(id: string): DomainImporter | undefined {
  const entry = IMPORTER_REGISTRY.find(e => e.importer.id === id);
  return entry?.importer;
}

/**
 * Check which importers have data for a given company
 */
export async function checkAvailableImporters(
  companyId: string,
  domain: string
): Promise<Array<{ id: string; label: string; hasData: boolean }>> {
  const results: Array<{ id: string; label: string; hasData: boolean }> = [];

  for (const entry of IMPORTER_REGISTRY) {
    if (!entry.enabled) continue;

    console.log(`[registry] Checking importer: ${entry.importer.id}`);
    try {
      const hasData = await entry.importer.supports(companyId, domain);
      console.log(`[registry] ${entry.importer.id} hasData:`, hasData);
      results.push({
        id: entry.importer.id,
        label: entry.importer.label,
        hasData,
      });
    } catch (error) {
      console.error(`[registry] Error checking ${entry.importer.id}:`, error);
      results.push({
        id: entry.importer.id,
        label: entry.importer.label,
        hasData: false,
      });
    }
  }

  return results;
}

// ============================================================================
// Main Hydration Function
// ============================================================================

/**
 * Hydrate a company's context graph from all available historical data
 *
 * This function:
 * 1. Loads or creates the context graph for the company
 * 2. Checks which importers have data available
 * 3. Runs each importer in priority order
 * 4. Saves the updated graph
 * 5. Returns a summary of what was imported
 *
 * @param companyId - The company ID to hydrate
 * @returns HydrationResult with details about what was imported
 */
export async function hydrateContextFromHistory(
  companyId: string
): Promise<HydrationResult> {
  const startTime = Date.now();
  console.log(`[hydrateContextFromHistory] Starting hydration for company ${companyId}`);

  const result: HydrationResult = {
    success: false,
    importerResults: [],
    totalFieldsUpdated: 0,
    totalErrors: 0,
    graph: null as unknown as CompanyContextGraph, // Will be set below
  };

  try {
    // Load company to get domain
    const company = await getCompanyById(companyId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    const domain = company.domain || company.website || '';
    console.log(`[hydrateContextFromHistory] Company: ${company.name}, Domain: ${domain}`);

    // Load or create context graph
    let graph = await loadContextGraph(companyId);
    const isNewGraph = !graph;

    if (!graph) {
      console.log('[hydrateContextFromHistory] Creating new context graph');
      graph = createEmptyContextGraph(companyId, company.name);
    }

    const initialCompleteness = calculateCompleteness(graph);
    console.log(`[hydrateContextFromHistory] Initial completeness: ${initialCompleteness}%`);

    // Get enabled importers
    const importers = getEnabledImporters();
    console.log(`[hydrateContextFromHistory] Running ${importers.length} importers`);

    // Run each importer
    for (const importer of importers) {
      try {
        // Check if importer has data
        const hasData = await importer.supports(companyId, domain);
        if (!hasData) {
          console.log(`[hydrateContextFromHistory] Skipping ${importer.id}: no data`);
          result.importerResults.push({
            importerId: importer.id,
            importerLabel: importer.label,
            result: {
              success: true,
              fieldsUpdated: 0,
              updatedPaths: [],
              errors: [],
              sourceRunIds: [],
            },
          });
          continue;
        }

        // Run the importer
        console.log(`[hydrateContextFromHistory] Running ${importer.id}...`);
        const importResult = await importer.importAll(graph, companyId, domain);

        result.importerResults.push({
          importerId: importer.id,
          importerLabel: importer.label,
          result: importResult,
        });

        result.totalFieldsUpdated += importResult.fieldsUpdated;
        result.totalErrors += importResult.errors.length;

        console.log(`[hydrateContextFromHistory] ${importer.id} complete: ${importResult.fieldsUpdated} fields`);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[hydrateContextFromHistory] Error in ${importer.id}:`, error);

        result.importerResults.push({
          importerId: importer.id,
          importerLabel: importer.label,
          result: {
            success: false,
            fieldsUpdated: 0,
            updatedPaths: [],
            errors: [`Import failed: ${errorMsg}`],
            sourceRunIds: [],
          },
        });

        result.totalErrors++;
      }
    }

    // Calculate final completeness
    const finalCompleteness = calculateCompleteness(graph);
    console.log(`[hydrateContextFromHistory] Final completeness: ${finalCompleteness}% (was ${initialCompleteness}%)`);

    // Save the updated graph
    if (result.totalFieldsUpdated > 0) {
      console.log('[hydrateContextFromHistory] Saving updated graph...');
      await saveContextGraph(graph, 'hydration');
    }

    result.graph = graph;
    result.success = result.totalErrors === 0 || result.totalFieldsUpdated > 0;

    const duration = Date.now() - startTime;
    console.log(`[hydrateContextFromHistory] Complete in ${duration}ms: ${result.totalFieldsUpdated} fields, ${result.totalErrors} errors`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[hydrateContextFromHistory] Fatal error:', error);
    result.totalErrors++;

    // Create empty graph for result
    result.graph = createEmptyContextGraph(companyId, companyId);
  }

  return result;
}

/**
 * Run a single importer for a company
 *
 * Useful for testing or running specific importers on demand.
 *
 * @param companyId - The company ID
 * @param importerId - The importer ID to run
 * @returns Import result
 */
export async function runSingleImporter(
  companyId: string,
  importerId: string
): Promise<ImportResult> {
  const importer = getImporterById(importerId);
  if (!importer) {
    return {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [`Unknown importer: ${importerId}`],
      sourceRunIds: [],
    };
  }

  // Load company to get domain
  const company = await getCompanyById(companyId);
  if (!company) {
    return {
      success: false,
      fieldsUpdated: 0,
      updatedPaths: [],
      errors: [`Company not found: ${companyId}`],
      sourceRunIds: [],
    };
  }

  const domain = company.domain || company.website || '';

  // Load or create context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = createEmptyContextGraph(companyId, company.name);
  }

  // Run the importer
  const result = await importer.importAll(graph, companyId, domain);

  // Save if successful
  if (result.fieldsUpdated > 0) {
    await saveContextGraph(graph, importer.id as any);
  }

  return result;
}

// Export types for consumers
export type { DomainImporter, ImporterRegistryEntry, HydrationResult, ImportResult };
