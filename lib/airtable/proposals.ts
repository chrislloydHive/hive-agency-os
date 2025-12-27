// lib/airtable/proposals.ts
// Airtable CRUD operations for Proposal workflow
// Used in Deliver phase for proposal generation (converted from RFPs or created fresh)

import { getBase as getAirtableBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from './tables';
import type {
  Proposal,
  ProposalInput,
  ProposalSection,
  ProposalSectionInput,
  ProposalWithSections,
  ProposalSectionKey,
  PROPOSAL_SECTION_ORDER,
  PROPOSAL_SECTION_LABELS,
} from '@/lib/types/proposal';

// ============================================================================
// Proposal Main Entity
// ============================================================================

export async function getProposalsForCompany(companyId: string): Promise<Proposal[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PROPOSALS)
      .select({
        filterByFormula: `{companyId} = '${companyId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }],
      })
      .all();

    return records.map((record) => ({
      id: record.id,
      companyId: (record.get('companyId') as string) || '',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as Proposal['status']) || 'draft',
      sourceRfpId: record.get('sourceRfpId') as string | null,
      firmBrainSnapshot: parseJsonObject(record.get('firmBrainSnapshot')) as Proposal['firmBrainSnapshot'],
      createdBy: record.get('createdBy') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));
  } catch (error) {
    console.error('[proposals] Failed to get proposals for company:', error);
    return [];
  }
}

export async function getProposalById(id: string): Promise<Proposal | null> {
  try {
    const base = getAirtableBase();
    const record = await base(AIRTABLE_TABLES.PROPOSALS).find(id);

    return {
      id: record.id,
      companyId: (record.get('companyId') as string) || '',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as Proposal['status']) || 'draft',
      sourceRfpId: record.get('sourceRfpId') as string | null,
      firmBrainSnapshot: parseJsonObject(record.get('firmBrainSnapshot')) as Proposal['firmBrainSnapshot'],
      createdBy: record.get('createdBy') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[proposals] Failed to get proposal:', error);
    return null;
  }
}

export async function createProposal(input: ProposalInput): Promise<Proposal> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.PROPOSALS).create([{
    fields: {
      companyId: input.companyId,
      title: input.title,
      status: input.status || 'draft',
      sourceRfpId: input.sourceRfpId || undefined,
      firmBrainSnapshot: input.firmBrainSnapshot ? JSON.stringify(input.firmBrainSnapshot) : undefined,
      createdBy: input.createdBy || undefined,
      createdAt: now,
      updatedAt: now,
    }
  }]) as unknown as Array<{ id: string }>;
  const record = records[0];

  const proposal: Proposal = {
    id: record.id,
    companyId: input.companyId,
    title: input.title,
    status: input.status || 'draft',
    sourceRfpId: input.sourceRfpId || null,
    firmBrainSnapshot: input.firmBrainSnapshot || null,
    createdBy: input.createdBy || null,
    createdAt: now,
    updatedAt: now,
  };

  return proposal;
}

export async function updateProposal(id: string, input: Partial<ProposalInput>): Promise<Proposal | null> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const fields: Record<string, any> = { updatedAt: now };
  if (input.title !== undefined) fields.title = input.title;
  if (input.status !== undefined) fields.status = input.status;
  if (input.sourceRfpId !== undefined) fields.sourceRfpId = input.sourceRfpId;
  if (input.firmBrainSnapshot !== undefined) {
    fields.firmBrainSnapshot = input.firmBrainSnapshot ? JSON.stringify(input.firmBrainSnapshot) : null;
  }

  await base(AIRTABLE_TABLES.PROPOSALS).update([{ id, fields }]);
  return getProposalById(id);
}

export async function deleteProposal(id: string): Promise<boolean> {
  try {
    const base = getAirtableBase();

    // Delete sections first
    const sections = await getProposalSections(id);
    if (sections.length > 0) {
      await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS).destroy(sections.map(s => s.id));
    }

    // Delete proposal
    await base(AIRTABLE_TABLES.PROPOSALS).destroy([id]);
    return true;
  } catch (error) {
    console.error('[proposals] Failed to delete proposal:', error);
    return false;
  }
}

// ============================================================================
// Proposal Sections
// ============================================================================

const SECTION_ORDER: ProposalSectionKey[] = [
  'scope',
  'approach',
  'deliverables',
  'timeline',
  'pricing',
  'proof',
  'team',
];

const SECTION_LABELS: Record<ProposalSectionKey, string> = {
  scope: 'Scope of Work',
  approach: 'Our Approach',
  deliverables: 'Deliverables',
  timeline: 'Timeline',
  pricing: 'Investment',
  proof: 'Proof of Expertise',
  team: 'Your Team',
};

export async function initializeProposalSections(proposalId: string): Promise<void> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const sections = SECTION_ORDER.map((key) => ({
    fields: {
      proposalId,
      sectionKey: key,
      title: SECTION_LABELS[key],
      status: 'empty',
      content: undefined,
      sourceType: undefined,
      sourceRfpSectionKey: undefined,
      sourceLibrarySectionId: undefined,
      createdAt: now,
      updatedAt: now,
    },
  }));

  await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS).create(sections as any);
}

export async function getProposalSections(proposalId: string): Promise<ProposalSection[]> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS)
      .select({
        filterByFormula: `{proposalId} = '${proposalId}'`,
      })
      .all();

    const sections = records.map((record) => ({
      id: record.id,
      proposalId: (record.get('proposalId') as string) || '',
      sectionKey: (record.get('sectionKey') as ProposalSectionKey) || 'scope',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as ProposalSection['status']) || 'empty',
      content: record.get('content') as string | null,
      sourceType: record.get('sourceType') as ProposalSection['sourceType'] | null,
      sourceRfpSectionKey: record.get('sourceRfpSectionKey') as string | null,
      sourceLibrarySectionId: record.get('sourceLibrarySectionId') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    }));

    // Sort by section order
    return sections.sort((a, b) => {
      const aIndex = SECTION_ORDER.indexOf(a.sectionKey);
      const bIndex = SECTION_ORDER.indexOf(b.sectionKey);
      return aIndex - bIndex;
    });
  } catch (error) {
    console.error('[proposals] Failed to get proposal sections:', error);
    return [];
  }
}

export async function getProposalSectionByKey(
  proposalId: string,
  sectionKey: ProposalSectionKey
): Promise<ProposalSection | null> {
  try {
    const base = getAirtableBase();
    const records = await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS)
      .select({
        filterByFormula: `AND({proposalId} = '${proposalId}', {sectionKey} = '${sectionKey}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      proposalId: (record.get('proposalId') as string) || '',
      sectionKey: (record.get('sectionKey') as ProposalSectionKey) || 'scope',
      title: (record.get('title') as string) || '',
      status: (record.get('status') as ProposalSection['status']) || 'empty',
      content: record.get('content') as string | null,
      sourceType: record.get('sourceType') as ProposalSection['sourceType'] | null,
      sourceRfpSectionKey: record.get('sourceRfpSectionKey') as string | null,
      sourceLibrarySectionId: record.get('sourceLibrarySectionId') as string | null,
      createdAt: record.get('createdAt') as string | null,
      updatedAt: record.get('updatedAt') as string | null,
    };
  } catch (error) {
    console.error('[proposals] Failed to get proposal section:', error);
    return null;
  }
}

export async function updateProposalSection(
  id: string,
  input: Partial<Omit<ProposalSectionInput, 'proposalId' | 'sectionKey'>>
): Promise<ProposalSection | null> {
  try {
    const base = getAirtableBase();
    const now = new Date().toISOString();

    const fields: Record<string, any> = { updatedAt: now };
    if (input.title !== undefined) fields.title = input.title;
    if (input.status !== undefined) fields.status = input.status;
    if (input.content !== undefined) fields.content = input.content;
    if (input.sourceType !== undefined) fields.sourceType = input.sourceType;
    if (input.sourceRfpSectionKey !== undefined) fields.sourceRfpSectionKey = input.sourceRfpSectionKey;
    if (input.sourceLibrarySectionId !== undefined) fields.sourceLibrarySectionId = input.sourceLibrarySectionId;

    const [updated] = await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS).update([{ id, fields }]);

    return {
      id: updated.id,
      proposalId: (updated.get('proposalId') as string) || '',
      sectionKey: (updated.get('sectionKey') as ProposalSectionKey) || 'scope',
      title: (updated.get('title') as string) || '',
      status: (updated.get('status') as ProposalSection['status']) || 'empty',
      content: updated.get('content') as string | null,
      sourceType: updated.get('sourceType') as ProposalSection['sourceType'] | null,
      sourceRfpSectionKey: updated.get('sourceRfpSectionKey') as string | null,
      sourceLibrarySectionId: updated.get('sourceLibrarySectionId') as string | null,
      createdAt: updated.get('createdAt') as string | null,
      updatedAt: now,
    };
  } catch (error) {
    console.error('[proposals] Failed to update proposal section:', error);
    return null;
  }
}

export async function createProposalSection(input: ProposalSectionInput): Promise<ProposalSection> {
  const base = getAirtableBase();
  const now = new Date().toISOString();

  const records = await base(AIRTABLE_TABLES.PROPOSAL_SECTIONS).create([{
    fields: {
      proposalId: input.proposalId,
      sectionKey: input.sectionKey,
      title: input.title,
      status: input.status || 'empty',
      content: input.content || undefined,
      sourceType: input.sourceType || undefined,
      sourceRfpSectionKey: input.sourceRfpSectionKey || undefined,
      sourceLibrarySectionId: input.sourceLibrarySectionId || undefined,
      createdAt: now,
      updatedAt: now,
    },
  }]) as unknown as Array<{ id: string }>;
  const record = records[0];

  return {
    id: record.id,
    proposalId: input.proposalId,
    sectionKey: input.sectionKey,
    title: input.title,
    status: input.status || 'empty',
    content: input.content || null,
    sourceType: input.sourceType || null,
    sourceRfpSectionKey: input.sourceRfpSectionKey || null,
    sourceLibrarySectionId: input.sourceLibrarySectionId || null,
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// Proposal with Full Details
// ============================================================================

export async function getProposalWithSections(proposalId: string): Promise<ProposalWithSections | null> {
  const [proposal, sections] = await Promise.all([
    getProposalById(proposalId),
    getProposalSections(proposalId),
  ]);

  if (!proposal) return null;

  return { proposal, sections };
}

// ============================================================================
// Helpers
// ============================================================================

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
