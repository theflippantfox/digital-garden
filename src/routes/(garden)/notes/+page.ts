import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
  const { notes, allTags } = await parent();
  const view = (url.searchParams.get('view') ?? 'grid') as 'grid' | 'index';
  const page = Number(url.searchParams.get('page') ?? '1');
  return { notes, allTags, view, page };
};
