'use client';

// /docs/templates/project-timeline
// Project Timeline template - printable document

import {
  HiveDocLayout,
  NumberedSection,
  NoteBox,
  DataTable,
} from '@/components/docs';
import {
  SAMPLE_PROJECT_TIMELINE_DATA,
  type ProjectTimelineDocData,
  type TimelineRowData,
} from '@/lib/types/hiveDoc';

// Use sample data - in production, this would come from API/props
const data: ProjectTimelineDocData = SAMPLE_PROJECT_TIMELINE_DATA;

export default function ProjectTimelineTemplatePage() {
  return (
    <HiveDocLayout meta={data.meta}>
      {/* Intro Section */}
      <div className="my-8 text-sm text-gray-700 leading-relaxed">
        <p>
          This timeline outlines the key phases, milestones, and responsibilities for the
          project. Dates and durations are estimates and may adjust based on approvals,
          dependencies, or scope changes. The purpose of this document is to provide
          visibility and alignment between Hive and the client throughout the engagement.
        </p>
      </div>

      {/* Section 1: Project Overview */}
      <NumberedSection number={1} title="Project Overview">
        <div className="no-break overflow-hidden border border-[#D9D9D9] rounded-lg">
          <table className="w-full text-sm">
            <tbody>
              <OverviewRow label="Project Name" value={data.overview.projectName} />
              <OverviewRow label="Client" value={data.overview.clientName} isAlt />
              <OverviewRow label="Project Owner" value={data.overview.projectOwner} />
              <OverviewRow label="Start Date" value={data.overview.startDate} isAlt />
              <OverviewRow label="Target Completion" value={data.overview.targetCompletion} />
              <OverviewRow label="Status" value={data.overview.status} isAlt isLast />
            </tbody>
          </table>
        </div>
      </NumberedSection>

      {/* Section 2: Timeline at a Glance */}
      <NumberedSection number={2} title="Timeline at a Glance">
        <ul className="space-y-2">
          {data.phasesAtGlance.map((phase, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-[#CFA000] mt-0.5 flex-shrink-0">-</span>
              <span>
                <strong>{phase.name}</strong>{' '}
                <span className="text-gray-500">({phase.duration})</span>
              </span>
            </li>
          ))}
        </ul>
      </NumberedSection>

      {/* Section 3: Detailed Timeline */}
      <NumberedSection number={3} title="Detailed Timeline">
        <DataTable<TimelineRowData>
          columns={[
            { header: 'Phase', accessor: 'phase', width: '10%' },
            { header: 'Task / Milestone', accessor: 'task', width: '18%' },
            { header: 'Description', accessor: 'description', width: '25%' },
            { header: 'Owner', accessor: 'owner', width: '12%' },
            { header: 'Est. Duration', accessor: 'duration', width: '12%' },
            { header: 'Dependencies / Notes', accessor: 'dependencies', width: '23%' },
          ]}
          data={data.detailedTimeline}
        />
      </NumberedSection>

      {/* Section 4: Client Responsibilities & Dependencies */}
      <NumberedSection number={4} title="Client Responsibilities & Dependencies">
        <ul className="space-y-2">
          {data.clientResponsibilities.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-[#CFA000] mt-0.5 flex-shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </NumberedSection>

      {/* Section 5: Assumptions & Notes */}
      <NumberedSection number={5} title="Assumptions & Notes">
        <ul className="space-y-2">
          {data.assumptions.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-[#CFA000] mt-0.5 flex-shrink-0">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </NumberedSection>

      {/* Section 6: Change Management */}
      <NumberedSection number={6} title="Change Management">
        <p className="text-sm text-gray-700 leading-relaxed">{data.changeManagementNote}</p>
      </NumberedSection>

      {/* Last Updated */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-400 italic">
        Last Updated: [Date]
      </div>
    </HiveDocLayout>
  );
}

// ============================================================================
// Overview Row Component
// ============================================================================

interface OverviewRowProps {
  label: string;
  value: string;
  isAlt?: boolean;
  isLast?: boolean;
}

function OverviewRow({ label, value, isAlt, isLast }: OverviewRowProps) {
  return (
    <tr className={isAlt ? 'bg-gray-50/50' : 'bg-white'}>
      <td
        className={`px-4 py-2.5 text-gray-700 font-medium w-1/3 ${
          !isLast ? 'border-b border-gray-100' : ''
        }`}
      >
        {label}
      </td>
      <td
        className={`px-4 py-2.5 text-gray-600 ${!isLast ? 'border-b border-gray-100' : ''}`}
      >
        {value}
      </td>
    </tr>
  );
}
