// app/api/os/context/canonicalize/route.ts
// Context Canonicalization API
//
// POST: Clean up legacy non-canonical context data for a company
//
// This is a migration tool that:
// 1. Identifies nodes with deprecated field keys
// 2. Reports them (mode=audit)
// 3. Soft-deletes them by clearing values (mode=soft)
// 4. Hard-deletes them (mode=hard)
//
// SAFE: Always run with mode=audit first to see what will be affected

import { NextRequest, NextResponse } from 'next/server';
import { loadContextGraph, saveContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import { REMOVED_FIELDS, isRemovedField } from '@/lib/contextGraph/unifiedRegistry';
import { isDeprecatedDomain, type CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

// ============================================================================
// Types
// ============================================================================

interface CanonicalizeRequest {
  companyId: string;
  mode: 'audit' | 'soft' | 'hard';
}

interface AffectedField {
  path: string;
  reason: string;
  hasValue: boolean;
  valuePreview?: string;
}

interface CanonicalizeResult {
  companyId: string;
  mode: string;
  affectedFields: AffectedField[];
  totalAffected: number;
  action: string;
  timestamp: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Recursively find all paths in the graph that match removed fields
 */
function findAffectedPaths(
  obj: unknown,
  currentPath: string,
  results: AffectedField[]
): void {
  if (!obj || typeof obj !== 'object') return;

  const record = obj as Record<string, unknown>;

  // Check if current path is a removed field
  if (isRemovedField(currentPath)) {
    const isWithMeta = 'value' in record && 'provenance' in record;
    const value = isWithMeta ? record.value : record;
    const hasValue = value !== null && value !== undefined &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === 'string' && value.trim() === '');

    let valuePreview: string | undefined;
    if (hasValue) {
      if (typeof value === 'string') {
        valuePreview = value.slice(0, 50) + (value.length > 50 ? '...' : '');
      } else if (typeof value === 'number') {
        valuePreview = String(value);
      } else if (Array.isArray(value)) {
        valuePreview = `[${value.length} items]`;
      } else {
        valuePreview = '[object]';
      }
    }

    results.push({
      path: currentPath,
      reason: getRemovalReason(currentPath),
      hasValue,
      valuePreview,
    });
    return;
  }

  // Check if in deprecated domain
  const domain = currentPath.split('.')[0];
  if (isDeprecatedDomain(domain)) {
    // Check all fields in deprecated domains
    for (const [key, value] of Object.entries(record)) {
      if (key === 'value' || key === 'provenance') continue;
      findAffectedPaths(value, currentPath ? `${currentPath}.${key}` : key, results);
    }
    return;
  }

  // Recurse into nested objects
  for (const [key, value] of Object.entries(record)) {
    if (key === 'value' || key === 'provenance' || key === 'meta') continue;
    if (typeof value === 'object' && value !== null) {
      findAffectedPaths(value, currentPath ? `${currentPath}.${key}` : key, results);
    }
  }
}

/**
 * Get human-readable reason for why a field was removed
 */
function getRemovalReason(path: string): string {
  if (path.startsWith('objectives.')) {
    return 'Objectives belong in Strategy, not Context';
  }
  // Competitive synthesis fields
  if (path.startsWith('competitive.positionSummary') ||
      path.startsWith('competitive.competitiveAdvantages') ||
      path.startsWith('competitive.overallThreatLevel') ||
      path.startsWith('competitive.primaryAxis') ||
      path.startsWith('competitive.secondaryAxis') ||
      path.startsWith('competitive.whitespaceOpportunities') ||
      path.startsWith('competitive.competitiveOpportunities') ||
      path.startsWith('competitive.competitiveThreats')) {
    return 'Competitive synthesis belongs in Strategy/Labs, not Context';
  }
  if (path.includes('Score') || path.includes('score')) {
    return 'Scores belong in Diagnostics, not Context';
  }
  if (path.startsWith('website.') || path.startsWith('content.') || path.startsWith('seo.')) {
    return 'Evaluations/status belong in Diagnostics, not Context';
  }
  if (path.startsWith('brand.healthScore') || path.startsWith('brand.dimensionScores')) {
    return 'Derived diagnostic outputs (non-canonical context)';
  }
  return 'Field removed per canonicalization doctrine';
}

/**
 * Clear values for affected paths (soft delete)
 */
function softDeletePaths(
  graph: CompanyContextGraph,
  paths: string[]
): CompanyContextGraph {
  const copy = JSON.parse(JSON.stringify(graph)) as CompanyContextGraph;

  for (const path of paths) {
    const parts = path.split('.');
    let current: unknown = copy;

    // Navigate to parent
    for (let i = 0; i < parts.length - 1; i++) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[parts[i]];
      }
    }

    // Clear the value
    if (current && typeof current === 'object') {
      const lastKey = parts[parts.length - 1];
      const target = (current as Record<string, unknown>)[lastKey];

      if (target && typeof target === 'object') {
        const meta = target as Record<string, unknown>;
        if ('value' in meta) {
          // It's a WithMeta - clear value but keep provenance
          meta.value = null;
          // Add deprecation note to provenance
          if (Array.isArray(meta.provenance)) {
            meta.provenance.unshift({
              source: 'system',
              updatedAt: new Date().toISOString(),
              notes: 'Cleared by canonicalization - field deprecated',
            });
          }
        } else {
          // Direct object - replace with empty
          (current as Record<string, unknown>)[lastKey] = null;
        }
      }
    }
  }

  return copy;
}

/**
 * Hard delete - completely remove deprecated domains and fields from the graph
 */
function hardDeletePaths(
  graph: CompanyContextGraph,
  affectedFields: AffectedField[]
): CompanyContextGraph {
  const copy = JSON.parse(JSON.stringify(graph)) as CompanyContextGraph;

  // Group affected fields by domain
  const deprecatedDomains = new Set<string>();
  const specificFields = new Map<string, Set<string>>();

  for (const field of affectedFields) {
    const parts = field.path.split('.');
    const domain = parts[0];

    // Check if entire domain is deprecated
    if (isDeprecatedDomain(domain)) {
      deprecatedDomains.add(domain);
    } else if (parts.length > 1) {
      // Specific field in non-deprecated domain
      if (!specificFields.has(domain)) {
        specificFields.set(domain, new Set());
      }
      specificFields.get(domain)!.add(parts.slice(1).join('.'));
    }
  }

  // Remove entire deprecated domains by resetting them to empty state
  for (const domain of deprecatedDomains) {
    const domainObj = copy[domain as keyof CompanyContextGraph];
    if (domainObj && typeof domainObj === 'object') {
      // Clear all fields in the domain
      for (const key of Object.keys(domainObj as Record<string, unknown>)) {
        const field = (domainObj as Record<string, unknown>)[key];
        if (field && typeof field === 'object' && 'value' in field) {
          (field as Record<string, unknown>).value = null;
        }
      }
    }
  }

  // Remove specific fields from non-deprecated domains
  for (const [domain, fields] of specificFields) {
    const domainObj = copy[domain as keyof CompanyContextGraph];
    if (domainObj && typeof domainObj === 'object') {
      for (const fieldPath of fields) {
        const parts = fieldPath.split('.');
        let current: unknown = domainObj;

        // Navigate to parent
        for (let i = 0; i < parts.length - 1; i++) {
          if (current && typeof current === 'object') {
            current = (current as Record<string, unknown>)[parts[i]];
          }
        }

        // Delete the field
        if (current && typeof current === 'object') {
          const lastKey = parts[parts.length - 1];
          const target = (current as Record<string, unknown>)[lastKey];

          if (target && typeof target === 'object' && 'value' in target) {
            // WithMeta - set value to null
            (target as Record<string, unknown>).value = null;
          } else {
            // Delete the key entirely
            delete (current as Record<string, unknown>)[lastKey];
          }
        }
      }
    }
  }

  return copy;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CanonicalizeRequest;
    const { companyId, mode } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    if (!mode || !['audit', 'soft', 'hard'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Use: audit, soft, or hard' },
        { status: 400 }
      );
    }

    // Verify company exists
    const company = await getCompanyById(companyId);
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Load context graph
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json({
        companyId,
        mode,
        affectedFields: [],
        totalAffected: 0,
        action: 'No context graph found',
        timestamp: new Date().toISOString(),
      });
    }

    // Find all affected paths
    const affectedFields: AffectedField[] = [];

    // Check each deprecated domain
    for (const domain of ['objectives', 'website', 'content', 'seo'] as const) {
      if (graph[domain]) {
        findAffectedPaths(graph[domain], domain, affectedFields);
      }
    }

    // Check for ALL removed fields in competitive domain (synthesis outputs)
    if (graph.competitive) {
      const competitiveSynthesisFields = [
        'positionSummary',
        'competitiveAdvantages',
        'overallThreatLevel',
        'primaryAxis',
        'secondaryAxis',
        'whitespaceOpportunities',
        'competitiveOpportunities',
        'competitiveThreats',
      ];
      for (const field of competitiveSynthesisFields) {
        const fullPath = `competitive.${field}`;
        const fieldData = (graph.competitive as Record<string, unknown>)[field];
        if (fieldData) {
          // Check if it has a value (could be WithMeta or direct)
          const hasValue = fieldData && (
            (typeof fieldData === 'object' && 'value' in fieldData && (fieldData as any).value !== null) ||
            (typeof fieldData !== 'object')
          );
          if (hasValue) {
            affectedFields.push({
              path: fullPath,
              reason: 'Competitive synthesis belongs in Strategy/Labs, not Context',
              hasValue: true,
              valuePreview: '[exists]',
            });
          }
        }
      }
    }

    // Check for removed brand fields (derived diagnostic outputs)
    if (graph.brand) {
      const brandDiagnosticFields = ['healthScore', 'dimensionScores'];
      for (const field of brandDiagnosticFields) {
        const fullPath = `brand.${field}`;
        const fieldData = (graph.brand as Record<string, unknown>)[field];
        if (fieldData) {
          const hasValue = fieldData && (
            (typeof fieldData === 'object' && 'value' in fieldData && (fieldData as any).value !== null) ||
            (typeof fieldData !== 'object')
          );
          if (hasValue) {
            affectedFields.push({
              path: fullPath,
              reason: 'Derived diagnostic outputs (non-canonical context)',
              hasValue: true,
              valuePreview: '[exists]',
            });
          }
        }
      }
    }

    const fieldsWithValues = affectedFields.filter(f => f.hasValue);

    // Build result
    const result: CanonicalizeResult = {
      companyId,
      mode,
      affectedFields,
      totalAffected: fieldsWithValues.length,
      action: '',
      timestamp: new Date().toISOString(),
    };

    // Execute based on mode
    if (mode === 'audit') {
      result.action = `Found ${fieldsWithValues.length} fields with values that need cleanup`;
    } else if (mode === 'soft') {
      if (fieldsWithValues.length === 0) {
        result.action = 'No fields to clean up';
      } else {
        const pathsToClean = fieldsWithValues.map(f => f.path);
        const cleanedGraph = softDeletePaths(graph, pathsToClean);

        // Update meta
        cleanedGraph.meta.updatedAt = new Date().toISOString();

        // Save (pass graph and source)
        await saveContextGraph(cleanedGraph, 'system');
        result.action = `Soft-deleted ${fieldsWithValues.length} field values`;
      }
    } else if (mode === 'hard') {
      if (fieldsWithValues.length === 0) {
        result.action = 'No fields to clean up';
      } else {
        // Hard delete: completely remove deprecated fields from the graph
        const cleanedGraph = hardDeletePaths(graph, fieldsWithValues);

        // Update meta
        cleanedGraph.meta.updatedAt = new Date().toISOString();

        // Save the cleaned graph
        await saveContextGraph(cleanedGraph, 'system');
        result.action = `Hard-deleted ${fieldsWithValues.length} deprecated fields from storage`;

        console.log(`[canonicalize] Hard-deleted ${fieldsWithValues.length} fields for company ${companyId}:`,
          fieldsWithValues.map(f => f.path)
        );
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] context/canonicalize error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Canonicalization failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET Handler - List all removed fields for documentation
// ============================================================================

export async function GET() {
  return NextResponse.json({
    doctrine: 'Context = durable, factual truth about the business',
    removedFields: REMOVED_FIELDS,
    deprecatedDomains: ['objectives', 'website', 'content', 'seo'],
    usage: {
      audit: 'POST with mode=audit to see affected fields',
      soft: 'POST with mode=soft to clear deprecated values',
      hard: 'POST with mode=hard to delete (not yet implemented)',
    },
  });
}
