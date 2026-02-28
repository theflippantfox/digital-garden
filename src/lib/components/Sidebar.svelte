<script lang="ts">
  import { base } from "$app/paths";
  import { page } from "$app/stores";
  import { createEventDispatcher } from "svelte";
  import type { NoteSummary } from "$lib/types";

  export let allTags: string[] = [];
  export let totalNotes: number = 0;
  export let recentNotes: NoteSummary[] = [];
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  const ACCENT_COLORS: Record<string, string> = {
    violet: "#b44dff",
    coral: "#ff5c3a",
    cyan: "#00f0ff",
    lime: "#b8ff3a",
  };
</script>

<!-- Mobile backdrop -->
{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/60 md:hidden animate-[fadeIn_0.2s_ease]"
    role="button"
    tabindex="-1"
    aria-label="Close menu"
    on:click={() => dispatch("close")}
    on:keydown={(e) => e.key === "Escape" && dispatch("close")}
  ></div>
{/if}

<aside
  class="fixed md:sticky top-0 z-50 md:z-auto
    w-[260px] md:w-[220px] lg:w-[240px]
    h-screen md:h-[calc(100vh-62px)]
    bg-g-bg/95 md:bg-g-bg/30 backdrop-blur-xl md:backdrop-blur-none
    border-r border-white/[0.07]
    flex flex-col overflow-y-auto
    transition-transform duration-300 ease-out md:translate-x-0
    {open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}"
  aria-label="Navigation"
>
  <!-- Close button (mobile only) -->
  <div class="flex items-center justify-between px-4 pt-5 pb-2 md:hidden">
    <span class="font-display font-black text-lg tracking-tight">garden</span>
    <button
      class="text-g-low hover:text-g-mid transition-colors p-1"
      on:click={() => dispatch("close")}
      aria-label="Close menu">✕</button
    >
  </div>

  <nav class="flex flex-col gap-1 px-3 pt-4 pb-8 flex-1">
    <p class="sidebar-label">Garden</p>

    <a
      href="{base}/"
      class="nav-item"
      class:nav-active={$page.url.pathname === (base || "/") ||
        $page.url.pathname === base + "/"}
      on:click={() => dispatch("close")}
    >
      <span>🌿</span>
      <span>All Notes</span>
      <span
        class="ml-auto text-[10px] bg-g-surface2 px-2 py-0.5 rounded-full text-g-low"
        >{totalNotes}</span
      >
    </a>

    {#if allTags.length}
      <p class="sidebar-label mt-4">Tags</p>
      {#each allTags as tag}
        <a
          href="{base}/?tag={encodeURIComponent(tag)}"
          class="nav-item"
          on:click={() => dispatch("close")}
        >
          <span class="text-xs opacity-60">⊹</span>
          <span class="capitalize">{tag}</span>
        </a>
      {/each}
    {/if}

    {#if recentNotes.length}
      <p class="sidebar-label mt-4">Recent</p>
      {#each recentNotes as note}
        <a
          href="{base}/notes/{note.slug}"
          class="nav-item"
          class:nav-active={$page.params.slug === note.slug}
          on:click={() => dispatch("close")}
        >
          <span
            class="w-2 h-2 rounded-full shrink-0"
            style:background={ACCENT_COLORS[note.accent] ?? "#b44dff"}
            style="border-radius: 52% 48% 50% 50% / 50% 52% 48% 50%"
            aria-hidden="true"
          ></span>
          <span class="truncate text-[12.5px]">{note.title}</span>
        </a>
      {/each}
    {/if}
  </nav>
</aside>

<style>
  .sidebar-label {
    @apply text-[9px] tracking-[0.22em] uppercase text-g-low px-3 mb-1 mt-1;
  }
  .nav-item {
    @apply flex items-center gap-2.5 px-3 py-2 rounded-[12px_10px_12px_10px/10px_12px_10px_12px]
      text-[13px] text-g-mid transition-all duration-150 border border-transparent
      no-underline hover:bg-g-surface2 hover:text-g-text hover:border-white/[0.07];
  }
  .nav-active {
    @apply bg-[rgba(180,77,255,0.13)] text-[#b44dff] border-[rgba(180,77,255,0.2)];
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
