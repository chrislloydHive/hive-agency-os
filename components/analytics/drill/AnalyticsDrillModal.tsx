// components/analytics/drill/AnalyticsDrillModal.tsx
// Shared modal component for analytics drill-through interactions
//
// Features:
// - Consistent dark theme design
// - Primary and secondary action buttons
// - Escape key to close
// - Click outside to close
// - Accessible focus management

'use client';

import { useEffect, useCallback, useRef } from 'react';

interface AnalyticsDrillModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}

export function AnalyticsDrillModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  primaryAction,
  secondaryAction,
  size = 'md',
}: AnalyticsDrillModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus the modal
      modalRef.current?.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={modalRef}
          tabIndex={-1}
          className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[85vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800">
            <div className="pr-8">
              <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
              {subtitle && (
                <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-300 transition-colors p-1 -mr-1 rounded hover:bg-slate-800"
              aria-label="Close modal"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto max-h-[calc(85vh-140px)]">
            {children}
          </div>

          {/* Footer with actions */}
          {(primaryAction || secondaryAction) && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/50">
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {secondaryAction.label}
                </button>
              )}
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="px-4 py-2 text-sm font-medium text-slate-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors flex items-center gap-2"
                >
                  {primaryAction.label}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Mini sparkline chart for modal deep-dives
interface MiniSparklineProps {
  data: { date: string; value: number }[];
  color?: 'emerald' | 'blue' | 'amber' | 'purple';
  height?: number;
}

export function MiniSparkline({
  data,
  color = 'emerald',
  height = 40,
}: MiniSparklineProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-xs text-slate-500"
        style={{ height }}
      >
        Not enough data
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 200;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
    return { x, y };
  });

  const pathD = `M ${points[0].x} ${points[0].y} ${points
    .slice(1)
    .map((pt) => `L ${pt.x} ${pt.y}`)
    .join(' ')}`;

  const colorMap = {
    emerald: { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)' },
    blue: { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)' },
    amber: { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)' },
    purple: { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.15)' },
  };

  const colors = colorMap[color];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      {/* Area fill */}
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
        fill={colors.fill}
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={colors.stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Stat row for modal content
interface StatRowProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export function StatRow({
  label,
  value,
  subValue,
  trend,
  trendValue,
}: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-slate-200">{value}</span>
        {subValue && (
          <span className="text-xs text-slate-500 ml-2">{subValue}</span>
        )}
        {trend && trendValue && (
          <span
            className={`text-xs ml-2 ${
              trend === 'up'
                ? 'text-emerald-400'
                : trend === 'down'
                ? 'text-red-400'
                : 'text-slate-500'
            }`}
          >
            {trend === 'up' ? '+' : trend === 'down' ? '' : ''}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  );
}
