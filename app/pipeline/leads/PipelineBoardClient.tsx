'use client';

// app/pipeline/leads/PipelineBoardClient.tsx
// Pipeline Board View - Kanban-style board for leads with drag and drop

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { InboundLeadItem, PipelineLeadStage } from '@/lib/types/pipeline';
import {
  getPipelineStageLabel,
  getPipelineStageColorClasses,
  getMaturityStageColorClasses,
  PIPELINE_LEAD_STAGES,
} from '@/lib/types/pipeline';
import { ConfirmDialog } from '@/components/pipeline/ConfirmDialog';

interface EnrichedLead extends InboundLeadItem {
  companyInfo?: { name: string; industry?: string; sizeBand?: string } | null;
}

interface PipelineBoardClientProps {
  leads: EnrichedLead[];
}

// ============================================================================
// Lead Card Component (Draggable)
// ============================================================================

interface LeadCardProps {
  lead: EnrichedLead;
  onStageChange: (leadId: string, stage: PipelineLeadStage) => void;
  isUpdating: boolean;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function LeadCard({ lead, onStageChange, isUpdating, onDragStart, onDragEnd, isDragging }: LeadCardProps) {
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const handleConvertToOpportunity = async () => {
    if (!lead.companyId) {
      setConvertError('Lead must be linked to a company first');
      return;
    }

    setIsConverting(true);
    setConvertError(null);

    try {
      const response = await fetch('/api/pipeline/convert-lead-to-opportunity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to convert');
      }

      // Redirect to the new opportunity
      window.location.href = `/pipeline/opportunities/${data.opportunityId}`;
    } catch (error: any) {
      setConvertError(error?.message || 'Failed to convert lead');
      setIsConverting(false);
    }
  };

  const isDmaLead = lead.leadSource === 'DMA Full GAP';
  const companyName = lead.companyName || lead.companyInfo?.name || 'Unknown Company';
  const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '';

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
        onDragStart(lead.id);
      }}
      onDragEnd={onDragEnd}
      className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isUpdating ? 'opacity-70' : ''}`}
    >
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

      {/* Convert Error */}
      {convertError && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
          {convertError}
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

        {/* For NEW leads: Convert is primary CTA */}
        {lead.companyId && (!lead.pipelineStage || lead.pipelineStage === 'new') && (
          <>
            {/* Convert to Opportunity - PRIMARY */}
            <button
              onClick={handleConvertToOpportunity}
              disabled={isConverting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors disabled:opacity-50"
            >
              {isConverting ? (
                'Converting...'
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Convert to Opportunity
                </>
              )}
            </button>
            {/* Review Context - Secondary */}
            <Link
              href={`/c/${lead.companyId}?from=pipeline&leadId=${lead.id}${lead.gapPlanRunId ? `&gapRunId=${lead.gapPlanRunId}` : ''}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Review Context
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}

        {/* For OTHER stages: Workspace is primary, Convert is secondary */}
        {lead.companyId && lead.pipelineStage && lead.pipelineStage !== 'new' && (
          <>
            {/* Convert to Opportunity - Secondary */}
            <button
              onClick={handleConvertToOpportunity}
              disabled={isConverting}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              {isConverting ? (
                'Converting...'
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Convert
                </>
              )}
            </button>
            {/* Open Company Workspace - PRIMARY */}
            <Link
              href={`/c/${lead.companyId}?from=pipeline&leadId=${lead.id}${lead.gapPlanRunId ? `&gapRunId=${lead.gapPlanRunId}` : ''}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Open Workspace
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Board Column Component (Drop Target)
// ============================================================================

interface BoardColumnProps {
  stage: PipelineLeadStage;
  leads: EnrichedLead[];
  title: string;
  onStageChange: (leadId: string, stage: PipelineLeadStage) => void;
  updatingIds: Set<string>;
  draggingId: string | null;
  onDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onDrop: (stage: PipelineLeadStage) => void;
}

function BoardColumn({
  stage,
  leads,
  title,
  onStageChange,
  updatingIds,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop
}: BoardColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const stageColors = getPipelineStageColorClasses(stage);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(stage);
  };

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

      {/* Cards - Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`bg-slate-900/30 border border-t-0 border-slate-800/60 rounded-b-xl p-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto space-y-2 transition-colors ${
          isDragOver ? 'bg-amber-500/10 border-amber-500/30' : ''
        }`}
      >
        {leads.length === 0 ? (
          <div className={`flex items-center justify-center h-32 text-xs ${isDragOver ? 'text-amber-400' : 'text-slate-600'}`}>
            {isDragOver ? 'Drop here' : 'No leads'}
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onStageChange={onStageChange}
              isUpdating={updatingIds.has(lead.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggingId === lead.id}
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
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    leadId: string;
    stage: PipelineLeadStage;
  } | null>(null);

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

  // Handle stage change (with confirmation for won/lost)
  const requestStageChange = (leadId: string, newStage: PipelineLeadStage) => {
    // Don't update if already in this stage
    const lead = localLeads.find(l => l.id === leadId);
    if (lead?.pipelineStage === newStage || (!lead?.pipelineStage && newStage === 'new')) {
      return;
    }

    // Require confirmation for won/lost
    if (newStage === 'won' || newStage === 'lost') {
      setConfirmDialog({ isOpen: true, leadId, stage: newStage });
      return;
    }

    // Otherwise, proceed directly
    executeStageChange(leadId, newStage);
  };

  const executeStageChange = async (leadId: string, newStage: PipelineLeadStage) => {
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
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update stage');
      }
    } catch (error: any) {
      console.error('Failed to update stage:', error?.message || error);
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

  const handleConfirmStageChange = () => {
    if (confirmDialog) {
      executeStageChange(confirmDialog.leadId, confirmDialog.stage);
      setConfirmDialog(null);
    }
  };

  // Handle drop
  const handleDrop = (targetStage: PipelineLeadStage) => {
    if (draggingId) {
      requestStageChange(draggingId, targetStage);
      setDraggingId(null);
    }
  };

  // Column configurations
  const columns: { stage: PipelineLeadStage; title: string }[] = [
    { stage: 'new', title: 'New Leads' },
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
          <h2 className="text-xl font-semibold text-slate-300 mb-2">No leads yet</h2>
          <p className="text-slate-500 mb-6">
            When prospects submit their email on a Full GAP report, they'll appear here.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Get confirm dialog config based on stage
  const getConfirmDialogConfig = () => {
    if (!confirmDialog) return null;
    const lead = localLeads.find(l => l.id === confirmDialog.leadId);
    const companyName = lead?.companyName || lead?.companyInfo?.name || 'this lead';

    if (confirmDialog.stage === 'won') {
      return {
        title: 'Mark as Won',
        message: `Mark ${companyName} as Won? This moves them to the Won column.`,
        confirmLabel: 'Yes, mark as Won',
        variant: 'success' as const,
      };
    }
    return {
      title: 'Mark as Lost',
      message: `Mark ${companyName} as Lost? This won't delete them—just moves to Lost.`,
      confirmLabel: 'Yes, mark as Lost',
      variant: 'danger' as const,
    };
  };

  const dialogConfig = getConfirmDialogConfig();

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {columns.map(({ stage, title }) => (
            <BoardColumn
              key={stage}
              stage={stage}
              title={title}
              leads={leadsByStage[stage]}
              onStageChange={requestStageChange}
              updatingIds={updatingIds}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      {/* Confirm Dialog for Won/Lost */}
      {confirmDialog && dialogConfig && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={handleConfirmStageChange}
          title={dialogConfig.title}
          message={dialogConfig.message}
          confirmLabel={dialogConfig.confirmLabel}
          variant={dialogConfig.variant}
          isLoading={updatingIds.has(confirmDialog.leadId)}
        />
      )}
    </>
  );
}
