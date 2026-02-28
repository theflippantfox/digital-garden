/**
 * API MODE layout loader — runs in the browser, fetches from Cloudflare Worker.
 * Only active when VITE_GARDEN_API_URL is set.
 */
import { fetchNotes, API_MODE } from '$lib/api';
import type { LayoutLoad } from './$types';
import type { GardenData } from '$lib/types';

export const ssr = false; // client-side only when in API mode

export const load: LayoutLoad<GardenData> = async ({ fetch }) => {
  if (!API_MODE) {
    // Static mode: server load handles it, pass through
    return { notes: [], allTags: [] };
  }

  try {
    return await fetchNotes(fetch);
  } catch (err) {
    console.error('[layout] Failed to fetch notes from API:', err);
    return { notes: [], allTags: [] };
  }
};
