// app/api/media/cockpit/[companyId]/route.ts
// API route for Media Lab cockpit data
//
// Returns aggregated media performance data for a company
// Supports time range and store filtering via query params

import { NextRequest, NextResponse } from 'next/server';
import { getMediaCockpitData, getTimeRange, type TimeRangePreset } from '@/lib/media/cockpit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params;

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse time range
    const rangePreset = searchParams.get('range') as TimeRangePreset | null;
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    let dateRange;
    if (fromDate && toDate) {
      dateRange = {
        start: new Date(fromDate),
        end: new Date(toDate),
      };
    } else if (rangePreset) {
      dateRange = getTimeRange(rangePreset);
    } else {
      dateRange = getTimeRange('last30');
    }

    // Parse store filter
    const storeId = searchParams.get('store') || null;

    // Fetch cockpit data
    const data = await getMediaCockpitData(companyId, dateRange, storeId);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching cockpit data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media data' },
      { status: 500 }
    );
  }
}
