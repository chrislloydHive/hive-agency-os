// app/api/os/companies/[companyId]/artifacts/update-rfp-doc/route.ts
// Update an RFP Response Document artifact by appending updates
//
// POST - Append an "Updates" section to the Google Doc with changed context fields

import { NextRequest, NextResponse } from 'next/server';
import { getArtifactsForCompanyByType, updateArtifact, getArtifactById } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { getSnapshotById } from '@/lib/contextGraph/snapshots';
import { createContextSnapshot } from '@/lib/contextGraph/snapshots';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/update-rfp-doc
 * Append updates to an existing RFP Response document
 *
 * Body:
 * - artifactId?: string (optional, uses latest rfp_response_doc if not provided)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));

    // Find the RFP doc artifact
    let artifact;
    if (body.artifactId) {
      artifact = await getArtifactById(body.artifactId);
      if (!artifact || artifact.companyId !== companyId || artifact.type !== 'rfp_response_doc') {
        return NextResponse.json(
          { error: 'RFP Response document not found' },
          { status: 404 }
        );
      }
    } else {
      // Get the latest rfp_response_doc for this company
      const artifacts = await getArtifactsForCompanyByType(companyId, 'rfp_response_doc');
      const activeArtifact = artifacts.find(a => a.status !== 'archived');
      if (!activeArtifact) {
        return NextResponse.json(
          { error: 'No RFP Response document found for this company' },
          { status: 404 }
        );
      }
      artifact = activeArtifact;
    }

    // Check if Google Drive is available
    if (!FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      return NextResponse.json(
        { error: 'Google Drive integration is not enabled' },
        { status: 400 }
      );
    }

    const driveAvailable = await isGoogleDriveAvailable(companyId);
    if (!driveAvailable) {
      return NextResponse.json(
        { error: 'Google Drive is not connected' },
        { status: 400 }
      );
    }

    if (!artifact.googleFileId) {
      return NextResponse.json(
        { error: 'RFP document is not linked to a Google file' },
        { status: 400 }
      );
    }

    // Load current context
    const currentGraph = await loadContextGraph(companyId);
    if (!currentGraph) {
      return NextResponse.json(
        { error: 'No context found for this company' },
        { status: 400 }
      );
    }

    // Load previous snapshot to compare
    let previousGraph: CompanyContextGraph | null = null;
    if (artifact.snapshotId) {
      const previousSnapshot = await getSnapshotById(artifact.snapshotId);
      previousGraph = previousSnapshot?.graph || null;
    }

    // Detect changes between snapshots
    const changes = detectContextChanges(previousGraph, currentGraph);

    if (changes.length === 0) {
      // No changes to append - just mark as fresh
      await updateArtifact(artifact.id, {
        isStale: false,
        stalenessReason: null,
        stalenessCheckedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        artifact,
        message: 'No updates detected - document is up to date',
        changesAppended: 0,
      });
    }

    // Create a new snapshot for this update
    const newSnapshot = await createContextSnapshot({
      companyId,
      snapshotType: 'manual',
      label: 'RFP Update Snapshot',
      description: `Update appended to RFP Response document`,
    });

    // Build update section content
    const updateContent = buildUpdateSection(changes);

    // Append to the Google Doc
    const driveClient = createGoogleDriveClient(companyId);
    const docs = await driveClient.getDocs();

    // Get the document to find the end position
    const doc = await docs.documents.get({ documentId: artifact.googleFileId });
    const endIndex = doc.data.body?.content?.reduce((max, element) => {
      return Math.max(max, element.endIndex || 0);
    }, 1) || 1;

    // Insert the update section at the end (before the last newline)
    const insertIndex = Math.max(1, endIndex - 1);

    await docs.documents.batchUpdate({
      documentId: artifact.googleFileId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: `\n\n${'─'.repeat(50)}\n\n` +
                `Updates - ${new Date().toLocaleDateString()}\n\n` +
                updateContent +
                `\n`,
            },
          },
        ],
      },
    });

    // Update the artifact
    const updatedArtifact = await updateArtifact(artifact.id, {
      isStale: false,
      stalenessReason: null,
      stalenessCheckedAt: new Date().toISOString(),
      snapshotId: newSnapshot.snapshotId,
      lastSyncedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      artifact: updatedArtifact,
      message: 'Updates appended to document',
      changesAppended: changes.length,
      changes: changes.map(c => c.field),
      snapshotId: newSnapshot.snapshotId,
    });
  } catch (error) {
    console.error('[API Artifacts] Failed to update RFP doc:', error);
    return NextResponse.json(
      { error: 'Failed to update RFP document' },
      { status: 500 }
    );
  }
}

/**
 * Detected context change
 */
interface ContextChange {
  field: string;
  label: string;
  oldValue: string | null;
  newValue: string;
}

/**
 * Detect changes between two context graphs
 */
function detectContextChanges(
  oldGraph: CompanyContextGraph | null,
  newGraph: CompanyContextGraph
): ContextChange[] {
  const changes: ContextChange[] = [];

  // Fields to track for RFP updates
  const trackedFields = [
    { path: 'identity.businessModel', label: 'Business Model' },
    { path: 'productOffer.valueProposition', label: 'Value Proposition' },
    { path: 'productOffer.primaryProducts', label: 'Primary Products' },
    { path: 'audience.primaryAudience', label: 'Primary Audience' },
    { path: 'audience.icpDescription', label: 'ICP Description' },
    { path: 'brand.positioning', label: 'Brand Positioning' },
    { path: 'competitive.competitors', label: 'Competitors' },
    { path: 'competitive.positionSummary', label: 'Competitive Position' },
    { path: 'operationalConstraints.budgetCapsFloors', label: 'Budget Constraints' },
  ];

  for (const { path, label } of trackedFields) {
    const [domain, field] = path.split('.');

    const oldValue = getFieldValue(oldGraph, domain, field);
    const newValue = getFieldValue(newGraph, domain, field);

    // Compare serialized values
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);

    if (oldStr !== newStr && newValue !== null) {
      changes.push({
        field: path,
        label,
        oldValue: formatValue(oldValue),
        newValue: formatValue(newValue),
      });
    }
  }

  return changes;
}

/**
 * Get a field value from context graph
 */
function getFieldValue(
  graph: CompanyContextGraph | null,
  domain: string,
  field: string
): unknown | null {
  if (!graph) return null;

  const domainObj = graph[domain as keyof CompanyContextGraph];
  if (!domainObj || typeof domainObj !== 'object') return null;

  const fieldObj = (domainObj as Record<string, unknown>)[field];
  if (!fieldObj) return null;

  // Handle WithMeta wrapper
  if (typeof fieldObj === 'object' && 'value' in (fieldObj as object)) {
    return (fieldObj as { value: unknown }).value;
  }

  return fieldObj;
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Build the update section content
 */
function buildUpdateSection(changes: ContextChange[]): string {
  const lines: string[] = [];

  for (const change of changes) {
    lines.push(`${change.label}:`);
    if (change.oldValue) {
      lines.push(`  Previous: ${change.oldValue}`);
    }
    lines.push(`  Updated: ${change.newValue}`);
    lines.push('');
  }

  return lines.join('\n');
}
