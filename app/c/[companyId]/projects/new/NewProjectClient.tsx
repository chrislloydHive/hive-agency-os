'use client';

// app/c/[companyId]/projects/new/NewProjectClient.tsx
// New Project Wizard Client Component

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectWizardShell, type WizardState } from '@/components/projects';
import type { ProjectTypeConfig } from '@/lib/projects/projectTypeRegistry';

interface NewProjectClientProps {
  companyId: string;
  companyName: string;
  initialCategory?: string;
  initialProjectType?: string;
}

export function NewProjectClient({
  companyId,
  companyName,
  initialCategory,
  initialProjectType,
}: NewProjectClientProps) {
  const router = useRouter();

  // Handle wizard completion
  const handleComplete = useCallback(
    async (state: WizardState & { projectType: ProjectTypeConfig }) => {
      const { projectType, startMode, brief } = state;

      if (startMode === 'use_existing') {
        // Route directly to generation/execution
        // Use the flow type to determine the route
        const executionRoute = getExecutionRoute(companyId, projectType);

        // Store brief in session storage for the execution page to pick up
        if (Object.keys(brief).length > 0) {
          sessionStorage.setItem(
            `project_brief_${companyId}_${projectType.key}`,
            JSON.stringify(brief)
          );
        }

        router.push(executionRoute);
      } else {
        // refresh_context path - route to labs with preselected labs
        const labParams = new URLSearchParams({
          source: 'project_wizard',
          projectType: projectType.key,
          labs: projectType.recommendedLabs.join(','),
        });

        // Store brief for after context refresh
        if (Object.keys(brief).length > 0) {
          sessionStorage.setItem(
            `project_brief_${companyId}_${projectType.key}`,
            JSON.stringify(brief)
          );
        }

        router.push(`/c/${companyId}/labs?${labParams.toString()}`);
      }
    },
    [companyId, router]
  );

  // Handle wizard cancellation
  const handleCancel = useCallback(() => {
    router.push(`/c/${companyId}`);
  }, [companyId, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-8">
          <button
            onClick={() => router.push(`/c/${companyId}`)}
            className="hover:text-white transition-colors"
          >
            {companyName}
          </button>
          <span>/</span>
          <span>New Project</span>
        </div>

        {/* Wizard */}
        <ProjectWizardShell
          companyId={companyId}
          onComplete={handleComplete}
          onCancel={handleCancel}
          initialCategory={initialCategory as any}
          initialProjectType={initialProjectType}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Route Helpers
// ============================================================================

/**
 * Get the execution route for a project type
 * This maps project types to their execution entry points
 */
function getExecutionRoute(companyId: string, projectType: ProjectTypeConfig): string {
  // Map generator keys to routes
  const routeMap: Record<string, string> = {
    website_optimization: `/c/${companyId}/projects/website-optimize/setup`,
    website_new: `/c/${companyId}/projects/website-new/setup`,
    seo_fix: `/c/${companyId}/projects/seo/setup`,
    content_strategy: `/c/${companyId}/projects/content/setup`,
    paid_search: `/c/${companyId}/projects/paid-search/setup`,
    analytics_setup: `/c/${companyId}/projects/analytics/setup`,
    creative_system: `/c/${companyId}/projects/creative/setup`,
    generic: `/c/${companyId}/projects/generic/setup`,
  };

  return routeMap[projectType.generator] || `/c/${companyId}/projects/${projectType.key}/setup`;
}

export default NewProjectClient;
