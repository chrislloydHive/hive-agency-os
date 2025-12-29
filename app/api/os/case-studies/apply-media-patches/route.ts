// app/api/os/case-studies/apply-media-patches/route.ts
// Internal-only endpoint to apply media patches to case studies
// POST /api/os/case-studies/apply-media-patches

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { updateCaseStudy, getCaseStudies } from '@/lib/airtable/firmBrain';

interface MediaPatch {
  caseId: string;
  clientLogo?: {
    assetUrl: string;
    fallbackUrl?: string;
    alt: string;
    theme?: 'light' | 'dark';
    variant?: 'full' | 'mark';
    visibility: 'public' | 'internal';
    source?: 'auto' | 'manual';
  };
  visuals: Array<{
    id: string;
    type: 'hero' | 'campaign' | 'before_after' | 'process' | 'detail';
    mediaType: 'image' | 'video';
    title?: string;
    caption?: string;
    assetUrl: string;
    originalUrl?: string;
    linkUrl?: string;
    posterUrl?: string;
    order: number;
    visibility: 'public' | 'internal';
  }>;
}

export async function POST(request: Request) {
  try {
    // Check for internal-only access (in production, add proper auth)
    const authHeader = request.headers.get('authorization');
    const isLocalDev = process.env.NODE_ENV === 'development';

    if (!isLocalDev && authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read patches file
    const patchesPath = path.join(process.cwd(), 'data', 'case-studies', 'case-study-media-patches.json');

    if (!fs.existsSync(patchesPath)) {
      return NextResponse.json(
        { error: 'Patches file not found. Run the ingestion script first.' },
        { status: 404 }
      );
    }

    const patchesContent = fs.readFileSync(patchesPath, 'utf-8');
    const patches: MediaPatch[] = JSON.parse(patchesContent);

    if (!Array.isArray(patches) || patches.length === 0) {
      return NextResponse.json({ error: 'No patches to apply' }, { status: 400 });
    }

    // Get existing case studies
    const existingStudies = await getCaseStudies();

    const results: Array<{
      caseId: string;
      status: 'updated' | 'not_found' | 'error';
      message?: string;
    }> = [];

    // Apply each patch
    for (const patch of patches) {
      // Find matching case study by title pattern
      // Case IDs like "moe-brand-internal" or "moe-content-internal"
      const caseIdParts = patch.caseId.split('-');
      const clientSlug = caseIdParts[0]; // e.g., "moe"
      const caseType = caseIdParts[1]; // e.g., "brand" or "content"
      const isInternal = patch.caseId.includes('internal');

      // Find matching case study
      const matchingStudy = existingStudies.find((study) => {
        const titleLower = study.title.toLowerCase();
        const clientLower = study.client.toLowerCase();
        const caseStudyUrl = study.caseStudyUrl?.toLowerCase() || '';

        // Match by client name
        const normalizedClient = clientLower.replace(/\s+/g, ''); // Remove spaces for matching
        const matchesClient =
          normalizedClient.includes(clientSlug) ||
          clientLower.includes(clientSlug) ||
          titleLower.includes(clientSlug) ||
          (clientSlug === 'moe' && (clientLower.includes('mutual') || clientLower.includes('enumclaw'))) ||
          (clientSlug === 'portagebank' && clientLower.includes('portage'));

        // Match by case type (brand vs content vs website) - check URL or title keywords
        let matchesCaseType = true;
        if (caseType === 'website') {
          // Website case studies have "website" in URL or title
          matchesCaseType =
            caseStudyUrl.includes('website') ||
            titleLower.includes('website') ||
            titleLower.includes('ux');
        } else if (caseType === 'content') {
          // Content case studies have "content", "campaign", or "awareness" in URL or title
          // But NOT "website"
          const isWebsiteCase = caseStudyUrl.includes('website') || titleLower.includes('website');
          matchesCaseType =
            !isWebsiteCase &&
            (caseStudyUrl.includes('content') ||
              titleLower.includes('content') ||
              titleLower.includes('campaign') ||
              titleLower.includes('awareness'));
        } else if (caseType === 'brand') {
          // Brand case studies have "brand" in URL or title, or don't have "content/campaign/awareness/website"
          const isContentCase =
            caseStudyUrl.includes('content') ||
            titleLower.includes('content') ||
            titleLower.includes('campaign') ||
            titleLower.includes('awareness');
          const isWebsiteCase =
            caseStudyUrl.includes('website') || titleLower.includes('website');
          matchesCaseType =
            !isWebsiteCase &&
            (caseStudyUrl.includes('brand') ||
              titleLower.includes('brand') ||
              titleLower.includes('identity') ||
              !isContentCase);
        }

        const matchesVisibility =
          (isInternal && study.permissionLevel === 'internal') ||
          (!isInternal && study.permissionLevel === 'public');

        return matchesClient && matchesCaseType && matchesVisibility;
      });

      if (!matchingStudy) {
        results.push({
          caseId: patch.caseId,
          status: 'not_found',
          message: `No matching case study found for ${patch.caseId}`,
        });
        continue;
      }

      try {
        // Check if existing logo is manual - never overwrite manual logos
        const existingLogoIsManual = matchingStudy.clientLogo?.source === 'manual';
        const shouldSkipLogo = existingLogoIsManual && patch.clientLogo;

        // Prepare logo with default source if not provided
        const clientLogoUpdate = shouldSkipLogo
          ? undefined
          : patch.clientLogo
          ? { ...patch.clientLogo, source: patch.clientLogo.source ?? 'auto' as const }
          : undefined;

        // Apply the patch (skip logo if manual)
        await updateCaseStudy(matchingStudy.id, {
          clientLogo: clientLogoUpdate,
          visuals: patch.visuals,
        });

        const logoStatus = shouldSkipLogo
          ? ' (logo skipped - manual override exists)'
          : patch.clientLogo
          ? ' with new logo'
          : '';

        results.push({
          caseId: patch.caseId,
          status: 'updated',
          message: `Updated ${matchingStudy.title} with ${patch.visuals.length} visuals${logoStatus}`,
        });
      } catch (err) {
        results.push({
          caseId: patch.caseId,
          status: 'error',
          message: `Failed to update: ${err}`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      patchesApplied: results.filter((r) => r.status === 'updated').length,
      results,
    });
  } catch (err) {
    console.error('[apply-media-patches] Error:', err);
    return NextResponse.json(
      { error: 'Failed to apply patches', details: String(err) },
      { status: 500 }
    );
  }
}

// GET endpoint to preview patches without applying
export async function GET() {
  try {
    const patchesPath = path.join(process.cwd(), 'data', 'case-studies', 'case-study-media-patches.json');

    if (!fs.existsSync(patchesPath)) {
      return NextResponse.json(
        { error: 'Patches file not found. Run the ingestion script first.' },
        { status: 404 }
      );
    }

    const patchesContent = fs.readFileSync(patchesPath, 'utf-8');
    const patches: MediaPatch[] = JSON.parse(patchesContent);

    return NextResponse.json({
      patchCount: patches.length,
      patches: patches.map((p) => ({
        caseId: p.caseId,
        hasLogo: !!p.clientLogo,
        visualCount: p.visuals.length,
        visualTypes: [...new Set(p.visuals.map((v) => v.type))],
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to read patches', details: String(err) },
      { status: 500 }
    );
  }
}
