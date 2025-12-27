'use client';

// app/c/[companyId]/deliver/sales-proposals/page.tsx
// Sales Proposals List Page - Client-facing proposals (converted from RFPs or created fresh)

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Plus,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { Proposal } from '@/lib/types/proposal';

export default function SalesProposalsListPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: '' });

  const fetchProposals = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/proposals`);
      if (response.ok) {
        const data = await response.json();
        setProposals(data.proposals || []);
      }
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleCreate = useCallback(async () => {
    if (!newProposal.title.trim()) return;
    setCreating(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newProposal.title }),
      });
      if (response.ok) {
        const data = await response.json();
        router.push(`/c/${companyId}/deliver/sales-proposals/${data.proposal.id}`);
      }
    } catch (err) {
      console.error('Failed to create proposal:', err);
    } finally {
      setCreating(false);
    }
  }, [companyId, newProposal, router]);

  const getStatusIcon = (status: Proposal['status']) => {
    switch (status) {
      case 'draft':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: Proposal['status']) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'approved':
        return 'Approved';
      default:
        return status;
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/c/${companyId}/deliver`}
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-300 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Deliver
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Sales Proposals</h1>
              <p className="text-sm text-slate-400">Create and manage client proposals</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Proposal
          </button>
        </div>
      </div>

      {/* Tip: Convert from RFP */}
      <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="flex items-start gap-3">
          <ArrowRight className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-white">Convert from RFP</h3>
            <p className="text-xs text-slate-400 mt-1">
              Already created an RFP response? Convert it to a proposal to reuse your content.
              Go to any RFP and click "Convert to Proposal".
            </p>
            <Link
              href={`/c/${companyId}/deliver/rfp`}
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
            >
              View RFPs
              <ChevronLeft className="w-3 h-3 rotate-180" />
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No Proposals Yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create a new proposal from scratch or convert an existing RFP response.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Proposal
            </button>
            <Link
              href={`/c/${companyId}/deliver/rfp`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              Convert RFP
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/c/${companyId}/deliver/sales-proposals/${proposal.id}`}
              className="block bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getStatusIcon(proposal.status)}</div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{proposal.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {getStatusLabel(proposal.status)}
                      {proposal.sourceRfpId && (
                        <span className="ml-2 text-blue-400">Converted from RFP</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {proposal.updatedAt && new Date(proposal.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Proposal</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal({ title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Proposal for..."
                  autoFocus
                />
              </div>

              <p className="text-xs text-slate-500">
                Create a blank proposal to build from scratch. To reuse RFP content,
                convert an existing RFP instead.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newProposal.title.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-medium rounded-lg transition-colors"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
