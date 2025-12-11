'use client';

// components/reports/QBRJumpNav.tsx
// QBR Jump Navigation - Sticky TOC for story view
// Desktop: Right sidebar with vertical list
// Mobile: Horizontal scrollable pill row

import { useState, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface QBRJumpNavSection {
  id: string;
  label: string;
}

interface QBRJumpNavProps {
  sections: QBRJumpNavSection[];
  activeSection?: string;
}

// ============================================================================
// Default Sections
// ============================================================================

export const DEFAULT_QBR_SECTIONS: QBRJumpNavSection[] = [
  { id: 'exec', label: 'Executive Summary' },
  { id: 'performance', label: 'Performance' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'next-quarter', label: 'Next Quarter' },
  { id: 'deep-dives', label: 'Deep Dives' },
  { id: 'recommendations', label: 'Recommendations' },
];

// ============================================================================
// Scroll Handler Hook
// ============================================================================

function useActiveSection(sections: QBRJumpNavSection[], defaultActive?: string) {
  const [activeId, setActiveId] = useState(defaultActive || sections[0]?.id || '');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120; // Offset for header

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i].id);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveId(sections[i].id);
          return;
        }
      }

      // Default to first section if none are in view
      if (sections.length > 0) {
        setActiveId(sections[0].id);
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  return activeId;
}

// ============================================================================
// Smooth Scroll Handler
// ============================================================================

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (element) {
    const offset = 100; // Account for sticky header
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
}

// ============================================================================
// Desktop Sidebar Component
// ============================================================================

interface DesktopNavProps {
  sections: QBRJumpNavSection[];
  activeId: string;
}

function DesktopNav({ sections, activeId }: DesktopNavProps) {
  return (
    <nav className="sticky top-24 hidden lg:block">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-500 mb-3">
          Jump to Section
        </h3>
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => scrollToSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeId === section.id
                    ? 'bg-blue-500/10 text-blue-400 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ============================================================================
// Mobile Pills Component
// ============================================================================

interface MobileNavProps {
  sections: QBRJumpNavSection[];
  activeId: string;
}

function MobileNav({ sections, activeId }: MobileNavProps) {
  return (
    <nav className="lg:hidden mb-4 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 pb-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeId === section.id
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// ============================================================================
// Main Component (Desktop)
// ============================================================================

export function QBRJumpNav({ sections, activeSection }: QBRJumpNavProps) {
  const activeId = useActiveSection(sections, activeSection);

  return <DesktopNav sections={sections} activeId={activeId} />;
}

// ============================================================================
// Mobile Component Export
// ============================================================================

export function QBRJumpNavMobile({ sections, activeSection }: QBRJumpNavProps) {
  const activeId = useActiveSection(sections, activeSection);

  return <MobileNav sections={sections} activeId={activeId} />;
}
