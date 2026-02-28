import { marked } from 'marked';
import type { Note, NoteStatus, Accent, NoteBacklink } from './types';

// ── Deterministic hash (same as SvelteKit side) ───────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ── Accent colors ─────────────────────────────────────────────────────────────

const ACCENTS: Accent[] = [
  'violet','coral','cyan','lime','amber','rose','sky','emerald','indigo','orange'
];

const KNOWN_ACCENTS: Record<string, Accent> = {
  engineering: 'violet', code: 'violet', dev: 'violet', tech: 'indigo',
  systems: 'indigo', backend: 'sky', frontend: 'sky', data: 'cyan',
  philosophy: 'coral', reflection: 'coral', essay: 'rose', ideas: 'rose',
  design: 'cyan', ux: 'sky', art: 'orange', visual: 'orange', typography: 'amber',
  life: 'emerald', health: 'emerald', productivity: 'lime', habits: 'lime',
  writing: 'amber', reading: 'amber', books: 'amber', learning: 'lime',
  science: 'cyan', math: 'indigo', research: 'indigo', tools: 'violet',
  aesthetics: 'rose', creativity: 'orange', nature: 'emerald',
};

function tagToAccent(tag: string): Accent {
  const key = tag.toLowerCase().trim();
  return KNOWN_ACCENTS[key] ?? ACCENTS[djb2(key) % ACCENTS.length];
}

// ── Emojis ────────────────────────────────────────────────────────────────────

const EMOJI_POOL = ['💡','🔧','🎨','📐','🧪','🌊','🔬','📡','⚡','🎯','🧩','🌀'];

const KNOWN_EMOJIS: Record<string, string> = {
  engineering: '⚙️', code: '💻', dev: '💻', tech: '🖥️', systems: '🧩',
  philosophy: '🔮', reflection: '🪞', essay: '📝', ideas: '💡',
  design: '✦', ux: '🖌️', art: '🎨', visual: '👁️', typography: '🔤',
  writing: '✍️', reading: '📖', books: '📚', learning: '🧠',
  science: '🔬', math: '∑', research: '🔭', data: '📊',
  life: '🌸', health: '🫀', productivity: '⚡', habits: '🔄',
  aesthetics: '✨', creativity: '🌈', nature: '🌿', tools: '🔧',
};

function tagToEmoji(tag: string): string {
  const key = tag.toLowerCase().trim();
  return KNOWN_EMOJIS[key] ?? EMOJI_POOL[djb2(key) % EMOJI_POOL.length];
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Frontmatter parser (no gray-matter — no Node.js deps) ────────────────────

interface Frontmatter {
  title?:       string;
  slug?:        string;
  date?:        string;
  tags?:        string[] | string;
  status?:      string;
  published?:   boolean;
  description?: string;
  excerpt?:     string;
  [key: string]: unknown;
}

function parseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content   = match[2];
  const data: Frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key   = line.slice(0, colonIdx).trim();
    let   value = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Strip inline comments
    value = value.replace(/\s+#.*$/, '');

    // Boolean
    if (value === 'true')  { (data as Record<string, unknown>)[key] = true;  continue; }
    if (value === 'false') { (data as Record<string, unknown>)[key] = false; continue; }

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      (data as Record<string, unknown>)[key] = value.slice(1, -1);
      continue;
    }

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      (data as Record<string, unknown>)[key] = items;
      continue;
    }

    // Plain value
    (data as Record<string, unknown>)[key] = value;
  }

  return { data, content };
}

// ── Wikilink resolver ─────────────────────────────────────────────────────────

function resolveWikilinks(html: string, allSlugs: string[]): string {
  return html.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const [titlePart, displayPart] = inner.split('|');
    const slug    = titleToSlug(titlePart.trim());
    const display = (displayPart ?? titlePart).trim();
    if (allSlugs.includes(slug)) {
      return `<a href="/notes/${slug}" class="wikilink" data-slug="${slug}">${display}</a>`;
    }
    return `<span class="wikilink wikilink--broken" title="Note not found: ${titlePart.trim()}">${display}</span>`;
  });
}

// ── Excerpt ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(content: string, length = 220): string {
  const plain = stripHtml(marked(content) as string);
  return plain.length > length
    ? plain.slice(0, length).replace(/\w+$/, '') + '…'
    : plain;
}

function countWikilinks(raw: string): number {
  return (raw.match(/\[\[[^\]]+\]\]/g) ?? []).length;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatDate(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new Date(raw).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch { return null; }
}

function isoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  try { return new Date(raw).toISOString(); } catch { return null; }
}

const VALID_STATUSES: NoteStatus[] = ['seedling','budding','evergreen','compost'];
function parseStatus(raw: string | undefined): NoteStatus {
  const s = (raw ?? '').toLowerCase().trim();
  return (VALID_STATUSES.includes(s as NoteStatus) ? s : 'seedling') as NoteStatus;
}

// ── Main parse function ───────────────────────────────────────────────────────

export function parseNoteFile(filename: string, rawContent: string, allSlugs: string[]): Note {
  const { data: fm, content } = parseFrontmatter(rawContent);

  const titleFromFile = filename.replace(/\.md$/i, '');
  const title     = fm.title    ?? titleFromFile;
  const slug      = fm.slug     ?? titleToSlug(title);

  const rawTags   = fm.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.map(String)
    : rawTags ? [String(rawTags)] : ['general'];

  const primaryTag = tags[0].toLowerCase().trim();
  const accent     = tagToAccent(primaryTag);
  const emoji      = tagToEmoji(primaryTag);
  const status     = parseStatus(fm.status);
  const published  = fm.published !== false;

  const rawHtml   = marked(content) as string;
  const html      = resolveWikilinks(rawHtml, allSlugs);
  const excerpt   = fm.description ?? fm.excerpt ?? makeExcerpt(content);

  return {
    slug, title,
    date:       formatDate(fm.date),
    dateRaw:    isoDate(fm.date),
    primaryTag, tags, accent, emoji, excerpt, html,
    links:      countWikilinks(content),
    backlinks:  [], // populated after all notes are parsed
    status, published,
  };
}

// ── Build backlinks ───────────────────────────────────────────────────────────

export function attachBacklinks(notes: Note[]): Note[] {
  const map: Record<string, NoteBacklink[]> = {};
  for (const note of notes) map[note.slug] ??= [];

  for (const note of notes) {
    const outgoing = [...note.html.matchAll(/data-slug="([^"]+)"/g)].map(m => m[1]);
    for (const target of outgoing) {
      map[target] ??= [];
      if (!map[target].find(b => b.slug === note.slug)) {
        map[target].push({ slug: note.slug, title: note.title, emoji: note.emoji });
      }
    }
  }

  return notes.map(n => ({ ...n, backlinks: map[n.slug] ?? [] }));
}
