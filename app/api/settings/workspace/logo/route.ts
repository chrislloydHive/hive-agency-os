// app/api/settings/workspace/logo/route.ts
// API endpoint for workspace logo upload

import { NextRequest, NextResponse } from 'next/server';
import { updateWorkspaceSettings, getWorkspaceSettings } from '@/lib/os/workspaceSettings';

// Max logo size: 500KB (as base64 data URL)
const MAX_LOGO_SIZE_BYTES = 500 * 1024;

/**
 * POST /api/settings/workspace/logo
 * Accepts a base64-encoded image or a URL
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let logoUrl: string;

    if (contentType.includes('application/json')) {
      // JSON body with either dataUrl or url
      const body = await request.json();

      if (body.url) {
        // External URL provided
        logoUrl = body.url;
      } else if (body.dataUrl) {
        // Base64 data URL provided
        logoUrl = body.dataUrl;

        // Validate data URL format
        if (!logoUrl.startsWith('data:image/')) {
          return NextResponse.json(
            { error: 'Invalid image format. Must be a valid image data URL.' },
            { status: 400 }
          );
        }

        // Check size
        if (logoUrl.length > MAX_LOGO_SIZE_BYTES * 1.37) {
          // Base64 is ~37% larger than binary
          return NextResponse.json(
            { error: 'Logo image is too large. Maximum size is 500KB.' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Missing logo data. Provide either "url" or "dataUrl".' },
          { status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('logo') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file uploaded' },
          { status: 400 }
        );
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Invalid file type. Must be an image.' },
          { status: 400 }
        );
      }

      // Check file size
      if (file.size > MAX_LOGO_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'Logo image is too large. Maximum size is 500KB.' },
          { status: 400 }
        );
      }

      // Convert to base64 data URL
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      logoUrl = `data:${file.type};base64,${base64}`;
    } else {
      return NextResponse.json(
        { error: 'Invalid content type. Use application/json or multipart/form-data.' },
        { status: 400 }
      );
    }

    // Update workspace settings with new logo
    const settings = await updateWorkspaceSettings({ logoUrl });

    return NextResponse.json({
      success: true,
      logoUrl: settings.logoUrl,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error uploading logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/workspace/logo
 * Removes the workspace logo
 */
export async function DELETE() {
  try {
    const settings = await updateWorkspaceSettings({ logoUrl: null });

    return NextResponse.json({
      success: true,
      logoUrl: null,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error removing logo:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
