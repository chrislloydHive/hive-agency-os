// app/c/[companyId]/diagnostics/page.tsx
// Deprecated Diagnostics Selection Page
//
// This page has been deprecated in favor of the Overview page (/c/[companyId])
// which now has intent-based diagnostic selection with confirmation drawers.
//
// Route kept for backward compatibility. Shows deprecation notice with links.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Home, LayoutGrid } from 'lucide-react';

type PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function DiagnosticsHubPage({ params }: PageProps) {
  const { companyId } = await params;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        {/* Icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>

        {/* Title */}
        <h1 className="text-xl font-semibold text-white mb-2">
          Page Deprecated
        </h1>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-6">
          The Diagnostics selection page has been replaced. You can now run diagnostics directly from the Overview page or access specific labs below.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          {/* Primary: Go to Overview */}
          <Link
            href={`/c/${companyId}`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Overview
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Secondary: Direct to Blueprint (Lab Grid) */}
          <Link
            href={`/c/${companyId}/blueprint`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
            View All Labs
          </Link>
        </div>

        {/* Help text */}
        <p className="text-xs text-slate-500 mt-6">
          Tip: Use the &quot;What do you need help with?&quot; cards on Overview to get personalized diagnostic recommendations.
        </p>
      </div>
    </div>
  );
}
