export type Accent =
  | 'violet' | 'coral' | 'cyan' | 'lime'
  | 'amber' | 'rose' | 'sky' | 'emerald' | 'indigo' | 'orange';

export type NoteStatus = 'seedling' | 'budding' | 'evergreen' | 'compost';

export interface NoteBacklink {
  slug: string;
  title: string;
  emoji: string;
}

export interface Note {
  slug: string;
  title: string;
  date: string | null;
  dateRaw: string | null;
  lastTendedRaw: string | null;
  noteType: string | null;
  subtype: string | null;
  primaryTag: string;
  tags: string[];
  accent: Accent;
  emoji: string;
  excerpt: string;
  html: string;
  links: number;
  backlinks: NoteBacklink[];
  status: NoteStatus;
  published: boolean;
}

export type NoteSummary = Omit<Note, 'html'>;

export interface ApiNotesResponse {
  notes: NoteSummary[];
  allTags: string[];
  fetchedAt: string;
}

export interface ApiNoteResponse {
  note: Note;
  fetchedAt: string;
}

export interface Env {
  NOTES_CACHE: KVNamespace;
  GITHUB_TOKEN: string;
  NOTES_REPO: string;
  ALLOWED_ORIGINS: string;
  CACHE_TTL: string;
  // Optional — set in wrangler.toml [vars]
  NOTES_SUBDIR?: string;
  NOTES_BRANCH?: string;
  NOTES_RECURSIVE?: string;
}

// Optional worker env overrides (set in wrangler.toml [vars])
// NOTES_SUBDIR    - subdirectory in repo containing notes, e.g. "notes" or ""
// NOTES_BRANCH    - git branch to read, default "HEAD"
// NOTES_RECURSIVE - set "true" to use deep recursive fetch (2 subrequests instead of 1)
//                   needed only if notes are nested more than 1 folder deep
