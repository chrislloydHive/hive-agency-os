// app/(public)/review/[token]/page.tsx
// Server component: Client Review Portal page.
// Resolves a project by its review token, loads all files from Creative Review Sets folders,
// reads existing feedback from the Project record, and renders interactive
// ReviewSection client components organized by variant (Prospecting/Retargeting).

import { notFound } from 'next/navigation';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import ReviewPortalClient from './ReviewPortalClient';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VARIANTS = ['Prospecting', 'Retargeting'] as const;
const TACTICS = ['Audio', 'Display', 'Geofence', 'OOH', 'PMAX', 'Social', 'Video', 'Search'] as const;

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface TacticSectionData {
  variant: string;
  tactic: string;
  assets: ReviewAsset[];
  fileCount: number;
}

interface TacticFeedback {
  approved: boolean;
  comments: string;
}

type ReviewData = Record<string, TacticFeedback>;

function parseReviewData(raw: unknown): ReviewData {
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ReviewData;
      }
    } catch {
      // corrupted — return empty
    }
  }
  return {};
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const resolved = await resolveReviewProject(token);
  if (!resolved) return { title: 'Review Not Found' };
  return { title: `${resolved.project.name} – Creative Review` };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveReviewProject(token);
  if (!resolved) {
    console.error(`[review/page] Token not found or invalid: ${token.slice(0, 20)}...`);
    notFound();
  }

  const { project, auth } = resolved;
  const drive = google.drive({ version: 'v3', auth });

  // Load existing feedback from the Project record
  let reviewData: ReviewData = {};
  try {
    const osBase = getBase();
    const record = await osBase(AIRTABLE_TABLES.PROJECTS).find(project.recordId);
    const fields = record.fields as Record<string, unknown>;
    reviewData = parseReviewData(fields['Client Review Data']);
  } catch {
    // If read fails, start with empty feedback
  }

  // Fetch Creative Review Sets for this project (one per variant×tactic)
  const osBase = getBase();
  const reviewSets = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS)
    .select({
      filterByFormula: `FIND("${project.recordId}", ARRAYJOIN({Project})) > 0`,
    })
    .all();

  // Map (variant, tactic) → folder ID
  const folderMap = new Map<string, string>();
  for (const set of reviewSets) {
    const fields = set.fields as Record<string, unknown>;
    const variant = fields['Variant'] as string;
    const tactic = fields['Tactic'] as string;
    const folderId = fields['Folder ID'] as string;
    if (variant && tactic && folderId) {
      folderMap.set(`${variant}:${tactic}`, folderId);
    }
  }

  // For each variant×tactic, list all files from the set folder
  const sections: TacticSectionData[] = [];

  for (const variant of VARIANTS) {
    for (const tactic of TACTICS) {
      const folderId = folderMap.get(`${variant}:${tactic}`);
      if (!folderId) {
        sections.push({ variant, tactic, assets: [], fileCount: 0 });
        continue;
      }

      const assets = await listAllFiles(drive, folderId);
      sections.push({ variant, tactic, assets, fileCount: assets.length });
    }
  }

  return (
    <ReviewPortalClient
      projectName={project.name}
      sections={sections}
      reviewData={reviewData}
      token={token}
      variants={[...VARIANTS]}
    />
  );
}

// ─── Drive helpers (inline, Shared-Drive-safe) ──────────────────────────────

/**
 * List all non-trashed files in a folder, sorted by modified time descending.
 */
async function listAllFiles(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
): Promise<ReviewAsset[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    fileId: f.id!,
    name: f.name!,
    mimeType: f.mimeType || 'application/octet-stream',
    modifiedTime: f.modifiedTime || '',
  }));
}
