// lib/review/resolveProject.ts
// Shared token→project resolver for the Client Review Portal.
// Used by both the public review page and the Drive file proxy API.

import { google } from 'googleapis';
import { getBase, getProjectsBase } from '@/lib/airtable';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import { getCompanyGoogleOAuthFromDBBase, findCompanyIntegration } from '@/lib/airtable/companyIntegrations';
import { getCompanyOAuthClient } from '@/lib/integrations/googleDrive';
import type { OAuth2Client } from 'google-auth-library';

const COMPANY_FIELD_CANDIDATES = ['Client', 'Company'] as const;

/** Projects table: field that stores the review portal token. Override with REVIEW_PORTAL_TOKEN_FIELD if your base uses a different name. */
const REVIEW_PORTAL_TOKEN_FIELD =
  (typeof process !== 'undefined' && process.env?.REVIEW_PORTAL_TOKEN_FIELD?.trim()) || 'Client Review Portal Token';

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

export interface ResolvedReviewProjectWithoutAuth {
  project: {
    recordId: string;
    name: string;
    hubName: string;
    companyId: string;
    jobFolderId?: string;
    primaryLandingPageUrl?: string | null;
  };
  oauthError: string;
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
 * Get company id (and optional client code) from a review portal token.
 * Use for reconnect flows when you don't need the full OAuth client.
 * Does not require the company to exist in the OS Companies table.
 */
export async function getReviewCompanyFromToken(token: string): Promise<{ companyId: string; clientCode?: string } | null> {
  const projectsBase = getProjectsBase();
  const escaped = token.replace(/"/g, '\\"');
  let records;
  try {
    records = await projectsBase(AIRTABLE_TABLES.PROJECTS)
      .select({
        filterByFormula: `{${REVIEW_PORTAL_TOKEN_FIELD}} = "${escaped}"`,
        maxRecords: 1,
      })
      .firstPage();
  } catch (err) {
    console.error('[review/resolveProject] Airtable query failed:', err);
    const errStr = err instanceof Error ? err.message : String(err);
    const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
    if (baseId && errStr.includes('Unknown field')) {
      const projectsBaseId = process.env.AIRTABLE_PROJECTS_BASE_ID || process.env.REVIEW_PROJECTS_BASE_ID || '(using default base)';
      console.error(
        `[review/resolveProject] Hint: The base used for Projects (${String(projectsBaseId).slice(0, 20)}…) may not have a Projects table with field "${REVIEW_PORTAL_TOKEN_FIELD}". ` +
          'If your Projects table is in a different Airtable base, set AIRTABLE_PROJECTS_BASE_ID (or REVIEW_PROJECTS_BASE_ID) to that base ID in .env.local.'
      );
    }
    return null;
  }
  if (!records || records.length === 0) return null;
  const fields = records[0].fields as Record<string, unknown>;
  const companyId = getLinkedRecordId(fields['Client'] ?? fields['Company']);
  if (!companyId) return null;
  const projectClientCode = fields['Client Code'] ?? fields['ClientCode'];
  const clientCode = typeof projectClientCode === 'string' && projectClientCode.trim().length > 0 ? projectClientCode.trim() : undefined;
  return { companyId, clientCode };
}

/**
 * Resolve a Client Review Portal token to a project record and OAuth client.
 * Returns null if the token is invalid, the project is not found, or OAuth is unavailable.
 */
export async function resolveReviewProject(token: string): Promise<ResolvedReviewProject | null> {
  // 1. Query Airtable Projects by token (use getProjectsBase() so Projects can live in a different base)
  const projectsBase = getProjectsBase();
  const escaped = token.replace(/"/g, '\\"');
  let records;
  try {
    records = await projectsBase(AIRTABLE_TABLES.PROJECTS)
      .select({
        filterByFormula: `{${REVIEW_PORTAL_TOKEN_FIELD}} = "${escaped}"`,
        maxRecords: 1,
      })
      .firstPage();
  } catch (err) {
    console.error('[review/resolveProject] Airtable query failed:', err);
    const errStr = err instanceof Error ? err.message : String(err);
    const baseId = process.env.AIRTABLE_OS_BASE_ID || process.env.AIRTABLE_BASE_ID || '';
    if (baseId && errStr.includes('Unknown field')) {
      const projectsBaseId = process.env.AIRTABLE_PROJECTS_BASE_ID || process.env.REVIEW_PROJECTS_BASE_ID || '(using default base)';
      console.error(
        `[review/resolveProject] Hint: The base used for Projects (${String(projectsBaseId).slice(0, 20)}…) may not have a Projects table with field "${REVIEW_PORTAL_TOKEN_FIELD}". ` +
          'If your Projects table is in a different Airtable base, set AIRTABLE_PROJECTS_BASE_ID (or REVIEW_PROJECTS_BASE_ID) to that base ID in .env.local.'
      );
    }
    return null;
  }

  if (!records || records.length === 0) {
    console.warn(`[review/resolveProject] No project found for token: ${token.slice(0, 20)}...`);
    return null;
  }

  const record = records[0];
  const fields = record.fields as Record<string, unknown>;

  // 2. Extract project name — canonical field only (no fallbacks)
  const CANONICAL_PROJECT_NAME_FIELD = 'Project Name (Job #)';
  const raw = fields[CANONICAL_PROJECT_NAME_FIELD];
  const projectName =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '';
  if (!projectName) {
    console.warn(`[review/resolveProject] Project ${record.id} missing "${CANONICAL_PROJECT_NAME_FIELD}" field`);
    return null;
  }

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
  if (!companyId) {
    console.warn(`[review/resolveProject] Project ${record.id} missing Company/Client linked record`);
    return null;
  }

  // 4. Resolve clientCode + companyName for OAuth lookup
  let clientCode: string | undefined;
  let companyName: string | undefined;

  const projectClientCode = fields['Client Code'] ?? fields['ClientCode'];
  if (typeof projectClientCode === 'string' && projectClientCode.length > 0) {
    clientCode = projectClientCode;
  }

  try {
    const osBase = getBase();
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
  let oauthError: Error | null = null;

  // Step 1: Multi-base CompanyIntegrations lookup
  try {
    const oauth = await getCompanyGoogleOAuthFromDBBase(companyId, { clientCode, companyName });
    if (oauth?.googleRefreshToken) {
      const cid = process.env.GOOGLE_CLIENT_ID!;
      const csecret = process.env.GOOGLE_CLIENT_SECRET!;
      const oauth2Client = new google.auth.OAuth2(cid, csecret);
      oauth2Client.setCredentials({ refresh_token: oauth.googleRefreshToken });
      auth = oauth2Client;
      console.log(`[review/resolveProject] OAuth resolved via getCompanyGoogleOAuthFromDBBase (matched by: ${oauth.matchedBy})`);
    } else {
      console.log(`[review/resolveProject] getCompanyGoogleOAuthFromDBBase returned null (no refresh token found)`);
      if (oauth?.debug?.attempts) {
        const permissionErrors = oauth.debug.attempts.filter(a => !a.ok && (a.status === 403 || a.status === 401));
        if (permissionErrors.length > 0) {
          console.warn(`[review/resolveProject] Permission errors (403/401) encountered: ${permissionErrors.length} attempts failed`);
        }
      }
    }
  } catch (err) {
    oauthError = err instanceof Error ? err : new Error(String(err));
    console.warn(`[review/resolveProject] getCompanyGoogleOAuthFromDBBase failed:`, oauthError.message);
    // fall through to fallback
  }

  // Step 2: Fallback to per-company OAuth
  if (!auth) {
    try {
      auth = await getCompanyOAuthClient(companyId);
      console.log(`[review/resolveProject] OAuth resolved via getCompanyOAuthClient fallback`);
    } catch (err) {
      const fallbackError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[review/resolveProject] getCompanyOAuthClient fallback also failed:`, fallbackError.message);
      oauthError = fallbackError;
    }
  }

  if (!auth) {
    const errorMessage = oauthError?.message || 'Unknown error';
    console.error(`[review/resolveProject] Could not resolve OAuth client for company ${companyId} (project ${record.id})`);
    console.error(`[review/resolveProject] Last error:`, errorMessage);
    console.error(`[review/resolveProject] Troubleshooting: Check that AIRTABLE_API_KEY has read access to CompanyIntegrations table in AIRTABLE_DB_BASE_ID or AIRTABLE_OS_BASE_ID`);
    
    // Prepare project info for error page
    const jobFolderIdRaw =
      fields['Creative Review Hub Folder ID'] ?? fields['CRH Folder ID'] ?? fields['Job Folder ID'];
    const jobFolderId =
      typeof jobFolderIdRaw === 'string' && jobFolderIdRaw.trim()
        ? jobFolderIdRaw.trim()
        : undefined;

    const primaryLandingPageUrlRaw = fields['Primary Landing Page URL'] ?? fields['Client Review Primary Landing Page URL'];
    const primaryLandingPageUrl =
      typeof primaryLandingPageUrlRaw === 'string' && primaryLandingPageUrlRaw.trim()
        ? primaryLandingPageUrlRaw.trim()
        : undefined;

    // Throw a specific error that the page can catch and handle
    // Use a plain Error object with additional properties for better compatibility
    const error = new Error(`OAuth resolution failed: ${errorMessage}`);
    (error as any).code = 'OAUTH_RESOLUTION_FAILED';
    (error as any).project = {
      recordId: record.id,
      name: projectName,
      hubName,
      companyId,
      jobFolderId,
      primaryLandingPageUrl: primaryLandingPageUrl ?? null,
    };
    throw error;
  }

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

  const primaryLandingPageUrlRaw = fields['Primary Landing Page URL'] ?? fields['Client Review Primary Landing Page URL'];
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
