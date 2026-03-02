import type { PageLoad } from './$types';

// No ssr:false — data arrives from the server layout load.
export const load: PageLoad = async ({ parent }) => {
  const { notes, allTags } = await parent();
  return { notes, allTags };
};
