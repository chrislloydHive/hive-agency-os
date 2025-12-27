// app/c/[companyId]/deliver/artifacts/page.tsx
// Artifacts Page (within Deliver phase)
//
// Company artifacts home - lists all artifacts with filtering, actions, and
// links to generate new artifacts via the unified GenerateArtifactModal.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { getActiveStrategy } from '@/lib/os/strategy';
import { ArtifactsPageClient } from './ArtifactsPageClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ArtifactsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, artifacts, strategy] = await Promise.all([
    getCompanyById(companyId),
    getArtifactsForCompany(companyId).catch(() => []),
    getActiveStrategy(companyId).catch(() => null),
  ]);

  if (!company) {
    return notFound();
  }

  return (
    <ArtifactsPageClient
      companyId={companyId}
      companyName={company.name}
      initialArtifacts={artifacts}
      strategyId={strategy?.id ?? null}
    />
  );
}
