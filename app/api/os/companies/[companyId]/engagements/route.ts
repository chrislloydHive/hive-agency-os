// app/api/os/companies/[companyId]/engagements/route.ts
// Company Engagements CRUD API

import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementsByCompany,
  getActiveEngagement,
  createEngagement,
} from '@/lib/airtable/engagements';
import type { CreateEngagementInput } from '@/lib/types/engagement';

// GET /api/os/companies/[companyId]/engagements
// Fetch all engagements for a company, or get active engagement
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    if (activeOnly) {
      // Return only the active (non-completed) engagement
      const engagement = await getActiveEngagement(companyId);

      return NextResponse.json({
        success: true,
        engagement,
      });
    }

    // Return all engagements
    const engagements = await getEngagementsByCompany(companyId);

    // Parse query params for filtering
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let filtered = engagements;

    if (status) {
      filtered = filtered.filter((item) => item.status === status);
    }
    if (type) {
      filtered = filtered.filter((item) => item.type === type);
    }

    return NextResponse.json({
      success: true,
      engagements: filtered,
      total: engagements.length,
      filtered: filtered.length,
    });
  } catch (error) {
    console.error('[Engagements API] Error fetching engagements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch engagements' },
      { status: 500 }
    );
  }
}

// POST /api/os/companies/[companyId]/engagements
// Create a new engagement
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.type || !['strategy', 'project'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Valid type (strategy or project) is required' },
        { status: 400 }
      );
    }

    // Validate project type if project engagement
    if (body.type === 'project') {
      const validProjectTypes = ['print_ad', 'website', 'campaign', 'content', 'other'];
      if (body.projectType && !validProjectTypes.includes(body.projectType)) {
        return NextResponse.json(
          { error: 'Invalid project type' },
          { status: 400 }
        );
      }
    }

    const input: CreateEngagementInput = {
      companyId,
      type: body.type,
      projectType: body.projectType,
      projectName: body.projectName,
      selectedLabs: body.selectedLabs,
    };

    const engagement = await createEngagement(input);

    return NextResponse.json({
      success: true,
      engagement,
    });
  } catch (error: unknown) {
    console.error('[Engagements API] Error creating engagement:', error);

    // Extract error message from various error types
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    } else if (error && typeof error === 'object') {
      // Airtable errors have error and message properties
      const airtableError = error as { error?: string; message?: string };
      message = airtableError.message || airtableError.error || JSON.stringify(error);
    }

    return NextResponse.json(
      { error: `Failed to create engagement: ${message}` },
      { status: 500 }
    );
  }
}
