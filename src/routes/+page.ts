import { fetchNotes, API_MODE } from '$lib/api';
import type { PageLoad } from './$types';
import type { NoteSummary } from '$lib/types';

export const ssr = false;

export const load: PageLoad<{ notes: NoteSummary[] }> = async ({ fetch, parent }) => {
  if (!API_MODE) {
    // Static mode: get notes from server load via parent
    const parentData = await parent();
    return { notes: parentData.notes };
  }

  try {
    const data = await fetchNotes(fetch);
    return { notes: data.notes };
  } catch {
    return { notes: [] };
  }
};
