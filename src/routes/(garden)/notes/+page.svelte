<script lang="ts">
  import NoteCard from "$lib/components/NoteCard.svelte";
  import SearchFilter from "$lib/components/SearchFilter.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import { page as pageStore } from "$app/stores";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { NoteSummary, NoteStatus } from "$lib/types";

  export let data: PageData;

  // ── View / sort / filter state
  let view: "grid" | "index" = (data.view as "grid" | "index") ?? "grid";
  let sortBy: "freshly-added" | "last-tended" | "a-z" = "freshly-added";
  let searchQuery = "";
  let selectedTags: string[] = [];
  let selectedStatuses: NoteStatus[] = [];

  // ── Notes pipeline
  $: rawNotes = data.notes as NoteSummary[];
  $: allTags =
    (data.allTags as string[]) ??
    [...new Set(rawNotes.flatMap((n) => n.tags))].sort();

  $: deduped = (() => {
    const seen = new Set<string>();
    return rawNotes.filter((n) => {
      if (n.slug === "home" || seen.has(n.slug)) return false;
      seen.add(n.slug);
      return true;
    });
  })();

  $: sorted = (() => {
    if (sortBy === "a-z" || view === "index") {
      return [...deduped].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    }
    if (sortBy === "last-tended") {
      return [...deduped].sort((a, b) =>
        ((b as any).lastTendedRaw ?? b.dateRaw ?? "").localeCompare(
          (a as any).lastTendedRaw ?? a.dateRaw ?? "",
        ),
      );
    }
    return deduped;
  })();

  $: filtered = sorted.filter((n) => {
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

  $: totalLinks = deduped.reduce((s, n) => s + n.links, 0);
  $: lastTended = deduped[0]?.date ?? "\u2014";

  // ── Index view
  const PER_PAGE = 20;
  let indexPage = data.page ?? 1;

  $: totalPages = Math.ceil(filtered.length / PER_PAGE);
  $: currentPage = Math.max(1, Math.min(indexPage, totalPages || 1));
  $: pageNotes = filtered.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  $: letterGroups = (() => {
    const map = new Map<string, NoteSummary[]>();
    for (const note of pageNotes) {
      const letter = note.title[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(note);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  $: allLetters = (() => {
    const set = new Set<string>();
    for (const n of filtered) {
      const l = n.title[0]?.toUpperCase() ?? "#";
      set.add(/[A-Z]/.test(l) ? l : "#");
    }
    return [...set].sort();
  })();

  $: letterPages = (() => {
    const map = new Map<string, number>();
    for (let i = 0; i < filtered.length; i++) {
      const l = filtered[i].title[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(l) ? l : "#";
      if (!map.has(key)) map.set(key, Math.floor(i / PER_PAGE) + 1);
    }
    return map;
  })();

  // Reset to page 1 when filters change
  $: {
    filtered;
    indexPage = 1;
  }

  function goToPage(p: number) {
    indexPage = p;
    const url = new URL($pageStore.url);
    url.searchParams.set("page", String(p));
    url.searchParams.set("view", "index");
    goto(url.toString(), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  function pageRange(current: number, total: number): (number | "\u2026")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const r: (number | "\u2026")[] = [];
    const add = (n: number) => {
      if (!r.includes(n)) r.push(n);
    };
    add(1);
    if (current > 3) r.push("\u2026");
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    )
      add(i);
    if (current < total - 2) r.push("\u2026");
    add(total);
    return r;
  }
  $: paginationItems = pageRange(currentPage, totalPages);

  function setView(v: "grid" | "index") {
    view = v;
    const url = new URL($pageStore.url);
    url.searchParams.set("view", v);
    url.searchParams.delete("page");
    goto(url.toString(), {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  }

  onMount(() => {
    const q = $pageStore.url.searchParams.get("q");
    const tag = $pageStore.url.searchParams.get("tag");
    if (q) searchQuery = q;
    if (tag) selectedTags = [tag];
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
</script>

<svelte:head>
  <title>All Notes \u00b7 Digital Garden</title>
</svelte:head>

<!-- Hero -->
<div class="px-5 md:px-8 pt-8 pb-4">
  <h1
    class="font-display font-black text-[clamp(28px,5vw,44px)] tracking-[-2px] leading-none mb-1.5"
  >
    My <em class="not-italic text-[#b44dff]">Garden</em>
  </h1>
  <p class="text-[12px] text-g-low font-light">
    {deduped.length} notes \u00b7 last tended {lastTended}
  </p>

  <div class="grid grid-cols-3 gap-2.5 mt-6 mb-2">
    {#each [{ val: String(deduped.length), label: "Notes", color: "#b44dff", shadow: "rgba(180,77,255,0.5)", r: "18px 14px 18px 12px/14px 18px 12px 18px" }, { val: String(totalLinks), label: "Links", color: "#ff5c3a", shadow: "rgba(255,92,58,0.5)", r: "12px 18px 14px 18px/18px 12px 18px 14px" }, { val: String(allTags.length), label: "Tags", color: "#b8ff3a", shadow: "rgba(184,255,58,0.4)", r: "16px 12px 16px 14px/12px 16px 14px 16px" }] as stat}
      <div
        class="bg-g-surface border border-white/[0.07] px-4 py-3 hover:-translate-y-0.5 transition-transform"
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

<!-- Toolbar -->
<div class="px-5 md:px-8 pb-1 flex items-center gap-3 flex-wrap">
  <!-- View toggle -->
  <div
    class="flex gap-1 p-0.5 bg-g-surface border border-white/[0.07] rounded-full"
  >
    {#each [{ v: "grid", icon: "\u229e", label: "Grid" }, { v: "index", icon: "\u2630", label: "Index" }] as opt}
      <button
        on:click={() => setView(opt.v)}
        class="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-full transition-all"
        style={view === opt.v
          ? "color:#b44dff;background:rgba(180,77,255,0.15);"
          : "color:rgba(255,255,255,0.3);"}
        ><span>{opt.icon}</span><span class="hidden sm:inline">{opt.label}</span
        ></button
      >
    {/each}
  </div>

  <div class="w-px h-4 bg-white/[0.08]"></div>

  <!-- Sort -->
  <div class="flex gap-1">
    {#each view === "grid" ? [{ value: "freshly-added", label: "U0001f331 Freshly Added" }, { value: "last-tended", label: "U0001fab4 Last Tended" }, { value: "a-z", label: "U0001f524 A \u2192 Z" }] : [{ value: "a-z", label: "U0001f524 A \u2192 Z" }] as opt}
      <button
        on:click={() => (sortBy = opt.value)}
        class="text-[11px] px-3 py-1 rounded-full border transition-all"
        style={sortBy === opt.value || (view === "index" && opt.value === "a-z")
          ? "color:#b44dff;background:rgba(180,77,255,0.1);border-color:rgba(180,77,255,0.35)"
          : "color:rgba(255,255,255,0.3);border-color:rgba(255,255,255,0.07);"}
        >{opt.label}</button
      >
    {/each}
  </div>

  <span class="ml-auto text-[11px] text-g-low tabular-nums">
    {filtered.length}{filtered.length !== deduped.length
      ? `/${deduped.length}`
      : ""} notes
  </span>
</div>

<!-- Search + filter -->
<SearchFilter
  {searchQuery}
  {allTags}
  {selectedTags}
  {selectedStatuses}
  resultCount={filtered.length}
  totalCount={deduped.length}
  on:search={(e) => (searchQuery = e.detail)}
  on:tagToggle={toggleTag}
  on:statusToggle={toggleStatus}
  on:clearAll={clearAll}
/>

<!-- Grid view -->
{#if view === "grid"}
  <div class="px-5 md:px-8 pb-10">
    {#if filtered.length > 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {#each filtered as note, i (note.slug)}
          <NoteCard {note} index={i} />
        {/each}
      </div>
    {:else if deduped.length === 0}
      <div class="text-center py-20 text-g-mid">
        <div class="text-5xl mb-4">\U0001f331</div>
        <p class="font-light">Your garden is empty.</p>
      </div>
    {:else}
      <div class="text-center py-20 text-g-mid">
        <div class="text-5xl mb-4">\U0001f50d</div>
        <p class="font-light">No notes match your filters.</p>
        <button
          class="mt-4 text-sm text-[#b44dff] hover:underline"
          on:click={clearAll}>Clear all</button
        >
      </div>
    {/if}
  </div>

  <!-- Index view -->
{:else}
  <div class="px-5 md:px-10 pb-10 max-w-[800px]">
    <!-- Alphabet nav -->
    <div class="flex flex-wrap gap-1 mb-8 pb-6 border-b border-white/[0.07]">
      {#each "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("") as letter}
        {@const hasLetter = allLetters.includes(letter)}
        {@const targetPage = letterPages.get(letter)}
        {@const isOnPage = letterGroups.some(([l]) => l === letter)}
        {#if hasLetter && targetPage}
          <button
            on:click={() => goToPage(targetPage)}
            class="w-7 h-7 flex items-center justify-center text-[11px] font-semibold border transition-all"
            style="border-radius:8px 6px 8px 6px/6px 8px 6px 8px;
              {isOnPage
              ? 'color:#b44dff;background:rgba(180,77,255,0.12);border-color:rgba(180,77,255,0.35)'
              : 'color:rgba(255,255,255,0.45);border-color:rgba(255,255,255,0.07);background:rgba(255,255,255,0.03)'}"
            >{letter}</button
          >
        {:else}
          <span
            class="w-7 h-7 flex items-center justify-center text-[11px] text-white/15 cursor-default select-none"
            >{letter}</span
          >
        {/if}
      {/each}
    </div>

    {#if filtered.length === 0}
      <div class="text-center py-20 text-g-mid">
        <div class="text-5xl mb-4">\U0001f50d</div>
        <p class="font-light">No notes match your filters.</p>
        <button
          class="mt-4 text-sm text-[#b44dff] hover:underline"
          on:click={clearAll}>Clear all</button
        >
      </div>
    {/if}

    <!-- Letter groups -->
    <div class="space-y-8">
      {#each letterGroups as [letter, notes]}
        <section id={letter}>
          <div class="flex items-center gap-3 mb-3">
            <h2
              class="font-display font-black text-[clamp(28px,5vw,40px)] leading-none tracking-tight"
              style="color:#b44dff;text-shadow:0 0 20px rgba(180,77,255,0.4)"
            >
              {letter}
            </h2>
            <div class="flex-1 h-px bg-white/[0.07]"></div>
            <span class="text-[10px] text-g-low">{notes.length}</span>
          </div>
          <div class="flex flex-col gap-1">
            {#each notes as note}
              {@const ac = accentStyle(note.accent)}
              <a
                href="{base}/notes/{note.slug}"
                class="group flex items-center gap-3 px-4 py-3 no-underline
                  border border-transparent rounded-[10px_8px_10px_8px/8px_10px_8px_10px]
                  hover:bg-g-surface hover:border-white/[0.07] transition-all duration-150"
              >
                <span
                  class="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
                  style="background:{ac.hex};box-shadow:0 0 6px {ac.hex}66"
                ></span>
                <span
                  class="font-display font-bold text-[14.5px] text-g-mid group-hover:text-g-text transition-colors flex-1 truncate"
                  >{note.title}</span
                >
                <span
                  class="hidden sm:inline text-[10px] font-medium px-2 py-0.5 border rounded-full shrink-0 capitalize {ac.text} {ac.border} {ac.bg}"
                  >{note.emoji} {note.primaryTag}</span
                >
                <span class="shrink-0 hidden md:flex"
                  ><StatusBadge status={note.status} /></span
                >
                {#if note.date}
                  <time
                    class="text-[11px] text-g-low shrink-0 hidden lg:block tabular-nums w-[80px] text-right"
                    datetime={note.dateRaw ?? undefined}>{note.date}</time
                  >
                {/if}
                <span
                  class="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  style="color:{ac.hex}">\u2192</span
                >
              </a>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <nav
        class="flex items-center justify-center gap-1.5 mt-12 pt-8 border-t border-white/[0.07]"
        aria-label="Pagination"
      >
        <button
          class="w-8 h-8 flex items-center justify-center text-sm border transition-all rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
            {currentPage === 1
            ? 'text-white/15 border-white/[0.04] cursor-not-allowed'
            : 'text-g-mid border-white/[0.1] hover:text-g-text hover:border-white/25'}"
          disabled={currentPage === 1}
          on:click={() => goToPage(currentPage - 1)}
          aria-label="Previous page">\u2039</button
        >

        {#each paginationItems as item}
          {#if item === "\u2026"}
            <span class="w-8 text-center text-g-low text-[12px]">\u2026</span>
          {:else}
            <button
              class="w-8 h-8 flex items-center justify-center text-[12px] font-medium border transition-all rounded-[8px_6px_8px_6px/6px_8px_6px_8px]"
              style={item === currentPage
                ? "color:#b44dff;background:rgba(180,77,255,0.12);border-color:rgba(180,77,255,0.35)"
                : "color:rgba(255,255,255,0.45);border-color:rgba(255,255,255,0.07)"}
              on:click={() => goToPage(item)}
              aria-label="Page {item}"
              aria-current={item === currentPage ? "page" : undefined}
              >{item}</button
            >
          {/if}
        {/each}

        <button
          class="w-8 h-8 flex items-center justify-center text-sm border transition-all rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
            {currentPage === totalPages
            ? 'text-white/15 border-white/[0.04] cursor-not-allowed'
            : 'text-g-mid border-white/[0.1] hover:text-g-text hover:border-white/25'}"
          disabled={currentPage === totalPages}
          on:click={() => goToPage(currentPage + 1)}
          aria-label="Next page">\u203a</button
        >
      </nav>
      <p class="text-center text-[10px] text-g-low/50 mt-3">
        {(currentPage - 1) * PER_PAGE + 1}\u2013{Math.min(
          currentPage * PER_PAGE,
          filtered.length,
        )} of {filtered.length} notes
      </p>
    {/if}
  </div>
{/if}
