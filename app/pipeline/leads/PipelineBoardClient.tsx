'use client';

// app/pipeline/leads/PipelineBoardClient.tsx
// Pipeline Board View - Kanban-style board for leads

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InboundLeadItem, PipelineLeadStage } from '@/lib/types/pipeline';
import {
  getPipelineStageLabel,
  getPipelineStageColorClasses,
  getMaturityStageColorClasses,
  PIPELINE_LEAD_STAGES,
} from '@/lib/types/pipeline';

interface EnrichedLead extends InboundLeadItem {
  companyInfo?: { name: string; industry?: string; sizeBand?: string } | null;
}

interface PipelineBoardClientProps {
  leads: EnrichedLead[];
}

// ============================================================================
// Lead Card Component
// ============================================================================

interface LeadCardProps {
  lead: EnrichedLead;
  onStageChange: (leadId: string, stage: PipelineLeadStage) => void;
  isUpdating: boolean;
}

function LeadCard({ lead, onStageChange, isUpdating }: LeadCardProps) {
  const [showStageDropdown, setShowStageDropdown] = useState(false);

  const isDmaLead = lead.leadSource === 'DMA Full GAP';
  const companyName = lead.companyName || lead.companyInfo?.name || 'Unknown Company';
  const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '';

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors">
      {/* Header: Company + Source Badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-slate-200 truncate">{companyName}</h3>
          {domain && (
            <p className="text-xs text-slate-500 truncate">{domain}</p>
          )}
        </div>
        {isDmaLead && (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            DMA Full GAP
          </span>
        )}
      </div>

      {/* Contact Info */}
      <div className="mb-3">
        {lead.name && (
          <p className="text-xs text-slate-300">{lead.name}</p>
        )}
        {lead.email && (
          <p className="text-xs text-slate-500">{lead.email}</p>
        )}
      </div>

      {/* Score + Maturity (for DMA leads) */}
      {isDmaLead && (lead.gapOverallScore !== null || lead.gapMaturityStage) && (
        <div className="flex items-center gap-2 mb-3">
          {lead.gapOverallScore !== null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              Score {lead.gapOverallScore}
            </span>
          )}
          {lead.gapMaturityStage && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getMaturityStageColorClasses(lead.gapMaturityStage)}`}>
              {lead.gapMaturityStage}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-700/50">
        {/* Stage Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStageDropdown(!showStageDropdown)}
            disabled={isUpdating}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 transition-colors disabled:opacity-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Move
          </button>
          {showStageDropdown && (
            <div className="absolute left-0 top-full mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
              {PIPELINE_LEAD_STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => {
                    onStageChange(lead.id, stage);
                    setShowStageDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${
                    lead.pipelineStage === stage ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {getPipelineStageLabel(stage)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Open Company Workspace */}
        {lead.companyId && (
          <Link
            href={`/c/${lead.companyId}?from=pipeline&leadId=${lead.id}${lead.gapPlanRunId ? `&gapRunId=${lead.gapPlanRunId}` : ''}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
          >
            Open Workspace
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Board Column Component
// ============================================================================

interface BoardColumnProps {
  stage: PipelineLeadStage;
  leads: EnrichedLead[];
  title: string;
  onStageChange: (leadId: string, stage: PipelineLeadStage) => void;
  updatingIds: Set<string>;
}

function BoardColumn({ stage, leads, title, onStageChange, updatingIds }: BoardColumnProps) {
  const stageColors = getPipelineStageColorClasses(stage);

  return (
    <div className="flex-shrink-0 w-80">
      {/* Column Header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border-b ${stageColors.replace('bg-', 'bg-').replace('/10', '/5')} border-slate-700/50`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${stageColors}`}>
            {title}
          </span>
          <span className="text-xs text-slate-500">({leads.length})</span>
        </div>
      </div>

      {/* Cards */}
      <div className="bg-slate-900/30 border border-t-0 border-slate-800/60 rounded-b-xl p-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-2">
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-slate-600">
            No leads
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={onStageChange}
              isUpdating={updatingIds.has(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Board Component
// ============================================================================

export function PipelineBoardClient({ leads }: PipelineBoardClientProps) {
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [localLeads, setLocalLeads] = useState<EnrichedLead[]>(leads);

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<PipelineLeadStage, EnrichedLead[]> = {
      new: [],
      qualified: [],
      meeting_scheduled: [],
      proposal: [],
      won: [],
      lost: [],
    };

    for (const lead of localLeads) {
      const stage = lead.pipelineStage || 'new';
      if (grouped[stage]) {
        grouped[stage].push(lead);
      } else {
        grouped.new.push(lead);
      }
    }

    return grouped;
  }, [localLeads]);

  // Handle stage change
  const handleStageChange = async (leadId: string, newStage: PipelineLeadStage) => {
    setUpdatingIds((prev) => new Set(prev).add(leadId));

    // Optimistic update
    setLocalLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, pipelineStage: newStage } : lead
      )
    );

    try {
      const response = await fetch('/api/pipeline/update-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stage');
      }
    } catch (error) {
      console.error('Failed to update stage:', error);
      // Revert on error
      setLocalLeads(leads);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  // Column configurations
  const columns: { stage: PipelineLeadStage; title: string }[] = [
    { stage: 'new', title: 'New DMA GAP Leads' },
    { stage: 'qualified', title: 'Qualified' },
    { stage: 'meeting_scheduled', title: 'Meeting Scheduled' },
    { stage: 'proposal', title: 'Proposal' },
    { stage: 'won', title: 'Won' },
    { stage: 'lost', title: 'Lost' },
  ];

  if (leads.length === 0) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="mb-4">
            <svg
              className="w-16 h-16 mx-auto text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No Pipeline Leads</h2>
          <p className="text-slate-500 mb-6">
            Leads from DMA Full GAP audits will appear here when prospects click Contact Us.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {columns.map(({ stage, title }) => (
          <BoardColumn
            key={stage}
            stage={stage}
            title={title}
            leads={leadsByStage[stage]}
            onStageChange={handleStageChange}
            updatingIds={updatingIds}
          />
        ))}
      </div>
    </div>
  );
}
