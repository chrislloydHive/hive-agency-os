// app/api/os/companies/[companyId]/context-notes/route.ts
// Context Notes API - GET and POST
//
// Manages analyst notes for context graph fields
// Notes are stored in a simple JSON file per company (could be migrated to Airtable later)

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
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

async function ensureNotesDir() {
  try {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

async function getNotesPath(companyId: string): Promise<string> {
  await ensureNotesDir();
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
// GET - Fetch notes for a domain/field
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const field = searchParams.get('field');

    // Load notes from file
    const store = await loadNotes(companyId);

    // Filter by domain and optionally field
    let filtered = store.notes;
    if (domain) {
      filtered = filtered.filter(n => n.domain === domain);
    }
    if (field) {
      filtered = filtered.filter(n => n.fieldPath === field);
    }

    // Sort by updatedAt desc
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ notes: filtered });
  } catch (error) {
    console.error('[context-notes GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create a new note
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await request.json();

    const { domain, fieldPath, content } = body;

    if (!domain || !content?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, content' },
        { status: 400 }
      );
    }

    // Load existing notes
    const store = await loadNotes(companyId);

    // Create new note
    const now = new Date().toISOString();
    const newNote: Note = {
      id: nanoid(),
      domain,
      fieldPath,
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
    };

    // Add to store
    store.notes.unshift(newNote);
    store.updatedAt = now;

    // Save
    await saveNotes(companyId, store);

    return NextResponse.json({ note: newNote });
  } catch (error) {
    console.error('[context-notes POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
