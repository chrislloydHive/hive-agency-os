'use client';

import { useState, useEffect } from 'react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  count?: number;
  children: React.ReactNode;
  storageKey: string; // localStorage key to remember collapsed state
  defaultCollapsed?: boolean;
}

export default function CollapsibleSection({
  title,
  subtitle,
  count,
  children,
  storageKey,
  defaultCollapsed = false,
}: CollapsibleSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [mounted, setMounted] = useState(false);

  // Load saved state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, [storageKey]);

  // Save state to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(storageKey, String(isCollapsed));
    }
  }, [isCollapsed, storageKey, mounted]);

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
          >
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {title}
            </h2>
            {isCollapsed ? (
              <svg className="h-4 w-4 text-slate-400 group-hover:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-4 w-4 text-slate-400 group-hover:text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {subtitle && !isCollapsed && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {count !== undefined && (
          <span className="text-xs text-slate-500">
            {isCollapsed ? `${count} items` : `Last ${count}`}
          </span>
        )}
      </div>

      {!isCollapsed && children}
    </div>
  );
}
