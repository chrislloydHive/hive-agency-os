'use client';

// app/c/[companyId]/deliver/rfp/page.tsx
// RFP List Page

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Plus,
  ChevronLeft,
  Loader2,
  Calendar,
  Clock,
  AlertCircle,
  Trophy,
  XCircle,
  CheckCircle2,
  Gauge,
} from 'lucide-react';
import type { Rfp } from '@/lib/types/rfp';
import type { FirmBrainSnapshot } from '@/lib/types/firmBrain';
import type { FirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import { calculateFirmBrainReadiness } from '@/lib/os/ai/firmBrainReadiness';
import { FirmBrainReadinessBanner } from '@/components/os/rfp/FirmBrainReadinessBanner';
import { computeStrategyHealth } from '@/lib/types/rfpWinStrategy';
import type { BidRecommendation } from '@/lib/os/rfp/computeBidReadiness';

/**
 * Quick readiness estimate for RFP list (lightweight computation)
 * Returns a simplified score and recommendation based on available data
 */
function getQuickReadinessEstimate(rfp: Rfp): {
  score: number;
  recommendation: BidRecommendation;
  tooltip: string;
} | null {
  // Don't show for completed RFPs
  if (rfp.status === 'won' || rfp.status === 'lost' || rfp.status === 'submitted') {
    return null;
  }

  // Base score from status
  let score = rfp.status === 'review' ? 60 : rfp.status === 'assembling' ? 40 : 20;

  // Boost for having win strategy
  const strategyHealth = computeStrategyHealth(rfp.winStrategy ?? null);
  if (strategyHealth.isDefined) {
    score += Math.round(strategyHealth.completenessScore * 0.3);
  }

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, score));

  // Determine recommendation
  const recommendation: BidRecommendation =
    score >= 70 ? 'go' :
    score >= 45 ? 'conditional' : 'no_go';

  // Tooltip
  const tooltip = recommendation === 'go'
    ? `Ready to proceed (${score}%)`
    : recommendation === 'conditional'
    ? `Proceed with caution (${score}%)`
    : `Not ready - needs work (${score}%)`;

  return { score, recommendation, tooltip };
}

export default function RfpListPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.companyId as string;

  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [firmBrainReadiness, setFirmBrainReadiness] = useState<FirmBrainReadiness | null>(null);
  const [newRfp, setNewRfp] = useState({
    title: '',
    dueDate: '',
    scopeSummary: '',
    selectedPath: 'strategy' as 'strategy' | 'project' | 'custom',
  });

  const fetchRfps = useCallback(async () => {
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps`);
      if (response.ok) {
        const data = await response.json();
        setRfps(data.rfps || []);
      }
    } catch (err) {
      console.error('Failed to fetch RFPs:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Fetch Firm Brain readiness when modal opens
  const fetchFirmBrainReadiness = useCallback(async () => {
    try {
      const [teamRes, casesRes, refsRes, pricingRes, plansRes, profileRes] = await Promise.all([
        fetch('/api/settings/firm-brain/team-members'),
        fetch('/api/settings/firm-brain/case-studies'),
        fetch('/api/settings/firm-brain/references'),
        fetch('/api/settings/firm-brain/pricing-templates'),
        fetch('/api/settings/firm-brain/plan-templates'),
        fetch('/api/settings/firm-brain/profile'),
      ]);

      const snapshot: FirmBrainSnapshot = {
        agencyProfile: profileRes.ok ? (await profileRes.json()).profile : null,
        teamMembers: teamRes.ok ? (await teamRes.json()).teamMembers || [] : [],
        caseStudies: casesRes.ok ? (await casesRes.json()).caseStudies || [] : [],
        references: refsRes.ok ? (await refsRes.json()).references || [] : [],
        pricingTemplates: pricingRes.ok ? (await pricingRes.json()).pricingTemplates || [] : [],
        planTemplates: plansRes.ok ? (await plansRes.json()).planTemplates || [] : [],
        snapshotAt: new Date().toISOString(),
      };

      const readiness = calculateFirmBrainReadiness(snapshot);
      setFirmBrainReadiness(readiness);
    } catch (err) {
      console.error('Failed to fetch Firm Brain readiness:', err);
    }
  }, []);

  useEffect(() => {
    fetchRfps();
  }, [fetchRfps]);

  // Fetch readiness when modal opens
  useEffect(() => {
    if (showCreateModal && !firmBrainReadiness) {
      fetchFirmBrainReadiness();
    }
  }, [showCreateModal, firmBrainReadiness, fetchFirmBrainReadiness]);

  const handleCreate = useCallback(async () => {
    if (!newRfp.title.trim()) return;
    setCreating(true);
    try {
      const response = await fetch(`/api/os/companies/${companyId}/rfps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRfp.title,
          dueDate: newRfp.dueDate || null,
          scopeSummary: newRfp.scopeSummary || null,
          selectedPath: newRfp.selectedPath,
          status: 'intake',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        router.push(`/c/${companyId}/deliver/rfp/${data.rfp.id}`);
      }
    } catch (err) {
      console.error('Failed to create RFP:', err);
    } finally {
      setCreating(false);
    }
  }, [companyId, newRfp, router]);

  const getStatusIcon = (status: Rfp['status']) => {
    switch (status) {
      case 'intake': return <Clock className="w-4 h-4 text-slate-400" />;
      case 'assembling': return <Loader2 className="w-4 h-4 text-blue-400" />;
      case 'review': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'submitted': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'won': return <Trophy className="w-4 h-4 text-emerald-400" />;
      case 'lost': return <XCircle className="w-4 h-4 text-slate-500" />;
      default: return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusLabel = (status: Rfp['status']) => {
    switch (status) {
      case 'intake': return 'Intake';
      case 'assembling': return 'Assembling';
      case 'review': return 'In Review';
      case 'submitted': return 'Submitted';
      case 'won': return 'Won';
      case 'lost': return 'Lost';
      default: return status;
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
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <FileText className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">RFP Responses</h1>
              <p className="text-sm text-slate-400">Create and manage proposal responses</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New RFP
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : rfps.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-2">No RFP Responses Yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create your first RFP response to get started with AI-powered proposal generation.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create RFP Response
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rfps.map((rfp) => {
            const readiness = getQuickReadinessEstimate(rfp);
            const readinessColors = {
              go: 'text-emerald-400 bg-emerald-500/10',
              conditional: 'text-amber-400 bg-amber-500/10',
              no_go: 'text-red-400 bg-red-500/10',
            };
            const readinessIcons = {
              go: <CheckCircle2 className="w-3 h-3" />,
              conditional: <AlertCircle className="w-3 h-3" />,
              no_go: <XCircle className="w-3 h-3" />,
            };

            return (
              <Link
                key={rfp.id}
                href={`/c/${companyId}/deliver/rfp/${rfp.id}`}
                className="block bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getStatusIcon(rfp.status)}</div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{rfp.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {getStatusLabel(rfp.status)}
                        {rfp.dueDate && (
                          <>
                            <span className="mx-2">|</span>
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Due {new Date(rfp.dueDate).toLocaleDateString()}
                          </>
                        )}
                      </p>
                      {rfp.scopeSummary && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{rfp.scopeSummary}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Bid Readiness Chip */}
                    {readiness && (
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${readinessColors[readiness.recommendation]}`}
                        title={readiness.tooltip}
                      >
                        {readinessIcons[readiness.recommendation]}
                        <span>{readiness.score}%</span>
                      </div>
                    )}
                    <span className="text-xs text-slate-500">
                      {rfp.updatedAt && new Date(rfp.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create New RFP Response</h2>

            {/* Firm Brain Readiness Warning */}
            {firmBrainReadiness && (
              <div className="mb-4">
                <FirmBrainReadinessBanner
                  readiness={firmBrainReadiness}
                  variant="compact"
                  showSettingsLink={true}
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={newRfp.title}
                  onChange={(e) => setNewRfp(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  placeholder="RFP Response for..."
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newRfp.dueDate}
                  onChange={(e) => setNewRfp(prev => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Engagement Type</label>
                <select
                  value={newRfp.selectedPath}
                  onChange={(e) => setNewRfp(prev => ({ ...prev, selectedPath: e.target.value as 'strategy' | 'project' | 'custom' }))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="strategy">Strategy Engagement</option>
                  <option value="project">Project Work</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Scope Summary</label>
                <textarea
                  value={newRfp.scopeSummary}
                  onChange={(e) => setNewRfp(prev => ({ ...prev, scopeSummary: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  placeholder="Brief description of the opportunity..."
                />
              </div>
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
                disabled={creating || !newRfp.title.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-medium rounded-lg transition-colors"
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
