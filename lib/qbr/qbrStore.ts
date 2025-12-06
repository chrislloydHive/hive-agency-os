// lib/qbr/qbrStore.ts
// QBR Story Persistence Layer
//
// Stores QBR stories in Airtable following the existing patterns
// in the codebase (similar to contextGraph/storage.ts).

import { randomUUID } from 'crypto';
import {
  createRecord,
  updateRecord,
  findRecordByField,
  getAirtableConfig,
} from '@/lib/airtable/client';
import { AIRTABLE_TABLES } from '@/lib/airtable/tables';
import type {
  QbrStory,
  QbrStoryMeta,
  StoryBlock,
  QbrDomain,
  QbrStoryChapter,
  RegenerationMode,
  RegenerationHistoryEntry,
} from './qbrTypes';
import { domainToTitle } from './qbrTypes';

// ============================================================================
// Constants
// ============================================================================

const TABLE_NAME = AIRTABLE_TABLES.QBR_STORIES;

// ============================================================================
// Airtable Record Types
// ============================================================================

interface QbrStoryRecord {
  id: string;
  fields: {
    CompanyId: string;
    Quarter: string;
    Meta: string; // JSON string of QbrStoryMeta
    GlobalBlocks: string; // JSON string of StoryBlock[]
    Chapters: string; // JSON string of QbrStoryChapter[]
    Status: 'draft' | 'finalized';
    DataConfidenceScore: number;
    GeneratedAt: string;
    UpdatedAt: string;
  };
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapRecordToStory(record: QbrStoryRecord): QbrStory {
  const fields = record.fields;

  let meta: QbrStoryMeta;
  try {
    meta = JSON.parse(fields.Meta || '{}');
  } catch {
    meta = {
      companyId: fields.CompanyId,
      quarter: fields.Quarter,
      generatedAt: fields.GeneratedAt || new Date().toISOString(),
      generatedBy: 'ai',
      modelVersion: 'qbr-v1',
      dataConfidenceScore: fields.DataConfidenceScore || 50,
      status: fields.Status || 'draft',
      regenerationHistory: [],
    };
  }

  let globalBlocks: StoryBlock[] = [];
  try {
    globalBlocks = JSON.parse(fields.GlobalBlocks || '[]');
  } catch {
    globalBlocks = [];
  }

  let chapters: QbrStoryChapter[] = [];
  try {
    chapters = JSON.parse(fields.Chapters || '[]');
  } catch {
    chapters = [];
  }

  return {
    meta,
    globalBlocks,
    chapters,
  };
}

function mapStoryToFields(story: QbrStory): Record<string, unknown> {
  return {
    CompanyId: story.meta.companyId,
    Quarter: story.meta.quarter,
    Meta: JSON.stringify(story.meta),
    GlobalBlocks: JSON.stringify(story.globalBlocks),
    Chapters: JSON.stringify(story.chapters),
    Status: story.meta.status,
    DataConfidenceScore: story.meta.dataConfidenceScore,
    GeneratedAt: story.meta.generatedAt,
    UpdatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Load Story
// ============================================================================

/**
 * Load a QBR story for a company and quarter
 */
export async function loadQbrStory(
  companyId: string,
  quarter: string
): Promise<QbrStory | null> {
  try {
    // Build filter formula for compound key
    const config = getAirtableConfig();
    const filterFormula = `AND({CompanyId} = '${companyId.replace(/'/g, "\\'")}', {Quarter} = '${quarter.replace(/'/g, "\\'")}')`;

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      TABLE_NAME
    )}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[QbrStore] Failed to load story:', errorText);
      return null;
    }

    const result = await response.json();
    const records = result.records || [];

    if (records.length === 0) {
      console.log(`[QbrStore] No story found for ${companyId}/${quarter}`);
      return null;
    }

    const story = mapRecordToStory(records[0]);
    console.log(`[QbrStore] Loaded story for ${companyId}/${quarter}`);
    return story;
  } catch (error) {
    console.error('[QbrStore] Error loading story:', error);
    return null;
  }
}

// ============================================================================
// Save Story
// ============================================================================

export interface SaveStoryArgs {
  story: QbrStory;
  generatedBy: 'ai' | 'human' | 'hybrid';
  userId: string;
}

/**
 * Save (create or update) a QBR story
 */
export async function saveQbrStory(args: SaveStoryArgs): Promise<QbrStory> {
  const { story, generatedBy, userId } = args;

  // Update meta
  const updatedMeta: QbrStoryMeta = {
    ...story.meta,
    generatedBy,
    generatedAt: new Date().toISOString(),
  };

  const updatedStory: QbrStory = {
    ...story,
    meta: updatedMeta,
  };

  const fields = mapStoryToFields(updatedStory);

  try {
    // Check if story already exists
    const config = getAirtableConfig();
    const filterFormula = `AND({CompanyId} = '${story.meta.companyId.replace(/'/g, "\\'")}', {Quarter} = '${story.meta.quarter.replace(/'/g, "\\'")}')`;

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      TABLE_NAME
    )}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const checkResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!checkResponse.ok) {
      throw new Error(`Failed to check existing story: ${await checkResponse.text()}`);
    }

    const checkResult = await checkResponse.json();
    const existingRecords = checkResult.records || [];

    if (existingRecords.length > 0) {
      // Update existing record
      const recordId = existingRecords[0].id;
      await updateRecord(TABLE_NAME, recordId, fields);
      console.log(`[QbrStore] Updated story ${recordId} for ${story.meta.companyId}/${story.meta.quarter}`);
    } else {
      // Create new record
      await createRecord(TABLE_NAME, fields);
      console.log(`[QbrStore] Created story for ${story.meta.companyId}/${story.meta.quarter}`);
    }

    return updatedStory;
  } catch (error) {
    console.error('[QbrStore] Error saving story:', error);
    throw error;
  }
}

// ============================================================================
// Update Story Blocks (with regeneration)
// ============================================================================

export interface UpdateBlocksArgs {
  story: QbrStory;
  userId: string;
  regenerationMode: RegenerationMode;
  targetDomain?: QbrDomain | 'all';
}

/**
 * Update story blocks (for regeneration)
 * Preserves locked blocks and adds to regeneration history
 */
export async function updateQbrStoryBlocks(args: UpdateBlocksArgs): Promise<QbrStory> {
  const { story, userId, regenerationMode, targetDomain } = args;

  // Add regeneration history entry
  const historyEntry: RegenerationHistoryEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    mode: regenerationMode,
    domain: targetDomain,
    requestedBy: userId,
  };

  const updatedMeta: QbrStoryMeta = {
    ...story.meta,
    regenerationHistory: [...(story.meta.regenerationHistory || []), historyEntry],
  };

  const updatedStory: QbrStory = {
    ...story,
    meta: updatedMeta,
  };

  return saveQbrStory({
    story: updatedStory,
    generatedBy: 'ai',
    userId,
  });
}

// ============================================================================
// List Stories
// ============================================================================

export interface StoryListItem {
  companyId: string;
  quarter: string;
  status: 'draft' | 'finalized';
  generatedAt: string;
  dataConfidenceScore: number;
}

/**
 * List all QBR stories for a company
 */
export async function listQbrStories(companyId: string): Promise<StoryListItem[]> {
  try {
    const config = getAirtableConfig();
    const filterFormula = `{CompanyId} = '${companyId.replace(/'/g, "\\'")}'`;

    const url = `https://api.airtable.com/v0/${config.baseId}/${encodeURIComponent(
      TABLE_NAME
    )}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Quarter&sort[0][direction]=desc`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('[QbrStore] Failed to list stories:', await response.text());
      return [];
    }

    const result = await response.json();
    const records = result.records || [];

    return records.map((record: QbrStoryRecord) => ({
      companyId: record.fields.CompanyId,
      quarter: record.fields.Quarter,
      status: record.fields.Status || 'draft',
      generatedAt: record.fields.GeneratedAt,
      dataConfidenceScore: record.fields.DataConfidenceScore || 50,
    }));
  } catch (error) {
    console.error('[QbrStore] Error listing stories:', error);
    return [];
  }
}

// ============================================================================
// Update Story Status
// ============================================================================

/**
 * Finalize a QBR story (mark as finalized)
 */
export async function finalizeQbrStory(
  companyId: string,
  quarter: string
): Promise<boolean> {
  const story = await loadQbrStory(companyId, quarter);
  if (!story) {
    return false;
  }

  const updatedStory: QbrStory = {
    ...story,
    meta: {
      ...story.meta,
      status: 'finalized',
    },
  };

  await saveQbrStory({
    story: updatedStory,
    generatedBy: 'human',
    userId: 'system',
  });

  return true;
}

// ============================================================================
// Lock/Unlock Blocks
// ============================================================================

/**
 * Lock a specific block to prevent AI regeneration
 */
export async function lockBlock(
  companyId: string,
  quarter: string,
  blockId: string
): Promise<boolean> {
  const story = await loadQbrStory(companyId, quarter);
  if (!story) {
    return false;
  }

  // Find and lock the block in globalBlocks
  const globalBlockIndex = story.globalBlocks.findIndex((b) => b.id === blockId);
  if (globalBlockIndex !== -1) {
    story.globalBlocks[globalBlockIndex].lockedByUser = true;
    await saveQbrStory({
      story,
      generatedBy: 'human',
      userId: 'system',
    });
    return true;
  }

  // Find and lock the block in chapters
  for (const chapter of story.chapters) {
    const blockIndex = chapter.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex !== -1) {
      chapter.blocks[blockIndex].lockedByUser = true;
      await saveQbrStory({
        story,
        generatedBy: 'human',
        userId: 'system',
      });
      return true;
    }
  }

  return false;
}

/**
 * Unlock a specific block to allow AI regeneration
 */
export async function unlockBlock(
  companyId: string,
  quarter: string,
  blockId: string
): Promise<boolean> {
  const story = await loadQbrStory(companyId, quarter);
  if (!story) {
    return false;
  }

  // Find and unlock the block in globalBlocks
  const globalBlockIndex = story.globalBlocks.findIndex((b) => b.id === blockId);
  if (globalBlockIndex !== -1) {
    story.globalBlocks[globalBlockIndex].lockedByUser = false;
    await saveQbrStory({
      story,
      generatedBy: 'human',
      userId: 'system',
    });
    return true;
  }

  // Find and unlock the block in chapters
  for (const chapter of story.chapters) {
    const blockIndex = chapter.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex !== -1) {
      chapter.blocks[blockIndex].lockedByUser = false;
      await saveQbrStory({
        story,
        generatedBy: 'human',
        userId: 'system',
      });
      return true;
    }
  }

  return false;
}

// ============================================================================
// Update Block Content (Human Edit)
// ============================================================================

/**
 * Update a specific block's content (human edit)
 */
export async function updateBlockContent(
  companyId: string,
  quarter: string,
  blockId: string,
  updates: Partial<StoryBlock>
): Promise<boolean> {
  const story = await loadQbrStory(companyId, quarter);
  if (!story) {
    return false;
  }

  // Find and update the block in globalBlocks
  const globalBlockIndex = story.globalBlocks.findIndex((b) => b.id === blockId);
  if (globalBlockIndex !== -1) {
    story.globalBlocks[globalBlockIndex] = {
      ...story.globalBlocks[globalBlockIndex],
      ...updates,
      provenance: {
        ...story.globalBlocks[globalBlockIndex].provenance,
        source: 'human',
      },
    } as StoryBlock;

    await saveQbrStory({
      story,
      generatedBy: 'hybrid',
      userId: 'system',
    });
    return true;
  }

  // Find and update the block in chapters
  for (const chapter of story.chapters) {
    const blockIndex = chapter.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex !== -1) {
      chapter.blocks[blockIndex] = {
        ...chapter.blocks[blockIndex],
        ...updates,
        provenance: {
          ...chapter.blocks[blockIndex].provenance,
          source: 'human',
        },
      } as StoryBlock;

      await saveQbrStory({
        story,
        generatedBy: 'hybrid',
        userId: 'system',
      });
      return true;
    }
  }

  return false;
}
