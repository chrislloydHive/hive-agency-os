// app/c/[companyId]/documents/page.tsx
// Documents Page
//
// Lists all artifacts/deliverables for a company with:
// - Pinned primary document
// - Grouped by type/phase
// - Staleness warnings and update actions
// - MSA (Master Services Agreement) panel for client-level documents
//
// DATA SOURCE: CompanyArtifactIndex (canonical) + Artifacts table (legacy)
// The index is the primary source. The Artifacts table is merged for backward compatibility.

import { notFound } from 'next/navigation';
import { getCompanyById } from '@/lib/airtable/companies';
import { getArtifactsForCompany } from '@/lib/airtable/artifacts';
import { getArtifactIndexForCompany } from '@/lib/airtable/artifactIndex';
import { DocumentsClient } from './DocumentsClient';
import { MsaPanel } from '@/components/os/documents/MsaPanel';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DocumentsPage({ params }: PageProps) {
  const { companyId } = await params;

  // Fetch all required data in parallel
  const [company, legacyArtifacts, indexedArtifacts] = await Promise.all([
    getCompanyById(companyId),
    getArtifactsForCompany(companyId).catch(() => []),
    getArtifactIndexForCompany(companyId).catch(() => []),
  ]);

  if (!company) {
    return notFound();
  }

  // Log query results for debugging
  console.log('[Documents Page] Query results:', {
    companyId,
    legacyArtifactsCount: legacyArtifacts.length,
    indexedArtifactsCount: indexedArtifacts.length,
  });

  return (
    <div className="space-y-6">
      {/* MSA Panel - Client-level Master Services Agreement */}
      <MsaPanel
        companyId={companyId}
        companyName={company.name}
        msaDriveUrl={company.msaDriveUrl}
        hasDriveFolder={!!company.driveClientFolderId}
      />

      {/* Artifacts/Deliverables */}
      <DocumentsClient
        companyId={companyId}
        companyName={company.name}
        initialArtifacts={legacyArtifacts}
        initialIndexedArtifacts={indexedArtifacts}
      />
    </div>
  );
}
