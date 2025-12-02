// app/api/os/work/route.ts
// Create a Work Item from Blueprint recommendations

import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable/client';
import type { WorkItemArea, WorkItemSeverity, WorkItemStatus } from '@/lib/airtable/workItems';

// Field names matching Airtable schema
const WORK_ITEMS_FIELDS = {
  TITLE: 'Title',
  COMPANY: 'Company',
  AREA: 'Area',
  STATUS: 'Status',
  SEVERITY: 'Severity',
  NOTES: 'Notes',
} as const;

interface CreateWorkItemBody {
  title: string;
  notes?: string;
  companyId: string;
  area?: string;
  severity?: string;
  status?: string;
  source?: {
    sourceType: string;
    [key: string]: unknown;
  };
}

/**
 * Map area string to WorkItemArea
 */
function mapToWorkItemArea(area?: string): WorkItemArea {
  const mapping: Record<string, WorkItemArea> = {
    'Strategy': 'Strategy',
    'Website UX': 'Website UX',
    'Brand': 'Brand',
    'Content': 'Content',
    'SEO': 'SEO',
    'Funnel': 'Funnel',
    'Other': 'Other',
    // Additional mappings
    'Website': 'Website UX',
    'Demand': 'Funnel',
    'General': 'Other',
  };
  return mapping[area || ''] || 'Other';
}

/**
 * Map severity string to WorkItemSeverity
 */
function mapToSeverity(severity?: string): WorkItemSeverity {
  const mapping: Record<string, WorkItemSeverity> = {
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low',
  };
  return mapping[severity || ''] || 'Medium';
}

/**
 * Map status string to WorkItemStatus
 */
function mapToStatus(status?: string): WorkItemStatus {
  const mapping: Record<string, WorkItemStatus> = {
    'Backlog': 'Backlog',
    'Planned': 'Planned',
    'In Progress': 'In Progress',
    'Done': 'Done',
  };
  return mapping[status || ''] || 'Planned';
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateWorkItemBody = await request.json();
    const { title, notes, companyId, area, severity, status, source } = body;

    // Validate input
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 }
      );
    }

    console.log('[Work] Creating work item:', {
      companyId,
      title,
      area,
      severity,
      source: source?.sourceType,
    });

    // Build notes with source attribution
    const notesParts: string[] = [];

    if (source?.sourceType) {
      const sourceLabels: Record<string, string> = {
        'blueprint_tool_recommendation': 'Created from Blueprint Tool Recommendation',
        'blueprint_focus_area': 'Created from Blueprint Focus Area',
        'blueprint': 'Created from Blueprint',
        'analytics': 'Created from Analytics AI Insight',
      };
      notesParts.push(sourceLabels[source.sourceType] || `Created from ${source.sourceType}`);
    }

    if (notes) {
      notesParts.push(notes);
    }

    const finalNotes = notesParts.join('\n\n');

    // Build Airtable fields
    const fields = {
      [WORK_ITEMS_FIELDS.TITLE]: title,
      [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
      [WORK_ITEMS_FIELDS.AREA]: mapToWorkItemArea(area),
      [WORK_ITEMS_FIELDS.STATUS]: mapToStatus(status),
      [WORK_ITEMS_FIELDS.SEVERITY]: mapToSeverity(severity),
      [WORK_ITEMS_FIELDS.NOTES]: finalNotes,
    };

    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }] as any);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work] Work item created successfully:', {
      workItemId: record.id,
      title,
    });

    // Return success with the created work item
    return NextResponse.json({
      success: true,
      id: record.id,
      workItem: {
        id: record.id,
        title,
        area: mapToWorkItemArea(area),
        status: mapToStatus(status),
        severity: mapToSeverity(severity),
      },
    });
  } catch (error) {
    console.error('[Work] Error creating work item:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create work item',
      },
      { status: 500 }
    );
  }
}
