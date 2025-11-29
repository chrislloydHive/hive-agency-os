'use client';

// components/intelligence/DailyFocusList.tsx
// List component for displaying daily focus items

import Link from 'next/link';
import type { FocusItem } from '@/lib/intelligence/types';

interface DailyFocusListProps {
  title: string;
  items: FocusItem[];
  variant?: 'actions' | 'wins' | 'risks' | 'outreach';
}

export function DailyFocusList({
  title,
  items,
  variant = 'actions',
}: DailyFocusListProps) {
  const variantStyles = {
    actions: {
      headerBg: 'bg-blue-500/10',
      headerBorder: 'border-blue-500/30',
      headerIcon: 'text-blue-400',
      itemBorder: 'border-blue-500/20',
    },
    wins: {
      headerBg: 'bg-emerald-500/10',
      headerBorder: 'border-emerald-500/30',
      headerIcon: 'text-emerald-400',
      itemBorder: 'border-emerald-500/20',
    },
    risks: {
      headerBg: 'bg-red-500/10',
      headerBorder: 'border-red-500/30',
      headerIcon: 'text-red-400',
      itemBorder: 'border-red-500/20',
    },
    outreach: {
      headerBg: 'bg-purple-500/10',
      headerBorder: 'border-purple-500/30',
      headerIcon: 'text-purple-400',
      itemBorder: 'border-purple-500/20',
    },
  };

  const styles = variantStyles[variant];

  const icons = {
    actions: (
      <svg className={`w-5 h-5 ${styles.headerIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    wins: (
      <svg className={`w-5 h-5 ${styles.headerIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    risks: (
      <svg className={`w-5 h-5 ${styles.headerIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    outreach: (
      <svg className={`w-5 h-5 ${styles.headerIcon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  };

  const priorityColors = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-slate-400',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className={`${styles.headerBg} ${styles.headerBorder} border-b px-4 py-3 flex items-center gap-2`}>
        {icons[variant]}
        <h3 className="font-semibold text-slate-100">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{items.length} items</span>
      </div>

      <div className="divide-y divide-slate-800">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No items to display
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={`px-4 py-3 hover:bg-slate-800/50 transition-colors`}>
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 ${priorityColors[item.priority]}`}>
                  {item.priority === 'high' ? '!' : item.priority === 'medium' ? '-' : '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                  {item.companyName && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded">
                      {item.companyName}
                    </span>
                  )}
                </div>
                {item.linkHref && (
                  <Link
                    href={item.linkHref}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default DailyFocusList;
