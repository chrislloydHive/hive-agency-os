'use client';

// components/os/projects/ProjectCard.tsx
// Project summary card for display in lists

import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, Lock, FileText } from 'lucide-react';
import type { ProjectListItem } from '@/lib/types/project';
import {
  PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_COLORS,
} from '@/lib/types/project';

interface ProjectCardProps {
  project: ProjectListItem;
  companyId: string;
}

export function ProjectCard({ project, companyId }: ProjectCardProps) {
  // Determine progress step
  const getProgressStep = () => {
    if (project.briefApproved) return 4;
    if (project.hasAcceptedBets) return 3;
    if (project.gapReady) return 2;
    return 1;
  };

  const progressStep = getProgressStep();
  const progressLabels = ['Setup', 'GAP', 'Strategy', 'Brief'];

  return (
    <Link
      href={`/c/${companyId}/projects/${project.id}`}
      className="block p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-white truncate">
              {project.name}
            </h3>
            {project.isLocked && (
              <Lock className="w-3 h-3 text-slate-500 flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-1.5 py-0.5 rounded bg-slate-700/50">
              {PROJECT_TYPE_LABELS[project.type] || project.type}
            </span>
            <span className={`px-1.5 py-0.5 rounded ${PROJECT_STATUS_COLORS[project.status]}`}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-3">
        <div className="flex items-center gap-1 mb-1">
          {progressLabels.map((label, i) => {
            const stepNum = i + 1;
            const isComplete = progressStep > stepNum;
            const isCurrent = progressStep === stepNum;

            return (
              <div key={label} className="flex-1">
                <div
                  className={`h-1 rounded-full ${
                    isComplete
                      ? 'bg-emerald-500'
                      : isCurrent
                        ? 'bg-amber-500'
                        : 'bg-slate-700'
                  }`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500">
          {progressLabels.map((label, i) => {
            const stepNum = i + 1;
            const isComplete = progressStep > stepNum;
            const isCurrent = progressStep === stepNum;

            return (
              <span
                key={label}
                className={
                  isComplete
                    ? 'text-emerald-400'
                    : isCurrent
                      ? 'text-amber-400'
                      : ''
                }
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Status indicators */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          {project.gapReady ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-400" />
          )}
          <span className={project.gapReady ? 'text-emerald-400' : 'text-amber-400'}>
            GAP
          </span>
        </div>

        <div className="flex items-center gap-1">
          {project.hasAcceptedBets ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <Clock className="w-3 h-3 text-slate-500" />
          )}
          <span className={project.hasAcceptedBets ? 'text-emerald-400' : 'text-slate-500'}>
            Bets
          </span>
        </div>

        <div className="flex items-center gap-1">
          {project.briefApproved ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          ) : (
            <FileText className="w-3 h-3 text-slate-500" />
          )}
          <span className={project.briefApproved ? 'text-emerald-400' : 'text-slate-500'}>
            Brief
          </span>
        </div>
      </div>
    </Link>
  );
}

export default ProjectCard;
