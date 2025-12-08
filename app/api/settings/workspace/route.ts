// app/api/settings/workspace/route.ts
// API endpoint for workspace settings (GET, PATCH)

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceSettings, updateWorkspaceSettings } from '@/lib/os/workspaceSettings';

/**
 * GET /api/settings/workspace
 * Returns the current workspace settings
 */
export async function GET() {
  try {
    const settings = await getWorkspaceSettings();

    if (!settings) {
      return NextResponse.json(
        { error: 'Could not retrieve workspace settings' },
        { status: 500 }
      );
    }

    // Return only safe fields (exclude refresh tokens)
    return NextResponse.json({
      id: settings.id,
      workspaceId: settings.workspaceId,
      workspaceName: settings.workspaceName,
      logoUrl: settings.logoUrl,
      timezone: settings.timezone,
      // Integration status (without tokens)
      ga4Connected: !!settings.ga4RefreshToken && !!settings.ga4PropertyId,
      ga4PropertyId: settings.ga4PropertyId,
      ga4ConnectedAt: settings.ga4ConnectedAt,
      gscConnected: !!settings.gscRefreshToken && !!settings.gscPropertyUri,
      gscPropertyUri: settings.gscPropertyUri,
      gscConnectedAt: settings.gscConnectedAt,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error fetching workspace settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/workspace
 * Updates workspace settings (name, timezone, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceName, timezone } = body;

    const updates: Record<string, string | null> = {};

    if (workspaceName !== undefined) {
      updates.workspaceName = workspaceName;
    }
    if (timezone !== undefined) {
      updates.timezone = timezone;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const settings = await updateWorkspaceSettings(updates);

    return NextResponse.json({
      success: true,
      workspaceName: settings.workspaceName,
      timezone: settings.timezone,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error updating workspace settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
