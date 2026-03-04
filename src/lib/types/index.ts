export type Accent =
  | 'violet'
  | 'coral'
  | 'cyan'
  | 'lime'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'emerald'
  | 'indigo'
  | 'orange';

export type NoteStatus = 'seedling' | 'budding' | 'evergreen' | 'compost';

export const STATUS_META: Record<NoteStatus, { label: string; icon: string; color: string }> = {
  seedling: { label: 'Seedling', icon: '🌱', color: 'text-emerald-400' },
  budding: { label: 'Budding', icon: '🌿', color: 'text-green-400' },
  evergreen: { label: 'Evergreen', icon: '🌲', color: 'text-green-300' },
  compost: { label: 'Compost', icon: '🍂', color: 'text-amber-600' },
};

export const ALL_STATUSES: NoteStatus[] = ['seedling', 'budding', 'evergreen', 'compost'];

export interface NoteBacklink {
  slug: string;
  title: string;
  emoji: string;
}

/** Full note with rendered HTML — used on detail pages */
export interface Note {
  slug: string;
  title: string;
  date: string | null;
  dateRaw: string | null;
  lastTendedRaw: string | null;
  /** Primary tag (first in the tags array) */
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

/** Lean note — no HTML body, used on garden index */
export type NoteSummary = Omit<Note, 'html'>;

export interface GardenData {
  notes: NoteSummary[];
  allTags: string[];
}
