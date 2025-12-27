'use client';

// components/os/plans/editor/MediaPlanEditor.tsx
// Editor for Media Plan sections

import { useCallback } from 'react';
import {
  FileText,
  DollarSign,
  Globe2,
  BarChart3,
  Layers,
  Calendar,
  AlertTriangle,
  Target,
} from 'lucide-react';
import type { MediaPlanSections, ChannelAllocation, MediaCampaign, PlanRiskItem } from '@/lib/types/plan';
import { SectionCard } from './SectionCard';
import { EditableTextarea } from './EditableTextarea';
import { EditableList } from './EditableList';
import { EditableNumber } from './EditableNumber';
import { ChannelMixEditor } from './ChannelMixEditor';
import { CampaignsEditor } from './CampaignsEditor';
import { RisksEditor } from './RisksEditor';

interface MediaPlanEditorProps {
  sections: MediaPlanSections;
  onChange: (sections: MediaPlanSections) => void;
  readOnly?: boolean;
}

export function MediaPlanEditor({
  sections,
  onChange,
  readOnly = false,
}: MediaPlanEditorProps) {
  // Helper to update a nested section
  const updateSection = useCallback(
    <K extends keyof MediaPlanSections>(
      key: K,
      value: MediaPlanSections[K]
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
        description="Goal statement, executive summary, and key assumptions"
        icon={<FileText className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableTextarea
            label="Goal Statement"
            value={sections.summary.goalStatement || ''}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, goalStatement: v })
            }
            placeholder="What is the primary goal for this media plan?"
            rows={2}
            readOnly={readOnly}
            helperText="The main objective driving this media plan"
          />
          <EditableTextarea
            label="Executive Summary"
            value={sections.summary.executiveSummary}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, executiveSummary: v })
            }
            placeholder="Brief overview of the media strategy and approach..."
            rows={4}
            readOnly={readOnly}
          />
          <EditableList
            label="Key Assumptions"
            items={sections.summary.assumptions}
            onChange={(v) =>
              updateSection('summary', { ...sections.summary, assumptions: v })
            }
            placeholder="Add an assumption..."
            readOnly={readOnly}
            helperText="What assumptions underlie this plan?"
          />
        </div>
      </SectionCard>

      {/* Budget Section */}
      <SectionCard
        title="Budget"
        description="Monthly/quarterly budget and constraints"
        icon={<DollarSign className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <EditableNumber
              label="Monthly Budget"
              value={sections.budget.totalMonthly}
              onChange={(v) =>
                updateSection('budget', { ...sections.budget, totalMonthly: v })
              }
              prefix="$"
              readOnly={readOnly}
            />
            <EditableNumber
              label="Quarterly Budget"
              value={sections.budget.totalQuarterly}
              onChange={(v) =>
                updateSection('budget', { ...sections.budget, totalQuarterly: v })
              }
              prefix="$"
              readOnly={readOnly}
            />
          </div>
          <EditableTextarea
            label="Budget Constraints"
            value={sections.budget.constraintsText || ''}
            onChange={(v) =>
              updateSection('budget', { ...sections.budget, constraintsText: v })
            }
            placeholder="Any budget constraints or considerations..."
            rows={2}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Markets Section */}
      <SectionCard
        title="Markets & Geography"
        description="Target geographic markets"
        icon={<Globe2 className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableList
            label="Geographic Targets"
            items={sections.markets.geo}
            onChange={(v) =>
              updateSection('markets', { ...sections.markets, geo: v })
            }
            placeholder="Add a market (e.g., US, UK, EMEA)..."
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Notes"
            value={sections.markets.notes || ''}
            onChange={(v) =>
              updateSection('markets', { ...sections.markets, notes: v })
            }
            placeholder="Additional notes about market targeting..."
            rows={2}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Measurement Section */}
      <SectionCard
        title="Measurement"
        description="Tracking, attribution, and reporting setup"
        icon={<BarChart3 className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableTextarea
            label="Tracking Stack"
            value={sections.measurement.trackingStack}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, trackingStack: v })
            }
            placeholder="Describe the analytics and tracking setup..."
            rows={2}
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Attribution Model"
            value={sections.measurement.attributionModel}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, attributionModel: v })
            }
            placeholder="e.g., Last Click, First Touch, Data-Driven..."
            rows={1}
            readOnly={readOnly}
          />
          <EditableList
            label="Conversion Events"
            items={sections.measurement.conversionEvents}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, conversionEvents: v })
            }
            placeholder="Add a conversion event..."
            readOnly={readOnly}
          />
          <EditableTextarea
            label="Reporting Cadence"
            value={sections.measurement.reportingCadence}
            onChange={(v) =>
              updateSection('measurement', { ...sections.measurement, reportingCadence: v })
            }
            placeholder="e.g., Weekly dashboards, Monthly reviews..."
            rows={1}
            readOnly={readOnly}
          />
        </div>
      </SectionCard>

      {/* Channel Mix Section */}
      <SectionCard
        title="Channel Mix"
        description="Budget allocation across channels"
        icon={<Layers className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.channelMix.length} channels
          </span>
        }
      >
        <ChannelMixEditor
          channels={sections.channelMix}
          onChange={(v) => updateSection('channelMix', v)}
          readOnly={readOnly}
        />
      </SectionCard>

      {/* Campaigns Section */}
      <SectionCard
        title="Campaigns"
        description="Specific campaign definitions"
        icon={<Target className="w-4 h-4" />}
        badge={
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-700/50 text-slate-400">
            {sections.campaigns.length} campaigns
          </span>
        }
      >
        <CampaignsEditor
          campaigns={sections.campaigns}
          onChange={(v) => updateSection('campaigns', v)}
          readOnly={readOnly}
        />
      </SectionCard>

      {/* Cadence Section */}
      <SectionCard
        title="Operational Cadence"
        description="Weekly and monthly activities"
        icon={<Calendar className="w-4 h-4" />}
      >
        <div className="space-y-4">
          <EditableList
            label="Weekly Activities"
            items={sections.cadence.weekly}
            onChange={(v) =>
              updateSection('cadence', { ...sections.cadence, weekly: v })
            }
            placeholder="Add weekly activity..."
            readOnly={readOnly}
          />
          <EditableList
            label="Monthly Activities"
            items={sections.cadence.monthly}
            onChange={(v) =>
              updateSection('cadence', { ...sections.cadence, monthly: v })
            }
            placeholder="Add monthly activity..."
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

export default MediaPlanEditor;
