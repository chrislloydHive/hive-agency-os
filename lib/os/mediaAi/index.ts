// lib/os/mediaAi/index.ts
// Media AI module - AI-powered helpers for media operations
//
// This module provides AI-powered helpers for:
// - Generating Media QBR presentations
// - Future: Media forecasting, campaign recommendations, etc.

export { generateMediaQbr } from './generateMediaQbr';
export type { MediaQbrInput, MediaQbrOutput } from '@/lib/types/mediaQbr';
export { getEmptyMediaQbrOutput, isValidMediaQbr } from '@/lib/types/mediaQbr';
