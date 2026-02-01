'use client';

// AssetLightbox.tsx
// Modal/lightbox component for viewing assets at full size with navigation.
// Supports images, video, and audio. ESC to close, arrow keys to navigate.

import { useCallback, useEffect, useRef } from 'react';

interface ReviewAsset {
  fileId: string;
  name: string;
  mimeType: string;
}

interface AssetLightboxProps {
  assets: ReviewAsset[];
  currentIndex: number;
  token: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function AssetLightbox({
  assets,
  currentIndex,
  token,
  onClose,
  onNavigate,
}: AssetLightboxProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const asset = assets[currentIndex];

  if (!asset) return null;

  const src = `/api/review/files/${asset.fileId}?token=${encodeURIComponent(token)}`;
  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');
  const isAudio = asset.mimeType.startsWith('audio/');

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < assets.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close when clicking overlay (not content)
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Asset preview"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-gray-800/80 p-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        aria-label="Close preview"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation: Previous */}
      {hasPrev && (
        <button
          onClick={goToPrev}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-gray-800/80 p-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          aria-label="Previous asset"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Navigation: Next */}
      {hasNext && (
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-gray-800/80 p-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          aria-label="Next asset"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main content area */}
      <div className="flex max-h-[90vh] max-w-[90vw] flex-col items-center">
        {/* Asset preview */}
        <div className="flex max-h-[80vh] w-full items-center justify-center">
          {isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={asset.name}
              className="max-h-[80vh] max-w-full object-contain"
            />
          )}
          {isVideo && (
            <video
              src={src}
              controls
              autoPlay
              className="max-h-[80vh] max-w-full"
            />
          )}
          {isAudio && (
            <div className="flex flex-col items-center gap-6 rounded-lg bg-gray-800 p-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-700">
                <svg className="h-12 w-12 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <audio src={src} controls autoPlay className="w-80" />
            </div>
          )}
          {!isImage && !isVideo && !isAudio && (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-gray-800 p-8">
              <svg className="h-16 w-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400">Preview not available</p>
              <a
                href={`${src}&dl=1`}
                download
                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-amber-400"
              >
                Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer: filename and counter */}
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="max-w-md truncate text-center text-sm text-gray-300" title={asset.name}>
            {asset.name}
          </p>
          <p className="text-xs text-gray-500">
            {currentIndex + 1} of {assets.length}
          </p>
        </div>
      </div>
    </div>
  );
}
