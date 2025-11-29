'use client';

// components/intelligence/SystemActionCard.tsx
// Card component for displaying next best action

import Link from 'next/link';
import type { NextBestAction } from '@/lib/intelligence/types';

interface SystemActionCardProps {
  action: NextBestAction;
}

export function SystemActionCard({ action }: SystemActionCardProps) {
  const priorityStyles = {
    critical: {
      bg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
      border: 'border-red-500/40',
      badge: 'bg-red-500 text-white',
      icon: 'text-red-400',
    },
    high: {
      bg: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/40',
      badge: 'bg-amber-500 text-slate-900',
      icon: 'text-amber-400',
    },
    medium: {
      bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10',
      border: 'border-blue-500/40',
      badge: 'bg-blue-500 text-white',
      icon: 'text-blue-400',
    },
    low: {
      bg: 'bg-gradient-to-br from-slate-500/20 to-slate-600/10',
      border: 'border-slate-500/40',
      badge: 'bg-slate-500 text-white',
      icon: 'text-slate-400',
    },
  };

  const styles = priorityStyles[action.priority];

  return (
    <div className={`${styles.bg} ${styles.border} border rounded-xl p-5`}>
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg bg-slate-800/50`}>
          <svg className={`w-6 h-6 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-400 uppercase tracking-wide">Next Best Action</span>
            <span className={`${styles.badge} text-xs font-semibold px-2 py-0.5 rounded-full uppercase`}>
              {action.priority}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">{action.title}</h3>
          <p className="text-sm text-slate-300 mb-3">{action.description}</p>

          <div className="flex items-center gap-3">
            {action.actionUrl ? (
              <Link
                href={action.actionUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium transition-colors"
              >
                Take Action
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium transition-colors">
                Get Started
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {action.companyName && (
              <span className="text-sm text-slate-400">
                Related: <span className="text-slate-300">{action.companyName}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemActionCard;
