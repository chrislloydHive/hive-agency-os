// components/os/blueprint/BlueprintMiniNav.tsx
// Sticky mini-navigation for quick section jumping
// Pills-style horizontal nav that sticks below the header

'use client';

import { useEffect, useState, useCallback } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'scores', label: 'Scores' },
  { id: 'issues', label: 'Issues' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'tools', label: 'Tools' },
];

export function BlueprintMiniNav() {
  const [activeSection, setActiveSection] = useState<string>('summary');
  const [isSticky, setIsSticky] = useState(false);

  // Track which section is currently in view
  useEffect(() => {
    const handleScroll = () => {
      // Check if we should show sticky state
      const scrollY = window.scrollY;
      setIsSticky(scrollY > 200);

      // Find which section is most visible
      const sections = navItems.map((item) => {
        const element = document.getElementById(item.id);
        if (!element) return { id: item.id, top: Infinity };
        const rect = element.getBoundingClientRect();
        return { id: item.id, top: rect.top };
      });

      // Find the section closest to the top but still visible
      const headerOffset = 120; // Account for header + nav height
      const visible = sections.filter((s) => s.top <= headerOffset + 100);

      if (visible.length > 0) {
        // Get the one closest to the headerOffset
        const closest = visible.reduce((prev, curr) =>
          Math.abs(curr.top - headerOffset) < Math.abs(prev.top - headerOffset) ? curr : prev
        );
        setActiveSection(closest.id);
      } else if (sections.length > 0 && sections[0].top !== Infinity) {
        setActiveSection(sections[0].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 100; // Adjust based on sticky header height
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  }, []);

  return (
    <nav
      className={`
        sticky top-[4rem] z-20 -mx-6 px-6 py-2 mb-4
        transition-all duration-200
        ${isSticky
          ? 'bg-slate-900/95 backdrop-blur-sm border-b border-slate-800/50 shadow-lg'
          : 'bg-transparent'
        }
      `}
    >
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium
                whitespace-nowrap transition-all duration-150
                ${isActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
