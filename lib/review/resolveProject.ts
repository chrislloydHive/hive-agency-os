// lib/review/resolveProject.ts
// Shared token→project resolver for the Client Review Portal.
// Used by both the public review page and the Drive file proxy API.

import { google } from 'googleapis';
import { getBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getCompanyGoogleOAuthFromDBBase, findCompanyIntegration } from '@/lib/airtable/companyIntegrations';
import { getCompanyOAuthClient } from '@/lib/integrations/googleDrive';
import type { OAuth2Client } from 'google-auth-library';

const COMPANY_FIELD_CANDIDATES = ['Client', 'Company'] as const;

export interface ResolvedReviewProject {
  project: {
    recordId: string;
    name: string;
    hubName: string;
    companyId: string;
    /** Set when scaffold created job under client Projects folder; used for listing/proxy. */
    jobFolderId?: string;
    /** Client Review primary landing page URL (Projects table). Used as default click-through when no per-asset override. */
    primaryLandingPageUrl?: string | null;
  };
  auth: OAuth2Client;
}

function getLinkedRecordId(value: unknown): string | null {
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (typeof first === 'string' && first.length > 0) return first;
    if (typeof first === 'object' && first !== null && 'id' in first) {
      return (first as { id: string }).id;
    }
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

/**
 * Resolve a Client Review Portal token to a project record and OAuth client.
 * Returns null if the token is invalid, the project is not found, or OAuth is unavailable.
 */
export async function resolveReviewProject(token: string): Promise<ResolvedReviewProject | null> {
  // 1. Query Airtable Projects by token
  const osBase = getBase();
  const escaped = token.replace(/"/g, '\\"');
  let records;
  try {
    records = await osBase(AIRTABLE_TABLES.PROJECTS)
      .select({
        filterByFormula: `{Client Review Portal Token} = "${escaped}"`,
        maxRecords: 1,
      })
      .firstPage();
  } catch (err) {
    console.error('[review/resolveProject] Airtable query failed:', err);
    return null;
  }

  if (!records || records.length === 0) return null;

  const record = records[0];
  const fields = record.fields as Record<string, unknown>;

  // 2. Extract project name — canonical field only (no fallbacks)
  const CANONICAL_PROJECT_NAME_FIELD = 'Project Name (Job #)';
  const raw = fields[CANONICAL_PROJECT_NAME_FIELD];
  const projectName =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
  if (!projectName) return null;

  const hubName = `${projectName} – Creative Review`;

  // 3. Resolve companyId
  let companyId: string | null = null;
  for (const fieldName of COMPANY_FIELD_CANDIDATES) {
    const id = getLinkedRecordId(fields[fieldName]);
    if (id) {
      companyId = id;
      break;
    }
  }
  if (!companyId) return null;

  // 4. Resolve clientCode + companyName for OAuth lookup
  let clientCode: string | undefined;
  let companyName: string | undefined;

  const projectClientCode = fields['Client Code'] ?? fields['ClientCode'];
  if (typeof projectClientCode === 'string' && projectClientCode.length > 0) {
    clientCode = projectClientCode;
  }

  try {
    const companyRecord = await osBase('Companies').find(companyId);
    const cf = companyRecord.fields as Record<string, unknown>;
    if (!clientCode) {
      const code = cf['Client Code'] ?? cf['ClientCode'];
      if (typeof code === 'string' && code.length > 0) clientCode = code;
    }
    companyName = (cf['Company Name'] as string) || (cf['Name'] as string) || undefined;
  } catch {
    // Company lookup is best-effort
  }

  // 5. Resolve OAuth — same cascade as scaffold
  let auth: OAuth2Client | null = null;

  // Step 1: Multi-base CompanyIntegrations lookup
  try {
    const oauth = await getCompanyGoogleOAuthFromDBBase(companyId, { clientCode, companyName });
    if (oauth?.googleRefreshToken) {
      const cid = process.env.GOOGLE_CLIENT_ID!;
      const csecret = process.env.GOOGLE_CLIENT_SECRET!;
      const oauth2Client = new google.auth.OAuth2(cid, csecret);
      oauth2Client.setCredentials({ refresh_token: oauth.googleRefreshToken });
      auth = oauth2Client;
    }
  } catch {
    // fall through to fallback
  }

  // Step 2: Fallback to per-company OAuth
  if (!auth) {
    try {
      auth = await getCompanyOAuthClient(companyId);
    } catch {
      // both failed
    }
  }

  if (!auth) return null;

  console.log('[review/resolveProject]', {
    recordId: record.id,
    projectName,
    hubName,
  });

  const jobFolderIdRaw =
    fields['Creative Review Hub Folder ID'] ?? fields['CRH Folder ID'] ?? fields['Job Folder ID'];
  const jobFolderId =
    typeof jobFolderIdRaw === 'string' && jobFolderIdRaw.trim()
      ? jobFolderIdRaw.trim()
      : undefined;

  const primaryLandingPageUrlRaw = fields['Client Review Primary Landing Page URL'];
  const primaryLandingPageUrl =
    typeof primaryLandingPageUrlRaw === 'string' && primaryLandingPageUrlRaw.trim()
      ? primaryLandingPageUrlRaw.trim()
      : undefined;

  return {
    project: {
      recordId: record.id,
      name: projectName,
      hubName,
      companyId,
      jobFolderId,
      primaryLandingPageUrl: primaryLandingPageUrl ?? null,
    },
    auth,
  };
}
