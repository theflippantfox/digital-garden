import { loadNote } from '$lib/notes';
import { API_MODE } from '$lib/api';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Note } from '$lib/types';

export const load: PageServerLoad<{ note: Note }> = async ({ fetch }) => {
  if (API_MODE) {
    const apiUrl = import.meta.env.VITE_GARDEN_API_URL as string;
    const res = await fetch(`${apiUrl}/api/notes/home`);
    // If home note doesn't exist yet, fall back to the notes dashboard
    if (res.status === 404) throw redirect(307, '/notes');
    if (!res.ok) throw error(500, `Worker returned ${res.status}`);
    const data = await res.json() as { note: Note };
    return { note: data.note };
  }

  const note = loadNote('home');
  if (!note) throw redirect(307, '/notes');
  return { note };
};
