'use client';

// components/projects/steps/ProjectStartModeStep.tsx
// Step 4: Select start mode (use_existing vs refresh_context)

import { Zap, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { ProjectTypeConfig } from '@/lib/projects/projectTypeRegistry';

interface ProjectStartModeStepProps {
  projectType: ProjectTypeConfig;
  selectedMode: 'use_existing' | 'refresh_context' | null;
  onSelectMode: (mode: 'use_existing' | 'refresh_context') => void;
}

interface ModeConfig {
  label: string;
  description: string;
  icon: typeof Zap;
  details: string[];
  recommended?: boolean;
}

export function ProjectStartModeStep({
  projectType,
  selectedMode,
  onSelectMode,
}: ProjectStartModeStepProps) {
  // Build mode configs based on project type
  const modeConfigs: Record<'use_existing' | 'refresh_context', ModeConfig> = {
    use_existing: {
      label: 'Use Existing Context',
      description: `Start your ${projectType.label.toLowerCase()} immediately using your current baseline`,
      icon: Zap,
      details: [
        'Uses your existing company context',
        'Start generating recommendations immediately',
        'You can refresh context later if needed',
        'Best when your baseline is recent',
      ],
      recommended: projectType.defaultStartMode === 'use_existing',
    },
    refresh_context: {
      label: 'Refresh Context First',
      description: 'Re-run analysis before starting your project',
      icon: RefreshCw,
      details: [
        `Run ${projectType.recommendedLabs.length > 0 ? projectType.recommendedLabs.slice(0, 3).join(', ') + ' labs' : 'recommended labs'}`,
        'Get fresh data for your project',
        'Takes a few minutes longer',
        'Best when baseline is stale or missing key data',
      ],
      recommended: projectType.defaultStartMode === 'refresh_context',
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          How would you like to start?
        </h3>
        <p className="text-sm text-slate-400">
          Choose whether to use your existing context or refresh it first
        </p>
      </div>

      <div className="space-y-3">
        {(Object.entries(modeConfigs) as [keyof typeof modeConfigs, ModeConfig][]).map(
          ([mode, config]) => {
            const Icon = config.icon;
            const isSelected = selectedMode === mode;

            return (
              <button
                key={mode}
                onClick={() => onSelectMode(mode)}
                className={`
                  w-full text-left p-5 rounded-xl border-2 transition-all
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
                    <Icon
                      className={`w-6 h-6 ${isSelected ? 'text-purple-400' : 'text-slate-400'}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-semibold ${isSelected ? 'text-purple-300' : 'text-white'}`}
                      >
                        {config.label}
                      </h4>
                      {config.recommended && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
                          Recommended
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-purple-400 ml-auto" />}
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{config.description}</p>

                    {/* Details list */}
                    <ul className="mt-3 space-y-1.5">
                      {config.details.map((detail, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-purple-400' : 'bg-slate-600'
                            }`}
                          />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* Helper text */}
      <p className="text-xs text-slate-500 text-center">
        {selectedMode === 'use_existing'
          ? 'You can always refresh context later if needed'
          : selectedMode === 'refresh_context'
          ? 'This will run labs to update your company context'
          : 'Select an option to continue'}
      </p>
    </div>
  );
}

export default ProjectStartModeStep;
