/**
 * Creative Review Asset Status (CRAS) — Mux columns (tblIzb8stTudAnDQY, Client PM base).
 *
 * Add these in the Airtable UI (not migrated by code):
 * - Mux Asset ID — single line text
 * - Mux Upload ID — single line text
 * - Mux Playback ID — single line text
 * - Mux Status — single select: preparing | ready | errored
 * - Mux Duration — number (seconds)
 * - Mux Aspect Ratio — single line text (e.g. 16:9)
 * - Mux Error — long text
 */

export const CRAS_MUX_ASSET_ID_FIELD = 'Mux Asset ID';
export const CRAS_MUX_UPLOAD_ID_FIELD = 'Mux Upload ID';
export const CRAS_MUX_PLAYBACK_ID_FIELD = 'Mux Playback ID';
export const CRAS_MUX_STATUS_FIELD = 'Mux Status';
export const CRAS_MUX_DURATION_FIELD = 'Mux Duration';
export const CRAS_MUX_ASPECT_RATIO_FIELD = 'Mux Aspect Ratio';
export const CRAS_MUX_ERROR_FIELD = 'Mux Error';

/** CRAS field names used to detect an existing Mux pipeline row (minimal Airtable read set). */
export const CRAS_MUX_IDENTIFIER_FIELD_NAMES = [
  CRAS_MUX_ASSET_ID_FIELD,
  CRAS_MUX_PLAYBACK_ID_FIELD,
  CRAS_MUX_UPLOAD_ID_FIELD,
] as const;

export type CrasMuxStatusValue = 'preparing' | 'ready' | 'errored';

function muxFieldNonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** True if CRAS already has any Mux pipeline identifier (skip starting a duplicate upload). */
export function crasFieldsHaveAnyMuxIdentifier(fields: Record<string, unknown> | undefined | null): boolean {
  if (!fields) return false;
  return CRAS_MUX_IDENTIFIER_FIELD_NAMES.some((name) => muxFieldNonEmpty(fields[name]));
}
