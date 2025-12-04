// app/api/context-graph/[companyId]/edit/route.ts
// API route for editing context graph fields

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { createEmptyContextGraph } from '@/lib/contextGraph/companyContextGraph';
import { createProvenance, ProvenanceSource } from '@/lib/contextGraph/mutate';
import { getFieldEditability } from '@/lib/contextGraph/editability';
import { calculateGraphSummary, formatSummaryForLog } from '@/lib/contextGraph/sectionSummary';
import type { ProvenanceTag } from '@/lib/contextGraph/types';

interface EditRequestBody {
  path: string;
  value: unknown;
  action: 'edit' | 'clear';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Validate request body
    const body: EditRequestBody = await request.json();
    const { path, value, action } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'Path is required' },
        { status: 400 }
      );
    }

    if (!action || !['edit', 'clear'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be "edit" or "clear"' },
        { status: 400 }
      );
    }

    // Check field editability before proceeding
    const { editable, reason } = getFieldEditability(path);
    if (!editable) {
      return NextResponse.json(
        { error: reason || 'Field is read-only and cannot be edited.' },
        { status: 400 }
      );
    }

    // Load company to get name
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load or create context graph
    let graph = await loadContextGraph(companyId);
    if (!graph) {
      graph = createEmptyContextGraph(companyId, company.name);
    }

    // Parse path (e.g., "identity.businessName" -> ["identity", "businessName"])
    const pathParts = path.split('.');
    if (pathParts.length < 2) {
      return NextResponse.json(
        { error: 'Path must be in format "domain.field" or deeper' },
        { status: 400 }
      );
    }

    // Navigate to the field
    let current: unknown = graph;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return NextResponse.json(
          { error: `Path not found: ${pathParts.slice(0, i + 1).join('.')}` },
          { status: 400 }
        );
      }
    }

    // Get the final field
    const fieldName = pathParts[pathParts.length - 1];
    if (!current || typeof current !== 'object' || !(fieldName in (current as Record<string, unknown>))) {
      return NextResponse.json(
        { error: `Field not found: ${path}` },
        { status: 400 }
      );
    }

    const fieldData = (current as Record<string, unknown>)[fieldName] as {
      value: unknown;
      provenance: ProvenanceTag[];
    };

    // Validate it's a WithMeta field
    if (!fieldData || typeof fieldData !== 'object' || !('provenance' in fieldData)) {
      return NextResponse.json(
        { error: 'Target is not a valid context graph field' },
        { status: 400 }
      );
    }

    // Create provenance tag for this edit
    const source: ProvenanceSource = action === 'edit' ? 'manual' : 'manual';
    const provenance = createProvenance(source, {
      confidence: 1.0,
      notes: action === 'edit' ? 'Manual edit via Context Graph UI' : 'Manual clear via Context Graph UI',
    });

    // Update the field
    const newValue = action === 'clear' ? null : value;

    // Check if this is an array field being cleared
    const isArrayField = Array.isArray(fieldData.value);
    if (action === 'clear' && isArrayField) {
      (current as Record<string, unknown>)[fieldName] = {
        value: [],
        provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
      };
    } else {
      (current as Record<string, unknown>)[fieldName] = {
        value: newValue,
        provenance: [provenance, ...fieldData.provenance.slice(0, 4)],
      };
    }

    // Update graph metadata
    graph.meta.updatedAt = new Date().toISOString();

    // Save the graph with source tracking
    const saved = await saveContextGraph(graph, 'manual');
    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save context graph' },
        { status: 500 }
      );
    }

    // Calculate and log summary for debugging
    const summary = calculateGraphSummary(graph);
    console.log(`[Context Graph Edit] ${action} ${path}`);
    console.log(formatSummaryForLog(summary));

    // Return the updated graph with summary
    return NextResponse.json({
      success: true,
      path,
      action,
      graph: saved.graph,
      summary: {
        health: Math.round(summary.health * 100),
        completeness: Math.round(summary.completeness * 100),
        totalPopulated: summary.totalPopulated,
        totalFields: summary.totalFields,
      },
    });
  } catch (error) {
    console.error('[Context Graph Edit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to edit context graph' },
      { status: 500 }
    );
  }
}
