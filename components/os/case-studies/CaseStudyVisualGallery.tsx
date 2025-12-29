'use client';

import { useState } from 'react';
import { Image as ImageIcon, Video, Lock, Plus, Pencil, X, Play } from 'lucide-react';
import type { CaseStudyVisual, CaseStudyVisualType } from '@/lib/types/firmBrain';

interface CaseStudyVisualGalleryProps {
  visuals: CaseStudyVisual[];
  editable?: boolean;
  isEditMode?: boolean;
  onAddVisual?: () => void;
  onRemoveVisual?: (id: string) => void;
  onEditVisual?: (visual: CaseStudyVisual) => void;
}

const VISUAL_TYPE_LABELS: Record<CaseStudyVisualType, string> = {
  hero: 'Hero',
  campaign: 'Campaign',
  before_after: 'Before/After',
  process: 'Process',
  detail: 'Detail',
};

const VISUAL_TYPE_ORDER: CaseStudyVisualType[] = [
  'hero',
  'campaign',
  'before_after',
  'process',
  'detail',
];

export default function CaseStudyVisualGallery({
  visuals,
  editable = false,
  isEditMode = false,
  onAddVisual,
  onRemoveVisual,
  onEditVisual,
}: CaseStudyVisualGalleryProps) {
  const [selectedVisual, setSelectedVisual] = useState<CaseStudyVisual | null>(null);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  // Sort visuals by order within their type
  const sortedVisuals = [...visuals].sort((a, b) => {
    const typeOrderA = VISUAL_TYPE_ORDER.indexOf(a.type);
    const typeOrderB = VISUAL_TYPE_ORDER.indexOf(b.type);
    if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
    return a.order - b.order;
  });

  // Group visuals by type
  const groupedVisuals = VISUAL_TYPE_ORDER.reduce((acc, type) => {
    const typeVisuals = sortedVisuals.filter((v) => v.type === type);
    if (typeVisuals.length > 0) {
      acc[type] = typeVisuals;
    }
    return acc;
  }, {} as Record<CaseStudyVisualType, CaseStudyVisual[]>);

  const hasVisuals = visuals.length > 0;
  const totalCount = visuals.length;

  const handleVisualClick = (visual: CaseStudyVisual) => {
    if (visual.mediaType === 'video' && visual.linkUrl) {
      window.open(visual.linkUrl, '_blank');
    } else {
      setSelectedVisual(visual);
    }
  };

  const closeLightbox = () => setSelectedVisual(null);

  if (!hasVisuals && !editable) {
    return (
      <div className="text-sm text-slate-500 italic py-4">
        No visuals added yet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header with count */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Visuals {totalCount > 0 && <span className="text-slate-600">({totalCount})</span>}
        </h3>
        {isEditMode && onAddVisual && (
          <button
            onClick={onAddVisual}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Visual
          </button>
        )}
      </div>

      {/* Grouped visuals by type */}
      {Object.entries(groupedVisuals).map(([type, typeVisuals]) => (
        <div key={type}>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-xs font-medium text-slate-400">
              {VISUAL_TYPE_LABELS[type as CaseStudyVisualType]}
            </h4>
            <span className="text-xs text-slate-600">
              ({typeVisuals.length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {typeVisuals.map((visual) => (
              <VisualCard
                key={visual.id}
                visual={visual}
                editable={editable && isEditMode}
                isLoading={isLoading[visual.id]}
                onLoad={() => setIsLoading((prev) => ({ ...prev, [visual.id]: false }))}
                onClick={() => handleVisualClick(visual)}
                onRemove={onRemoveVisual ? () => onRemoveVisual(visual.id) : undefined}
                onEdit={onEditVisual ? () => onEditVisual(visual) : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state in edit mode */}
      {!hasVisuals && isEditMode && (
        <div className="flex items-center justify-center py-8 border border-dashed border-slate-700 rounded-lg">
          <button
            onClick={onAddVisual}
            className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-300 transition-colors"
          >
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm">Add your first visual</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      {selectedVisual && (
        <Lightbox visual={selectedVisual} onClose={closeLightbox} />
      )}
    </div>
  );
}

// ============================================================================
// Visual Card
// ============================================================================

interface VisualCardProps {
  visual: CaseStudyVisual;
  editable: boolean;
  isLoading?: boolean;
  onLoad?: () => void;
  onClick: () => void;
  onRemove?: () => void;
  onEdit?: () => void;
}

function VisualCard({
  visual,
  editable,
  isLoading,
  onLoad,
  onClick,
  onRemove,
  onEdit,
}: VisualCardProps) {
  const imageUrl =
    visual.mediaType === 'video'
      ? visual.posterUrl || visual.thumbnailUrl || visual.assetUrl || null
      : visual.assetUrl || null;

  const isVideo = visual.mediaType === 'video';
  const isInternal = visual.visibility === 'internal';

  return (
    <div className="group relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-slate-700" />
      )}

      {/* Image/Thumbnail */}
      <button onClick={onClick} className="w-full h-full cursor-pointer">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={visual.title || visual.caption || 'Case study visual'}
            className="w-full h-full object-cover"
            onLoad={onLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            {isVideo ? (
              <Video className="w-8 h-8" />
            ) : (
              <ImageIcon className="w-8 h-8" />
            )}
          </div>
        )}

        {/* Video overlay with play icon */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-slate-900 ml-0.5" fill="currentColor" />
            </div>
          </div>
        )}

        {/* Hover overlay with info */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            {/* Type + Media badge */}
            <div className="flex items-center gap-1.5 mb-1">
              {isVideo ? (
                <Video className="w-3 h-3 text-white/80" />
              ) : (
                <ImageIcon className="w-3 h-3 text-white/80" />
              )}
              <span className="text-[10px] text-white/80 uppercase tracking-wide">
                {VISUAL_TYPE_LABELS[visual.type]}
              </span>
            </div>

            {/* Caption preview */}
            {(visual.title || visual.caption) && (
              <p className="text-xs text-white/90 line-clamp-2">
                {visual.title || visual.caption}
              </p>
            )}
          </div>
        </div>

        {/* Internal visibility badge */}
        {isInternal && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/90 text-[10px] font-medium text-white rounded">
            <Lock className="w-2.5 h-2.5" />
            Internal
          </div>
        )}
      </button>

      {/* Edit controls - only show in edit mode */}
      {editable && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1.5 bg-red-900/90 hover:bg-red-800 rounded text-red-300 hover:text-white transition-colors"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Lightbox
// ============================================================================

interface LightboxProps {
  visual: CaseStudyVisual;
  onClose: () => void;
}

function Lightbox({ visual, onClose }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Image container */}
      <div
        className="max-w-5xl max-h-[90vh] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.assetUrl}
          alt={visual.title || visual.caption || 'Case study visual'}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Caption */}
        {(visual.title || visual.caption) && (
          <div className="mt-4 text-center">
            {visual.title && (
              <h3 className="text-lg font-medium text-white">{visual.title}</h3>
            )}
            {visual.caption && (
              <p className="text-sm text-white/70 mt-1">{visual.caption}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
