// lib/integrations/googleDrive.ts
// Google Drive, Docs, Sheets, Slides API Client
//
// Provides authenticated access to Google Workspace APIs for creating
// and managing artifacts (Strategy Docs, QBR Slides, Briefs, etc.)
//
// Uses per-company OAuth tokens stored in CompanyIntegrations.

import { google, docs_v1, sheets_v4, slides_v1, drive_v3 } from 'googleapis';
import { getCompanyIntegrations } from '@/lib/airtable/companyIntegrations';
import type { GoogleFileType } from '@/lib/types/artifact';

// ============================================================================
// Types
// ============================================================================

export interface GoogleDriveClientConfig {
  companyId: string;
}

export interface CreateFileOptions {
  name: string;
  mimeType: GoogleMimeType;
  parentFolderId?: string;
  description?: string;
}

export interface CreateDocumentOptions {
  title: string;
  parentFolderId?: string;
  content?: DocumentContent;
}

export interface CreateSlidesOptions {
  title: string;
  parentFolderId?: string;
}

export interface CreateSheetOptions {
  title: string;
  parentFolderId?: string;
}

export interface CreateFolderOptions {
  name: string;
  parentFolderId?: string;
}

export interface DocumentContent {
  sections: DocumentSection[];
}

export interface DocumentSection {
  heading?: string;
  headingLevel?: 1 | 2 | 3;
  body: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  modifiedTime: string;
  createdTime: string;
  parents?: string[];
}

export type GoogleMimeType =
  | 'application/vnd.google-apps.document'
  | 'application/vnd.google-apps.spreadsheet'
  | 'application/vnd.google-apps.presentation'
  | 'application/vnd.google-apps.folder';

// ============================================================================
// Constants
// ============================================================================

export const GOOGLE_MIME_TYPES: Record<GoogleFileType, GoogleMimeType> = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
  folder: 'application/vnd.google-apps.folder',
};

export const MIME_TYPE_TO_FILE_TYPE: Record<string, GoogleFileType> = {
  'application/vnd.google-apps.document': 'document',
  'application/vnd.google-apps.spreadsheet': 'spreadsheet',
  'application/vnd.google-apps.presentation': 'presentation',
  'application/vnd.google-apps.folder': 'folder',
};

// ============================================================================
// OAuth Client Factory
// ============================================================================

/**
 * Get an authenticated OAuth2 client for a company
 */
export async function getCompanyOAuthClient(companyId: string) {
  const integrations = await getCompanyIntegrations(companyId);

  if (!integrations?.google?.connected || !integrations.google.refreshToken) {
    throw new GoogleDriveError(
      'GOOGLE_NOT_CONNECTED',
      `Google is not connected for company ${companyId}. Please connect Google first.`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new GoogleDriveError(
      'GOOGLE_NOT_CONFIGURED',
      'Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.'
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  oauth2Client.setCredentials({
    refresh_token: integrations.google.refreshToken,
    access_token: integrations.google.accessToken,
  });

  return oauth2Client;
}

// ============================================================================
// Error Types
// ============================================================================

export class GoogleDriveError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GoogleDriveError';
    this.code = code;
  }
}

// ============================================================================
// Google Drive Client
// ============================================================================

/**
 * Google Drive client for a specific company
 */
export class GoogleDriveClient {
  private companyId: string;
  private _drive: drive_v3.Drive | null = null;
  private _docs: docs_v1.Docs | null = null;
  private _sheets: sheets_v4.Sheets | null = null;
  private _slides: slides_v1.Slides | null = null;

  constructor(config: GoogleDriveClientConfig) {
    this.companyId = config.companyId;
  }

  /**
   * Get Drive API client (lazy initialization)
   */
  async getDrive(): Promise<drive_v3.Drive> {
    if (!this._drive) {
      const auth = await getCompanyOAuthClient(this.companyId);
      this._drive = google.drive({ version: 'v3', auth });
    }
    return this._drive;
  }

  /**
   * Get Docs API client (lazy initialization)
   */
  async getDocs(): Promise<docs_v1.Docs> {
    if (!this._docs) {
      const auth = await getCompanyOAuthClient(this.companyId);
      this._docs = google.docs({ version: 'v1', auth });
    }
    return this._docs;
  }

  /**
   * Get Sheets API client (lazy initialization)
   */
  async getSheets(): Promise<sheets_v4.Sheets> {
    if (!this._sheets) {
      const auth = await getCompanyOAuthClient(this.companyId);
      this._sheets = google.sheets({ version: 'v4', auth });
    }
    return this._sheets;
  }

  /**
   * Get Slides API client (lazy initialization)
   */
  async getSlides(): Promise<slides_v1.Slides> {
    if (!this._slides) {
      const auth = await getCompanyOAuthClient(this.companyId);
      this._slides = google.slides({ version: 'v1', auth });
    }
    return this._slides;
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  /**
   * Get file metadata by ID
   */
  async getFile(fileId: string): Promise<FileMetadata | null> {
    try {
      const drive = await this.getDrive();
      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, webViewLink, webContentLink, modifiedTime, createdTime, parents',
      });

      if (!response.data.id) {
        return null;
      }

      return {
        id: response.data.id,
        name: response.data.name || '',
        mimeType: response.data.mimeType || '',
        webViewLink: response.data.webViewLink || '',
        webContentLink: response.data.webContentLink || undefined,
        modifiedTime: response.data.modifiedTime || '',
        createdTime: response.data.createdTime || '',
        parents: response.data.parents || undefined,
      };
    } catch (error) {
      console.error(`[GoogleDrive] Failed to get file ${fileId}:`, error);
      return null;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(options: CreateFolderOptions): Promise<FileMetadata> {
    const drive = await this.getDrive();

    const fileMetadata: drive_v3.Schema$File = {
      name: options.name,
      mimeType: GOOGLE_MIME_TYPES.folder,
    };

    if (options.parentFolderId) {
      fileMetadata.parents = [options.parentFolderId];
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, webViewLink, modifiedTime, createdTime, parents',
    });

    if (!response.data.id) {
      throw new GoogleDriveError('CREATE_FOLDER_FAILED', 'Failed to create folder');
    }

    return {
      id: response.data.id,
      name: response.data.name || options.name,
      mimeType: response.data.mimeType || GOOGLE_MIME_TYPES.folder,
      webViewLink: response.data.webViewLink || '',
      modifiedTime: response.data.modifiedTime || new Date().toISOString(),
      createdTime: response.data.createdTime || new Date().toISOString(),
      parents: response.data.parents || undefined,
    };
  }

  /**
   * Create a Google Doc
   */
  async createDocument(options: CreateDocumentOptions): Promise<FileMetadata> {
    const docs = await this.getDocs();
    const drive = await this.getDrive();

    // Create the document
    const docResponse = await docs.documents.create({
      requestBody: {
        title: options.title,
      },
    });

    if (!docResponse.data.documentId) {
      throw new GoogleDriveError('CREATE_DOC_FAILED', 'Failed to create document');
    }

    const documentId = docResponse.data.documentId;

    // Move to parent folder if specified
    if (options.parentFolderId) {
      await drive.files.update({
        fileId: documentId,
        addParents: options.parentFolderId,
        fields: 'id, parents',
      });
    }

    // Add content if provided
    if (options.content && options.content.sections.length > 0) {
      await this.populateDocument(documentId, options.content);
    }

    // Get full file metadata
    const metadata = await this.getFile(documentId);
    if (!metadata) {
      throw new GoogleDriveError('GET_FILE_FAILED', 'Failed to get document metadata');
    }

    return metadata;
  }

  /**
   * Populate a Google Doc with content
   */
  async populateDocument(documentId: string, content: DocumentContent): Promise<void> {
    const docs = await this.getDocs();

    // Build requests for each section (insert in reverse order since we insert at index 1)
    const requests: docs_v1.Schema$Request[] = [];

    // Process sections in reverse order (last section first)
    const reversedSections = [...content.sections].reverse();

    for (const section of reversedSections) {
      // Add body text
      if (section.body) {
        requests.push({
          insertText: {
            location: { index: 1 },
            text: section.body + '\n\n',
          },
        });
      }

      // Add heading if present
      if (section.heading) {
        const headingStyle = section.headingLevel === 1
          ? 'HEADING_1'
          : section.headingLevel === 2
            ? 'HEADING_2'
            : 'HEADING_3';

        requests.push({
          insertText: {
            location: { index: 1 },
            text: section.heading + '\n',
          },
        });

        // Apply heading style (we need to know the range, which is tricky)
        // For now, just insert as text - styling can be added later
      }
    }

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    }
  }

  /**
   * Create a Google Slides presentation
   */
  async createPresentation(options: CreateSlidesOptions): Promise<FileMetadata> {
    const slides = await this.getSlides();
    const drive = await this.getDrive();

    // Create the presentation
    const presentationResponse = await slides.presentations.create({
      requestBody: {
        title: options.title,
      },
    });

    if (!presentationResponse.data.presentationId) {
      throw new GoogleDriveError('CREATE_SLIDES_FAILED', 'Failed to create presentation');
    }

    const presentationId = presentationResponse.data.presentationId;

    // Move to parent folder if specified
    if (options.parentFolderId) {
      await drive.files.update({
        fileId: presentationId,
        addParents: options.parentFolderId,
        fields: 'id, parents',
      });
    }

    // Get full file metadata
    const metadata = await this.getFile(presentationId);
    if (!metadata) {
      throw new GoogleDriveError('GET_FILE_FAILED', 'Failed to get presentation metadata');
    }

    return metadata;
  }

  /**
   * Create a Google Sheet
   */
  async createSpreadsheet(options: CreateSheetOptions): Promise<FileMetadata> {
    const sheets = await this.getSheets();
    const drive = await this.getDrive();

    // Create the spreadsheet
    const sheetResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: options.title,
        },
      },
    });

    if (!sheetResponse.data.spreadsheetId) {
      throw new GoogleDriveError('CREATE_SHEET_FAILED', 'Failed to create spreadsheet');
    }

    const spreadsheetId = sheetResponse.data.spreadsheetId;

    // Move to parent folder if specified
    if (options.parentFolderId) {
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: options.parentFolderId,
        fields: 'id, parents',
      });
    }

    // Get full file metadata
    const metadata = await this.getFile(spreadsheetId);
    if (!metadata) {
      throw new GoogleDriveError('GET_FILE_FAILED', 'Failed to get spreadsheet metadata');
    }

    return metadata;
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const drive = await this.getDrive();
      await drive.files.delete({ fileId });
      return true;
    } catch (error) {
      console.error(`[GoogleDrive] Failed to delete file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(
    folderId?: string,
    options?: { mimeType?: GoogleMimeType; maxResults?: number }
  ): Promise<FileMetadata[]> {
    const drive = await this.getDrive();

    let query = '';
    if (folderId) {
      query = `'${folderId}' in parents and trashed = false`;
    } else {
      query = 'trashed = false';
    }

    if (options?.mimeType) {
      query += ` and mimeType = '${options.mimeType}'`;
    }

    const response = await drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink, modifiedTime, createdTime, parents)',
      pageSize: options?.maxResults || 100,
      orderBy: 'modifiedTime desc',
    });

    return (response.data.files || []).map(file => ({
      id: file.id || '',
      name: file.name || '',
      mimeType: file.mimeType || '',
      webViewLink: file.webViewLink || '',
      webContentLink: file.webContentLink || undefined,
      modifiedTime: file.modifiedTime || '',
      createdTime: file.createdTime || '',
      parents: file.parents || undefined,
    }));
  }

  // ---------------------------------------------------------------------------
  // Folder Management
  // ---------------------------------------------------------------------------

  /**
   * Get or create a company folder for artifacts
   */
  async getOrCreateCompanyFolder(companyName: string): Promise<FileMetadata> {
    const drive = await this.getDrive();
    const folderName = `Hive OS - ${companyName}`;

    // Check if folder exists
    const response = await drive.files.list({
      q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, createdTime)',
    });

    if (response.data.files && response.data.files.length > 0) {
      const folder = response.data.files[0];
      return {
        id: folder.id || '',
        name: folder.name || folderName,
        mimeType: GOOGLE_MIME_TYPES.folder,
        webViewLink: folder.webViewLink || '',
        modifiedTime: folder.modifiedTime || '',
        createdTime: folder.createdTime || '',
      };
    }

    // Create folder
    return this.createFolder({ name: folderName });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Google Drive client for a company
 */
export function createGoogleDriveClient(companyId: string): GoogleDriveClient {
  return new GoogleDriveClient({ companyId });
}

/**
 * Check if Google Drive is available for a company
 */
export async function isGoogleDriveAvailable(companyId: string): Promise<boolean> {
  try {
    const integrations = await getCompanyIntegrations(companyId);
    return !!(integrations?.google?.connected && integrations.google.refreshToken);
  } catch {
    return false;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a Strategy Document in Google Drive
 */
export async function createStrategyDocument(
  companyId: string,
  title: string,
  content: DocumentContent,
  folderId?: string
): Promise<FileMetadata> {
  const client = createGoogleDriveClient(companyId);
  return client.createDocument({
    title,
    content,
    parentFolderId: folderId,
  });
}

/**
 * Create a QBR Presentation in Google Drive
 */
export async function createQbrPresentation(
  companyId: string,
  title: string,
  folderId?: string
): Promise<FileMetadata> {
  const client = createGoogleDriveClient(companyId);
  return client.createPresentation({
    title,
    parentFolderId: folderId,
  });
}

/**
 * Create a Brief Document in Google Drive
 */
export async function createBriefDocument(
  companyId: string,
  title: string,
  content: DocumentContent,
  folderId?: string
): Promise<FileMetadata> {
  const client = createGoogleDriveClient(companyId);
  return client.createDocument({
    title,
    content,
    parentFolderId: folderId,
  });
}

/**
 * Create a Media Plan Spreadsheet in Google Drive
 */
export async function createMediaPlanSpreadsheet(
  companyId: string,
  title: string,
  folderId?: string
): Promise<FileMetadata> {
  const client = createGoogleDriveClient(companyId);
  return client.createSpreadsheet({
    title,
    parentFolderId: folderId,
  });
}
