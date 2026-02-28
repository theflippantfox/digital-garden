<script lang="ts">
  import NoteCard from '$lib/components/NoteCard.svelte';
  import SearchFilter from '$lib/components/SearchFilter.svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import type { NoteSummary, NoteStatus } from '$lib/types';

  export let data: PageData;

  let searchQuery   = '';
  let selectedTags: string[]      = [];
  let selectedStatuses: NoteStatus[] = [];

  onMount(() => {
    const q   = $page.url.searchParams.get('q');
    const tag = $page.url.searchParams.get('tag');
    if (q)   searchQuery  = q;
    if (tag) selectedTags = [tag];
  });

  $: allTags = [...new Set(data.notes.flatMap(n => n.tags))].sort();

  $: filtered = data.notes.filter((n: NoteSummary) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q
      || n.title.toLowerCase().includes(q)
      || n.excerpt.toLowerCase().includes(q)
      || n.tags.some(t => t.toLowerCase().includes(q));

    const matchTags = selectedTags.length === 0
      || selectedTags.every(t => n.tags.includes(t));

    const matchStatus = selectedStatuses.length === 0
      || selectedStatuses.includes(n.status);

    return matchSearch && matchTags && matchStatus;
  });

  function toggleTag(e: CustomEvent<string>) {
    const t = e.detail;
    selectedTags = selectedTags.includes(t) ? selectedTags.filter(x => x !== t) : [...selectedTags, t];
  }

  function toggleStatus(e: CustomEvent<NoteStatus>) {
    const s = e.detail;
    selectedStatuses = selectedStatuses.includes(s)
      ? selectedStatuses.filter(x => x !== s)
      : [...selectedStatuses, s];
  }

  function clearAll() {
    searchQuery = '';
    selectedTags = [];
    selectedStatuses = [];
  }

  $: totalLinks = data.notes.reduce((s, n) => s + n.links, 0);
  $: lastTended = data.notes[0]?.date ?? '';
</script>

<svelte:head>
  <title>Digital Garden</title>
</svelte:head>

<div class="px-5 md:px-8 pt-8 pb-2">
  <!-- Header -->
  <h1 class="font-display font-black text-[clamp(28px,5vw,44px)] tracking-[-2px] leading-none mb-1.5">
    My <em class="not-italic text-[#b44dff]">Garden</em>
  </h1>
  <p class="text-[12px] text-g-low font-light">{data.notes.length} notes · last tended {lastTended}</p>

  <!-- Stats strip -->
  <div class="grid grid-cols-3 gap-2.5 mt-6 mb-2">
    <div class="bg-g-surface border border-white/[0.07] px-4 py-3
      rounded-[18px_14px_18px_12px/14px_18px_12px_18px] hover:-translate-y-0.5 transition-transform">
      <div class="font-display font-black text-[clamp(18px,3vw,26px)] tracking-tight leading-none
        text-[#b44dff] [text-shadow:0_0_14px_rgba(180,77,255,0.5)]">{data.notes.length}</div>
      <div class="text-[10px] text-g-low font-light mt-1">Notes</div>
    </div>
    <div class="bg-g-surface border border-white/[0.07] px-4 py-3
      rounded-[12px_18px_14px_18px/18px_12px_18px_14px] hover:-translate-y-0.5 transition-transform">
      <div class="font-display font-black text-[clamp(18px,3vw,26px)] tracking-tight leading-none
        text-[#ff5c3a] [text-shadow:0_0_14px_rgba(255,92,58,0.5)]">{totalLinks}</div>
      <div class="text-[10px] text-g-low font-light mt-1">Links</div>
    </div>
    <div class="bg-g-surface border border-white/[0.07] px-4 py-3
      rounded-[16px_12px_16px_14px/12px_16px_14px_16px] hover:-translate-y-0.5 transition-transform">
      <div class="font-display font-black text-[clamp(18px,3vw,26px)] tracking-tight leading-none
        text-[#b8ff3a] [text-shadow:0_0_14px_rgba(184,255,58,0.4)]">{allTags.length}</div>
      <div class="text-[10px] text-g-low font-light mt-1">Tags</div>
    </div>
  </div>
</div>

<!-- Unified search + filter bar (inline, not sticky) -->
<SearchFilter
  {searchQuery}
  {allTags}
  {selectedTags}
  {selectedStatuses}
  resultCount={filtered.length}
  totalCount={data.notes.length}
  on:search={e => searchQuery = e.detail}
  on:tagToggle={toggleTag}
  on:statusToggle={toggleStatus}
  on:clearAll={clearAll}
/>

<!-- Grid -->
<div class="px-5 md:px-8 pb-10">
  {#if filtered.length > 0}
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {#each filtered as note, i (note.slug)}
        <NoteCard {note} index={i} />
      {/each}
    </div>
  {:else}
    <div class="text-center py-20 text-g-mid" role="status">
      <div class="text-5xl mb-4" aria-hidden="true">🌱</div>
      <p class="font-light">No notes match your filters.</p>
      <button class="mt-4 text-sm text-[#b44dff] hover:underline" on:click={clearAll}>
        Clear all
      </button>
    </div>
  {/if}
</div>
