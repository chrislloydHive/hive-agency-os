'use server';

import { revalidatePath } from 'next/cache';
import { getCompanyById } from '@/lib/airtable/companies';

/**
 * Run a Quick OS analysis for a company
 * This triggers a lightweight analysis pipeline
 */
export async function runQuickOs(companyId: string): Promise<{
  success: boolean;
  gapRunId?: string;
  error?: string;
}> {
  try {
    console.log('[runQuickOs] Starting quick OS run for company:', companyId);

    // Get company data
    const company = await getCompanyById(companyId);
    if (!company || !company.website) {
      return {
        success: false,
        error: 'Company not found or missing website URL',
      };
    }

    // Call the GAP engine API with OS mode
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/growth-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: company.website,
          companyId,
          mode: 'os',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to start quick OS run');
    }

    console.log('[runQuickOs] Quick OS run started successfully:', data.gapId);

    // Revalidate the control page to show the new run
    revalidatePath(`/c/${companyId}/control`);

    return {
      success: true,
      gapRunId: data.gapId,
    };
  } catch (error) {
    console.error('[runQuickOs] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Run a Deep OS analysis for a company
 * This triggers the full comprehensive analysis pipeline
 */
export async function runDeepOs(companyId: string): Promise<{
  success: boolean;
  gapRunId?: string;
  error?: string;
}> {
  try {
    console.log('[runDeepOs] Starting deep OS run for company:', companyId);

    // Get company data
    const company = await getCompanyById(companyId);
    if (!company || !company.website) {
      return {
        success: false,
        error: 'Company not found or missing website URL',
      };
    }

    // Call the GAP engine API with OS mode
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/growth-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: company.website,
          companyId,
          mode: 'os',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to start deep OS run');
    }

    console.log('[runDeepOs] Deep OS run started successfully:', data.gapId);

    // Revalidate the control page to show the new run
    revalidatePath(`/c/${companyId}/control`);

    return {
      success: true,
      gapRunId: data.gapId,
    };
  } catch (error) {
    console.error('[runDeepOs] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
