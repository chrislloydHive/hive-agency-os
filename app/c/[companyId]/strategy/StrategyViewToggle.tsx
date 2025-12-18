'use client';

// app/c/[companyId]/strategy/StrategyViewToggle.tsx
// View toggle for Strategy page - switches between Builder, Blueprint, and Command views
//
// Persists the last selected view in localStorage (key: hive-strategy-view)

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Edit3, FileText, Compass, Sparkles, Scale } from 'lucide-react';

const STORAGE_KEY = 'hive-strategy-view';

type StrategyView = 'builder' | 'blueprint' | 'command' | 'orchestration';

interface StrategyViewToggleProps {
  companyId: string;
  currentView: StrategyView;
}

const VIEW_CONFIG: Record<StrategyView, { icon: React.ElementType; label: string; description: string }> = {
  builder: {
    icon: Edit3,
    label: 'Builder',
    description: 'Editable workspace',
  },
  blueprint: {
    icon: FileText,
    label: 'Blueprint',
    description: 'Visual summary',
  },
  command: {
    icon: Compass,
    label: 'Command',
    description: '3-column workflow',
  },
  orchestration: {
    icon: Sparkles,
    label: 'AI Orchestration',
    description: 'Objectives → Strategy → Tactics',
  },
};

export function StrategyViewToggle({ companyId, currentView }: StrategyViewToggleProps) {
  const router = useRouter();

  // Persist view to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, currentView);
    } catch {
      // localStorage not available
    }
  }, [currentView]);

  // Check localStorage on mount and redirect if needed (only if no view param in URL)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as StrategyView | null;
      const urlParams = new URLSearchParams(window.location.search);
      const urlView = urlParams.get('view');

      // Only redirect if no view in URL and stored view differs from current
      if (!urlView && stored && stored !== currentView && isValidView(stored)) {
        router.replace(`/c/${companyId}/strategy?view=${stored}`);
      }
    } catch {
      // localStorage not available
    }
  }, [companyId, currentView, router]);

  const handleViewChange = (view: StrategyView) => {
    if (view === currentView) return;

    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // localStorage not available
    }

    router.push(`/c/${companyId}/strategy?view=${view}`);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">View:</span>
        <div className="inline-flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
          {(Object.keys(VIEW_CONFIG) as StrategyView[]).map((view) => {
            const { icon: Icon, label } = VIEW_CONFIG[view];
            const isActive = view === currentView;

            return (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors
                  ${isActive
                    ? 'text-white bg-purple-600'
                    : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
                  }
                `}
                title={VIEW_CONFIG[view].description}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compare Strategies Button */}
      <Link
        href={`/c/${companyId}/strategy/compare`}
        className="px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 bg-slate-800/50"
        title="Compare strategies side-by-side"
      >
        <Scale className="w-3 h-3" />
        Compare
      </Link>
    </div>
  );
}

function isValidView(view: string): view is StrategyView {
  return ['builder', 'blueprint', 'command', 'orchestration'].includes(view);
}
