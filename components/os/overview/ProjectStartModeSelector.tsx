'use client';

// components/os/overview/ProjectStartModeSelector.tsx
// Universal Project Start Mode Selector
//
// Single decision point for ALL project types:
// - use_existing: Start immediately with current context (default, recommended)
// - refresh_context: Re-run labs before starting
//
// This replaces per-project hacks (WebsiteProjectModeSelector, etc.)

import { ArrowLeft, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { ProjectStartMode, ProjectType } from '@/lib/types/engagement';
import { PROJECT_TYPE_CONFIG, PROJECT_FLOW_CONFIG } from '@/lib/types/engagement';

interface ProjectStartModeSelectorProps {
  projectType: ProjectType;
  selectedMode: ProjectStartMode | null;
  onSelectMode: (mode: ProjectStartMode) => void;
  onBack: () => void;
  onContinue: () => void;
  projectName?: string;
  disabled?: boolean;
}

interface StartModeConfig {
  label: string;
  description: string;
  icon: typeof Zap;
  details: string[];
  recommended?: boolean;
}

/**
 * Get mode configuration based on project type
 */
function getModeConfig(projectType: ProjectType): Record<ProjectStartMode, StartModeConfig> {
  const projectConfig = PROJECT_TYPE_CONFIG[projectType];
  const flowConfig = PROJECT_FLOW_CONFIG[projectType];
  const projectLabel = projectConfig.label.toLowerCase();

  return {
    use_existing: {
      label: 'Use Existing Context',
      description: `Start your ${projectLabel} project immediately using current baseline`,
      icon: Zap,
      details: [
        'Uses your existing company context',
        'Start generating recommendations immediately',
        'You can refresh context later if needed',
        'Best when your baseline is recent',
      ],
      recommended: true,
    },
    refresh_context: {
      label: 'Refresh Context First',
      description: 'Re-run analysis before starting your project',
      icon: RefreshCw,
      details: [
        `Run ${flowConfig.recommendedLabs.length > 0 ? flowConfig.recommendedLabs.slice(0, 3).join(', ') + ' labs' : 'comprehensive labs'}`,
        'Get fresh data for your project',
        'Takes a few minutes longer',
        'Best when baseline is stale or missing key data',
      ],
    },
  };
}

export function ProjectStartModeSelector({
  projectType,
  selectedMode,
  onSelectMode,
  onBack,
  onContinue,
  projectName,
  disabled = false,
}: ProjectStartModeSelectorProps) {
  const modeConfig = getModeConfig(projectType);
  const projectConfig = PROJECT_TYPE_CONFIG[projectType];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            disabled={disabled}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-lg font-semibold text-white">
              How would you like to start?
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {projectName ? `${projectName} · ` : ''}{projectConfig.label} Project
            </p>
          </div>
        </div>
      </div>

      {/* Mode Options */}
      <div className="p-5 space-y-4">
        {(Object.entries(modeConfig) as [ProjectStartMode, StartModeConfig][]).map(([mode, config]) => {
          const Icon = config.icon;
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              onClick={() => onSelectMode(mode)}
              disabled={disabled}
              className={`
                w-full text-left p-5 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`
                  flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
                  ${isSelected ? 'bg-purple-500/20' : 'bg-slate-700/50'}
                `}>
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold ${isSelected ? 'text-purple-300' : 'text-white'}`}>
                      {config.label}
                    </h4>
                    {config.recommended && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                        Recommended
                      </span>
                    )}
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-purple-400 ml-auto" />
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {config.description}
                  </p>

                  {/* Details list */}
                  <ul className="mt-3 space-y-1.5">
                    {config.details.map((detail, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-400' : 'bg-slate-600'}`} />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-slate-800 bg-slate-900/30">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {selectedMode === 'use_existing'
              ? 'You can always refresh context later if needed'
              : selectedMode === 'refresh_context'
              ? 'This will run labs to update your company context'
              : 'Select an option to continue'
            }
          </p>
          <button
            onClick={onContinue}
            disabled={!selectedMode || disabled}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-medium transition-all
              ${selectedMode
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg shadow-purple-500/25'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectStartModeSelector;
