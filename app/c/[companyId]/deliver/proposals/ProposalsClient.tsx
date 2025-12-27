'use client';

// app/c/[companyId]/deliver/proposals/ProposalsClient.tsx
// Plan Proposals List Client Component
//
// Displays a filterable list of plan proposals with status indicators.
// Links to individual proposal pages for detailed review.

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  Check,
  X,
  ChevronRight,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import type { PlanProposal, PlanProposalStatus, PlanType } from '@/lib/types/plan';

// ============================================================================
// Types
// ============================================================================

interface ProposalsClientProps {
  companyId: string;
  companyName: string;
  proposals: PlanProposal[];
}

type StatusFilter = 'all' | PlanProposalStatus;

// ============================================================================
// Helper Components
// ============================================================================

function StatusBadge({ status }: { status: PlanProposalStatus }) {
  const config = {
    pending: {
      label: 'Pending',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: Clock,
    },
    applied: {
      label: 'Accepted',
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Check,
    },
    discarded: {
      label: 'Rejected',
      className: 'bg-red-500/10 text-red-400 border-red-500/30',
      icon: X,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function PlanTypeBadge({ planType }: { planType: PlanType }) {
  const config = {
    media: {
      label: 'Media Plan',
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
    content: {
      label: 'Content Plan',
      className: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    },
  };

  const { label, className } = config[planType];

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${className}`}>
      {label}
    </span>
  );
}

function ProposalCard({
  proposal,
  companyId,
}: {
  proposal: PlanProposal;
  companyId: string;
}) {
  const createdDate = new Date(proposal.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const resolvedDate = proposal.resolvedAt
    ? new Date(proposal.resolvedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <Link
      href={`/c/${companyId}/deliver/proposals/${proposal.id}`}
      className="block bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-sm font-medium text-slate-200 truncate">
              {proposal.title || `Proposal ${proposal.id.slice(-6)}`}
            </h3>
            <PlanTypeBadge planType={proposal.planType} />
            <StatusBadge status={proposal.status} />
          </div>

          {/* Rationale preview */}
          {proposal.rationale && (
            <p className="text-xs text-slate-400 line-clamp-2 mb-2">
              {proposal.rationale}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Created {createdDate}</span>
            {resolvedDate && (
              <span>
                {proposal.status === 'applied' ? 'Accepted' : 'Rejected'} {resolvedDate}
              </span>
            )}
            {proposal.warnings && proposal.warnings.length > 0 && (
              <span className="text-amber-500">
                {proposal.warnings.length} warning{proposal.warnings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
      </div>
    </Link>
  );
}

function EmptyState({ filter }: { filter: StatusFilter }) {
  const messages = {
    all: {
      title: 'No proposals yet',
      description: 'AI-generated plan proposals will appear here when your plans detect context or strategy changes.',
    },
    pending: {
      title: 'No pending proposals',
      description: 'All proposals have been reviewed. Check back when your plans detect changes.',
    },
    applied: {
      title: 'No accepted proposals',
      description: 'Proposals that you accept will appear here.',
    },
    discarded: {
      title: 'No rejected proposals',
      description: 'Proposals that you reject will appear here.',
    },
  };

  const { title, description } = messages[filter];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-lg font-medium text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md">{description}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ProposalsClient({
  companyId,
  companyName,
  proposals,
}: ProposalsClientProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter proposals
  const filteredProposals = useMemo(() => {
    if (statusFilter === 'all') {
      return proposals;
    }
    return proposals.filter((p) => p.status === statusFilter);
  }, [proposals, statusFilter]);

  // Count by status
  const counts = useMemo(() => ({
    all: proposals.length,
    pending: proposals.filter((p) => p.status === 'pending').length,
    applied: proposals.filter((p) => p.status === 'applied').length,
    discarded: proposals.filter((p) => p.status === 'discarded').length,
  }), [proposals]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/c/${companyId}/deliver`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Deliver
        </Link>
        <h1 className="text-2xl font-semibold text-slate-100 mb-2">
          Plan Proposals
        </h1>
        <p className="text-slate-400">
          Review AI-generated proposals for updating your plans based on context and strategy changes.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-1 text-slate-500 text-sm mr-2">
          <Filter className="w-4 h-4" />
          Filter:
        </div>
        {(['all', 'pending', 'applied', 'discarded'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === filter
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800/70'
            }`}
          >
            {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            <span className="ml-1 text-slate-500">({counts[filter]})</span>
          </button>
        ))}
      </div>

      {/* Proposals list */}
      {filteredProposals.length > 0 ? (
        <div className="space-y-3">
          {filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              companyId={companyId}
            />
          ))}
        </div>
      ) : (
        <EmptyState filter={statusFilter} />
      )}

      {/* Pending proposals count banner */}
      {counts.pending > 0 && statusFilter !== 'pending' && (
        <div className="fixed bottom-6 right-6 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 shadow-lg">
          <button
            onClick={() => setStatusFilter('pending')}
            className="flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200"
          >
            <Clock className="w-4 h-4" />
            {counts.pending} pending proposal{counts.pending !== 1 ? 's' : ''} awaiting review
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ProposalsClient;
