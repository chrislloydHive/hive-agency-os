// app/os/jobs/[jobId]/page.tsx
// Job Detail Page
//
// Shows job metadata, provisioning status, and Drive folder link.

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getJobById } from '@/lib/airtable/jobs';
import { getCompanyById } from '@/lib/airtable/companies';
import { JobDetailClient } from './JobDetailClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  const job = await getJobById(jobId);

  if (!job) {
    return { title: 'Job Not Found - Hive OS' };
  }

  return {
    title: `${job.jobCode} - ${job.projectName} - Hive OS`,
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { jobId } = await params;

  const job = await getJobById(jobId);
  if (!job) {
    notFound();
  }

  // Enrich with company name
  const company = await getCompanyById(job.companyId);

  const enrichedJob = {
    ...job,
    companyName: company?.name || 'Unknown',
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <JobDetailClient job={enrichedJob} />
    </div>
  );
}
