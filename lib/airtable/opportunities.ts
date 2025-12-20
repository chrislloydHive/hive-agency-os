// lib/airtable/opportunities.ts
// Airtable helpers for Opportunities

import { getBase } from '@/lib/airtable';
import type { OpportunityItem, PipelineStage } from '@/lib/types/pipeline';
import { normalizeStage } from '@/lib/types/pipeline';
import { getOpportunitiesTableName, isAirtableAuthError, formatAirtableError } from './config';

/**
 * Get the configured Opportunities table name.
 * Uses AIRTABLE_OPPORTUNITIES_TABLE env var, defaults to "Opportunities".
 */
function getTableName(): string {
  return getOpportunitiesTableName();
}

/**
 * Map Airtable record to OpportunityItem
 */
function mapRecordToOpportunity(record: any): OpportunityItem {
  const fields = record.fields;

  // Company is a linked record field - extract first ID
  const companyLinks = fields['Company'] as string[] | undefined;
  const companyId = companyLinks?.[0] || null;

  // Get company name from lookup or direct field
  const companyNameFromLookup = fields['Company Name (from Notes)'] as string[] | undefined;
  const companyName = companyNameFromLookup?.[0] || fields['Company Name'] || 'Unknown';

  // Normalize deal health from Airtable
  const rawDealHealth = (fields['Deal Health'] as string)?.toLowerCase().replace(/\s+/g, '_');
  const dealHealth = ['on_track', 'at_risk', 'stalled'].includes(rawDealHealth)
    ? (rawDealHealth as 'on_track' | 'at_risk' | 'stalled')
    : null;

  // Engagements is a linked record field - extract IDs
  const engagementLinks = fields['Engagements'] as string[] | undefined;
  const engagements = engagementLinks && engagementLinks.length > 0 ? engagementLinks : null;

  // Normalize budget confidence from Airtable
  const rawBudgetConfidence = (fields['Budget Confidence'] as string)?.toLowerCase().replace(/\s+/g, '_');
  const budgetConfidence = ['confirmed', 'likely', 'unknown', 'no_budget'].includes(rawBudgetConfidence)
    ? (rawBudgetConfidence as 'confirmed' | 'likely' | 'unknown' | 'no_budget')
    : null;

  return {
    id: record.id,
    companyId,
    companyName,
    deliverableName: fields['Name'] || null,
    stage: normalizeStage(fields['Stage']),
    leadStatus: fields['Lead Status'] || null,
    owner: fields['Opportunity Owner'] || null,
    value: typeof fields['Value (USD)'] === 'number' ? fields['Value (USD)'] : null,
    closeDate: fields['Expected Close Date'] || null,
    createdAt: fields['Created At'] || null,
    notes: fields['Notes'] || null,
    source: fields['Opportunity Source'] || null,

    // Workflow fields - primary indicators
    nextStep: fields['Next Step'] || null,
    nextStepDue: fields['Next Step Due Date'] || null,
    lastActivityAt: fields['Last Meaningful Activity At'] || null,
    stageEnteredAt: fields['Stage Entered At'] || null,

    // Deal Health from Airtable
    dealHealth,

    // Airtable-managed linked records and fields
    engagements,
    opportunityType: fields['Opportunity Type'] || null,

    // Buying Process fields
    decisionOwner: fields['Decision Owner'] || null,
    decisionDate: fields['Decision Date'] || null,
    budgetConfidence,
    knownCompetitors: fields['Known Competitors'] || null,

    // RFP-specific fields
    rfpDueDate: fields['Due Date'] || null,
    rfpDecisionDate: fields['RFP Decision Date'] || null,
    rfpLink: fields['RFP Link'] || null,

    // CRM fields if available via lookup
    industry: fields['Industry'] || null,
    companyType: fields['Company Type'] || null,
    sizeBand: fields['Size Band'] || null,

    // Activity thread fields (from Airtable rollups, if configured)
    // These are optional - will be null if rollup fields don't exist
    activitiesCount: typeof fields['Activities Count'] === 'number' ? fields['Activities Count'] : null,
    externalThreadUrl: fields['External Thread URL'] || fields['Thread URL'] || null,
    gmailThreadId: fields['Gmail Thread ID'] || fields['External Thread ID'] || null,
  };
}

/**
 * Get all opportunities from Airtable
 */
export async function getAllOpportunities(): Promise<OpportunityItem[]> {
  const tableName = getTableName();
  try {
    const base = getBase();
    // Don't specify sort - let Airtable return default order
    // Field names vary between Airtable bases
    const records = await base(tableName)
      .select({
        maxRecords: 200,
      })
      .all();

    console.log(`[Opportunities] Fetched ${records.length} records from ${tableName}`);

    // Sort client-side by created date (most recent first)
    const opportunities = records.map(mapRecordToOpportunity);

    // Debug: log stages to verify normalization
    const stageCounts = opportunities.reduce((acc, o) => {
      acc[o.stage] = (acc[o.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Opportunities] Stage distribution:`, stageCounts);

    return opportunities.sort((a, b) => {
      const dateA = a.closeDate || a.createdAt || '';
      const dateB = b.closeDate || b.createdAt || '';
      return dateA.localeCompare(dateB);
    });
  } catch (error: any) {
    // Surface auth errors clearly - don't silently return empty
    if (isAirtableAuthError(error)) {
      const msg = formatAirtableError(error, tableName);
      console.error(`[Opportunities] ${msg}`);
      throw new Error(msg);
    }
    // Extract useful error info from Airtable SDK errors
    const errorMessage = error?.message || error?.error || 'Unknown error';
    const statusCode = error?.statusCode;
    console.error(
      `[Opportunities] Failed to fetch from table "${tableName}":`,
      statusCode ? `[${statusCode}]` : '',
      errorMessage
    );
    // If table doesn't exist, log helpful message
    if (statusCode === 404 || errorMessage?.includes('NOT_FOUND')) {
      console.warn(
        `[Opportunities] Table "${tableName}" not found. ` +
        'Set AIRTABLE_OPPORTUNITIES_TABLE env var or create the table in Airtable.'
      );
    }
    throw error; // Re-throw so callers can handle
  }
}

/**
 * Get a single opportunity by ID
 */
export async function getOpportunityById(id: string): Promise<OpportunityItem | null> {
  const tableName = getTableName();
  try {
    const base = getBase();
    const record = await base(tableName).find(id);
    return record ? mapRecordToOpportunity(record) : null;
  } catch (error) {
    if (isAirtableAuthError(error)) {
      throw new Error(formatAirtableError(error, tableName));
    }
    console.error(`[Opportunities] Failed to fetch opportunity ${id}:`, error);
    throw error;
  }
}

/**
 * @deprecated Use updateOpportunity() instead for all stage updates
 * Update opportunity stage - kept for backwards compatibility
 */
export async function updateOpportunityStage(
  id: string,
  stage: PipelineStage
): Promise<void> {
  // Delegate to unified updateOpportunity path
  await updateOpportunity(id, { stage });
}

/**
 * @deprecated Opportunity scoring is no longer used. Deal Health is managed in Airtable.
 * This function is a no-op kept for backwards compatibility.
 */
export async function updateOpportunityScore(
  _id: string,
  _score: number,
  _explanation?: string
): Promise<void> {
  console.warn('[Opportunities] DEPRECATED: updateOpportunityScore is no longer used. Deal Health is managed in Airtable.');
  // No-op - scoring is deprecated
}

/**
 * Airtable field name for normalized domain on Opportunities
 * Used for hardened duplicate detection
 */
const OPPORTUNITY_DOMAIN_FIELD = 'Normalized Domain';

/**
 * Create a new opportunity
 */
export async function createOpportunity(params: {
  companyId?: string;
  name: string;
  stage?: PipelineStage;
  value?: number;
  closeDate?: string;
  owner?: string;
  notes?: string;
  nextStep?: string;
  nextStepDue?: string;
  source?: string;
  opportunityType?: string;
  sourceLeadId?: string;
  /** Normalized domain for duplicate detection (e.g., "example.com") */
  normalizedDomain?: string;
}): Promise<OpportunityItem | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      'Name': params.name,
      Stage: params.stage ? getAirtableStage(params.stage) : 'Interest Confirmed',
    };

    if (params.companyId) {
      fields['Company'] = [params.companyId];
    }
    if (params.value !== undefined) {
      fields['Value (USD)'] = params.value;
    }
    if (params.closeDate) {
      fields['Expected Close Date'] = params.closeDate;
    }
    if (params.owner) {
      fields['Opportunity Owner'] = params.owner;
    }
    if (params.notes) {
      fields['Notes'] = params.notes;
    }
    if (params.nextStep) {
      fields['Next Step'] = params.nextStep;
    }
    if (params.nextStepDue) {
      fields['Next Step Due Date'] = params.nextStepDue;
    }
    if (params.source) {
      fields['Opportunity Source'] = params.source;
    }
    if (params.opportunityType) {
      fields['Opportunity Type'] = params.opportunityType;
    }
    if (params.sourceLeadId) {
      fields['Source Lead'] = [params.sourceLeadId];
    }
    // Hardened duplicate detection: store normalized domain
    if (params.normalizedDomain) {
      fields[OPPORTUNITY_DOMAIN_FIELD] = params.normalizedDomain;
    }

    const records = await base(getTableName()).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[Opportunities] Created opportunity: ${createdRecord.id}`);
    return mapRecordToOpportunity(createdRecord);
  } catch (error: any) {
    // If Normalized Domain field doesn't exist, retry without it
    if (params.normalizedDomain && (error?.message?.includes(OPPORTUNITY_DOMAIN_FIELD) || error?.message?.includes('UNKNOWN_FIELD'))) {
      console.warn(`[Opportunities] ${OPPORTUNITY_DOMAIN_FIELD} field not found - creating without it`);
      return createOpportunity({ ...params, normalizedDomain: undefined });
    }
    if (isAirtableAuthError(error)) {
      throw new Error(formatAirtableError(error, getTableName()));
    }
    console.error('[Opportunities] Failed to create opportunity:', error);
    throw error;
  }
}

/**
 * Find an open DMA Full GAP opportunity for a company
 *
 * Used for idempotent DMA lead conversion - reuses existing opportunities
 * instead of creating duplicates.
 *
 * Search criteria (prevents duplicates without "Converted Opportunity" field):
 * - Company = companyId
 * - Opportunity Type = "Inbound Interest"
 * - Opportunity Source = "DMA Full GAP"
 * - Stage != Won/Lost/Dormant (OPEN opportunities only)
 * - Normalized Domain = normalizedDomain (if field exists, hardened match)
 *
 * @param companyId - Airtable record ID of the company
 * @param options.inboundLeadId - Optional: also match Source Lead if provided
 * @param options.normalizedDomain - Optional: hardened match on domain
 * @returns Open opportunity or null if not found
 */
export async function findOpenDmaOpportunityForCompany(
  companyId: string,
  options?: { inboundLeadId?: string; normalizedDomain?: string }
): Promise<OpportunityItem | null> {
  const { inboundLeadId, normalizedDomain } = options || {};

  // Try with domain filter first (hardened), fall back to without if field doesn't exist
  const tryFindWithDomain = async (includeDomain: boolean): Promise<OpportunityItem | null> => {
    try {
      const base = getBase();

      // Build filter: Company + Type + Source + Open Stage + optional Domain
      const filterParts = [
        `FIND("${companyId}", ARRAYJOIN({Company})) > 0`,
        `{Opportunity Type} = "Inbound Interest"`,
        `{Opportunity Source} = "DMA Full GAP"`,
        `NOT(OR({Stage} = "Won", {Stage} = "Lost", {Stage} = "Dormant"))`,
      ];

      // Hardened: include domain match if available
      if (includeDomain && normalizedDomain) {
        filterParts.push(`{${OPPORTUNITY_DOMAIN_FIELD}} = "${normalizedDomain}"`);
      }

      const filterFormula = `AND(${filterParts.join(', ')})`;

      const records = await base(getTableName())
        .select({
          filterByFormula: filterFormula,
          maxRecords: 1,
          sort: [{ field: 'Created At', direction: 'desc' }],
        })
        .firstPage();

      if (records.length === 0) {
        return null;
      }

      const opportunity = mapRecordToOpportunity(records[0]);

      // If inboundLeadId provided, verify it matches Source Lead (if that field exists)
      // This is optional - we don't fail if Source Lead is missing
      if (inboundLeadId) {
        const sourceLeadLinks = records[0].fields['Source Lead'] as string[] | undefined;
        if (sourceLeadLinks && sourceLeadLinks.length > 0) {
          if (!sourceLeadLinks.includes(inboundLeadId)) {
            console.log(`[Opportunities] Found opportunity ${opportunity.id} but Source Lead differs (reusing anyway)`);
          }
        }
      }

      if (includeDomain && normalizedDomain) {
        console.log(`[Opportunities] Found opportunity with domain match: ${opportunity.id} (${normalizedDomain})`);
      }

      return opportunity;
    } catch (error: any) {
      // If domain field doesn't exist and we tried to use it, retry without
      if (includeDomain && normalizedDomain && error?.message?.includes(OPPORTUNITY_DOMAIN_FIELD)) {
        console.warn(`[Opportunities] ${OPPORTUNITY_DOMAIN_FIELD} field not found - searching without domain filter`);
        return tryFindWithDomain(false);
      }
      throw error;
    }
  };

  try {
    // Try with domain filter first if domain provided
    return await tryFindWithDomain(!!normalizedDomain);
  } catch (error) {
    console.error(`[Opportunities] Failed to find open DMA opportunity for company ${companyId}:`, error);
    return null;
  }
}

/**
 * Get or create a DMA Full GAP opportunity for an inbound lead
 *
 * Idempotent upsert logic (no schema changes required):
 * 1. Search for OPEN opportunity with:
 *    - Company = companyId
 *    - Opportunity Type = "Inbound Interest"
 *    - Opportunity Source = "DMA Full GAP"
 *    - Normalized Domain = normalizedDomain (hardened, if field exists)
 *    - Stage != Won/Lost/Dormant
 * 2. If found → return it (reused: true)
 * 3. Else → create new with:
 *    - Stage = "Interest Confirmed"
 *    - Opportunity Type = "Inbound Interest"
 *    - Opportunity Source = "DMA Full GAP"
 *    - Normalized Domain = normalizedDomain (written if field exists)
 *    - Source Lead = inboundLeadId
 *    - Deliverable Name = "DMA Full GAP — {normalizedDomain}"
 *
 * Safety:
 * - Never creates Engagements
 * - If Source Lead or Normalized Domain fields missing, logs warning but continues
 *
 * @returns { opportunity, isNew: boolean, reused: boolean }
 */
export async function getOrCreateDmaOpportunityForLead(params: {
  companyId: string;
  inboundLeadId: string;
  normalizedDomain: string;
}): Promise<{ opportunity: OpportunityItem; isNew: boolean; reused: boolean }> {
  const { companyId, inboundLeadId, normalizedDomain } = params;

  // Step 1: Search for existing open opportunity (with hardened domain match if field exists)
  const existing = await findOpenDmaOpportunityForCompany(companyId, {
    inboundLeadId,
    normalizedDomain,
  });
  if (existing) {
    console.log(`[Opportunities] Reusing existing DMA Full GAP opportunity: ${existing.id} for ${normalizedDomain}`);
    return { opportunity: existing, isNew: false, reused: true };
  }

  // Step 2: Create new opportunity (with domain for hardened dedup)
  console.log(`[Opportunities] Creating new DMA Full GAP opportunity for ${normalizedDomain}`);

  try {
    const newOpportunity = await createOpportunity({
      companyId,
      name: `DMA Full GAP — ${normalizedDomain}`,
      stage: 'interest_confirmed',
      source: 'DMA Full GAP',
      opportunityType: 'Inbound Interest',
      sourceLeadId: inboundLeadId,
      normalizedDomain, // Hardened: store domain for future dedup
      nextStep: 'Review audit + respond',
    });

    if (!newOpportunity) {
      throw new Error(`Failed to create opportunity for company ${companyId}`);
    }

    console.log(`[Opportunities] Created new DMA Full GAP opportunity: ${newOpportunity.id}`);
    return { opportunity: newOpportunity, isNew: true, reused: false };
  } catch (error: any) {
    // Check if Source Lead field doesn't exist (Normalized Domain fallback handled in createOpportunity)
    if (error?.message?.includes('Source Lead') || error?.message?.includes('UNKNOWN_FIELD')) {
      console.warn(`[Opportunities] Source Lead field may not exist in Airtable - creating without it`);
      // Retry without sourceLeadId
      const newOpportunity = await createOpportunity({
        companyId,
        name: `DMA Full GAP — ${normalizedDomain}`,
        stage: 'interest_confirmed',
        source: 'DMA Full GAP',
        opportunityType: 'Inbound Interest',
        normalizedDomain, // Still try domain
        nextStep: 'Review audit + respond',
      });

      if (!newOpportunity) {
        throw new Error(`Failed to create opportunity for company ${companyId}`);
      }

      return { opportunity: newOpportunity, isNew: true, reused: false };
    }
    throw error;
  }
}

/**
 * @deprecated Use getOrCreateDmaOpportunityForLead instead
 * Upsert opportunity for DMA lead conversion (legacy)
 */
export async function upsertOpportunityForDma(params: {
  companyId: string;
  companyName: string;
  sourceLeadId: string;
  nextStep?: string;
}): Promise<{ opportunity: OpportunityItem; isNew: boolean }> {
  // Delegate to new function
  const result = await getOrCreateDmaOpportunityForLead({
    companyId: params.companyId,
    inboundLeadId: params.sourceLeadId,
    normalizedDomain: params.companyName, // Use company name as fallback
  });
  return { opportunity: result.opportunity, isNew: result.isNew };
}

/**
 * Convert PipelineStage to Airtable stage string
 */
function getAirtableStage(stage: PipelineStage): string {
  const stageMap: Record<PipelineStage, string> = {
    interest_confirmed: 'Interest Confirmed',
    discovery_clarification: 'Discovery / Clarification',
    solution_shaping: 'Solution Shaping',
    proposal_submitted: 'Proposal / RFP Submitted',
    decision: 'Decision',
    won: 'Won',
    lost: 'Lost',
    dormant: 'Dormant',
  };
  return stageMap[stage] || 'Interest Confirmed';
}

/**
 * Update an opportunity with partial data
 * Automatically sets Last Activity At timestamp
 *
 * Null-clearing: Pass null or empty string to clear a field.
 * Fields that support clearing: nextStep, nextStepDue, source, owner,
 * decisionOwner, decisionDate, knownCompetitors, budgetConfidence,
 * rfpDueDate, rfpDecisionDate, rfpLink
 *
 * Airtable Field Names (canonical):
 * - "Opportunity Source" (source)
 * - "Decision Owner", "Decision Date", "Budget Confidence", "Known Competitors"
 * - "RFP Due Date", "RFP Decision Date", "RFP Link"
 */
export async function updateOpportunity(
  id: string,
  updates: Partial<{
    stage: PipelineStage;
    value: number;
    deliverableName: string | null;
    closeDate: string | null;
    owner: string | null;
    notes: string | null;
    source: string | null;
    nextStep: string | null;
    nextStepDue: string | null;
    decisionOwner: string | null;
    decisionDate: string | null;
    budgetConfidence: string | null;
    knownCompetitors: string | null;
    rfpDueDate: string | null;
    rfpDecisionDate: string | null;
    rfpLink: string | null;
  }>
): Promise<OpportunityItem | null> {
  // Inner function to attempt update, with option to skip activity timestamp
  const attemptUpdate = async (includeActivityAt: boolean): Promise<OpportunityItem | null> => {
    const base = getBase();
    const fields: Record<string, unknown> = {};

    // Optionally update lastActivityAt (skip if field doesn't exist)
    if (includeActivityAt) {
      fields['Last Activity At'] = new Date().toISOString();
    }

    // Helper: convert empty string to null for Airtable
    const toAirtable = (val: string | null | undefined): string | null =>
      val === '' ? null : (val ?? null);

    if (updates.stage !== undefined) {
      fields['Stage'] = getAirtableStage(updates.stage);
    }
    if (updates.value !== undefined) {
      fields['Value (USD)'] = updates.value;
    }
    if (updates.deliverableName !== undefined) {
      fields['Name'] = toAirtable(updates.deliverableName);
    }
    if (updates.closeDate !== undefined) {
      fields['Expected Close Date'] = toAirtable(updates.closeDate);
    }
    if (updates.owner !== undefined) {
      fields['Opportunity Owner'] = toAirtable(updates.owner);
    }
    if (updates.notes !== undefined) {
      fields['Notes'] = toAirtable(updates.notes);
    }
    if (updates.source !== undefined) {
      fields['Opportunity Source'] = toAirtable(updates.source);
    }
    if (updates.nextStep !== undefined) {
      fields['Next Step'] = toAirtable(updates.nextStep);
    }
    if (updates.nextStepDue !== undefined) {
      fields['Next Step Due Date'] = toAirtable(updates.nextStepDue);
    }
    // Buying Process fields
    if (updates.decisionOwner !== undefined) {
      fields['Decision Owner'] = toAirtable(updates.decisionOwner);
    }
    if (updates.decisionDate !== undefined) {
      fields['Decision Date'] = toAirtable(updates.decisionDate);
    }
    if (updates.budgetConfidence !== undefined) {
      fields['Budget Confidence'] = toAirtable(updates.budgetConfidence);
    }
    if (updates.knownCompetitors !== undefined) {
      fields['Known Competitors'] = toAirtable(updates.knownCompetitors);
    }
    // RFP fields
    if (updates.rfpDueDate !== undefined) {
      fields['Due Date'] = toAirtable(updates.rfpDueDate);
    }
    if (updates.rfpDecisionDate !== undefined) {
      fields['RFP Decision Date'] = toAirtable(updates.rfpDecisionDate);
    }
    if (updates.rfpLink !== undefined) {
      fields['RFP Link'] = toAirtable(updates.rfpLink);
    }

    console.log(`[Opportunities] Updating ${id} with fields:`, JSON.stringify(fields, null, 2));

    const records = await base(getTableName()).update([
      { id, fields: fields as any },
    ]);

    console.log(`[Opportunities] Updated opportunity ${id}`);
    return records[0] ? mapRecordToOpportunity(records[0]) : null;
  };

  try {
    // First attempt with activity timestamp
    return await attemptUpdate(true);
  } catch (error) {
    const airtableError = error as any;
    const errorMessage = airtableError?.message || airtableError?.error?.message || '';

    // If "Last Activity At" field doesn't exist, retry without it
    if (errorMessage.includes('Last Activity At') || errorMessage.includes('UNKNOWN_FIELD')) {
      console.warn('[Opportunities] "Last Activity At" field not found - retrying without it');
      try {
        return await attemptUpdate(false);
      } catch (retryError) {
        if (isAirtableAuthError(retryError)) {
          throw new Error(formatAirtableError(retryError, getTableName()));
        }
        const retryErrorDetails = (retryError as any)?.message || 'Unknown error';
        console.error(`[Opportunities] Failed to update opportunity ${id}:`, retryErrorDetails, retryError);
        throw new Error(`Failed to update opportunity: ${retryErrorDetails}`);
      }
    }

    if (isAirtableAuthError(error)) {
      throw new Error(formatAirtableError(error, getTableName()));
    }
    const errorDetails = errorMessage || 'Unknown error';
    console.error(`[Opportunities] Failed to update opportunity ${id}:`, errorDetails, error);
    throw new Error(`Failed to update opportunity: ${errorDetails}`);
  }
}

/**
 * Get overdue opportunities (next step due date is in the past)
 * Only returns open opportunities (not won, lost, or dormant)
 * Returns empty array if Next Step Due field doesn't exist in Airtable
 */
export async function getOverdueOpportunities(limit = 10): Promise<OpportunityItem[]> {
  try {
    // First, fetch all open opportunities and filter client-side
    // This avoids formula errors if 'Next Step Due' field doesn't exist
    const allOpps = await getAllOpportunities();
    const today = new Date().toISOString().split('T')[0];

    const overdueOpps = allOpps
      .filter((opp) => {
        // Must have a due date
        if (!opp.nextStepDue) return false;
        // Due date must be in the past
        if (opp.nextStepDue >= today) return false;
        // Must be an open stage
        const openStages = ['interest_confirmed', 'discovery_clarification', 'solution_shaping', 'proposal_submitted', 'decision'];
        return openStages.includes(opp.stage);
      })
      .sort((a, b) => {
        // Sort by due date ascending (most overdue first)
        return (a.nextStepDue || '').localeCompare(b.nextStepDue || '');
      })
      .slice(0, limit);

    return overdueOpps;
  } catch (error) {
    console.error('[Opportunities] Failed to fetch overdue opportunities:', error);
    return [];
  }
}

/**
 * Count total overdue opportunities
 * Returns 0 if Next Step Due field doesn't exist in Airtable
 */
export async function countOverdueOpportunities(): Promise<number> {
  try {
    // Use client-side filtering to avoid formula errors
    const allOpps = await getAllOpportunities();
    const today = new Date().toISOString().split('T')[0];

    const overdueCount = allOpps.filter((opp) => {
      if (!opp.nextStepDue) return false;
      if (opp.nextStepDue >= today) return false;
      const openStages = ['interest_confirmed', 'discovery_clarification', 'solution_shaping', 'proposal_submitted', 'decision'];
      return openStages.includes(opp.stage);
    }).length;

    return overdueCount;
  } catch (error) {
    console.error('[Opportunities] Failed to count overdue opportunities:', error);
    return 0;
  }
}
