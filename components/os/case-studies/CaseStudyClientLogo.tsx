'use client';

import type { CaseStudyClientLogo as ClientLogoType } from '@/lib/types/firmBrain';

interface CaseStudyClientLogoProps {
  logo: ClientLogoType | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}

const SIZE_CLASSES = {
  sm: 'h-8 max-w-[80px]',
  md: 'h-12 max-w-[120px]',
  lg: 'h-16 max-w-[160px]',
};

export default function CaseStudyClientLogo({
  logo,
  size = 'md',
  editable = false,
  onEdit,
  onRemove,
}: CaseStudyClientLogoProps) {
  if (!logo) {
    if (editable && onEdit) {
      return (
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-300 border border-dashed border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Client Logo
        </button>
      );
    }
    return null;
  }

  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className="group relative inline-flex items-center">
      {/* Logo image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.assetUrl}
        alt={logo.alt}
        className={`${sizeClass} object-contain`}
        onError={(e) => {
          // Fall back to fallbackUrl if available
          if (logo.fallbackUrl && e.currentTarget.src !== logo.fallbackUrl) {
            e.currentTarget.src = logo.fallbackUrl;
          }
        }}
      />

      {/* Internal visibility badge */}
      {logo.visibility === 'internal' && (
        <span className="ml-2 px-1.5 py-0.5 bg-amber-500/80 text-[10px] font-medium text-white rounded">
          Internal
        </span>
      )}

      {/* Edit controls */}
      {editable && (
        <div className="ml-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 hover:text-white transition-colors"
              title="Edit logo"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="p-1 bg-red-900/80 hover:bg-red-800 rounded text-red-300 hover:text-white transition-colors"
              title="Remove logo"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
