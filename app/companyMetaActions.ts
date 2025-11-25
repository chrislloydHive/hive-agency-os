'use server';

import { revalidatePath } from 'next/cache';
import { updateCompanyMeta } from '@/lib/airtable/companies';
import type { CompanyRecord } from '@/lib/airtable/companies';

export type UpdateCompanyMetaParams = {
  companyId: string;
  stage?: CompanyRecord['stage'];
  lifecycleStatus?: string;
  tier?: CompanyRecord['tier'];
  owner?: string;
  tags?: string[];
  internalNotes?: string;
};

export type UpdateCompanyMetaResult = {
  success: boolean;
  company?: CompanyRecord;
  error?: string;
};

/**
 * Server action to update company meta fields
 *
 * Validates input, calls Airtable update, and revalidates paths
 */
export async function updateCompanyMetaAction(
  params: UpdateCompanyMetaParams
): Promise<UpdateCompanyMetaResult> {
  try {
    const { companyId, ...metaFields } = params;

    // Validate companyId
    if (!companyId || !companyId.startsWith('rec')) {
      return {
        success: false,
        error: 'Invalid company ID',
      };
    }

    // Validate stage if provided
    if (metaFields.stage) {
      const validStages: CompanyRecord['stage'][] = [
        'Prospect',
        'Client',
        'Internal',
        'Dormant',
        'Lost',
      ];
      if (!validStages.includes(metaFields.stage)) {
        return {
          success: false,
          error: `Invalid stage: ${metaFields.stage}`,
        };
      }
    }

    // Validate tier if provided
    if (metaFields.tier) {
      const validTiers: CompanyRecord['tier'][] = ['A', 'B', 'C'];
      if (!validTiers.includes(metaFields.tier)) {
        return {
          success: false,
          error: `Invalid tier: ${metaFields.tier}`,
        };
      }
    }

    // Update company meta in Airtable
    const updatedCompany = await updateCompanyMeta({
      companyId,
      ...metaFields,
    });

    if (!updatedCompany) {
      return {
        success: false,
        error: 'Failed to update company meta',
      };
    }

    // Revalidate relevant paths
    revalidatePath('/os'); // Directory view
    revalidatePath(`/c/${companyId}`); // Company detail view
    revalidatePath(`/c/${companyId}/control`); // Control panel

    return {
      success: true,
      company: updatedCompany,
    };
  } catch (error) {
    console.error('[Server Action] Error updating company meta:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
