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
  /** Optional metadata for special handling (e.g., not_evaluated subscores) */
  metadata?: {
    notEvaluated?: boolean;
    [key: string]: unknown;
  };
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

/**
 * Severity level for diagnostic issues
 */
export type DiagnosticIssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Issue/finding extracted from a diagnostic run
 */
export interface DiagnosticIssue {
  id: string;
  title: string;
  description?: string;
  severity: DiagnosticIssueSeverity;
  domain?: string;
  category?: string;
  recommendedAction?: string;
}
