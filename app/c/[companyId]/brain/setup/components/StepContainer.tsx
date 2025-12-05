'use client';

// app/c/[companyId]/setup/components/StepContainer.tsx
// Container wrapper for each step's content

interface StepContainerProps {
  title: string;
  description: string;
  stepNumber: number;
  totalSteps: number;
  children: React.ReactNode;
}

export function StepContainer({
  title,
  description,
  stepNumber,
  totalSteps,
  children,
}: StepContainerProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Step header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
            Step {stepNumber} of {totalSteps}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100">{title}</h2>
        <p className="text-slate-400 mt-1">{description}</p>
      </div>

      {/* Step content */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}

// Reusable form section
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        {description && (
          <p className="text-sm text-slate-400 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

// Reusable form field
export function FormField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-500 mt-1.5">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-1.5">{error}</p>
      )}
    </div>
  );
}

// Input styles
export const inputStyles = {
  base: 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors',
  textarea: 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors resize-none',
  select: 'w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors appearance-none cursor-pointer',
};

// Tag input component
export function TagInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const input = e.currentTarget;
      const newTag = input.value.trim();
      if (newTag && !value.includes(newTag)) {
        onChange([...value, newTag]);
        input.value = '';
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-purple-400 hover:text-purple-200"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder={placeholder || 'Type and press Enter to add...'}
        onKeyDown={handleKeyDown}
        className={inputStyles.base}
      />
      {suggestions && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions
            .filter((s) => !value.includes(s))
            .slice(0, 5)
            .map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onChange([...value, suggestion])}
                className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                + {suggestion}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Action button for opening labs
export function LabLink({
  companyId,
  lab,
  label,
}: {
  companyId: string;
  lab: 'audience' | 'media' | 'website' | 'creative';
  label: string;
}) {
  const labUrls: Record<string, string> = {
    audience: `/c/${companyId}/diagnostics/audience`,
    media: `/c/${companyId}/diagnostics/media`,
    website: `/c/${companyId}/diagnostics/website`,
    creative: `/c/${companyId}/blueprint`,
  };

  return (
    <a
      href={labUrls[lab]}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 hover:text-slate-100 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}
