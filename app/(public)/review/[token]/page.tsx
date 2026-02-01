// app/(public)/review/[token]/page.tsx
// Server component: Client Review Portal page.
// Resolves a project by its review token, loads REVIEW_ files from Drive,
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
}

interface TacticSectionData {
  tactic: string;
  assets: ReviewAsset[];
  finalAssets: ReviewAsset[];
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

  // Resolve Creative Assets root → hubName folder
  const rootFolderId = process.env.CAR_TOYS_PRODUCTION_ASSETS_FOLDER_ID!;
  const creativeAssetsFolder = await findChildFolder(drive, rootFolderId, 'Creative Assets');
  if (!creativeAssetsFolder) notFound();

  const hubFolder = await findChildFolder(drive, creativeAssetsFolder.id, project.hubName);
  if (!hubFolder) notFound();

  // For each tactic, list REVIEW_ files
  const sections: TacticSectionData[] = [];

  for (const tactic of TACTICS) {
    const tacticFolder = await findChildFolder(drive, hubFolder.id, tactic);
    if (!tacticFolder) {
      sections.push({ tactic, assets: [], finalAssets: [] });
      continue;
    }

    const setFolder = await findChildFolder(drive, tacticFolder.id, DEFAULT_SET_NAME);
    if (!setFolder) {
      sections.push({ tactic, assets: [], finalAssets: [] });
      continue;
    }

    const [assets, finalAssets] = await Promise.all([
      listPrefixedFiles(drive, setFolder.id, 'REVIEW_'),
      listPrefixedFiles(drive, setFolder.id, 'FINAL_'),
    ]);
    sections.push({ tactic, assets, finalAssets });
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
            finalAssets={section.finalAssets}
            token={token}
            initialFeedback={reviewData[section.tactic] ?? { approved: false, comments: '' }}
          />
        ))}
      </div>
    </main>
  );
}

// ─── Drive helpers (inline, Shared-Drive-safe) ──────────────────────────────

async function findChildFolder(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  name: string,
): Promise<{ id: string; name: string } | null> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = res.data.files ?? [];
  return files.length > 0 ? { id: files[0].id!, name: files[0].name! } : null;
}

async function listPrefixedFiles(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  prefix: string,
): Promise<ReviewAsset[]> {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and name contains '${prefix}' and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    fileId: f.id!,
    name: f.name!,
    mimeType: f.mimeType || 'application/octet-stream',
  }));
}
