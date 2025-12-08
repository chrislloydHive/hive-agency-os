// app/c/[companyId]/findings/page.tsx
// Company Findings Page - Diagnostic Issues Hub
//
// This page shows all diagnostic findings for a company:
// - Summary strip with counts by severity, lab, category
// - Filters for labs, severities, categories, converted status
// - Table/list of findings with severity, lab, description
// - Detail drawer for full finding info and work item conversion

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { FindingsClient } from './FindingsClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    return { title: 'Company Not Found | Hive OS' };
  }

  return {
    title: `Findings | ${company.name} | Hive OS`,
    description: `Diagnostic findings and issues for ${company.name}`,
  };
}

export default async function FindingsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    return notFound();
  }

  return (
    <FindingsClient
      company={{
        id: company.id,
        name: company.name,
        website: company.website,
      }}
    />
  );
}
