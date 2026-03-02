import { fetchNote, API_MODE } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { Note } from '$lib/types';

export const prerendered = true;

export const load: PageLoad<{ note: Note }> = async ({ params, fetch, parent }) => {
  if (!API_MODE) {
    // Static mode: note comes from server load
    const parentData = await parent();
    const note = (parentData as { note?: Note }).note;
    if (!note) throw error(404, 'Note not found');
    return { note };
  }

  try {
    const note = await fetchNote(params.slug, fetch);
    return { note };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Not found';
    throw error(404, msg);
  }
};
