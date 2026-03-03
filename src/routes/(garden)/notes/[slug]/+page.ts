import type { PageLoad } from './$types';

// No ssr:false — note arrives server-rendered from +page.server.ts.
export const load: PageLoad = ({ data }) => data;
