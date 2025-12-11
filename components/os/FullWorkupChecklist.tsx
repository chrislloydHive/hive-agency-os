'use client';

// components/os/FullWorkupChecklist.tsx
// Full Workup Checklist for DMA Full GAP leads
// Each checkbox persists to Airtable via API

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Circle, Loader2, FileText, BarChart3, Search, Users, ClipboardList } from 'lucide-react';

type ChecklistField =
  | 'qbrReviewed'
  | 'mediaLabReviewed'
  | 'seoLabReviewed'
  | 'competitionLabReviewed'
  | 'workPlanDrafted';

interface ChecklistItem {
  field: ChecklistField;
  label: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
}

interface FullWorkupChecklistProps {
  leadId: string;
  companyId: string;
  initialValues: {
    qbrReviewed: boolean;
    mediaLabReviewed: boolean;
    seoLabReviewed: boolean;
    competitionLabReviewed: boolean;
    workPlanDrafted: boolean;
  };
}

export function FullWorkupChecklist({ leadId, companyId, initialValues }: FullWorkupChecklistProps) {
  const [values, setValues] = useState(initialValues);
  const [loadingFields, setLoadingFields] = useState<Set<ChecklistField>>(new Set());

  const items: ChecklistItem[] = [
    {
      field: 'qbrReviewed',
      label: 'QBR Reviewed',
      description: 'Review the Quarterly Business Review for overall health',
      icon: <FileText className="w-4 h-4" />,
      href: `/c/${companyId}/reports/qbr`,
    },
    {
      field: 'mediaLabReviewed',
      label: 'Media Lab Reviewed',
      description: 'Check paid media performance and opportunities',
      icon: <BarChart3 className="w-4 h-4" />,
      href: `/c/${companyId}/diagnostics/demand-lab`,
    },
    {
      field: 'seoLabReviewed',
      label: 'SEO Lab Reviewed',
      description: 'Analyze organic search visibility and technical SEO',
      icon: <Search className="w-4 h-4" />,
      href: `/c/${companyId}/diagnostics/seo-lab`,
    },
    {
      field: 'competitionLabReviewed',
      label: 'Competition Lab Reviewed',
      description: 'Review competitive landscape and positioning',
      icon: <Users className="w-4 h-4" />,
      href: `/c/${companyId}/diagnostics/brand-lab`,
    },
    {
      field: 'workPlanDrafted',
      label: 'Work Plan Drafted',
      description: 'Create actionable work items from findings',
      icon: <ClipboardList className="w-4 h-4" />,
      href: `/c/${companyId}/findings`,
    },
  ];

  const handleToggle = async (field: ChecklistField) => {
    const newValue = !values[field];

    // Optimistic update
    setValues((prev) => ({ ...prev, [field]: newValue }));
    setLoadingFields((prev) => new Set(prev).add(field));

    try {
      const response = await fetch('/api/pipeline/update-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, field, value: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update checklist');
      }
    } catch (error) {
      console.error('Failed to update checklist:', error);
      // Revert on error
      setValues((prev) => ({ ...prev, [field]: !newValue }));
    } finally {
      setLoadingFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  const completedCount = Object.values(values).filter(Boolean).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white">Full Workup Checklist</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete these steps before reaching out to the prospect
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const isChecked = values[item.field];
          const isLoading = loadingFields.has(item.field);

          return (
            <div
              key={item.field}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isChecked
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600/40'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(item.field)}
                disabled={isLoading}
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                  isChecked
                    ? 'text-emerald-400'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isChecked ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  isChecked
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {item.icon}
              </div>

              {/* Label & Description */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isChecked ? 'text-emerald-300 line-through' : 'text-slate-200'
                  }`}
                >
                  {item.label}
                </p>
                <p className="text-xs text-slate-500 truncate">{item.description}</p>
              </div>

              {/* Link to tool/page */}
              {item.href && (
                <Link
                  href={item.href}
                  className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isChecked
                      ? 'text-emerald-400/70 hover:text-emerald-400'
                      : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                  }`}
                >
                  {isChecked ? 'View' : 'Go'}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {/* All Complete Message */}
      {completedCount === totalCount && (
        <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-sm text-emerald-300 font-medium">
            Full Workup Complete!
          </p>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            Ready to reach out to the prospect with a comprehensive plan.
          </p>
        </div>
      )}
    </div>
  );
}
