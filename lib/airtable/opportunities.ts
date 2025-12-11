// lib/airtable/opportunities.ts
// Airtable helpers for Opportunities (A-Lead Tracker)

import { getBase } from '@/lib/airtable';
import type { OpportunityItem, PipelineStage } from '@/lib/types/pipeline';
import { normalizeStage } from '@/lib/types/pipeline';

const OPPORTUNITIES_TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE || 'A-Lead Tracker';

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

  // Normalize probability to 0-1 range
  let probability = fields['Probability'] as number | undefined;
  if (probability && probability > 1) {
    probability = probability / 100;
  }

  return {
    id: record.id,
    companyId,
    companyName,
    deliverableName: fields['Deliverable Name'] || fields['Name'] || null,
    stage: normalizeStage(fields['Stage']),
    leadStatus: fields['Lead Status'] || null,
    owner: fields['Owner'] || fields['Rep'] || null,
    value: typeof fields['Value'] === 'number' ? fields['Value'] : null,
    probability: probability ?? null,
    closeDate: fields['Close Date'] || null,
    createdAt: fields['Created At'] || fields['Created'] || null,
    notes: fields['Rep Notes'] || fields['Notes'] || null,

    // CRM fields if available via lookup
    industry: fields['Industry'] || null,
    companyType: fields['Company Type'] || null,
    sizeBand: fields['Size Band'] || null,
    icpFitScore: typeof fields['ICP Fit Score'] === 'number' ? fields['ICP Fit Score'] : null,
    leadScore: typeof fields['Lead Score'] === 'number' ? fields['Lead Score'] : null,

    // AI scoring fields
    opportunityScore: typeof fields['Opportunity Score'] === 'number'
      ? fields['Opportunity Score']
      : null,
    opportunityScoreExplanation: fields['Opportunity Score Explanation'] || null,
  };
}

/**
 * Get all opportunities from Airtable
 */
export async function getAllOpportunities(): Promise<OpportunityItem[]> {
  try {
    const base = getBase();
    // Don't specify sort - let Airtable return default order
    // Field names vary between Airtable bases
    const records = await base(OPPORTUNITIES_TABLE)
      .select({
        maxRecords: 200,
      })
      .all();

    // Sort client-side by created date (most recent first)
    const opportunities = records.map(mapRecordToOpportunity);
    return opportunities.sort((a, b) => {
      const dateA = a.closeDate || a.createdAt || '';
      const dateB = b.closeDate || b.createdAt || '';
      return dateA.localeCompare(dateB);
    });
  } catch (error: any) {
    // Extract useful error info from Airtable SDK errors
    const errorMessage = error?.message || error?.error || 'Unknown error';
    const statusCode = error?.statusCode;
    console.error(
      `[Opportunities] Failed to fetch from table "${OPPORTUNITIES_TABLE}":`,
      statusCode ? `[${statusCode}]` : '',
      errorMessage
    );
    // If table doesn't exist, log helpful message
    if (statusCode === 404 || errorMessage?.includes('NOT_FOUND')) {
      console.warn(
        `[Opportunities] Table "${OPPORTUNITIES_TABLE}" not found. ` +
        'Set AIRTABLE_OPPORTUNITIES_TABLE env var or create the table in Airtable.'
      );
    }
    return [];
  }
}

/**
 * Get a single opportunity by ID
 */
export async function getOpportunityById(id: string): Promise<OpportunityItem | null> {
  try {
    const base = getBase();
    const record = await base(OPPORTUNITIES_TABLE).find(id);
    return record ? mapRecordToOpportunity(record) : null;
  } catch (error) {
    console.error(`[Opportunities] Failed to fetch opportunity ${id}:`, error);
    return null;
  }
}

/**
 * Update opportunity stage
 */
export async function updateOpportunityStage(
  id: string,
  stage: PipelineStage
): Promise<void> {
  try {
    const base = getBase();

    // Map our stage back to Airtable format
    const stageMap: Record<PipelineStage, string> = {
      discovery: 'Discovery',
      qualification: 'Qualification',
      proposal: 'Proposal',
      negotiation: 'Negotiation',
      closed_won: 'Won',
      closed_lost: 'Lost',
    };

    await base(OPPORTUNITIES_TABLE).update(id, {
      Stage: stageMap[stage] || stage,
    } as any);

    console.log(`[Opportunities] Updated opportunity ${id} stage to ${stage}`);
  } catch (error) {
    console.error(`[Opportunities] Failed to update stage for ${id}:`, error);
    throw error;
  }
}

/**
 * Update opportunity AI score
 */
export async function updateOpportunityScore(
  id: string,
  score: number,
  explanation?: string
): Promise<void> {
  try {
    const base = getBase();
    const fields: Record<string, unknown> = {
      'Opportunity Score': score,
    };

    if (explanation) {
      fields['Opportunity Score Explanation'] = explanation;
    }

    await base(OPPORTUNITIES_TABLE).update(id, fields as any);
    console.log(`[Opportunities] Updated opportunity ${id} score to ${score}`);
  } catch (error) {
    console.error(`[Opportunities] Failed to update score for ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new opportunity
 */
export async function createOpportunity(params: {
  companyId?: string;
  name: string;
  stage?: PipelineStage;
  value?: number;
  probability?: number;
  closeDate?: string;
  owner?: string;
  notes?: string;
}): Promise<OpportunityItem | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      'Deliverable Name': params.name,
      Stage: params.stage ? getAirtableStage(params.stage) : 'Discovery',
    };

    if (params.companyId) {
      fields['Company'] = [params.companyId];
    }
    if (params.value !== undefined) {
      fields['Value'] = params.value;
    }
    if (params.probability !== undefined) {
      fields['Probability'] = params.probability * 100; // Store as percentage
    }
    if (params.closeDate) {
      fields['Close Date'] = params.closeDate;
    }
    if (params.owner) {
      fields['Owner'] = params.owner;
    }
    if (params.notes) {
      fields['Rep Notes'] = params.notes;
    }

    const records = await base(OPPORTUNITIES_TABLE).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[Opportunities] Created opportunity: ${createdRecord.id}`);
    return mapRecordToOpportunity(createdRecord);
  } catch (error) {
    console.error('[Opportunities] Failed to create opportunity:', error);
    return null;
  }
}

/**
 * Convert PipelineStage to Airtable stage string
 */
function getAirtableStage(stage: PipelineStage): string {
  const stageMap: Record<PipelineStage, string> = {
    discovery: 'Discovery',
    qualification: 'Qualification',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Won',
    closed_lost: 'Lost',
  };
  return stageMap[stage] || 'Discovery';
}
