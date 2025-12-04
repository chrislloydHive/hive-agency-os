// lib/brain/companyBrain.ts
// Company Brain Storage
//
// Stores and retrieves Company Brain data from Airtable.
// Company Brain is the aggregated intelligence about a company
// built from diagnostics, user inputs, and AI analysis.

// ============================================================================
// Types
// ============================================================================

export interface CompanyBrain {
  id: string;
  companyId: string;

  // High-level summaries
  businessSummary?: string;
  brandSummary?: string;
  websiteSummary?: string;
  contentSummary?: string;
  seoSummary?: string;
  demandSummary?: string;
  opsSummary?: string;

  // Structured data
  valueProps?: string[];
  differentiators?: string[];
  audienceSegments?: string[];
  productLines?: string[];
  competitors?: string[];

  // Metadata
  lastUpdated?: string;
  version?: number;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get Company Brain for a company
 */
export async function getCompanyBrain(
  companyId: string
): Promise<CompanyBrain | null> {
  try {
    // TODO: Implement actual Airtable query for Company Brain table
    // For now, return null - the context builder will fall back to other sources

    console.log(`[CompanyBrain] Getting brain for company: ${companyId}`);

    // Placeholder: try to build from company notes if available
    const { getCompanyById } = await import('@/lib/airtable/companies');
    const company = await getCompanyById(companyId);

    if (!company) {
      return null;
    }

    // Build a basic brain from available company data
    const brain: CompanyBrain = {
      id: `brain-${companyId}`,
      companyId,
      businessSummary: company.notes || undefined,
      lastUpdated: new Date().toISOString(),
      version: 1,
    };

    // TODO: Once Brain table is implemented, load structured fields from there
    // For now, the brain will be populated through AI analysis and manual input

    return brain;
  } catch (error) {
    console.error('[CompanyBrain] Failed to get brain:', error);
    return null;
  }
}

/**
 * Save Company Brain
 */
export async function saveCompanyBrain(
  brain: Partial<CompanyBrain> & { companyId: string }
): Promise<CompanyBrain> {
  // TODO: Implement actual Airtable save
  console.log(`[CompanyBrain] Saving brain for company: ${brain.companyId}`);

  const { companyId: _, ...restBrain } = brain;
  return {
    id: brain.id || `brain-${brain.companyId}`,
    companyId: brain.companyId,
    ...restBrain,
    lastUpdated: new Date().toISOString(),
    version: (brain.version || 0) + 1,
  };
}

/**
 * Update a specific section of Company Brain
 */
export async function updateBrainSection(
  companyId: string,
  section: keyof CompanyBrain,
  value: unknown
): Promise<void> {
  const brain = await getCompanyBrain(companyId);
  if (!brain) {
    await saveCompanyBrain({ companyId, [section]: value });
    return;
  }

  await saveCompanyBrain({ ...brain, [section]: value });
}
