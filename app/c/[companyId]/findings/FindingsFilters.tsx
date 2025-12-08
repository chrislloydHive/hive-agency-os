'use client';

// app/c/[companyId]/findings/FindingsFilters.tsx
// Filter controls for findings: labs, severities, categories, converted status

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

interface FilterOptions {
  labs: FilterOption[];
  severities: FilterOption[];
  categories: FilterOption[];
}

interface FindingsFiltersProps {
  filterOptions: FilterOptions | null;
  selectedLabs: string[];
  selectedSeverities: string[];
  selectedCategories: string[];
  showConverted: 'all' | 'no' | 'only';
  onLabsChange: (labs: string[]) => void;
  onSeveritiesChange: (severities: string[]) => void;
  onCategoriesChange: (categories: string[]) => void;
  onConvertedChange: (value: 'all' | 'no' | 'only') => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  loading: boolean;
}

// ============================================================================
// Multi-Select Dropdown Component
// ============================================================================

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  loading,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        disabled={loading}
        onClick={() => setOpen(!open)}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
          transition-colors
          ${selected.length > 0
            ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }
          ${loading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-cyan-500/30">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-4 h-4 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-48 origin-top-left rounded-lg bg-slate-800 border border-slate-700 shadow-lg z-20">
          <div className="p-2 space-y-1">
            {options.map(option => (
              <button
                key={option.value}
                onClick={() => toggleOption(option.value)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm
                  hover:bg-slate-700
                  ${selected.includes(option.value) ? 'text-cyan-400' : 'text-slate-300'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded border flex items-center justify-center
                    ${selected.includes(option.value)
                      ? 'border-cyan-500 bg-cyan-500'
                      : 'border-slate-600'
                    }
                  `}
                >
                  {selected.includes(option.value) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </span>
                <span className="capitalize">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Converted Status Toggle
// ============================================================================

function ConvertedToggle({
  value,
  onChange,
  loading,
}: {
  value: 'all' | 'no' | 'only';
  onChange: (value: 'all' | 'no' | 'only') => void;
  loading: boolean;
}) {
  const options: { value: 'all' | 'no' | 'only'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'no', label: 'Not converted' },
    { value: 'only', label: 'Converted' },
  ];

  return (
    <div className="flex items-center rounded-lg bg-slate-800 p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          disabled={loading}
          onClick={() => onChange(option.value)}
          className={`
            px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${value === option.value
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-300'
            }
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FindingsFilters({
  filterOptions,
  selectedLabs,
  selectedSeverities,
  selectedCategories,
  showConverted,
  onLabsChange,
  onSeveritiesChange,
  onCategoriesChange,
  onConvertedChange,
  onClearFilters,
  hasActiveFilters,
  loading,
}: FindingsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Lab Filter */}
      <MultiSelectDropdown
        label="Lab"
        options={filterOptions?.labs || []}
        selected={selectedLabs}
        onChange={onLabsChange}
        loading={loading}
      />

      {/* Severity Filter */}
      <MultiSelectDropdown
        label="Severity"
        options={filterOptions?.severities || []}
        selected={selectedSeverities}
        onChange={onSeveritiesChange}
        loading={loading}
      />

      {/* Category Filter */}
      <MultiSelectDropdown
        label="Category"
        options={filterOptions?.categories || []}
        selected={selectedCategories}
        onChange={onCategoriesChange}
        loading={loading}
      />

      {/* Divider */}
      <div className="h-6 w-px bg-slate-700" />

      {/* Converted Toggle */}
      <ConvertedToggle
        value={showConverted}
        onChange={onConvertedChange}
        loading={loading}
      />

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          disabled={loading}
          className="inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-400 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear filters
        </button>
      )}
    </div>
  );
}
