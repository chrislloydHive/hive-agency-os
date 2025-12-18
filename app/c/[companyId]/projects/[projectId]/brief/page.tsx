// app/c/[companyId]/projects/[projectId]/brief/page.tsx
// Creative Brief page

import { Suspense } from 'react';
import { BriefPageClient } from './BriefPageClient';

type PageProps = {
  params: Promise<{ companyId: string; projectId: string }>;
};

export default async function BriefPage({ params }: PageProps) {
  const { companyId, projectId } = await params;

  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-400">Loading brief...</div>
      }
    >
      <BriefPageClient
        companyId={companyId}
        projectId={projectId}
      />
    </Suspense>
  );
}
