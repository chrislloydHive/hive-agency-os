'use client';

// components/os/overview/InlineLabsSelector.tsx
// Inline Labs Selector - Lab selection before starting context gathering
//
// Shows:
// - Required labs (locked, cannot deselect)
// - Suggested labs (pre-selected based on engagement type)
// - Optional labs (user can add)

import { useState } from 'react';
import {
  Globe,
  Zap,
  Users,
  Award,
  Search,
  FileText,
  Palette,
  BarChart3,
  Sparkles,
  Settings,
  Swords,
  Lock,
  Check,
  Info,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { LabId } from '@/lib/contextGraph/labContext';
import type { EngagementType, ProjectType } from '@/lib/types/engagement';
import {
  REQUIRED_LABS_BY_TYPE,
  SUGGESTED_LABS_BY_TYPE,
  ALL_AVAILABLE_LABS,
  PROJECT_TYPE_CONFIG,
} from '@/lib/types/engagement';

// ============================================================================
// Types
// ============================================================================

export interface InlineLabsSelectorProps {
  engagementType: EngagementType;
  projectType?: ProjectType;
  selectedLabs: LabId[];
  onSelectedLabsChange: (labs: LabId[]) => void;
  onBack?: () => void;
  onConfirm: () => void;
  confirming?: boolean;
  disabled?: boolean;
}

interface LabDisplayInfo {
  id: LabId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

// ============================================================================
// Lab Display Configuration
// ============================================================================

const LAB_INFO: Record<LabId, { label: string; description: string; icon: React.ReactNode }> = {
  brand: {
    label: 'Brand',
    description: 'Positioning, voice, and brand platform',
    icon: <Award className="w-4 h-4" />,
  },
  audience: {
    label: 'Audience',
    description: 'ICP, segments, and personas',
    icon: <Users className="w-4 h-4" />,
  },
  website: {
    label: 'Website',
    description: 'Site audit and conversion analysis',
    icon: <Globe className="w-4 h-4" />,
  },
  seo: {
    label: 'SEO',
    description: 'Search visibility and rankings',
    icon: <Search className="w-4 h-4" />,
  },
  content: {
    label: 'Content',
    description: 'Content strategy and performance',
    icon: <FileText className="w-4 h-4" />,
  },
  media: {
    label: 'Media',
    description: 'Paid channel performance',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  demand: {
    label: 'Demand',
    description: 'Lead generation and funnel',
    icon: <Zap className="w-4 h-4" />,
  },
  creative: {
    label: 'Creative',
    description: 'Creative assets and messaging',
    icon: <Sparkles className="w-4 h-4" />,
  },
  ux: {
    label: 'UX',
    description: 'User experience and flows',
    icon: <Palette className="w-4 h-4" />,
  },
  ops: {
    label: 'Operations',
    description: 'Marketing operations and processes',
    icon: <Settings className="w-4 h-4" />,
  },
  competitor: {
    label: 'Competitor',
    description: 'Competitive landscape analysis',
    icon: <Swords className="w-4 h-4" />,
  },
};

// ============================================================================
// Component
// ============================================================================

export function InlineLabsSelector({
  engagementType,
  projectType,
  selectedLabs,
  onSelectedLabsChange,
  onBack,
  onConfirm,
  confirming = false,
  disabled = false,
}: InlineLabsSelectorProps) {
  const [showAllLabs, setShowAllLabs] = useState(false);

  // Get required and suggested labs
  const requiredLabs = REQUIRED_LABS_BY_TYPE[engagementType];
  const suggestedLabs = engagementType === 'project' && projectType
    ? PROJECT_TYPE_CONFIG[projectType].suggestedLabs
    : SUGGESTED_LABS_BY_TYPE[engagementType];

  // Calculate which labs are optional (selected but not required)
  const optionalLabs = selectedLabs.filter(lab => !requiredLabs.includes(lab));

  // Get remaining available labs (not selected)
  const availableLabs = ALL_AVAILABLE_LABS.filter(lab => !selectedLabs.includes(lab));

  const handleToggleLab = (labId: LabId) => {
    if (requiredLabs.includes(labId)) return; // Cannot toggle required

    if (selectedLabs.includes(labId)) {
      onSelectedLabsChange(selectedLabs.filter(l => l !== labId));
    } else {
      onSelectedLabsChange([...selectedLabs, labId]);
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-4">
        {onBack && (
          <button
            onClick={onBack}
            disabled={disabled || confirming}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-lg font-semibold text-white">
            Configure Context Gathering
          </h2>
          <p className="text-sm text-slate-400">
            Select which labs to include in your context gathering process.
          </p>
        </div>
      </div>

      {/* Full GAP info banner */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-300">Full GAP Required</p>
            <p className="text-xs text-slate-400 mt-1">
              All engagements run through Full GAP to gather comprehensive context.
              Core brand and audience analysis is always included.
            </p>
          </div>
        </div>
      </div>

      {/* Required Labs */}
      {requiredLabs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500" />
            Required Labs
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {requiredLabs.map((labId) => {
              const info = LAB_INFO[labId];
              return (
                <div
                  key={labId}
                  className="p-3 rounded-lg border border-slate-700 bg-slate-800/30 opacity-75"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                      {info.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-300">{info.label}</p>
                      <p className="text-xs text-slate-500">Required</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Labs (Suggested + User Selected) */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Selected Labs
          <span className="ml-2 text-xs font-normal text-slate-500">
            ({optionalLabs.length} selected)
          </span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {optionalLabs.map((labId) => {
            const info = LAB_INFO[labId];
            const isSuggested = suggestedLabs.includes(labId);
            return (
              <button
                key={labId}
                onClick={() => handleToggleLab(labId)}
                disabled={disabled || confirming}
                className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-left group disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                    {info.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-300">{info.label}</p>
                    {isSuggested ? (
                      <p className="text-xs text-slate-500">Suggested</p>
                    ) : (
                      <p className="text-xs text-slate-500">Added</p>
                    )}
                  </div>
                  <Check className="w-4 h-4 text-blue-400" />
                </div>
              </button>
            );
          })}
          {optionalLabs.length === 0 && (
            <p className="text-sm text-slate-500 col-span-full py-4 text-center">
              No optional labs selected. Add labs below to gather more context.
            </p>
          )}
        </div>
      </div>

      {/* Add More Labs */}
      {availableLabs.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowAllLabs(!showAllLabs)}
            disabled={disabled || confirming}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {showAllLabs ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            Add More Labs ({availableLabs.length} available)
          </button>

          {showAllLabs && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {availableLabs.map((labId) => {
                const info = LAB_INFO[labId];
                return (
                  <button
                    key={labId}
                    onClick={() => handleToggleLab(labId)}
                    disabled={disabled || confirming}
                    className="p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-400">
                        {info.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-300">{info.label}</p>
                        <p className="text-xs text-slate-500 truncate">{info.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary and CTA */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">
              <span className="font-medium text-white">
                {requiredLabs.length + optionalLabs.length}
              </span>
              {' '}labs selected
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Full context gathering typically takes 2-3 minutes
            </p>
          </div>

          <button
            onClick={onConfirm}
            disabled={disabled || confirming}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {confirming ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                Start Context Gathering
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InlineLabsSelector;
