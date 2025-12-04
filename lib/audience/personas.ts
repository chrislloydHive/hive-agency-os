// lib/audience/personas.ts
// Persona types and Zod schemas for Audience Lab
//
// Personas are human-centered representations of audience segments,
// optimized for creative briefing and media planning.

import { z } from 'zod';

// ============================================================================
// Persona Schema
// ============================================================================

export const Persona = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().optional(),
  linkedSegmentIds: z.array(z.string()).default([]),
  oneSentenceSummary: z.string().optional(),

  // Story + human context
  backstory: z.string().optional(),
  dayInTheLife: z.string().optional(),

  // Jobs, triggers, objections
  jobsToBeDone: z.array(z.string()).default([]),
  triggers: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  decisionFactors: z.array(z.string()).default([]),

  // Behaviors & media
  demandState: z.string().optional(),
  mediaHabits: z.string().optional(),
  channelsToUse: z.array(z.string()).default([]),
  channelsToAvoid: z.array(z.string()).default([]),
  contentFormatsPreferred: z.array(z.string()).default([]),

  // Creative guidance
  keyMessages: z.array(z.string()).default([]),
  proofPoints: z.array(z.string()).default([]),
  exampleHooks: z.array(z.string()).default([]),
  toneGuidance: z.string().optional(),

  // Metadata
  priority: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
});

export type Persona = z.infer<typeof Persona>;

// ============================================================================
// PersonaSet Schema
// ============================================================================

export const PersonaSet = z.object({
  id: z.string(),
  companyId: z.string(),
  audienceModelId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  personas: z.array(Persona),
  version: z.number().default(1),
  source: z.enum(['ai_seeded', 'manual', 'mixed']).default('manual'),
  notes: z.string().optional(),
});

export type PersonaSet = z.infer<typeof PersonaSet>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty persona with a unique ID
 */
export function createEmptyPersona(name: string = 'New Persona'): Persona {
  const now = new Date().toISOString();
  return {
    id: `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    tagline: '',
    linkedSegmentIds: [],
    oneSentenceSummary: '',
    backstory: '',
    dayInTheLife: '',
    jobsToBeDone: [],
    triggers: [],
    objections: [],
    decisionFactors: [],
    demandState: '',
    mediaHabits: '',
    channelsToUse: [],
    channelsToAvoid: [],
    contentFormatsPreferred: [],
    keyMessages: [],
    proofPoints: [],
    exampleHooks: [],
    toneGuidance: '',
    priority: undefined,
    updatedAt: now,
    createdAt: now,
  };
}

/**
 * Create an empty persona set for a company
 */
export function createEmptyPersonaSet(
  companyId: string,
  audienceModelId: string
): PersonaSet {
  const now = new Date().toISOString();
  return {
    id: `pset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyId,
    audienceModelId,
    createdAt: now,
    updatedAt: now,
    personas: [],
    version: 1,
    source: 'manual',
    notes: '',
  };
}

/**
 * Validate a persona
 */
export function validatePersona(persona: unknown): {
  valid: boolean;
  errors: string[];
  persona: Persona | null;
} {
  const result = Persona.safeParse(persona);
  if (result.success) {
    return { valid: true, errors: [], persona: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    persona: null,
  };
}

/**
 * Validate a persona set
 */
export function validatePersonaSet(set: unknown): {
  valid: boolean;
  errors: string[];
  personaSet: PersonaSet | null;
} {
  const result = PersonaSet.safeParse(set);
  if (result.success) {
    return { valid: true, errors: [], personaSet: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    personaSet: null,
  };
}

/**
 * Get a summary of a persona set for display
 */
export function getPersonaSetSummary(set: PersonaSet): {
  personaCount: number;
  primaryPersonas: string[];
  linkedSegmentCount: number;
  lastUpdated: string;
} {
  const primaryPersonas = set.personas
    .filter(p => p.priority === 'primary')
    .map(p => p.name);

  const linkedSegmentIds = new Set<string>();
  set.personas.forEach(p => {
    p.linkedSegmentIds.forEach(id => linkedSegmentIds.add(id));
  });

  return {
    personaCount: set.personas.length,
    primaryPersonas,
    linkedSegmentCount: linkedSegmentIds.size,
    lastUpdated: set.updatedAt,
  };
}

/**
 * Get persona by ID from a set
 */
export function getPersonaById(set: PersonaSet, personaId: string): Persona | null {
  return set.personas.find(p => p.id === personaId) || null;
}

/**
 * Update a persona in a set
 */
export function updatePersonaInSet(
  set: PersonaSet,
  personaId: string,
  updates: Partial<Persona>
): PersonaSet {
  const now = new Date().toISOString();
  return {
    ...set,
    updatedAt: now,
    source: set.source === 'ai_seeded' ? 'mixed' : set.source,
    personas: set.personas.map(p =>
      p.id === personaId
        ? { ...p, ...updates, updatedAt: now }
        : p
    ),
  };
}

/**
 * Add a persona to a set
 */
export function addPersonaToSet(set: PersonaSet, persona: Persona): PersonaSet {
  const now = new Date().toISOString();
  return {
    ...set,
    updatedAt: now,
    source: 'mixed',
    personas: [...set.personas, persona],
  };
}

/**
 * Remove a persona from a set
 */
export function removePersonaFromSet(set: PersonaSet, personaId: string): PersonaSet {
  const now = new Date().toISOString();
  return {
    ...set,
    updatedAt: now,
    personas: set.personas.filter(p => p.id !== personaId),
  };
}
