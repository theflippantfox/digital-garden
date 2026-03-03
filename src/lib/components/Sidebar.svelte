<script lang="ts">
  import { page } from "$app/stores";
  import { createEventDispatcher } from "svelte";
  import { ACCENT_STYLES, tagToAccent, tagToEmoji } from "$lib/utils/tagColor";
  import type { NoteSummary } from "$lib/types";

  export let notes: NoteSummary[] = [];
  export let totalNotes: number = 0;
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  // Which tag sections are expanded
  let expandedTags: Set<string> = new Set();

  function toggleTag(tag: string) {
    const next = new Set(expandedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    expandedTags = next;
  }

  // Group notes by primaryTag, sorted by tag name
  $: tagGroups = (() => {
    const map = new Map<string, NoteSummary[]>();
    for (const note of notes) {
      const t = note.primaryTag || "general";
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(note);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  // Auto-expand the tag of the current note so you can see where you are
  $: {
    const slug = $page.params.slug;
    if (slug) {
      const note = notes.find((n) => n.slug === slug);
      if (note?.primaryTag)
        expandedTags = new Set([...expandedTags, note.primaryTag]);
    }
  }
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
  class="fixed md:static top-0 z-50 md:z-auto
    w-[260px] md:w-[220px] lg:w-[240px]
    h-screen md:h-full
    bg-g-bg/95 md:bg-g-bg/30 backdrop-blur-xl md:backdrop-blur-none
    border-r border-white/[0.07]
    flex flex-col overflow-y-auto shrink-0
    transition-transform duration-300 ease-out md:translate-x-0
    {open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}"
  aria-label="Navigation"
>
  <!-- Mobile header -->
  <div class="flex items-center justify-between px-4 pt-5 pb-2 md:hidden">
    <span class="font-display font-black text-lg tracking-tight">garden</span>
    <button
      class="text-g-low hover:text-g-mid p-1 transition-colors"
      on:click={() => dispatch("close")}
      aria-label="Close menu">✕</button
    >
  </div>

  <nav class="flex flex-col px-3 pt-4 pb-10 gap-0.5">
    <!-- Navigation -->
    <p class="sidebar-label">Garden</p>
    <a
      href="/home"
      class="nav-item"
      class:nav-active={$page.url.pathname === "/home" ||
        $page.url.pathname === "/notes/home"}
      on:click={() => dispatch("close")}
    >
      <span>🏡</span>
      <span>Home</span>
    </a>
    <a
      href="/notes"
      class="nav-item"
      class:nav-active={$page.url.pathname === "/notes" ||
        $page.url.pathname === "/notes/"}
      on:click={() => dispatch("close")}
    >
      <span>🌿</span>
      <span>All Notes</span>
      <span
        class="ml-auto text-[10px] bg-g-surface2 px-2 py-0.5 rounded-full text-g-low"
      >
        {totalNotes}
      </span>
    </a>
    <a
      href="/notes/index"
      class="nav-item"
      class:nav-active={$page.url.pathname.startsWith("/notes/index")}
      on:click={() => dispatch("close")}
    >
      <span>🔤</span>
      <span>A → Z Index</span>
    </a>

    <!-- Tags with expandable note lists -->
    {#if tagGroups.length}
      <p class="sidebar-label mt-4">Tags</p>

      {#each tagGroups as [tag, tagNotes]}
        {@const ac = ACCENT_STYLES[tagToAccent(tag)]}
        {@const emoji = tagToEmoji(tag)}
        {@const expanded = expandedTags.has(tag)}

        <!-- Tag row (toggle) -->
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-left
            rounded-[12px_10px_12px_10px/10px_12px_10px_12px]
            text-[13px] text-g-mid border border-transparent
            transition-all duration-150
            hover:bg-g-surface2 hover:text-g-text hover:border-white/[0.07]
            {expanded ? 'bg-g-surface2 text-g-text border-white/[0.04]' : ''}"
          on:click={() => toggleTag(tag)}
          aria-expanded={expanded}
        >
          <span class="text-sm">{emoji}</span>
          <span class="capitalize flex-1 truncate">{tag}</span>
          <span
            class="text-[10px] bg-g-surface px-1.5 py-0.5 rounded-full text-g-low ml-auto mr-1.5"
          >
            {tagNotes.length}
          </span>
          <span
            class="text-[10px] text-g-low transition-transform duration-200
            {expanded ? 'rotate-180' : ''}">▾</span
          >
        </button>

        <!-- Notes under tag -->
        {#if expanded}
          <div
            class="ml-3 pl-3 border-l mt-0.5 mb-1 space-y-0.5"
            style="border-color: {ac.hex}22"
          >
            {#each tagNotes as note}
              {@const isActive = $page.params.slug === note.slug}
              <a
                href="/notes/{note.slug}"
                class="flex items-center gap-2 px-2 py-1.5 text-[12px] no-underline
                  rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
                  transition-all duration-150 border border-transparent
                  {isActive
                  ? `${ac.text} bg-[${ac.hex}18] border-[${ac.hex}30]`
                  : 'text-g-low hover:text-g-mid hover:bg-g-surface2'}"
                on:click={() => dispatch("close")}
                title={note.title}
              >
                <!-- Tiny status dot -->
                <span
                  class="w-1.5 h-1.5 rounded-full shrink-0 opacity-70
                  {note.status === 'seedling' ? 'bg-emerald-400' : ''}
                  {note.status === 'budding' ? 'bg-green-300' : ''}
                  {note.status === 'evergreen' ? 'bg-green-200' : ''}
                  {note.status === 'compost' ? 'bg-amber-500' : ''}"
                ></span>
                <span class="truncate leading-snug">{note.title}</span>
              </a>
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </nav>
</aside>

<style>
  .sidebar-label {
    @apply text-[9px] tracking-[0.22em] uppercase text-g-low px-3 mb-1 mt-1;
  }
  .nav-item {
    @apply flex items-center gap-2.5 px-3 py-2
      rounded-[12px_10px_12px_10px/10px_12px_10px_12px]
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
