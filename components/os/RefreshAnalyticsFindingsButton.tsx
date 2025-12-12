'use client';

// components/os/RefreshAnalyticsFindingsButton.tsx
// Button to refresh analytics-derived findings via AI
//
// This is an internal tool action that calls the refresh-findings API
// and shows feedback to the user.

import { useState } from 'react';
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface RefreshAnalyticsFindingsButtonProps {
  companyId: string;
  /** Optional callback when refresh completes */
  onRefreshComplete?: (success: boolean, findingsCreated: number) => void;
  /** Size variant */
  size?: 'sm' | 'md';
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export function RefreshAnalyticsFindingsButton({
  companyId,
  onRefreshComplete,
  size = 'sm',
}: RefreshAnalyticsFindingsButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus('loading');
    setMessage(null);

    try {
      const res = await fetch('/api/os/analytics/refresh-findings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });

      const data = await res.json();

      if (!data.ok) {
        setStatus('error');
        setMessage(data.message ?? 'Failed to refresh analytics findings.');
        onRefreshComplete?.(false, 0);
      } else {
        setStatus('success');
        setMessage(data.message ?? 'Analytics findings refreshed.');
        onRefreshComplete?.(true, data.findingsCreated ?? 0);

        // Reset to idle after 3 seconds
        setTimeout(() => {
          setStatus('idle');
          setMessage(null);
        }, 3000);
      }
    } catch (error) {
      console.error('[RefreshAnalyticsFindings] Error:', error);
      setStatus('error');
      setMessage('Error refreshing analytics findings.');
      onRefreshComplete?.(false, 0);
    }
  }

  // Style classes based on size
  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1.5 text-xs gap-1.5'
    : 'px-3 py-2 text-sm gap-2';

  // Icon size based on button size
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  // Status-based styling
  const getButtonClasses = () => {
    const base = `inline-flex items-center rounded-md font-medium transition-colors ${sizeClasses}`;

    switch (status) {
      case 'loading':
        return `${base} bg-slate-800/50 text-slate-400 cursor-wait`;
      case 'success':
        return `${base} bg-emerald-500/10 text-emerald-400 border border-emerald-500/30`;
      case 'error':
        return `${base} bg-red-500/10 text-red-400 border border-red-500/30`;
      default:
        return `${base} bg-slate-800/50 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-slate-100`;
    }
  };

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className={`${iconSize} animate-spin`} />;
      case 'success':
        return <CheckCircle className={iconSize} />;
      case 'error':
        return <AlertCircle className={iconSize} />;
      default:
        return <RefreshCw className={iconSize} />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'loading':
        return 'Analyzing...';
      case 'success':
        return 'Done';
      case 'error':
        return 'Failed';
      default:
        return 'Refresh Findings';
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className={getButtonClasses()}
        title="Generate analytics-derived findings using AI"
      >
        {getIcon()}
        <span>{getLabel()}</span>
      </button>
      {message && status !== 'idle' && (
        <p className={`text-[10px] ${status === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export default RefreshAnalyticsFindingsButton;
