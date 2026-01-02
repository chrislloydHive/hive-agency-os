// components/docs/InfoCard.tsx
// Gray bordered card with title and bullet list

interface InfoCardProps {
  title: string;
  bullets: string[];
  subtitle?: string;
}

export function InfoCard({ title, bullets, subtitle }: InfoCardProps) {
  return (
    <div className="no-break border border-[#D9D9D9] rounded-lg bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      {subtitle && (
        <p className="text-xs text-gray-500 mb-2">{subtitle}</p>
      )}
      <ul className="space-y-1.5">
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-[#CFA000] mt-1 flex-shrink-0">•</span>
            <span className="leading-snug">{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Two Column Cards Layout
// ============================================================================

interface TwoColumnCardsProps {
  children: React.ReactNode;
}

export function TwoColumnCards({ children }: TwoColumnCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
      {children}
    </div>
  );
}

// ============================================================================
// Three Column Cards Layout
// ============================================================================

interface ThreeColumnCardsProps {
  children: React.ReactNode;
}

export function ThreeColumnCards({ children }: ThreeColumnCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
      {children}
    </div>
  );
}
