// app/c/[companyId]/setup/page.tsx
// Strategic Setup Mode entry point

import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { redirect } from 'next/navigation';
import { SetupClient } from './SetupClient';

export default async function SetupPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompanyById(companyId);

  if (!company) {
    redirect('/companies');
  }

  // Load existing context graph if available
  const contextGraph = await loadContextGraph(companyId);

  return (
    <SetupClient
      companyId={companyId}
      companyName={company.name}
      initialGraph={contextGraph}
    />
  );
}
