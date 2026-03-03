import type { PageLoad } from './$types';
import type { NoteSummary } from '$lib/types';

export const ssr = false;

export const load: PageLoad<{ notes: NoteSummary[] }> = async ({ parent }) => {
  const { notes } = await parent();
  return { notes };
};
