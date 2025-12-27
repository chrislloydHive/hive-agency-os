// lib/os/plans/convert/index.ts
// Barrel exports for plan → work conversion utilities

// Main conversion
export {
  convertPlanToWorkItems,
  extractWorkKeys,
  getConversionBreakdown,
  toWorkItemInput,
  toWorkItemInputs,
  validatePlanForConversion,
  getPlanType,
  type ConvertedWorkItem,
  type PlanConversionResult,
  type ConversionOptions,
} from './planToWorkItems';

// Work key generation
export {
  normalizeForKey,
  generateWorkKey,
  hashWorkKey,
  generateCampaignWorkKey,
  generateChannelWorkKey,
  generateMeasurementWorkKey,
  generateCreativeWorkKey,
  generateCalendarWorkKey,
  generateSEOWorkKey,
  generateDistributionWorkKey,
} from './workKeyGenerator';

// Media plan mapping
export {
  convertMediaPlanToWorkItems,
  mapChannelMixToWorkItems,
  mapCampaignsToWorkItems,
  mapCampaignsToCreativeTasks,
  mapMeasurementToWorkItems,
  mapCadenceToWorkItems,
  type MediaPlanConversionResult,
} from './mediaPlanMapper';

// Content plan mapping
export {
  convertContentPlanToWorkItems,
  mapCalendarToWorkItems,
  mapSEOToWorkItems,
  mapDistributionToWorkItems,
  mapPillarsToWorkItems,
  mapProductionToWorkItems,
  type ContentPlanConversionResult,
} from './contentPlanMapper';
