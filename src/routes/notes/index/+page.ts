import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
  const { notes } = await parent();
  const page = Number(url.searchParams.get('page') ?? '1');
  return { notes, page };
};
