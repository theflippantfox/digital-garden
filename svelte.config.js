import adapterVercel from '@sveltejs/adapter-vercel';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';


const platform = process.env.PLATFORM;
let adapter

if (platform === 'cloudflare') {
  adapter = adapterCloudflare();
} else {
  adapter = adapterVercel();
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Routes that can't be server-rendered (D3 canvas, pure interactivity)
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    })
  }
};

export default config;
