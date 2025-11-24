import { NextRequest, NextResponse } from 'next/server';
import { archiveRecord, deleteRecord } from '@/lib/airtable/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/os/manage-record
 * Archive or delete a record from any Gap table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, table, recordId } = body as {
      action?: 'archive' | 'delete';
      table?: string;
      recordId?: string;
    };

    // Validate required fields
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required (archive or delete)' },
        { status: 400 }
      );
    }

    if (!table) {
      return NextResponse.json(
        { success: false, error: 'table is required' },
        { status: 400 }
      );
    }

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: 'recordId is required' },
        { status: 400 }
      );
    }

    // Validate table name (security: only allow specific tables)
    const allowedTables = [
      'GAP-IA Runs',
      'GAP Plan Runs',
      'GAP-Full Report',
      'GAP Heavy Runs',
    ];

    if (!allowedTables.includes(table)) {
      return NextResponse.json(
        { success: false, error: `Invalid table: ${table}` },
        { status: 400 }
      );
    }

    console.log(`[POST /api/os/manage-record] ${action} record:`, {
      table,
      recordId,
    });

    let result;
    if (action === 'archive') {
      result = await archiveRecord(table, recordId);
    } else if (action === 'delete') {
      result = await deleteRecord(table, recordId);
    } else {
      return NextResponse.json(
        { success: false, error: `Invalid action: ${action}` },
        { status: 400 }
      );
    }

    console.log(`[POST /api/os/manage-record] ${action} successful:`, {
      recordId: result?.id,
      table,
    });

    return NextResponse.json({
      success: true,
      action,
      recordId: result?.id,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[POST /api/os/manage-record] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage || 'Failed to manage record',
      },
      { status: 500 }
    );
  }
}
