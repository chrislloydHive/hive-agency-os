'use client';

import { Globe, Lock, Pencil, Eye, Check, AlertCircle } from 'lucide-react';
import type { CaseStudy, CaseStudyPermission, CaseStudyClientLogo as ClientLogoType } from '@/lib/types/firmBrain';

interface CaseStudyHeaderProps {
  study: CaseStudy;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  onEditTitle?: (title: string) => void;
  onEditClient?: (client: string) => void;
  onEditIndustry?: (industry: string) => void;
  onEditPermission?: (permission: CaseStudyPermission) => void;
  onEditLogo?: () => void;
  onRemoveLogo?: () => void;
  onConfirmLogo?: () => void;
}

export default function CaseStudyHeader({
  study,
  isEditMode,
  onToggleEditMode,
  onEditTitle,
  onEditClient,
  onEditIndustry,
  onEditPermission,
  onEditLogo,
  onRemoveLogo,
  onConfirmLogo,
}: CaseStudyHeaderProps) {
  const heroVisual = study.visuals?.find((v) => v.type === 'hero');
  const hasLogo = !!study.clientLogo?.assetUrl;
  const isAutoLogo = study.clientLogo?.source !== 'manual';
  const needsConfirmation = hasLogo && isAutoLogo;

  return (
    <div className="relative">
      {/* Hero background - subtle */}
      {heroVisual?.assetUrl && (
        <div
          className="absolute inset-0 opacity-[0.08] bg-cover bg-center rounded-t-xl"
          style={{ backgroundImage: `url(${heroVisual.assetUrl})` }}
        />
      )}

      {/* Content */}
      <div className="relative px-6 py-5 border-b border-slate-800">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Logo + Info */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Client Logo */}
            <div className="flex-shrink-0">
              {hasLogo ? (
                <div className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={study.clientLogo!.assetUrl}
                    alt={study.clientLogo!.alt || study.client}
                    className="h-14 max-w-[140px] object-contain rounded-lg bg-slate-800/50 p-2"
                    onError={(e) => {
                      if (study.clientLogo?.fallbackUrl) {
                        e.currentTarget.src = study.clientLogo.fallbackUrl;
                      }
                    }}
                  />

                  {/* Auto-ingested indicator */}
                  {needsConfirmation && !isEditMode && (
                    <div className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-amber-500 rounded-full" title="Auto-ingested - needs confirmation">
                      <AlertCircle className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Manual/confirmed indicator */}
                  {!isAutoLogo && !isEditMode && (
                    <div className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 bg-green-500 rounded-full" title="Manually confirmed">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Edit mode controls */}
                  {isEditMode && (
                    <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/50 rounded-lg transition-opacity">
                      {needsConfirmation && onConfirmLogo && (
                        <button
                          onClick={onConfirmLogo}
                          className="p-1.5 bg-green-700 hover:bg-green-600 rounded text-white transition-colors"
                          title="Confirm logo is correct"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      {onEditLogo && (
                        <button
                          onClick={onEditLogo}
                          className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
                          title="Edit logo"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {onRemoveLogo && (
                        <button
                          onClick={onRemoveLogo}
                          className="p-1.5 bg-red-800 hover:bg-red-700 rounded text-white transition-colors"
                          title="Remove logo"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative h-14 w-14 rounded-lg bg-slate-800 flex items-center justify-center">
                  <span className="text-xl font-bold text-slate-500">
                    {study.client.charAt(0).toUpperCase()}
                  </span>
                  {isEditMode && onEditLogo && (
                    <button
                      onClick={onEditLogo}
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 rounded-lg transition-opacity"
                      title="Add logo"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Title & Meta */}
            <div className="flex-1 min-w-0">
              {isEditMode ? (
                <input
                  type="text"
                  value={study.title}
                  onChange={(e) => onEditTitle?.(e.target.value)}
                  className="w-full text-xl font-bold text-white bg-transparent border-b border-slate-700 focus:border-purple-500 focus:outline-none pb-1 mb-1"
                  placeholder="Case study title"
                />
              ) : (
                <h2 className="text-xl font-bold text-white truncate">
                  {study.title}
                </h2>
              )}

              <div className="flex items-center gap-3 mt-1">
                {isEditMode ? (
                  <>
                    <input
                      type="text"
                      value={study.client}
                      onChange={(e) => onEditClient?.(e.target.value)}
                      className="text-sm text-slate-400 bg-transparent border-b border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Client name"
                    />
                    <span className="text-slate-600">|</span>
                    <input
                      type="text"
                      value={study.industry || ''}
                      onChange={(e) => onEditIndustry?.(e.target.value)}
                      className="text-sm text-slate-400 bg-transparent border-b border-slate-700 focus:border-purple-500 focus:outline-none"
                      placeholder="Industry"
                    />
                  </>
                ) : (
                  <>
                    <span className="text-sm text-slate-400">{study.client}</span>
                    {study.industry && (
                      <>
                        <span className="text-slate-600">|</span>
                        <span className="text-sm text-slate-500">{study.industry}</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Permission Badge + Mode Toggle */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {isEditMode ? (
              <select
                value={study.permissionLevel}
                onChange={(e) => onEditPermission?.(e.target.value as CaseStudyPermission)}
                className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
              </select>
            ) : (
              <PermissionBadge permission={study.permissionLevel} size="md" />
            )}

            {/* View/Edit Toggle */}
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isEditMode
                  ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {isEditMode ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  View
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionBadge({
  permission,
  size = 'sm',
}: {
  permission: CaseStudyPermission;
  size?: 'sm' | 'md';
}) {
  const sizeClasses = size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5';

  if (permission === 'public') {
    return (
      <span className={`inline-flex items-center gap-1 ${sizeClasses} bg-green-500/15 text-green-400 font-medium rounded`}>
        <Globe className={iconSize} />
        Public
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${sizeClasses} bg-amber-500/15 text-amber-400 font-medium rounded`}>
      <Lock className={iconSize} />
      Internal
    </span>
  );
}
