import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { tagToAccent, tagToEmoji } from '$lib/utils/tagColor';
import { preprocessCallouts } from '$lib/utils/callout';
import type { Note, NoteSummary, NoteStatus, NoteBacklink } from '$lib/types';

const NOTES_DIR = path.resolve('notes');
const VALID_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen', 'compost'];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function makeExcerpt(content: string, length = 220): string {
  const plain = stripHtml(marked(preprocessCallouts(content)) as string);
  return plain.length > length
    ? plain.slice(0, length).replace(/\w+$/, '') + '…'
    : plain;
}

function countWikilinks(raw: string): number {
  return (raw.match(/\[\[[^\]]+\]\]/g) ?? []).length;
}

function formatDate(raw: unknown): string | null {
  if (!raw) return null;
  try { return new Date(String(raw)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return null; }
}

function isoDate(raw: unknown): string | null {
  if (!raw) return null;
  try { return new Date(String(raw)).toISOString(); }
  catch { return null; }
}

function parseStatus(raw: unknown): NoteStatus {
  const s = String(raw ?? '').toLowerCase().trim();
  return (VALID_STATUSES.includes(s as NoteStatus) ? s : 'seedling') as NoteStatus;
}

/** Resolve [[Title]] and [[Title|Display]] wikilinks to anchor tags */
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

// ── Main loader ───────────────────────────────────────────────────────────────

let _cache: Note[] | null = null;

export function loadAllNotes(): Note[] {
  if (_cache) return _cache;

  if (!fs.existsSync(NOTES_DIR)) {
    console.warn(`[garden] Notes directory not found: ${NOTES_DIR}`);
    return [];
  }

  const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md'));

  // Pass 1: collect slugs for wikilink validation
  const allSlugs: string[] = files.map(f => {
    const raw = fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8');
    const { data } = matter(raw);
    const title = (data.title as string | undefined) ?? path.basename(f, '.md');
    // Priority: explicit slug → filename → title
    const filenameSlug = titleToSlug(path.basename(f, '.md'));
    return (data.slug as string | undefined) ?? filenameSlug || titleToSlug(title);
  });

  // Pass 2: full parse
  const notes: Note[] = files.map(filename => {
    const raw = fs.readFileSync(path.join(NOTES_DIR, filename), 'utf-8');
    const { data: fm, content } = matter(raw);

    const titleFromFile = path.basename(filename, '.md');
    const title = (fm.title as string | undefined) ?? titleFromFile;
    // Priority: explicit slug → filename → title
    const slug = (fm.slug as string | undefined) ?? titleToSlug(titleFromFile) || titleToSlug(title);

    // Tags — first tag is the primary; fall back to a 'general' tag
    const rawTags = fm.tags as string[] | string | undefined;
    const tags: string[] = Array.isArray(rawTags)
      ? rawTags.map(String)
      : rawTags ? [String(rawTags)]
        : ['general'];

    const primaryTag = tags[0].toLowerCase().trim();

    // Accent and emoji — derived from primaryTag unless explicitly overridden
    const accent = tagToAccent((fm.accent as string | undefined) ?? primaryTag);
    const emoji = (fm.emoji as string | undefined) ?? tagToEmoji(primaryTag);

    const status = parseStatus(fm.status);
    const published = fm.published === true;

    const rawHtml = marked(preprocessCallouts(content)) as string;
    const html = resolveWikilinks(rawHtml, allSlugs);
    const excerpt = (fm.description as string | undefined) ?? (fm.excerpt as string | undefined) ?? makeExcerpt(content);

    return {
      slug, title,
      date: formatDate(fm.date),
      dateRaw: isoDate(fm.date),
      lastTendedRaw: isoDate(fm['last-tended'] ?? fm.lastTended ?? null),
      primaryTag,
      tags,
      accent,
      emoji,
      excerpt,
      html,
      links: countWikilinks(content),
      backlinks: [],
      status,
      published,
    };
  });

  // Build backlink index
  const backlinkMap: Record<string, NoteBacklink[]> = {};
  for (const note of notes) {
    backlinkMap[note.slug] ??= [];
    const outgoing = [...note.html.matchAll(/data-slug="([^"]+)"/g)].map(m => m[1]);
    for (const target of outgoing) {
      backlinkMap[target] ??= [];
      if (!backlinkMap[target].find(b => b.slug === note.slug)) {
        backlinkMap[target].push({ slug: note.slug, title: note.title, emoji: note.emoji });
      }
    }
  }

  _cache = notes
    .filter(n => n.published)
    .map(n => ({ ...n, backlinks: backlinkMap[n.slug] ?? [] }))
    .sort((a, b) => (b.dateRaw ?? '').localeCompare(a.dateRaw ?? ''));

  return _cache;
}

export function loadNote(slug: string): Note | null {
  return loadAllNotes().find(n => n.slug === slug) ?? null;
}

export function toSummary({ html: _html, ...rest }: Note): NoteSummary {
  return rest;
}
