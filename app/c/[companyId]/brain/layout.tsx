// app/c/[companyId]/brain/layout.tsx
// Brain workspace layout with 4-tab sub-navigation
//
// Brain IA (4-tab structure):
// - Explorer: Visual map for discovery
// - Context: Field-level editor for data entry
// - Insights: AI-generated analysis
// - Labs: Diagnostic tools that refine context
//
// History is a utility button (not a tab) that links to /brain/history

import Link from 'next/link';
import { Brain, History } from 'lucide-react';
import { BrainSubNav } from '@/components/os/BrainSubNav';

interface BrainLayoutProps {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}

export default async function BrainLayout({ children, params }: BrainLayoutProps) {
  const { companyId } = await params;

  return (
    <div className="space-y-6">
      {/* Brain Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl">
            <Brain className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Brain</h1>
            <p className="text-sm text-slate-500">Company memory & intelligence</p>
          </div>
        </div>

        {/* Sub-navigation and utilities */}
        <div className="flex items-center gap-3">
          <BrainSubNav companyId={companyId} />

          {/* History utility button */}
          <Link
            href={`/c/${companyId}/brain/history`}
            className="p-2 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50 hover:border-slate-700 transition-all"
            title="Context History - Timeline of how company knowledge has evolved"
          >
            <History className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
