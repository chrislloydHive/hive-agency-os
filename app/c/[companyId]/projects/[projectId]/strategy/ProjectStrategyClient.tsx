'use client';

// app/c/[companyId]/projects/[projectId]/strategy/ProjectStrategyClient.tsx
// Project Strategy Workspace client component

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  FileText,
} from 'lucide-react';
import type { ProjectViewModel } from '@/lib/os/projects';
import type { ProjectReadiness } from '@/lib/types/project';
import { PROJECT_TYPE_LABELS } from '@/lib/types/project';

interface ProjectStrategyClientProps {
  companyId: string;
  projectId: string;
}

export function ProjectStrategyClient({
  companyId,
  projectId,
}: ProjectStrategyClientProps) {
  const router = useRouter();
  const [viewModel, setViewModel] = useState<ProjectViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetch(
          `/api/os/companies/${companyId}/projects/${projectId}`
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch project');
        }

        setViewModel(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch project');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [companyId, projectId]);

  const handleGenerateBrief = async () => {
    if (!viewModel?.readiness.canGenerateBrief) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/os/companies/${companyId}/projects/${projectId}/brief/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'create' }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate brief');
      }

      // Navigate to brief page
      router.push(`/c/${companyId}/projects/${projectId}/brief`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !viewModel) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error || 'Project not found'}
          </div>
        </div>
      </div>
    );
  }

  const { project, strategy, readiness } = viewModel;
  const isLocked = project.isLocked || strategy?.isLocked;

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-3">
            <Link
              href={`/c/${companyId}/projects`}
              className="p-1 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">
                  {project.name}
                </h1>
                {isLocked && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded">
                    <Lock className="w-3 h-3" />
                    Locked
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {PROJECT_TYPE_LABELS[project.type]} Strategy
              </p>
            </div>
          </div>

          {/* Readiness indicators */}
          <div className="flex items-center gap-4">
            <ReadinessIndicator
              label="GAP"
              ready={readiness.gapComplete}
              blockedText="Run Full GAP"
            />
            <ReadinessIndicator
              label="Frame"
              ready={readiness.frameComplete}
              blockedText="Complete frame"
            />
            <ReadinessIndicator
              label="Objectives"
              ready={readiness.hasObjectives}
              blockedText="Add objectives"
            />
            <ReadinessIndicator
              label="Accepted Bets"
              ready={readiness.hasAcceptedBets}
              blockedText="Accept bets"
            />

            <div className="flex-1" />

            {/* Generate Brief CTA */}
            <button
              onClick={handleGenerateBrief}
              disabled={!readiness.canGenerateBrief || generating || isLocked}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Creative Brief
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Blocked reason */}
        {readiness.blockedReason && !readiness.canGenerateBrief && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium">
                  Complete the following to generate a brief:
                </p>
                <p className="text-amber-300/80 text-sm mt-1">
                  {readiness.blockedReason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy workspace placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Frame */}
          <div className="lg:col-span-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Strategic Frame
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FrameField
                label="Project Objective"
                value={strategy?.strategicFrame?.projectObjective}
                placeholder="What this project aims to achieve"
              />
              <FrameField
                label="Target Audience"
                value={strategy?.strategicFrame?.targetAudience}
                placeholder="Who this deliverable is for"
              />
              <FrameField
                label="Core Message"
                value={strategy?.strategicFrame?.coreMessage}
                placeholder="The key message to communicate"
              />
            </div>
          </div>

          {/* Objectives */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">Objectives</h3>
              <span className="text-xs text-slate-500">
                {strategy?.objectives?.length || 0} items
              </span>
            </div>
            {strategy?.objectives && strategy.objectives.length > 0 ? (
              <div className="space-y-2">
                {strategy.objectives.map((obj, i) => (
                  <div
                    key={obj.id || i}
                    className="p-2 bg-slate-700/30 rounded text-sm text-slate-300"
                  >
                    {obj.text}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No objectives defined yet
              </p>
            )}
          </div>

          {/* Strategic Bets */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">
                Strategic Bets
              </h3>
              <span className="text-xs text-slate-500">
                {strategy?.strategicBets?.filter((b) => b.status === 'accepted')
                  .length || 0}{' '}
                accepted
              </span>
            </div>
            {strategy?.strategicBets && strategy.strategicBets.length > 0 ? (
              <div className="space-y-2">
                {strategy.strategicBets.map((bet, i) => (
                  <div
                    key={bet.id || i}
                    className={`p-2 rounded text-sm ${
                      bet.status === 'accepted'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : bet.status === 'rejected'
                          ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                          : 'bg-slate-700/30 text-slate-300'
                    }`}
                  >
                    <div className="font-medium">{bet.title}</div>
                    <div className="text-xs opacity-75 mt-0.5">{bet.intent}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No strategic bets defined yet
              </p>
            )}
          </div>

          {/* Tactics */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">Tactics</h3>
              <span className="text-xs text-slate-500">
                {strategy?.tactics?.length || 0} items
              </span>
            </div>
            {strategy?.tactics && strategy.tactics.length > 0 ? (
              <div className="space-y-2">
                {strategy.tactics.map((tactic, i) => (
                  <div
                    key={tactic.id || i}
                    className="p-2 bg-slate-700/30 rounded text-sm text-slate-300"
                  >
                    {tactic.title}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No tactics defined yet (optional)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function ReadinessIndicator({
  label,
  ready,
  blockedText,
}: {
  label: string;
  ready: boolean;
  blockedText: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ready ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
      )}
      <span className={ready ? 'text-emerald-400' : 'text-amber-400'}>
        {label}
      </span>
    </div>
  );
}

function FrameField({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className="p-2 bg-slate-700/30 rounded min-h-[60px] text-sm">
        {value ? (
          <span className="text-slate-300">{value}</span>
        ) : (
          <span className="text-slate-500 italic">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

export default ProjectStrategyClient;
