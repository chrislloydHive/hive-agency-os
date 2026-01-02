'use client';

// components/os/documents/DriveIntegrationStatus.tsx
// Google Drive Integration Status Badge and Setup Panel
//
// Shows whether Drive templates are enabled and provides setup instructions.
// Does NOT show OAuth "Connect" button - this is service account based.

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DriveStatusResponse {
  enabled: boolean;
  mode: 'adc';
  serviceAccountEmail: string | null;
  configValid: boolean;
  checks: {
    auth: 'ok' | 'fail' | 'skipped';
    folderAccess: 'ok' | 'fail' | 'skipped';
    templateCopy: 'ok' | 'fail' | 'skipped';
  };
  errors: Array<{
    code: string;
    message: string;
    howToFix: string;
  }>;
  setupInstructions?: {
    steps: Array<{
      number: number;
      title: string;
      description: string;
      command?: string;
    }>;
    docsUrl?: string;
  };
}

interface DriveIntegrationStatusProps {
  /** Compact mode shows only the badge, not the full panel */
  compact?: boolean;
  /** Callback when status changes */
  onStatusChange?: (enabled: boolean) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function DriveIntegrationStatus({
  compact = false,
  onStatusChange,
}: DriveIntegrationStatusProps) {
  const [status, setStatus] = useState<DriveStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/os/integrations/google-drive/status');
      if (!res.ok) {
        throw new Error(`Failed to fetch status: ${res.status}`);
      }
      const data: DriveStatusResponse = await res.json();
      setStatus(data);
      onStatusChange?.(data.enabled);
    } catch (err) {
      console.error('[DriveStatus] Failed to fetch:', err);
      setError(err instanceof Error ? err.message : 'Failed to check Drive status');
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking Drive integration...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm">
        <XCircle className="w-4 h-4" />
        <span>Failed to check Drive status</span>
        <button
          onClick={fetchStatus}
          className="ml-2 p-1 hover:bg-slate-800 rounded transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Compact mode - just show badge
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {status.enabled ? (
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30 rounded">
            <CheckCircle className="w-3 h-3" />
            Drive templates enabled
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 rounded">
            <XCircle className="w-3 h-3" />
            Drive not configured
          </span>
        )}
        <button
          onClick={fetchStatus}
          className="p-1 text-slate-500 hover:text-slate-400 hover:bg-slate-800 rounded transition-colors"
          title="Re-check status"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Full panel mode
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {status.enabled ? (
            <>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-green-400">Drive templates enabled</p>
                <p className="text-xs text-slate-500">
                  Templates can be created from Google Drive
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-slate-500/10 rounded-lg">
                <XCircle className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-slate-300">Drive templates not enabled</p>
                <p className="text-xs text-slate-500">
                  {status.errors.length > 0
                    ? status.errors[0].message
                    : 'Configuration required to enable Drive integration'}
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchStatus();
            }}
            className="p-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-700 rounded transition-colors"
            title="Re-check status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {/* Health checks */}
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Health Checks
            </p>
            <div className="grid grid-cols-3 gap-2">
              <HealthCheckBadge label="Authentication" status={status.checks.auth} />
              <HealthCheckBadge label="Folder Access" status={status.checks.folderAccess} />
              <HealthCheckBadge label="Template Copy" status={status.checks.templateCopy} />
            </div>
          </div>

          {/* Errors */}
          {status.errors.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-red-400 uppercase tracking-wider">Issues</p>
              {status.errors.map((err, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-sm"
                >
                  <p className="text-red-300 font-medium">{err.message}</p>
                  {err.howToFix && (
                    <p className="text-red-400/70 text-xs mt-1 whitespace-pre-line">
                      {err.howToFix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Service account email */}
          {status.serviceAccountEmail && (
            <div className="mt-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Service Account Email
              </p>
              <CopyableEmail email={status.serviceAccountEmail} />
            </div>
          )}

          {/* Setup instructions */}
          {status.setupInstructions && !status.enabled && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Setup Instructions
              </p>
              <div className="space-y-3">
                {status.setupInstructions.steps.map((step) => (
                  <div
                    key={step.number}
                    className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-slate-700 rounded-full text-xs font-medium text-slate-300">
                        {step.number}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-300">{step.title}</p>
                        <p className="text-xs text-slate-500 mt-1 whitespace-pre-line">
                          {step.description}
                        </p>
                        {step.command && (
                          <code className="mt-2 block px-2 py-1 bg-slate-900 rounded text-xs text-cyan-400 font-mono">
                            {step.command}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {status.setupInstructions.docsUrl && (
                <a
                  href={status.setupInstructions.docsUrl}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mt-2"
                >
                  View full documentation
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function HealthCheckBadge({
  label,
  status,
}: {
  label: string;
  status: 'ok' | 'fail' | 'skipped';
}) {
  const styles = {
    ok: 'bg-green-500/10 text-green-400 border-green-500/30',
    fail: 'bg-red-500/10 text-red-400 border-red-500/30',
    skipped: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
  };

  const icons = {
    ok: <CheckCircle className="w-3 h-3" />,
    fail: <XCircle className="w-3 h-3" />,
    skipped: <span className="w-3 h-3 text-center">-</span>,
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium border rounded ${styles[status]}`}
    >
      {icons[status]}
      {label}
    </div>
  );
}

function CopyableEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      console.error('Failed to copy');
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-slate-800/50 border border-slate-700 rounded-lg">
      <code className="flex-1 text-xs font-mono text-slate-300 truncate">{email}</code>
      <button
        onClick={handleCopy}
        className="p-1 text-slate-500 hover:text-slate-400 hover:bg-slate-700 rounded transition-colors"
        title="Copy email"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default DriveIntegrationStatus;
