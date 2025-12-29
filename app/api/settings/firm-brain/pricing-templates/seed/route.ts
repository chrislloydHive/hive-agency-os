// app/api/settings/firm-brain/pricing-templates/seed/route.ts
// Seed Pricing Templates with starter data (idempotent)

import { NextResponse } from 'next/server';
import { upsertPricingTemplate } from '@/lib/airtable/firmBrain';
import type { PricingTemplateInput } from '@/lib/types/firmBrain';

export const dynamic = 'force-dynamic';

const SEED_TEMPLATES: PricingTemplateInput[] = [
  {
    name: 'Branding — Identity System — Project',
    description: `Best for:
Companies needing a scalable brand foundation (positioning → identity → guidelines).

Typical range:
$18,000–$35,000

Billing:
One-time (50/50 or milestone-based)

Includes:
- Brand positioning and messaging foundation
- Visual identity system (logo usage, typography, color, design language)
- Core brand guidelines with usage examples

Excludes:
- Naming
- Photography or video production
- Website design or build

Common add-ons:
- Naming exploration (+$5,000)
- Sub-brand or parent/child system (+$8,000)
- Additional stakeholder groups (+20%)

Pricing modifiers:
- Accelerated timeline under 3 weeks (+15%)
- Enterprise approval processes (+20%)

Notes:
Price toward the upper range for multi-stakeholder or multi-brand organizations.`,
  },
  {
    name: 'Website — Marketing Site — Project',
    description: `Best for:
New marketing sites or major redesigns focused on clarity, UX, and conversion-ready structure.

Typical range:
$12,000–$45,000

Billing:
One-time (milestone-based)

Includes:
- Information architecture and UX
- Design for key page templates
- Build on Wix Studio, Webflow, or Squarespace
- Basic on-page SEO setup

Excludes:
- Custom application development
- Heavy backend integrations unless scoped
- Ongoing SEO or content programs

Common add-ons:
- Copywriting for most pages (+$7,000)
- Ecommerce functionality (+$9,000)
- CRM or analytics integrations (+$3,000)
- More than 10 unique page templates (+$6,000)

Pricing modifiers:
- Complex navigation or multi-location sites (+10%)

Notes:
Platform choice and ecommerce scope push pricing toward the upper range.`,
  },
  {
    name: 'SEO — Growth Program — Retainer',
    description: `Best for:
Teams investing 3–6+ months in sustainable organic growth.

Typical range:
$4,000–$12,000 per month

Billing:
Monthly retainer (3-month minimum recommended)

Includes:
- Technical SEO audit and roadmap
- On-page optimization for key templates
- Content topic planning and briefs
- Monthly reporting and iteration

Excludes:
- Site rebuilds
- Guaranteed rankings
- Paid media management

Common add-ons:
- Large sites (1,000+ pages) (+$3,000/month)
- Multi-location SEO (+$2,500/month)
- 4+ content pieces per month (+$4,000/month)

Pricing modifiers:
- Highly competitive industries (+20%)

Notes:
Requires the ability to implement technical recommendations.`,
  },
  {
    name: 'Content — Content Engine — Retainer',
    description: `Best for:
Brands that need consistent content output without building an internal team.

Typical range:
$3,500–$15,000 per month

Billing:
Monthly retainer

Includes:
- Monthly content planning and calendar
- Content creation across agreed formats
- Light design support for packaging content
- Review and iteration cycles

Excludes:
- High-end video production
- Paid media management
- Deep technical SEO work

Common add-ons:
- Video or motion assets (+$3,000/month)
- New brand voice or messaging work (+$2,000/month)
- Weekly publishing cadence (+25%)

Pricing modifiers:
- Slow approvals may require scope or cadence adjustments.

Notes:
Works best with a clear brand voice and consistent review cadence.`,
  },
  {
    name: 'GAP — IA — Audit',
    description: `Best for:
Fast clarity on marketing gaps and prioritized next steps.

Typical range:
$2,500 (fixed)

Billing:
One-time

Includes:
- Website and messaging audit
- High-level brand and content review
- SEO snapshot and quick wins
- Prioritized recommendations

Excludes:
- Deep competitive research
- Implementation
- Heavy technical SEO crawls

Common add-ons:
- Large or complex sites (+$1,000)
- Multi-brand businesses (+$1,000)

Notes:
Designed as an entry point into deeper strategy or execution work.`,
  },
  {
    name: 'GAP — Plan — Strategy Engagement',
    description: `Best for:
Teams needing a defensible growth plan and sequenced roadmap.

Typical range:
$7,500–$18,000

Billing:
One-time

Includes:
- Deeper diagnostics across core growth areas
- Moderate competitive insight
- Prioritized initiatives and roadmap
- Measurement and tracking recommendations

Excludes:
- Implementation or build work
- Extensive creative production

Common add-ons:
- Enterprise stakeholder groups (+25%)
- Multiple audiences or products (+$5,000)
- Deeper competitive research (+$3,000)

Notes:
Price toward the upper range for complex organizations.`,
  },
  {
    name: 'GAP — Heavy — Deep Diagnostics',
    description: `Best for:
Organizations needing high-confidence direction through deep diagnostics.

Typical range:
$15,000–$35,000

Billing:
One-time

Includes:
- Competitive benchmarking
- SEO deep dive (technical, content, authority)
- Website UX and conversion analysis
- Strategic recommendations and prioritization

Excludes:
- Implementation
- Ongoing program management
- Extensive creative production

Common add-ons:
- Highly competitive markets (+20%)
- Multiple geographies (+$6,000)
- Very large sites (5,000+ pages) (+$8,000)

Notes:
Best suited for complex products or markets with sufficient data access.`,
  },
];

/**
 * POST /api/settings/firm-brain/pricing-templates/seed
 * Seed pricing templates (idempotent - safe to run multiple times)
 */
export async function POST() {
  try {
    const results: Array<{ name: string; id: string; created: boolean }> = [];

    for (const template of SEED_TEMPLATES) {
      const result = await upsertPricingTemplate(template);
      results.push({
        name: result.name,
        id: result.id,
        created: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.length} pricing templates`,
      results,
    });
  } catch (error) {
    console.error('[firm-brain/pricing-templates/seed] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to seed pricing templates' },
      { status: 500 }
    );
  }
}
