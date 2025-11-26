// lib/types/toolReport.ts
// Shared types for tool report layouts

import type { ReactNode } from 'react';

/**
 * Score item for dimension/metric display
 */
export interface ScoreItem {
  label: string;
  value: number;
  maxValue?: number;
  group?: string;
}

/**
 * Report section with optional icon and body content
 */
export interface ReportSection {
  id: string;
  title: string;
  icon?: string;
  body: ReactNode;
}
