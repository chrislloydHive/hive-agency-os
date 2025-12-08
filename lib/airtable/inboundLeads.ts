// lib/airtable/inboundLeads.ts
// Airtable helpers for Inbound Leads

import { getBase } from '@/lib/airtable';
import type { InboundLeadItem } from '@/lib/types/pipeline';

const INBOUND_LEADS_TABLE = process.env.AIRTABLE_INBOUND_LEADS_TABLE || 'Inbound Leads';

/**
 * Map Airtable record to InboundLeadItem
 */
function mapRecordToLead(record: any): InboundLeadItem {
  const fields = record.fields;

  // Company is a linked record field - extract first ID
  const companyLinks = fields['Company'] as string[] | undefined;
  const companyId = companyLinks?.[0] || null;

  // GAP-IA Run is a linked record
  const gapIaLinks = fields['GAP-IA Run'] as string[] | undefined;
  const gapIaRunId = gapIaLinks?.[0] || null;

  return {
    id: record.id,
    name: fields['Name'] || null,
    email: fields['Email'] || null,
    website: fields['Website'] || null,
    companyName: fields['Company Name'] || null,
    leadSource: fields['Lead Source'] || fields['Source'] || null,
    status: fields['Status'] || 'New',
    assignee: fields['Assignee'] || null,
    notes: fields['Notes'] || null,
    companyId,
    gapIaRunId,
    createdAt: fields['Created At'] || fields['Created'] || null,

    // DMA Integration Fields (Phase 3 - optional)
    normalizedDomain: fields['Normalized Domain'] || null,
    dmaAuditId: fields['DMA Audit ID'] || null,
    importStatus: fields['Import Status'] || null,
    importedAt: fields['Imported At'] || null,
    analysisStatus: fields['Analysis Status'] || null,

    // UTM Tracking Fields
    utmSource: fields['UTM Source'] || null,
    utmMedium: fields['UTM Medium'] || null,
    utmCampaign: fields['UTM Campaign'] || null,
    utmTerm: fields['UTM Term'] || null,
    utmContent: fields['UTM Content'] || null,
  };
}

/**
 * Get all inbound leads from Airtable
 */
export async function getAllInboundLeads(): Promise<InboundLeadItem[]> {
  try {
    const base = getBase();
    const records = await base(INBOUND_LEADS_TABLE)
      .select({
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 200,
      })
      .all();

    return records.map(mapRecordToLead);
  } catch (error) {
    console.error('[InboundLeads] Failed to fetch leads:', error);
    return [];
  }
}

/**
 * Get a single lead by ID
 */
export async function getInboundLeadById(id: string): Promise<InboundLeadItem | null> {
  try {
    const base = getBase();
    const record = await base(INBOUND_LEADS_TABLE).find(id);
    return record ? mapRecordToLead(record) : null;
  } catch (error) {
    console.error(`[InboundLeads] Failed to fetch lead ${id}:`, error);
    return null;
  }
}

/**
 * Update lead assignee
 */
export async function updateLeadAssignee(id: string, assignee: string): Promise<void> {
  try {
    const base = getBase();
    await base(INBOUND_LEADS_TABLE).update(id, {
      Assignee: assignee,
    } as any);
    console.log(`[InboundLeads] Updated lead ${id} assignee to ${assignee}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update assignee for ${id}:`, error);
    throw error;
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(id: string, status: string): Promise<void> {
  try {
    const base = getBase();
    await base(INBOUND_LEADS_TABLE).update(id, {
      Status: status,
    } as any);
    console.log(`[InboundLeads] Updated lead ${id} status to ${status}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update status for ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new inbound lead
 */
export async function createInboundLead(params: {
  name?: string;
  email?: string;
  website?: string;
  companyName?: string;
  leadSource?: string;
  status?: string;
  assignee?: string;
  notes?: string;
  companyId?: string;
  // DMA Integration Fields (Phase 3)
  normalizedDomain?: string;
  dmaAuditId?: string;
  importStatus?: string;
  analysisStatus?: string;
  // UTM Tracking Fields
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}): Promise<InboundLeadItem | null> {
  try {
    const base = getBase();

    const fields: Record<string, unknown> = {
      Status: params.status || 'New',
    };

    if (params.name) fields['Name'] = params.name;
    if (params.email) fields['Email'] = params.email;
    if (params.website) fields['Website'] = params.website;
    if (params.companyName) fields['Company Name'] = params.companyName;
    if (params.leadSource) fields['Lead Source'] = params.leadSource;
    if (params.assignee) fields['Assignee'] = params.assignee;
    if (params.notes) fields['Notes'] = params.notes;
    if (params.companyId) fields['Company'] = [params.companyId];

    // DMA Integration Fields (Phase 3)
    if (params.normalizedDomain) fields['Normalized Domain'] = params.normalizedDomain;
    if (params.dmaAuditId) fields['DMA Audit ID'] = params.dmaAuditId;
    if (params.importStatus) fields['Import Status'] = params.importStatus;
    if (params.analysisStatus) fields['Analysis Status'] = params.analysisStatus;

    // UTM Tracking Fields
    if (params.utmSource) fields['UTM Source'] = params.utmSource;
    if (params.utmMedium) fields['UTM Medium'] = params.utmMedium;
    if (params.utmCampaign) fields['UTM Campaign'] = params.utmCampaign;
    if (params.utmTerm) fields['UTM Term'] = params.utmTerm;
    if (params.utmContent) fields['UTM Content'] = params.utmContent;

    const records = await base(INBOUND_LEADS_TABLE).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[InboundLeads] Created lead: ${createdRecord.id}`);
    return mapRecordToLead(createdRecord);
  } catch (error) {
    console.error('[InboundLeads] Failed to create lead:', error);
    return null;
  }
}

/**
 * Link lead to company
 */
export async function linkLeadToCompany(leadId: string, companyId: string): Promise<void> {
  try {
    const base = getBase();
    await base(INBOUND_LEADS_TABLE).update(leadId, {
      Company: [companyId],
    } as any);
    console.log(`[InboundLeads] Linked lead ${leadId} to company ${companyId}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to link lead ${leadId} to company:`, error);
    throw error;
  }
}
