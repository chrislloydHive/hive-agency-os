// app/api/analytics/[companyId]/create-work-from-metric/route.ts
// API Route: Create a Work item from a metric-based suggestion
//
// Takes a metric configuration and AI suggestion, creates a Work item
// in Airtable with the full implementation guide and source tracking.

import { NextRequest, NextResponse } from 'next/server';
import { createWorkItemFromAnalytics } from '@/lib/airtable/workItems';
import type { AnalyticsMetricConfig } from '@/lib/analytics/blueprintTypes';
import type { MetricWorkSuggestion, WorkSourceAnalytics } from '@/lib/types/work';

export const runtime = 'nodejs';
export const maxDuration = 15;

interface CreateWorkFromMetricRequest {
  metric: AnalyticsMetricConfig;
  suggestion: MetricWorkSuggestion;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json() as CreateWorkFromMetricRequest;
    const { metric, suggestion } = body;

    // Validate required fields
    if (!metric || !metric.id || !metric.label) {
      return NextResponse.json(
        { ok: false, error: 'Missing required metric configuration' },
        { status: 400 }
      );
    }

    if (!suggestion || !suggestion.title || !suggestion.howToImplement) {
      return NextResponse.json(
        { ok: false, error: 'Missing required suggestion fields' },
        { status: 400 }
      );
    }

    console.log('[Create Work from Metric] Creating work item:', {
      companyId,
      metricId: metric.id,
      metricLabel: metric.label,
      suggestionTitle: suggestion.title,
    });

    // Build the full description with all sections
    const descriptionParts: string[] = [];

    // Summary
    if (suggestion.summary) {
      descriptionParts.push(suggestion.summary);
    }

    // How to Implement
    descriptionParts.push('\n## How to Implement\n');
    descriptionParts.push(suggestion.howToImplement);

    // Expected Impact
    if (suggestion.expectedImpact) {
      descriptionParts.push('\n## Expected Impact\n');
      descriptionParts.push(suggestion.expectedImpact);
    }

    // Source reference
    descriptionParts.push('\n---\n');
    descriptionParts.push(`*Created from Analytics: ${metric.label} (${metric.source.toUpperCase()})*`);

    const description = descriptionParts.join('\n');

    // Build the source object
    const source: WorkSourceAnalytics = {
      sourceType: 'analytics_metric',
      companyId,
      metricId: metric.id,
      metricLabel: metric.label,
      metricGroup: metric.group,
    };

    // Create the work item
    const workItem = await createWorkItemFromAnalytics({
      companyId,
      title: suggestion.title,
      description,
      source,
      defaultStatus: suggestion.suggestedStatus || 'Backlog',
    });

    console.log('[Create Work from Metric] Work item created:', {
      workItemId: workItem.id,
      title: workItem.title,
      status: workItem.status,
      area: workItem.area,
    });

    return NextResponse.json({
      ok: true,
      workItem: {
        id: workItem.id,
        title: workItem.title,
        status: workItem.status,
        area: workItem.area,
        companyId: workItem.companyId,
      },
    });
  } catch (error) {
    console.error('[Create Work from Metric] Error:', error);

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
