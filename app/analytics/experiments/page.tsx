// app/analytics/experiments/page.tsx
// Analytics > Experiments page - experiments in the analytics context

import Link from 'next/link';
import { ExperimentsClient } from '@/components/experiments/ExperimentsClient';

export const metadata = {
  title: 'Experiments | Analytics | Hive OS',
  description: 'Track A/B tests and growth experiments from analytics insights',
};

export default function AnalyticsExperimentsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Analytics Sub-navigation */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-6 py-3">
            <Link
              href="/analytics"
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Overview
            </Link>
            <Link
              href="/analytics/dma"
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              DMA Funnel
            </Link>
            <Link
              href="/analytics/gap"
              className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              GAP Funnel
            </Link>
            <Link
              href="/analytics/experiments"
              className="text-sm text-amber-400 font-medium border-b-2 border-amber-400 pb-3 -mb-3"
            >
              Experiments
            </Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        <ExperimentsClient
          showCompanyColumn={true}
          title="Growth Experiments"
          description="Track A/B tests and growth hypotheses from analytics insights"
        />

        {/* Quick Links */}
        <div className="mt-8 pt-8 border-t border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
            Create Experiments From
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/analytics/dma"
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-blue-500/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-200 group-hover:text-blue-300 transition-colors">
                  DMA Funnel
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Create experiments from DMA audit funnel insights and AI recommendations
              </p>
            </Link>

            <Link
              href="/analytics/gap"
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-purple-500/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-200 group-hover:text-purple-300 transition-colors">
                  GAP Analysis
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Create experiments from GAP assessment insights and conversion optimization
              </p>
            </Link>

            <Link
              href="/analytics"
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-200 group-hover:text-amber-300 transition-colors">
                  Analytics AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Create experiments from workspace-level AI insights and recommendations
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
