// lib/os/caseStudies/index.ts
// Case Studies module exports

export { SEED_CASE_STUDIES, getSeedCaseStudyById } from './seed';
export {
  extractCaseStudyMediaFromUrl,
  createVisualFromUrl,
  extractYouTubeId,
  extractVimeoId,
  getYouTubeThumbnailUrl,
  getVimeoThumbnailUrl,
  detectVisualType,
  isValidMediaUrl,
  type ExtractedMediaInfo,
} from './extractMedia';
