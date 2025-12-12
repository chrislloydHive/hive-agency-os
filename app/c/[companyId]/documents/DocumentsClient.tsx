'use client';

// app/c/[companyId]/documents/DocumentsClient.tsx
// Documents Client Component
//
// Lists briefs with the ability to generate new ones and view details.

import { useState, useCallback } from 'react';
import {
  FileText,
  Loader2,
  Plus,
  Sparkles,
  Palette,
  Megaphone,
  Search,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import type { Brief, BriefType, BRIEF_TYPE_LABELS, DOCUMENT_STATUS_COLORS } from '@/lib/types/documents';

// ============================================================================
// Types
// ============================================================================

interface DocumentsClientProps {
  companyId: string;
  companyName: string;
  initialBriefs: Brief[];
  hasStrategy: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentsClient({
  companyId,
  companyName,
  initialBriefs,
  hasStrategy,
}: DocumentsClientProps) {
  const [briefs, setBriefs] = useState<Brief[]>(initialBriefs);
  const [generating, setGenerating] = useState<BriefType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  const briefTypeLabels: Record<BriefType, string> = {
    creative: 'Creative Brief',
    media: 'Media Activation Brief',
    content: 'Content Brief',
    seo: 'SEO Brief',
  };

  const briefTypeIcons: Record<BriefType, React.ReactNode> = {
    creative: <Palette className="w-4 h-4" />,
    media: <Megaphone className="w-4 h-4" />,
    content: <FileText className="w-4 h-4" />,
    seo: <Search className="w-4 h-4" />,
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    review: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    archived: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };

  // Generate a new brief
  const handleGenerate = useCallback(async (type: BriefType) => {
    if (!hasStrategy) {
      setError('Please create a strategy first before generating briefs.');
      return;
    }

    setGenerating(type);
    setError(null);

    try {
      const response = await fetch('/api/os/documents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, type }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate brief');
      }

      if (data.brief) {
        setBriefs(prev => [data.brief, ...prev]);
        setSelectedBrief(data.brief);
      }
    } catch (err) {
      console.error('[DocumentsClient] Generate error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setGenerating(null);
    }
  }, [companyId, hasStrategy]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Documents
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Briefs and generated documents for {companyName}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* No strategy warning */}
      {!hasStrategy && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-amber-400 font-medium">No active strategy</p>
            <p className="text-xs text-amber-400/70 mt-1">
              Create a strategy first to generate briefs from it.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brief Types / Generate */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-medium text-slate-300">Generate New Brief</h2>
          <div className="space-y-2">
            {(['creative', 'media', 'content', 'seo'] as BriefType[]).map(type => (
              <button
                key={type}
                onClick={() => handleGenerate(type)}
                disabled={generating !== null || !hasStrategy}
                className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                    {briefTypeIcons[type]}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-200">
                      {briefTypeLabels[type]}
                    </p>
                    <p className="text-xs text-slate-500">
                      AI-generated from strategy
                    </p>
                  </div>
                </div>
                {generating === type ? (
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-slate-500" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Brief List */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-slate-300 mb-4">
            Briefs ({briefs.length})
          </h2>

          {briefs.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800 border-dashed rounded-xl p-8 text-center">
              <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No briefs generated yet</p>
              <p className="text-xs text-slate-600 mt-1">
                Select a brief type to generate from your strategy
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {briefs.map(brief => (
                <button
                  key={brief.id}
                  onClick={() => setSelectedBrief(brief)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left ${
                    selectedBrief?.id === brief.id
                      ? 'bg-slate-800/50 border-cyan-500/50'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                      {briefTypeIcons[brief.type]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {brief.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {briefTypeLabels[brief.type]} • {new Date(brief.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${statusColors[brief.status]}`}
                    >
                      {brief.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Brief Detail Modal/Panel */}
      {selectedBrief && (
        <BriefDetailPanel
          brief={selectedBrief}
          onClose={() => setSelectedBrief(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Brief Detail Panel
// ============================================================================

function BriefDetailPanel({
  brief,
  onClose,
}: {
  brief: Brief;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-200">{brief.title}</h2>
            <p className="text-sm text-slate-500">{brief.type} brief</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-300"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-2">Summary</h3>
            <p className="text-sm text-slate-300">{brief.summary}</p>
          </div>

          {/* Body */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Content</h3>
            <div className="prose prose-invert prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-slate-800/50 p-4 rounded-lg">
                {brief.body}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
