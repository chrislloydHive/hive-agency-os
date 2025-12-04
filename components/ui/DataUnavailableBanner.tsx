'use client';

// components/ui/DataUnavailableBanner.tsx
// Banner shown when data is unavailable or incomplete

interface DataUnavailableBannerProps {
  title?: string;
  description?: string;
  variant?: 'warning' | 'info' | 'error';
  className?: string;
}

/**
 * Banner component for showing data availability issues
 *
 * Usage:
 * ```tsx
 * {!graph && (
 *   <DataUnavailableBanner
 *     title="Context data unavailable"
 *     description="Some features may be limited."
 *   />
 * )}
 * ```
 */
export function DataUnavailableBanner({
  title = 'Data unavailable',
  description = 'Some information could not be loaded. You can still proceed, but some insights may be limited.',
  variant = 'warning',
  className = '',
}: DataUnavailableBannerProps) {
  const variantStyles = {
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-300',
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-300',
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      iconColor: 'text-red-400',
      titleColor: 'text-red-300',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`${styles.bg} border ${styles.border} rounded-lg p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg ${styles.iconBg} flex items-center justify-center`}
        >
          {variant === 'error' ? (
            <svg
              className={`w-4 h-4 ${styles.iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : variant === 'warning' ? (
            <svg
              className={`w-4 h-4 ${styles.iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 ${styles.iconColor}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${styles.titleColor}`}>{title}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default DataUnavailableBanner;
