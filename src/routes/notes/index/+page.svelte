<script lang="ts">
  import { base } from "$app/paths";
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  import { ACCENT_STYLES } from "$lib/utils/tagColor";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import type { PageData } from "./$types";
  import type { NoteSummary, Accent } from "$lib/types";

  export let data: PageData;

  const PER_PAGE = 20;

  // All notes sorted A→Z
  $: sorted = [...(data.notes as NoteSummary[])].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
  );

  // Total pages
  $: totalPages = Math.ceil(sorted.length / PER_PAGE);
  $: currentPage = Math.max(1, Math.min(data.page ?? 1, totalPages));

  // Notes for this page
  $: pageNotes = sorted.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE,
  );

  // Group THIS page's notes by first letter
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

  // All letters that exist across ALL notes (for the alphabet nav)
  $: allLetters = (() => {
    const set = new Set<string>();
    for (const n of sorted) {
      const l = n.title[0]?.toUpperCase() ?? "#";
      set.add(/[A-Z]/.test(l) ? l : "#");
    }
    return [...set].sort();
  })();

  // Letter → which page it first appears on (for alphabet nav links)
  $: letterPages = (() => {
    const map = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i].title[0]?.toUpperCase() ?? "#";
      const key = /[A-Z]/.test(l) ? l : "#";
      if (!map.has(key)) map.set(key, Math.floor(i / PER_PAGE) + 1);
    }
    return map;
  })();

  function goToPage(p: number) {
    const url = new URL($pageStore.url);
    url.searchParams.set("page", String(p));
    goto(url.toString(), { replaceState: false, keepFocus: true });
  }

  // Range helper for pagination buttons
  function pageRange(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result: (number | "…")[] = [];
    const add = (n: number) => {
      if (!result.includes(n)) result.push(n);
    };
    add(1);
    if (current > 3) result.push("…");
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    )
      add(i);
    if (current < total - 2) result.push("…");
    add(total);
    return result;
  }

  $: paginationItems = pageRange(currentPage, totalPages);
</script>

<svelte:head>
  <title>Note Index · Digital Garden</title>
</svelte:head>

<div class="px-5 md:px-10 py-8 md:py-12 max-w-[800px]">
  <!-- Header -->
  <div class="mb-8">
    <a
      href="{base}/notes"
      class="inline-flex items-center gap-2 text-[12px] text-g-mid font-light no-underline
        px-4 py-2 mb-6 border border-white/[0.07] bg-g-surface
        hover:text-[#b44dff] hover:border-[rgba(180,77,255,0.35)] transition-all"
      style="border-radius:50px 48px 50px 48px/48px 50px 48px 50px"
    >
      ← back to garden
    </a>

    <h1
      class="font-display font-black text-[clamp(26px,5vw,42px)] tracking-[-1.5px] text-g-text mb-1"
    >
      Note Index
    </h1>
    <p class="text-[12px] text-g-low font-light">
      {sorted.length} notes · A → Z · page {currentPage} of {totalPages}
    </p>
  </div>

  <!-- Alphabet nav -->
  <div class="flex flex-wrap gap-1 mb-8 pb-6 border-b border-white/[0.07]">
    {#each "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("") as letter}
      {@const hasLetter = allLetters.includes(letter)}
      {@const targetPage = letterPages.get(letter)}
      {@const isOnPage = letterGroups.some(([l]) => l === letter)}
      {#if hasLetter && targetPage}
        <a
          href="{base}/notes/index?page={targetPage}#{letter}"
          class="w-7 h-7 flex items-center justify-center text-[11px] font-semibold
            border transition-all duration-150 no-underline"
          style="border-radius:8px 6px 8px 6px/6px 8px 6px 8px;
            {isOnPage
            ? 'color:#b44dff;background:rgba(180,77,255,0.12);border-color:rgba(180,77,255,0.35)'
            : 'color:rgba(255,255,255,0.45);border-color:rgba(255,255,255,0.07);background:rgba(255,255,255,0.03)'}"
          >{letter}</a
        >
      {:else}
        <span
          class="w-7 h-7 flex items-center justify-center text-[11px] font-medium
          text-white/15 cursor-default select-none">{letter}</span
        >
      {/if}
    {/each}
  </div>

  <!-- Letter groups -->
  <div class="space-y-8">
    {#each letterGroups as [letter, notes]}
      <section id={letter}>
        <!-- Letter heading -->
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

        <!-- Note rows -->
        <div class="flex flex-col gap-1">
          {#each notes as note}
            {@const ac = ACCENT_STYLES[note.accent]}
            <a
              href="{base}/notes/{note.slug}"
              class="group flex items-center gap-3 px-4 py-3 no-underline
                border border-transparent rounded-[10px_8px_10px_8px/8px_10px_8px_10px]
                hover:bg-g-surface hover:border-white/[0.07]
                transition-all duration-150"
            >
              <!-- Accent dot -->
              <span
                class="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
                style="background:{ac.hex};box-shadow:0 0 6px {ac.hex}66"
              ></span>

              <!-- Title -->
              <span
                class="font-display font-bold text-[14.5px] text-g-mid
                group-hover:text-g-text transition-colors flex-1 truncate"
              >
                {note.title}
              </span>

              <!-- Tag -->
              <span
                class="hidden sm:inline text-[10px] font-medium px-2 py-0.5
                border rounded-full shrink-0 capitalize
                {ac.text} {ac.border} {ac.bg}"
              >
                {note.emoji}
                {note.primaryTag}
              </span>

              <!-- Status -->
              <span class="shrink-0 hidden md:flex">
                <StatusBadge status={note.status} />
              </span>

              <!-- Date -->
              {#if note.date}
                <time
                  class="text-[11px] text-g-low shrink-0 hidden lg:block tabular-nums w-[80px] text-right"
                  datetime={note.dateRaw ?? undefined}>{note.date}</time
                >
              {/if}

              <!-- Arrow -->
              <span
                class="text-[11px] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                style="color:{ac.hex}">→</span
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
      <!-- Prev -->
      <button
        class="w-8 h-8 flex items-center justify-center text-sm border transition-all
          rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
          {currentPage === 1
          ? 'text-white/15 border-white/[0.04] cursor-not-allowed'
          : 'text-g-mid border-white/[0.1] hover:text-g-text hover:border-white/25'}"
        disabled={currentPage === 1}
        on:click={() => goToPage(currentPage - 1)}
        aria-label="Previous page">‹</button
      >

      <!-- Page numbers -->
      {#each paginationItems as item}
        {#if item === "…"}
          <span class="w-8 text-center text-g-low text-[12px]">…</span>
        {:else}
          <button
            class="w-8 h-8 flex items-center justify-center text-[12px] font-medium border
              transition-all rounded-[8px_6px_8px_6px/6px_8px_6px_8px]"
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

      <!-- Next -->
      <button
        class="w-8 h-8 flex items-center justify-center text-sm border transition-all
          rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
          {currentPage === totalPages
          ? 'text-white/15 border-white/[0.04] cursor-not-allowed'
          : 'text-g-mid border-white/[0.1] hover:text-g-text hover:border-white/25'}"
        disabled={currentPage === totalPages}
        on:click={() => goToPage(currentPage + 1)}
        aria-label="Next page">›</button
      >
    </nav>

    <p class="text-center text-[10px] text-g-low/50 mt-3">
      Showing {(currentPage - 1) * PER_PAGE + 1}–{Math.min(
        currentPage * PER_PAGE,
        sorted.length,
      )} of {sorted.length} notes
    </p>
  {/if}
</div>
