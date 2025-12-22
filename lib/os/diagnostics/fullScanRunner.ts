// lib/os/diagnostics/fullScanRunner.ts
// Schedules a full intelligence scan by running core diagnostics for a company.

import { CORE_FULL_SCAN_TOOLS } from './fullScan';
import {
  getLatestRunForCompanyAndTool,
  type DiagnosticToolId,
  type DiagnosticRun,
} from './runs';
import { getToolByDiagnosticId } from '@/lib/tools/registry';

export interface FullScanJobSummary {
  companyId: string;
  toolsScheduled: DiagnosticToolId[];
  runIds: string[];
}

const RECENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function shouldRunTool(run: DiagnosticRun | null, force?: boolean): boolean {
  if (force) return true;
  if (!run) return true;
  if (run.status !== 'complete') return true;

  const updatedAt = new Date(run.updatedAt).getTime();
  const stale = Date.now() - updatedAt > RECENCY_WINDOW_MS;
  return stale;
}

function buildBaseUrl(preferredBase?: string): string {
  if (preferredBase) return preferredBase;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function runFullIntelligenceScan(
  companyId: string,
  opts?: { force?: boolean; baseUrl?: string }
): Promise<FullScanJobSummary> {
  const baseUrl = buildBaseUrl(opts?.baseUrl);
  const toolsScheduled: DiagnosticToolId[] = [];
  const runIds: string[] = [];

  for (const toolId of CORE_FULL_SCAN_TOOLS) {
    const latestRun = await getLatestRunForCompanyAndTool(companyId, toolId);
    const needsRun = shouldRunTool(latestRun, opts?.force);
    if (!needsRun) continue;

    const toolDef = getToolByDiagnosticId(toolId);
    const runApiPath = toolDef?.runApiPath;
    if (!runApiPath) {
      console.warn('[FullScan] No runApiPath for tool, skipping:', { toolId });
      continue;
    }

    try {
      const response = await fetch(`${baseUrl}${runApiPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        console.warn('[FullScan] Failed to start tool run:', { toolId, status: response.status, errText });
        continue;
      }

      const data = await response.json().catch(() => ({}));
      const runId = data.runId || data.run?.id;
      if (runId) {
        runIds.push(runId);
      }
      toolsScheduled.push(toolId);
    } catch (error) {
      console.warn('[FullScan] Error scheduling tool', { toolId, error });
    }
  }

  return {
    companyId,
    toolsScheduled,
    runIds,
  };
}
