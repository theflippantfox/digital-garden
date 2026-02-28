/**
 * Unified note loader.
 *
 * In STATIC MODE (default): notes are compiled at build time from the filesystem.
 * In API MODE (set VITE_GARDEN_API_URL): notes are fetched from the Cloudflare Worker.
 *
 * Both modes expose the same shape so all components are identical.
 */

import type { NoteSummary, Note, GardenData } from '$lib/types';

// Set in .env:
//   VITE_GARDEN_API_URL=https://digital-garden-api.your-name.workers.dev
const API_URL = import.meta.env.VITE_GARDEN_API_URL as string | undefined;

export const API_MODE = Boolean(API_URL);

// ── Notes list ────────────────────────────────────────────────────────────────

export async function fetchNotes(fetchFn: typeof fetch = fetch): Promise<GardenData> {
  if (!API_URL) throw new Error('fetchNotes() called but VITE_GARDEN_API_URL is not set');

  const res = await fetchFn(`${API_URL}/api/notes`);
  if (!res.ok) throw new Error(`Garden API error: ${res.status}`);

  const data = await res.json() as { notes: NoteSummary[]; allTags: string[] };
  return { notes: data.notes, allTags: data.allTags };
}

// ── Single note ───────────────────────────────────────────────────────────────

export async function fetchNote(slug: string, fetchFn: typeof fetch = fetch): Promise<Note> {
  if (!API_URL) throw new Error('fetchNote() called but VITE_GARDEN_API_URL is not set');

  const res = await fetchFn(`${API_URL}/api/notes/${encodeURIComponent(slug)}`);
  if (res.status === 404) throw new Error('Note not found');
  if (!res.ok) throw new Error(`Garden API error: ${res.status}`);

  const data = await res.json() as { note: Note };
  return data.note;
}
