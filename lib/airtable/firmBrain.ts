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
  Reference,
  ReferenceInput,
  PricingTemplate,
  PricingTemplateInput,
  PlanTemplate,
  PlanTemplateInput,
  FirmBrainSnapshot,
} from '@/lib/types/firmBrain';

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

export async function getCaseStudies(): Promise<CaseStudy[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.CASE_STUDIES)
      .select({ sort: [{ field: 'title', direction: 'asc' }] })
      .all();

    return records.map((record) => ({
      id: record.id,
      title: (record.get('title') as string) || '',
      client: (record.get('client') as string) || '',
      industry: record.get('industry') as string | null,
      services: parseJsonArray(record.get('services')),
      summary: record.get('summary') as string | null,
      problem: record.get('problem') as string | null,
      approach: record.get('approach') as string | null,
      outcome: record.get('outcome') as string | null,
      metrics: parseJsonArray(record.get('metrics')),
      assets: parseJsonArray(record.get('assets')),
      tags: parseJsonArray(record.get('tags')),
      permissionLevel: (record.get('permissionLevel') as CaseStudy['permissionLevel']) || 'internal_only',
      caseStudyUrl: record.get('caseStudyUrl') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[firmBrain] Failed to get case studies:', error);
    return [];
  }
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.CASE_STUDIES).find(id);

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
      metrics: parseJsonArray(record.get('metrics')),
      assets: parseJsonArray(record.get('assets')),
      tags: parseJsonArray(record.get('tags')),
      permissionLevel: (record.get('permissionLevel') as CaseStudy['permissionLevel']) || 'internal_only',
      caseStudyUrl: record.get('caseStudyUrl') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get case study:', error);
    return null;
  }
}

export async function createCaseStudy(input: CaseStudyInput): Promise<CaseStudy> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.CASE_STUDIES).create([{
    fields: {
      title: input.title,
      client: input.client,
      industry: input.industry || undefined,
      services: JSON.stringify(input.services || []),
      summary: input.summary || undefined,
      problem: input.problem || undefined,
      approach: input.approach || undefined,
      outcome: input.outcome || undefined,
      metrics: JSON.stringify(input.metrics || []),
      assets: JSON.stringify(input.assets || []),
      tags: JSON.stringify(input.tags || []),
      permissionLevel: input.permissionLevel || 'internal_only',
      caseStudyUrl: input.caseStudyUrl || undefined,
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    ...input,
    services: input.services || [],
    metrics: input.metrics || [],
    assets: input.assets || [],
    tags: input.tags || [],
    permissionLevel: input.permissionLevel || 'internal_only',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCaseStudy(id: string, input: Partial<CaseStudyInput>): Promise<CaseStudy | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.title !== undefined) fields.title = input.title;
  if (input.client !== undefined) fields.client = input.client;
  if (input.industry !== undefined) fields.industry = input.industry;
  if (input.services !== undefined) fields.services = JSON.stringify(input.services);
  if (input.summary !== undefined) fields.summary = input.summary;
  if (input.problem !== undefined) fields.problem = input.problem;
  if (input.approach !== undefined) fields.approach = input.approach;
  if (input.outcome !== undefined) fields.outcome = input.outcome;
  if (input.metrics !== undefined) fields.metrics = JSON.stringify(input.metrics);
  if (input.assets !== undefined) fields.assets = JSON.stringify(input.assets);
  if (input.tags !== undefined) fields.tags = JSON.stringify(input.tags);
  if (input.permissionLevel !== undefined) fields.permissionLevel = input.permissionLevel;
  if (input.caseStudyUrl !== undefined) fields.caseStudyUrl = input.caseStudyUrl;

  await base(AIRTABLE_TABLES.CASE_STUDIES).update([{ id, fields }] as any);
  return getCaseStudyById(id);
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
// Pricing Templates
// ============================================================================

export async function getPricingTemplates(): Promise<PricingTemplate[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PRICING_TEMPLATES)
      .select({ sort: [{ field: 'templateName', direction: 'asc' }] })
      .all();

    return records.map((record) => ({
      id: record.id,
      templateName: (record.get('templateName') as string) || '',
      useCase: record.get('useCase') as string | null,
      lineItems: parseJsonArray(record.get('lineItems')),
      assumptions: parseJsonArray(record.get('assumptions')),
      exclusions: parseJsonArray(record.get('exclusions')),
      optionSets: parseJsonArray(record.get('optionSets')),
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[firmBrain] Failed to get pricing templates:', error);
    return [];
  }
}

export async function getPricingTemplateById(id: string): Promise<PricingTemplate | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.PRICING_TEMPLATES).find(id);

    return {
      id: record.id,
      templateName: (record.get('templateName') as string) || '',
      useCase: record.get('useCase') as string | null,
      lineItems: parseJsonArray(record.get('lineItems')),
      assumptions: parseJsonArray(record.get('assumptions')),
      exclusions: parseJsonArray(record.get('exclusions')),
      optionSets: parseJsonArray(record.get('optionSets')),
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[firmBrain] Failed to get pricing template:', error);
    return null;
  }
}

export async function createPricingTemplate(input: PricingTemplateInput): Promise<PricingTemplate> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.PRICING_TEMPLATES).create([{
    fields: {
      templateName: input.templateName,
      useCase: input.useCase || undefined,
      lineItems: JSON.stringify(input.lineItems || []),
      assumptions: JSON.stringify(input.assumptions || []),
      exclusions: JSON.stringify(input.exclusions || []),
      optionSets: JSON.stringify(input.optionSets || []),
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const created = records[0];

  return {
    id: created.id,
    ...input,
    lineItems: input.lineItems || [],
    assumptions: input.assumptions || [],
    exclusions: input.exclusions || [],
    optionSets: input.optionSets || [],
    createdAt: now,
    updatedAt: now,
  };
}

export async function updatePricingTemplate(id: string, input: Partial<PricingTemplateInput>): Promise<PricingTemplate | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.templateName !== undefined) fields.templateName = input.templateName;
  if (input.useCase !== undefined) fields.useCase = input.useCase;
  if (input.lineItems !== undefined) fields.lineItems = JSON.stringify(input.lineItems);
  if (input.assumptions !== undefined) fields.assumptions = JSON.stringify(input.assumptions);
  if (input.exclusions !== undefined) fields.exclusions = JSON.stringify(input.exclusions);
  if (input.optionSets !== undefined) fields.optionSets = JSON.stringify(input.optionSets);

  await base(AIRTABLE_TABLES.PRICING_TEMPLATES).update([{ id, fields }] as any);
  return getPricingTemplateById(id);
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
