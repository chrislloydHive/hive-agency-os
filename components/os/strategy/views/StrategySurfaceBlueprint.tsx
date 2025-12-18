'use client';

// components/os/strategy/views/StrategySurfaceBlueprint.tsx
// Blueprint View - Read-only Strategy Narrative
//
// SCREEN RESPONSIBILITY (NON-NEGOTIABLE):
// - Read-only view of the complete strategy
// - Shows ONLY ACCEPTED strategic bets (not drafts)
// - Shows: Objectives → Frame → Accepted Bets → Tactics
// - NO editing - only navigation links to edit screens
//
// This is a "one-pager" view of the strategy for stakeholder review.
// Links exist for navigation, but editing happens in appropriate screens.

import React from 'react';
import Link from 'next/link';
import {
  Target,
  Users,
  Layers,
  Zap,
  ChevronRight,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import type { StrategySurfaceViewProps } from './types';

// ============================================================================
// Section Header
// ============================================================================

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  count?: number;
  colorClass: string;
  editLink?: string;
}

function SectionHeader({ icon: Icon, title, count, colorClass, editLink }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`p-2 rounded-lg ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-slate-500">({count})</span>
          )}
        </h2>
      </div>
      {editLink && (
        <Link
          href={editLink}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
        >
          <Edit3 className="w-3 h-3" />
          Edit
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// Flow Connector
// ============================================================================

function FlowConnector() {
  return (
    <div className="hidden lg:flex items-center justify-center py-2">
      <div className="flex items-center text-slate-600">
        <div className="w-8 h-px bg-slate-700" />
        <ChevronRight className="w-4 h-4 -mx-1" />
        <div className="w-8 h-px bg-slate-700" />
      </div>
    </div>
  );
}

// ============================================================================
// Objective Card
// ============================================================================

interface ObjectiveCardProps {
  objective: {
    id: string;
    text: string;
    metric?: string;
    target?: string;
    status?: string;
  };
}

function ObjectiveCard({ objective }: ObjectiveCardProps) {
  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30">
      <div className="flex items-start gap-3">
        <Target className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-200">{objective.text}</p>
          {(objective.metric || objective.target) && (
            <div className="flex items-center gap-2 mt-2">
              {objective.metric && (
                <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                  {objective.metric}
                </span>
              )}
              {objective.target && (
                <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">
                  Target: {objective.target}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Frame Field
// ============================================================================

interface FrameFieldProps {
  label: string;
  value: string | null | undefined;
  source: 'user' | 'context' | 'missing';
}

function FrameField({ label, value, source }: FrameFieldProps) {
  const sourceColors = {
    user: 'border-purple-500/30',
    context: 'border-blue-500/30',
    missing: 'border-amber-500/30',
  };

  return (
    <div className={`p-3 rounded-lg border bg-slate-800/30 ${sourceColors[source]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          source === 'user' ? 'bg-purple-500/10 text-purple-400' :
          source === 'context' ? 'bg-blue-500/10 text-blue-400' :
          'bg-amber-500/10 text-amber-400'
        }`}>
          {source === 'user' ? 'User' : source === 'context' ? 'Context' : 'Missing'}
        </span>
      </div>
      <p className="text-sm text-slate-200">
        {value || <span className="text-slate-500 italic">Not set</span>}
      </p>
    </div>
  );
}

// ============================================================================
// Priority Card
// ============================================================================

interface PriorityCardProps {
  priority: {
    id: string;
    title: string;
    description?: string;
    priority?: 'high' | 'medium' | 'low';
    rationale?: string;
  };
  index: number;
}

function PriorityCard({ priority, index }: PriorityCardProps) {
  const priorityColors = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-slate-500',
  };

  return (
    <div className={`p-4 rounded-lg border border-slate-700 bg-slate-800/30 border-l-4 ${priorityColors[priority.priority || 'medium']}`}>
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs font-medium text-slate-300">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-200">{priority.title}</h4>
          {priority.description && (
            <p className="text-xs text-slate-400 mt-1">{priority.description}</p>
          )}
          {priority.rationale && (
            <p className="text-xs text-slate-500 mt-2 italic">"{priority.rationale}"</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tactic Card
// ============================================================================

interface TacticCardProps {
  tactic: {
    id: string;
    title: string;
    description?: string;
    impact?: 'high' | 'medium' | 'low';
    effort?: 'high' | 'medium' | 'low';
    status?: string;
    channels?: string[];
  };
}

function TacticCard({ tactic }: TacticCardProps) {
  return (
    <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-slate-200">{tactic.title}</h4>
          {tactic.description && (
            <p className="text-xs text-slate-400 mt-1">{tactic.description}</p>
          )}
        </div>
        {tactic.status && (
          <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${
            tactic.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
            tactic.status === 'proposed' ? 'bg-amber-500/10 text-amber-400' :
            'bg-slate-500/10 text-slate-400'
          }`}>
            {tactic.status}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        {tactic.impact && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            tactic.impact === 'high' ? 'bg-emerald-500/10 text-emerald-400' :
            tactic.impact === 'medium' ? 'bg-amber-500/10 text-amber-400' :
            'bg-slate-500/10 text-slate-400'
          }`}>
            {tactic.impact} impact
          </span>
        )}
        {tactic.effort && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            tactic.effort === 'low' ? 'bg-emerald-500/10 text-emerald-400' :
            tactic.effort === 'medium' ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'
          }`}>
            {tactic.effort} effort
          </span>
        )}
        {tactic.channels && tactic.channels.length > 0 && (
          <span className="text-[10px] text-slate-500">
            {tactic.channels.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StrategySurfaceBlueprint({
  companyId,
  companyName,
  data,
  helpers,
}: StrategySurfaceViewProps) {
  const { objectives, priorities, tactics } = helpers;
  const strategy = data.strategy;
  const hydratedFrame = data.hydratedFrame;

  // Filter to only show ACCEPTED strategic bets (status='active' or 'completed' in pillar terms)
  const acceptedBets = priorities.filter(p => {
    const status = (p as unknown as { status?: string }).status;
    // Show if explicitly active/completed, or if no status (legacy data with content)
    return status === 'active' || status === 'completed' || (!status && p.title && p.title.trim().length > 0);
  });

  // Determine frame field sources
  const getFrameSource = (fieldKey: string): 'user' | 'context' | 'missing' => {
    if (data.frameSummary.fromUser.includes(fieldKey)) return 'user';
    if (data.frameSummary.fromContext.includes(fieldKey)) return 'context';
    return 'missing';
  };

  // Edit link points to workspace (2-page model: all editing in workspace)
  const workspaceUrl = `/c/${companyId}/strategy?view=workspace`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center pb-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-slate-100">
          {strategy.title || 'Strategy Blueprint'}
        </h1>
        <p className="text-sm text-slate-400 mt-2">{companyName}</p>
        {strategy.summary && (
          <p className="text-sm text-slate-300 mt-4 max-w-2xl mx-auto">
            {strategy.summary}
          </p>
        )}
      </div>

      {/* Objectives Section */}
      <section>
        <SectionHeader
          icon={Target}
          title="Objectives"
          count={objectives.length}
          colorClass="bg-blue-500/10 text-blue-400"
          editLink={workspaceUrl}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {objectives
            .filter(obj => obj.text && obj.text.trim().length > 0)
            .map((obj, idx) => (
              <ObjectiveCard key={obj.id || `obj-${idx}`} objective={obj} />
            ))}
          {objectives.filter(obj => obj.text && obj.text.trim().length > 0).length === 0 && (
            <div className="col-span-2 p-6 text-center border border-dashed border-slate-700 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No objectives defined</p>
            </div>
          )}
        </div>
      </section>

      <FlowConnector />

      {/* Strategic Frame Section */}
      <section>
        <SectionHeader
          icon={Users}
          title="Strategic Frame"
          colorClass="bg-purple-500/10 text-purple-400"
          editLink={workspaceUrl}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <FrameField
            label="Target Audience"
            value={hydratedFrame.audience?.value}
            source={getFrameSource('audience')}
          />
          <FrameField
            label="Primary Offering"
            value={hydratedFrame.offering?.value}
            source={getFrameSource('offering')}
          />
          <FrameField
            label="Value Proposition"
            value={hydratedFrame.valueProp?.value}
            source={getFrameSource('valueProp')}
          />
          <FrameField
            label="Market Positioning"
            value={hydratedFrame.positioning?.value}
            source={getFrameSource('positioning')}
          />
          <FrameField
            label="Constraints"
            value={hydratedFrame.constraints?.value}
            source={getFrameSource('constraints')}
          />
        </div>
      </section>

      <FlowConnector />

      {/* Strategic Bets Section - Only shows ACCEPTED bets */}
      <section>
        <SectionHeader
          icon={Layers}
          title="Strategic Bets"
          count={acceptedBets.length}
          colorClass="bg-amber-500/10 text-amber-400"
          editLink={workspaceUrl}
        />
        <div className="space-y-3">
          {acceptedBets.map((priority, index) => (
            <PriorityCard key={priority.id} priority={priority} index={index} />
          ))}
          {acceptedBets.length === 0 && (
            <div className="p-6 text-center border border-dashed border-slate-700 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No strategic bets accepted yet</p>
              <p className="text-xs text-slate-500 mt-1">Accept bets in Command view</p>
            </div>
          )}
        </div>
      </section>

      <FlowConnector />

      {/* Tactics Section - Generated in Orchestration */}
      <section>
        <SectionHeader
          icon={Zap}
          title="Tactics"
          count={tactics.length}
          colorClass="bg-emerald-500/10 text-emerald-400"
          editLink={workspaceUrl}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tactics
            .filter(t => t.title && t.title.trim().length > 0)
            .map((tactic) => (
              <TacticCard key={tactic.id} tactic={tactic} />
            ))}
          {tactics.filter(t => t.title && t.title.trim().length > 0).length === 0 && (
            <div className="col-span-2 p-6 text-center border border-dashed border-slate-700 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No tactics defined</p>
            </div>
          )}
        </div>
      </section>

      {/* Tradeoffs Section */}
      {strategy.tradeoffs && (
        <section className="pt-6 border-t border-slate-800">
          <SectionHeader
            icon={Briefcase}
            title="Strategic Tradeoffs"
            colorClass="bg-slate-500/10 text-slate-400"
            editLink={workspaceUrl}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategy.tradeoffs.optimizesFor && strategy.tradeoffs.optimizesFor.length > 0 && (
              <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                <h4 className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Optimizes For
                </h4>
                <ul className="space-y-1">
                  {strategy.tradeoffs.optimizesFor.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {strategy.tradeoffs.sacrifices && strategy.tradeoffs.sacrifices.length > 0 && (
              <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <h4 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Sacrifices
                </h4>
                <ul className="space-y-1">
                  {strategy.tradeoffs.sacrifices.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {strategy.tradeoffs.risks && strategy.tradeoffs.risks.length > 0 && (
              <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                <h4 className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Risks
                </h4>
                <ul className="space-y-1">
                  {strategy.tradeoffs.risks.map((item, i) => (
                    <li key={i} className="text-sm text-slate-300">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default StrategySurfaceBlueprint;
