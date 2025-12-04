// lib/media/promoCalendar.ts
// Promotion Calendar Engine
//
// Generates and manages promotional calendars based on:
// - Seasonal demand patterns
// - Retail holidays
// - Weather-based peaks
// - Industry-specific events
// - Brand-specific recurring promotions
//
// Integrates with AI Planner, Creative Lab, and Plan Summary

import type { MediaProfile } from './mediaProfile';
import type { MediaChannel } from './types';

// ============================================================================
// Types
// ============================================================================

export type PromoIntensity = 'low' | 'medium' | 'high' | 'peak';

export type PromoCategory =
  | 'seasonal'
  | 'holiday'
  | 'weather'
  | 'industry'
  | 'brand'
  | 'competitive';

export type MonthName =
  | 'Jan' | 'Feb' | 'Mar' | 'Apr' | 'May' | 'Jun'
  | 'Jul' | 'Aug' | 'Sep' | 'Oct' | 'Nov' | 'Dec';

export interface PromoEvent {
  id: string;
  month: MonthName;
  startDay?: number;
  endDay?: number;
  label: string;
  description: string;
  category: PromoCategory;
  intensity: PromoIntensity;
  recommendedChannels: MediaChannel[];
  expectedLift: number; // multiplier (1.0 = no lift, 1.3 = 30% lift)
  messagingThemes: string[];
  budgetRecommendation: 'increase' | 'maintain' | 'decrease';
  budgetMultiplier: number;
}

export interface PromoCalendar {
  companyId: string;
  year: number;
  events: PromoEvent[];
  monthlyIntensity: Record<MonthName, PromoIntensity>;
  peakMonths: MonthName[];
  lowMonths: MonthName[];
  annualBudgetDistribution: Record<MonthName, number>; // percentage allocation
}

export interface IndustryPromoProfile {
  industry: string;
  seasonalEvents: Omit<PromoEvent, 'id'>[];
  peakMonths: MonthName[];
  lowMonths: MonthName[];
}

// ============================================================================
// Industry Promo Profiles
// ============================================================================

const INDUSTRY_PROMO_PROFILES: Record<string, IndustryPromoProfile> = {
  home_services: {
    industry: 'Home Services',
    seasonalEvents: [
      {
        month: 'Mar',
        label: 'Spring Prep',
        description: 'Spring home preparation and maintenance season',
        category: 'seasonal',
        intensity: 'high',
        recommendedChannels: ['search', 'lsa', 'social'],
        expectedLift: 1.25,
        messagingThemes: ['Spring cleaning', 'Home refresh', 'Seasonal maintenance'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.2,
      },
      {
        month: 'Oct',
        label: 'Fall Prep',
        description: 'Fall winterization and preparation',
        category: 'seasonal',
        intensity: 'high',
        recommendedChannels: ['search', 'lsa', 'radio'],
        expectedLift: 1.3,
        messagingThemes: ['Winterization', 'Fall maintenance', 'Beat the cold'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.25,
      },
    ],
    peakMonths: ['Mar', 'Apr', 'Sep', 'Oct'],
    lowMonths: ['Jan', 'Feb', 'Dec'],
  },
  automotive: {
    industry: 'Automotive',
    seasonalEvents: [
      {
        month: 'Oct',
        label: 'Remote Start Season',
        description: 'Peak demand for remote start installations',
        category: 'seasonal',
        intensity: 'peak',
        recommendedChannels: ['search', 'maps', 'radio'],
        expectedLift: 1.5,
        messagingThemes: ['Stay warm', 'Beat the cold', 'Convenience'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.4,
      },
      {
        month: 'Nov',
        label: 'Black Friday / Holiday',
        description: 'Gift giving and holiday promotions',
        category: 'holiday',
        intensity: 'peak',
        recommendedChannels: ['search', 'social', 'display', 'radio'],
        expectedLift: 1.4,
        messagingThemes: ['Gift giving', 'Holiday savings', 'Limited time'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.35,
      },
      {
        month: 'May',
        label: 'Summer Audio',
        description: 'Summer audio and CarPlay upgrades',
        category: 'seasonal',
        intensity: 'high',
        recommendedChannels: ['search', 'social', 'youtube'],
        expectedLift: 1.3,
        messagingThemes: ['Road trip ready', 'Summer sounds', 'Upgrade your ride'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.2,
      },
    ],
    peakMonths: ['Oct', 'Nov', 'Dec'],
    lowMonths: ['Jan', 'Feb', 'Mar'],
  },
  retail: {
    industry: 'Retail',
    seasonalEvents: [
      {
        month: 'Nov',
        startDay: 20,
        endDay: 30,
        label: 'Black Friday / Cyber Monday',
        description: 'Biggest retail event of the year',
        category: 'holiday',
        intensity: 'peak',
        recommendedChannels: ['search', 'social', 'display', 'email'],
        expectedLift: 2.0,
        messagingThemes: ['Biggest sale', 'Limited time', 'Door busters'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.8,
      },
      {
        month: 'Dec',
        label: 'Holiday Shopping',
        description: 'Holiday gift shopping season',
        category: 'holiday',
        intensity: 'peak',
        recommendedChannels: ['search', 'social', 'display', 'email'],
        expectedLift: 1.6,
        messagingThemes: ['Perfect gift', 'Last minute', 'Free shipping'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.5,
      },
      {
        month: 'Feb',
        startDay: 1,
        endDay: 14,
        label: 'Valentine\'s Day',
        description: 'Valentine\'s gift shopping',
        category: 'holiday',
        intensity: 'medium',
        recommendedChannels: ['social', 'display', 'email'],
        expectedLift: 1.2,
        messagingThemes: ['Perfect gift', 'Show your love', 'Special occasion'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.15,
      },
    ],
    peakMonths: ['Nov', 'Dec'],
    lowMonths: ['Jan', 'Feb', 'Aug'],
  },
  healthcare: {
    industry: 'Healthcare',
    seasonalEvents: [
      {
        month: 'Jan',
        label: 'New Year Health',
        description: 'New Year resolution health focus',
        category: 'seasonal',
        intensity: 'high',
        recommendedChannels: ['search', 'social', 'display'],
        expectedLift: 1.35,
        messagingThemes: ['New year, new you', 'Health goals', 'Start fresh'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.3,
      },
      {
        month: 'Sep',
        label: 'Back to School',
        description: 'Back to school health checkups',
        category: 'seasonal',
        intensity: 'medium',
        recommendedChannels: ['search', 'lsa'],
        expectedLift: 1.2,
        messagingThemes: ['Back to school', 'Health checkup', 'Ready for school'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.15,
      },
    ],
    peakMonths: ['Jan', 'Sep'],
    lowMonths: ['Jun', 'Jul', 'Aug'],
  },
  legal: {
    industry: 'Legal',
    seasonalEvents: [
      {
        month: 'Jan',
        label: 'Tax Season Prep',
        description: 'Tax-related legal services',
        category: 'seasonal',
        intensity: 'high',
        recommendedChannels: ['search', 'lsa'],
        expectedLift: 1.25,
        messagingThemes: ['Tax help', 'Expert guidance', 'Don\'t wait'],
        budgetRecommendation: 'increase',
        budgetMultiplier: 1.2,
      },
    ],
    peakMonths: ['Jan', 'Apr'],
    lowMonths: ['Jul', 'Aug', 'Dec'],
  },
  default: {
    industry: 'General',
    seasonalEvents: [],
    peakMonths: ['Nov', 'Dec'],
    lowMonths: ['Jan', 'Aug'],
  },
};

// ============================================================================
// Universal Holidays
// ============================================================================

const UNIVERSAL_HOLIDAYS: Omit<PromoEvent, 'id'>[] = [
  {
    month: 'Jan',
    startDay: 1,
    endDay: 3,
    label: 'New Year',
    description: 'New Year promotions and fresh start messaging',
    category: 'holiday',
    intensity: 'medium',
    recommendedChannels: ['search', 'social', 'email'],
    expectedLift: 1.15,
    messagingThemes: ['New year', 'Fresh start', 'New beginnings'],
    budgetRecommendation: 'maintain',
    budgetMultiplier: 1.1,
  },
  {
    month: 'Feb',
    startDay: 10,
    endDay: 14,
    label: 'Valentine\'s Day',
    description: 'Valentine\'s themed promotions',
    category: 'holiday',
    intensity: 'low',
    recommendedChannels: ['social', 'email'],
    expectedLift: 1.1,
    messagingThemes: ['Love', 'Special occasion', 'Gift'],
    budgetRecommendation: 'maintain',
    budgetMultiplier: 1.0,
  },
  {
    month: 'May',
    startDay: 8,
    endDay: 14,
    label: 'Mother\'s Day',
    description: 'Mother\'s Day promotions',
    category: 'holiday',
    intensity: 'medium',
    recommendedChannels: ['social', 'display', 'email'],
    expectedLift: 1.2,
    messagingThemes: ['Thank mom', 'Special gift', 'Appreciation'],
    budgetRecommendation: 'increase',
    budgetMultiplier: 1.1,
  },
  {
    month: 'Jun',
    startDay: 12,
    endDay: 18,
    label: 'Father\'s Day',
    description: 'Father\'s Day promotions',
    category: 'holiday',
    intensity: 'medium',
    recommendedChannels: ['social', 'display', 'email'],
    expectedLift: 1.2,
    messagingThemes: ['Thank dad', 'Perfect gift', 'Appreciation'],
    budgetRecommendation: 'increase',
    budgetMultiplier: 1.1,
  },
  {
    month: 'Jul',
    startDay: 1,
    endDay: 7,
    label: 'July 4th',
    description: 'Independence Day sales and promotions',
    category: 'holiday',
    intensity: 'medium',
    recommendedChannels: ['search', 'social', 'display'],
    expectedLift: 1.15,
    messagingThemes: ['Summer sale', 'Independence Day', 'Celebration'],
    budgetRecommendation: 'maintain',
    budgetMultiplier: 1.05,
  },
  {
    month: 'Sep',
    startDay: 1,
    endDay: 7,
    label: 'Labor Day',
    description: 'Labor Day sales',
    category: 'holiday',
    intensity: 'medium',
    recommendedChannels: ['search', 'display', 'email'],
    expectedLift: 1.2,
    messagingThemes: ['End of summer', 'Labor Day sale', 'Last chance'],
    budgetRecommendation: 'increase',
    budgetMultiplier: 1.15,
  },
  {
    month: 'Nov',
    startDay: 20,
    endDay: 30,
    label: 'Thanksgiving / Black Friday',
    description: 'Biggest shopping event of the year',
    category: 'holiday',
    intensity: 'peak',
    recommendedChannels: ['search', 'social', 'display', 'email'],
    expectedLift: 1.5,
    messagingThemes: ['Black Friday', 'Biggest sale', 'Limited time'],
    budgetRecommendation: 'increase',
    budgetMultiplier: 1.4,
  },
  {
    month: 'Dec',
    startDay: 1,
    endDay: 25,
    label: 'Holiday Season',
    description: 'Christmas and holiday shopping',
    category: 'holiday',
    intensity: 'high',
    recommendedChannels: ['search', 'social', 'display', 'email'],
    expectedLift: 1.35,
    messagingThemes: ['Holiday gift', 'Perfect present', 'Last minute'],
    budgetRecommendation: 'increase',
    budgetMultiplier: 1.3,
  },
];

// ============================================================================
// Calendar Generation
// ============================================================================

/**
 * Generate a promotion calendar for a company
 */
export function generatePromoCalendar(
  profile: MediaProfile,
  industry?: string,
  year?: number
): PromoCalendar {
  const calendarYear = year || new Date().getFullYear();
  const companyId = profile.companyId;

  // Get industry profile
  const industryProfile = INDUSTRY_PROMO_PROFILES[industry || 'default'] ||
    INDUSTRY_PROMO_PROFILES.default;

  // Combine industry events with universal holidays
  const events: PromoEvent[] = [];
  let eventId = 1;

  // Add industry-specific events
  for (const event of industryProfile.seasonalEvents) {
    events.push({
      ...event,
      id: `promo_${calendarYear}_${eventId++}`,
    });
  }

  // Add universal holidays (filter based on relevance)
  for (const holiday of UNIVERSAL_HOLIDAYS) {
    // Check if this month is a peak month for the industry
    const isPeakMonth = industryProfile.peakMonths.includes(holiday.month);
    const adjustedIntensity: PromoIntensity = isPeakMonth && holiday.intensity !== 'peak'
      ? 'high'
      : holiday.intensity;

    events.push({
      ...holiday,
      id: `promo_${calendarYear}_${eventId++}`,
      intensity: adjustedIntensity,
    });
  }

  // Apply seasonality from profile
  for (const event of events) {
    const seasonalityMultiplier = profile.seasonality[event.month] || 1;
    event.expectedLift *= seasonalityMultiplier;
    event.budgetMultiplier *= seasonalityMultiplier;
  }

  // Calculate monthly intensity
  const monthlyIntensity = calculateMonthlyIntensity(events);

  // Calculate budget distribution
  const annualBudgetDistribution = calculateBudgetDistribution(
    monthlyIntensity,
    profile.seasonality
  );

  // Identify peak and low months
  const { peakMonths, lowMonths } = identifyPeakAndLowMonths(
    monthlyIntensity,
    industryProfile
  );

  return {
    companyId,
    year: calendarYear,
    events: events.sort((a, b) => {
      const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    }),
    monthlyIntensity,
    peakMonths,
    lowMonths,
    annualBudgetDistribution,
  };
}

/**
 * Get events for a specific month
 */
export function getEventsForMonth(
  calendar: PromoCalendar,
  month: MonthName
): PromoEvent[] {
  return calendar.events.filter(e => e.month === month);
}

/**
 * Get upcoming events
 */
export function getUpcomingEvents(
  calendar: PromoCalendar,
  fromDate?: Date,
  count: number = 3
): PromoEvent[] {
  const now = fromDate || new Date();
  const currentMonth = now.getMonth();
  const monthNames: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonthName = monthNames[currentMonth];

  // Sort events by month and get upcoming
  const monthOrder = [...monthNames.slice(currentMonth), ...monthNames.slice(0, currentMonth)];

  const sorted = [...calendar.events].sort((a, b) => {
    return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
  });

  return sorted.slice(0, count);
}

/**
 * Get budget recommendation for a month
 */
export function getMonthBudgetRecommendation(
  calendar: PromoCalendar,
  month: MonthName,
  baseBudget: number
): {
  recommendedBudget: number;
  multiplier: number;
  reasoning: string;
} {
  const events = getEventsForMonth(calendar, month);
  const intensity = calendar.monthlyIntensity[month];
  const distribution = calendar.annualBudgetDistribution[month];

  // Calculate multiplier from events
  const eventMultipliers = events.map(e => e.budgetMultiplier);
  const maxMultiplier = eventMultipliers.length > 0
    ? Math.max(...eventMultipliers)
    : 1.0;

  // Adjust for intensity
  const intensityMultipliers: Record<PromoIntensity, number> = {
    low: 0.85,
    medium: 1.0,
    high: 1.15,
    peak: 1.3,
  };
  const intensityMultiplier = intensityMultipliers[intensity];

  const finalMultiplier = Math.max(maxMultiplier, intensityMultiplier);
  const recommendedBudget = Math.round(baseBudget * finalMultiplier);

  // Generate reasoning
  let reasoning = `${month} is a ${intensity} intensity month`;
  if (events.length > 0) {
    reasoning += ` with ${events.length} promotional event(s): ${events.map(e => e.label).join(', ')}`;
  }

  return {
    recommendedBudget,
    multiplier: finalMultiplier,
    reasoning,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateMonthlyIntensity(
  events: PromoEvent[]
): Record<MonthName, PromoIntensity> {
  const months: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const intensity: Record<MonthName, PromoIntensity> = {} as Record<MonthName, PromoIntensity>;

  for (const month of months) {
    const monthEvents = events.filter(e => e.month === month);

    if (monthEvents.length === 0) {
      intensity[month] = 'low';
    } else {
      // Use highest intensity event
      const intensityOrder: PromoIntensity[] = ['low', 'medium', 'high', 'peak'];
      const maxIntensity = monthEvents.reduce((max, e) => {
        return intensityOrder.indexOf(e.intensity) > intensityOrder.indexOf(max)
          ? e.intensity
          : max;
      }, 'low' as PromoIntensity);

      intensity[month] = maxIntensity;
    }
  }

  return intensity;
}

function calculateBudgetDistribution(
  intensity: Record<MonthName, PromoIntensity>,
  seasonality: Record<string, number>
): Record<MonthName, number> {
  const months: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const intensityWeights: Record<PromoIntensity, number> = {
    low: 0.7,
    medium: 1.0,
    high: 1.2,
    peak: 1.5,
  };

  // Calculate raw weights
  const rawWeights: Record<MonthName, number> = {} as Record<MonthName, number>;
  let totalWeight = 0;

  for (const month of months) {
    const intensityWeight = intensityWeights[intensity[month]];
    const seasonalWeight = seasonality[month] || 1;
    rawWeights[month] = intensityWeight * seasonalWeight;
    totalWeight += rawWeights[month];
  }

  // Normalize to percentages
  const distribution: Record<MonthName, number> = {} as Record<MonthName, number>;

  for (const month of months) {
    distribution[month] = Math.round((rawWeights[month] / totalWeight) * 100 * 10) / 10;
  }

  return distribution;
}

function identifyPeakAndLowMonths(
  intensity: Record<MonthName, PromoIntensity>,
  industryProfile: IndustryPromoProfile
): { peakMonths: MonthName[]; lowMonths: MonthName[] } {
  const months: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const peakMonths: MonthName[] = [];
  const lowMonths: MonthName[] = [];

  for (const month of months) {
    if (intensity[month] === 'peak' || intensity[month] === 'high') {
      peakMonths.push(month);
    } else if (intensity[month] === 'low') {
      lowMonths.push(month);
    }
  }

  // Add industry defaults if not enough identified
  if (peakMonths.length === 0) {
    peakMonths.push(...industryProfile.peakMonths);
  }

  if (lowMonths.length === 0) {
    lowMonths.push(...industryProfile.lowMonths);
  }

  return {
    peakMonths: [...new Set(peakMonths)],
    lowMonths: [...new Set(lowMonths)],
  };
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format calendar as markdown
 */
export function formatCalendarAsMarkdown(calendar: PromoCalendar): string {
  const lines: string[] = [];

  lines.push(`# Promotion Calendar ${calendar.year}`);
  lines.push('');

  lines.push('## Monthly Overview');
  lines.push('');
  lines.push('| Month | Intensity | Budget % | Events |');
  lines.push('|-------|-----------|----------|--------|');

  const months: MonthName[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (const month of months) {
    const events = getEventsForMonth(calendar, month);
    const eventLabels = events.map(e => e.label).join(', ') || '-';
    lines.push(
      `| ${month} | ${calendar.monthlyIntensity[month]} | ${calendar.annualBudgetDistribution[month]}% | ${eventLabels} |`
    );
  }

  lines.push('');
  lines.push('## Peak Months');
  lines.push(`- ${calendar.peakMonths.join(', ')}`);
  lines.push('');
  lines.push('## Low Months');
  lines.push(`- ${calendar.lowMonths.join(', ')}`);
  lines.push('');

  lines.push('## Event Details');
  lines.push('');

  for (const event of calendar.events) {
    lines.push(`### ${event.label} (${event.month})`);
    lines.push(`- **Intensity:** ${event.intensity}`);
    lines.push(`- **Category:** ${event.category}`);
    lines.push(`- **Expected Lift:** ${Math.round((event.expectedLift - 1) * 100)}%`);
    lines.push(`- **Channels:** ${event.recommendedChannels.join(', ')}`);
    lines.push(`- **Themes:** ${event.messagingThemes.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get event intensity badge color
 */
export function getIntensityColor(intensity: PromoIntensity): string {
  const colors: Record<PromoIntensity, string> = {
    low: 'bg-slate-500/20 text-slate-400',
    medium: 'bg-blue-500/20 text-blue-400',
    high: 'bg-amber-500/20 text-amber-400',
    peak: 'bg-red-500/20 text-red-400',
  };
  return colors[intensity];
}
