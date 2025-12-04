// app/api/meta/memory/route.ts
// API route for meta memory operations

import { NextRequest, NextResponse } from 'next/server';
import {
  recallMemories,
  queryMemories,
  getMemory,
  useMemory,
  validateMemory,
  deprecateMemory,
  findSimilarMemories,
  getMemoryStats,
  cleanupMemories,
  storeLearning,
  storeBestPractice,
} from '@/lib/meta';
import type { MetaMemoryType } from '@/lib/meta/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const action = searchParams.get('action');
    const type = searchParams.get('type') as MetaMemoryType | null;
    const vertical = searchParams.get('vertical');
    const companyStage = searchParams.get('companyStage');
    const businessModel = searchParams.get('businessModel');
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Get specific memory by ID
    if (id) {
      const memory = await getMemory(id);

      if (!memory) {
        return NextResponse.json(
          { success: false, error: `Memory not found: ${id}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        memory,
      });
    }

    // Get memory statistics
    if (action === 'stats') {
      const stats = await getMemoryStats();

      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Find similar memories
    if (action === 'similar' && query) {
      const types = type ? [type] : undefined;
      const similar = await findSimilarMemories(query, { limit, types });

      return NextResponse.json({
        success: true,
        query,
        memories: similar,
        count: similar.length,
      });
    }

    // Recall memories for context
    if (action === 'recall') {
      const memories = await recallMemories(
        {
          vertical: vertical || undefined,
          companyStage: companyStage || undefined,
          businessModel: businessModel || undefined,
          query: query || undefined,
        },
        { limit }
      );

      return NextResponse.json({
        success: true,
        memories,
        count: memories.length,
      });
    }

    // Query memories
    const memories = await queryMemories({
      type: type || undefined,
      vertical: vertical || undefined,
      companyStage: companyStage || undefined,
      businessModel: businessModel || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      memories,
      count: memories.length,
    });
  } catch (error) {
    console.error('Memory query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Memory query failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, outcome, notes, practice, context, learning } = body;

    // Use a memory (track access)
    if (action === 'use' && id) {
      const validOutcome = outcome === 'success' || outcome === 'failure' ? outcome : 'neutral';
      const memory = await useMemory(id, validOutcome);

      if (!memory) {
        return NextResponse.json(
          { success: false, error: `Memory not found: ${id}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        memory,
        message: `Memory usage recorded with outcome: ${validOutcome}`,
      });
    }

    // Validate a memory
    if (action === 'validate' && id) {
      const valid = body.valid !== false;
      const memory = await validateMemory(id, { valid, notes });

      if (!memory) {
        return NextResponse.json(
          { success: false, error: `Memory not found: ${id}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        memory,
        message: `Memory ${valid ? 'validated' : 'invalidated'}`,
      });
    }

    // Deprecate a memory
    if (action === 'deprecate' && id) {
      const reason = body.reason || 'Deprecated by user';
      const memory = await deprecateMemory(id, reason);

      if (!memory) {
        return NextResponse.json(
          { success: false, error: `Memory not found: ${id}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        memory,
        message: 'Memory deprecated',
      });
    }

    // Cleanup old memories
    if (action === 'cleanup') {
      const result = await cleanupMemories();

      return NextResponse.json({
        success: true,
        ...result,
        message: `Cleaned up ${result.removed} expired and ${result.deprecated} stale memories`,
      });
    }

    // Store a learning
    if (action === 'storeLearning' && learning) {
      const memory = await storeLearning(learning);

      return NextResponse.json({
        success: true,
        memory,
        message: 'Learning stored',
      });
    }

    // Store a best practice
    if (action === 'storeBestPractice' && practice) {
      const memory = await storeBestPractice(practice, context || {});

      return NextResponse.json({
        success: true,
        memory,
        message: 'Best practice stored',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action or missing parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Memory operation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      },
      { status: 500 }
    );
  }
}
