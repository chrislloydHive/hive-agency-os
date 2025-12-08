// lib/contextGraph/domains/productOffer.ts
// Product & Offer Domain

import { z } from 'zod';
import { WithMeta, WithMetaArray } from '../types';

/**
 * Product definition
 */
export const Product = z.object({
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  price: z.number().nullable(),
  margin: z.number().nullable(),
  isHero: z.boolean().default(false),
});

export type Product = z.infer<typeof Product>;

/**
 * Promotion definition
 */
export const Promotion = z.object({
  name: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  discountType: z.string().nullable(),
  discountValue: z.number().nullable(),
});

export type Promotion = z.infer<typeof Promotion>;

/**
 * ProductOffer domain captures product, pricing, and promotional context.
 * This informs offer strategy and creative messaging.
 */
export const ProductOfferDomain = z.object({
  // FCB-extracted fields (primary, auto-filled from website)
  primaryProducts: WithMetaArray(z.string()),
  services: WithMetaArray(z.string()),
  valueProposition: WithMeta(z.string()),
  pricingModel: WithMeta(z.string()),
  keyDifferentiators: WithMetaArray(z.string()),

  // Product Lines (critical for strategy)
  productLines: WithMetaArray(z.string()),
  products: WithMetaArray(Product),
  heroProducts: WithMetaArray(z.string()),
  productCategories: WithMetaArray(z.string()),

  // Pricing
  pricingNotes: WithMeta(z.string()),
  priceRange: WithMeta(z.string()),
  avgTicketValue: WithMeta(z.number()),
  avgOrderValue: WithMeta(z.number()),

  // Margins
  marginTiers: WithMeta(z.string()),
  avgMargin: WithMeta(z.number()),
  highMarginProducts: WithMetaArray(z.string()),

  // Promotions
  promoWindows: WithMeta(z.string()),
  currentPromotions: WithMetaArray(Promotion),
  upcomingPromotions: WithMetaArray(Promotion),
  promoCalendarNotes: WithMeta(z.string()),

  // Inventory
  inventoryConstraints: WithMeta(z.string()),
  stockLevels: WithMeta(z.string()),
  fulfillmentNotes: WithMeta(z.string()),

  // Offers
  uniqueOffers: WithMetaArray(z.string()),
  conversionOffers: WithMetaArray(z.string()),
  leadMagnets: WithMetaArray(z.string()),
});

export type ProductOfferDomain = z.infer<typeof ProductOfferDomain>;

/**
 * Create an empty ProductOffer domain
 */
export function createEmptyProductOfferDomain(): ProductOfferDomain {
  return {
    // FCB-extracted fields
    primaryProducts: { value: [], provenance: [] },
    services: { value: [], provenance: [] },
    valueProposition: { value: null, provenance: [] },
    pricingModel: { value: null, provenance: [] },
    keyDifferentiators: { value: [], provenance: [] },
    // Product lines
    productLines: { value: [], provenance: [] },
    products: { value: [], provenance: [] },
    heroProducts: { value: [], provenance: [] },
    productCategories: { value: [], provenance: [] },
    // Pricing
    pricingNotes: { value: null, provenance: [] },
    priceRange: { value: null, provenance: [] },
    avgTicketValue: { value: null, provenance: [] },
    avgOrderValue: { value: null, provenance: [] },
    // Margins
    marginTiers: { value: null, provenance: [] },
    avgMargin: { value: null, provenance: [] },
    highMarginProducts: { value: [], provenance: [] },
    // Promotions
    promoWindows: { value: null, provenance: [] },
    currentPromotions: { value: [], provenance: [] },
    upcomingPromotions: { value: [], provenance: [] },
    promoCalendarNotes: { value: null, provenance: [] },
    // Inventory
    inventoryConstraints: { value: null, provenance: [] },
    stockLevels: { value: null, provenance: [] },
    fulfillmentNotes: { value: null, provenance: [] },
    // Offers
    uniqueOffers: { value: [], provenance: [] },
    conversionOffers: { value: [], provenance: [] },
    leadMagnets: { value: [], provenance: [] },
  };
}
