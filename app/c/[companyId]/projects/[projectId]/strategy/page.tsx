// app/c/[companyId]/projects/[projectId]/strategy/page.tsx
// Project Strategy Workspace page

import { Suspense } from 'react';
import { ProjectStrategyClient } from './ProjectStrategyClient';

type PageProps = {
  params: Promise<{ companyId: string; projectId: string }>;
};

export default async function ProjectStrategyPage({ params }: PageProps) {
  const { companyId, projectId } = await params;

  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">Loading strategy...</div>
      }
    >
      <ProjectStrategyClient
        companyId={companyId}
        projectId={projectId}
      />
    </Suspense>
  );
}
