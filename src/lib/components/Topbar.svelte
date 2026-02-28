<script lang="ts">
  import { base } from '$app/paths';
  import { createEventDispatcher } from 'svelte';

  export let sidebarOpen: boolean = false;

  const dispatch = createEventDispatcher<{ toggleSidebar: void }>();
</script>

<header class="sticky top-0 z-50 flex items-center gap-3 h-[58px] px-4 md:px-6
  border-b border-white/[0.07] bg-g-bg/85 backdrop-blur-xl">

  <!-- Hamburger (mobile only) -->
  <button
    class="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 p-1 shrink-0
      border border-white/[0.07] bg-g-surface rounded-[10px_8px_10px_8px/8px_10px_8px_10px]
      hover:border-[rgba(180,77,255,0.3)] transition-colors"
    aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={sidebarOpen}
    on:click={() => dispatch('toggleSidebar')}
  >
    <span class="block h-[1.5px] w-full bg-g-mid rounded transition-all duration-200
      origin-center {sidebarOpen ? 'translate-y-[6.5px] rotate-45' : ''}"></span>
    <span class="block h-[1.5px] w-full bg-g-mid rounded transition-all duration-200
      {sidebarOpen ? 'opacity-0' : ''}"></span>
    <span class="block h-[1.5px] w-full bg-g-mid rounded transition-all duration-200
      origin-center {sidebarOpen ? '-translate-y-[6.5px] -rotate-45' : ''}"></span>
  </button>

  <!-- Logo -->
  <a href="{base}/" class="flex items-center gap-2.5 shrink-0">
    <div
      class="w-6 h-6 bg-gradient-to-br from-[#b44dff] to-[#ff5c3a]
        shadow-[0_0_16px_rgba(180,77,255,0.5)]"
      style="border-radius: 52% 48% 55% 45% / 48% 54% 46% 52%;
             animation: breathe1 9s ease-in-out infinite alternate"
      aria-hidden="true"
    ></div>
    <span class="font-display font-black text-[19px] tracking-tight">garden</span>
  </a>

  <!-- Right side slot -->
  <div class="ml-auto">
    <slot />
  </div>
</header>
