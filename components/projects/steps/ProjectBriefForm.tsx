'use client';

// components/projects/steps/ProjectBriefForm.tsx
// Step 3: Fill in project brief (config-driven fields)

import { HelpCircle } from 'lucide-react';
import type { ProjectTypeConfig, BriefFieldConfig } from '@/lib/projects/projectTypeRegistry';

interface ProjectBriefFormProps {
  projectType: ProjectTypeConfig;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ProjectBriefForm({
  projectType,
  values,
  onChange,
}: ProjectBriefFormProps) {
  const { briefFields } = projectType;

  // If no brief fields, show a simple message
  if (briefFields.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-white mb-1">
            Project Details
          </h3>
          <p className="text-sm text-slate-400">
            No additional details needed for this project type
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
          <p className="text-slate-400">
            You can proceed to select your start mode
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-medium text-white mb-1">
          Tell us about your {projectType.label.toLowerCase()}
        </h3>
        <p className="text-sm text-slate-400">
          This helps us generate better recommendations
        </p>
      </div>

      <div className="space-y-5">
        {briefFields.map((field) => (
          <BriefField
            key={field.key}
            field={field}
            value={values[field.key]}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Individual Field Component
// ============================================================================

interface BriefFieldProps {
  field: BriefFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

function BriefField({ field, value, onChange }: BriefFieldProps) {
  const inputBaseClass = `
    w-full px-4 py-2.5 rounded-lg text-sm text-white
    bg-slate-800 border border-slate-700
    placeholder:text-slate-500
    focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
    transition-colors
  `;

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-300">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {field.helpText && (
          <div className="group relative">
            <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 w-64 p-2 rounded-lg bg-slate-700 text-xs text-slate-300 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              {field.helpText}
            </div>
          </div>
        )}
      </div>

      {/* Input based on type */}
      {field.type === 'text' && (
        <input
          type="text"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputBaseClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`${inputBaseClass} resize-none`}
        />
      )}

      {field.type === 'number' && (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={field.placeholder}
          className={inputBaseClass}
        />
      )}

      {field.type === 'date' && (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputBaseClass}
        />
      )}

      {field.type === 'select' && field.options && (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`${inputBaseClass} cursor-pointer`}
        >
          <option value="">Select an option...</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && field.options && (
        <MultiSelectField
          options={field.options}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// Multiselect Field Component
// ============================================================================

interface MultiSelectFieldProps {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (value: string[]) => void;
}

function MultiSelectField({ options, value, onChange }: MultiSelectFieldProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = value.includes(opt.value);

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleOption(opt.value)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isSelected
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300'
              }
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default ProjectBriefForm;
