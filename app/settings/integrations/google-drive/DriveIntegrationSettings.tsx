'use client';

// app/settings/integrations/google-drive/DriveIntegrationSettings.tsx
// Google Drive Integration Settings Component

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  Settings,
  Folder,
  FileText,
  Shield,
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

// ============================================================================
// Main Component
// ============================================================================

export function DriveIntegrationSettings() {
  const [status, setStatus] = useState<DriveStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('[DriveSettings] Failed to fetch:', err);
      setError(err instanceof Error ? err.message : 'Failed to check Drive status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-400" />
          <div>
            <p className="font-medium text-red-300">Failed to load Drive status</p>
            <p className="text-sm text-red-400/70">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchStatus}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Status Overview */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Integration Status</h2>
          <button
            onClick={fetchStatus}
            className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Overall status */}
          <div className="flex items-center gap-4 mb-6">
            {status.enabled ? (
              <>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-green-400">Integration Active</p>
                  <p className="text-sm text-slate-400">
                    Drive templates are enabled and all health checks passed.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-amber-500/10 rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-amber-400">Configuration Required</p>
                  <p className="text-sm text-slate-400">
                    Follow the setup instructions below to enable Drive integration.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Health checks grid */}
          <div className="grid grid-cols-3 gap-4">
            <HealthCheckCard
              icon={Shield}
              label="Authentication"
              status={status.checks.auth}
              description={
                status.checks.auth === 'ok'
                  ? 'ADC credentials working'
                  : 'Run gcloud auth application-default login'
              }
            />
            <HealthCheckCard
              icon={Folder}
              label="Folder Access"
              status={status.checks.folderAccess}
              description={
                status.checks.folderAccess === 'ok'
                  ? 'Template and artifact folders accessible'
                  : 'Share folders with service account'
              }
            />
            <HealthCheckCard
              icon={FileText}
              label="Template Copy"
              status={status.checks.templateCopy}
              description={
                status.checks.templateCopy === 'ok'
                  ? 'Template copying verified'
                  : status.checks.templateCopy === 'skipped'
                  ? 'No test template configured'
                  : 'Copy permissions needed'
              }
            />
          </div>
        </div>
      </section>

      {/* Service Account */}
      {status.serviceAccountEmail && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Service Account</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-400 mb-3">
              Share your Drive folders with this service account email. Do NOT add it as a Google
              Workspace user.
            </p>
            <CopyableValue label="Email" value={status.serviceAccountEmail} />

            <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
              <p className="text-sm font-medium text-slate-300 mb-2">Sharing Instructions:</p>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>
                  <strong>For Shared Drives:</strong> Add as Content Manager
                </li>
                <li>
                  <strong>For regular folders:</strong> Add as Editor
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Errors */}
      {status.errors.length > 0 && (
        <section className="bg-red-500/5 border border-red-500/30 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-red-500/30">
            <h2 className="text-lg font-semibold text-red-300">Issues Detected</h2>
          </div>
          <div className="p-6 space-y-4">
            {status.errors.map((err, idx) => (
              <div key={idx} className="bg-red-500/10 rounded-lg p-4">
                <p className="font-medium text-red-300">{err.message}</p>
                {err.howToFix && (
                  <p className="text-sm text-red-400/70 mt-2 whitespace-pre-line">{err.howToFix}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Setup Instructions */}
      {status.setupInstructions && !status.enabled && (
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Setup Instructions</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {status.setupInstructions.steps.map((step) => (
                <div
                  key={step.number}
                  className="flex gap-4 p-4 bg-slate-800/50 rounded-lg"
                >
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-500/20 text-purple-400 rounded-full font-semibold">
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{step.title}</p>
                    <p className="text-sm text-slate-400 mt-1 whitespace-pre-line">
                      {step.description}
                    </p>
                    {step.command && (
                      <CopyableValue label="" value={step.command} mono className="mt-3" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {status.setupInstructions.docsUrl && (
              <a
                href={status.setupInstructions.docsUrl}
                className="inline-flex items-center gap-2 mt-6 text-sm text-cyan-400 hover:text-cyan-300"
              >
                View full documentation
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </section>
      )}

      {/* Environment Variables Reference */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Environment Variables
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-400 mb-4">
            Configure these environment variables in your deployment:
          </p>
          <div className="space-y-3 font-mono text-sm">
            <EnvVarRow
              name="GOOGLE_DRIVE_PROVIDER_ENABLED"
              description="Enable/disable the integration"
              example="true"
              required
            />
            <EnvVarRow
              name="GOOGLE_DRIVE_TEMPLATE_ROOT_FOLDER_ID"
              description="Drive folder containing templates"
              example="1ABC123..."
              required
            />
            <EnvVarRow
              name="GOOGLE_DRIVE_ARTIFACTS_ROOT_FOLDER_ID"
              description="Drive folder for created documents"
              example="1DEF456..."
              required
            />
            <EnvVarRow
              name="GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL"
              description="Display email for sharing instructions"
              example="sa@project.iam.gserviceaccount.com"
            />
            <EnvVarRow
              name="GOOGLE_DRIVE_TEST_TEMPLATE_FILE_ID"
              description="Template file for health check verification"
              example="1GHI789..."
            />
            <EnvVarRow
              name="GOOGLE_DRIVE_SHARED_DRIVE_ID"
              description="Shared Drive ID (if using Shared Drives)"
              example="0AJ123..."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function HealthCheckCard({
  icon: Icon,
  label,
  status,
  description,
}: {
  icon: React.ElementType;
  label: string;
  status: 'ok' | 'fail' | 'skipped';
  description: string;
}) {
  const styles = {
    ok: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      icon: 'text-green-400',
      text: 'text-green-400',
    },
    fail: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
      text: 'text-red-400',
    },
    skipped: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      icon: 'text-slate-500',
      text: 'text-slate-500',
    },
  };

  const style = styles[status];

  return (
    <div className={`p-4 rounded-lg border ${style.bg} ${style.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-5 h-5 ${style.icon}`} />
        <span className={`font-medium ${style.text}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'ok' && <CheckCircle className="w-4 h-4 text-green-400" />}
        {status === 'fail' && <XCircle className="w-4 h-4 text-red-400" />}
        {status === 'skipped' && <span className="w-4 h-4 text-center text-slate-500">-</span>}
        <span className="text-xs text-slate-400">{description}</span>
      </div>
    </div>
  );
}

function CopyableValue({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  return (
    <div className={className}>
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      <div className="flex items-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-lg">
        <code
          className={`flex-1 text-sm truncate ${mono ? 'font-mono text-cyan-400' : 'text-slate-300'}`}
        >
          {value}
        </code>
        <button
          onClick={handleCopy}
          className="p-1.5 text-slate-500 hover:text-slate-400 hover:bg-slate-700 rounded transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function EnvVarRow({
  name,
  description,
  example,
  required = false,
}: {
  name: string;
  description: string;
  example: string;
  required?: boolean;
}) {
  return (
    <div className="p-3 bg-slate-800/50 rounded-lg">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-cyan-400">{name}</code>
        {required && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded">
            Required
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">{description}</p>
      <p className="text-xs text-slate-600 mt-1">Example: {example}</p>
    </div>
  );
}

export default DriveIntegrationSettings;
