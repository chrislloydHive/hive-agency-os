'use client';

import { Globe, Lock, ChevronRight } from 'lucide-react';
import type { CaseStudy, CaseStudyPermission } from '@/lib/types/firmBrain';

interface CaseStudyListItemProps {
  study: CaseStudy;
  isSelected: boolean;
  onClick: () => void;
}

export default function CaseStudyListItem({
  study,
  isSelected,
  onClick,
}: CaseStudyListItemProps) {
  const heroVisual = study.visuals?.find((v) => v.type === 'hero');
  const hasLogo = !!study.clientLogo?.assetUrl;

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left transition-all duration-150
        ${isSelected
          ? 'bg-slate-800/80 border-l-2 border-l-purple-500'
          : 'hover:bg-slate-800/40 border-l-2 border-l-transparent'
        }
      `}
    >
      {/* Hero thumbnail background on hover - subtle */}
      {heroVisual?.assetUrl && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-[0.06] transition-opacity duration-200 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroVisual.assetUrl})` }}
        />
      )}

      <div className="relative flex items-center gap-3 px-4 py-3">
        {/* Client logo or placeholder */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700/50 overflow-hidden flex items-center justify-center">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={study.clientLogo!.assetUrl}
              alt={study.clientLogo!.alt || study.client}
              className="w-8 h-8 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-sm font-semibold text-slate-500">
              {study.client.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p
            className={`text-sm font-medium truncate ${
              isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
            }`}
          >
            {study.title}
          </p>

          {/* Client + Badge */}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500 truncate">
              {study.client}
            </span>
            <PermissionBadge permission={study.permissionLevel} />
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight
          className={`w-4 h-4 flex-shrink-0 transition-colors ${
            isSelected ? 'text-purple-400' : 'text-slate-600 group-hover:text-slate-400'
          }`}
        />
      </div>
    </button>
  );
}

function PermissionBadge({ permission }: { permission: CaseStudyPermission }) {
  if (permission === 'public') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-500/15 text-green-400 text-[10px] font-medium rounded">
        <Globe className="w-2.5 h-2.5" />
        Public
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[10px] font-medium rounded">
      <Lock className="w-2.5 h-2.5" />
      Internal
    </span>
  );
}
