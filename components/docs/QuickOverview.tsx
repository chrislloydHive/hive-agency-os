// components/docs/QuickOverview.tsx
// Quick Overview box with beige background and gold accent bar

interface QuickOverviewProps {
  summary: string;
}

export function QuickOverview({ summary }: QuickOverviewProps) {
  return (
    <div className="no-break my-8 rounded-lg overflow-hidden border border-[#E8DCC8]">
      <div className="flex">
        {/* Gold accent bar */}
        <div className="w-1.5 bg-[#CFA000] flex-shrink-0" />

        {/* Content area */}
        <div className="flex-1 bg-[#F5E9D3] px-6 py-5">
          <h2 className="text-sm font-bold text-gray-800 tracking-wide mb-3">
            QUICK OVERVIEW
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  );
}
