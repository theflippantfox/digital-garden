import { loadNote, loadAllNotes } from '$lib/notes';
import { API_MODE } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad, EntryGenerator } from './$types';
import type { Note } from '$lib/types';

export const pre = true;

export const entries: EntryGenerator = () => {
  if (API_MODE) return []; // dynamic mode — no prerendered pages
  return loadAllNotes().map(n => ({ slug: n.slug }));
};

export const load: PageServerLoad<{ note: Note | null }> = ({ params }) => {
  if (API_MODE) return { note: null }; // +page.ts handles it
  const note = loadNote(params.slug);
  if (!note) throw error(404, `Note "${params.slug}" not found`);
  return { note };
};
