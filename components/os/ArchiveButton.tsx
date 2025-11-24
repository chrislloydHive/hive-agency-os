'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ArchiveButtonProps {
  recordId: string;
  table: string;
  action?: 'archive' | 'delete';
  onSuccess?: () => void;
}

export default function ArchiveButton({
  recordId,
  table,
  action = 'archive',
  onSuccess,
}: ArchiveButtonProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleAction = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch('/api/os/manage-record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          table,
          recordId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Failed to ${action} record`);
      }

      console.log(`[ArchiveButton] Record ${action}d successfully`);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Refresh the page to update the list
      router.refresh();
    } catch (err) {
      console.error(`[ArchiveButton] Error ${action}ing record:`, err);
      alert(err instanceof Error ? err.message : `Failed to ${action} record`);
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    handleAction();
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleConfirm}
          disabled={isProcessing}
          className="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : 'Confirm'}
        </button>
        <span className="text-slate-600">|</span>
        <button
          onClick={handleCancel}
          disabled={isProcessing}
          className="text-xs text-slate-400 hover:text-slate-300 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
      title={action === 'archive' ? 'Archive this record' : 'Delete this record'}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {action === 'archive' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        )}
      </svg>
    </button>
  );
}
