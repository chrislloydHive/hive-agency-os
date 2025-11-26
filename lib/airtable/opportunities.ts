// lib/airtable/opportunities.ts
// Airtable helpers for A-Lead Tracker (Opportunities) table

import { base } from './client';
import type {
  OpportunityItem,
  OpportunityStage,
  LeadStatus,
} from '@/lib/types/pipeline';

// Table name - using A-Lead Tracker as specified
const TABLE_NAME = 'A-Lead Tracker';

/**
 * Fetch all opportunities from A-Lead Tracker
 */
export async function getAllOpportunities(
  options: {
    maxRecords?: number;
    filterByFormula?: string;
  } = {}
): Promise<OpportunityItem[]> {
  const { maxRecords = 200, filterByFormula } = options;

  try {
    const selectOptions: any = {
      sort: [{ field: 'Close Date', direction: 'asc' }],
      maxRecords,
    };

    if (filterByFormula) {
      selectOptions.filterByFormula = filterByFormula;
    }

    const records = await base(TABLE_NAME).select(selectOptions).all();

    return records.map(parseOpportunityRecord);
  } catch (error) {
    console.error('[Opportunities] Failed to fetch from A-Lead Tracker:', error);
    return [];
  }
}

/**
 * Fetch a single opportunity by ID
 */
export async function getOpportunityById(
  id: string
): Promise<OpportunityItem | null> {
  try {
    const record = await base(TABLE_NAME).find(id);
    return parseOpportunityRecord(record);
  } catch (error) {
    console.error('[Opportunities] Failed to fetch opportunity:', id, error);
    return null;
  }
}

/**
 * Fetch opportunities for a specific company
 */
export async function getOpportunitiesForCompany(
  companyId: string,
  limit: number = 10
): Promise<OpportunityItem[]> {
  try {
    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: `FIND("${companyId}", ARRAYJOIN({Company}))`,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: limit,
      })
      .all();

    return records.map(parseOpportunityRecord);
  } catch (error) {
    console.error(
      '[Opportunities] Failed to fetch for company:',
      companyId,
      error
    );
    return [];
  }
}

/**
 * Create a new opportunity
 */
export async function createOpportunity(
  data: Partial<OpportunityItem>
): Promise<OpportunityItem | null> {
  try {
    const fields: any = {};

    if (data.deliverableName) fields['Deliverable Name'] = data.deliverableName;
    if (data.companyName) fields['Company Name (from Notes)'] = data.companyName;
    if (data.stage) fields['Stage'] = data.stage;
    if (data.leadStatus) fields['Lead Status'] = data.leadStatus;
    if (data.owner) fields['Owner'] = data.owner;
    if (data.value) fields['Value'] = data.value;
    if (data.probability) fields['Probability'] = data.probability;
    if (data.closeDate) fields['Close Date'] = data.closeDate;
    if (data.notes) fields['Company Notes'] = data.notes;
    if (data.repNotes) fields['Rep Notes'] = data.repNotes;
    if (data.companyId) fields['Company'] = [data.companyId];
    if (data.leadId) fields['Lead'] = [data.leadId];

    const record = await base(TABLE_NAME).create(fields);
    return parseOpportunityRecord(record);
  } catch (error) {
    console.error('[Opportunities] Failed to create opportunity:', error);
    return null;
  }
}

/**
 * Update an opportunity
 */
export async function updateOpportunity(
  id: string,
  data: Partial<OpportunityItem>
): Promise<OpportunityItem | null> {
  try {
    const fields: any = {};

    if (data.deliverableName !== undefined)
      fields['Deliverable Name'] = data.deliverableName;
    if (data.stage !== undefined) fields['Stage'] = data.stage;
    if (data.leadStatus !== undefined) fields['Lead Status'] = data.leadStatus;
    if (data.owner !== undefined) fields['Owner'] = data.owner;
    if (data.value !== undefined) fields['Value'] = data.value;
    if (data.probability !== undefined) fields['Probability'] = data.probability;
    if (data.closeDate !== undefined) fields['Close Date'] = data.closeDate;
    if (data.notes !== undefined) fields['Company Notes'] = data.notes;
    if (data.repNotes !== undefined) fields['Rep Notes'] = data.repNotes;

    const record = await base(TABLE_NAME).update(id, fields);
    return parseOpportunityRecord(record);
  } catch (error) {
    console.error('[Opportunities] Failed to update opportunity:', id, error);
    return null;
  }
}

/**
 * Parse Airtable record to OpportunityItem
 */
function parseOpportunityRecord(record: any): OpportunityItem {
  const fields = record.fields;

  // Get company name from various possible fields
  const companyName =
    (fields['Company Name (from Notes)'] as string) ||
    (fields['Company Name'] as string) ||
    (Array.isArray(fields['Company Name (from Company)'])
      ? fields['Company Name (from Company)'][0]
      : (fields['Company Name (from Company)'] as string)) ||
    'Unknown Company';

  // Get company ID from linked field
  const companyId = Array.isArray(fields['Company'])
    ? fields['Company'][0]
    : (fields['Company'] as string | undefined);

  // Get lead ID from linked field
  const leadId = Array.isArray(fields['Lead'])
    ? fields['Lead'][0]
    : (fields['Lead'] as string | undefined);

  return {
    id: record.id,
    companyName,
    deliverableName: fields['Deliverable Name'] as string | undefined,
    stage: (fields['Stage'] as OpportunityStage) || 'Discovery',
    leadStatus: fields['Lead Status'] as LeadStatus | undefined,
    owner: fields['Owner'] as string | undefined,
    value: fields['Value'] as number | undefined,
    probability: fields['Probability'] as number | undefined,
    closeDate: fields['Close Date'] as string | undefined,
    createdAt: fields['Created At'] as string | undefined,
    notes: fields['Company Notes'] as string | undefined,
    repNotes: fields['Rep Notes'] as string | undefined,
    nextSteps: fields['Next Steps'] as string | undefined,
    companyId,
    leadId,
    // Snapshot fields if available
    snapshotScore: fields['Snapshot Score'] as number | undefined,
    snapshotDate: fields['Snapshot Date'] as string | undefined,
    // CRM enrichment from lookup fields
    companyStage: Array.isArray(fields['Company Stage'])
      ? fields['Company Stage'][0]
      : (fields['Company Stage'] as string | undefined),
    companyDomain: Array.isArray(fields['Company Domain'])
      ? fields['Company Domain'][0]
      : (fields['Company Domain'] as string | undefined),
    companyIndustry: Array.isArray(fields['Industry'])
      ? fields['Industry'][0]
      : (fields['Industry'] as string | undefined),
    icpFitScore: fields['ICP Fit Score'] as number | undefined,
  };
}

/**
 * Get pipeline summary stats
 */
export async function getOpportunitySummary(): Promise<{
  total: number;
  active: number;
  activeValue: number;
  weightedValue: number;
  byStage: Record<string, { count: number; value: number }>;
}> {
  const opportunities = await getAllOpportunities();

  const activeStages = ['Discovery', 'Proposal', 'Contract'];
  const active = opportunities.filter((o) => activeStages.includes(o.stage));

  const activeValue = active.reduce((sum, o) => sum + (o.value || 0), 0);
  const weightedValue = active.reduce(
    (sum, o) => sum + (o.value || 0) * ((o.probability || 50) / 100),
    0
  );

  const byStage: Record<string, { count: number; value: number }> = {};
  for (const stage of ['Discovery', 'Proposal', 'Contract', 'Won', 'Lost']) {
    const stageOpps = opportunities.filter((o) => o.stage === stage);
    byStage[stage] = {
      count: stageOpps.length,
      value: stageOpps.reduce((sum, o) => sum + (o.value || 0), 0),
    };
  }

  return {
    total: opportunities.length,
    active: active.length,
    activeValue,
    weightedValue,
    byStage,
  };
}
