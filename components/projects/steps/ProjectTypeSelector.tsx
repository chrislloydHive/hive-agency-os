'use client';

// components/projects/steps/ProjectTypeSelector.tsx
// Step 2: Select specific project type within category

import * as LucideIcons from 'lucide-react';
import {
  PROJECT_CATEGORY_INFO,
  type ProjectCategory,
  type ProjectTypeConfig,
} from '@/lib/projects/projectTypeRegistry';

interface ProjectTypeSelectorProps {
  category: ProjectCategory;
  availableTypes: ProjectTypeConfig[];
  selectedTypeKey: string | null;
  onSelectType: (typeKey: string) => void;
}

export function ProjectTypeSelector({
  category,
  availableTypes,
  selectedTypeKey,
  onSelectType,
}: ProjectTypeSelectorProps) {
  const categoryInfo = PROJECT_CATEGORY_INFO[category];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          Select your {categoryInfo.label.toLowerCase()} project
        </h3>
        <p className="text-sm text-slate-400">
          Choose the specific type of project you want to start
        </p>
      </div>

      <div className="space-y-3">
        {availableTypes.map((projectType) => {
          const IconComponent = LucideIcons[projectType.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;
          const isSelected = selectedTypeKey === projectType.key;

          return (
            <button
              key={projectType.key}
              onClick={() => onSelectType(projectType.key)}
              className={`
                w-full p-4 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800'
                }
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`
                    flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
                    ${isSelected ? 'bg-purple-500/20' : 'bg-slate-700/50'}
                  `}
                >
                  {IconComponent && (
                    <IconComponent
                      className={`w-6 h-6 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                      {projectType.label}
                    </h4>
                    {isSelected && (
                      <LucideIcons.CheckCircle2 className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {projectType.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 mt-3">
                    {/* Required domains */}
                    {projectType.requiredDomains.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <LucideIcons.Database className="w-3.5 h-3.5" />
                        <span>
                          Needs: {projectType.requiredDomains.slice(0, 3).join(', ')}
                          {projectType.requiredDomains.length > 3 && ` +${projectType.requiredDomains.length - 3}`}
                        </span>
                      </div>
                    )}

                    {/* Default start mode */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      {projectType.defaultStartMode === 'use_existing' ? (
                        <>
                          <LucideIcons.Zap className="w-3.5 h-3.5" />
                          <span>Quick start</span>
                        </>
                      ) : (
                        <>
                          <LucideIcons.RefreshCw className="w-3.5 h-3.5" />
                          <span>Context refresh</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {availableTypes.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <LucideIcons.FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No project types available in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectTypeSelector;
