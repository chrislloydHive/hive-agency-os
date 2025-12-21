'use client';

// app/context-v4/[companyId]/ContextV4LayoutClient.tsx
// Client component for Context V4 layout
//
// Provides:
// - Breadcrumb: Company → Context → [Current View]
// - Company header with name
// - Sub-navigation tabs (Fact Sheet | Review | Fields)
// - Badge counts fetched from API

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, ChevronRight, Layers } from 'lucide-react';
import { ContextV4SubNav } from '@/components/context-v4/ContextV4SubNav';
import { getContextV4TabFromPath, CONTEXT_V4_TABS } from '@/lib/nav/companyNav';

interface ContextV4LayoutClientProps {
  companyId: string;
  companyName: string;
  children: React.ReactNode;
}

interface Counts {
  proposed: number;
  confirmed: number;
}

export function ContextV4LayoutClient({
  companyId,
  companyName,
  children,
}: ContextV4LayoutClientProps) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Counts | null>(null);

  // Get current view label for breadcrumb
  const activeTabId = getContextV4TabFromPath(pathname);
  const activeTab = CONTEXT_V4_TABS.find((t) => t.id === activeTabId);
  const currentViewLabel = activeTab?.name || 'Context';

  // Fetch counts for badges
  useEffect(() => {
    async function fetchCounts() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/context/v4/counts`,
          { cache: 'no-store' }
        );
        if (response.ok) {
          const data = await response.json();
          setCounts({
            proposed: data.proposed || 0,
            confirmed: data.confirmed || 0,
          });
        }
      } catch (err) {
        // Silently fail - counts are optional
        console.warn('Failed to fetch context counts:', err);
      }
    }

    fetchCounts();
  }, [companyId]);

  return (
    <>
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm mb-3">
            <Link
              href={`/c/${companyId}`}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              {companyName}
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <Link
              href={`/context-v4/${companyId}`}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Context
            </Link>
            {activeTabId !== 'facts' && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="text-slate-300">{currentViewLabel}</span>
              </>
            )}
          </nav>

          {/* Title and Sub-Nav Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon and Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Layers className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Context</h1>
                <p className="text-xs text-slate-500">
                  Facts and data that power strategy
                </p>
              </div>
            </div>

            {/* Right: Sub-Navigation */}
            <ContextV4SubNav
              companyId={companyId}
              counts={counts || undefined}
            />
          </div>
        </div>
      </div>

      {/* Page Content */}
      {children}
    </>
  );
}
