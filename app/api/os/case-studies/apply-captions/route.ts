// app/api/os/case-studies/apply-captions/route.ts
// Internal-only endpoint to apply captions to case study visuals
// POST /api/os/case-studies/apply-captions

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getCaseStudies, updateCaseStudy } from '@/lib/airtable/firmBrain';
import type { CaseStudyVisual } from '@/lib/types/firmBrain';

interface CaptionEntry {
  assetUrl: string;
  caption: string | null;
  note?: string;
}

export async function POST() {
  try {
    // Read captions file
    const captionsPath = path.join(process.cwd(), 'data', 'case-studies', 'visual-captions.json');

    if (!fs.existsSync(captionsPath)) {
      return NextResponse.json(
        { error: 'Captions file not found. Create data/case-studies/visual-captions.json first.' },
        { status: 404 }
      );
    }

    const captionsContent = fs.readFileSync(captionsPath, 'utf-8');
    const captions: CaptionEntry[] = JSON.parse(captionsContent);

    // Build a lookup map by assetUrl
    const captionMap = new Map<string, string | null>();
    for (const entry of captions) {
      captionMap.set(entry.assetUrl, entry.caption);
    }

    // Get all case studies
    const caseStudies = await getCaseStudies();

    const results: Array<{
      caseStudyId: string;
      title: string;
      captionsApplied: number;
      visualsSkipped: number;
    }> = [];

    // Apply captions to each case study's visuals
    for (const caseStudy of caseStudies) {
      if (!caseStudy.visuals || caseStudy.visuals.length === 0) {
        continue;
      }

      let captionsApplied = 0;
      let visualsSkipped = 0;

      const updatedVisuals: CaseStudyVisual[] = caseStudy.visuals.map((visual) => {
        const caption = captionMap.get(visual.assetUrl);

        if (caption === undefined) {
          // No caption entry for this asset
          visualsSkipped++;
          return visual;
        }

        if (caption === null) {
          // Explicitly null - skip this visual (template images)
          visualsSkipped++;
          return visual;
        }

        captionsApplied++;
        return {
          ...visual,
          caption,
        };
      });

      // Update the case study with captioned visuals
      if (captionsApplied > 0) {
        await updateCaseStudy(caseStudy.id, {
          visuals: updatedVisuals,
        });
      }

      results.push({
        caseStudyId: caseStudy.id,
        title: caseStudy.title,
        captionsApplied,
        visualsSkipped,
      });
    }

    const totalCaptionsApplied = results.reduce((sum, r) => sum + r.captionsApplied, 0);

    return NextResponse.json({
      success: true,
      totalCaptionsApplied,
      caseStudiesUpdated: results.filter(r => r.captionsApplied > 0).length,
      results,
    });
  } catch (err) {
    console.error('[apply-captions] Error:', err);
    return NextResponse.json(
      { error: 'Failed to apply captions', details: String(err) },
      { status: 500 }
    );
  }
}

// GET endpoint to preview captions
export async function GET() {
  try {
    const captionsPath = path.join(process.cwd(), 'data', 'case-studies', 'visual-captions.json');

    if (!fs.existsSync(captionsPath)) {
      return NextResponse.json(
        { error: 'Captions file not found' },
        { status: 404 }
      );
    }

    const captionsContent = fs.readFileSync(captionsPath, 'utf-8');
    const captions: CaptionEntry[] = JSON.parse(captionsContent);

    const withCaptions = captions.filter(c => c.caption !== null);
    const skipped = captions.filter(c => c.caption === null);

    return NextResponse.json({
      totalEntries: captions.length,
      withCaptions: withCaptions.length,
      skipped: skipped.length,
      preview: withCaptions.slice(0, 10).map(c => ({
        assetUrl: c.assetUrl,
        caption: c.caption,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read captions', details: String(err) },
      { status: 500 }
    );
  }
}
