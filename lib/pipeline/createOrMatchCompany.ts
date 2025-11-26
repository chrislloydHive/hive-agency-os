// lib/pipeline/createOrMatchCompany.ts
// Smart company creation/matching for inbound lead ingestion

import type { InboundLeadItem } from '@/lib/types/pipeline';
import type { CompanyRecord } from '@/lib/airtable/companies';
import {
  findCompanyByDomain,
  findCompanyByName,
  createCompany,
} from '@/lib/airtable/companies';
import { extractDomain, normalizeCompanyName, companyNamesMatch } from '@/lib/utils/extractDomain';

export interface CreateOrMatchResult {
  company: CompanyRecord;
  isNew: boolean;
  matchedBy: 'domain' | 'name' | 'created';
}

/**
 * Create or match a company from an inbound lead
 *
 * Flow:
 * 1. Extract domain from lead's website
 * 2. Try to find existing company by domain
 * 3. If not found, try to find by company name (fuzzy match)
 * 4. If still not found, create new company as Prospect
 *
 * @param lead - The inbound lead to process
 * @returns Company record and metadata about how it was matched/created
 */
export async function createOrMatchCompanyFromInboundLead(
  lead: InboundLeadItem
): Promise<CreateOrMatchResult> {
  console.log(`[CreateOrMatch] Processing lead: ${lead.name || lead.companyName || lead.website}`);

  // Step 1: Extract domain from website
  const domain = lead.website ? extractDomain(lead.website) : null;
  console.log(`[CreateOrMatch] Extracted domain: ${domain}`);

  // Step 2: Try to find by domain first (most reliable)
  if (domain) {
    const companyByDomain = await findCompanyByDomain(domain);
    if (companyByDomain) {
      console.log(`[CreateOrMatch] ✅ Found existing company by domain: ${companyByDomain.name}`);
      return {
        company: companyByDomain,
        isNew: false,
        matchedBy: 'domain',
      };
    }
  }

  // Step 3: Try to find by company name (if provided)
  if (lead.companyName) {
    // First try exact match
    let companyByName = await findCompanyByName(lead.companyName, false);

    // If no exact match, try fuzzy match
    if (!companyByName) {
      companyByName = await findCompanyByName(lead.companyName, true);
    }

    if (companyByName) {
      // Verify it's a reasonable match (normalize and compare)
      const normalized1 = normalizeCompanyName(lead.companyName);
      const normalized2 = normalizeCompanyName(companyByName.name);

      if (companyNamesMatch(normalized1, normalized2)) {
        console.log(`[CreateOrMatch] ✅ Found existing company by name: ${companyByName.name}`);
        return {
          company: companyByName,
          isNew: false,
          matchedBy: 'name',
        };
      }
    }
  }

  // Step 4: No match found - create new company
  console.log(`[CreateOrMatch] No existing company found, creating new Prospect`);

  // Determine company name
  const companyName = lead.companyName
    || (domain ? domainToDisplayName(domain) : null)
    || lead.name
    || 'Unknown Company';

  const newCompany = await createCompany({
    name: companyName,
    website: lead.website || undefined,
    domain: domain || undefined,
    stage: 'Prospect',
    source: mapLeadSourceToCompanySource(lead.leadSource),
  });

  if (!newCompany) {
    throw new Error('Failed to create company');
  }

  console.log(`[CreateOrMatch] ✅ Created new company: ${newCompany.name} (${newCompany.id})`);

  return {
    company: newCompany,
    isNew: true,
    matchedBy: 'created',
  };
}

/**
 * Convert a domain to a readable display name
 */
function domainToDisplayName(domain: string): string {
  if (!domain) return '';

  // Get the name part (before TLD)
  const parts = domain.split('.');
  if (parts.length === 0) return '';

  // Take everything except the TLD
  const namePart = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];

  // Convert hyphens and underscores to spaces
  const cleaned = namePart.replace(/[-_]/g, ' ');

  // Capitalize each word
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Map lead source to company source
 */
function mapLeadSourceToCompanySource(
  leadSource?: string | null
): CompanyRecord['source'] | undefined {
  if (!leadSource) return 'Inbound';

  const source = leadSource.toLowerCase();

  if (source.includes('dma') || source.includes('form') || source.includes('website')) {
    return 'Inbound';
  }
  if (source.includes('referral')) {
    return 'Referral';
  }
  if (source.includes('outbound') || source.includes('cold')) {
    return 'Outbound';
  }

  return 'Other';
}

/**
 * Simplified version for manual company creation (wizard)
 * Uses findOrCreateCompanyByDomain if website is provided
 */
export async function createProspectCompany(params: {
  name: string;
  website?: string;
  industry?: string;
  companyType?: CompanyRecord['companyType'];
  sizeBand?: CompanyRecord['sizeBand'];
  owner?: string;
  notes?: string;
}): Promise<CompanyRecord | null> {
  // If website provided, check for existing company first
  if (params.website) {
    const domain = extractDomain(params.website);
    const existing = await findCompanyByDomain(domain);

    if (existing) {
      console.log(`[CreateProspect] Company already exists for domain ${domain}: ${existing.name}`);
      return existing;
    }
  }

  // Create new prospect
  return createCompany({
    name: params.name,
    website: params.website,
    industry: params.industry,
    companyType: params.companyType,
    sizeBand: params.sizeBand,
    stage: 'Prospect',
    owner: params.owner,
    notes: params.notes,
  });
}
