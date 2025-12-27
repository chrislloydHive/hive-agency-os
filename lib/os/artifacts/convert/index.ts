// lib/os/artifacts/convert/index.ts
// Artifact → Work conversion module exports

export {
  normalizeForKey,
  generateArtifactWorkKey,
  hashWorkKey,
  generateSectionWorkKey,
  generateFreeformWorkKey,
  generateArtifactVersionHash,
} from './workKeyGenerator';

export {
  convertArtifactToWorkItems,
  validateArtifactForConversion,
  extractWorkKeys,
  type ProposedWorkItem,
  type ArtifactConversionResult,
  type ArtifactConversionInput,
} from './artifactToWorkItems';
