// app/api/os/companies/[companyId]/artifacts/[artifactId]/feedback/route.ts
// Artifact Feedback API
//
// POST - Submit feedback for an artifact

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getArtifactById, updateArtifact } from '@/lib/airtable/artifacts';
import { FEATURE_FLAGS, FEATURE_DISABLED_RESPONSE } from '@/lib/config/featureFlags';
import type { ArtifactFeedbackEntry, ArtifactFeedbackRating } from '@/lib/types/artifact';

// ============================================================================
// Validation Schema
// ============================================================================

const FeedbackSchema = z.object({
  rating: z.enum(['helpful', 'neutral', 'not_helpful']),
  comment: z.string().max(1000).optional(),
  submittedBy: z.string().optional(),
});

// ============================================================================
// Route Handler
// ============================================================================

type Params = { params: Promise<{ companyId: string; artifactId: string }> };

/**
 * POST /api/os/companies/[companyId]/artifacts/[artifactId]/feedback
 * Submit feedback for an artifact
 *
 * Body:
 * - rating: 'helpful' | 'neutral' | 'not_helpful' (required)
 * - comment: string (optional, max 1000 chars)
 * - submittedBy: string (optional, user ID or session ID)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, artifactId } = await params;
    const body = await request.json();

    // Validate input
    const validationResult = FeedbackSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { rating, comment, submittedBy } = validationResult.data;

    // Get artifact
    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Verify artifact belongs to this company
    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    // Don't allow feedback on archived artifacts
    if (artifact.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot submit feedback for archived artifacts' },
        { status: 400 }
      );
    }

    // Create feedback entry
    const feedbackEntry: ArtifactFeedbackEntry = {
      rating: rating as ArtifactFeedbackRating,
      submittedAt: new Date().toISOString(),
      ...(comment && { comment }),
      ...(submittedBy && { submittedBy }),
    };

    // Append to existing feedback
    const existingFeedback = artifact.feedback ?? [];
    const updatedFeedback = [...existingFeedback, feedbackEntry];

    // Update artifact
    const updated = await updateArtifact(artifactId, {
      feedback: updatedFeedback,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    console.log('[API Artifacts] Feedback submitted:', {
      artifactId,
      rating,
      hasComment: !!comment,
      totalFeedback: updatedFeedback.length,
    });

    return NextResponse.json({
      success: true,
      feedback: feedbackEntry,
      totalFeedback: updatedFeedback.length,
    });
  } catch (error) {
    console.error('[API Artifacts] Failed to submit feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/os/companies/[companyId]/artifacts/[artifactId]/feedback
 * Get all feedback for an artifact
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    if (!FEATURE_FLAGS.ARTIFACTS_ENABLED) {
      return NextResponse.json(FEATURE_DISABLED_RESPONSE, { status: 403 });
    }

    const { companyId, artifactId } = await params;

    const artifact = await getArtifactById(artifactId);

    if (!artifact) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    if (artifact.companyId !== companyId) {
      return NextResponse.json(
        { error: 'Artifact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      feedback: artifact.feedback ?? [],
      total: (artifact.feedback ?? []).length,
    });
  } catch (error) {
    console.error('[API Artifacts] Failed to get feedback:', error);
    return NextResponse.json(
      { error: 'Failed to get feedback' },
      { status: 500 }
    );
  }
}
