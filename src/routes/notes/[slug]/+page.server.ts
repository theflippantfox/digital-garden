import { loadNote } from '$lib/notes';
import { API_MODE } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Note } from '$lib/types';

export const load: PageServerLoad<{ note: Note }> = async ({ params, fetch }) => {
  if (API_MODE) {
    const apiUrl = import.meta.env.VITE_GARDEN_API_URL as string;
    const res = await fetch(`${apiUrl}/api/notes/${encodeURIComponent(params.slug)}`);
    if (res.status === 404) throw error(404, 'Note not found');
    if (!res.ok) throw error(500, `Worker returned ${res.status}`);
    const data = await res.json() as { note: Note };
    return { note: data.note };
  }

  const note = loadNote(params.slug);
  if (!note) throw error(404, `Note "${params.slug}" not found`);
  return { note };
};
