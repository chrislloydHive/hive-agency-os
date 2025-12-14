// app/c/[companyId]/programs/page.tsx
// Programs Index Page
//
// Landing page showing cards for each program type
// - Website Program card
// - Content Program card
// Each shows status, last updated, and primary action

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getProgramsForCompany } from '@/lib/airtable/programs';
import { ProgramsIndexClient } from './ProgramsIndexClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ProgramsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, contextGraph, programs] = await Promise.all([
    getCompanyById(companyId),
    loadContextGraph(companyId),
    getProgramsForCompany(companyId),
  ]);

  if (!company) {
    return notFound();
  }

  // Check lab readiness
  const hasWebsiteLab = !!(contextGraph?.website?.executiveSummary?.value);
  const hasContentLab = !!(contextGraph?.content?.contentSummary?.value);

  return (
    <ProgramsIndexClient
      companyId={companyId}
      companyName={company.name}
      programs={programs}
      hasWebsiteLab={hasWebsiteLab}
      hasContentLab={hasContentLab}
    />
  );
}
