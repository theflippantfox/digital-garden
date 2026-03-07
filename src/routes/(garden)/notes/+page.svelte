<script lang="ts">
  import NoteCard from "$lib/components/NoteCard.svelte";
  import SearchFilter from "$lib/components/SearchFilter.svelte";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { NoteSummary, NoteStatus } from "$lib/types";

  export let data: PageData;
  export let params: Record<string, string> = {};

  let searchQuery = "";
  let selectedTags: string[] = [];
  let selectedStatuses: NoteStatus[] = [];
  let sortBy: "freshly-added" | "last-tended" = "freshly-added";

  // Data arrives server-rendered — deduplicate by slug, filter out home
  $: rawNotes = data.notes as NoteSummary[];
  $: notes = (() => {
    const seen = new Set<string>();
    const deduped = rawNotes.filter((n) => {
      if (n.slug === "home" || seen.has(n.slug)) return false;
      seen.add(n.slug);
      return true;
    });
    if (sortBy === "last-tended") {
      return [...deduped].sort((a, b) =>
        ((b as any).lastTendedRaw ?? b.dateRaw ?? "").localeCompare(
          (a as any).lastTendedRaw ?? a.dateRaw ?? "",
        ),
      );
    }
    return deduped; // already sorted by date from loader
  })();
  $: allTags =
    (data.allTags as string[]) ??
    [...new Set(notes.flatMap((n) => n.tags))].sort();

  // Apply URL params on mount (e.g. ?tag=engineering from sidebar links)
  onMount(() => {
    const q = $page.url.searchParams.get("q");
    const tag = $page.url.searchParams.get("tag");
    if (q) searchQuery = q;
    if (tag) selectedTags = [tag];
  });

  $: filtered = notes.filter((n) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.excerpt.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q));
    const matchTags =
      selectedTags.length === 0 ||
      selectedTags.every((t) => n.tags.includes(t));
    const matchStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(n.status);
    return matchSearch && matchTags && matchStatus;
  });

  function toggleTag(e: CustomEvent<string>) {
    const t = e.detail;
    selectedTags = selectedTags.includes(t)
      ? selectedTags.filter((x) => x !== t)
      : [...selectedTags, t];
  }
  function toggleStatus(e: CustomEvent<NoteStatus>) {
    const s = e.detail;
    selectedStatuses = selectedStatuses.includes(s)
      ? selectedStatuses.filter((x) => x !== s)
      : [...selectedStatuses, s];
  }
  function clearAll() {
    searchQuery = "";
    selectedTags = [];
    selectedStatuses = [];
  }

  $: totalLinks = notes.reduce((s, n) => s + n.links, 0);
  $: lastTended = notes[0]?.date ?? "—";
</script>

<svelte:head>
  <title>Digital Garden</title>
</svelte:head>

<!-- Hero -->
<div class="px-5 md:px-8 pt-8 pb-4">
  <h1
    class="font-display font-black text-[clamp(28px,5vw,44px)] tracking-[-2px] leading-none mb-1.5"
  >
    My <em class="not-italic text-[#b44dff]">Garden</em>
  </h1>
  <p class="text-[12px] text-g-low font-light">
    {notes.length} notes · last tended {lastTended}
  </p>

  <!-- Stats -->
  <div class="grid grid-cols-3 gap-2.5 mt-6 mb-2">
    {#each [{ val: String(notes.length), label: "Notes", color: "#b44dff", shadow: "rgba(180,77,255,0.5)", r: "18px 14px 18px 12px/14px 18px 12px 18px" }, { val: String(totalLinks), label: "Links", color: "#ff5c3a", shadow: "rgba(255,92,58,0.5)", r: "12px 18px 14px 18px/18px 12px 18px 14px" }, { val: String(allTags.length), label: "Tags", color: "#b8ff3a", shadow: "rgba(184,255,58,0.4)", r: "16px 12px 16px 14px/12px 16px 14px 16px" }] as stat}
      <div
        class="bg-g-surface border border-white/[0.07] px-4 py-3
        hover:-translate-y-0.5 transition-transform"
        style="border-radius:{stat.r}"
      >
        <div
          class="font-display font-black text-[clamp(18px,3vw,26px)] tracking-tight leading-none"
          style="color:{stat.color};text-shadow:0 0 14px {stat.shadow}"
        >
          {stat.val}
        </div>
        <div class="text-[10px] text-g-low font-light mt-1">{stat.label}</div>
      </div>
    {/each}
  </div>
</div>

<!-- Sort toggle -->
<div class="px-5 md:px-8 pb-1 flex items-center gap-2">
  <span class="text-[10px] uppercase tracking-[0.2em] text-g-low font-medium"
    >Sort</span
  >
  <div class="flex gap-1">
    {#each [{ value: "freshly-added", label: "🌱 Freshly Added" }, { value: "last-tended", label: "🪴 Last Tended" }] as opt}
      <button
        on:click={() => (sortBy = opt.value)}
        class="text-[11px] px-3 py-1 rounded-full border transition-all"
        style={sortBy === opt.value
          ? "color:#b44dff;background:rgba(180,77,255,0.1);border-color:rgba(180,77,255,0.35)"
          : "color:rgba(255,255,255,0.35);border-color:rgba(255,255,255,0.08);"}
        >{opt.label}</button
      >
    {/each}
  </div>
</div>

<!-- Search + filter -->
<SearchFilter
  {searchQuery}
  {allTags}
  {selectedTags}
  {selectedStatuses}
  resultCount={filtered.length}
  totalCount={notes.length}
  on:search={(e) => (searchQuery = e.detail)}
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
  {:else if notes.length === 0}
    <div class="text-center py-20 text-g-mid">
      <div class="text-5xl mb-4">🌱</div>
      <p class="font-light">Your garden is empty.</p>
    </div>
  {:else}
    <div class="text-center py-20 text-g-mid">
      <div class="text-5xl mb-4">🌱</div>
      <p class="font-light">No notes match your filters.</p>
      <button
        class="mt-4 text-sm text-[#b44dff] hover:underline"
        on:click={clearAll}>Clear all</button
      >
    </div>
  {/if}
</div>
