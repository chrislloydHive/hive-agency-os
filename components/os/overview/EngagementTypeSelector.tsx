'use client';

// components/os/overview/EngagementTypeSelector.tsx
// Engagement Type Selector - Two-Path Entry Point
//
// "How can we help you today?"
//
// Two options:
// - Grow the Business (Strategy-led): Full strategic transformation
// - Deliver a Project (Project-led): Scoped delivery focus
//
// Both paths require Full GAP. After context approval, they diverge.

import { TrendingUp, Briefcase, ArrowRight, Check } from 'lucide-react';
import type { EngagementType } from '@/lib/types/engagement';
import { ENGAGEMENT_TYPE_CONFIG } from '@/lib/types/engagement';

// ============================================================================
// Types
// ============================================================================

export interface EngagementTypeSelectorProps {
  selectedType: EngagementType | null;
  onSelectType: (type: EngagementType) => void;
  disabled?: boolean;
}

// ============================================================================
// Icon mapping
// ============================================================================

const ICONS: Record<EngagementType, React.ReactNode> = {
  strategy: <TrendingUp className="w-6 h-6" />,
  project: <Briefcase className="w-6 h-6" />,
};

// ============================================================================
// Component
// ============================================================================

export function EngagementTypeSelector({
  selectedType,
  onSelectType,
  disabled = false,
}: EngagementTypeSelectorProps) {
  const types: EngagementType[] = ['strategy', 'project'];

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-2">
        How can we help you today?
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Choose your path to get started. Both paths begin with gathering context about your business.
      </p>

      {/* Two-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {types.map((type) => {
          const config = ENGAGEMENT_TYPE_CONFIG[type];
          const isSelected = selectedType === type;
          const colorClasses = getColorClasses(config.color, isSelected);

          return (
            <button
              key={type}
              onClick={() => onSelectType(type)}
              disabled={disabled}
              className={`
                relative p-6 rounded-xl border-2 text-left transition-all
                ${isSelected
                  ? `${colorClasses.bgSelected} ${colorClasses.borderSelected} ring-2 ${colorClasses.ring}`
                  : `bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-600`
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-4 right-4 ${colorClasses.textSelected}`}>
                  <Check className="w-5 h-5" />
                </div>
              )}

              {/* Icon */}
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-4
                ${isSelected ? colorClasses.iconBgSelected : 'bg-slate-700/50'}
                ${isSelected ? colorClasses.textSelected : 'text-slate-400'}
              `}>
                {ICONS[type]}
              </div>

              {/* Badge */}
              <span className={`
                inline-block px-2 py-0.5 text-xs font-medium rounded mb-2
                ${isSelected ? colorClasses.badge : 'bg-slate-700 text-slate-400'}
              `}>
                {config.badge}
              </span>

              {/* Label */}
              <h3 className={`
                text-lg font-semibold mb-2
                ${isSelected ? colorClasses.textSelected : 'text-white'}
              `}>
                {config.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-400 mb-4">
                {config.description}
              </p>

              {/* Detailed description */}
              <p className="text-xs text-slate-500">
                {config.detailedDescription}
              </p>

              {/* CTA hint */}
              {isSelected && (
                <div className={`
                  mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2
                  ${colorClasses.textSelected} text-sm font-medium
                `}>
                  Continue with {type === 'strategy' ? 'Strategy' : 'Project'}
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Helper text */}
      <p className="text-xs text-slate-500 text-center mt-4">
        Not sure? Choose "Grow the Business" for comprehensive planning, or "Deliver a Project" for focused execution.
      </p>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ColorClasses {
  bgSelected: string;
  borderSelected: string;
  ring: string;
  textSelected: string;
  iconBgSelected: string;
  badge: string;
}

function getColorClasses(color: string, isSelected: boolean): ColorClasses {
  const colorMap: Record<string, ColorClasses> = {
    purple: {
      bgSelected: 'bg-purple-500/10',
      borderSelected: 'border-purple-500/50',
      ring: 'ring-purple-500/30',
      textSelected: 'text-purple-400',
      iconBgSelected: 'bg-purple-500/20',
      badge: 'bg-purple-500/20 text-purple-400',
    },
    blue: {
      bgSelected: 'bg-blue-500/10',
      borderSelected: 'border-blue-500/50',
      ring: 'ring-blue-500/30',
      textSelected: 'text-blue-400',
      iconBgSelected: 'bg-blue-500/20',
      badge: 'bg-blue-500/20 text-blue-400',
    },
  };

  return colorMap[color] ?? colorMap.purple;
}

export default EngagementTypeSelector;
