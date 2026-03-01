import { marked } from 'marked';
import type { Note, NoteStatus, Accent, NoteBacklink } from './types';

// ── Deterministic hash ────────────────────────────────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

// ── Accent colors ─────────────────────────────────────────────────────────────

const ACCENTS: Accent[] = [
  'violet', 'coral', 'cyan', 'lime', 'amber', 'rose', 'sky', 'emerald', 'indigo', 'orange'
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

const EMOJI_POOL = ['💡', '🔧', '🎨', '📐', '🧪', '🌊', '🔬', '📡', '⚡', '🎯', '🧩', '🌀'];

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

// ── Frontmatter parser ────────────────────────────────────────────────────────
//
// Handles both Obsidian-style and standard YAML frontmatter including:
//   - Inline arrays:  tags: [engineering, tools]
//   - Block sequences (Obsidian default):
//       tags:
//         - engineering
//         - tools
//   - Quoted strings: title: "My Note: A Story"
//   - Empty values:   title:          (treated as missing, not empty string)
//   - Booleans:       published: true

interface Frontmatter {
  title?: string;
  slug?: string;
  date?: string;
  tags?: string[] | string;
  status?: string;
  published?: boolean;
  description?: string;
  excerpt?: string;
  [key: string]: unknown;
}

function parseFrontmatter(raw: string): { data: Frontmatter; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  const lines = yamlBlock.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Block sequence item (  - value) — collected by parent key below
    if (/^\s+-\s/.test(line)) { i++; continue; }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    if (!key || key.startsWith('#')) { i++; continue; }

    // Strip trailing inline comments (only when value isn't a URL with //)
    if (!value.includes('//')) {
      value = value.replace(/\s+#[^'"]*$/, '');
    }
    value = value.trim();

    // Boolean
    if (value === 'true') { data[key] = true; i++; continue; }
    if (value === 'false') { data[key] = false; i++; continue; }

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      const unquoted = value.slice(1, -1);
      if (unquoted) data[key] = unquoted;
      i++; continue;
    }

    // Inline array: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      if (items.length) data[key] = items;
      i++; continue;
    }

    // Empty value — check if next lines are a block sequence
    if (value === '') {
      const blockItems: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const seqMatch = lines[j].match(/^\s+-\s+(.+)$/);
        if (!seqMatch) break;
        const item = seqMatch[1].trim().replace(/^['"]|['"]$/g, '');
        if (item) blockItems.push(item);
        j++;
      }

      if (blockItems.length) {
        // It was a block sequence
        data[key] = blockItems;
        i = j;
      } else {
        // Genuinely empty value — skip it (don't set empty string)
        i++;
      }
      continue;
    }

    // Plain scalar value
    if (value) data[key] = value;
    i++;
  }

  return { data: data as Frontmatter, content };
}

// ── HTML entity decoder ───────────────────────────────────────────────────────
// marked() escapes characters to HTML entities (&amp; &#39; etc.).
// After stripping tags we need to decode them so excerpts read as plain text.

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

// ── Obsidian callout pre-processor ───────────────────────────────────────────
// Converts > [!TYPE] blockquotes to styled HTML divs before marked() runs.

const CALLOUT_META: Record<string, { icon: string; color: string; defaultTitle: string }> = {
  note: { icon: '📝', color: '#4d9fff', defaultTitle: 'Note' },
  info: { icon: 'ℹ️', color: '#4d9fff', defaultTitle: 'Info' },
  abstract: { icon: '📄', color: '#4d9fff', defaultTitle: 'Abstract' },
  summary: { icon: '📄', color: '#4d9fff', defaultTitle: 'Summary' },
  tldr: { icon: '⚡', color: '#4d9fff', defaultTitle: 'TL;DR' },
  tip: { icon: '💡', color: '#4dffb8', defaultTitle: 'Tip' },
  hint: { icon: '💡', color: '#4dffb8', defaultTitle: 'Hint' },
  success: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Success' },
  check: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Check' },
  done: { icon: '✅', color: '#b8ff3a', defaultTitle: 'Done' },
  question: { icon: '❓', color: '#00f0ff', defaultTitle: 'Question' },
  help: { icon: '❓', color: '#00f0ff', defaultTitle: 'Help' },
  faq: { icon: '❓', color: '#00f0ff', defaultTitle: 'FAQ' },
  important: { icon: '❗', color: '#b44dff', defaultTitle: 'Important' },
  todo: { icon: '☑️', color: '#ffb84d', defaultTitle: 'Todo' },
  warning: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Warning' },
  caution: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Caution' },
  attention: { icon: '⚠️', color: '#ffb84d', defaultTitle: 'Attention' },
  failure: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Failure' },
  fail: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Fail' },
  missing: { icon: '✗', color: '#ff4d8b', defaultTitle: 'Missing' },
  danger: { icon: '🔥', color: '#ff5c3a', defaultTitle: 'Danger' },
  error: { icon: '🔥', color: '#ff5c3a', defaultTitle: 'Error' },
  bug: { icon: '🐛', color: '#ff5c3a', defaultTitle: 'Bug' },
  example: { icon: '📋', color: '#6b4dff', defaultTitle: 'Example' },
  definition: { icon: '📖', color: '#6b4dff', defaultTitle: 'Definition' },
  cite: { icon: '❝', color: '#8888aa', defaultTitle: 'Cite' },
  quote: { icon: '❝', color: '#8888aa', defaultTitle: 'Quote' },
};
const CALLOUT_FALLBACK = { icon: '📝', color: '#4d9fff', defaultTitle: 'Note' };

function preprocessCallouts(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^>\s*\[!([A-Za-z-]+)[+-]?\]\s*(.*)$/);

    if (m) {
      const rawType = m[1].toLowerCase().trim();
      const meta = CALLOUT_META[rawType] ?? CALLOUT_FALLBACK;
      const title = m[2].trim() || meta.defaultTitle;

      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (next.startsWith('> ') || next === '>') {
          bodyLines.push(next.replace(/^>\s?/, ''));
          i++;
        } else if (next.trim() === '' && i + 1 < lines.length && lines[i + 1].startsWith('>')) {
          bodyLines.push('');
          i++;
        } else {
          break;
        }
      }

      const bodyHtml = bodyLines.length
        ? (marked(bodyLines.join('\n').trim()) as string)
        : '';

      result.push(
        `<div class="callout callout-${rawType}" style="--callout-color:${meta.color}">` +
        `<div class="callout-title"><span class="callout-icon" aria-hidden="true">${meta.icon}</span><span>${title}</span></div>` +
        (bodyHtml ? `<div class="callout-body">${bodyHtml}</div>` : '') +
        `</div>`
      );
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

// ── Excerpt ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(content: string, length = 220): string {
  const html = marked(preprocessCallouts(content)) as string;
  const plain = decodeEntities(stripHtml(html));
  return plain.length > length
    ? plain.slice(0, length).replace(/\w+$/, '') + '…'
    : plain;
}

function countWikilinks(raw: string): number {
  return (raw.match(/\[\[[^\]]+\]\]/g) ?? []).length;
}

// ── Wikilink resolver ─────────────────────────────────────────────────────────

function resolveWikilinks(html: string, allSlugs: string[]): string {
  return html.replace(/\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const [titlePart, displayPart] = inner.split('|');
    const slug = titleToSlug(titlePart.trim());
    const display = (displayPart ?? titlePart).trim();
    if (allSlugs.includes(slug)) {
      return `<a href="/notes/${slug}" class="wikilink" data-slug="${slug}">${display}</a>`;
    }
    return `<span class="wikilink wikilink--broken" title="Note not found: ${titlePart.trim()}">${display}</span>`;
  });
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

const VALID_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen', 'compost'];
function parseStatus(raw: string | undefined): NoteStatus {
  const s = (raw ?? '').toLowerCase().trim();
  return (VALID_STATUSES.includes(s as NoteStatus) ? s : 'seedling') as NoteStatus;
}

// ── Main parse function ───────────────────────────────────────────────────────

export function parseNoteFile(filename: string, rawContent: string, allSlugs: string[]): Note {
  const { data: fm, content } = parseFrontmatter(rawContent);

  // BUG FIX: use filename as fallback for title so it's never empty
  const titleFromFile = filename.replace(/\.md$/i, '');
  const title = (fm.title && String(fm.title).trim()) || titleFromFile;

  // BUG FIX: if slug resolves to empty string (title had only special chars),
  // fall back to the filename-derived slug so we never get an empty route
  const slugFromTitle = (fm.slug && String(fm.slug).trim()) || titleToSlug(title);
  const slugFromFile = titleToSlug(titleFromFile);
  const slug = slugFromTitle || slugFromFile || filename.replace(/\.md$/i, '');

  // Tags — handle both inline [a, b] and Obsidian block sequence format
  const rawTags = fm.tags;
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.map(String).filter(Boolean)
    : (rawTags && String(rawTags).trim())
      ? [String(rawTags).trim()]
      : ['general'];

  const primaryTag = tags[0].toLowerCase().trim();
  const accent = tagToAccent(primaryTag);
  const emoji = tagToEmoji(primaryTag);
  const status = parseStatus(fm.status);

  const published = fm.published === true;

  const rawHtml = marked(preprocessCallouts(content)) as string;
  const html = resolveWikilinks(rawHtml, allSlugs);

  // BUG FIX: decode HTML entities so excerpts show plain text, not &amp; &#39; etc.
  const descRaw = fm.description ?? fm.excerpt;
  const excerpt = (descRaw && String(descRaw).trim())
    ? decodeEntities(String(descRaw))
    : makeExcerpt(content);

  return {
    slug, title,
    date: formatDate(fm.date),
    dateRaw: isoDate(fm.date),
    primaryTag, tags, accent, emoji, excerpt, html,
    links: countWikilinks(content),
    backlinks: [],
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
