// lib/media/seasonality.ts
// Seasonality Engine - Apply temporal demand patterns to forecasts
//
// This module provides functions for applying seasonality multipliers
// to base forecasts, enabling accurate month-by-month projections.

import type { SeasonalityProfile } from './mediaProfile';

// ============================================================================
// Month Utilities
// ============================================================================

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type MonthName = typeof MONTH_NAMES[number];
export type MonthFullName = typeof MONTH_FULL_NAMES[number];

/**
 * Convert month index (0-11) to abbreviated month name
 */
export function getMonthName(monthIndex: number): MonthName {
  return MONTH_NAMES[monthIndex % 12];
}

/**
 * Convert month name (short or full) to month index (0-11)
 */
export function getMonthIndex(month: string): number {
  const normalized = month.substring(0, 3);
  const idx = MONTH_NAMES.findIndex(
    m => m.toLowerCase() === normalized.toLowerCase()
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Get all month names in order
 */
export function getAllMonthNames(): MonthName[] {
  return [...MONTH_NAMES];
}

// ============================================================================
// Core Seasonality Functions
// ============================================================================

/**
 * Apply seasonality multiplier to a base forecast value
 *
 * @param baseForecast - The base (unseasoned) forecast value
 * @param month - Month name (Jan, Feb, etc.) or full name
 * @param seasonality - Seasonality profile with monthly multipliers
 * @returns Seasonally adjusted forecast value
 */
export function applySeasonality(
  baseForecast: number,
  month: string,
  seasonality: SeasonalityProfile
): number {
  const monthKey = month.substring(0, 3);
  // Capitalize first letter for matching
  const normalizedKey = monthKey.charAt(0).toUpperCase() + monthKey.slice(1).toLowerCase();
  const multiplier = seasonality[normalizedKey] ?? 1.0;
  return baseForecast * multiplier;
}

/**
 * Apply seasonality to a full year of monthly forecasts
 *
 * @param monthlyBaseForecast - Base forecast value per month (before seasonality)
 * @param seasonality - Seasonality profile
 * @returns Array of 12 seasonally adjusted values (Jan-Dec)
 */
export function applySeasonalityToYear(
  monthlyBaseForecast: number,
  seasonality: SeasonalityProfile
): number[] {
  return MONTH_NAMES.map(month => applySeasonality(monthlyBaseForecast, month, seasonality));
}

/**
 * Apply seasonality to an array of monthly values
 *
 * @param monthlyValues - Array of 12 monthly values
 * @param seasonality - Seasonality profile
 * @returns Array of 12 seasonally adjusted values
 */
export function applySeasonalityToMonthlyArray(
  monthlyValues: number[],
  seasonality: SeasonalityProfile
): number[] {
  return monthlyValues.map((value, idx) =>
    applySeasonality(value, MONTH_NAMES[idx], seasonality)
  );
}

/**
 * Remove seasonality from a value to get the base forecast
 *
 * @param seasonalValue - The seasonally adjusted value
 * @param month - Month name
 * @param seasonality - Seasonality profile
 * @returns Deseasonalized base value
 */
export function removeSeasonality(
  seasonalValue: number,
  month: string,
  seasonality: SeasonalityProfile
): number {
  const monthKey = month.substring(0, 3);
  const normalizedKey = monthKey.charAt(0).toUpperCase() + monthKey.slice(1).toLowerCase();
  const multiplier = seasonality[normalizedKey] ?? 1.0;
  return multiplier > 0 ? seasonalValue / multiplier : seasonalValue;
}

// ============================================================================
// Period-Based Seasonality
// ============================================================================

/**
 * Get seasonality multiplier for a date range
 *
 * @param startDate - Start of the period
 * @param endDate - End of the period
 * @param seasonality - Seasonality profile
 * @returns Weighted average multiplier for the period
 */
export function getSeasonalityForPeriod(
  startDate: Date,
  endDate: Date,
  seasonality: SeasonalityProfile
): number {
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();

  // Same month
  if (startMonth === endMonth && startDate.getFullYear() === endDate.getFullYear()) {
    return seasonality[MONTH_NAMES[startMonth]] ?? 1.0;
  }

  // Calculate weighted average based on days in each month
  let totalDays = 0;
  let weightedSum = 0;

  const current = new Date(startDate);
  while (current <= endDate) {
    const month = current.getMonth();
    const monthName = MONTH_NAMES[month];
    const multiplier = seasonality[monthName] ?? 1.0;

    // Count days in this month within the range
    const monthStart = new Date(current.getFullYear(), month, 1);
    const monthEnd = new Date(current.getFullYear(), month + 1, 0);
    const rangeStart = current > monthStart ? current : monthStart;
    const rangeEnd = monthEnd < endDate ? monthEnd : endDate;

    const daysInRange = Math.ceil(
      (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    totalDays += daysInRange;
    weightedSum += multiplier * daysInRange;

    // Move to next month
    current.setMonth(current.getMonth() + 1);
    current.setDate(1);
  }

  return totalDays > 0 ? weightedSum / totalDays : 1.0;
}

// ============================================================================
// Quarterly Aggregation
// ============================================================================

export interface QuarterlySeasonality {
  Q1: number; // Jan-Mar
  Q2: number; // Apr-Jun
  Q3: number; // Jul-Sep
  Q4: number; // Oct-Dec
}

/**
 * Get quarterly seasonality averages from monthly profile
 */
export function getQuarterlySeasonality(
  seasonality: SeasonalityProfile
): QuarterlySeasonality {
  const q1 = ['Jan', 'Feb', 'Mar'].map(m => seasonality[m] ?? 1.0);
  const q2 = ['Apr', 'May', 'Jun'].map(m => seasonality[m] ?? 1.0);
  const q3 = ['Jul', 'Aug', 'Sep'].map(m => seasonality[m] ?? 1.0);
  const q4 = ['Oct', 'Nov', 'Dec'].map(m => seasonality[m] ?? 1.0);

  return {
    Q1: q1.reduce((a, b) => a + b, 0) / 3,
    Q2: q2.reduce((a, b) => a + b, 0) / 3,
    Q3: q3.reduce((a, b) => a + b, 0) / 3,
    Q4: q4.reduce((a, b) => a + b, 0) / 3,
  };
}

/**
 * Get quarter name from month index
 */
export function getQuarterFromMonth(monthIndex: number): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  if (monthIndex < 3) return 'Q1';
  if (monthIndex < 6) return 'Q2';
  if (monthIndex < 9) return 'Q3';
  return 'Q4';
}

// ============================================================================
// Seasonality Analysis
// ============================================================================

/**
 * Analyze seasonality profile for insights
 */
export function analyzeSeasonality(seasonality: SeasonalityProfile): {
  peakMonths: MonthName[];
  lowMonths: MonthName[];
  peakValue: number;
  lowValue: number;
  volatility: number;
  recommendation: string;
} {
  const entries = MONTH_NAMES.map(m => ({
    month: m,
    value: seasonality[m] ?? 1.0,
  }));

  // Sort by value
  const sorted = [...entries].sort((a, b) => b.value - a.value);

  const peakMonths = sorted.slice(0, 3).map(e => e.month);
  const lowMonths = sorted.slice(-3).map(e => e.month);

  const values = entries.map(e => e.value);
  const peakValue = Math.max(...values);
  const lowValue = Math.min(...values);

  // Calculate volatility (standard deviation)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const volatility = Math.sqrt(variance);

  // Generate recommendation
  let recommendation: string;
  if (volatility < 0.1) {
    recommendation = 'Demand is relatively flat. Consider steady-state budgeting.';
  } else if (volatility < 0.25) {
    recommendation = 'Moderate seasonality. Adjust budgets 10-20% during peak/low periods.';
  } else {
    recommendation = 'High seasonality. Consider aggressive budget shifting to capitalize on peak periods.';
  }

  return {
    peakMonths,
    lowMonths,
    peakValue,
    lowValue,
    volatility,
    recommendation,
  };
}

// ============================================================================
// Seasonality Profile Builders
// ============================================================================

/**
 * Create a custom seasonality profile from monthly values
 */
export function createSeasonalityProfile(
  monthlyMultipliers: Record<string, number>
): SeasonalityProfile {
  const profile: SeasonalityProfile = {};

  for (const month of MONTH_NAMES) {
    // Try different formats
    profile[month] = monthlyMultipliers[month] ??
      monthlyMultipliers[month.toLowerCase()] ??
      monthlyMultipliers[MONTH_FULL_NAMES[getMonthIndex(month)]] ??
      1.0;
  }

  return profile;
}

/**
 * Blend two seasonality profiles
 *
 * @param profile1 - First profile
 * @param profile2 - Second profile
 * @param weight1 - Weight for first profile (0-1)
 * @returns Blended profile
 */
export function blendSeasonalityProfiles(
  profile1: SeasonalityProfile,
  profile2: SeasonalityProfile,
  weight1: number = 0.5
): SeasonalityProfile {
  const weight2 = 1 - weight1;
  const blended: SeasonalityProfile = {};

  for (const month of MONTH_NAMES) {
    blended[month] = (profile1[month] ?? 1.0) * weight1 + (profile2[month] ?? 1.0) * weight2;
  }

  return blended;
}

/**
 * Scale a seasonality profile to have a specific average
 *
 * @param profile - Original profile
 * @param targetAverage - Desired average (default 1.0)
 * @returns Scaled profile
 */
export function normalizeSeasonalityProfile(
  profile: SeasonalityProfile,
  targetAverage: number = 1.0
): SeasonalityProfile {
  const values = MONTH_NAMES.map(m => profile[m] ?? 1.0);
  const currentAverage = values.reduce((a, b) => a + b, 0) / 12;
  const scaleFactor = currentAverage > 0 ? targetAverage / currentAverage : 1;

  const normalized: SeasonalityProfile = {};
  for (const month of MONTH_NAMES) {
    normalized[month] = (profile[month] ?? 1.0) * scaleFactor;
  }

  return normalized;
}
