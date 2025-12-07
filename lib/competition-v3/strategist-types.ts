// lib/competition-v3/strategist-types.ts
// Competition Lab V4 - Strategist Model Types
//
// Structured strategic intelligence derived from V3 run data.
// This model is designed for a strategist-friendly view.

import type { CompetitionRunV3Response } from './ui-types';

// ============================================================================
// Competitor Summary for Strategist View
// ============================================================================

export interface StrategistCompetitorSummary {
  id: string;
  name: string;
  url?: string;
  /** Human-readable type, e.g. "Fractional CMO collective" */
  type: string;
  /** Threat score 0–100 */
  threat: number;
  /** 1–3 sentences explaining why this is a threat */
  whyThreat: string;
  /** 3 key angles/differentiators */
  keyAngles: string[];
}

// ============================================================================
// Main Strategist Model
// ============================================================================

export interface CompetitionStrategistModel {
  runId: string;
  companyId: string;
  createdAt: string;

  // -------------------------------------------------------------------------
  // Headline & Elevator
  // -------------------------------------------------------------------------
  /** One-line "what's going on" e.g. "You're in a crowded boutique startup agency cluster." */
  headline: string;
  /** 2–3 sentence summary suitable for a slide */
  elevator: string;

  // -------------------------------------------------------------------------
  // Positioning
  // -------------------------------------------------------------------------
  /** 3–5 sentences comparing the company to market archetypes */
  positioningSummary: string;

  // -------------------------------------------------------------------------
  // Competitor Breakdown
  // -------------------------------------------------------------------------
  /** Top 3–5 primary competitors */
  primaryCompetitors: StrategistCompetitorSummary[];
  /** Alternative options by type */
  altOptionsByType: {
    fractional: StrategistCompetitorSummary[];
    platform: StrategistCompetitorSummary[];
    internal: StrategistCompetitorSummary[];
  };

  // -------------------------------------------------------------------------
  // Plays & Risks
  // -------------------------------------------------------------------------
  recommendedPlays: {
    now: string[];
    next: string[];
    later: string[];
  };
  keyRisks: string[];
  /** How to explain our edge in sales / decks */
  keyTalkingPoints: string[];

  // -------------------------------------------------------------------------
  // Watch List
  // -------------------------------------------------------------------------
  /** 1–2 paragraphs on emerging patterns (optional) */
  watchListNotes?: string;
}

// ============================================================================
// Helper type for the orchestrator
// ============================================================================

export type CompetitionRunV3 = CompetitionRunV3Response;
