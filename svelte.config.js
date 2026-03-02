import adapterVercel from '@sveltejs/adapter-vercel';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const platform = process.env.PLATFORM;

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter:
      platform === 'cloudflare'
        ? adapterCloudflare({
          routes: {
            include: ['/*'],
            exclude: ['<all>']
          }
        })
        : adapterVercel({
        })
  }
};

export default config;

