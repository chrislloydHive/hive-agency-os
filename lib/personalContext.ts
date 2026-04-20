/**
 * Personal Context Loader
 * ------------------------
 * Reads editable memory from `context/personal/*.md` and exposes typed
 * accessors plus prompt helpers. The goal: AI routes embed Chris's
 * identity, voice, project taxonomy, and sender whitelist by reading
 * from disk at request time instead of hardcoding strings in route.ts.
 *
 * See `context/personal/_README.md` for the file format.
 *
 * Caching: each file is cached in-process for 60 seconds so hot edits in
 * dev show up quickly and prod doesn't hit the disk on every request.
 */
import { promises as fs } from 'fs';
import path from 'path';

const CONTEXT_DIR = path.join(process.cwd(), 'context', 'personal');
const CACHE_TTL_MS = 60 * 1000;

interface CachedFile {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
  loadedAt: number;
}

const fileCache = new Map<string, CachedFile>();

async function loadFile(name: string): Promise<CachedFile> {
  const cached = fileCache.get(name);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached;

  const filePath = path.join(CONTEXT_DIR, name);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    // Missing file is non-fatal; callers fall back to safe defaults.
    const empty: CachedFile = { frontmatter: {}, body: '', raw: '', loadedAt: Date.now() };
    fileCache.set(name, empty);
    return empty;
  }

  const { frontmatter, body } = parseFrontmatter(raw);
  const entry: CachedFile = { frontmatter, body, raw, loadedAt: Date.now() };
  fileCache.set(name, entry);
  return entry;
}

/**
 * Minimal YAML frontmatter parser. Supports:
 *   key: string value
 *   key:
 *     - list item 1
 *     - list item 2
 *
 * Intentionally does not support nested maps, anchors, multi-line strings,
 * or any other YAML esoterica. Keep the context files simple.
 */
function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const [, fmText, body] = match;

  const frontmatter: Record<string, unknown> = {};
  const lines = fmText.split(/\r?\n/);
  let currentListKey: string | null = null;
  let currentList: string[] = [];

  const flushList = () => {
    if (currentListKey) {
      frontmatter[currentListKey] = currentList;
      currentListKey = null;
      currentList = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line) continue;
    // indented list item under the current key
    if (currentListKey && /^\s+-\s+/.test(line)) {
      currentList.push(line.replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, ''));
      continue;
    }
    flushList();
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '') {
      currentListKey = key;
      currentList = [];
    } else {
      frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  flushList();
  return { frontmatter, body: body.trim() };
}

// ============================================================================
// Typed accessors
// ============================================================================

export interface Identity {
  name: string;
  role: string;
  company: string;
  email: string;
  bio: string;
}

const DEFAULT_IDENTITY: Identity = {
  name: 'Chris Lloyd',
  role: 'Owner',
  company: 'Hive Ad Agency',
  email: 'chrislloyd@hive8.us',
  bio: '',
};

export async function getIdentity(): Promise<Identity> {
  const f = await loadFile('identity.md');
  return {
    name: String(f.frontmatter.name || DEFAULT_IDENTITY.name),
    role: String(f.frontmatter.role || DEFAULT_IDENTITY.role),
    company: String(f.frontmatter.company || DEFAULT_IDENTITY.company),
    email: String(f.frontmatter.email || DEFAULT_IDENTITY.email),
    bio: f.body,
  };
}

export interface Voice {
  tone: string;
  signoff: string;
  rules: string;
}

const DEFAULT_VOICE: Voice = {
  tone: 'direct, warm, concise, professional but human',
  signoff: '— Chris',
  rules: '',
};

export async function getVoice(): Promise<Voice> {
  const f = await loadFile('voice.md');
  return {
    tone: String(f.frontmatter.tone || DEFAULT_VOICE.tone),
    signoff: String(f.frontmatter.signoff || DEFAULT_VOICE.signoff),
    rules: f.body || DEFAULT_VOICE.rules,
  };
}

export interface Projects {
  categories: string[];
  notes: string;
}

const DEFAULT_PROJECT_CATEGORIES = [
  'Car Toys 2026 Media',
  'Car Toys Tint',
  'Car Toys / Billing',
  'HEY / Eric Request',
  'Hive Admin',
  'Hive Billing',
  'Legal',
  'Portage Bank',
];

export async function getProjects(): Promise<Projects> {
  const f = await loadFile('projects.md');
  const cats = Array.isArray(f.frontmatter.categories)
    ? (f.frontmatter.categories as unknown[]).map(String).filter(Boolean)
    : [];
  return {
    categories: cats.length > 0 ? cats : DEFAULT_PROJECT_CATEGORIES,
    notes: f.body,
  };
}

export interface Senders {
  domains: string[];
  notes: string;
}

const DEFAULT_SENDER_DOMAINS = ['quickbooks.com'];

export async function getSenders(): Promise<Senders> {
  const f = await loadFile('senders.md');
  const domains = Array.isArray(f.frontmatter.domains)
    ? (f.frontmatter.domains as unknown[]).map(String).map(d => d.toLowerCase().trim()).filter(Boolean)
    : [];
  return {
    domains: domains.length > 0 ? domains : DEFAULT_SENDER_DOMAINS,
    notes: f.body,
  };
}

/**
 * Returns the effective set of important sender domains for triage scoring.
 * Merges the senders.md file with the `CC_IMPORTANT_SENDERS` env var (which
 * remains a convenience override for hotfixes without touching files).
 */
export async function getEffectiveImportantDomains(): Promise<string[]> {
  const { domains } = await getSenders();
  const envSenders = (process.env.CC_IMPORTANT_SENDERS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...domains, ...envSenders]));
}

// ============================================================================
// Prompt helpers — pre-formatted strings for AI prompts
// ============================================================================

/**
 * Returns a quoted, comma-separated list of project category names,
 * ready to drop into an AI prompt as the allowed values for a `project` field.
 * Example output: "Car Toys 2026 Media", "Car Toys Tint", ...
 */
export async function getProjectCategoriesList(): Promise<string> {
  const { categories } = await getProjects();
  return categories.map(c => `"${c}"`).join(', ');
}

/**
 * Returns a compact "who the assistant is writing for" preamble suitable
 * for prepending to AI prompts. Keeps identity consistent across routes.
 */
export async function getIdentityPreamble(): Promise<string> {
  const id = await getIdentity();
  const bioLine = id.bio ? `\n\n${id.bio}` : '';
  return `You are assisting ${id.name}, ${id.role} of ${id.company} (${id.email}).${bioLine}`;
}

/**
 * Returns the voice-drafting rules block, suitable for prepending to any
 * reply-drafting AI prompt. Falls back to a sane default if voice.md is empty.
 */
export async function getVoiceRulesBlock(): Promise<string> {
  const v = await getVoice();
  const rules = v.rules || [
    '- Plain text only. No HTML, no markdown, no bullet characters.',
    '- 2–5 short paragraphs, typically under 150 words.',
    `- Sign off "${v.signoff}" on its own line.`,
  ].join('\n');
  return `Tone: ${v.tone}\nSignoff: ${v.signoff}\n\n${rules}`;
}

// ============================================================================
// Drive publishing config
// ============================================================================

export interface DrivePublishConfig {
  appsScriptUrl: string;
  defaultFolderId: string;
  /** Map of doc type → Google template doc ID */
  templates: Record<string, string>;
  /** Valid doc types */
  docTypes: string[];
}

export async function getDrivePublishConfig(): Promise<DrivePublishConfig> {
  const f = await loadFile('drive.md');
  const fm = f.frontmatter;

  const appsScriptUrl = typeof fm.apps_script_url === 'string' ? fm.apps_script_url : '';
  const defaultFolderId = typeof fm.default_folder_id === 'string' ? fm.default_folder_id : '';
  const docTypes = Array.isArray(fm.doc_types)
    ? (fm.doc_types as unknown[]).map(String)
    : ['brief', 'sow', 'report', 'strategy'];

  // Build templates map from flat template_<type> keys
  const templates: Record<string, string> = {};
  for (const t of docTypes) {
    const key = `template_${t}`;
    if (typeof fm[key] === 'string' && fm[key]) {
      templates[t] = fm[key] as string;
    }
  }

  return { appsScriptUrl, defaultFolderId, templates, docTypes };
}

// ============================================================================
// Test / debug
// ============================================================================

/** Flush the in-process cache. Exported for dev tooling / tests. */
export function __flushPersonalContextCache(): void {
  fileCache.clear();
}
