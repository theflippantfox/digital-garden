<script lang="ts">
  import { base } from "$app/paths";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import LocalGraph from "$lib/components/LocalGraph.svelte";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { PageData } from "./$types";
  import type { Accent } from "$lib/types";

  export let data: PageData;

  $: note = data.note;
  $: accent = accentStyle(note.accent);
  // Layout data (all notes) is merged from parent loader
  $: allNotes = (data as any).notes ?? [];

  const BADGE_SHAPES: Record<Accent, string> = {
    violet: "50px 48px 50px 48px / 48px 50px 48px 50px",
    coral: "48px 50px 48px 50px / 50px 48px 50px 48px",
    cyan: "50px 50px 48px 50px / 48px 50px 50px 48px",
    lime: "48px 50px 50px 48px / 50px 48px 48px 50px",
    amber: "50px 48px 52px 48px / 48px 52px 48px 50px",
    rose: "48px 52px 48px 52px / 52px 48px 52px 48px",
    sky: "50px 48px 50px 50px / 48px 50px 52px 48px",
    emerald: "52px 48px 50px 50px / 48px 50px 48px 52px",
    indigo: "48px 50px 52px 48px / 50px 48px 50px 52px",
    orange: "50px 52px 48px 50px / 52px 48px 50px 52px",
  };

  const CHIP_SHAPES = [
    "14px 12px 14px 12px / 12px 14px 12px 14px",
    "12px 14px 12px 14px / 14px 12px 14px 12px",
  ];
</script>

<svelte:head>
  <title>{note.title} · Digital Garden</title>
  <meta name="description" content={note.excerpt} />
</svelte:head>

<!-- Two-column on xl+, single column below -->
<div class="flex gap-0 lg:gap-0 min-h-full">
  <!-- ── Main article ───────────────────────────────────────────── -->
  <article class="flex-1 min-w-0 py-8 md:py-12">
    <div class="max-w-[680px] mx-auto px-5 md:px-10">
      <!-- Back -->
      <a
        href="{base}/notes"
        class="inline-flex items-center gap-2 text-[12px] text-g-mid font-body font-light
        px-4 py-2 mb-8 border border-white/[0.07] bg-g-surface no-underline
        hover:text-[#b44dff] hover:border-[rgba(180,77,255,0.35)] hover:bg-[rgba(180,77,255,0.1)]
        transition-all duration-150"
        style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
        >← back to garden</a
      >

      <!-- Tag + status + date row -->
      <div class="flex flex-wrap items-center gap-2.5 mb-5">
        <span
          class="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase
          px-3.5 py-1.5 border {accent.text} {accent.border} {accent.bg}"
          style:border-radius={BADGE_SHAPES[note.accent] ?? BADGE_SHAPES.violet}
        >
          <span aria-hidden="true">{note.emoji}</span>
          {note.primaryTag}
        </span>

        <StatusBadge status={note.status} size="md" />

        {#if note.date}
          <time
            class="text-[11.5px] text-g-low font-light"
            datetime={note.dateRaw ?? undefined}
          >
            {note.date}
          </time>
        {/if}
      </div>

      <!-- Title -->
      <h1
        class="font-display font-black text-[clamp(26px,5vw,46px)] tracking-[-1.5px] leading-[1.05] text-g-text mb-6"
      >
        {note.title}
      </h1>

      <!-- Tags -->
      {#if note.tags.length > 1}
        <div class="flex flex-wrap gap-1.5 mb-8">
          {#each note.tags as tag}
            <a
              href="{base}/notes?tag={encodeURIComponent(tag)}"
              class="text-[10px] font-medium text-g-low border border-white/[0.07]
              px-2.5 py-0.5 hover:text-g-mid hover:border-white/20 transition-colors no-underline capitalize"
              style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
              >#{tag}</a
            >
          {/each}
        </div>
      {/if}

      <hr class="border-none h-px bg-white/[0.07] mb-8" />

      <!-- Prose body -->
      <div
        class="prose prose-garden prose-invert max-w-none
      prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight
      prose-h2:text-[clamp(18px,3vw,23px)] prose-h2:mt-10 prose-h2:mb-4
      prose-h3:text-[17px] prose-h3:mt-7 prose-h3:mb-3
      prose-p:font-light prose-p:leading-[1.85] prose-p:text-g-mid prose-p:text-[14.5px]
      prose-li:text-g-mid prose-li:font-light
      prose-pre:text-[13px] prose-pre:leading-relaxed
    "
      >
        {@html note.html}
      </div>

      <!-- Backlinks (mobile / tablet only — hidden on xl where right panel shows them) -->
      {#if note.backlinks?.length}
        <section class="mt-14 lg:hidden" aria-label="Backlinks">
          <h2
            class="text-[9.5px] uppercase tracking-[0.25em] text-g-low mb-4
          flex items-center gap-3 font-body font-medium
          after:content-[''] after:flex-1 after:h-px after:bg-white/[0.07]"
          >
            Backlinks ({note.backlinks.length})
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {#each note.backlinks as bl, i}
              <a
                href="{base}/notes/{bl.slug}"
                class="flex items-center gap-2.5 px-4 py-3
                bg-g-surface border border-white/[0.07] text-g-mid text-[12.5px] font-light
                hover:border-[rgba(180,77,255,0.35)] hover:text-[#b44dff]
                transition-all duration-150 no-underline"
                style:border-radius={CHIP_SHAPES[i % CHIP_SHAPES.length]}
              >
                <span aria-hidden="true" class="text-sm">{bl.emoji}</span>
                <span class="truncate">{bl.title}</span>
                <span
                  class="ml-auto text-g-low text-[10px] shrink-0"
                  aria-hidden="true">→</span
                >
              </a>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Bottom padding -->
      <div class="h-16"></div>
    </div>
  </article>

  <!-- ── Right panel (xl+ only) ─────────────────────────────────── -->
  <aside
    class="hidden lg:flex flex-col gap-5 w-[240px] shrink-0 pt-[60px]
    border-l border-white/[0.05] px-4"
  >
    <!-- Sticky wrapper -->
    <div class="sticky top-4 flex flex-col gap-5 w-full">
      <!-- Local graph -->
      {#key note.slug}
        <LocalGraph {note} {allNotes} />
      {/key}

      <!-- Backlinks -->
      {#if note.backlinks?.length}
        <div
          class="w-full rounded-[12px_10px_12px_10px/10px_12px_10px_12px] overflow-hidden
          border border-white/[0.07] bg-g-surface"
        >
          <div class="px-3.5 py-2.5 border-b border-white/[0.06]">
            <span
              class="text-[9px] uppercase tracking-[0.2em] text-g-low font-medium"
            >
              Backlinks · {note.backlinks.length}
            </span>
          </div>

          <div class="p-2 flex flex-col gap-1">
            {#each note.backlinks as bl}
              <a
                href="{base}/notes/{bl.slug}"
                class="flex items-center gap-2.5 px-3 py-2 rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
                  text-g-low text-[12px] font-light no-underline
                  hover:bg-g-surface2 hover:text-g-text
                  transition-all duration-150 border border-transparent hover:border-white/[0.06]"
              >
                <span class="text-sm shrink-0" aria-hidden="true"
                  >{bl.emoji}</span
                >
                <span class="truncate">{bl.title}</span>
                <span class="ml-auto text-[10px] text-g-low shrink-0">→</span>
              </a>
            {/each}
          </div>
        </div>
      {:else}
        <!-- No backlinks state -->
        <div
          class="rounded-[12px_10px_12px_10px/10px_12px_10px_12px]
          border border-white/[0.05] bg-g-surface/50 px-4 py-5 text-center"
        >
          <p class="text-[11px] text-g-low/60 leading-relaxed">
            No notes link here yet.
          </p>
        </div>
      {/if}
    </div>
  </aside>
</div>
