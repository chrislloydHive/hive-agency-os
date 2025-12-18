'use client';

// components/os/overview/ProjectTypeSelector.tsx
// Project Type Selector - Sub-selection for project engagements
//
// Options: Website, Campaign, Content, Other
// Each has different suggested labs.

import { useState } from 'react';
import { Globe, Megaphone, FileText, Layers, Newspaper, Check, ChevronLeft } from 'lucide-react';
import type { ProjectType } from '@/lib/types/engagement';
import { PROJECT_TYPE_CONFIG } from '@/lib/types/engagement';

// ============================================================================
// Types
// ============================================================================

export interface ProjectTypeSelectorProps {
  selectedType: ProjectType | null;
  onSelectType: (type: ProjectType) => void;
  onBack?: () => void;
  projectName?: string;
  onProjectNameChange?: (name: string) => void;
  disabled?: boolean;
}

// ============================================================================
// Icon mapping
// ============================================================================

const ICONS: Record<ProjectType, React.ReactNode> = {
  print_ad: <Newspaper className="w-5 h-5" />,
  website: <Globe className="w-5 h-5" />,
  campaign: <Megaphone className="w-5 h-5" />,
  content: <FileText className="w-5 h-5" />,
  other: <Layers className="w-5 h-5" />,
};

// ============================================================================
// Component
// ============================================================================

export function ProjectTypeSelector({
  selectedType,
  onSelectType,
  onBack,
  projectName,
  onProjectNameChange,
  disabled = false,
}: ProjectTypeSelectorProps) {
  const types: ProjectType[] = ['print_ad', 'website', 'campaign', 'content', 'other'];
  const [showNameInput, setShowNameInput] = useState(selectedType === 'other');

  const handleSelectType = (type: ProjectType) => {
    onSelectType(type);
    if (type === 'other') {
      setShowNameInput(true);
    } else {
      setShowNameInput(false);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            disabled={disabled}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-lg font-semibold text-white">
            What type of project?
          </h2>
          <p className="text-sm text-slate-400">
            This helps us suggest the right labs and context to gather.
          </p>
        </div>
      </div>

      {/* Project Type Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {types.map((type) => {
          const config = PROJECT_TYPE_CONFIG[type];
          const isSelected = selectedType === type;

          return (
            <button
              key={type}
              onClick={() => handleSelectType(type)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl border text-left transition-all
                ${isSelected
                  ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 text-blue-400">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center mb-3
                ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'}
              `}>
                {ICONS[type]}
              </div>

              {/* Label */}
              <p className={`
                text-sm font-medium mb-1
                ${isSelected ? 'text-blue-300' : 'text-white'}
              `}>
                {config.label}
              </p>

              {/* Description */}
              <p className="text-xs text-slate-400 line-clamp-2">
                {config.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Project Name Input (for "other" type) */}
      {(showNameInput || projectName) && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Project Name
          </label>
          <input
            type="text"
            value={projectName || ''}
            onChange={(e) => onProjectNameChange?.(e.target.value)}
            placeholder="e.g., Q1 Brand Refresh, Partner Portal, etc."
            disabled={disabled}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-2">
            Give your project a descriptive name for easy reference.
          </p>
        </div>
      )}

      {/* Suggested labs preview */}
      {selectedType && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 mb-2">Suggested labs for this project:</p>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPE_CONFIG[selectedType].suggestedLabs.length > 0 ? (
              PROJECT_TYPE_CONFIG[selectedType].suggestedLabs.map((lab) => (
                <span
                  key={lab}
                  className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400"
                >
                  {lab}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500 italic">
                You'll select labs in the next step
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectTypeSelector;
