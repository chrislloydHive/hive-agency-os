// app/c/[companyId]/artifacts/[artifactId]/page.tsx
// Artifact Viewer/Editor Page
//
// Displays a generated artifact with options to:
// - View structured or markdown content
// - Regenerate the artifact
// - Export to Google Drive

import { notFound } from 'next/navigation';
import { getArtifactById } from '@/lib/airtable/artifacts';
import { getCompanyById } from '@/lib/airtable/companies';
import { ArtifactViewerClient } from './ArtifactViewerClient';

interface ArtifactPageProps {
  params: Promise<{
    companyId: string;
    artifactId: string;
  }>;
}

export default async function ArtifactPage({ params }: ArtifactPageProps) {
  const { companyId, artifactId } = await params;

  // Load artifact and company
  const [artifact, company] = await Promise.all([
    getArtifactById(artifactId),
    getCompanyById(companyId),
  ]);

  // Validate artifact exists and belongs to company
  if (!artifact || artifact.companyId !== companyId) {
    notFound();
  }

  if (!company) {
    notFound();
  }

  return (
    <ArtifactViewerClient
      artifact={artifact}
      companyId={companyId}
      companyName={company.name}
    />
  );
}
