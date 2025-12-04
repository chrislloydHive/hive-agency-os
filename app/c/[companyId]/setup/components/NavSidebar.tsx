'use client';

// app/c/[companyId]/setup/components/NavSidebar.tsx
// Left navigation sidebar for Strategic Setup Mode

import { SetupStepId, SETUP_STEPS, SETUP_STEP_CONFIG, getStepIndex } from '../types';

interface NavSidebarProps {
  currentStep: SetupStepId;
  completedSteps: SetupStepId[];
  onNavigate: (step: SetupStepId) => void;
  onOpenAIAssist?: () => void;
  onExportDraft?: () => void;
}

export function NavSidebar({
  currentStep,
  completedSteps,
  onNavigate,
  onOpenAIAssist,
  onExportDraft,
}: NavSidebarProps) {
  return (
    <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Setup Progress
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full transition-all duration-500"
              style={{
                width: `${((completedSteps.length) / SETUP_STEPS.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {completedSteps.length}/{SETUP_STEPS.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {SETUP_STEPS.map((stepId, index) => {
          const config = SETUP_STEP_CONFIG[stepId];
          const isCurrent = currentStep === stepId;
          const isCompleted = completedSteps.includes(stepId);
          const isAccessible = isCompleted || index === 0 || completedSteps.includes(SETUP_STEPS[index - 1]);

          return (
            <button
              key={stepId}
              onClick={() => isAccessible && onNavigate(stepId)}
              disabled={!isAccessible}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors relative ${
                isCurrent
                  ? 'bg-slate-800 border-l-2 border-purple-500'
                  : isAccessible
                  ? 'hover:bg-slate-800/50 border-l-2 border-transparent'
                  : 'opacity-50 cursor-not-allowed border-l-2 border-transparent'
              }`}
            >
              {/* Step number/status indicator */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                  isCompleted
                    ? 'bg-green-500/20 text-green-400'
                    : isCurrent
                    ? 'bg-purple-500/20 text-purple-400 ring-2 ring-purple-500/50'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Step info */}
              <div className="min-w-0">
                <div
                  className={`text-sm font-medium truncate ${
                    isCurrent ? 'text-slate-100' : 'text-slate-300'
                  }`}
                >
                  {config.shortLabel}
                </div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {config.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <QuickButton
          icon="sparkles"
          label="AI Assist"
          description="Get AI suggestions"
          onClick={onOpenAIAssist}
        />
        <QuickButton
          icon="download"
          label="Export Draft"
          description="Save progress"
          onClick={onExportDraft}
        />
      </div>
    </nav>
  );
}

function QuickButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: 'sparkles' | 'download';
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon === 'sparkles' ? (
        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      <div className="min-w-0 text-left">
        <div className="text-xs font-medium text-slate-300 group-hover:text-slate-100">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
    </button>
  );
}
