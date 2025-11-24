// components/os/diagnostics/ActionCard.tsx
// Generic Action Card Component

'use client';

import { useState } from 'react';
import type { DiagnosticAction } from '@/lib/diagnostics/types';
import { getServiceAreaLabel, getServiceAreaColor } from '@/lib/diagnostics/types';

type Props = {
  action: DiagnosticAction;
  onSendToWork?: (actionId: string) => void;
};

export function ActionCard({ action, onSendToWork }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendToWork = async () => {
    if (!onSendToWork) return;

    setSending(true);
    try {
      await onSendToWork(action.id);
      setSent(true);
    } catch (error) {
      console.error('Error sending to work:', error);
      alert('Failed to send to work queue');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-slate-600">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">{action.title}</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${getServiceAreaColor(action.serviceArea)}`}>
              {getServiceAreaLabel(action.serviceArea)}
            </span>
            {action.playbook && (
              <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                📋 {action.playbook}
              </span>
            )}
            {action.estimatedLift && (
              <span className="rounded bg-green-600/20 px-2 py-0.5 text-xs font-semibold text-green-400">
                +{action.estimatedLift}% lift
              </span>
            )}
          </div>
        </div>
        {onSendToWork && (
          <button
            onClick={handleSendToWork}
            disabled={sending || sent}
            className={`flex-shrink-0 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              sent
                ? 'bg-green-600/20 text-green-400 cursor-not-allowed'
                : sending
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {sent ? '✓ Sent' : sending ? 'Sending...' : 'Send to Work'}
          </button>
        )}
      </div>

      <p className="mb-2 text-xs leading-relaxed text-slate-300">{action.description}</p>

      <div className="mb-2 rounded bg-slate-800/50 p-2">
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Why:</strong> {action.rationale}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <span>
          Impact: <span className="font-medium text-slate-300">{action.impactScore}/5</span>
        </span>
        <span>•</span>
        <span>
          Effort: <span className="font-medium text-slate-300">{action.effortScore}/5</span>
        </span>
        {action.recommendedTimebox && (
          <>
            <span>•</span>
            <span>
              Time: <span className="font-medium text-slate-300">{action.recommendedTimebox}</span>
            </span>
          </>
        )}
        {action.recommendedRole && (
          <>
            <span>•</span>
            <span>
              Role: <span className="font-medium text-slate-300">{action.recommendedRole}</span>
            </span>
          </>
        )}
      </div>

      {action.tags && action.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {action.tags.map((tag) => (
            <span key={tag} className="rounded bg-slate-800/50 px-1.5 py-0.5 text-xs text-slate-500">
              {tag}
            </span>
          ))}
        </div>
      )}

      {action.evidenceRefs && action.evidenceRefs.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          Evidence: {action.evidenceRefs.length} source{action.evidenceRefs.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
