<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import { ACCENT_STYLES, tagToAccent } from "$lib/utils/tagColor";
  import { ALL_STATUSES } from "$lib/types";
  import type { NoteStatus } from "$lib/types";

  export let searchQuery: string = "";
  export let allTags: string[] = [];
  export let selectedTags: string[] = [];
  export let selectedStatuses: NoteStatus[] = [];
  export let resultCount: number = 0;
  export let totalCount: number = 0;

  const dispatch = createEventDispatcher<{
    search: string;
    tagToggle: string;
    statusToggle: NoteStatus;
    clearAll: void;
  }>();

  let dropdownOpen = false;
  let wrapperEl: HTMLDivElement;

  $: hasFilters = selectedTags.length > 0 || selectedStatuses.length > 0;
  $: hasAny = hasFilters || searchQuery.trim().length > 0;
  $: filterCount = selectedTags.length + selectedStatuses.length;
  $: isFiltered = hasAny && resultCount !== totalCount;

  type FilterPill =
    | { kind: "tag"; value: string }
    | { kind: "status"; value: NoteStatus };
  $: activePills = [
    ...selectedTags.map((t) => ({ kind: "tag" as const, value: t })),
    ...selectedStatuses.map((s) => ({ kind: "status" as const, value: s })),
  ];

  const STATUS_ICONS: Record<NoteStatus, string> = {
    seedling: "🌱",
    budding: "🌿",
    evergreen: "🌲",
    compost: "🍂",
  };

  function removePill(pill: FilterPill) {
    if (pill.kind === "tag") dispatch("tagToggle", pill.value);
    else dispatch("statusToggle", pill.value as NoteStatus);
  }

  function onSearchInput(e: Event) {
    dispatch("search", (e.target as HTMLInputElement).value);
  }

  // Close dropdown when clicking outside
  function onWindowClick(e: MouseEvent) {
    if (dropdownOpen && wrapperEl && !wrapperEl.contains(e.target as Node)) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={onWindowClick} />

<div class="px-5 md:px-8 py-4" bind:this={wrapperEl}>
  <!-- ── Search bar + filter button row ──────────────────────────── -->
  <div class="flex gap-2">
    <!-- Search input -->
    <div
      class="flex flex-1 flex-wrap items-center gap-2 min-h-[44px] px-3.5 py-2
        bg-g-surface border border-white/[0.07] transition-all duration-200
        focus-within:border-[rgba(180,77,255,0.45)] focus-within:shadow-[0_0_0_3px_rgba(180,77,255,0.1)]"
      style="border-radius: 14px 12px 14px 12px / 12px 14px 12px 14px"
    >
      <span class="text-g-low shrink-0 select-none" aria-hidden="true">⌕</span>

      <!-- Active filter pills inside the bar -->
      {#each activePills as pill}
        {#if pill.kind === "tag"}
          {@const ac = ACCENT_STYLES[tagToAccent(pill.value)]}
          <span
            class="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5
            border rounded-full shrink-0 {ac.text} {ac.border} {ac.bg}"
          >
            {pill.value}
            <button
              class="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
              on:click={() => removePill(pill)}>✕</button
            >
          </span>
        {:else}
          <span
            class="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5
            border border-white/20 bg-white/5 text-g-mid rounded-full shrink-0"
          >
            {STATUS_ICONS[pill.value]}
            {pill.value}
            <button
              class="opacity-60 hover:opacity-100 transition-opacity ml-0.5"
              on:click={() => removePill(pill)}>✕</button
            >
          </span>
        {/if}
      {/each}

      <input
        type="search"
        placeholder={activePills.length
          ? "Narrow down…"
          : "Search notes, tags, ideas…"}
        value={searchQuery}
        on:input={onSearchInput}
        class="flex-1 min-w-[120px] bg-transparent text-g-text font-body text-sm font-light
          outline-none placeholder:text-g-low [&::-webkit-search-cancel-button]:hidden"
      />

      <!-- Result count -->
      {#if isFiltered}
        <span class="text-[11px] text-g-low tabular-nums shrink-0"
          >{resultCount}/{totalCount}</span
        >
      {/if}

      <!-- Clear -->
      {#if hasAny}
        <button
          class="text-[11px] text-g-low hover:text-g-text px-2 py-0.5 rounded shrink-0
            border border-white/[0.07] hover:border-white/20 transition-all"
          on:click={() => dispatch("clearAll")}>Clear</button
        >
      {/if}
    </div>

    <!-- Filter dropdown button -->
    <div class="relative">
      <button
        class="h-[44px] px-3.5 flex items-center gap-2 text-sm font-medium
          bg-g-surface border transition-all duration-200
          {dropdownOpen || filterCount > 0
          ? 'border-[rgba(180,77,255,0.45)] text-[#b44dff] bg-[rgba(180,77,255,0.08)]'
          : 'border-white/[0.07] text-g-mid hover:text-g-text hover:border-white/20'}"
        style="border-radius: 12px 14px 12px 14px / 14px 12px 14px 12px"
        on:click|stopPropagation={() => (dropdownOpen = !dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-label="Toggle filters"
      >
        <span>⊞</span>
        <span class="hidden sm:inline">Filters</span>
        {#if filterCount > 0}
          <span
            class="w-4 h-4 rounded-full bg-[#b44dff] text-white text-[9px] font-bold
            flex items-center justify-center leading-none">{filterCount}</span
          >
        {/if}
        <span
          class="text-[10px] opacity-50 transition-transform duration-200
          {dropdownOpen ? 'rotate-180' : ''}">▾</span
        >
      </button>

      <!-- Dropdown panel -->
      {#if dropdownOpen}
        <div
          class="absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] sm:w-[360px]
            bg-g-surface border border-white/[0.1] shadow-2xl shadow-black/50 p-4 space-y-4"
          style="border-radius: 14px 12px 14px 14px / 12px 14px 12px 14px"
          role="dialog"
          aria-label="Filter options"
          on:click|stopPropagation={() => {}}
        >
          <!-- Tags -->
          {#if allTags.length}
            <div>
              <p
                class="text-[9px] tracking-[0.2em] uppercase text-g-low mb-2 font-medium"
              >
                Tags
              </p>
              <div class="flex flex-wrap gap-1.5">
                {#each allTags as tag}
                  {@const ac = ACCENT_STYLES[tagToAccent(tag)]}
                  {@const active = selectedTags.includes(tag)}
                  <button
                    class="text-[11px] font-medium px-3 py-1 border transition-all duration-150
                      {active
                      ? `${ac.text} ${ac.border} ${ac.bg}`
                      : 'text-g-low border-white/[0.07] hover:text-g-mid hover:border-white/20'}"
                    style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
                    on:click={() => dispatch("tagToggle", tag)}
                    aria-pressed={active}>{tag}</button
                  >
                {/each}
              </div>
            </div>

            <hr class="border-white/[0.06]" />
          {/if}

          <!-- Statuses -->
          <div>
            <p
              class="text-[9px] tracking-[0.2em] uppercase text-g-low mb-2 font-medium"
            >
              Status
            </p>
            <div class="flex flex-wrap gap-2">
              {#each ALL_STATUSES as status}
                {@const active = selectedStatuses.includes(status)}
                <button
                  class="transition-all duration-150 {active
                    ? 'opacity-100 scale-105'
                    : 'opacity-40 hover:opacity-70'}"
                  on:click={() => dispatch("statusToggle", status)}
                  aria-pressed={active}
                >
                  <StatusBadge {status} />
                </button>
              {/each}
            </div>
          </div>

          <!-- Footer -->
          {#if filterCount > 0}
            <div
              class="flex items-center justify-between pt-1 border-t border-white/[0.06]"
            >
              <span class="text-[11px] text-g-low"
                >{filterCount} filter{filterCount > 1 ? "s" : ""} active</span
              >
              <button
                class="text-[11px] text-[#b44dff] hover:underline"
                on:click={() => {
                  dispatch("clearAll");
                  dropdownOpen = false;
                }}>Clear all</button
              >
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
