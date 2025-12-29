// app/api/autopilot/signals/route.ts
// Monitor and manage signals/alerts

import { NextRequest, NextResponse } from 'next/server';
import {
  runSignalScan,
  getActiveSignals,
  getSignalHistory,
  getSignalSummary,
  acknowledgeSignal,
  resolveSignal,
  setAlertConfig,
  getAlertConfig,
} from '@/lib/autopilot/signalMonitor';
import { loadContextGraph } from '@/lib/contextGraph';
import type { SignalType, SignalSeverity } from '@/lib/autopilot/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const type = searchParams.get('type'); // 'active' | 'history' | 'summary'
    const limit = parseInt(searchParams.get('limit') || '50');
    const signalType = searchParams.get('signalType');
    const severity = searchParams.get('severity');
    const since = searchParams.get('since');

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'active':
        return NextResponse.json({
          signals: getActiveSignals(companyId),
        });

      case 'history':
        return NextResponse.json({
          signals: getSignalHistory(companyId, {
            limit,
            type: signalType as SignalType | undefined,
            severity: severity as SignalSeverity | undefined,
            since: since || undefined,
          }),
        });

      case 'summary':
        return NextResponse.json({
          summary: getSignalSummary(companyId),
        });

      default:
        // Return all by default
        return NextResponse.json({
          active: getActiveSignals(companyId),
          summary: getSignalSummary(companyId),
          alertConfig: getAlertConfig(companyId),
        });
    }
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyId,
      action, // 'scan' | 'acknowledge' | 'resolve' | 'configure'
      signalId,
      acknowledgedBy,
      resolution,
      performanceData,
      alertConfig,
      customThresholds,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'action is required (scan, acknowledge, resolve, configure)' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'scan': {
        // Load company context
        const graph = await loadContextGraph(companyId);
        if (!graph) {
          return NextResponse.json(
            { error: 'Company context not found' },
            { status: 404 }
          );
        }

        const signals = runSignalScan(
          companyId,
          graph,
          performanceData,
          customThresholds
        );

        return NextResponse.json({
          success: true,
          signals,
          summary: getSignalSummary(companyId),
        });
      }

      case 'acknowledge': {
        if (!signalId || !acknowledgedBy) {
          return NextResponse.json(
            { error: 'signalId and acknowledgedBy are required' },
            { status: 400 }
          );
        }

        const signal = acknowledgeSignal(companyId, signalId, acknowledgedBy);
        if (!signal) {
          return NextResponse.json(
            { error: 'Signal not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          signal,
        });
      }

      case 'resolve': {
        if (!signalId || !resolution) {
          return NextResponse.json(
            { error: 'signalId and resolution are required' },
            { status: 400 }
          );
        }

        const signal = resolveSignal(companyId, signalId, resolution);
        if (!signal) {
          return NextResponse.json(
            { error: 'Signal not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          signal,
        });
      }

      case 'configure': {
        if (!alertConfig) {
          return NextResponse.json(
            { error: 'alertConfig is required' },
            { status: 400 }
          );
        }

        setAlertConfig(companyId, alertConfig);

        return NextResponse.json({
          success: true,
          alertConfig: getAlertConfig(companyId),
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing signals:', error);
    return NextResponse.json(
      { error: 'Failed to manage signals', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
