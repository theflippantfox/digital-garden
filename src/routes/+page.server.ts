import { loadAllNotes, toSummary } from '$lib/notes';
import { API_MODE } from '$lib/api';
import type { PageServerLoad } from './$types';
import type { GardenData } from '$lib/types';

export const load: PageServerLoad<GardenData> = async ({ fetch }) => {
  if (API_MODE) {
    const apiUrl = import.meta.env.VITE_GARDEN_API_URL as string;
    try {
      const res = await fetch(`${apiUrl}/api/notes`);
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      const data = await res.json() as GardenData;
      return { notes: data.notes, allTags: data.allTags };
    } catch {
      return { notes: [], allTags: [] };
    }
  }

  const notes = loadAllNotes();
  const allTags = [...new Set(notes.flatMap(n => n.tags))].sort();
  return { notes: notes.map(toSummary), allTags };
};
