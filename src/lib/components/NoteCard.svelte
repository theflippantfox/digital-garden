<script lang="ts">
  import { base } from "$app/paths";
  import StatusBadge from "./StatusBadge.svelte";
  import { ACCENT_STYLES } from "$lib/utils/tagColor";
  import type { NoteSummary } from "$lib/types";

  export let note: NoteSummary;
  export let index: number = 0;

  // Pebble-corner shapes — reads as a card, just gently worn
  const SHAPES = [
    "18px 14px 18px 16px / 16px 18px 14px 18px",
    "14px 18px 16px 18px / 18px 14px 18px 16px",
    "16px 16px 18px 14px / 14px 16px 16px 18px",
    "18px 14px 14px 18px / 16px 18px 16px 14px",
    "14px 18px 18px 14px / 18px 14px 14px 18px",
    "16px 18px 14px 16px / 18px 16px 18px 14px",
  ];

  $: shape = SHAPES[index % SHAPES.length];
  $: accent = ACCENT_STYLES[note.accent];

  // NOTE: No animation-delay to avoid blank-space flicker in the grid.
  // The parent grid fades in as a whole instead.
</script>

<a
  href="{base}/notes/{note.slug}"
  class="group block bg-g-surface border border-white/[0.07] p-5
    transition-all duration-200 ease-out no-underline
    hover:-translate-y-1 hover:shadow-xl
    {accent.hoverBorder}
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b44dff]/50"
  style:border-radius={shape}
  aria-label="Open note: {note.title}"
>
  <!-- Corner glow orb -->
  <div
    class="absolute -top-5 -right-5 w-20 h-20 rounded-full opacity-20 blur-2xl pointer-events-none"
    style="background:{accent.hex}"
    aria-hidden="true"
  ></div>

  <!-- Tag pill -->
  <div class="mb-3">
    <span
      class="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase
        px-3 py-1 border {accent.text} {accent.border} {accent.bg}"
      style="border-radius: 50px 48px 50px 48px / 48px 50px 48px 50px"
    >
      <span aria-hidden="true">{note.emoji}</span>
      {note.primaryTag}
    </span>
  </div>

  <!-- Title -->
  <h2
    class="font-display font-bold text-[17px] leading-snug tracking-tight text-g-text mb-2.5 line-clamp-2"
  >
    {note.title}
  </h2>

  <!-- Excerpt -->
  <p
    class="text-[12.5px] text-g-mid font-light leading-relaxed line-clamp-3 mb-4"
  >
    {note.excerpt}
  </p>

  <!-- Footer -->
  <footer
    class="flex items-center justify-between pt-3 border-t border-white/[0.07] mt-auto"
  >
    <div class="flex items-center gap-2">
      <StatusBadge status={note.status} />
    </div>
    <div class="flex items-center gap-3 text-[11px] text-g-low font-light">
      {#if note.date}
        <time datetime={note.dateRaw ?? undefined}>{note.date}</time>
      {/if}
      {#if note.links > 0}
        <span class="flex items-center gap-1">
          <span class="opacity-50">🔗</span>{note.links}
        </span>
      {/if}
    </div>
  </footer>
</a>

<style>
  a {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
