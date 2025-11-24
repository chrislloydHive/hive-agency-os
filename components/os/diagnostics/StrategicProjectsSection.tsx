// components/os/diagnostics/StrategicProjectsSection.tsx
// Strategic Projects Section Component

'use client';

import type { StrategicProject } from '@/lib/diagnostics/types';

type Props = {
  projects: StrategicProject[];
};

export function StrategicProjectsSection({ projects }: Props) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-bold text-slate-100">
        Strategic Projects
        <span className="ml-2 text-lg font-normal text-slate-400">
          ({projects.length})
        </span>
      </h2>
      <p className="mb-4 text-sm text-slate-400">
        Broader strategic recommendations beyond tactical fixes
      </p>
      <div className="space-y-3">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-lg border border-slate-700 bg-slate-900/50 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold text-slate-100">{project.title}</h3>
            <p className="mb-2 text-xs leading-relaxed text-slate-300">{project.description}</p>
            <p className="text-xs text-slate-500">
              <strong>Why:</strong> {project.reasoning}
            </p>
            {project.expectedImpact && (
              <p className="mt-2 text-xs text-slate-500">
                <strong>Expected Impact:</strong> {project.expectedImpact}
              </p>
            )}
            {project.timeHorizon && (
              <p className="mt-1 text-xs text-slate-500">
                <strong>Time Horizon:</strong> {project.timeHorizon}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
