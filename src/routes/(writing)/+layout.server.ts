import { loadAllNotes, toSummary } from '$lib/notes';
import { API_MODE } from '$lib/api';
import type { LayoutServerLoad } from './$types';
import type { NoteSummary } from '$lib/types';

interface WritingData {
  pieces: NoteSummary[];
}

export const load: LayoutServerLoad<WritingData> = async ({ fetch }) => {
  let allNotes: NoteSummary[] = [];

  if (API_MODE) {
    const apiUrl = import.meta.env.VITE_GARDEN_API_URL as string;
    try {
      const res = await fetch(`${apiUrl}/api/notes`);
      if (!res.ok) throw new Error(`Worker returned ${res.status}`);
      const data = await res.json() as { notes: NoteSummary[] };
      allNotes = data.notes;
    } catch (err) {
      console.error('[writing:layout] Failed to fetch notes:', err);
    }
  } else {
    allNotes = loadAllNotes().map(toSummary);
  }

  const pieces = allNotes.filter(n => n.noteType === 'creative');
  return { pieces };
};
