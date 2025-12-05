'use client';

// app/c/[companyId]/setup/components/ActionFooter.tsx
// Footer with navigation and save actions

interface ActionFooterProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
  saveMessage: string | null;
  isLastStep: boolean;
}

export function ActionFooter({
  onPrevious,
  onNext,
  onSave,
  isSaving,
  isDirty,
  saveMessage,
  isLastStep,
}: ActionFooterProps) {
  return (
    <footer className="border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left side: Previous button */}
        <div>
          {onPrevious && (
            <button
              onClick={onPrevious}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
          )}
        </div>

        {/* Center: Status message */}
        <div className="flex items-center gap-4">
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'
              }`}
            >
              {saveMessage}
            </span>
          )}
          {isDirty && !isSaving && !saveMessage && (
            <span className="text-sm text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              Unsaved changes
            </span>
          )}
          {isSaving && (
            <span className="text-sm text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </span>
          )}
        </div>

        {/* Right side: Save and Next buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-2 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>

          {onNext && (
            <button
              onClick={onNext}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg font-medium transition-colors"
            >
              Save & Continue
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {isLastStep && (
            <button
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 disabled:opacity-50 text-white rounded-lg font-medium transition-all"
            >
              Complete Setup
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
