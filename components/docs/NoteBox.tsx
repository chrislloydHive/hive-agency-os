// components/docs/NoteBox.tsx
// Note box with gold left accent bar

interface NoteBoxProps {
  label?: string;
  children: React.ReactNode;
}

export function NoteBox({ label = 'Note:', children }: NoteBoxProps) {
  return (
    <div className="no-break my-4 flex rounded-lg overflow-hidden border border-[#E8DCC8]">
      {/* Gold accent bar */}
      <div className="w-1 bg-[#CFA000] flex-shrink-0" />

      {/* Content area */}
      <div className="flex-1 bg-[#FDFBF7] px-4 py-3">
        <p className="text-sm text-gray-700">
          <span className="font-semibold">{label}</span> {children}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Definition Box (for KPI definitions, etc.)
// ============================================================================

interface DefinitionBoxProps {
  label: string;
  children: React.ReactNode;
}

export function DefinitionBox({ label, children }: DefinitionBoxProps) {
  return (
    <div className="no-break my-3 pl-4 border-l-2 border-[#CFA000]">
      <p className="text-sm text-gray-700">
        <span className="font-semibold text-gray-800">{label}:</span> {children}
      </p>
    </div>
  );
}
