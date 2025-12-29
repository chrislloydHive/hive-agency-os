// app/api/os/companies/[companyId]/context/integrity/route.ts
// Context Graph Integrity API
//
// GET: Check context graph integrity and return health summary
// Returns conflicts, stale fields, missing critical fields, and recommendations

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import {
  getDetailedIntegrityCheck,
  healthToDataSource,
  generateHealthReport,
} from '@/lib/os/context';
import type { FieldProvenance } from '@/lib/os/context/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map source string to ContextSource type
 */
function mapToContextSource(source: string | undefined): 'user' | 'ai-inferred' | 'scrape' | 'api' | 'import' | 'default' {
  const validSources = ['user', 'ai-inferred', 'scrape', 'api', 'import', 'default'] as const;
  const normalized = source?.toLowerCase() || 'default';
  return validSources.includes(normalized as typeof validSources[number])
    ? (normalized as typeof validSources[number])
    : 'default';
}

/**
 * Extract provenance data from context graph meta
 */
function extractProvenanceMap(
  graphMeta: Record<string, unknown> | undefined
): Record<string, Omit<FieldProvenance, 'fieldPath'>> {
  const provenanceMap: Record<string, Omit<FieldProvenance, 'fieldPath'>> = {};

  if (!graphMeta) return provenanceMap;

  // Extract provenance from field updates in meta
  const fieldUpdates = graphMeta.fieldUpdates as Record<string, unknown> | undefined;
  if (fieldUpdates) {
    for (const [fieldPath, updateData] of Object.entries(fieldUpdates)) {
      if (updateData && typeof updateData === 'object') {
        const update = updateData as Record<string, unknown>;
        provenanceMap[fieldPath] = {
          value: update.value,
          source: mapToContextSource(update.source as string | undefined),
          setAt: update.timestamp as string || new Date().toISOString(),
          confidence: (update.confidence as number) || 70,
          locked: false,
          history: [],
        };
      }
    }
  }

  return provenanceMap;
}

/**
 * Convert context graph to flat context data object
 */
function flattenContextGraph(graph: Record<string, unknown>): unknown {
  const contextData: Record<string, unknown> = {};

  // Helper to flatten nested objects
  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      // Skip meta fields
      if (key === 'meta' || key === 'companyId' || key === '_id') continue;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, path);
      } else if (value !== undefined && value !== null && value !== '') {
        contextData[path] = value;
      }
    }
  }

  flatten(graph);
  return contextData;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json({
        success: true,
        hasGraph: false,
        health: null,
        message: 'No context graph found for this company',
      });
    }

    // Extract provenance map from graph meta
    const provenanceMap = extractProvenanceMap(graph.meta);

    // Flatten graph to context data
    const contextData = flattenContextGraph(graph as Record<string, unknown>);

    // Run detailed integrity check
    const integrityResult = getDetailedIntegrityCheck(contextData, provenanceMap);

    // Convert health to data source format for DataConfidenceBadge
    const dataSource = healthToDataSource(integrityResult.health);

    // Generate text report
    const report = generateHealthReport(integrityResult.health);

    // Build response
    return NextResponse.json({
      success: true,
      hasGraph: true,
      health: integrityResult.health,
      missingFields: integrityResult.missingFields,
      staleFields: integrityResult.staleFields,
      conflicts: integrityResult.conflicts,
      recommendations: integrityResult.recommendations,
      dataSource,
      report,
      stats: {
        totalFields: Object.keys(contextData as Record<string, unknown>).length,
        provenanceTracked: Object.keys(provenanceMap).length,
        conflictCount: integrityResult.conflicts.length,
        staleCount: integrityResult.staleFields.length,
        missingCount: integrityResult.missingFields.length,
      },
    });
  } catch (error) {
    console.error('[Context Integrity API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check context integrity',
      },
      { status: 500 }
    );
  }
}
