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
import { batchEnsureCrasRecords } from '@/lib/airtable/reviewAssetStatus';
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
  groupId?: string; // Creative Review Sets record ID
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
  try {
    const resolved = await resolveReviewProject(token);
    if (!resolved) return { title: 'Review Not Found' };
    return { title: `${resolved.project.name} – Creative Review` };
  } catch (error: any) {
    // If OAuth failed but project exists, use project name from error
    if (error?.code === 'OAUTH_RESOLUTION_FAILED' && error?.project) {
      return { title: `${error.project.name} – Review Portal Error` };
    }
    return { title: 'Review Portal Error' };
  }
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let resolved;
  try {
    resolved = await resolveReviewProject(token);
  } catch (error: any) {
    // OAuth resolution failed but project exists
    if (error?.code === 'OAUTH_RESOLUTION_FAILED' && error?.project) {
      console.error(`[review/page] OAuth resolution failed for project: ${error.project.name}`);
      // Show helpful error page instead of 404
      return (
        <div className="min-h-screen bg-[#050509] flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900/70 rounded-xl p-8 border border-slate-700">
            <h1 className="text-2xl font-bold text-white mb-4">Unable to Access Review Portal</h1>
            <p className="text-slate-300 mb-4">
              The review portal for <strong className="text-white">{error.project.name}</strong> could not be loaded because Google Drive authentication failed.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
              <p className="text-amber-200 text-sm">
                <strong>Error:</strong> {error.message}
              </p>
            </div>
            <div className="text-slate-400 text-sm space-y-2">
              <p><strong>Possible causes:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                {error.message.includes('Google is not connected') ? (
                  <>
                    <li><strong>Google OAuth is not connected for this company</strong> - The CompanyIntegrations record exists but doesn't have Google OAuth tokens configured</li>
                    <li>You need to connect Google for this company via the OAuth flow</li>
                    <li>Check the CompanyIntegrations table in Airtable - ensure there's a record with GoogleConnected = true and a valid GoogleRefreshToken</li>
                  </>
                ) : (
                  <>
                    <li>The Airtable API token lacks read access to the CompanyIntegrations table</li>
                    <li>Google OAuth tokens are missing or expired for this company</li>
                    <li>The CompanyIntegrations table is in a different base (check AIRTABLE_DB_BASE_ID or AIRTABLE_OS_BASE_ID)</li>
                  </>
                )}
              </ul>
              <p className="mt-4">
                Please contact your administrator to resolve this authentication issue.
              </p>
            </div>
          </div>
        </div>
      );
    }
    // Re-throw other errors
    throw error;
  }
  
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

  // Map (variant, tactic) → { folderId, groupId }
  const folderMap = new Map<string, { folderId: string; groupId: string }>();
  for (const set of reviewSets) {
    const fields = set.fields as Record<string, unknown>;
    const variant = fields['Variant'] as string;
    const tactic = fields['Tactic'] as string;
    const folderId = fields['Folder ID'] as string;
    if (variant && tactic && folderId) {
      folderMap.set(`${variant}:${tactic}`, { folderId, groupId: set.id });
    }
  }

  // For each variant×tactic, list all files from the set folder
  const sections: TacticSectionData[] = [];
  const allAssetsForCras: Array<{ fileId: string; filename: string; tactic: string; variant: string }> = [];

  for (const variant of VARIANTS) {
    for (const tactic of TACTICS) {
      const folderInfo = folderMap.get(`${variant}:${tactic}`);
      if (!folderInfo) {
        sections.push({ variant, tactic, assets: [], fileCount: 0 });
        continue;
      }

      const assets = await listAllFiles(drive, folderInfo.folderId);
      sections.push({ 
        variant, 
        tactic, 
        assets, 
        fileCount: assets.length,
        groupId: folderInfo.groupId,
      });
      
      // Collect assets for batch CRAS creation
      for (const asset of assets) {
        allAssetsForCras.push({
          fileId: asset.fileId,
          filename: asset.name,
          tactic,
          variant,
        });
      }
    }
  }

  // Batch ensure CRAS records exist for all displayed assets
  if (allAssetsForCras.length > 0) {
    try {
      const result = await batchEnsureCrasRecords(token, project.recordId, allAssetsForCras);
      console.log(`[review/page] Ensured CRAS records: ${result.created} created, ${result.errors} errors`);
    } catch (err) {
      // Log but don't fail page load - assets will still display
      console.error('[review/page] Failed to ensure CRAS records:', err);
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
  const files = (res.data.files ?? []).map((f) => ({
    fileId: f.id!,
    name: f.name!,
    mimeType: f.mimeType || 'application/octet-stream',
    modifiedTime: f.modifiedTime || '',
  }));
  
  // Deduplicate by fileId (keep first occurrence, which is most recent due to ordering)
  const seen = new Set<string>();
  return files.filter((f) => {
    if (seen.has(f.fileId)) {
      console.warn(`[review/page] Duplicate fileId detected: ${f.fileId} (${f.name}), skipping duplicate`);
      return false;
    }
    seen.add(f.fileId);
    return true;
  });
}
