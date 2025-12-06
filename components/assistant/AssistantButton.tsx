'use client';

// components/assistant/AssistantButton.tsx
// Floating button to open the AI Helper panel
// Derives page context from current pathname for page-aware quick actions

import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { CompanyAssistantPanel } from './CompanyAssistantPanel';
import { derivePageContextFromPath, type PageContextId } from '@/lib/assistant/types';

interface AssistantButtonProps {
  contextHealth?: {
    score: number;
    status: string;
  };
  onContextRefresh?: () => void;
  /** Override page context (otherwise derived from pathname) */
  pageContext?: PageContextId;
}

export function AssistantButton({ contextHealth, onContextRefresh, pageContext: explicitPageContext }: AssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Derive page context from pathname, or use explicit override
  const pageContext = useMemo(() => {
    if (explicitPageContext) return explicitPageContext;
    return derivePageContextFromPath(pathname || '');
  }, [explicitPageContext, pathname]);

  const healthColor =
    contextHealth?.score && contextHealth.score >= 70
      ? 'bg-emerald-500'
      : contextHealth?.score && contextHealth.score >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-30 group"
        title="Open AI Helper"
      >
        <div className="relative">
          {/* Main button */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full shadow-lg transition-all group-hover:shadow-xl group-hover:scale-105">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="text-sm font-medium text-slate-200">AI Helper</span>
          </div>

          {/* Health indicator dot */}
          {contextHealth && (
            <span className={`absolute -top-1 -right-1 w-3 h-3 ${healthColor} rounded-full border-2 border-slate-900`} />
          )}
        </div>
      </button>

      {/* Panel */}
      <CompanyAssistantPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onContextRefresh={onContextRefresh}
        pageContext={pageContext}
      />
    </>
  );
}

export default AssistantButton;
