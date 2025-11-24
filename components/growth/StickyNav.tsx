// components/growth/StickyNav.tsx

"use client";

import React, { useEffect, useState } from "react";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "scorecard", label: "GAP Score" },
  { id: "quick-wins", label: "GAP Accelerators" },
  { id: "timeline", label: "GAP Roadmap" },
  { id: "analyses", label: "Analyses" },
  { id: "outcomes", label: "Outcomes" },
];

export const StickyNav: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>("overview");

  const scrollToId = (id: string) => {
    if (typeof window === "undefined") return;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Offset for sticky nav

      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-3 py-1.5 text-[10px] text-neutral-400 sm:gap-4 sm:px-4 sm:py-2 sm:text-xs">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToId(section.id)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 transition-colors hover:text-neutral-200 sm:px-3 sm:py-1.5 ${
              activeSection === section.id
                ? "bg-neutral-800 text-yellow-400"
                : "text-neutral-400"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

