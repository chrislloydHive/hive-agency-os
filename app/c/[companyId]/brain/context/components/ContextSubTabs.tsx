'use client';

// app/c/[companyId]/brain/context/components/ContextSubTabs.tsx
// Context Page Sub-navigation Tabs
//
// Provides the 3-tab internal layout for the Context page:
// - Coverage View (default): Cluster circles overview showing what's known and gaps
// - Relationship View: Dependency graph showing how fields connect
// - Form View: Structured editor for context fields

import { useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ContextViewMode = 'coverage' | 'relationships' | 'form';

interface ContextSubTabsProps {
  /** Current active view */
  activeView: ContextViewMode;
  /** Callback when view changes */
  onViewChange: (view: ContextViewMode) => void;
  /** Optional class name */
  className?: string;
}

// ============================================================================
// Tab Definitions
// ============================================================================

interface TabDef {
  id: ContextViewMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  {
    id: 'coverage',
    label: 'Coverage',
    description: 'See what Hive knows and where the gaps are.',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'relationships',
    label: 'Relationships',
    description: 'See how your strategy, channels, and audiences connect.',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    id: 'form',
    label: 'Form',
    description: 'Edit and update context details.',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

// ============================================================================
// Component
// ============================================================================

export function ContextSubTabs({
  activeView,
  onViewChange,
  className = '',
}: ContextSubTabsProps) {
  const handleTabClick = useCallback((view: ContextViewMode) => {
    onViewChange(view);
  }, [onViewChange]);

  return (
    <div className={`flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800 ${className}`}>
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-all duration-200 ease-in-out
              ${isActive
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }
            `}
            title={tab.description}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {isActive && (
              <span className="sr-only">(current)</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// View Mode Helpers
// ============================================================================

/**
 * Map URL param value to ContextViewMode
 */
export function parseViewMode(param: string | undefined | null): ContextViewMode {
  if (param === 'coverage' || param === 'relationships' || param === 'form') {
    return param;
  }
  // Legacy mappings
  if (param === 'overview') return 'coverage';
  if (param === 'graph') return 'relationships';
  return 'coverage'; // default
}

/**
 * Get URL param value for a view mode
 */
export function viewModeToParam(view: ContextViewMode): string | null {
  // coverage is default, so return null to omit from URL
  if (view === 'coverage') return null;
  return view;
}
