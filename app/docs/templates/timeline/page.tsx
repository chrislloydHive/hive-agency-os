'use client';

// /docs/templates/timeline
// Program Timeline template - printable document

import {
  HiveDocLayout,
  QuickOverview,
  NumberedSection,
  InfoCard,
  ThreeColumnCards,
  TwoColumnCards,
  NoteBox,
  MilestoneTable,
} from '@/components/docs';
import { SAMPLE_TIMELINE_DATA, type TimelineDocData } from '@/lib/types/hiveDoc';

// Use sample data - in production, this would come from API/props
const data: TimelineDocData = SAMPLE_TIMELINE_DATA;

export default function TimelineTemplatePage() {
  return (
    <HiveDocLayout meta={data.meta}>
      {/* Quick Overview */}
      <QuickOverview summary={data.quickOverview.summary} />

      {/* Section 1: Phases */}
      <NumberedSection number={1} title="Phases">
        <p className="text-sm text-gray-600 mb-4">
          The program is structured into three distinct phases, each with clear objectives,
          actions, and outputs.
        </p>
        <ThreeColumnCards>
          {data.phases.map((phase) => (
            <PhaseCard key={phase.name} phase={phase} />
          ))}
        </ThreeColumnCards>
      </NumberedSection>

      {/* Section 2: Operating Cadences */}
      <NumberedSection number={2} title="Operating Cadences">
        <p className="text-sm text-gray-600 mb-4">
          Regular touchpoints ensure alignment and enable continuous optimization.
        </p>
        <ThreeColumnCards>
          {data.cadences.map((cadence) => (
            <InfoCard key={cadence.name} title={cadence.name} bullets={cadence.items} />
          ))}
        </ThreeColumnCards>
      </NumberedSection>

      {/* Section 3: Milestones */}
      <NumberedSection number={3} title="Key Milestones">
        <p className="text-sm text-gray-600 mb-4">
          Critical checkpoints that mark progress through the program.
        </p>
        <MilestoneTable milestones={data.milestones} />
      </NumberedSection>

      {/* Section 4: Dependencies */}
      <NumberedSection number={4} title="Dependencies">
        <p className="text-sm text-gray-600 mb-4">
          Clear ownership of inputs and outputs ensures smooth execution.
        </p>
        <TwoColumnCards>
          <InfoCard
            title="Client Provides"
            subtitle="Required inputs from client team"
            bullets={data.dependencies.clientInputs}
          />
          <InfoCard
            title="Hive Delivers"
            subtitle="Outputs from Hive team"
            bullets={data.dependencies.hiveOutputs}
          />
        </TwoColumnCards>
        {data.dependencies.note && <NoteBox>{data.dependencies.note}</NoteBox>}
      </NumberedSection>
    </HiveDocLayout>
  );
}

// ============================================================================
// Phase Card Component
// ============================================================================

interface PhaseCardProps {
  phase: TimelineDocData['phases'][number];
}

function PhaseCard({ phase }: PhaseCardProps) {
  return (
    <div className="no-break border border-[#D9D9D9] rounded-lg bg-white overflow-hidden">
      {/* Phase Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-[#D9D9D9]">
        <h3 className="text-sm font-semibold text-gray-800">{phase.name}</h3>
        <p className="text-xs text-gray-500">{phase.duration}</p>
      </div>

      {/* Phase Content */}
      <div className="p-4 space-y-4">
        {/* Objectives */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Objectives
          </h4>
          <ul className="space-y-1">
            {phase.objectives.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-[#CFA000] mt-0.5 flex-shrink-0">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Key Actions */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Key Actions
          </h4>
          <ul className="space-y-1">
            {phase.keyActions.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-[#CFA000] mt-0.5 flex-shrink-0">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Outputs */}
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Outputs
          </h4>
          <ul className="space-y-1">
            {phase.outputs.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-[#CFA000] mt-0.5 flex-shrink-0">•</span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
