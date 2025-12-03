// lib/airtable/linkGapRuns.ts
// Link existing GAP runs to a company by domain
//
// When a company is created, this function finds any existing GAP-Plan Run
// and GAP-IA Run records that match the company's domain and links them
// to the new company record.

import { base } from './client';
import { AIRTABLE_TABLES } from './tables';
import { extractDomain } from '@/lib/utils/extractDomain';

interface LinkGapRunsResult {
  gapPlanRunsLinked: number;
  gapIaRunsLinked: number;
  errors: string[];
}

/**
 * Link existing GAP runs to a company by matching domain
 *
 * This function:
 * 1. Searches GAP-Plan Run table for records matching the domain
 * 2. Searches GAP-IA Run table for records matching the domain
 * 3. Updates the "Company" linked record field on matching records
 *
 * @param companyId - The Airtable record ID of the company (starts with 'rec')
 * @param domain - The domain to search for (e.g., 'example.com')
 * @returns Summary of linked records and any errors
 */
export async function linkGapRunsToCompany(
  companyId: string,
  domain: string
): Promise<LinkGapRunsResult> {
  const result: LinkGapRunsResult = {
    gapPlanRunsLinked: 0,
    gapIaRunsLinked: 0,
    errors: [],
  };

  if (!companyId || !companyId.startsWith('rec')) {
    result.errors.push(`Invalid company ID: ${companyId}`);
    return result;
  }

  if (!domain) {
    result.errors.push('No domain provided');
    return result;
  }

  // Normalize domain (remove www., trailing slashes, etc.)
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  console.log(`[LinkGapRuns] Linking GAP runs for domain: ${normalizedDomain} to company: ${companyId}`);

  // Link GAP-Plan Runs
  try {
    const gapPlanLinked = await linkGapPlanRuns(companyId, normalizedDomain);
    result.gapPlanRunsLinked = gapPlanLinked;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`GAP-Plan linking error: ${message}`);
    console.error('[LinkGapRuns] GAP-Plan error:', error);
  }

  // Link GAP-IA Runs
  try {
    const gapIaLinked = await linkGapIaRuns(companyId, normalizedDomain);
    result.gapIaRunsLinked = gapIaLinked;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`GAP-IA linking error: ${message}`);
    console.error('[LinkGapRuns] GAP-IA error:', error);
  }

  console.log(`[LinkGapRuns] Complete: ${result.gapPlanRunsLinked} GAP-Plan runs, ${result.gapIaRunsLinked} GAP-IA runs linked`);
  return result;
}

/**
 * Link GAP-Plan Run records to a company
 */
async function linkGapPlanRuns(companyId: string, domain: string): Promise<number> {
  const tableName = AIRTABLE_TABLES.GAP_PLAN_RUN;

  // Find records that match the domain and don't already have a company linked
  // The URL field contains the full URL, so we search with FIND
  const records = await base(tableName)
    .select({
      filterByFormula: `AND(
        OR(
          FIND('${domain}', {URL}),
          FIND('www.${domain}', {URL})
        ),
        OR(
          {Company} = BLANK(),
          LEN(ARRAYJOIN({Company})) = 0
        ),
        {Status} = 'completed'
      )`,
      maxRecords: 100,
    })
    .firstPage();

  if (records.length === 0) {
    console.log(`[LinkGapRuns] No unlinked GAP-Plan runs found for domain: ${domain}`);
    return 0;
  }

  console.log(`[LinkGapRuns] Found ${records.length} GAP-Plan runs to link for domain: ${domain}`);

  // Update each record to link to the company
  let linkedCount = 0;
  for (const record of records) {
    try {
      await base(tableName).update(record.id, {
        'Company': [companyId],
      });
      linkedCount++;
      console.log(`[LinkGapRuns] Linked GAP-Plan run ${record.id} to company ${companyId}`);
    } catch (error) {
      console.error(`[LinkGapRuns] Failed to link GAP-Plan run ${record.id}:`, error);
    }
  }

  return linkedCount;
}

/**
 * Link GAP-IA Run records to a company
 */
async function linkGapIaRuns(companyId: string, domain: string): Promise<number> {
  const tableName = AIRTABLE_TABLES.GAP_IA_RUN;

  // GAP-IA Run uses "Website URL" field and also has a "Domain" field
  // Search for matching domain in either field
  const records = await base(tableName)
    .select({
      filterByFormula: `AND(
        OR(
          FIND('${domain}', {Website URL}),
          FIND('www.${domain}', {Website URL}),
          {Domain} = '${domain}',
          {Domain} = 'www.${domain}'
        ),
        OR(
          {Company} = BLANK(),
          LEN(ARRAYJOIN({Company})) = 0
        )
      )`,
      maxRecords: 100,
    })
    .firstPage();

  if (records.length === 0) {
    console.log(`[LinkGapRuns] No unlinked GAP-IA runs found for domain: ${domain}`);
    return 0;
  }

  console.log(`[LinkGapRuns] Found ${records.length} GAP-IA runs to link for domain: ${domain}`);

  // Update each record to link to the company
  let linkedCount = 0;
  for (const record of records) {
    try {
      await base(tableName).update(record.id, {
        'Company': [companyId],
      });
      linkedCount++;
      console.log(`[LinkGapRuns] Linked GAP-IA run ${record.id} to company ${companyId}`);
    } catch (error) {
      console.error(`[LinkGapRuns] Failed to link GAP-IA run ${record.id}:`, error);
    }
  }

  return linkedCount;
}

/**
 * Convenience function to link GAP runs using a website URL
 * Extracts the domain from the URL and calls linkGapRunsToCompany
 */
export async function linkGapRunsToCompanyByUrl(
  companyId: string,
  websiteUrl: string
): Promise<LinkGapRunsResult> {
  const domain = extractDomain(websiteUrl);
  if (!domain) {
    return {
      gapPlanRunsLinked: 0,
      gapIaRunsLinked: 0,
      errors: [`Could not extract domain from URL: ${websiteUrl}`],
    };
  }
  return linkGapRunsToCompany(companyId, domain);
}
