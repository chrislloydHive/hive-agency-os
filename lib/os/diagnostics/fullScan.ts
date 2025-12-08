// lib/os/diagnostics/fullScan.ts
// Core tool set for the Full Intelligence Scan

import type { DiagnosticToolId } from './runs';

// Core diagnostics we want to run for a full scan.
// Keep this aligned with tools that have existing run API routes.
export const CORE_FULL_SCAN_TOOLS: DiagnosticToolId[] = [
  'gapSnapshot',
  'websiteLab',
  'brandLab',
  'contentLab',
  'seoLab',
  'demandLab',
  'opsLab',
  'audienceLab',
  'competitorLab',
  'competitionLab',
];
