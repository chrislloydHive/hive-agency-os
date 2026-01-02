// app/c/[companyId]/artifacts/page.tsx
// Artifacts Page - Output ledger for all generated artifacts
//
// Information Architecture:
// - Section 1: Generated Artifacts (table/list view)
// - Section 2: Create New Artifact (template action cards)
// - Section 3: Template Library (collapsible, advanced)
//
// DATA SOURCE: CompanyArtifactIndex (canonical) + Artifacts table (legacy)

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { getArtifactIndexForCompany } from '@/lib/airtable/artifactIndex';
import { listTemplates } from '@/lib/airtable/templates';
import { ArtifactsClient } from './ArtifactsClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ArtifactsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, legacyArtifacts, indexedArtifacts, templates] = await Promise.all([
    getCompanyById(companyId),
    getArtifactsForCompany(companyId).catch(() => []),
    getArtifactIndexForCompany(companyId).catch(() => []),
    listTemplates().catch(() => []),
  ]);

  if (!company) {
    return notFound();
  }

  // Log query results for debugging
  console.log('[Artifacts Page] Query results:', {
    companyId,
    legacyArtifactsCount: legacyArtifacts.length,
    indexedArtifactsCount: indexedArtifacts.length,
    templatesCount: templates.length,
  });

  return (
    <ArtifactsClient
      companyId={companyId}
      companyName={company.name}
      initialArtifacts={legacyArtifacts}
      initialIndexedArtifacts={indexedArtifacts as any}
      templates={templates}
      msaDriveUrl={(company as any).msaDriveUrl}
      hasDriveFolder={!!(company as any).driveClientFolderId}
    />
  );
}
