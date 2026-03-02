/**
 * Layout server load — runs on Cloudflare Pages Functions (SSR).
 *
 * API mode:  fetches notes from the Worker on the server side.
 *            Pages Function → Worker is an internal Cloudflare network hop (~2ms).
 *            The full HTML is rendered before it reaches the browser.
 *
 * Static mode: reads notes from the filesystem at build time (unchanged).
 */
import { loadAllNotes, toSummary } from '$lib/notes';
import { API_MODE } from '$lib/api';
import type { LayoutServerLoad } from './$types';
import type { GardenData } from '$lib/types';

export const load: LayoutServerLoad<GardenData> = async ({ fetch }) => {
  if (API_MODE) {
    const apiUrl = import.meta.env.VITE_GARDEN_API_URL as string;
    try {
      const res = await fetch(`${apiUrl}/api/notes`);
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      const data = await res.json() as GardenData;
      return { notes: data.notes, allTags: data.allTags };
    } catch (err) {
      console.error('[layout:server] Failed to fetch notes from Worker:', err);
      return { notes: [], allTags: [] };
    }
  }

  // Static / local dev mode
  const notes = loadAllNotes();
  const allTags = [...new Set(notes.flatMap(n => n.tags))].sort();
  return { notes: notes.map(toSummary), allTags };
};
