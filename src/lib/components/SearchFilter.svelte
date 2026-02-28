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

  let inputEl: HTMLInputElement;

  $: hasFilters = selectedTags.length > 0 || selectedStatuses.length > 0;
  $: hasSearch = searchQuery.trim().length > 0;
  $: hasAny = hasFilters || hasSearch;
  $: isFiltered = hasAny && resultCount !== totalCount;

  // All active filter pills shown inside the search bar area
  type FilterPill =
    | { kind: "tag"; value: string }
    | { kind: "status"; value: NoteStatus };
  $: activePills = [
    ...selectedTags.map((t) => ({ kind: "tag" as const, value: t })),
    ...selectedStatuses.map((s) => ({ kind: "status" as const, value: s })),
  ];

  function removePill(pill: FilterPill) {
    if (pill.kind === "tag") dispatch("tagToggle", pill.value);
    else dispatch("statusToggle", pill.value as NoteStatus);
  }

  // STATUS_META is imported indirectly via StatusBadge, expose icon here
  const STATUS_ICONS: Record<NoteStatus, string> = {
    seedling: "🌱",
    budding: "🌿",
    evergreen: "🌲",
    compost: "🍂",
  };
</script>

<div class="px-5 md:px-8 py-5 space-y-3">
  <!-- ── Search input ────────────────────────────────────────────── -->
  <div
    class="flex flex-wrap items-center gap-2 min-h-[44px] px-3.5 py-2
      bg-g-surface border border-white/[0.07] transition-all duration-200
      focus-within:border-[rgba(180,77,255,0.45)] focus-within:shadow-[0_0_0_3px_rgba(180,77,255,0.1)]"
    style="border-radius: 14px 12px 14px 12px / 12px 14px 12px 14px"
  >
    <!-- Search icon -->
    <span class="text-g-low text-sm shrink-0 select-none" aria-hidden="true"
      >⌕</span
    >

    <!-- Active filter pills (inside the bar) -->
    {#each activePills as pill}
      {#if pill.kind === "tag"}
        {@const ac = ACCENT_STYLES[tagToAccent(pill.value)]}
        <span
          class="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5
            border rounded-full {ac.text} {ac.border} {ac.bg} shrink-0"
        >
          {pill.value}
          <button
            class="opacity-60 hover:opacity-100 transition-opacity ml-0.5 leading-none"
            on:click={() => removePill(pill)}
            aria-label="Remove {pill.value} filter">✕</button
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
            class="opacity-60 hover:opacity-100 transition-opacity ml-0.5 leading-none"
            on:click={() => removePill(pill)}
            aria-label="Remove {pill.value} filter">✕</button
          >
        </span>
      {/if}
    {/each}

    <!-- Text input -->
    <input
      bind:this={inputEl}
      type="search"
      placeholder={activePills.length
        ? "Add more…"
        : "Search notes, tags, ideas…"}
      value={searchQuery}
      oninput={(e) => dispatch("search", e.target.value)}
      class="flex-1 min-w-[120px] bg-transparent text-g-text font-body text-sm font-light
        outline-none placeholder:text-g-low [&::-webkit-search-cancel-button]:hidden"
    />

    <!-- Result count + clear -->
    {#if hasAny}
      <div class="flex items-center gap-2 shrink-0 ml-auto">
        {#if isFiltered}
          <span class="text-[11px] text-g-low tabular-nums"
            >{resultCount}/{totalCount}</span
          >
        {/if}
        <button
          class="text-[11px] text-g-low hover:text-g-text px-2 py-0.5 rounded
            border border-white/[0.07] hover:border-white/20 transition-all"
          on:click={() => dispatch("clearAll")}
          aria-label="Clear all filters">Clear</button
        >
      </div>
    {/if}
  </div>

  <!-- ── Tag + Status filter chips ──────────────────────────────── -->
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <!-- Tag chips -->
    {#if allTags.length}
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

      <!-- Divider -->
      <div class="h-4 w-px bg-white/[0.08] hidden sm:block"></div>
    {/if}

    <!-- Status chips -->
    <div class="flex flex-wrap gap-1.5">
      {#each ALL_STATUSES as status}
        {@const active = selectedStatuses.includes(status)}
        <button
          class="transition-all duration-150 {active
            ? 'opacity-100'
            : 'opacity-40 hover:opacity-70'}"
          on:click={() => dispatch("statusToggle", status)}
          aria-pressed={active}
        >
          <StatusBadge {status} />
        </button>
      {/each}
    </div>
  </div>
</div>
