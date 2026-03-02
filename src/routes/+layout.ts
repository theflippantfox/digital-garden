/**
 * Universal layout load — just passes server data through.
 * No ssr:false — SSR is now enabled; the server load handles data fetching.
 * This file stays minimal so SvelteKit doesn't override the server load behaviour.
 */
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ data }) => data;
