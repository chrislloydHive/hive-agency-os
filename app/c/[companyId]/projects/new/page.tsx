// app/c/[companyId]/projects/new/page.tsx
// New Project Page - Universal Project Wizard Entry Point

import { getCompanyById } from '@/lib/airtable/companies';
import { notFound } from 'next/navigation';
import { NewProjectClient } from './NewProjectClient';
import type { ProjectCategory } from '@/lib/projects/projectTypeRegistry';

interface NewProjectPageProps {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    type?: string;
    category?: string;
  }>;
}

export default async function NewProjectPage({ params, searchParams }: NewProjectPageProps) {
  const { companyId } = await params;
  const { type: projectType, category } = await searchParams;

  // Load company
  const company = await getCompanyById(companyId);
  if (!company) {
    notFound();
  }

  return (
    <NewProjectClient
      companyId={companyId}
      companyName={company.name}
      initialCategory={category as ProjectCategory | undefined}
      initialProjectType={projectType}
    />
  );
}
