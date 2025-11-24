'use client';

import { useState } from 'react';
import type { CompanyRecord } from '@/lib/airtable/companies';
import { CompanyMetaEditDialog } from './CompanyMetaEditDialog';

interface CompanyMetaPanelProps {
  company: CompanyRecord;
}

export function CompanyMetaPanel({ company }: CompanyMetaPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Helper functions for styling
  const getStagePill = (stage?: string) => {
    if (!stage) return null;

    const stageStyles: Record<string, string> = {
      Prospect: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      Client: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      Internal: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      Dormant: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      Lost: 'bg-red-500/10 text-red-400 border-red-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium border ${
          stageStyles[stage] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        {stage}
      </span>
    );
  };

  const getTierPill = (tier?: string) => {
    if (!tier) return null;

    const tierStyles: Record<string, string> = {
      A: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      B: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      C: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium border ${
          tierStyles[tier] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        Tier {tier}
      </span>
    );
  };

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-100">Company Meta</h2>
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Edit →
          </button>
        </div>

        <div className="space-y-4">
          {/* Stage */}
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Stage
            </div>
            {company.stage ? (
              getStagePill(company.stage)
            ) : (
              <span className="text-sm text-slate-500">Not set</span>
            )}
          </div>

          {/* Tier */}
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Tier
            </div>
            {company.tier ? (
              getTierPill(company.tier)
            ) : (
              <span className="text-sm text-slate-500">Not set</span>
            )}
          </div>

          {/* Lifecycle Status */}
          {company.lifecycleStatus && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Lifecycle Status
              </div>
              <span className="text-sm text-slate-200">{company.lifecycleStatus}</span>
            </div>
          )}

          {/* Owner */}
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
              Owner
            </div>
            {company.owner ? (
              <span className="text-sm text-slate-200">{company.owner}</span>
            ) : (
              <span className="text-sm text-slate-500">Not assigned</span>
            )}
          </div>

          {/* Tags */}
          {company.tags && company.tags.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {company.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Internal Notes */}
          {company.internalNotes && (
            <div>
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                Internal Notes
              </div>
              <div className="text-sm text-slate-300 bg-slate-950/50 border border-slate-800 rounded p-3 whitespace-pre-wrap">
                {company.internalNotes}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      {isEditing && (
        <CompanyMetaEditDialog
          company={company}
          onClose={() => setIsEditing(false)}
        />
      )}
    </>
  );
}
