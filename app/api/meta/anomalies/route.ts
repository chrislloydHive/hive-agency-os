// app/api/meta/anomalies/route.ts
// API route for global anomaly detection

import { NextRequest, NextResponse } from 'next/server';
import {
  detectGlobalAnomalies,
  detectVerticalAnomalies,
  detectChannelSpecificAnomalies,
  checkCompanyForAnomalies,
  getAnomalyHistory,
  storeAnomalyMemory,
} from '@/lib/meta';
import type { GlobalAnomalyType } from '@/lib/meta/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vertical = searchParams.get('vertical');
    const channel = searchParams.get('channel');
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type') as GlobalAnomalyType | null;
    const severity = searchParams.get('severity') as 'info' | 'warning' | 'critical' | null;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Check specific company for anomalies
    if (companyId) {
      const result = await checkCompanyForAnomalies(companyId);

      return NextResponse.json({
        success: true,
        companyId,
        isAnomalous: result.isAnomalous,
        anomalies: result.anomalies,
      });
    }

    // Get anomaly history
    if (searchParams.get('history') === 'true') {
      const history = await getAnomalyHistory({
        vertical: vertical || undefined,
        type: type || undefined,
        severity: severity || undefined,
        limit,
      });

      return NextResponse.json({
        success: true,
        anomalies: history,
        count: history.length,
      });
    }

    // Detect channel-specific anomalies
    if (channel) {
      const anomalies = await detectChannelSpecificAnomalies(channel);

      return NextResponse.json({
        success: true,
        channel,
        anomalies,
        count: anomalies.length,
      });
    }

    // Detect vertical-specific anomalies
    if (vertical) {
      const anomalies = await detectVerticalAnomalies(vertical);

      return NextResponse.json({
        success: true,
        vertical,
        anomalies,
        count: anomalies.length,
      });
    }

    // Detect global anomalies
    const anomalies = await detectGlobalAnomalies({
      types: type ? [type] : undefined,
    });

    // Store detected anomalies in memory
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical' || anomaly.severity === 'warning') {
        await storeAnomalyMemory(anomaly);
      }
    }

    return NextResponse.json({
      success: true,
      anomalies,
      count: anomalies.length,
      summary: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length,
      },
    });
  } catch (error) {
    console.error('Anomaly detection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Anomaly detection failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, anomaly, resolution } = body;

    if (action === 'acknowledge') {
      if (!anomaly?.id) {
        return NextResponse.json(
          { success: false, error: 'Anomaly ID required' },
          { status: 400 }
        );
      }

      // In a real implementation, would update the anomaly status in storage
      return NextResponse.json({
        success: true,
        message: `Anomaly ${anomaly.id} acknowledged`,
        updatedStatus: 'acknowledged',
      });
    }

    if (action === 'resolve') {
      if (!anomaly?.id || !resolution) {
        return NextResponse.json(
          { success: false, error: 'Anomaly ID and resolution required' },
          { status: 400 }
        );
      }

      // In a real implementation, would update the anomaly status in storage
      return NextResponse.json({
        success: true,
        message: `Anomaly ${anomaly.id} resolved`,
        resolution,
        updatedStatus: 'resolved',
      });
    }

    if (action === 'markFalsePositive') {
      if (!anomaly?.id) {
        return NextResponse.json(
          { success: false, error: 'Anomaly ID required' },
          { status: 400 }
        );
      }

      // In a real implementation, would update the anomaly status
      return NextResponse.json({
        success: true,
        message: `Anomaly ${anomaly.id} marked as false positive`,
        updatedStatus: 'false_positive',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Anomaly operation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Operation failed',
      },
      { status: 500 }
    );
  }
}
