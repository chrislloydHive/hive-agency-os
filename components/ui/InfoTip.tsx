'use client';

// components/ui/InfoTip.tsx
// Reusable contextual help tooltip component
//
// Use this throughout the OS to provide inline guidance and explanations
// for features, workflows, and concepts.

import { useState, useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

type InfoTipVariant = 'info' | 'tip' | 'warning' | 'help';
type InfoTipSize = 'sm' | 'md' | 'lg';
type InfoTipPosition = 'top' | 'bottom' | 'left' | 'right';

interface InfoTipProps {
  /** The help content to display */
  content: React.ReactNode;
  /** Optional title for the tooltip */
  title?: string;
  /** Visual variant */
  variant?: InfoTipVariant;
  /** Size of the icon trigger */
  size?: InfoTipSize;
  /** Preferred position (will auto-adjust if near edge) */
  position?: InfoTipPosition;
  /** Max width of the tooltip (default: 360) */
  maxWidth?: number;
  /** Custom trigger element (defaults to info icon) */
  trigger?: React.ReactNode;
  /** Additional class name for the trigger */
  className?: string;
}

// ============================================================================
// Variant Styles
// ============================================================================

const variantStyles: Record<InfoTipVariant, { icon: string; bg: string; border: string; title: string }> = {
  info: {
    icon: 'text-blue-400 hover:text-blue-300',
    bg: 'bg-slate-800',
    border: 'border-slate-700',
    title: 'text-blue-400',
  },
  tip: {
    icon: 'text-amber-400 hover:text-amber-300',
    bg: 'bg-slate-800',
    border: 'border-amber-500/30',
    title: 'text-amber-400',
  },
  warning: {
    icon: 'text-orange-400 hover:text-orange-300',
    bg: 'bg-orange-950/50',
    border: 'border-orange-500/30',
    title: 'text-orange-400',
  },
  help: {
    icon: 'text-slate-400 hover:text-slate-300',
    bg: 'bg-slate-800',
    border: 'border-slate-700',
    title: 'text-slate-300',
  },
};

const sizeStyles: Record<InfoTipSize, { icon: string; padding: string }> = {
  sm: { icon: 'w-3.5 h-3.5', padding: 'p-0.5' },
  md: { icon: 'w-4 h-4', padding: 'p-1' },
  lg: { icon: 'w-5 h-5', padding: 'p-1.5' },
};

// ============================================================================
// Icons
// ============================================================================

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const iconComponents: Record<InfoTipVariant, typeof InfoIcon> = {
  info: InfoIcon,
  tip: TipIcon,
  warning: WarningIcon,
  help: HelpIcon,
};

// ============================================================================
// Main Component
// ============================================================================

export function InfoTip({
  content,
  title,
  variant = 'info',
  size = 'md',
  position = 'top',
  maxWidth = 420,
  trigger,
  className = '',
}: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const styles = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  const IconComponent = iconComponents[variant];

  // Adjust position if tooltip would go off-screen
  useEffect(() => {
    if (isOpen && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const padding = 8;

      let newPosition = position;

      // Check if tooltip fits in preferred position
      if (position === 'top' && triggerRect.top - tooltipRect.height - padding < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && triggerRect.bottom + tooltipRect.height + padding > window.innerHeight) {
        newPosition = 'top';
      } else if (position === 'left' && triggerRect.left - tooltipRect.width - padding < 0) {
        newPosition = 'right';
      } else if (position === 'right' && triggerRect.right + tooltipRect.width + padding > window.innerWidth) {
        newPosition = 'left';
      }

      setActualPosition(newPosition);
    }
  }, [isOpen, position]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Position classes
  const positionClasses: Record<InfoTipPosition, string> = {
    top: 'bottom-full left-0 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Arrow classes
  const arrowClasses: Record<InfoTipPosition, string> = {
    top: 'top-full left-3 border-t-slate-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-3 border-b-slate-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className={`${sizeStyle.padding} rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${styles.icon}`}
        aria-label="More information"
      >
        {trigger || <IconComponent className={sizeStyle.icon} />}
      </button>

      {/* Tooltip */}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 ${positionClasses[actualPosition]}`}
          style={{ width: maxWidth, maxWidth }}
        >
          <div
            className={`rounded-lg ${styles.bg} ${styles.border} border shadow-xl`}
          >
            {title && (
              <div className={`px-3 py-2 border-b ${styles.border} ${styles.title} font-medium text-sm`}>
                {title}
              </div>
            )}
            <div className="px-3 py-2 text-sm text-slate-300 leading-relaxed">
              {content}
            </div>
          </div>
          {/* Arrow */}
          <div
            className={`absolute w-0 h-0 border-4 ${arrowClasses[actualPosition]}`}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Inline Help Component (for longer explanations)
// ============================================================================

interface InlineHelpProps {
  /** The help content */
  children: React.ReactNode;
  /** Optional title */
  title?: string;
  /** Visual variant */
  variant?: InfoTipVariant;
  /** Whether the help can be dismissed */
  dismissable?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional class name */
  className?: string;
}

export function InlineHelp({
  children,
  title,
  variant = 'info',
  dismissable = false,
  onDismiss,
  className = '',
}: InlineHelpProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const styles = variantStyles[variant];
  const IconComponent = iconComponents[variant];

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div className={`rounded-lg ${styles.bg} ${styles.border} border p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <IconComponent className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon.split(' ')[0]}`} />
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`font-medium text-sm mb-1 ${styles.title}`}>
              {title}
            </h4>
          )}
          <div className="text-sm text-slate-300 leading-relaxed">
            {children}
          </div>
        </div>
        {dismissable && (
          <button
            onClick={handleDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 -mt-1 -mr-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export type { InfoTipProps, InlineHelpProps, InfoTipVariant, InfoTipSize, InfoTipPosition };
