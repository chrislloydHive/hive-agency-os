// app/api/os/companies/[companyId]/context-notes/[noteId]/route.ts
// Context Notes API - PATCH and DELETE for individual notes

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

interface Note {
  id: string;
  domain: string;
  fieldPath?: string;
  content: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotesStore {
  notes: Note[];
  updatedAt: string;
}

// ============================================================================
// Storage Helpers
// ============================================================================

const NOTES_DIR = path.join(process.cwd(), '.cache', 'context-notes');

async function getNotesPath(companyId: string): Promise<string> {
  return path.join(NOTES_DIR, `${companyId}.json`);
}

async function loadNotes(companyId: string): Promise<NotesStore> {
  try {
    const filePath = await getNotesPath(companyId);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { notes: [], updatedAt: new Date().toISOString() };
  }
}

async function saveNotes(companyId: string, store: NotesStore): Promise<void> {
  const filePath = await getNotesPath(companyId);
  await fs.writeFile(filePath, JSON.stringify(store, null, 2));
}

// ============================================================================
// PATCH - Update a note
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; noteId: string }> }
) {
  try {
    const { companyId, noteId } = await params;
    const body = await request.json();

    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Load notes
    const store = await loadNotes(companyId);

    // Find and update note
    const noteIndex = store.notes.findIndex(n => n.id === noteId);

    if (noteIndex === -1) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const updatedNote: Note = {
      ...store.notes[noteIndex],
      content: content.trim(),
      updatedAt: now,
    };

    store.notes[noteIndex] = updatedNote;
    store.updatedAt = now;

    // Save
    await saveNotes(companyId, store);

    return NextResponse.json({ note: updatedNote });
  } catch (error) {
    console.error('[context-notes PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete a note
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; noteId: string }> }
) {
  try {
    const { companyId, noteId } = await params;

    // Load notes
    const store = await loadNotes(companyId);

    // Filter out the note
    const originalLength = store.notes.length;
    store.notes = store.notes.filter(n => n.id !== noteId);

    if (store.notes.length === originalLength) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    store.updatedAt = new Date().toISOString();

    // Save
    await saveNotes(companyId, store);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[context-notes DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
