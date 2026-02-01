// app/(public)/review/[token]/page.tsx
// Server component: Client Review Portal page.
// Resolves a project by its review token, loads all files from Creative Review Sets folders,
// reads existing feedback from the Project record, and renders interactive
// ReviewSection client components.

import { notFound } from 'next/navigation';
import { google } from 'googleapis';
import { resolveReviewProject } from '@/lib/review/resolveProject';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import ReviewSection from './ReviewSection';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const TACTICS = ['Display', 'Social', 'Video', 'Audio', 'OOH', 'PMAX', 'Geofence'] as const;
const DEFAULT_SET_NAME = 'Default – Set A';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface TacticSectionData {
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
  if (!resolved) notFound();

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

  // Fetch Creative Review Sets for this project (one per tactic)
  const osBase = getBase();
  const reviewSets = await osBase(AIRTABLE_TABLES.CREATIVE_REVIEW_SETS)
    .select({
      filterByFormula: `FIND("${project.recordId}", ARRAYJOIN({Project})) > 0`,
    })
    .all();

  // Map tactic → folder ID
  const tacticFolderMap = new Map<string, string>();
  for (const set of reviewSets) {
    const fields = set.fields as Record<string, unknown>;
    const tactic = fields['Tactic'] as string;
    const folderId = fields['Folder ID'] as string;
    if (tactic && folderId) {
      tacticFolderMap.set(tactic, folderId);
    }
  }

  // For each tactic, list all files from the set folder
  const sections: TacticSectionData[] = [];

  for (const tactic of TACTICS) {
    const folderId = tacticFolderMap.get(tactic);
    if (!folderId) {
      sections.push({ tactic, assets: [], fileCount: 0 });
      continue;
    }

    const assets = await listAllFiles(drive, folderId);
    sections.push({ tactic, assets, fileCount: assets.length });
  }

  return (
    <main className="min-h-screen bg-[#111827] text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-8 text-2xl font-bold text-white sm:text-3xl">
          {project.name} &ndash; Creative Review
        </h1>

        {sections.map((section) => (
          <ReviewSection
            key={section.tactic}
            tactic={section.tactic}
            assets={section.assets}
            fileCount={section.fileCount}
            token={token}
            initialFeedback={reviewData[section.tactic] ?? { approved: false, comments: '' }}
          />
        ))}
      </div>
    </main>
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
