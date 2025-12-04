'use server';

// app/c/[companyId]/brain/context/actions.ts
// Server Actions for Brain Context page

import { revalidatePath } from 'next/cache';
import {
  hydrateContextFromHistory,
  checkAvailableImporters,
  type HydrationResult,
} from '@/lib/contextGraph/importers';
import { getCompanyById } from '@/lib/airtable/companies';

/**
 * Hydrate context graph from historical diagnostic runs
 *
 * This action:
 * 1. Fetches all historical GAP, Website Lab, etc. runs for the company
 * 2. Maps the data to context graph fields
 * 3. Saves the updated context graph
 * 4. Returns a summary of what was imported
 */
export async function hydrateContextAction(
  companyId: string
): Promise<{
  success: boolean;
  message: string;
  fieldsUpdated: number;
  importerSummary: Array<{
    name: string;
    fieldsUpdated: number;
    errors: number;
  }>;
}> {
  try {
    console.log(`[hydrateContextAction] Starting hydration for company ${companyId}`);

    const result = await hydrateContextFromHistory(companyId);

    // Build summary
    const importerSummary = result.importerResults.map(ir => ({
      name: ir.importerLabel,
      fieldsUpdated: ir.result.fieldsUpdated,
      errors: ir.result.errors.length,
    }));

    // Revalidate the context page to show updated data
    revalidatePath(`/c/${companyId}/brain/context`);

    if (result.success) {
      const message = result.totalFieldsUpdated > 0
        ? `Successfully imported ${result.totalFieldsUpdated} fields from historical runs.`
        : 'No new data to import from historical runs.';

      return {
        success: true,
        message,
        fieldsUpdated: result.totalFieldsUpdated,
        importerSummary,
      };
    } else {
      return {
        success: false,
        message: `Hydration completed with ${result.totalErrors} errors.`,
        fieldsUpdated: result.totalFieldsUpdated,
        importerSummary,
      };
    }
  } catch (error) {
    console.error('[hydrateContextAction] Error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      message: `Failed to hydrate context: ${errorMsg}`,
      fieldsUpdated: 0,
      importerSummary: [],
    };
  }
}

/**
 * Check which data sources are available for hydration
 *
 * Returns a list of importers and whether they have data to contribute.
 */
export async function checkAvailableDataSourcesAction(
  companyId: string
): Promise<{
  success: boolean;
  sources: Array<{
    id: string;
    name: string;
    hasData: boolean;
  }>;
}> {
  try {
    const company = await getCompanyById(companyId);
    if (!company) {
      console.log('[checkAvailableDataSourcesAction] Company not found:', companyId);
      return {
        success: false,
        sources: [],
      };
    }

    const domain = company.domain || company.website || '';
    console.log('[checkAvailableDataSourcesAction] Checking for company:', {
      companyId,
      companyName: company.name,
      domain,
      website: company.website,
    });
    const available = await checkAvailableImporters(companyId, domain);

    return {
      success: true,
      sources: available.map(a => ({
        id: a.id,
        name: a.label,
        hasData: a.hasData,
      })),
    };
  } catch (error) {
    console.error('[checkAvailableDataSourcesAction] Error:', error);
    return {
      success: false,
      sources: [],
    };
  }
}
