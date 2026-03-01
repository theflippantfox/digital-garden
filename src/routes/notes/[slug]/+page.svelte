<script lang="ts">
  import { base } from '$app/paths';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import { ACCENT_STYLES } from '$lib/utils/tagColor';
  import type { PageData } from './$types';
  import type { Accent } from '$lib/types';

  export let data: PageData;

  $: note   = data.note;
  $: accent = ACCENT_STYLES[note.accent];

  // Pebble-pill badge shape
  const BADGE_SHAPES: Record<Accent, string> = {
    violet: '50px 48px 50px 48px / 48px 50px 48px 50px',
    coral:  '48px 50px 48px 50px / 50px 48px 50px 48px',
    cyan:   '50px 50px 48px 50px / 48px 50px 50px 48px',
    lime:   '48px 50px 50px 48px / 50px 48px 48px 50px',
  };

  const CHIP_SHAPES = [
    '14px 12px 14px 12px / 12px 14px 12px 14px',
    '12px 14px 12px 14px / 14px 12px 14px 12px',
  ];
</script>

<svelte:head>
  <title>{note.title} · Digital Garden</title>
  <meta name="description" content={note.excerpt} />
</svelte:head>

<article class="max-w-[720px] px-5 md:px-10 py-8 md:py-12">

  <!-- Back -->
  <a
    href="{base}/"
    class="inline-flex items-center gap-2 text-[12px] text-g-mid font-body font-light
      px-4 py-2 mb-8 border border-white/[0.07] bg-g-surface no-underline
      hover:text-[#b44dff] hover:border-[rgba(180,77,255,0.35)] hover:bg-[rgba(180,77,255,0.1)]
      transition-all duration-150"
    style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
  >← back to garden</a>

  <!-- Meta row: tag badge + status + date -->
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
      <time class="text-[11.5px] text-g-low font-light" datetime={note.dateRaw ?? undefined}>
        {note.date}
      </time>
    {/if}
  </div>

  <!-- Title only — no description/excerpt -->
  <h1 class="font-display font-black text-[clamp(26px,5vw,46px)] tracking-[-1.5px] leading-[1.05] text-g-text mb-6">
    {note.title}
  </h1>

  <!-- All tags -->
  {#if note.tags.length > 1}
    <div class="flex flex-wrap gap-1.5 mb-8">
      {#each note.tags as tag}
        <a
          href="{base}/?tag={encodeURIComponent(tag)}"
          class="text-[10px] font-medium text-g-low border border-white/[0.07]
            px-2.5 py-0.5 hover:text-g-mid hover:border-white/20 transition-colors no-underline capitalize"
          style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
        >#{tag}</a>
      {/each}
    </div>
  {/if}

  <hr class="border-none h-px bg-white/[0.07] mb-8" />

  <!-- Rendered markdown body -->
  <div class="prose prose-garden prose-invert max-w-none
    prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight
    prose-h2:text-[clamp(18px,3vw,23px)] prose-h2:mt-10 prose-h2:mb-4
    prose-h3:text-[17px] prose-h3:mt-7 prose-h3:mb-3
    prose-p:font-light prose-p:leading-[1.85] prose-p:text-g-mid prose-p:text-[14.5px]
    prose-li:text-g-mid prose-li:font-light
    prose-pre:text-[13px] prose-pre:leading-relaxed
  ">
    {@html note.html}
  </div>

  <!-- Backlinks -->
  {#if note.backlinks?.length}
    <section class="mt-14" aria-label="Backlinks">
      <h2 class="text-[9.5px] uppercase tracking-[0.25em] text-g-low mb-4
        flex items-center gap-3 font-body font-medium after:content-[''] after:flex-1 after:h-px after:bg-white/[0.07]">
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
            <span class="ml-auto text-g-low text-[10px] shrink-0" aria-hidden="true">→</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

</article>
