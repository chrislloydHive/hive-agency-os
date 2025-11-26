// app/api/client-brain/documents/[documentId]/route.ts
// Single document operations: GET, PATCH, DELETE

import { NextRequest, NextResponse } from 'next/server';
import {
  getDocumentById,
  updateDocument,
  deleteDocument,
} from '@/lib/airtable/clientBrain';
import { normalizeDocumentType } from '@/lib/types/clientBrain';

interface RouteParams {
  params: Promise<{ documentId: string }>;
}

// GET /api/client-brain/documents/[documentId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    const document = await getDocumentById(documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      document,
    });

  } catch (error) {
    console.error('[Document API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PATCH /api/client-brain/documents/[documentId]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;
    const body = await request.json();
    const { name, type, textExtracted, textPreview, notes } = body;

    const updates: Parameters<typeof updateDocument>[1] = {};

    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = normalizeDocumentType(type);
    if (textExtracted !== undefined) updates.textExtracted = textExtracted;
    if (textPreview !== undefined) updates.textPreview = textPreview;
    if (notes !== undefined) updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    const document = await updateDocument(documentId, updates);

    return NextResponse.json({
      success: true,
      document,
    });

  } catch (error) {
    console.error('[Document API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update document' },
      { status: 500 }
    );
  }
}

// DELETE /api/client-brain/documents/[documentId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { documentId } = await params;

    await deleteDocument(documentId);

    return NextResponse.json({
      success: true,
      message: 'Document deleted',
    });

  } catch (error) {
    console.error('[Document API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete document' },
      { status: 500 }
    );
  }
}
