// lib/os/folders/structure.ts
// Canonical Google Drive folder structure definitions (v1)

export type FolderNode = {
  key: string;
  name: string;
  children?: FolderNode[];
};

export const FOLDER_STRUCTURE_VERSION = 'v1';

// Client root structure under WORK ROOT/{Client Name}
export const CLIENT_FOLDER_STRUCTURE: FolderNode[] = [
  {
    key: '00_admin',
    name: '00_Admin',
    children: [
      { key: '00_admin_contacts', name: 'Contacts' },
      { key: '00_admin_access', name: 'Access & Credentials' },
      { key: '00_admin_billing', name: 'Billing' },
      { key: '00_admin_meeting_notes', name: 'Meeting Notes' },
    ],
  },
  {
    key: '01_contracts',
    name: '01_Contracts',
    children: [
      { key: '01_contracts_msa', name: 'Master Services Agreement' },
      { key: '01_contracts_sow', name: 'Statements of Work' },
      { key: '01_contracts_change_orders', name: 'Change Orders' },
      { key: '01_contracts_amendments', name: 'Amendments' },
    ],
  },
  {
    key: '02_strategy',
    name: '02_Strategy',
    children: [
      { key: '02_strategy_context', name: 'Context & Discovery' },
      { key: '02_strategy_journey', name: 'Customer Journey' },
      { key: '02_strategy_media', name: 'Media Strategy' },
      { key: '02_strategy_creative', name: 'Creative Strategy' },
      { key: '02_strategy_planning', name: 'Planning & Roadmaps' },
      { key: '02_strategy_qbrs', name: 'QBRs' },
    ],
  },
  { key: '03_programs', name: '03_Programs' },
  {
    key: '04_creative',
    name: '04_Creative',
    children: [
      { key: '04_creative_guidelines', name: 'Brand Guidelines' },
      { key: '04_creative_core_assets', name: 'Core Assets' },
      { key: '04_creative_photography', name: 'Photography' },
      { key: '04_creative_video', name: 'Video' },
      { key: '04_creative_templates', name: 'Templates' },
    ],
  },
  {
    key: '05_media',
    name: '05_Media',
    children: [
      { key: '05_media_playbooks', name: 'Channel Playbooks' },
      { key: '05_media_platform_docs', name: 'Platform Docs' },
      { key: '05_media_calendars', name: 'Promotion Calendars' },
      { key: '05_media_test_logs', name: 'Test Logs' },
    ],
  },
  {
    key: '06_analytics',
    name: '06_Analytics',
    children: [
      { key: '06_analytics_dashboards', name: 'Dashboards' },
      { key: '06_analytics_reports', name: 'Reports' },
      { key: '06_analytics_foot_traffic', name: 'Foot Traffic Analysis' },
      { key: '06_analytics_attribution', name: 'Attribution Models' },
    ],
  },
  {
    key: '07_deliverables',
    name: '07_Deliverables',
    children: [
      { key: '07_deliverables_presentations', name: 'Presentations' },
      { key: '07_deliverables_reports', name: 'Reports' },
      { key: '07_deliverables_strategy_docs', name: 'Strategy Docs' },
      { key: '07_deliverables_creative_exports', name: 'Creative Exports' },
    ],
  },
  {
    key: '08_archive',
    name: '08_Archive',
    children: [
      { key: '08_archive_old_programs', name: 'Old Programs' },
      { key: '08_archive_superseded', name: 'Superseded Docs' },
      { key: '08_archive_deprecated', name: 'Deprecated Assets' },
    ],
  },
];

// Program sub-structure under 03_Programs/{Program Name}
export const PROGRAM_FOLDER_STRUCTURE: FolderNode[] = [
  { key: 'program_00_admin', name: '00_Admin' },
  { key: 'program_01_brief', name: '01_Brief' },
  { key: 'program_02_timeline', name: '02_Timeline' },
  { key: 'program_03_creative', name: '03_Creative' },
  { key: 'program_04_media', name: '04_Media' },
  { key: 'program_05_analytics', name: '05_Analytics' },
  { key: 'program_06_reporting', name: '06_Reporting' },
  { key: 'program_07_archive', name: '07_Archive' },
];

export function flattenStructure(nodes: FolderNode[]): FolderNode[] {
  const result: FolderNode[] = [];
  const walk = (arr: FolderNode[]) => {
    for (const node of arr) {
      result.push(node);
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

