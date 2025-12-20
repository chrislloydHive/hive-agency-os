// lib/airtable/inboundLeads.ts
// Airtable helpers for Inbound Leads

import { getBase } from '@/lib/airtable';
import type { InboundLeadItem, PipelineLeadStage } from '@/lib/types/pipeline';

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

  // GAP-Plan Run (Full GAP) - text field storing run ID
  const gapPlanRunId = fields['GAP Plan Run ID'] || fields['GAP-Plan Run ID'] || null;

  // Parse pipeline stage from Airtable (normalize to lowercase)
  const rawStage = fields['Pipeline Stage'] || fields['Stage'] || null;
  const pipelineStage = rawStage ? (rawStage.toLowerCase().replace(/\s+/g, '_') as PipelineLeadStage) : null;

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

    // DMA Full GAP Integration Fields
    gapPlanRunId,
    gapOverallScore: typeof fields['GAP Overall Score'] === 'number' ? fields['GAP Overall Score'] : null,
    gapMaturityStage: fields['GAP Maturity Stage'] || null,
    pipelineStage,
    lastActivityAt: fields['Last Activity At'] || null,
    contactMessage: fields['Contact Message'] || null,

    // Full Workup Checklist
    qbrReviewed: fields['QBR Reviewed'] === true,
    mediaLabReviewed: fields['Media Lab Reviewed'] === true,
    seoLabReviewed: fields['SEO Lab Reviewed'] === true,
    competitionLabReviewed: fields['Competition Lab Reviewed'] === true,
    workPlanDrafted: fields['Work Plan Drafted'] === true,

    // Conversion fields
    linkedOpportunityId: fields['Linked Opportunity'] as string | null || null,
    convertedAt: fields['Converted At'] as string | null || null,
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

    const fields: Record<string, unknown> = {};

    // Only set Status if provided (field may not exist or have the option)
    if (params.status) fields['Status'] = params.status;

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

/**
 * Update lead convertedAt timestamp (for Lead → Company conversion)
 */
export async function updateLeadConvertedAt(leadId: string): Promise<void> {
  try {
    const base = getBase();
    await base(INBOUND_LEADS_TABLE).update(leadId, {
      'Converted At': new Date().toISOString(),
    } as any);
    console.log(`[InboundLeads] Set convertedAt for lead ${leadId}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update convertedAt for ${leadId}:`, error);
    // Non-critical - don't throw
  }
}

/**
 * Update lead linkedOpportunityId (for Lead → Opportunity conversion)
 */
export async function updateLeadLinkedOpportunity(leadId: string, opportunityId: string): Promise<void> {
  try {
    const base = getBase();
    await base(INBOUND_LEADS_TABLE).update(leadId, {
      'Linked Opportunity': opportunityId,
      'Last Activity At': new Date().toISOString(),
    } as any);
    console.log(`[InboundLeads] Linked lead ${leadId} to opportunity ${opportunityId}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update linkedOpportunity for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Create or update a pipeline lead from DMA Full GAP
 * Idempotent: uses (companyId, email, source="DMA Full GAP") as unique key
 */
export async function createOrUpdatePipelineLeadFromDma(params: {
  companyId: string;
  contactEmail: string;
  contactName?: string;
  companyName?: string;
  website?: string;
  gapPlanRunId: string;
  gapOverallScore?: number;
  gapMaturityStage?: string;
  contactMessage?: string;
}): Promise<InboundLeadItem | null> {
  try {
    const base = getBase();

    // Check for existing lead with same companyId, email, and DMA source
    const existingRecords = await base(INBOUND_LEADS_TABLE)
      .select({
        filterByFormula: `AND(
          {Email} = '${params.contactEmail.replace(/'/g, "\\'")}',
          {Lead Source} = 'DMA Full GAP',
          FIND('${params.companyId}', ARRAYJOIN({Company})) > 0
        )`,
        maxRecords: 1,
      })
      .firstPage();

    const now = new Date().toISOString();

    if (existingRecords.length > 0) {
      // Update existing lead
      const existingId = existingRecords[0].id;
      const updateFields: Record<string, unknown> = {
        'Last Activity At': now,
      };

      if (params.gapPlanRunId) updateFields['GAP Plan Run ID'] = params.gapPlanRunId;
      if (params.gapOverallScore !== undefined) updateFields['GAP Overall Score'] = params.gapOverallScore;
      if (params.gapMaturityStage) updateFields['GAP Maturity Stage'] = params.gapMaturityStage;
      if (params.contactMessage) updateFields['Contact Message'] = params.contactMessage;
      if (params.contactName) updateFields['Name'] = params.contactName;

      await base(INBOUND_LEADS_TABLE).update(existingId, updateFields as any);
      console.log(`[InboundLeads] Updated existing DMA lead: ${existingId}`);

      const updated = await base(INBOUND_LEADS_TABLE).find(existingId);
      return mapRecordToLead(updated);
    }

    // Create new lead
    // OS-First Pipeline: Do NOT write Pipeline Stage - that's an Opportunity concern
    const fields: Record<string, unknown> = {
      'Email': params.contactEmail,
      'Lead Source': 'DMA Full GAP',
      'Status': 'New',
      // Note: Pipeline Stage intentionally NOT set - opportunities handle stages
      'Created At': now,
      'Last Activity At': now,
      'Company': [params.companyId],
    };

    if (params.contactName) fields['Name'] = params.contactName;
    if (params.companyName) fields['Company Name'] = params.companyName;
    if (params.website) fields['Website'] = params.website;
    if (params.gapPlanRunId) fields['GAP Plan Run ID'] = params.gapPlanRunId;
    if (params.gapOverallScore !== undefined) fields['GAP Overall Score'] = params.gapOverallScore;
    if (params.gapMaturityStage) fields['GAP Maturity Stage'] = params.gapMaturityStage;
    if (params.contactMessage) fields['Contact Message'] = params.contactMessage;

    const records = await base(INBOUND_LEADS_TABLE).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[InboundLeads] Created DMA Full GAP lead: ${createdRecord.id}`);
    return mapRecordToLead(createdRecord);
  } catch (error) {
    console.error('[InboundLeads] Failed to create/update DMA lead:', error);
    return null;
  }
}

/**
 * Update pipeline lead stage
 */
export async function updatePipelineLeadStage(
  leadId: string,
  stage: PipelineLeadStage
): Promise<void> {
  try {
    const base = getBase();

    // Map stage to Airtable format (title case with spaces)
    const stageMap: Record<PipelineLeadStage, string> = {
      new: 'New',
      qualified: 'Qualified',
      meeting_scheduled: 'Meeting Scheduled',
      proposal: 'Proposal',
      won: 'Won',
      lost: 'Lost',
    };

    await base(INBOUND_LEADS_TABLE).update(leadId, {
      'Pipeline Stage': stageMap[stage] || stage,
    } as any);

    console.log(`[InboundLeads] Updated lead ${leadId} pipeline stage to ${stage}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update pipeline stage for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Update workup checklist item
 */
export async function updateWorkupChecklist(
  leadId: string,
  field: 'qbrReviewed' | 'mediaLabReviewed' | 'seoLabReviewed' | 'competitionLabReviewed' | 'workPlanDrafted',
  value: boolean
): Promise<void> {
  try {
    const base = getBase();

    const fieldMap: Record<string, string> = {
      qbrReviewed: 'QBR Reviewed',
      mediaLabReviewed: 'Media Lab Reviewed',
      seoLabReviewed: 'SEO Lab Reviewed',
      competitionLabReviewed: 'Competition Lab Reviewed',
      workPlanDrafted: 'Work Plan Drafted',
    };

    const airtableField = fieldMap[field];
    if (!airtableField) throw new Error(`Unknown checklist field: ${field}`);

    await base(INBOUND_LEADS_TABLE).update(leadId, {
      [airtableField]: value,
      'Last Activity At': new Date().toISOString(),
    } as any);

    console.log(`[InboundLeads] Updated lead ${leadId} checklist ${field} to ${value}`);
  } catch (error) {
    console.error(`[InboundLeads] Failed to update checklist for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Get leads by pipeline stage
 */
export async function getLeadsByPipelineStage(stage?: PipelineLeadStage): Promise<InboundLeadItem[]> {
  try {
    const base = getBase();

    let filterFormula = '';
    if (stage) {
      const stageMap: Record<PipelineLeadStage, string> = {
        new: 'New',
        qualified: 'Qualified',
        meeting_scheduled: 'Meeting Scheduled',
        proposal: 'Proposal',
        won: 'Won',
        lost: 'Lost',
      };
      filterFormula = `{Pipeline Stage} = '${stageMap[stage]}'`;
    }

    const records = await base(INBOUND_LEADS_TABLE)
      .select({
        filterByFormula: filterFormula || '',
        sort: [{ field: 'Last Activity At', direction: 'desc' }],
        maxRecords: 200,
      })
      .all();

    return records.map(mapRecordToLead);
  } catch (error) {
    console.error('[InboundLeads] Failed to fetch leads by stage:', error);
    return [];
  }
}

/**
 * Get DMA Full GAP leads only
 */
export async function getDmaFullGapLeads(): Promise<InboundLeadItem[]> {
  try {
    const base = getBase();

    const records = await base(INBOUND_LEADS_TABLE)
      .select({
        filterByFormula: `{Lead Source} = 'DMA Full GAP'`,
        sort: [{ field: 'Created At', direction: 'desc' }],
        maxRecords: 200,
      })
      .all();

    return records.map(mapRecordToLead);
  } catch (error) {
    console.error('[InboundLeads] Failed to fetch DMA Full GAP leads:', error);
    return [];
  }
}

// ============================================================================
// Lead-First DMA Lead Creation (V2)
// ============================================================================

/**
 * Create or update a pipeline lead from DMA Full GAP (V2 - Lead-First)
 *
 * Key differences from V1:
 * - linkedCompanyId is optional (leads can exist without companies)
 * - Deduplication by (email + website domain + source) instead of requiring companyId
 * - Never creates companies - caller handles company matching
 *
 * @returns Lead and whether it was newly created
 */
export async function createOrUpdatePipelineLeadFromDmaV2(params: {
  contactEmail: string;
  contactName?: string;
  companyName?: string;
  website?: string;
  linkedCompanyId?: string | null; // Now optional
  gapPlanRunId: string;
  gapOverallScore?: number;
  gapMaturityStage?: string;
  contactMessage?: string;
}): Promise<{ lead: InboundLeadItem | null; isNew: boolean }> {
  try {
    const base = getBase();
    const now = new Date().toISOString();

    // Normalize domain for deduplication
    const domain = params.website ? normalizeDomainForLead(params.website) : null;

    // Build deduplication filter
    // Dedupe key: email + domain (if available) + source="DMA Full GAP"
    let filterParts = [
      `{Email} = '${params.contactEmail.replace(/'/g, "\\'")}'`,
      `{Lead Source} = 'DMA Full GAP'`,
    ];

    if (domain) {
      filterParts.push(`{Normalized Domain} = '${domain}'`);
    }

    const filterFormula = `AND(${filterParts.join(', ')})`;

    const existingRecords = await base(INBOUND_LEADS_TABLE)
      .select({
        filterByFormula: filterFormula,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length > 0) {
      // Update existing lead
      const existingId = existingRecords[0].id;
      const updateFields: Record<string, unknown> = {
        'Last Activity At': now,
      };

      if (params.gapPlanRunId) updateFields['GAP Plan Run ID'] = params.gapPlanRunId;
      if (params.gapOverallScore !== undefined) updateFields['GAP Overall Score'] = params.gapOverallScore;
      if (params.gapMaturityStage) updateFields['GAP Maturity Stage'] = params.gapMaturityStage;
      if (params.contactMessage) updateFields['Contact Message'] = params.contactMessage;
      if (params.contactName) updateFields['Name'] = params.contactName;

      // Update company link if now available
      if (params.linkedCompanyId) {
        updateFields['Company'] = [params.linkedCompanyId];
      }

      await base(INBOUND_LEADS_TABLE).update(existingId, updateFields as any);
      console.log(`[InboundLeads] Updated existing DMA lead: ${existingId} (company_created=false)`);

      const updated = await base(INBOUND_LEADS_TABLE).find(existingId);
      return { lead: mapRecordToLead(updated), isNew: false };
    }

    // Create new lead
    // OS-First Pipeline: Do NOT write Pipeline Stage - that's an Opportunity concern
    // Status="New" is used for basic triage only
    const fields: Record<string, unknown> = {
      'Email': params.contactEmail,
      'Lead Source': 'DMA Full GAP',
      'Status': 'New',
      // Note: Pipeline Stage intentionally NOT set - opportunities handle stages
      'Created At': now,
      'Last Activity At': now,
    };

    if (params.contactName) fields['Name'] = params.contactName;
    if (params.companyName) fields['Company Name'] = params.companyName;
    if (params.website) fields['Website'] = params.website;
    if (domain) fields['Normalized Domain'] = domain;
    if (params.gapPlanRunId) fields['GAP Plan Run ID'] = params.gapPlanRunId;
    if (params.gapOverallScore !== undefined) fields['GAP Overall Score'] = params.gapOverallScore;
    if (params.gapMaturityStage) fields['GAP Maturity Stage'] = params.gapMaturityStage;
    if (params.contactMessage) fields['Contact Message'] = params.contactMessage;

    // Link to company if available (but don't require it)
    if (params.linkedCompanyId) {
      fields['Company'] = [params.linkedCompanyId];
    }

    const records = await base(INBOUND_LEADS_TABLE).create([{ fields: fields as any }]);
    const createdRecord = records[0];

    console.log(`[InboundLeads] Created DMA Full GAP lead: ${createdRecord.id} (company_created=false, company_linked=${!!params.linkedCompanyId})`);
    return { lead: mapRecordToLead(createdRecord), isNew: true };
  } catch (error) {
    console.error('[InboundLeads] Failed to create/update DMA lead (V2):', error);
    return { lead: null, isNew: false };
  }
}

/**
 * Normalize domain from URL for lead deduplication
 */
function normalizeDomainForLead(urlOrDomain: string): string {
  if (!urlOrDomain) return '';

  let domain = urlOrDomain.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove trailing slash
  domain = domain.replace(/\/$/, '');

  // Remove query params
  domain = domain.split('?')[0];

  // Remove port
  domain = domain.split(':')[0];

  // Extract just the domain (remove path)
  domain = domain.split('/')[0];

  return domain;
}
