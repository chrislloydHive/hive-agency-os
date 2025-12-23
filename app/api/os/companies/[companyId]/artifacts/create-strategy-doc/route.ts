// app/api/os/companies/[companyId]/artifacts/create-strategy-doc/route.ts
// Create a Strategy Document artifact in Google Drive
//
// POST - Create a Google Doc from a strategy and track it as an artifact

import { NextRequest, NextResponse } from 'next/server';
import { getStrategyById } from '@/lib/os/strategy';
import { getCompanyById } from '@/lib/airtable/companies';
import { createArtifact, linkArtifactToGoogleFile } from '@/lib/airtable/artifacts';
import { createGoogleDriveClient, isGoogleDriveAvailable } from '@/lib/integrations/googleDrive';
import type { DocumentContent, DocumentSection } from '@/lib/integrations/googleDrive';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { CompanyStrategy, StrategyPillar, StrategyPlay, StrategyObjective } from '@/lib/types/strategy';

type Params = { params: Promise<{ companyId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/create-strategy-doc
 * Create a Google Doc from a strategy
 *
 * Body:
 * - strategyId: string (required)
 * - title?: string (optional, defaults to strategy title)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId } = await params;
    const body = await request.json();

    if (!body.strategyId) {
      return NextResponse.json(
        { error: 'Missing required field: strategyId' },
        { status: 400 }
      );
    }

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

    // Get the strategy
    const strategy = await getStrategyById(body.strategyId);
    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    if (strategy.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Get company for folder naming
    const company = await getCompanyById(companyId);
    const companyName = company?.name || 'Unknown Company';

    // Build document content from strategy
    const documentTitle = body.title || `${strategy.title} - Strategy Document`;
    const content = buildStrategyDocumentContent(strategy);

    // Create the artifact record first
    const artifact = await createArtifact({
      companyId,
      title: documentTitle,
      type: 'strategy_doc',
      source: 'strategy_handoff',
      sourceStrategyId: strategy.id,
      strategyVersionAtCreation: strategy.version || 1,
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
        }, { status: 201 });
      } catch (driveError) {
        console.error('[API Artifacts] Failed to create Google Doc:', driveError);
        // Return artifact without Google file (can be linked later)
        return NextResponse.json({
          artifact,
          warning: 'Artifact created but Google Doc creation failed',
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
        }, { status: 201 });
      }
    }

    // Return artifact without Google file (Google not enabled)
    return NextResponse.json({ artifact }, { status: 201 });
  } catch (error) {
    console.error('[API Artifacts] Failed to create strategy doc:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy document' },
      { status: 500 }
    );
  }
}

/**
 * Build document content from a strategy
 */
function buildStrategyDocumentContent(strategy: CompanyStrategy): DocumentContent {
  const sections: DocumentSection[] = [];

  // Title and summary
  sections.push({
    heading: strategy.title,
    headingLevel: 1,
    body: strategy.summary || '',
  });

  // Objectives
  if (strategy.objectives && strategy.objectives.length > 0) {
    const objectivesText = strategy.objectives
      .map((obj, i) => {
        if (typeof obj === 'string') {
          return `${i + 1}. ${obj}`;
        }
        const o = obj as StrategyObjective;
        let text = `${i + 1}. ${o.text}`;
        if (o.metric && o.target) {
          text += ` (${o.metric}: ${o.target})`;
        }
        return text;
      })
      .join('\n');

    sections.push({
      heading: 'Strategic Objectives',
      headingLevel: 2,
      body: objectivesText,
    });
  }

  // Pillars (Priorities)
  if (strategy.pillars && strategy.pillars.length > 0) {
    for (const pillar of strategy.pillars) {
      sections.push({
        heading: pillar.title,
        headingLevel: 2,
        body: buildPillarContent(pillar),
      });
    }
  }

  // Plays (Tactics) - if separate from pillars
  if (strategy.plays && strategy.plays.length > 0) {
    sections.push({
      heading: 'Tactical Plays',
      headingLevel: 2,
      body: strategy.plays
        .map(play => buildPlayContent(play))
        .join('\n\n'),
    });
  }

  // Timeline
  if (strategy.startDate || strategy.endDate || strategy.quarterLabel) {
    const timelineText = [
      strategy.quarterLabel && `Quarter: ${strategy.quarterLabel}`,
      strategy.startDate && `Start: ${strategy.startDate}`,
      strategy.endDate && `End: ${strategy.endDate}`,
    ]
      .filter(Boolean)
      .join('\n');

    sections.push({
      heading: 'Timeline',
      headingLevel: 2,
      body: timelineText,
    });
  }

  // Metadata footer
  sections.push({
    heading: 'Document Information',
    headingLevel: 3,
    body: [
      `Generated from Hive OS Strategy`,
      `Strategy ID: ${strategy.id}`,
      `Status: ${strategy.status}`,
      `Created: ${new Date().toISOString().split('T')[0]}`,
    ].join('\n'),
  });

  return { sections };
}

/**
 * Build content for a single pillar
 */
function buildPillarContent(pillar: StrategyPillar): string {
  const parts: string[] = [];

  if (pillar.description) {
    parts.push(pillar.description);
  }

  if (pillar.rationale) {
    parts.push(`\nRationale: ${pillar.rationale}`);
  }

  if (pillar.priority) {
    parts.push(`\nPriority: ${pillar.priority}`);
  }

  if (pillar.services && pillar.services.length > 0) {
    parts.push(`\nServices: ${pillar.services.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Build content for a single play
 */
function buildPlayContent(play: StrategyPlay): string {
  const parts: string[] = [`${play.title}`];

  if (play.description) {
    parts.push(play.description);
  }

  if (play.successMetric) {
    parts.push(`Success Metric: ${play.successMetric}`);
  }

  if (play.channels && play.channels.length > 0) {
    parts.push(`Channels: ${play.channels.join(', ')}`);
  }

  return parts.join('\n');
}
