import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { notes, allTags } = await parent();
  return { notes, allTags };
};
