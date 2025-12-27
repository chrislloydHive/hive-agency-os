// app/api/os/companies/[companyId]/artifacts/create-rfp-doc/route.ts
// Create an RFP Response Document artifact in Google Drive
//
// POST - Create a Google Doc from Context V4 snapshot and track it as an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import type { DocumentContent, DocumentSection } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import { loadContextGraph } from '@/lib/contextGraph/storage';
import { isStrategyReady } from '@/lib/contextGraph/readiness/strategyReady';
import { createContextSnapshot } from '@/lib/contextGraph/snapshots';
import type { CompanyContextGraph } from '@/lib/contextGraph/companyContextGraph';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/create-rfp-doc
 * Create a Google Doc for RFP Response from Context V4
 *
 * Body:
 * - title?: string (optional, defaults to "RFP Response - [Company Name]")
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json().catch(() => ({}));

    // Check if Google Drive is available
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      const driveAvailable = await isGoogleDriveAvailable(companyId);
      if (!driveAvailable) {
        return NextResponse.json(
          { error: 'Google Drive is not connected. Please connect Google first.' },
          { status: 400 }
        );
      }
    }

    // Load context graph and check readiness
    const graph = await loadContextGraph(companyId);
    if (!graph) {
      return NextResponse.json(
        { error: 'No context found for this company' },
        { status: 400 }
      );
    }

    const readiness = isStrategyReady(graph);
    if (!readiness.ready) {
      return NextResponse.json(
        {
          error: 'Context is not ready for RFP generation',
          missing: readiness.missing.map(m => m.label),
          completenessPercent: readiness.completenessPercent,
        },
        { status: 400 }
      );
    }

    // Get company for naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Create a snapshot for this RFP artifact
    const snapshot = await createContextSnapshot({
      companyId,
      snapshotType: 'manual',
      label: 'RFP Response Snapshot',
      description: 'Snapshot created for RFP Response document',
    });

    // Build document content from context
    const documentTitle = body.title || `RFP Response - ${companyName}`;
    const content = buildRfpDocumentContent(graph, companyName);

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: documentTitle,
      type: 'rfp_response_doc',
      source: 'rfp_export',
      snapshotId: snapshot.snapshotId,
      lastSyncedAt: new Date().toISOString(),
    });

    if (!artifact) {
      return NextResponse.json(
        { error: 'Failed to create artifact record' },
        { status: 500 }
      );
    }

    // If Google Drive is enabled, create the actual document
    if (FEATURE_FLAGS.ARTIFACTS_GOOGLE_ENABLED) {
      try {
        const driveClient = createGoogleDriveClient(companyId);

        // Get or create company folder
        const folder = await driveClient.getOrCreateCompanyFolder(companyName);

        // Create the document
        const file = await driveClient.createDocument({
          title: documentTitle,
          content,
          parentFolderId: folder.id,
        });

        // Link the artifact to the Google file
        await linkArtifactToGoogleFile(
          artifact.id,
          file.id,
          file.webViewLink,
          'document',
          folder.id
        );

        return NextResponse.json({
          artifact: {
            ...artifact,
            googleFileId: file.id,
            googleFileUrl: file.webViewLink,
            googleFileType: 'document',
            googleFolderId: folder.id,
          },
          googleFile: file,
          snapshotId: snapshot.snapshotId,
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create RFP Google Doc:', driveError);
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Doc creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact, snapshotId: snapshot.snapshotId }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create RFP doc:', error);
    return NextResponse.json(
      { error: 'Failed to create RFP document' },
      { status: 500 }
    );
  }
}

/**
 * Build RFP Response document content from Context V4
 */
function buildRfpDocumentContent(graph: CompanyContextGraph, companyName: string): DocumentContent {
  const sections: DocumentSection[] = [];

  // Title
  sections.push({
    heading: `RFP Response - ${companyName}`,
    headingLevel: 1,
    body: `Prepared by Hive Agency\nGenerated: ${new Date().toLocaleDateString()}`,
  });

  // Executive Summary
  const executiveSummary = buildExecutiveSummary(graph);
  sections.push({
    heading: 'Executive Summary',
    headingLevel: 2,
    body: executiveSummary,
  });

  // Understanding of Current State
  const currentState = buildCurrentStateSection(graph);
  sections.push({
    heading: 'Understanding of Current State',
    headingLevel: 2,
    body: currentState,
  });

  // Proposed Approach
  const approach = buildProposedApproachSection(graph);
  sections.push({
    heading: 'Proposed Approach',
    headingLevel: 2,
    body: approach,
  });

  // Scope & Deliverables
  sections.push({
    heading: 'Scope & Deliverables',
    headingLevel: 2,
    body: buildScopeSection(graph),
  });

  // Timeline
  sections.push({
    heading: 'Timeline',
    headingLevel: 2,
    body: '[To be filled in based on project requirements]',
  });

  // Assumptions & Risks
  sections.push({
    heading: 'Assumptions & Risks',
    headingLevel: 2,
    body: buildAssumptionsSection(graph),
  });

  // Document footer
  sections.push({
    heading: 'Document Information',
    headingLevel: 3,
    body: [
      `Generated from Hive OS Context V4`,
      `Company: ${companyName}`,
      `Date: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n'),
  });

  return { sections };
}

/**
 * Build executive summary from context
 */
function buildExecutiveSummary(graph: CompanyContextGraph): string {
  const parts: string[] = [];

  // Business model
  const businessModel = graph.identity?.businessModel;
  if (businessModel?.value) {
    parts.push(`${graph.companyName || 'The company'} operates with a ${businessModel.value} business model.`);
  }

  // Value proposition
  const valueProposition = graph.productOffer?.valueProposition;
  if (valueProposition?.value) {
    parts.push(`\nValue Proposition: ${valueProposition.value}`);
  }

  // Primary audience
  const primaryAudience = graph.audience?.primaryAudience;
  if (primaryAudience?.value) {
    parts.push(`\nTarget Audience: ${primaryAudience.value}`);
  }

  if (parts.length === 0) {
    return '[Executive summary to be completed based on context data]';
  }

  return parts.join('\n');
}

/**
 * Build current state understanding section
 */
function buildCurrentStateSection(graph: CompanyContextGraph): string {
  const parts: string[] = [];

  // Industry context
  const industry = graph.identity?.industry;
  if (industry?.value) {
    parts.push(`Industry: ${industry.value}`);
  }

  // ICP description
  const icpDescription = graph.audience?.icpDescription;
  if (icpDescription?.value) {
    parts.push(`\nIdeal Customer Profile: ${icpDescription.value}`);
  }

  // Current challenges/pain points
  const painPoints = graph.audience?.painPoints;
  if (painPoints?.value && Array.isArray(painPoints.value) && painPoints.value.length > 0) {
    parts.push(`\nKey Pain Points:`);
    painPoints.value.forEach((point: string, i: number) => {
      parts.push(`  ${i + 1}. ${point}`);
    });
  }

  // Competitive landscape
  const competitors = graph.competitive?.competitors || graph.competitive?.primaryCompetitors;
  if (competitors?.value && Array.isArray(competitors.value) && competitors.value.length > 0) {
    parts.push(`\nCompetitive Landscape:`);
    parts.push(`  Known competitors: ${competitors.value.slice(0, 5).join(', ')}`);
  }

  if (parts.length === 0) {
    return '[Current state analysis to be completed]';
  }

  return parts.join('\n');
}

/**
 * Build proposed approach section
 */
function buildProposedApproachSection(graph: CompanyContextGraph): string {
  const parts: string[] = [];

  // Brand positioning
  const positioning = graph.brand?.positioning;
  if (positioning?.value) {
    parts.push(`Strategic Positioning: ${positioning.value}`);
  }

  // Primary products/services
  const primaryProducts = graph.productOffer?.primaryProducts || graph.productOffer?.heroProducts;
  if (primaryProducts?.value && Array.isArray(primaryProducts.value) && primaryProducts.value.length > 0) {
    parts.push(`\nCore Products/Services:`);
    primaryProducts.value.forEach((product: string, i: number) => {
      parts.push(`  ${i + 1}. ${product}`);
    });
  }

  // Performance media channels
  const channels = graph.performanceMedia?.activeChannels;
  if (channels?.value && Array.isArray(channels.value) && channels.value.length > 0) {
    parts.push(`\nActive Channels: ${channels.value.join(', ')}`);
  }

  if (parts.length === 0) {
    return '[Proposed approach to be defined based on discovery]';
  }

  return parts.join('\n');
}

/**
 * Build scope and deliverables section
 */
function buildScopeSection(graph: CompanyContextGraph): string {
  const parts: string[] = [
    'In Scope:',
    '  - Strategic planning and execution',
    '  - Performance tracking and optimization',
    '  - Regular reporting and insights',
    '',
    'Out of Scope:',
    '  - [To be defined]',
    '',
    'Key Deliverables:',
    '  - Strategic roadmap',
    '  - Campaign execution',
    '  - Performance reports',
  ];

  return parts.join('\n');
}

/**
 * Build assumptions and risks section
 */
function buildAssumptionsSection(graph: CompanyContextGraph): string {
  const parts: string[] = [];

  parts.push('Assumptions:');
  parts.push('  - Client will provide timely feedback and approvals');
  parts.push('  - Access to necessary data and platforms will be granted');
  parts.push('  - Budget allocations will align with agreed-upon scope');

  // Budget constraints
  const budgetConstraints = graph.operationalConstraints?.budgetCapsFloors;
  if (budgetConstraints?.value && Array.isArray(budgetConstraints.value) && budgetConstraints.value.length > 0) {
    parts.push(`\nBudget Considerations:`);
    budgetConstraints.value.forEach((constraint) => {
      const desc = `${constraint.type} of $${constraint.amount} ${constraint.period}`;
      parts.push(`  - ${desc}${constraint.reason ? ` (${constraint.reason})` : ''}`);
    });
  }

  parts.push('\nRisks:');
  parts.push('  - Market conditions may change during engagement');
  parts.push('  - Competitive activity may require strategy adjustments');
  parts.push('  - Timeline dependencies on third-party deliverables');

  return parts.join('\n');
}
