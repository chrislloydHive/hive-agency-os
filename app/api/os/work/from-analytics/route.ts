// app/api/os/work/from-analytics/route.ts
// Create a Work Item from an Analytics AI suggestion

import { NextRequest, NextResponse } from 'next/server';
import { base } from '@/lib/airtable/client';
import type { CompanyAnalyticsWorkSuggestion } from '@/lib/os/companies/analyticsTypes';
import type { WorkItemArea, WorkItemSeverity } from '@/lib/airtable/workItems';

// Field names matching Airtable schema
const WORK_ITEMS_FIELDS = {
  TITLE: 'Title',
  COMPANY: 'Company',
  AREA: 'Area',
  STATUS: 'Status',
  SEVERITY: 'Severity',
  NOTES: 'Notes',
} as const;

/**
 * Map analytics work area to Airtable Work Item area
 */
function mapAreaToWorkItemArea(area: CompanyAnalyticsWorkSuggestion['area']): WorkItemArea {
  const mapping: Record<CompanyAnalyticsWorkSuggestion['area'], WorkItemArea> = {
    website: 'Website UX',
    content: 'Content',
    seo: 'SEO',
    demand: 'Funnel',
    ops: 'Other',
    general: 'Other',
    other: 'Other',
  };
  return mapping[area] || 'Other';
}

/**
 * Map analytics priority to Airtable severity
 */
function mapPriorityToSeverity(priority: CompanyAnalyticsWorkSuggestion['priority']): WorkItemSeverity {
  const mapping: Record<CompanyAnalyticsWorkSuggestion['priority'], WorkItemSeverity> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return mapping[priority] || 'Medium';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, suggestion } = body as {
      companyId: string;
      suggestion: CompanyAnalyticsWorkSuggestion;
    };

    // Validate input
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!suggestion || !suggestion.title) {
      return NextResponse.json(
        { success: false, error: 'suggestion with title is required' },
        { status: 400 }
      );
    }

    console.log('[Work from Analytics] Creating work item:', {
      companyId,
      title: suggestion.title,
      area: suggestion.area,
      priority: suggestion.priority,
    });

    // Build notes
    const notesParts: string[] = [];
    notesParts.push('Created from Analytics AI Insight');
    if (suggestion.description) {
      notesParts.push(suggestion.description);
    }
    if (suggestion.reason) {
      notesParts.push(`Why: ${suggestion.reason}`);
    }
    if (suggestion.impact) {
      notesParts.push(`Expected Impact: ${suggestion.impact}`);
    }
    const notes = notesParts.join('\n\n');

    // Build Airtable fields
    const fields = {
      [WORK_ITEMS_FIELDS.TITLE]: suggestion.title,
      [WORK_ITEMS_FIELDS.COMPANY]: [companyId], // Link field - array of record IDs
      [WORK_ITEMS_FIELDS.AREA]: mapAreaToWorkItemArea(suggestion.area),
      [WORK_ITEMS_FIELDS.STATUS]: 'Planned',
      [WORK_ITEMS_FIELDS.SEVERITY]: mapPriorityToSeverity(suggestion.priority),
      [WORK_ITEMS_FIELDS.NOTES]: notes,
    };

    // Create the record in Airtable
    const records = await base('Work Items').create([{ fields }] as any);

    if (!records || records.length === 0) {
      throw new Error('No record returned from Airtable create');
    }

    const record = records[0];

    console.log('[Work from Analytics] Work item created successfully:', {
      workItemId: record.id,
      title: suggestion.title,
    });

    // Return success with the created work item
    return NextResponse.json({
      success: true,
      workItem: {
        id: record.id,
        title: suggestion.title,
        area: suggestion.area,
        status: 'Planned',
        priority: suggestion.priority,
      },
    });
  } catch (error) {
    console.error('[Work from Analytics] Error creating work item:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create work item',
      },
      { status: 500 }
    );
  }
}
