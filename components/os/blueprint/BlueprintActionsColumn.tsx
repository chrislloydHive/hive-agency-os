// components/os/blueprint/BlueprintActionsColumn.tsx
// Right column: Actions / Priorities / Roadmap
// Answers "What should I care about and do now?"

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BlueprintOpportunities } from './BlueprintOpportunities';
import { BlueprintRoadmapSection } from './BlueprintRoadmapSection';
import { getImpactStyle, getEffortStyle, getCategoryColor, getUrgencyStyle, getRecommendationImpactStyle, formatRelativeTime, getScoreColor } from './utils';
import type {
  CompanyData,
  StrategySynthesis,
  StrategicFocusArea,
  PrioritizedAction,
  SerializedRecommendedTool,
  CompanyToolId,
  ToolIcon,
} from './types';
import type { ReactNode } from 'react';

interface BlueprintActionsColumnProps {
  company: CompanyData;
  strategySynthesis?: StrategySynthesis | null;
  recommendedTools?: SerializedRecommendedTool[];
  onSendActionToWork: (action: PrioritizedAction, actionId: string) => void;
  onSendFocusActionToWork: (area: StrategicFocusArea, focusId: string) => void;
  onRunTool: (rec: SerializedRecommendedTool) => void;
  onPlanWork: (rec: SerializedRecommendedTool) => void;
  sendingActions: Set<string>;
  sendingFocusActions: Set<string>;
  runningTools: Set<CompanyToolId>;
  planningWork: Set<string>;
}

function SectionHeader({
  icon,
  title,
  description,
  eyebrow,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-5 h-5 text-slate-400 mt-0.5">{icon}</div>
        <div>
          {eyebrow && (
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{eyebrow}</p>
          )}
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Focus Area Card with micro-action
function FocusAreaCard({
  area,
  index,
  onSendToWork,
  isSending,
}: {
  area: StrategicFocusArea;
  index: number;
  onSendToWork?: () => void;
  isSending?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 border border-slate-700/50 p-4 hover:border-blue-500/30 transition-colors">
      <div className="flex items-start gap-3 mb-2">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium flex items-center justify-center border border-blue-500/30">
          {index + 1}
        </span>
        <h4 className="text-sm font-medium text-slate-100">{area.title}</h4>
      </div>
      <p className="text-xs text-slate-400 mb-3">{area.rationale}</p>

      {/* Suggested Action (Micro-Action) */}
      {area.suggestedAction && (
        <div className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/30">
          <div className="flex items-start gap-2 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200">{area.suggestedAction.title}</p>
              {area.suggestedAction.description && (
                <p className="text-[10px] text-slate-400 mt-0.5">{area.suggestedAction.description}</p>
              )}
            </div>
          </div>
          {onSendToWork && (
            <button
              onClick={onSendToWork}
              disabled={isSending}
              className="w-full px-2 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors disabled:opacity-50"
            >
              {isSending ? 'Adding...' : 'Send to Work'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Recommended Tool Card
function RecommendedToolCard({
  rec,
  onRun,
  onPlanWork,
  isRunning,
  isPlanning,
  canRun,
  companyId,
}: {
  rec: SerializedRecommendedTool;
  onRun: () => void;
  onPlanWork: () => void;
  isRunning: boolean;
  isPlanning: boolean;
  canRun: boolean;
  companyId: string;
}) {
  const urgencyStyle = getUrgencyStyle(rec.urgency);
  const impactStyle = getRecommendationImpactStyle(rec.scoreImpact);

  return (
    <div className={`rounded-lg border p-4 ${urgencyStyle.border} ${urgencyStyle.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-slate-100">{rec.toolLabel}</h4>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${urgencyStyle.bg} ${urgencyStyle.text} border ${urgencyStyle.border}`}>
            {urgencyStyle.label}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${impactStyle.bg} ${impactStyle.text}`}>
            {impactStyle.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-300 mb-2">{rec.blueprintMeta.whyRun}</p>

      <p className="text-[10px] text-slate-500 mb-3">
        <span className="text-slate-400">Answers:</span> {rec.blueprintMeta.answersQuestion}
      </p>

      {/* Last run status */}
      <div className="text-[10px] text-slate-500 mb-3">
        {rec.hasRecentRun && rec.lastRunAt ? (
          <span>
            Last run: {formatRelativeTime(rec.lastRunAt)}
            {rec.lastScore !== null && rec.lastScore !== undefined && (
              <span className={`ml-2 ${getScoreColor(rec.lastScore)}`}>Score: {rec.lastScore}</span>
            )}
          </span>
        ) : rec.daysSinceRun !== null ? (
          <span className="text-amber-400">{rec.daysSinceRun} days since last run</span>
        ) : (
          <span className="text-blue-400">Never run</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={!canRun || isRunning}
          className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            canRun && !isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Running...' : 'Run'}
        </button>
        <button
          onClick={onPlanWork}
          disabled={isPlanning}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
        >
          {isPlanning ? '...' : 'Plan'}
        </button>
        {rec.lastRunId && rec.urlSlug && (
          <Link
            href={`/c/${companyId}/diagnostics/${rec.urlSlug}/${rec.lastRunId}`}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyActionsState() {
  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 border-dashed p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span className="text-sm font-medium text-slate-400">No Actions Yet</span>
      </div>
      <p className="text-xs text-slate-500">
        Run diagnostics to generate prioritized actions and recommendations.
      </p>
    </div>
  );
}

export function BlueprintActionsColumn({
  company,
  strategySynthesis,
  recommendedTools,
  onSendActionToWork,
  onSendFocusActionToWork,
  onRunTool,
  onPlanWork,
  sendingActions,
  sendingFocusActions,
  runningTools,
  planningWork,
}: BlueprintActionsColumnProps) {
  const hasSynthesis = !!strategySynthesis;
  const hasActions = hasSynthesis && strategySynthesis.prioritizedActions.length > 0;
  const hasFocusAreas = hasSynthesis && strategySynthesis.topFocusAreas.length > 0;
  const hasRecommendedTools = recommendedTools && recommendedTools.length > 0;

  if (!hasActions && !hasFocusAreas && !hasRecommendedTools) {
    return <EmptyActionsState />;
  }

  return (
    <div className="space-y-6">
      {/* Top Focus Areas */}
      {hasFocusAreas && (
        <section>
          <SectionHeader
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
            eyebrow="Strategist priorities"
            title="Top Focus Areas"
            description="Strategic priorities with suggested actions"
          />
          <div className="space-y-3">
            {strategySynthesis!.topFocusAreas.slice(0, 3).map((area, index) => (
              <FocusAreaCard
                key={index}
                area={area}
                index={index}
                onSendToWork={() => onSendFocusActionToWork(area, `focus-${index}`)}
                isSending={sendingFocusActions.has(`focus-${index}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Top Opportunities */}
      {hasActions && (
        <section id="opportunities">
          <SectionHeader
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            eyebrow="High-impact improvements"
            title="Top Opportunities"
            description="Prioritized by impact and effort"
            action={
              <Link
                href={`/c/${company.id}/work`}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                View all in Work
              </Link>
            }
          />
          <BlueprintOpportunities
            actions={strategySynthesis!.prioritizedActions}
            onSendToWork={onSendActionToWork}
            sendingItems={sendingActions}
          />
        </section>
      )}

      {/* 90-Day Roadmap */}
      {hasSynthesis && strategySynthesis.ninetyDayPlan && (
        <section id="roadmap">
          <SectionHeader
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
            eyebrow="Execution path: Now, Next, Later"
            title="90-Day Roadmap"
            description="Phased execution plan"
          />
          <BlueprintRoadmapSection
            strategySynthesis={strategySynthesis}
            companyId={company.id}
          />
        </section>
      )}

      {/* Recommended Tools */}
      {hasRecommendedTools && (
        <section>
          <SectionHeader
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            eyebrow="Strengthen your strategy"
            title="Recommended Tools"
            description="Run these for deeper insights"
          />
          <div className="space-y-3">
            {recommendedTools!.slice(0, 4).map((rec) => {
              const canRun = !rec.requiresWebsite || Boolean(company.website || company.domain);
              return (
                <RecommendedToolCard
                  key={rec.toolId}
                  rec={rec}
                  onRun={() => onRunTool(rec)}
                  onPlanWork={() => onPlanWork(rec)}
                  isRunning={runningTools.has(rec.toolId)}
                  isPlanning={planningWork.has(rec.toolId)}
                  canRun={canRun}
                  companyId={company.id}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
