// lib/os/diagnostics/statusStore.ts
// In-memory status store for diagnostic runs
// In production, use Redis or database for persistence across serverless invocations

export interface DiagnosticStatusEntry {
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStep: string;
  percent: number;
  error?: string;
  runId?: string;
  score?: number;
  benchmarkLabel?: string;
  updatedAt: number;
}

// Global store (shared within same serverless instance)
const statusStore = new Map<string, DiagnosticStatusEntry>();

// Clean up old entries (older than 1 hour)
const CLEANUP_AGE_MS = 60 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of statusStore.entries()) {
    if (now - entry.updatedAt > CLEANUP_AGE_MS) {
      statusStore.delete(key);
    }
  }
}

export function setDiagnosticStatus(
  key: string,
  status: Omit<DiagnosticStatusEntry, 'updatedAt'>
) {
  statusStore.set(key, {
    ...status,
    updatedAt: Date.now(),
  });

  // Cleanup occasionally
  if (Math.random() < 0.1) {
    cleanup();
  }
}

export function getDiagnosticStatus(key: string): DiagnosticStatusEntry | undefined {
  return statusStore.get(key);
}

export function clearDiagnosticStatus(key: string) {
  statusStore.delete(key);
}

// Helper to create status key
export function makeStatusKey(toolId: string, companyId: string): string {
  return `${toolId}:${companyId}`;
}
