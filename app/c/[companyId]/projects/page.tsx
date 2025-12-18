// app/c/[companyId]/projects/page.tsx
// Projects list page

import { Suspense } from 'react';
import { ProjectsPageClient } from './ProjectsPageClient';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function ProjectsPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">Loading projects...</div>
      }
    >
      <ProjectsPageClient companyId={companyId} />
    </Suspense>
  );
}
