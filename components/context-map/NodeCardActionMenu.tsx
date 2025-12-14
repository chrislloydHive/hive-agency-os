// components/context-map/NodeCardActionMenu.tsx
// Portal-based action menu for context map node cards
//
// Uses React Portal to render the dropdown menu to document.body,
// ensuring it's not clipped by scroll containers with overflow: hidden/auto.

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Check, Pencil, Trash2, Eye, ExternalLink } from 'lucide-react';

export interface NodeCardAction {
  id: string;
  label: string;
  icon?: 'confirm' | 'edit' | 'delete' | 'view' | 'link';
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface NodeCardActionMenuProps {
  actions: NodeCardAction[];
  /** Called when menu opens/closes */
  onOpenChange?: (open: boolean) => void;
}

const ICON_MAP = {
  confirm: Check,
  edit: Pencil,
  delete: Trash2,
  view: Eye,
  link: ExternalLink,
};

export function NodeCardActionMenu({ actions, onOpenChange }: NodeCardActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate menu position when opening
  const openMenu = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = actions.length * 36 + 8; // Approximate height

    // Position below trigger, aligned to right edge
    let top = rect.bottom + 4;
    let left = rect.right - menuWidth;

    // Adjust if menu would go off screen
    if (left < 8) left = 8;
    if (top + menuHeight > window.innerHeight - 8) {
      // Position above trigger if not enough space below
      top = rect.top - menuHeight - 4;
    }

    setMenuPosition({ top, left });
    setIsOpen(true);
    onOpenChange?.(true);
  }, [actions.length, onOpenChange]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    // Use setTimeout to avoid immediate close from the same click that opened
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  // Close on scroll (optional - prevents stale positioning)
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => closeMenu();
    window.addEventListener('scroll', handleScroll, true);

    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, closeMenu]);

  const handleActionClick = (action: NodeCardAction) => {
    if (action.disabled) return;
    closeMenu();
    action.onClick();
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
        title="Actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Portal-rendered menu */}
      {mounted && isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[160px] py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl"
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
          }}
        >
          {actions.map((action) => {
            const Icon = action.icon ? ICON_MAP[action.icon] : null;

            return (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActionClick(action);
                }}
                disabled={action.disabled}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  action.disabled
                    ? 'text-slate-500 cursor-not-allowed'
                    : action.destructive
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-slate-200 hover:bg-slate-700'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {action.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
