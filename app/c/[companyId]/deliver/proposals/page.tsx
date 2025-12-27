// app/c/[companyId]/deliver/proposals/page.tsx
// Plan Proposals Index - Review pending AI-generated plan proposals
//
// Lists all proposals for the company with filtering by status.
// Links to individual proposal detail pages for review/accept/reject.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getProposalsForCompany } from '@/lib/airtable/planProposals';
import { ProposalsClient } from './ProposalsClient';

export const dynamic = 'force-dynamic';

interface ProposalsPageProps {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: ProposalsPageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Plan Proposals | ${company.name} | Hive OS`,
    description: `Review AI-generated plan proposals for ${company.name}`,
  };
}

export default async function ProposalsPage({ params }: ProposalsPageProps) {
  const { companyId } = await params;

  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  // Load all proposals for this company
  const proposals = await getProposalsForCompany(companyId);

  return (
    <ProposalsClient
      companyId={companyId}
      companyName={company.name}
      proposals={proposals}
    />
  );
}
