// app/os/jobs/page.tsx
// Jobs List Page
//
// Lists all jobs with status, client, project name, and Drive link.

import { Metadata } from 'next';
import { listJobs } from '@/lib/airtable/jobs';
import { getAllCompanies, getCompaniesWithClientCode } from '@/lib/airtable/companies';
import { JobsPageClient } from './JobsPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Jobs - Hive OS',
  description: 'Project intake and job management',
};

export default async function JobsPage() {
  const [jobs, allCompanies, companiesWithClientCode] = await Promise.all([
    listJobs({ limit: 200 }),
    getAllCompanies(),
    getCompaniesWithClientCode(),
  ]);

  // Build company lookup for enrichment
  const companyLookup = new Map<string, { id: string; name: string; clientCode?: string }>();
  for (const company of allCompanies) {
    companyLookup.set(company.id, {
      id: company.id,
      name: company.name,
      clientCode: company.clientCode,
    });
  }

  // Enrich jobs with company names
  const enrichedJobs = jobs.map((job) => ({
    ...job,
    companyName: companyLookup.get(job.companyId)?.name || 'Unknown',
  }));

  // Companies eligible for job creation (have clientCode)
  const eligibleCompanies = companiesWithClientCode.map((c) => ({
    id: c.id,
    name: c.name,
    clientCode: c.clientCode!,
    hasDriveFolder: !!c.driveClientFolderId,
  }));

  return (
    <div className="p-8">
      <JobsPageClient jobs={enrichedJobs} companies={eligibleCompanies} />
    </div>
  );
}
