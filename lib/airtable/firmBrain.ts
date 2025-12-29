// lib/airtable/firmBrain.ts
// Airtable CRUD operations for Firm Brain entities
// Used for agency-wide knowledge management in Settings

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  AgencyProfile,
  AgencyProfileInput,
  TeamMember,
  TeamMemberInput,
  CaseStudy,
  CaseStudyInput,
  CaseStudyPermission,
  CaseStudyVisual,
  CaseStudyClientLogo,
  Reference,
  ReferenceInput,
  PricingTemplate,
  PricingTemplateInput,
  PlanTemplate,
  PlanTemplateInput,
  FirmBrainSnapshot,
} from '@/lib/types/firmBrain';
import { normalizePermissionLevel } from '@/lib/types/firmBrain';

// ============================================================================
// Agency Profile
// ============================================================================

export async function getAgencyProfile(): Promise<AgencyProfile | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.AGENCY_PROFILE)
      .select({ maxRecords: 1 })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      name: (record.get('name') as string) || '',
      oneLiner: record.get('oneLiner') as string | null,
      overviewLong: record.get('overviewLong') as string | null,
      differentiators: parseJsonArray<string>(record.get('differentiators')),
      services: parseJsonArray<string>(record.get('services')),
      industries: parseJsonArray<string>(record.get('industries')),
      approachSummary: record.get('approachSummary') as string | null,
      collaborationModel: record.get('collaborationModel') as string | null,
      aiStyleGuide: record.get('aiStyleGuide') as string | null,
      defaultAssumptions: parseJsonArray<string>(record.get('defaultAssumptions')),
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get agency profile:', error);
    return null;
  }
}

export async function upsertAgencyProfile(input: AgencyProfileInput): Promise<AgencyProfile> {
  const base = getAirtableBase();
  const existing = await getAgencyProfile();

  const fields = {
    name: input.name,
    oneLiner: input.oneLiner || undefined,
    overviewLong: input.overviewLong || undefined,
    differentiators: JSON.stringify(input.differentiators || []),
    services: JSON.stringify(input.services || []),
    industries: JSON.stringify(input.industries || []),
    approachSummary: input.approachSummary || undefined,
    collaborationModel: input.collaborationModel || undefined,
    aiStyleGuide: input.aiStyleGuide || undefined,
    defaultAssumptions: JSON.stringify(input.defaultAssumptions || []),
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    const results = await base(AIRTABLE_TABLES.AGENCY_PROFILE).update([
      { id: existing.id, fields },
    ]) as unknown as Array<{ id: string }>;
    const updated = results[0];
    return { ...existing, ...input, id: updated.id, updatedAt: fields.updatedAt };
  } else {
    const records = await base(AIRTABLE_TABLES.AGENCY_PROFILE).create([{
      fields: {
        ...fields,
        createdAt: new Date().toISOString(),
      }
    }]) as unknown as Array<{ id: string }>;
    const created = records[0];
    return {
      id: created.id,
      ...input,
      createdAt: fields.updatedAt, // Use updatedAt since we just created
      updatedAt: fields.updatedAt,
    };
  }
}

// ============================================================================
// Team Members
// ============================================================================

export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.TEAM_MEMBERS)
      .select({ sort: [{ field: 'name', direction: 'asc' }] })
      .all();

    return records.map((record) => ({
      id: record.id,
      name: (record.get('name') as string) || '',
      role: (record.get('role') as string) || '',
      bio: record.get('bio') as string | null,
      strengths: parseJsonArray(record.get('strengths')),
      functions: parseJsonArray(record.get('functions')),
      availabilityStatus: (record.get('availabilityStatus') as TeamMember['availabilityStatus']) || 'available',
      defaultOnRfp: Boolean(record.get('defaultOnRfp')),
      headshotUrl: record.get('headshotUrl') as string | null,
      linkedinUrl: record.get('linkedinUrl') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[firmBrain] Failed to get team members:', error);
    return [];
  }
}

export async function getTeamMemberById(id: string): Promise<TeamMember | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.TEAM_MEMBERS).find(id);

    return {
      id: record.id,
      name: (record.get('name') as string) || '',
      role: (record.get('role') as string) || '',
      bio: record.get('bio') as string | null,
      strengths: parseJsonArray(record.get('strengths')),
      functions: parseJsonArray(record.get('functions')),
      availabilityStatus: (record.get('availabilityStatus') as TeamMember['availabilityStatus']) || 'available',
      defaultOnRfp: Boolean(record.get('defaultOnRfp')),
      headshotUrl: record.get('headshotUrl') as string | null,
      linkedinUrl: record.get('linkedinUrl') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get team member:', error);
    return null;
  }
}

export async function createTeamMember(input: TeamMemberInput): Promise<TeamMember> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const record = await base(AIRTABLE_TABLES.TEAM_MEMBERS).create([{
    fields: {
      name: input.name,
      role: input.role,
      bio: input.bio || undefined,
      strengths: JSON.stringify(input.strengths || []),
      functions: JSON.stringify(input.functions || []),
      availabilityStatus: input.availabilityStatus || 'available',
      defaultOnRfp: input.defaultOnRfp || false,
      headshotUrl: input.headshotUrl || undefined,
      linkedinUrl: input.linkedinUrl || undefined,
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = record[0];

  return {
    id: created.id,
    ...input,
    strengths: input.strengths || [],
    functions: input.functions || [],
    availabilityStatus: input.availabilityStatus || 'available',
    defaultOnRfp: input.defaultOnRfp || false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateTeamMember(id: string, input: Partial<TeamMemberInput>): Promise<TeamMember | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.name !== undefined) fields.name = input.name;
  if (input.role !== undefined) fields.role = input.role;
  if (input.bio !== undefined) fields.bio = input.bio;
  if (input.strengths !== undefined) fields.strengths = JSON.stringify(input.strengths);
  if (input.functions !== undefined) fields.functions = JSON.stringify(input.functions);
  if (input.availabilityStatus !== undefined) fields.availabilityStatus = input.availabilityStatus;
  if (input.defaultOnRfp !== undefined) fields.defaultOnRfp = input.defaultOnRfp;
  if (input.headshotUrl !== undefined) fields.headshotUrl = input.headshotUrl;
  if (input.linkedinUrl !== undefined) fields.linkedinUrl = input.linkedinUrl;

  await base(AIRTABLE_TABLES.TEAM_MEMBERS).update([{ id, fields }] as any);
  return getTeamMemberById(id);
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();
    await base(AIRTABLE_TABLES.TEAM_MEMBERS).destroy([id]);
    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to delete team member:', error);
    return false;
  }
}

// ============================================================================
// Case Studies
// ============================================================================

/** Options for listing case studies */
export interface ListCaseStudiesOptions {
  permission?: CaseStudyPermission;
  search?: string;
}

/** Parse metrics from Airtable - handles both array and object formats */
function parseMetrics(value: unknown): CaseStudy['metrics'] {
  if (!value) return {};
  // If it's a string, try to parse as JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as Array<{ label: string; value: string; context?: string }>;
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, string | number | boolean | null>;
      }
    } catch {
      return {};
    }
  }
  // If it's already an object (not array), return as record
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string | number | boolean | null>;
  }
  // If it's an array, return as-is
  if (Array.isArray(value)) {
    return value as Array<{ label: string; value: string; context?: string }>;
  }
  return {};
}

/** Parse visuals array from Airtable JSON */
function parseVisuals(value: unknown): CaseStudyVisual[] {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as CaseStudyVisual[];
      }
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value as CaseStudyVisual[];
  }
  return [];
}

/** Parse clientLogo from Airtable JSON */
function parseClientLogo(value: unknown): CaseStudyClientLogo | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && 'assetUrl' in parsed) {
        return parsed as CaseStudyClientLogo;
      }
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object' && 'assetUrl' in value) {
    return value as CaseStudyClientLogo;
  }
  return null;
}

/** Convert record to CaseStudy with normalized permission */
function recordToCaseStudy(record: { id: string; get: (field: string) => unknown }): CaseStudy {
  const rawPermission = record.get('permissionLevel') as string | null;
  const permission = normalizePermissionLevel(rawPermission);

  return {
    id: record.id,
    title: (record.get('title') as string) || '',
    client: (record.get('client') as string) || '',
    industry: record.get('industry') as string | null,
    services: parseJsonArray(record.get('services')),
    summary: record.get('summary') as string | null,
    problem: record.get('problem') as string | null,
    approach: record.get('approach') as string | null,
    outcome: record.get('outcome') as string | null,
    metrics: parseMetrics(record.get('metrics')),
    assets: parseJsonArray(record.get('assets')),
    tags: parseJsonArray(record.get('tags')),
    permissionLevel: permission,
    visibility: permission, // Same as permissionLevel
    caseStudyUrl: record.get('caseStudyUrl') as string | null,
    visuals: parseVisuals(record.get('visuals')),
    clientLogo: parseClientLogo(record.get('clientLogo')),
    createdAt: record.get('createdAt') as string | null,
    updatedAt: record.get('updatedAt') as string | null,
  };
}

export async function getCaseStudies(options?: ListCaseStudiesOptions): Promise<CaseStudy[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.CASE_STUDIES)
      .select({ sort: [{ field: 'title', direction: 'asc' }] })
      .all();

    let caseStudies = records.map(recordToCaseStudy);

    // Filter by permission level
    if (options?.permission) {
      caseStudies = caseStudies.filter(cs => cs.permissionLevel === options.permission);
    }

    // Search filter
    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      caseStudies = caseStudies.filter(cs =>
        cs.title.toLowerCase().includes(searchLower) ||
        cs.client.toLowerCase().includes(searchLower) ||
        (cs.industry?.toLowerCase().includes(searchLower)) ||
        cs.services.some(s => s.toLowerCase().includes(searchLower)) ||
        cs.tags.some(t => t.toLowerCase().includes(searchLower))
      );
    }

    return caseStudies;
  } catch (error) {
    console.error('[firmBrain] Failed to get case studies:', error);
    return [];
  }
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.CASE_STUDIES).find(id);
    return recordToCaseStudy(record);
  } catch (error) {
    console.error('[firmBrain] Failed to get case study:', error);
    return null;
  }
}

export async function createCaseStudy(input: CaseStudyInput): Promise<CaseStudy> {
  const base = getAirtableBase();
  const now = new Date().toISOString();
  const nowDate = now.split('T')[0]; // YYYY-MM-DD for Airtable Date fields
  const permission = input.permissionLevel || 'internal';

  const records = await base(AIRTABLE_TABLES.CASE_STUDIES).create([{
    fields: {
      title: input.title,
      client: input.client,
      industry: input.industry || undefined,
      services: input.services || [], // Multi-select in Airtable
      summary: input.summary || undefined,
      problem: input.problem || undefined,
      approach: input.approach || undefined,
      outcome: input.outcome || undefined,
      metrics: JSON.stringify(input.metrics || {}), // Flexible: array or object
      assets: JSON.stringify(input.assets || []),
      tags: input.tags || [], // Multi-select in Airtable
      permissionLevel: permission,
      caseStudyUrl: input.caseStudyUrl || undefined,
      visuals: JSON.stringify(input.visuals || []),
      clientLogo: input.clientLogo ? JSON.stringify(input.clientLogo) : undefined,
      createdAt: nowDate,
      updatedAt: nowDate,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    ...input,
    services: input.services || [],
    metrics: input.metrics || {},
    assets: input.assets || [],
    tags: input.tags || [],
    permissionLevel: permission,
    visibility: permission,
    visuals: input.visuals || [],
    clientLogo: input.clientLogo || null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCaseStudy(id: string, input: Partial<CaseStudyInput>): Promise<CaseStudy | null> {
  const base = getAirtableBase();
  const nowDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD for Airtable

  const fields: Record<string, unknown> = { updatedAt: nowDate };
  if (input.title !== undefined) fields.title = input.title;
  if (input.client !== undefined) fields.client = input.client;
  if (input.industry !== undefined) fields.industry = input.industry;
  if (input.services !== undefined) fields.services = input.services; // Multi-select
  if (input.summary !== undefined) fields.summary = input.summary;
  if (input.problem !== undefined) fields.problem = input.problem;
  if (input.approach !== undefined) fields.approach = input.approach;
  if (input.outcome !== undefined) fields.outcome = input.outcome;
  if (input.metrics !== undefined) fields.metrics = JSON.stringify(input.metrics);
  if (input.assets !== undefined) fields.assets = JSON.stringify(input.assets);
  if (input.tags !== undefined) fields.tags = input.tags; // Multi-select
  if (input.permissionLevel !== undefined) fields.permissionLevel = input.permissionLevel;
  if (input.caseStudyUrl !== undefined) fields.caseStudyUrl = input.caseStudyUrl;
  if (input.visuals !== undefined) fields.visuals = JSON.stringify(input.visuals);
  if (input.clientLogo !== undefined) fields.clientLogo = JSON.stringify(input.clientLogo);

  await base(AIRTABLE_TABLES.CASE_STUDIES).update([{ id, fields }] as any);
  return getCaseStudyById(id);
}

/** Upsert a case study - create if not exists, update if exists (matches by title + client) */
export async function upsertCaseStudy(input: CaseStudyInput): Promise<CaseStudy> {
  // Try to find existing case study by title and client
  const existing = await getCaseStudies();
  const match = existing.find(cs =>
    cs.title === input.title && cs.client === input.client
  );

  if (match) {
    const updated = await updateCaseStudy(match.id, input);
    if (updated) return updated;
  }

  return createCaseStudy(input);
}

export async function deleteCaseStudy(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();
    await base(AIRTABLE_TABLES.CASE_STUDIES).destroy([id]);
    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to delete case study:', error);
    return false;
  }
}

// ============================================================================
// References
// ============================================================================

export async function getReferences(): Promise<Reference[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.REFERENCES)
      .select({ sort: [{ field: 'client', direction: 'asc' }] })
      .all();

    return records.map((record) => ({
      id: record.id,
      client: (record.get('client') as string) || '',
      contactName: (record.get('contactName') as string) || '',
      email: record.get('email') as string | null,
      phone: record.get('phone') as string | null,
      engagementType: record.get('engagementType') as string | null,
      industries: parseJsonArray(record.get('industries')),
      permissionStatus: (record.get('permissionStatus') as Reference['permissionStatus']) || 'pending',
      notes: record.get('notes') as string | null,
      lastConfirmedAt: record.get('lastConfirmedAt') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[firmBrain] Failed to get references:', error);
    return [];
  }
}

export async function getReferenceById(id: string): Promise<Reference | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.REFERENCES).find(id);

    return {
      id: record.id,
      client: (record.get('client') as string) || '',
      contactName: (record.get('contactName') as string) || '',
      email: record.get('email') as string | null,
      phone: record.get('phone') as string | null,
      engagementType: record.get('engagementType') as string | null,
      industries: parseJsonArray(record.get('industries')),
      permissionStatus: (record.get('permissionStatus') as Reference['permissionStatus']) || 'pending',
      notes: record.get('notes') as string | null,
      lastConfirmedAt: record.get('lastConfirmedAt') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get reference:', error);
    return null;
  }
}

export async function createReference(input: ReferenceInput): Promise<Reference> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.REFERENCES).create([{
    fields: {
      client: input.client,
      contactName: input.contactName,
      email: input.email || undefined,
      phone: input.phone || undefined,
      engagementType: input.engagementType || undefined,
      industries: JSON.stringify(input.industries || []),
      permissionStatus: input.permissionStatus || 'pending',
      notes: input.notes || undefined,
      lastConfirmedAt: input.lastConfirmedAt || undefined,
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    ...input,
    industries: input.industries || [],
    permissionStatus: input.permissionStatus || 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateReference(id: string, input: Partial<ReferenceInput>): Promise<Reference | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.client !== undefined) fields.client = input.client;
  if (input.contactName !== undefined) fields.contactName = input.contactName;
  if (input.email !== undefined) fields.email = input.email;
  if (input.phone !== undefined) fields.phone = input.phone;
  if (input.engagementType !== undefined) fields.engagementType = input.engagementType;
  if (input.industries !== undefined) fields.industries = JSON.stringify(input.industries);
  if (input.permissionStatus !== undefined) fields.permissionStatus = input.permissionStatus;
  if (input.notes !== undefined) fields.notes = input.notes;
  if (input.lastConfirmedAt !== undefined) fields.lastConfirmedAt = input.lastConfirmedAt;

  await base(AIRTABLE_TABLES.REFERENCES).update([{ id, fields }] as any);
  return getReferenceById(id);
}

export async function deleteReference(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();
    await base(AIRTABLE_TABLES.REFERENCES).destroy([id]);
    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to delete reference:', error);
    return false;
  }
}

// ============================================================================
// Pricing Templates (Simplified - Airtable Fields)
// ============================================================================

import type {
  ListPricingTemplatesOptions,
  AirtableAttachment,
  LinkedOpportunity,
} from '@/lib/types/firmBrain';

/** Parse Airtable attachments array */
function parseAttachments(value: unknown): AirtableAttachment[] {
  if (!value || !Array.isArray(value)) return [];
  return value.map((att: Record<string, unknown>) => ({
    id: (att.id as string) || '',
    url: (att.url as string) || '',
    filename: (att.filename as string) || '',
    size: att.size as number | undefined,
    type: att.type as string | undefined,
    thumbnails: att.thumbnails as AirtableAttachment['thumbnails'],
  }));
}

/** Parse linked record IDs and names */
function parseLinkedRecords(ids: unknown, names: unknown): LinkedOpportunity[] {
  const idArray = Array.isArray(ids) ? ids : [];
  const nameArray = Array.isArray(names) ? names : [];

  return idArray.map((id: string, i: number) => ({
    id,
    name: nameArray[i] || `Opportunity ${i + 1}`,
  }));
}

/** Convert Airtable record to PricingTemplate */
function recordToPricingTemplate(record: { id: string; get: (field: string) => unknown }): PricingTemplate {
  // Get linked agency (first ID if exists)
  const linkedAgencyIds = record.get('Linked Agency') as string[] | undefined;
  const linkedAgencyId = linkedAgencyIds?.[0] || null;

  // Get relevant opportunities (linked records)
  const oppIds = record.get('Relevant Opportunities') as string[] | undefined;
  const oppNames = record.get('Relevant Opportunities Names') as string[] | undefined; // Lookup field
  const relevantOpportunities = parseLinkedRecords(oppIds, oppNames);

  return {
    id: record.id,
    name: (record.get('Template Name') as string) || '',
    description: (record.get('Description') as string) || '',
    linkedAgencyId,
    examplePricingFiles: parseAttachments(record.get('Example Pricing File')),
    relevantOpportunities,
    createdAt: record.get('Created') as string | null,
    updatedAt: record.get('Last Modified') as string | null,
  };
}

export async function getPricingTemplates(options?: ListPricingTemplatesOptions): Promise<PricingTemplate[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PRICING_TEMPLATES)
      .select({ sort: [{ field: 'Template Name', direction: 'asc' }] })
      .all();

    let templates = records.map(recordToPricingTemplate);

    // Apply filters
    if (options?.hasFile !== undefined) {
      templates = templates.filter(t =>
        options.hasFile ? t.examplePricingFiles.length > 0 : t.examplePricingFiles.length === 0
      );
    }

    if (options?.hasOpportunities !== undefined) {
      templates = templates.filter(t =>
        options.hasOpportunities ? t.relevantOpportunities.length > 0 : t.relevantOpportunities.length === 0
      );
    }

    if (options?.q) {
      const qLower = options.q.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(qLower) ||
        t.description.toLowerCase().includes(qLower)
      );
    }

    return templates;
  } catch (error) {
    console.error('[firmBrain] Failed to get pricing templates:', error);
    return [];
  }
}

export async function getPricingTemplateById(id: string): Promise<PricingTemplate | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.PRICING_TEMPLATES).find(id);
    return recordToPricingTemplate(record);
  } catch (error) {
    console.error('[firmBrain] Failed to get pricing template:', error);
    return null;
  }
}

export async function createPricingTemplate(input: PricingTemplateInput): Promise<PricingTemplate> {
  const base = getAirtableBase();

  const fields: {
    'Template Name': string;
    'Description': string;
    'Linked Agency'?: string[];
  } = {
    'Template Name': input.name,
    'Description': input.description || '',
  };

  // Only add linked agency if provided
  if (input.linkedAgencyId) {
    fields['Linked Agency'] = [input.linkedAgencyId];
  }

  const records = await base(AIRTABLE_TABLES.PRICING_TEMPLATES).create([{ fields }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    name: input.name,
    description: input.description || '',
    linkedAgencyId: input.linkedAgencyId || null,
    examplePricingFiles: [], // Attachments are uploaded separately
    relevantOpportunities: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updatePricingTemplate(id: string, input: Partial<PricingTemplateInput>): Promise<PricingTemplate | null> {
  const base = getAirtableBase();

  const fields: Record<string, unknown> = {};

  if (input.name !== undefined) fields['Template Name'] = input.name;
  if (input.description !== undefined) fields['Description'] = input.description;
  if (input.linkedAgencyId !== undefined) {
    fields['Linked Agency'] = input.linkedAgencyId ? [input.linkedAgencyId] : [];
  }

  await base(AIRTABLE_TABLES.PRICING_TEMPLATES).update([{ id, fields }] as any);
  return getPricingTemplateById(id);
}

export async function upsertPricingTemplate(input: PricingTemplateInput, agencyId?: string): Promise<PricingTemplate> {
  // Try to find existing template by name (and optionally agency)
  const existing = await getPricingTemplates();
  const match = existing.find(t => {
    if (t.name !== input.name) return false;
    // If agencyId provided, match on that too
    if (agencyId && t.linkedAgencyId !== agencyId) return false;
    return true;
  });

  if (match) {
    const updated = await updatePricingTemplate(match.id, input);
    if (updated) return updated;
  }

  return createPricingTemplate(input);
}

export async function deletePricingTemplate(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();
    await base(AIRTABLE_TABLES.PRICING_TEMPLATES).destroy([id]);
    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to delete pricing template:', error);
    return false;
  }
}

/**
 * Link a pricing template to an opportunity
 * This updates the "Relevant Opportunities" linked record field
 */
export async function linkTemplateToOpportunity(templateId: string, opportunityId: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    // Get current linked opportunities
    const template = await getPricingTemplateById(templateId);
    if (!template) return false;

    // Check if already linked (idempotent)
    const existingIds = template.relevantOpportunities.map(o => o.id);
    if (existingIds.includes(opportunityId)) {
      return true; // Already linked
    }

    // Add the new opportunity to the linked records
    const newIds = [...existingIds, opportunityId];

    await base(AIRTABLE_TABLES.PRICING_TEMPLATES).update([{
      id: templateId,
      fields: {
        'Relevant Opportunities': newIds,
      }
    }] as any);

    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to link template to opportunity:', error);
    return false;
  }
}

/**
 * Unlink a pricing template from an opportunity
 */
export async function unlinkTemplateFromOpportunity(templateId: string, opportunityId: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    const template = await getPricingTemplateById(templateId);
    if (!template) return false;

    const newIds = template.relevantOpportunities
      .map(o => o.id)
      .filter(id => id !== opportunityId);

    await base(AIRTABLE_TABLES.PRICING_TEMPLATES).update([{
      id: templateId,
      fields: {
        'Relevant Opportunities': newIds,
      }
    }] as any);

    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to unlink template from opportunity:', error);
    return false;
  }
}

// ============================================================================
// Plan Templates
// ============================================================================

export async function getPlanTemplates(): Promise<PlanTemplate[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PLAN_TEMPLATES)
      .select({ sort: [{ field: 'templateName', direction: 'asc' }] })
      .all();

    return records.map((record) => ({
      id: record.id,
      templateName: (record.get('templateName') as string) || '',
      useCase: record.get('useCase') as string | null,
      phases: parseJsonArray(record.get('phases')),
      dependencies: parseJsonArray(record.get('dependencies')),
      typicalTimeline: record.get('typicalTimeline') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[firmBrain] Failed to get plan templates:', error);
    return [];
  }
}

export async function getPlanTemplateById(id: string): Promise<PlanTemplate | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.PLAN_TEMPLATES).find(id);

    return {
      id: record.id,
      templateName: (record.get('templateName') as string) || '',
      useCase: record.get('useCase') as string | null,
      phases: parseJsonArray(record.get('phases')),
      dependencies: parseJsonArray(record.get('dependencies')),
      typicalTimeline: record.get('typicalTimeline') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get plan template:', error);
    return null;
  }
}

export async function createPlanTemplate(input: PlanTemplateInput): Promise<PlanTemplate> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.PLAN_TEMPLATES).create([{
    fields: {
      templateName: input.templateName,
      useCase: input.useCase || undefined,
      phases: JSON.stringify(input.phases || []),
      dependencies: JSON.stringify(input.dependencies || []),
      typicalTimeline: input.typicalTimeline || undefined,
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    ...input,
    phases: input.phases || [],
    dependencies: input.dependencies || [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePlanTemplate(id: string, input: Partial<PlanTemplateInput>): Promise<PlanTemplate | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.templateName !== undefined) fields.templateName = input.templateName;
  if (input.useCase !== undefined) fields.useCase = input.useCase;
  if (input.phases !== undefined) fields.phases = JSON.stringify(input.phases);
  if (input.dependencies !== undefined) fields.dependencies = JSON.stringify(input.dependencies);
  if (input.typicalTimeline !== undefined) fields.typicalTimeline = input.typicalTimeline;

  await base(AIRTABLE_TABLES.PLAN_TEMPLATES).update([{ id, fields }] as any);
  return getPlanTemplateById(id);
}

export async function deletePlanTemplate(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();
    await base(AIRTABLE_TABLES.PLAN_TEMPLATES).destroy([id]);
    return true;
  } catch (error) {
    console.error('[firmBrain] Failed to delete plan template:', error);
    return false;
  }
}

// ============================================================================
// Firm Brain Snapshot (aggregate for RFP generation)
// ============================================================================

export async function getFirmBrainSnapshot(): Promise<FirmBrainSnapshot> {
  const [
    agencyProfile,
    teamMembers,
    caseStudies,
    references,
    pricingTemplates,
    planTemplates,
  ] = await Promise.all([
    getAgencyProfile(),
    getTeamMembers(),
    getCaseStudies(),
    getReferences(),
    getPricingTemplates(),
    getPlanTemplates(),
  ]);

  return {
    agencyProfile,
    teamMembers,
    caseStudies,
    references,
    pricingTemplates,
    planTemplates,
    snapshotAt: new Date().toISOString(),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
