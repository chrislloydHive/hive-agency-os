// app/api/os/context/update/route.ts
// Update company context API
//
// ROUTING: All dotted paths (domain.field) go to ContextGraphs table
// Legacy flat paths go to CompanyContext table (deprecated)
//
// CANONICALIZATION GUARD:
// - Blocks writes to deprecated domains (objectives, website, content, seo)
// - Blocks writes to removed fields (see REMOVED_FIELDS in unifiedRegistry)
// - AI source can only create proposed nodes, not overwrite confirmed
//
// TRUST: Returns revisionId (updatedAt) for optimistic locking on regenerate
//
// Supports two modes:
// 1. Full updates: { companyId, updates: { ... } } - Legacy mode, goes to CompanyContext
// 2. Node-key updates: { companyId, nodeKey, value } - Context Map edits, routes based on path

import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - mutations should never be cached
export const dynamic = 'force-dynamic';
import { updateCompanyContext } from '@/lib/os/context';
import { getFieldEntry } from '@/lib/contextMap/fieldRegistry';
import { loadContextGraph, saveContextGraph, getOrCreateContextGraph } from '@/lib/contextGraph/storage';
import { getCompanyById } from '@/lib/airtable/companies';
import { isRemovedField, getRegistryEntry, getSchemaV2Entry } from '@/lib/contextGraph/unifiedRegistry';
import { isDeprecatedDomain } from '@/lib/contextGraph/companyContextGraph';
import { getActiveStrategy, updateStrategy } from '@/lib/os/strategy';

/**
 * Map Context Graph paths to their corresponding Strategy Frame keys.
 * When a user edits a Context field, we also update the Strategy Frame to keep them in sync.
 */
const CONTEXT_TO_FRAME_MAP: Record<string, string> = {
  'audience.primaryAudience': 'audience',
  'audience.icpDescription': 'audience',
  'productOffer.primaryProducts': 'offering',
  'productOffer.services': 'offering',
  'productOffer.valueProposition': 'valueProp',
  'brand.positioning': 'positioning',
  'identity.marketPosition': 'positioning',
  'productOffer.keyDifferentiators': 'positioning',
  'operationalConstraints.legalRestrictions': 'constraints',
};

/**
 * Sync a Context field update to the corresponding Strategy Frame field.
 * This keeps Context and Strategy Frame in sync bidirectionally.
 */
async function syncToStrategyFrame(
  companyId: string,
  contextPath: string,
  value: unknown
): Promise<void> {
  const frameKey = CONTEXT_TO_FRAME_MAP[contextPath];
  if (!frameKey) {
    console.log(`[context/update] No Strategy Frame mapping for: ${contextPath}`);
    return;
  }

  try {
    // Get active strategy
    const activeStrategy = await getActiveStrategy(companyId);
    if (!activeStrategy?.id) {
      console.log(`[context/update] No active strategy for company, skipping frame sync`);
      return;
    }

    // Build the frame update
    const frameUpdate: Record<string, unknown> = {
      [frameKey]: typeof value === 'string' ? value : JSON.stringify(value),
    };

    console.log(`[context/update] Syncing to Strategy Frame: ${contextPath} → ${frameKey}`);

    // Update the strategy frame
    await updateStrategy({
      strategyId: activeStrategy.id,
      updates: {
        strategyFrame: {
          ...activeStrategy.strategyFrame,
          ...frameUpdate,
        },
        lastHumanUpdatedAt: new Date().toISOString(),
      },
    });

    console.log(`[context/update] SUCCESS: Synced ${contextPath} → Strategy Frame ${frameKey}`);
  } catch (error) {
    // Non-fatal - log but don't fail the context update
    console.warn(`[context/update] Failed to sync to Strategy Frame (non-fatal):`, error);
  }
}

// Context graph domains (stored in ContextGraphs table)
// Must match DOMAIN_NAMES from lib/contextGraph/companyContextGraph.ts
const CONTEXT_GRAPH_DOMAINS = new Set([
  // Core strategic domains
  'identity',
  'brand',
  'objectives',
  'audience',
  'productOffer',
  // Digital & Content
  'digitalInfra',
  'website',
  'content',
  'seo',
  'ops',
  // Media & Performance
  'performanceMedia',
  'historical',
  'creative',
  'competitive',
  // Operations & Risk
  'budgetOps',
  'operationalConstraints',
  'storeRisk',
  // References & Social
  'historyRefs',
  'social',
  // Capabilities
  'capabilities',
]);

/**
 * Check if a path is a context graph field (dotted path with a known domain)
 */
function isContextGraphField(path: string): boolean {
  if (!path.includes('.')) return false;
  const domain = path.split('.')[0];
  return CONTEXT_GRAPH_DOMAINS.has(domain);
}

/**
 * CANONICALIZATION GUARD
 * Returns an error message if the field cannot be written, null if OK
 *
 * CONTRACT ENFORCEMENT:
 * - Labs/Diagnostics cannot write directly to Context
 * - AI can only propose to empty fields (enforced in updateContextGraphField)
 * - Only 'user' and 'system' sources can write confirmed values
 */
function validateCanonicalWrite(
  fieldPath: string,
  source: string,
  isDelete: boolean
): string | null {
  // CONTRACT: Block lab/diagnostic sources from writing to Context
  // They should write to their own tables (diagnostics, findings) and create proposals
  const blockedSources = ['lab', 'diagnostic', 'website_lab', 'gap_ia', 'full_gap', 'competition_lab'];
  if (blockedSources.includes(source)) {
    return `Source "${source}" cannot write directly to Context. ` +
           `Labs and diagnostics should create proposals instead.`;
  }

  // Check if it's a removed field
  if (isRemovedField(fieldPath)) {
    return `Field "${fieldPath}" has been removed from canonical Context. ` +
           `See docs/context/reuse-affirmation.md for migration guidance.`;
  }

  // Check if writing to a deprecated domain
  const domain = fieldPath.split('.')[0];
  if (isDeprecatedDomain(domain)) {
    // Allow deletes (cleanup) but block new writes
    if (!isDelete) {
      return `Domain "${domain}" is deprecated and read-only. ` +
             `New writes are blocked per the canonicalization doctrine.`;
    }
  }

  return null;
}

/**
 * Resolve a nodeKey to the best graph path for storage
 * Returns: { graphPath, isContextGraph }
 *
 * Handles Schema V2 keys like 'offer.productsServices' by looking up
 * the registry entry's domain and constructing the storage path.
 */
function resolveGraphPath(nodeKey: string): { graphPath: string; isContextGraph: boolean } {
  console.log(`[context/update] resolveGraphPath called with nodeKey: "${nodeKey}"`);

  // 1. If nodeKey itself is a dotted context graph path, use it directly
  if (isContextGraphField(nodeKey)) {
    console.log(`[context/update] Step 1: nodeKey is a context graph field`);
    return { graphPath: nodeKey, isContextGraph: true };
  }

  // 2. Look up in Schema V2 registry (e.g., 'offer.productsServices')
  const schemaV2Entry = getSchemaV2Entry(nodeKey);
  console.log(`[context/update] Step 2: getSchemaV2Entry result:`, schemaV2Entry ? {
    key: schemaV2Entry.key,
    domain: schemaV2Entry.domain,
    legacyPath: schemaV2Entry.legacyPath,
    graphPath: schemaV2Entry.graphPath,
  } : 'NOT FOUND');

  if (schemaV2Entry) {
    // Use explicit graphPath if provided
    if (schemaV2Entry.graphPath && isContextGraphField(schemaV2Entry.graphPath)) {
      console.log(`[context/update] Using explicit graphPath: "${schemaV2Entry.graphPath}"`);
      return { graphPath: schemaV2Entry.graphPath, isContextGraph: true };
    }

    // Construct graphPath from domain + legacyPath
    // Schema V2 keys like 'offer.productsServices' have domain: 'productOffer', legacyPath: 'primaryProducts'
    // We need to map to storage path: 'productOffer.primaryProducts'
    const domain = schemaV2Entry.domain;
    console.log(`[context/update] Checking domain "${domain}" in CONTEXT_GRAPH_DOMAINS:`, CONTEXT_GRAPH_DOMAINS.has(domain));
    if (domain && CONTEXT_GRAPH_DOMAINS.has(domain)) {
      const fieldName = schemaV2Entry.legacyPath || nodeKey.split('.').pop() || '';
      const graphPath = `${domain}.${fieldName}`;
      console.log(`[context/update] Resolved Schema V2 key "${nodeKey}" -> "${graphPath}"`);
      return { graphPath, isContextGraph: true };
    }
  }

  // 3. Look up in unified (legacy) registry
  const unifiedEntry = getRegistryEntry(nodeKey);
  console.log(`[context/update] Step 3: getRegistryEntry result:`, unifiedEntry ? {
    key: unifiedEntry.key,
    domain: unifiedEntry.domain,
    legacyPath: unifiedEntry.legacyPath,
  } : 'NOT FOUND');

  if (unifiedEntry) {
    if (unifiedEntry.graphPath && isContextGraphField(unifiedEntry.graphPath)) {
      return { graphPath: unifiedEntry.graphPath, isContextGraph: true };
    }
    const domain = unifiedEntry.domain;
    if (domain && CONTEXT_GRAPH_DOMAINS.has(domain)) {
      const fieldName = unifiedEntry.legacyPath || nodeKey.split('.').pop() || '';
      const graphPath = `${domain}.${fieldName}`;
      console.log(`[context/update] Resolved legacy key "${nodeKey}" -> "${graphPath}"`);
      return { graphPath, isContextGraph: true };
    }
  }

  // 4. Legacy field registry lookup (from fieldRegistry.ts)
  const entry = getFieldEntry(nodeKey);
  console.log(`[context/update] Step 4: getFieldEntry result:`, entry ? entry.key : 'NOT FOUND');
  if (entry) {
    if (isContextGraphField(entry.key)) {
      return { graphPath: entry.key, isContextGraph: true };
    }
  }

  // 5. Not a context graph field - legacy flat path
  console.log(`[context/update] Step 5: Falling back to legacy path`);
  return { graphPath: nodeKey, isContextGraph: false };
}

/**
 * Update a field in the context graph and save it
 *
 * AI PROTECTION: If source is 'ai' and the field already has a confirmed value,
 * the write will be blocked. AI can only write to empty fields or propose changes.
 */
async function updateContextGraphField(
  companyId: string,
  fieldPath: string,
  value: unknown,
  source: string
): Promise<{ success: boolean; revisionId: string }> {
  // Get company name for graph creation
  const company = await getCompanyById(companyId);
  const companyName = company?.name || 'Unknown';

  // Load or create context graph
  let graph = await loadContextGraph(companyId);
  if (!graph) {
    graph = await getOrCreateContextGraph(companyId, companyName);
  }

  // Parse the field path (e.g., 'website.quality' -> domain='website', field='quality')
  const parts = fieldPath.split('.');
  if (parts.length < 2) {
    throw new Error(`Invalid field path: ${fieldPath}`);
  }

  const [domain, ...fieldParts] = parts;
  const fieldName = fieldParts.join('.');

  // Update the field in the graph
  const domainObj = (graph as any)[domain];
  if (!domainObj) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  // AI PROTECTION: Check if AI is trying to overwrite confirmed context
  if (source === 'ai' && domainObj[fieldName]) {
    const existingField = domainObj[fieldName];
    const existingValue = existingField?.value;
    const existingProvenance = existingField?.provenance?.[0];

    // If there's a confirmed value (user source), block AI overwrite
    if (existingValue !== null && existingValue !== undefined) {
      const isConfirmed = existingProvenance?.source === 'user' ||
                          existingProvenance?.source === 'user_input' ||
                          existingProvenance?.confirmedAt;

      if (isConfirmed) {
        throw new Error(
          `AI cannot overwrite confirmed context. Field "${fieldPath}" has a user-confirmed value. ` +
          `AI suggestions should be created as proposals instead.`
        );
      }
    }
  }

  // The field might be nested (e.g., 'website.quality' or 'competitive.overallThreatLevel')
  // For now, handle single-level nesting
  if (fieldParts.length === 1) {
    // Direct field update (e.g., website.quality)
    if (domainObj[fieldName]) {
      domainObj[fieldName].value = value;
      domainObj[fieldName].provenance = [
        {
          source: source === 'user' ? 'user_input' : source,
          confidence: source === 'user' ? 1.0 : 0.8,
          updatedAt: new Date().toISOString(),
        },
        ...(domainObj[fieldName].provenance || []).slice(0, 2),
      ];
    } else {
      // Field doesn't exist in schema, create it
      domainObj[fieldName] = {
        value,
        provenance: [
          {
            source: source === 'user' ? 'user_input' : source,
            confidence: source === 'user' ? 1.0 : 0.8,
            updatedAt: new Date().toISOString(),
          },
        ],
      };
    }
  } else {
    // Nested field (not currently handled, log warning)
    console.warn(`[context/update] Nested field paths not fully supported: ${fieldPath}`);
    // Try to set it anyway
    let current = domainObj;
    for (let i = 0; i < fieldParts.length - 1; i++) {
      if (!current[fieldParts[i]]) {
        current[fieldParts[i]] = {};
      }
      current = current[fieldParts[i]];
    }
    const lastField = fieldParts[fieldParts.length - 1];
    current[lastField] = {
      value,
      provenance: [
        {
          source: source === 'user' ? 'user_input' : source,
          confidence: source === 'user' ? 1.0 : 0.8,
          updatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  // Ensure graph has the correct companyId (may be missing from older stored graphs)
  if (!graph.companyId || graph.companyId !== companyId) {
    console.warn(`[context/update] Graph companyId mismatch: graph has "${graph.companyId}", expected "${companyId}". Fixing...`);
    graph.companyId = companyId;
  }
  if (!graph.companyName) {
    graph.companyName = companyName;
  }

  // Log the value we're about to save
  const fieldToSave = domainObj[fieldName] || domainObj;
  console.log(`[context/update] Field value before save:`, {
    path: fieldPath,
    value: JSON.stringify(fieldToSave?.value).slice(0, 100),
    provenanceSource: fieldToSave?.provenance?.[0]?.source,
    provenanceUpdatedAt: fieldToSave?.provenance?.[0]?.updatedAt,
  });

  // Save the updated graph
  console.log(`[context/update] Saving graph for company ${companyId}...`);
  console.log(`[context/update] Graph companyId: ${graph.companyId}, companyName: ${graph.companyName}`);

  const saved = await saveContextGraph(graph, source);
  if (!saved) {
    console.error(`[context/update] Failed to save context graph for ${companyId}`);
    throw new Error('Failed to save context graph');
  }

  console.log(`[context/update] SUCCESS: Saved context graph field ${fieldPath} = ${JSON.stringify(value).slice(0, 100)}`);
  console.log(`[context/update] Record ID: ${saved.id}, updatedAt: ${saved.updatedAt}`);

  return {
    success: true,
    revisionId: saved.updatedAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, updates, nodeKey, value, source, action } = body as {
      companyId: string;
      updates?: Record<string, unknown>;
      nodeKey?: string;
      value?: unknown;
      source?: 'user' | 'ai' | 'diagnostic';
      action?: 'update' | 'delete';
    };

    if (!companyId) {
      return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    }

    // =========================================================================
    // MODE 1: Node-key update/delete (Context Map edits)
    // =========================================================================
    if (nodeKey !== undefined && (value !== undefined || action === 'delete')) {
      const { graphPath, isContextGraph } = resolveGraphPath(nodeKey);
      const isDelete = action === 'delete';

      // CANONICALIZATION GUARD: Block writes to deprecated/removed fields
      const validationError = validateCanonicalWrite(graphPath, source || 'user', isDelete);
      if (validationError) {
        console.warn(`[context/update] BLOCKED: ${validationError}`);
        return NextResponse.json(
          {
            error: validationError,
            code: 'CANONICAL_VIOLATION',
            fieldPath: graphPath,
          },
          { status: 400 }
        );
      }

      console.log(`[context/update] ========================================`);
      console.log(`[context/update] NODE ${isDelete ? 'DELETE' : 'UPDATE'}`);
      console.log(`[context/update] nodeKey: ${nodeKey}`);
      console.log(`[context/update] graphPath: ${graphPath}`);
      console.log(`[context/update] TABLE: ${isContextGraph ? 'ContextGraphs' : 'CompanyContext (LEGACY)'}`);
      console.log(`[context/update] value: ${isDelete ? '(deleting)' : JSON.stringify(value).slice(0, 200)}`);
      console.log(`[context/update] ========================================`);

      if (isContextGraph) {
        // Save to ContextGraphs table (the right place!)
        // For deletes, pass null to clear the field
        const result = await updateContextGraphField(companyId, graphPath, isDelete ? null : value, source || 'user');
        console.log(`[context/update] SUCCESS → ContextGraphs table${isDelete ? ' (deleted)' : ''}`);

        // SYNC TO STRATEGY FRAME: Keep Context and Strategy Frame in sync
        if (!isDelete && value !== null && value !== undefined) {
          await syncToStrategyFrame(companyId, graphPath, value);
        }

        return NextResponse.json({
          success: true,
          revisionId: result.revisionId,
          updatedNode: { key: nodeKey, value: isDelete ? null : value },
          deleted: isDelete,
          savedTo: 'ContextGraphs',
        });
      } else {
        // Legacy flat field - goes to CompanyContext table
        console.warn(`[context/update] WARNING: Saving to legacy CompanyContext table`);
        const context = await updateCompanyContext({
          companyId,
          updates: { [graphPath]: isDelete ? null : value },
          source: source || 'user',
        });
        const revisionId = context.updatedAt || new Date().toISOString();
        console.log(`[context/update] SUCCESS → CompanyContext table (legacy)`);
        return NextResponse.json({
          success: true,
          context,
          revisionId,
          updatedNode: { key: nodeKey, value },
          savedTo: 'CompanyContext',
        });
      }
    }

    // =========================================================================
    // MODE 2: Full updates (legacy bulk update)
    // =========================================================================
    if (updates) {
      console.log(`[context/update] BULK UPDATE to CompanyContext table`);
      console.log(`[context/update] fields: ${Object.keys(updates).join(', ')}`);

      const context = await updateCompanyContext({
        companyId,
        updates,
        source: source || 'user',
      });

      const revisionId = context.updatedAt || new Date().toISOString();
      console.log(`[context/update] SUCCESS → CompanyContext table (bulk)`);

      return NextResponse.json({
        success: true,
        context,
        revisionId,
        savedTo: 'CompanyContext',
      });
    }

    return NextResponse.json(
      { error: 'Either updates or (nodeKey, value) is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] context/update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update context' },
      { status: 500 }
    );
  }
}
