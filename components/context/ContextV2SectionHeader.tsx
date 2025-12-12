// REUSE REQUIRED
// - Must reuse existing Context Workspace section components if present
// - Must map to Context Graph domains (no parallel context model)
// - Must render existing Proposal type (no new diff format)

// components/context/ContextV2SectionHeader.tsx
// Context V2 Section Headers
//
// Displays section titles with optional completeness indicator.
// Used for the 4 V2 sections: Company Reality, Market Reality, Constraints, Strategic Intent

'use client';

interface ContextV2SectionHeaderProps {
  title: string;
  description?: string;
  completeness?: number; // 0-100
  className?: string;
}

const SECTION_INFO: Record<string, { icon: string; color: string }> = {
  'Company Reality': { icon: 'building-2', color: 'text-blue-600' },
  'Market Reality': { icon: 'target', color: 'text-emerald-600' },
  'Constraints & Assumptions': { icon: 'shield-alert', color: 'text-amber-600' },
  'Strategic Intent': { icon: 'compass', color: 'text-purple-600' },
};

export function ContextV2SectionHeader({
  title,
  description,
  completeness,
  className = '',
}: ContextV2SectionHeaderProps) {
  const info = SECTION_INFO[title] || { icon: 'file', color: 'text-slate-600' };

  return (
    <div className={`border-b border-slate-200 pb-3 mb-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`text-lg font-semibold ${info.color}`}>
            {title}
          </h3>
        </div>
        {completeness !== undefined && (
          <CompletenessIndicator value={completeness} />
        )}
      </div>
      {description && (
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      )}
    </div>
  );
}

// Small completeness indicator
function CompletenessIndicator({ value }: { value: number }) {
  const getColor = (v: number) => {
    if (v >= 80) return 'text-emerald-600';
    if (v >= 50) return 'text-amber-600';
    return 'text-slate-400';
  };

  return (
    <div className={`text-sm font-medium ${getColor(value)}`}>
      {value}% complete
    </div>
  );
}

// Section descriptions for UI display
export const SECTION_DESCRIPTIONS: Record<string, string> = {
  'Company Reality': 'Fundamental business facts and positioning',
  'Market Reality': 'Target audience and competitive landscape',
  'Constraints & Assumptions': 'Budget, regulatory, and capability boundaries',
  'Strategic Intent': 'Goals, non-goals, and success definition',
};
