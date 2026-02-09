'use client';

// components/media/GoogleDriveAsset.tsx
// Component for displaying animated assets (GIFs, videos) from Google Drive

import { useState, useEffect } from 'react';
import { getGoogleDriveDirectUrl, detectFileType } from '@/lib/utils/googleDrive';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export interface GoogleDriveAssetProps {
  /**
   * Google Drive share link (e.g., https://drive.google.com/file/d/FILE_ID/view)
   * or just the file ID
   */
  driveUrl: string;
  /**
   * Optional filename to help detect file type
   */
  filename?: string;
  /**
   * Alt text for images/GIFs
   */
  alt?: string;
  /**
   * CSS classes for the container
   */
  className?: string;
  /**
   * Maximum width/height constraints
   */
  maxWidth?: string | number;
  maxHeight?: string | number;
  /**
   * Whether to show controls for videos
   */
  videoControls?: boolean;
  /**
   * Whether to autoplay videos (muted)
   */
  autoplay?: boolean;
  /**
   * Whether to loop videos/GIFs
   */
  loop?: boolean;
}

/**
 * Displays an animated asset (GIF, video, or image) from Google Drive
 * Automatically detects file type and renders appropriately
 */
export function GoogleDriveAsset({
  driveUrl,
  filename,
  alt = 'Animated asset',
  className = '',
  maxWidth,
  maxHeight,
  videoControls = true,
  autoplay = false,
  loop = true,
}: GoogleDriveAssetProps) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fileType, setFileType] = useState<'image' | 'video' | 'gif' | 'unknown'>('unknown');

  useEffect(() => {
    if (!driveUrl) {
      setError('No Google Drive URL provided');
      setIsLoading(false);
      return;
    }

    const url = getGoogleDriveDirectUrl(driveUrl);
    if (!url) {
      setError('Invalid Google Drive URL format');
      setIsLoading(false);
      return;
    }

    setDirectUrl(url);
    setFileType(detectFileType(driveUrl, filename));
    setIsLoading(false);
  }, [driveUrl, filename]);

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 rounded-xl border border-slate-700/50 ${className}`}
        style={{ minHeight: '200px' }}
      >
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading asset...</span>
        </div>
      </div>
    );
  }

  if (error || !directUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800/50 rounded-xl border border-red-500/30 ${className}`}
        style={{ minHeight: '200px' }}
      >
        <div className="flex flex-col items-center gap-2 text-red-400">
          <AlertCircle className="w-6 h-6" />
          <span className="text-sm">{error || 'Failed to load asset'}</span>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 mt-2"
            >
              Open in Google Drive
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : undefined,
    maxHeight: maxHeight ? (typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight) : undefined,
  };

  // Render GIF or image
  if (fileType === 'gif' || fileType === 'image') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={containerStyle}>
        <img
          src={directUrl}
          alt={alt}
          className="max-w-full max-h-full rounded-xl"
          style={{ objectFit: 'contain' }}
          onError={() => setError('Failed to load image')}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  }

  // Render video
  if (fileType === 'video') {
    return (
      <div className={`flex items-center justify-center ${className}`} style={containerStyle}>
        <video
          src={directUrl}
          controls={videoControls}
          autoPlay={autoplay}
          loop={loop}
          muted={autoplay} // Mute if autoplay to avoid browser restrictions
          className="max-w-full max-h-full rounded-xl"
          style={{ objectFit: 'contain' }}
          onError={() => setError('Failed to load video')}
          onLoadedData={() => setIsLoading(false)}
        >
          Your browser does not support the video tag.
          <a href={directUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
            Download video
          </a>
        </video>
      </div>
    );
  }

  // Fallback: try to render as image anyway
  return (
    <div className={`flex items-center justify-center ${className}`} style={containerStyle}>
      <img
        src={directUrl}
        alt={alt}
        className="max-w-full max-h-full rounded-xl"
        style={{ objectFit: 'contain' }}
        onError={() => setError('Failed to load asset. Please check the file type is supported.')}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
