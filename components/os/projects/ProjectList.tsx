'use client';

// components/os/projects/ProjectList.tsx
// List of projects for a company

import { ProjectCard } from './ProjectCard';
import type { ProjectListItem } from '@/lib/types/project';

interface ProjectListProps {
  projects: ProjectListItem[];
  companyId: string;
  loading?: boolean;
  emptyMessage?: string;
}

export function ProjectList({
  projects,
  companyId,
  loading = false,
  emptyMessage = 'No projects yet',
}: ProjectListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-slate-800/30 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          companyId={companyId}
        />
      ))}
    </div>
  );
}

export default ProjectList;
