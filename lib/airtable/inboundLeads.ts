// lib/airtable/inboundLeads.ts
// Airtable helpers for Inbound Leads table

import { base } from './client';
import type {
  InboundLeadItem,
  InboundLeadStatus,
  LeadSource,
} from '@/lib/types/pipeline';

// Table name
const TABLE_NAME = 'Inbound Leads';

/**
 * Fetch all inbound leads
 */
export async function getAllInboundLeads(
  options: {
    maxRecords?: number;
    filterByFormula?: string;
    status?: InboundLeadStatus;
  } = {}
): Promise<InboundLeadItem[]> {
  const { maxRecords = 200, filterByFormula, status } = options;

  try {
    const selectOptions: any = {
      sort: [{ field: 'Created', direction: 'desc' }],
      maxRecords,
    };

    // Build filter formula
    const filters: string[] = [];
    if (filterByFormula) filters.push(filterByFormula);
    if (status) filters.push(`{Status} = "${status}"`);

    if (filters.length > 0) {
      selectOptions.filterByFormula =
        filters.length === 1 ? filters[0] : `AND(${filters.join(', ')})`;
    }

    const records = await base(TABLE_NAME).select(selectOptions).all();

    return records.map(parseInboundLeadRecord);
  } catch (error) {
    console.error('[Inbound Leads] Failed to fetch leads:', error);
    return [];
  }
}

/**
 * Fetch a single lead by ID
 */
export async function getInboundLeadById(
  id: string
): Promise<InboundLeadItem | null> {
  try {
    const record = await base(TABLE_NAME).find(id);
    return parseInboundLeadRecord(record);
  } catch (error) {
    console.error('[Inbound Leads] Failed to fetch lead:', id, error);
    return null;
  }
}

/**
 * Create a new inbound lead
 */
export async function createInboundLead(
  data: Partial<InboundLeadItem>
): Promise<InboundLeadItem | null> {
  try {
    const fields: any = {};

    if (data.name) fields['Name'] = data.name;
    if (data.email) fields['Email'] = data.email;
    if (data.website) fields['Website'] = data.website;
    if (data.companyName) fields['Company Name'] = data.companyName;
    if (data.leadSource) fields['Lead Source'] = data.leadSource;
    if (data.status) fields['Status'] = data.status;
    if (data.assignee) fields['Assignee'] = data.assignee;
    if (data.notes) fields['Notes'] = data.notes;
    if (data.companyId) fields['Company'] = [data.companyId];
    if (data.gapIaRunId) fields['GAP-IA Run'] = [data.gapIaRunId];

    const record = await base(TABLE_NAME).create(fields);
    return parseInboundLeadRecord(record);
  } catch (error) {
    console.error('[Inbound Leads] Failed to create lead:', error);
    return null;
  }
}

/**
 * Update an inbound lead
 */
export async function updateInboundLead(
  id: string,
  data: Partial<InboundLeadItem>
): Promise<InboundLeadItem | null> {
  try {
    const fields: any = {};

    if (data.name !== undefined) fields['Name'] = data.name;
    if (data.email !== undefined) fields['Email'] = data.email;
    if (data.website !== undefined) fields['Website'] = data.website;
    if (data.companyName !== undefined) fields['Company Name'] = data.companyName;
    if (data.leadSource !== undefined) fields['Lead Source'] = data.leadSource;
    if (data.status !== undefined) fields['Status'] = data.status;
    if (data.assignee !== undefined) fields['Assignee'] = data.assignee;
    if (data.notes !== undefined) fields['Notes'] = data.notes;
    if (data.companyId !== undefined) fields['Company'] = data.companyId ? [data.companyId] : [];
    if (data.gapIaRunId !== undefined)
      fields['GAP-IA Run'] = data.gapIaRunId ? [data.gapIaRunId] : [];

    const record = await base(TABLE_NAME).update(id, fields);
    return parseInboundLeadRecord(record);
  } catch (error) {
    console.error('[Inbound Leads] Failed to update lead:', id, error);
    return null;
  }
}

/**
 * Parse Airtable record to InboundLeadItem
 */
function parseInboundLeadRecord(record: any): InboundLeadItem {
  const fields = record.fields;

  // Get linked IDs
  const companyId = Array.isArray(fields['Company'])
    ? fields['Company'][0]
    : (fields['Company'] as string | undefined);

  const gapIaRunId = Array.isArray(fields['GAP-IA Run'])
    ? fields['GAP-IA Run'][0]
    : (fields['GAP-IA Run'] as string | undefined);

  // Get attachments as array of URLs
  const attachments = Array.isArray(fields['Attachments'])
    ? fields['Attachments'].map((a: any) => a.url)
    : undefined;

  return {
    id: record.id,
    name: fields['Name'] as string | undefined,
    email: fields['Email'] as string | undefined,
    website: fields['Website'] as string | undefined,
    companyName: fields['Company Name'] as string | undefined,
    leadSource: (fields['Lead Source'] as LeadSource) || 'Other',
    status: (fields['Status'] as InboundLeadStatus) || 'New',
    assignee: fields['Assignee'] as string | undefined,
    notes: fields['Notes'] as string | undefined,
    attachments,
    createdAt: fields['Created'] as string | undefined,
    companyId,
    gapIaRunId,
    // Enrichment from lookup fields
    gapIaScore: Array.isArray(fields['GAP Score'])
      ? fields['GAP Score'][0]
      : (fields['GAP Score'] as number | undefined),
    gapIaDate: Array.isArray(fields['GAP Date'])
      ? fields['GAP Date'][0]
      : (fields['GAP Date'] as string | undefined),
  };
}

/**
 * Get lead summary stats
 */
export async function getInboundLeadSummary(): Promise<{
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  bySource: Record<string, number>;
}> {
  const leads = await getAllInboundLeads();

  const bySource: Record<string, number> = {};
  for (const lead of leads) {
    const source = lead.leadSource || 'Other';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    total: leads.length,
    new: leads.filter((l) => l.status === 'New').length,
    contacted: leads.filter((l) => l.status === 'Contacted').length,
    qualified: leads.filter((l) => l.status === 'Qualified').length,
    converted: leads.filter((l) => l.status === 'Converted').length,
    bySource,
  };
}

/**
 * Convert lead to company - updates lead and returns company creation data
 */
export async function prepareLeadForCompanyConversion(
  leadId: string
): Promise<{
  lead: InboundLeadItem;
  companyData: {
    name: string;
    website?: string;
    email?: string;
    notes?: string;
    source: string;
  };
} | null> {
  const lead = await getInboundLeadById(leadId);
  if (!lead) return null;

  return {
    lead,
    companyData: {
      name: lead.companyName || lead.name || 'Unknown',
      website: lead.website,
      email: lead.email,
      notes: lead.notes,
      source: `Converted from Inbound Lead (${lead.leadSource})`,
    },
  };
}

/**
 * Convert lead to opportunity - updates lead and returns opportunity creation data
 */
export async function prepareLeadForOpportunityConversion(
  leadId: string
): Promise<{
  lead: InboundLeadItem;
  opportunityData: {
    companyName: string;
    deliverableName?: string;
    stage: 'Discovery';
    notes?: string;
    leadId: string;
  };
} | null> {
  const lead = await getInboundLeadById(leadId);
  if (!lead) return null;

  return {
    lead,
    opportunityData: {
      companyName: lead.companyName || lead.name || 'Unknown',
      deliverableName: `Opportunity from ${lead.leadSource} lead`,
      stage: 'Discovery',
      notes: lead.notes,
      leadId: lead.id,
    },
  };
}
