'use client';

// components/intelligence/PriorityCompanyList.tsx
// Component for displaying priority companies requiring attention

import Link from 'next/link';
import type { PriorityCompanyItem } from '@/lib/intelligence/types';

interface PriorityCompanyListProps {
  companies: PriorityCompanyItem[];
  title?: string;
}

export function PriorityCompanyList({
  companies,
  title = 'High Priority Queue',
}: PriorityCompanyListProps) {
  const severityStyles = {
    critical: 'bg-red-500/20 border-red-500/40 text-red-300',
    high: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
    medium: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
    low: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
        <span className="text-xs text-slate-400">{companies.length} companies</span>
      </div>

      <div className="divide-y divide-slate-800">
        {companies.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-slate-500">No high-priority companies</p>
            <p className="text-xs text-slate-600 mt-1">All companies are on track</p>
          </div>
        ) : (
          companies.map((company) => (
            <div key={company.companyId} className="px-4 py-3 hover:bg-slate-800/50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/c/${company.companyId}`}
                      className="font-medium text-slate-200 hover:text-slate-100 transition-colors"
                    >
                      {company.companyName}
                    </Link>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${severityStyles[company.severity]}`}
                    >
                      {company.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">{company.reason}</p>
                  {company.issues.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {company.issues.slice(0, 3).map((issue, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded"
                        >
                          {issue}
                        </span>
                      ))}
                      {company.issues.length > 3 && (
                        <span className="text-xs text-slate-500">
                          +{company.issues.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {company.lastActivity && (
                    <span className="text-xs text-slate-500">{company.lastActivity}</span>
                  )}
                  <Link
                    href={`/c/${company.companyId}`}
                    className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {companies.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
          <Link
            href="/companies?filter=at-risk"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            Review all high-priority companies
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

export default PriorityCompanyList;
