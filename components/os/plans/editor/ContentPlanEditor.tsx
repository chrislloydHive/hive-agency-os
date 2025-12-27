'use client';

// components/os/plans/editor/ContentPlanEditor.tsx
// Editor for Content Plan sections

import { useCallback } from 'react';
import {
  FileText,
  Users,
  Layers,
  Calendar,
  Search,
  Share2,
  Workflow,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import type { ContentPlanSections, ContentPillar, ContentCalendarItem, DistributionChannel } from '@/lib/types/plan';
import { SectionCard } from './SectionCard';
import { EditableTextarea } from './EditableTextarea';
import { EditableList } from './EditableList';
import { PillarsEditor } from './PillarsEditor';
import { ContentCalendarEditor } from './ContentCalendarEditor';
import { DistributionEditor } from './DistributionEditor';
import { RisksEditor } from './RisksEditor';

interface ContentPlanEditorProps {
  sections: ContentPlanSections;
  onChange: (sections: ContentPlanSections) => void;
  readOnly?: boolean;
}

export function ContentPlanEditor({
  sections,
  onChange,
  readOnly = false,
}: ContentPlanEditorProps) {
  // Helper to update a nested section
  const updateSection = useCallback(
    <K extends keyof ContentPlanSections>(
      key: K,
      value: ContentPlanSections[K]
    ) => {
      onChange({ ...sections, [key]: value });
    },
    [sections, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Summary Section */}
      <SectionCard
        title="Summary"
        description="Editorial thesis, voice guidance, and constraints"
        icon={<FileText className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableTextarea
            label="Goal Statement"
            value={sections.summary.goalStatement || ''}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, goalStatement: v })
            }
            placeholder="What is the primary goal for this content plan?"
            rows={2}
            readOnly={readOnly}
            helperText="The main objective driving this content plan"
          />
          <EditableTextarea
            label="Editorial Thesis"
            value={sections.summary.editorialThesis}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, editorialThesis: v })
            }
            placeholder="What is the central editorial thesis or point of view?"
            rows={3}
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Voice & Tone Guidance"
            value={sections.summary.voiceGuidance}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, voiceGuidance: v })
            }
            placeholder="Describe the voice and tone for all content..."
            rows={2}
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Constraints"
            value={sections.summary.constraintsText || ''}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, constraintsText: v })
            }
            placeholder="Any constraints on content creation..."
            rows={2}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Audiences Section */}
      <SectionCard
        title="Target Audiences"
        description="Audience segments, pains, intents, and objections"
        icon={<Users className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.audiences.segments.length} segments
          </span>
        }
      >
        <AudienceSegmentsEditor
          segments={sections.audiences.segments}
          onChange={(v) => updateSection('audiences', { segments: v })}
          readOnly={readOnly}
        />
      </SectionCard>

      {/* Pillars Section */}
      <SectionCard
        title="Content Pillars"
        description="Themes and topics for content organization"
        icon={<Layers className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.pillars.length} pillars
          </span>
        }
      >
        <PillarsEditor
          pillars={sections.pillars}
          onChange={(v) => updateSection('pillars', v)}
          readOnly={readOnly}
        />
      </SectionCard>

      {/* Calendar Section */}
      <SectionCard
        title="Content Calendar"
        description="Planned content pieces and schedule"
        icon={<Calendar className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.calendar.length} items
          </span>
        }
      >
        <ContentCalendarEditor
          items={sections.calendar}
          onChange={(v) => updateSection('calendar', v)}
          pillars={sections.pillars.map(p => p.pillar)}
          readOnly={readOnly}
        />
      </SectionCard>

      {/* SEO Section */}
      <SectionCard
        title="SEO Strategy"
        description="Keywords, on-page standards, and linking"
        icon={<Search className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableList
            label="Keyword Clusters"
            items={sections.seo.keywordClusters}
            onChange={(v) =>
              updateSection('seo', { ...sections.seo, keywordClusters: v })
            }
            placeholder="Add a keyword cluster..."
            readOnly={readOnly}
          />
          <EditableList
            label="On-Page Standards"
            items={sections.seo.onPageStandards}
            onChange={(v) =>
              updateSection('seo', { ...sections.seo, onPageStandards: v })
            }
            placeholder="Add an on-page standard..."
            readOnly={readOnly}
          />
          <EditableList
            label="Internal Linking Rules"
            items={sections.seo.internalLinkingRules}
            onChange={(v) =>
              updateSection('seo', { ...sections.seo, internalLinkingRules: v })
            }
            placeholder="Add a linking rule..."
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Distribution Section */}
      <SectionCard
        title="Distribution"
        description="Channels and partnerships for content distribution"
        icon={<Share2 className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.distribution.channels.length} channels
          </span>
        }
      >
        <div className="space-y-4">
          <DistributionEditor
            channels={sections.distribution.channels}
            onChange={(v) =>
              updateSection('distribution', { ...sections.distribution, channels: v })
            }
            readOnly={readOnly}
          />
          <EditableList
            label="Partnerships"
            items={sections.distribution.partnerships || []}
            onChange={(v) =>
              updateSection('distribution', { ...sections.distribution, partnerships: v })
            }
            placeholder="Add a distribution partner..."
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Production Section */}
      <SectionCard
        title="Production Workflow"
        description="Content production process and roles"
        icon={<Workflow className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableList
            label="Workflow Steps"
            items={sections.production.workflowSteps}
            onChange={(v) =>
              updateSection('production', { ...sections.production, workflowSteps: v })
            }
            placeholder="Add a workflow step..."
            readOnly={readOnly}
          />
          <EditableList
            label="Roles"
            items={sections.production.roles}
            onChange={(v) =>
              updateSection('production', { ...sections.production, roles: v })
            }
            placeholder="Add a role..."
            readOnly={readOnly}
          />
          <EditableTextarea
            label="SLA"
            value={sections.production.sla || ''}
            onChange={(v) =>
              updateSection('production', { ...sections.production, sla: v })
            }
            placeholder="Service level agreements for content production..."
            rows={2}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Measurement Section */}
      <SectionCard
        title="Measurement"
        description="KPIs and reporting cadence"
        icon={<BarChart3 className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <KPIsEditor
            kpis={sections.measurement.kpis}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, kpis: v })
            }
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Reporting Cadence"
            value={sections.measurement.reportingCadence}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, reportingCadence: v })
            }
            placeholder="How often will performance be reviewed?"
            rows={1}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Risks Section */}
      <SectionCard
        title="Risks"
        description="Potential risks and mitigations"
        icon={<AlertTriangle className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.risks.length} risks
          </span>
        }
      >
        <RisksEditor
          risks={sections.risks}
          onChange={(v) => updateSection('risks', v)}
          readOnly={readOnly}
        />
      </SectionCard>
    </div>
  );
}

// ============================================================================
// Audience Segments Editor
// ============================================================================

import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ContentSegment, PlanKPI } from '@/lib/types/plan';

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function AudienceSegmentsEditor({
  segments,
  onChange,
  readOnly = false,
}: {
  segments: ContentSegment[];
  onChange: (segments: ContentSegment[]) => void;
  readOnly?: boolean;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const addSegment = useCallback(() => {
    const newSegment: ContentSegment = {
      id: generateId(),
      segment: '',
      pains: [],
      intents: [],
      objections: [],
    };
    onChange([...segments, newSegment]);
    setExpandedIds((prev) => new Set(prev).add(newSegment.id));
  }, [segments, onChange]);

  const removeSegment = useCallback(
    (id: string) => {
      onChange(segments.filter((s) => s.id !== id));
    },
    [segments, onChange]
  );

  const updateSegment = useCallback(
    (id: string, updates: Partial<ContentSegment>) => {
      onChange(
        segments.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        )
      );
    },
    [segments, onChange]
  );

  if (segments.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No audience segments defined</p>;
  }

  return (
    <div className="space-y-3">
      {segments.map((segment) => {
        const isExpanded = expandedIds.has(segment.id);

        return (
          <div
            key={segment.id}
            className="border border-slate-700/30 rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 bg-slate-900/30">
              <button
                onClick={() => toggleExpanded(segment.id)}
                className="flex items-center gap-2 text-left flex-1"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-200">
                  {segment.segment || 'Untitled Segment'}
                </span>
              </button>
              {!readOnly && (
                <button
                  onClick={() => removeSegment(segment.id)}
                  className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="p-4 space-y-4 border-t border-slate-700/30">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Segment Name</label>
                  <input
                    type="text"
                    value={segment.segment}
                    onChange={(e) => updateSegment(segment.id, { segment: e.target.value })}
                    placeholder="e.g., B2B Decision Makers"
                    readOnly={readOnly}
                    className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                      readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                    }`}
                  />
                </div>
                <EditableList
                  label="Pain Points"
                  items={segment.pains}
                  onChange={(v) => updateSegment(segment.id, { pains: v })}
                  placeholder="Add a pain point..."
                  readOnly={readOnly}
                />
                <EditableList
                  label="Search Intents"
                  items={segment.intents}
                  onChange={(v) => updateSegment(segment.id, { intents: v })}
                  placeholder="Add a search intent..."
                  readOnly={readOnly}
                />
                <EditableList
                  label="Common Objections"
                  items={segment.objections}
                  onChange={(v) => updateSegment(segment.id, { objections: v })}
                  placeholder="Add an objection..."
                  readOnly={readOnly}
                />
              </div>
            )}
          </div>
        );
      })}

      {!readOnly && (
        <button
          onClick={addSegment}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Segment
        </button>
      )}
    </div>
  );
}

// ============================================================================
// KPIs Editor
// ============================================================================

function KPIsEditor({
  kpis,
  onChange,
  readOnly = false,
}: {
  kpis: PlanKPI[];
  onChange: (kpis: PlanKPI[]) => void;
  readOnly?: boolean;
}) {
  const addKPI = useCallback(() => {
    const newKPI: PlanKPI = {
      id: generateId(),
      name: '',
      metric: '',
      target: '',
    };
    onChange([...kpis, newKPI]);
  }, [kpis, onChange]);

  const removeKPI = useCallback(
    (id: string) => {
      onChange(kpis.filter((k) => k.id !== id));
    },
    [kpis, onChange]
  );

  const updateKPI = useCallback(
    (id: string, updates: Partial<PlanKPI>) => {
      onChange(
        kpis.map((k) =>
          k.id === id ? { ...k, ...updates } : k
        )
      );
    },
    [kpis, onChange]
  );

  if (kpis.length === 0 && readOnly) {
    return <p className="text-sm text-slate-500 italic">No KPIs defined</p>;
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-300">Key Performance Indicators</label>
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="flex items-start gap-3 p-3 bg-slate-900/30 border border-slate-700/30 rounded-lg"
        >
          <div className="flex-1 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={kpi.name}
                onChange={(e) => updateKPI(kpi.id, { name: e.target.value })}
                placeholder="e.g., Traffic"
                readOnly={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Metric</label>
              <input
                type="text"
                value={kpi.metric}
                onChange={(e) => updateKPI(kpi.id, { metric: e.target.value })}
                placeholder="e.g., Monthly sessions"
                readOnly={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target</label>
              <input
                type="text"
                value={kpi.target}
                onChange={(e) => updateKPI(kpi.id, { target: e.target.value })}
                placeholder="e.g., 50,000"
                readOnly={readOnly}
                className={`w-full px-2 py-1.5 bg-slate-900/50 border border-slate-700 rounded text-sm text-slate-200 placeholder-slate-500 ${
                  readOnly ? 'cursor-not-allowed opacity-75' : 'focus:outline-none focus:ring-1 focus:ring-purple-500/50'
                }`}
              />
            </div>
          </div>
          {!readOnly && (
            <button
              onClick={() => removeKPI(kpi.id)}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors mt-5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          onClick={addKPI}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-600/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add KPI
        </button>
      )}
    </div>
  );
}

export default ContentPlanEditor;
