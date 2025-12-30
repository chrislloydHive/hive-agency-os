'use client';

// components/os/strategy/ImportStrategyModal.tsx
// Modal to import an approved strategy (bypasses labs/context requirements)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, Upload, CheckCircle2 } from 'lucide-react';

interface ImportStrategyModalProps {
  companyId: string;
  companyName: string;
  onClose: () => void;
  onSuccess?: (strategyId: string) => void;
}

type StatusOption = 'approved' | 'active' | 'draft';

const STATUS_OPTIONS: { value: StatusOption; label: string; description: string }[] = [
  {
    value: 'approved',
    label: 'Approved',
    description: 'Ready for execution',
  },
  {
    value: 'active',
    label: 'Active',
    description: 'Currently in execution',
  },
  {
    value: 'draft',
    label: 'Draft',
    description: 'Still being refined',
  },
];

export function ImportStrategyModal({
  companyId,
  companyName,
  onClose,
  onSuccess,
}: ImportStrategyModalProps) {
  const router = useRouter();
  const [name, setName] = useState(`${companyName} – Strategy`);
  const [status, setStatus] = useState<StatusOption>('approved');
  const [intent, setIntent] = useState('');
  const [constraints, setConstraints] = useState('');
  const [optimizationScope, setOptimizationScope] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Strategy name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/os/companies/${companyId}/strategy/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          status,
          intent: intent.trim() || undefined,
          constraints: constraints.trim() || undefined,
          optimizationScope: optimizationScope.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import strategy');
      }

      // Success - navigate to Decide with the imported strategy selected
      if (onSuccess) {
        onSuccess(data.strategyId);
      } else {
        router.push(`/c/${companyId}/decide?strategyId=${data.strategyId}`);
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import strategy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Upload className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import Strategy</h2>
              <p className="text-xs text-slate-500">For pre-approved or existing strategies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Strategy Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Strategy Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2025 Growth Strategy"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={`p-2 rounded-lg border text-left transition-colors ${
                    status === option.value
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {status === option.value && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Intent */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Strategic Intent
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="• Increase brand awareness in the Pacific NW&#10;• Generate 50 qualified leads per month&#10;• Support new product launch in Q2"
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Brief bullets describing what this strategy aims to achieve (3 max recommended)
            </p>
          </div>

          {/* Constraints */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Constraints
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g., Budget cap of $50k/month, no paid social, must use existing brand guidelines"
              rows={2}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Optimization Scope */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Optimization Focus
              <span className="text-slate-500 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={optimizationScope}
              onChange={(e) => setOptimizationScope(e.target.value)}
              placeholder="e.g., Lead generation, Brand awareness, Website traffic"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Create Strategy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ImportStrategyModal;
