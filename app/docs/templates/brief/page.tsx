'use client';

// /docs/templates/brief
// Program Brief template - printable document

import {
  HiveDocLayout,
  QuickOverview,
  NumberedSection,
  InfoCard,
  TwoColumnCards,
  NoteBox,
  DefinitionBox,
  DataTable,
} from '@/components/docs';
import { SAMPLE_BRIEF_DATA, type BriefDocData, type StakeholderData } from '@/lib/types/hiveDoc';

// Use sample data - in production, this would come from API/props
const data: BriefDocData = SAMPLE_BRIEF_DATA;

export default function BriefTemplatePage() {
  return (
    <HiveDocLayout meta={data.meta}>
      {/* Quick Overview */}
      <QuickOverview summary={data.quickOverview.summary} />

      {/* Section 1: KPIs */}
      <NumberedSection number={1} title="Key Performance Indicators">
        <DefinitionBox label={`Primary KPI: ${data.kpis.primary.name}`}>
          {data.kpis.primary.definition}
        </DefinitionBox>

        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Secondary Metrics</h4>
          <ul className="grid grid-cols-2 gap-2">
            {data.kpis.secondary.map((metric, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-[#CFA000] mt-0.5 flex-shrink-0">•</span>
                <span>{metric}</span>
              </li>
            ))}
          </ul>
        </div>
      </NumberedSection>

      {/* Section 2: Audiences */}
      <NumberedSection number={2} title="Target Audiences">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Primary Audiences</h4>
        <TwoColumnCards>
          {data.audiences.primary.map((audience) => (
            <InfoCard
              key={audience.name}
              title={audience.name}
              subtitle={audience.description}
              bullets={audience.signals}
            />
          ))}
        </TwoColumnCards>

        <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-3">Secondary Audiences</h4>
        <TwoColumnCards>
          {data.audiences.secondary.map((audience) => (
            <InfoCard
              key={audience.name}
              title={audience.name}
              subtitle={audience.description}
              bullets={audience.signals}
            />
          ))}
        </TwoColumnCards>
      </NumberedSection>

      {/* Section 3: Messaging */}
      <NumberedSection number={3} title="Messaging Framework">
        <p className="text-sm text-gray-600 mb-4">
          Key messaging pillars that guide creative development and ad copy.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
          {data.messaging.map((pillar) => (
            <InfoCard key={pillar.title} title={pillar.title} bullets={pillar.points} />
          ))}
        </div>
      </NumberedSection>

      {/* Section 4: Creative Requirements */}
      <NumberedSection number={4} title="Creative Requirements">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
          <InfoCard title="Required Assets" bullets={data.creativeRequirements.assets} />
          <InfoCard title="Format Specifications" bullets={data.creativeRequirements.formats} />
          <InfoCard title="Refresh Cadence" bullets={data.creativeRequirements.cadence} />
        </div>
      </NumberedSection>

      {/* Section 5: Channels */}
      <NumberedSection number={5} title="Channel Mix">
        <div className="no-break overflow-hidden border border-[#D9D9D9] rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-[#D9D9D9]">
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-1/4">
                  Channel
                </th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((channel, index) => (
                <tr
                  key={channel.name}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                >
                  <td className="px-4 py-2.5 text-gray-800 border-t border-gray-100 font-medium">
                    {channel.name}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 border-t border-gray-100">
                    {channel.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NumberedSection>

      {/* Section 6: Client Inputs Required */}
      <NumberedSection number={6} title="Required Client Inputs">
        <div className="no-break bg-gray-50 rounded-lg p-4 border border-[#D9D9D9]">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 print:grid-cols-2">
            {data.clientInputs.map((input, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-[#CFA000] mt-0.5 flex-shrink-0">☐</span>
                <span>{input}</span>
              </li>
            ))}
          </ul>
        </div>
        <NoteBox label="Reminder:">
          Please provide access credentials and materials before kickoff to ensure timely launch.
        </NoteBox>
      </NumberedSection>

      {/* Section 7: Stakeholders */}
      <NumberedSection number={7} title="Stakeholders & Approvals">
        <DataTable<StakeholderData>
          columns={[
            { header: 'Name', accessor: 'name', width: '20%' },
            { header: 'Role', accessor: 'role', width: '25%' },
            { header: 'Approval Area', accessor: 'approvalArea', width: '35%' },
            { header: 'SLA', accessor: 'sla', width: '20%' },
          ]}
          data={data.stakeholders}
        />
      </NumberedSection>
    </HiveDocLayout>
  );
}
