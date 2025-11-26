// app/api/client-brain/documents/route.ts
// CRUD operations for Client Documents

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyDocuments,
  createClientDocument,
} from '@/lib/airtable/clientBrain';
import { normalizeDocumentType } from '@/lib/types/clientBrain';
import type { DocumentType } from '@/lib/types/clientBrain';

// GET /api/client-brain/documents?companyId=xxx&type=xxx&limit=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    const options: {
      type?: DocumentType;
      limit?: number;
    } = {};

    if (type) {
      options.type = normalizeDocumentType(type) || undefined;
    }
    if (limit) {
      options.limit = parseInt(limit, 10);
    }

    const documents = await getCompanyDocuments(companyId, options);

    return NextResponse.json({
      success: true,
      documents,
      total: documents.length,
    });

  } catch (error) {
    console.error('[Documents API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/client-brain/documents - Create a new document record
// Note: This creates the metadata record. Actual file upload should be handled separately
// (e.g., direct to cloud storage, then this API to create the record)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      name,
      type,
      mimeType,
      sizeBytes,
      storageUrl,
      uploadedBy,
      textExtracted,
      textPreview,
      notes,
    } = body;

    if (!companyId || !name || !mimeType || !sizeBytes || !storageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: companyId, name, mimeType, sizeBytes, storageUrl' },
        { status: 400 }
      );
    }

    const document = await createClientDocument({
      companyId,
      name,
      type: type ? normalizeDocumentType(type) : null,
      mimeType,
      sizeBytes,
      storageUrl,
      uploadedBy: uploadedBy || null,
      textExtracted: textExtracted || false,
      textPreview: textPreview || null,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      document,
    });

  } catch (error) {
    console.error('[Documents API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create document' },
      { status: 500 }
    );
  }
}
