'use client';

// app/c/[companyId]/projects/ProjectsPageClient.tsx
// Projects list page client component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { ProjectList, CreateProjectModal } from '@/components/os/projects';
import type { ProjectListItem } from '@/lib/types/project';

interface ProjectsPageClientProps {
  companyId: string;
}

export function ProjectsPageClient({ companyId }: ProjectsPageClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch(`/api/os/companies/${companyId}/projects`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch projects');
        }

        setProjects(data.projects || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, [companyId]);

  const handleProjectCreated = (projectId: string) => {
    setShowCreateModal(false);
    router.push(`/c/${companyId}/projects/${projectId}`);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Projects</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage project-scoped deliverables with creative briefs
              </p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : (
          <ProjectList
            projects={projects}
            companyId={companyId}
            emptyMessage="No projects yet. Create your first project to get started."
          />
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateProjectModal
          companyId={companyId}
          engagementId="default" // TODO: Add engagement selection
          onClose={() => setShowCreateModal(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}

export default ProjectsPageClient;
