import { loadAllNotes, toSummary } from '$lib/notes';
import { API_MODE } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { NoteSummary } from '$lib/types';

export const load: PageServerLoad<{ notes: NoteSummary[] }> = () => {
  if (API_MODE) return { notes: [] }; // API mode: page.ts handles it
  return { notes: loadAllNotes().map(toSummary) };
};
