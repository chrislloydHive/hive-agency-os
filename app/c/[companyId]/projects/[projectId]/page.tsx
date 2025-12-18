// app/c/[companyId]/projects/[projectId]/page.tsx
// Project detail page - routes to strategy or brief based on status

import { redirect } from 'next/navigation';
import { getProjectWithDetails } from '@/lib/os/projects';

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ companyId: string; projectId: string }>;
}) {
  const { companyId, projectId } = await params;

  // Fetch project details
  const viewModel = await getProjectWithDetails(projectId);

  if (!viewModel) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="p-6 bg-slate-800/50 rounded-lg border border-slate-700">
          <h2 className="text-lg font-medium text-white mb-2">Project not found</h2>
          <p className="text-slate-400">
            The project you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
        </div>
      </div>
    );
  }

  // Route based on project state
  const { project, readiness } = viewModel;

  // If brief is approved, show brief page
  if (project.briefApproved) {
    redirect(`/c/${companyId}/projects/${projectId}/brief`);
  }

  // Otherwise, show strategy page
  redirect(`/c/${companyId}/projects/${projectId}/strategy`);
}
