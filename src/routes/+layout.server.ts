/**
 * STATIC MODE only — runs at build time.
 * In API mode this file is bypassed; +layout.ts handles it client-side.
 */
import { loadAllNotes, toSummary } from '$lib/notes';
import { API_MODE } from '$lib/api';
import type { LayoutServerLoad } from './$types';
import type { GardenData } from '$lib/types';

export const prerender = true;

export const load: LayoutServerLoad<GardenData> = () => {
  if (API_MODE) {
    // API mode: return empty shell — +layout.ts will hydrate client-side
    return { notes: [], allTags: [] };
  }

  const notes  = loadAllNotes();
  const allTags = [...new Set(notes.flatMap(n => n.tags))].sort();
  return { notes: notes.map(toSummary), allTags };
};
