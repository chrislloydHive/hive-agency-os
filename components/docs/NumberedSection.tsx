// components/docs/NumberedSection.tsx
// Section with numbered title and gold horizontal rule

import { ReactNode } from 'react';

interface NumberedSectionProps {
  number: number;
  title: string;
  children: ReactNode;
}

export function NumberedSection({ number, title, children }: NumberedSectionProps) {
  return (
    <div className="no-break mt-8 mb-6">
      {/* Section Header with Gold Rule */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl font-semibold text-gray-800 whitespace-nowrap">
          <span className="text-[#CFA000]">{number}.</span> {title}
        </h2>
        {/* Gold horizontal rule */}
        <div className="flex-1 h-px bg-gradient-to-r from-[#CFA000] to-transparent" />
      </div>

      {/* Section Content */}
      <div>{children}</div>
    </div>
  );
}
