<script lang="ts">
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { PageData } from "./$types";
  import type { NoteSummary } from "$lib/types";

  export let data: PageData;
  export let params: Record<string, string> = {};

  $: notes = (data.notes ?? []) as NoteSummary[];
  $: recentNotes = notes.slice(0, 3);
  $: noteCount = notes.length;
  $: tagCount = ((data.allTags ?? []) as string[]).length;
  $: totalLinks = notes.reduce((s, n) => s + n.links, 0);

  const FEATURES = [
    {
      emoji: "🌱",
      title: "Living notes",
      body: "Notes grow from seedling to evergreen as ideas mature. Nothing is ever truly finished.",
    },
    {
      emoji: "🔗",
      title: "Wikilinks",
      body: "Ideas connect through [[wikilinks]]. The more you link, the richer the network becomes.",
    },
    {
      emoji: "✦",
      title: "Graph view",
      body: "Explore the network of ideas visually. See clusters, hubs, and unexpected connections.",
    },
    {
      emoji: "🔮",
      title: "Always growing",
      body: "Written in Obsidian, published automatically whenever a note is saved.",
    },
  ];
</script>

<svelte:head>
  <title>Digital Garden</title>
  <meta
    name="description"
    content="A personal digital garden — living notes, connected ideas, growing thoughts."
  />
</svelte:head>

<div class="min-h-full flex flex-col">
  <!-- ── Hero ──────────────────────────────────────────────────────── -->
  <section class="px-6 md:px-14 pt-14 pb-10 md:pt-20 md:pb-14 max-w-[800px]">
    <p
      class="text-[10px] uppercase tracking-[0.3em] text-g-low font-medium mb-6 flex items-center gap-2"
    >
      <span class="inline-block w-4 h-px bg-white/20"></span>
      Digital Garden
    </p>

    <h1
      class="font-display font-black text-[clamp(40px,8vw,80px)] tracking-[-3.5px] leading-[0.92] text-g-text mb-7"
    >
      Ideas that<br />
      <em
        class="not-italic"
        style="
        background: linear-gradient(120deg, #b44dff 0%, #ff5c3a 55%, #ffb84d 100%);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"
      >
        grow.
      </em>
    </h1>

    <p
      class="text-[15px] md:text-[17px] text-g-mid font-light leading-[1.8] mb-10 max-w-[540px]"
    >
      A collection of notes, reflections, and half-formed thoughts — written in
      Obsidian, tended over time, and published here as they mature. Not a blog.
      Not a wiki. A garden.
    </p>

    <div class="flex flex-wrap gap-3">
      <a
        href="{base}/home"
        class="inline-flex items-center gap-2 px-6 py-3 font-semibold text-[13px] text-white no-underline
          bg-gradient-to-br from-[#b44dff] to-[#7c3aff]
          hover:from-[#bf5fff] hover:to-[#9148ff]
          shadow-[0_0_24px_rgba(180,77,255,0.4)] hover:shadow-[0_0_36px_rgba(180,77,255,0.6)]
          transition-all duration-200"
        style="border-radius:14px 12px 14px 12px/12px 14px 12px 14px"
      >
        Browse the garden →
      </a>
      <a
        href="{base}/graph"
        class="inline-flex items-center gap-2 px-6 py-3 font-medium text-[13px] text-g-mid no-underline
          border border-white/[0.1] bg-g-surface
          hover:text-g-text hover:border-white/25 hover:bg-g-surface2
          transition-all duration-200"
        style="border-radius:12px 14px 12px 14px/14px 12px 14px 12px"
      >
        ✦ Explore the graph
      </a>
    </div>
  </section>

  <!-- ── Stats ─────────────────────────────────────────────────────── -->
  {#if noteCount > 0}
    <section class="px-6 md:px-14 py-5 border-t border-b border-white/[0.06]">
      <div class="flex flex-wrap gap-8 md:gap-12">
        {#each [{ val: noteCount, label: "notes planted" }, { val: totalLinks, label: "connections made" }, { val: tagCount, label: "topics explored" }] as s}
          <div class="flex items-baseline gap-2.5">
            <span
              class="font-display font-black text-[clamp(24px,4vw,40px)] tracking-tight text-g-text"
              >{s.val}</span
            >
            <span class="text-[11px] text-g-low font-light">{s.label}</span>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── Recent notes ───────────────────────────────────────────────── -->
  {#if recentNotes.length}
    <section class="px-6 md:px-14 py-10">
      <div class="flex items-center justify-between mb-5">
        <p
          class="text-[9px] uppercase tracking-[0.25em] text-g-low font-medium"
        >
          Recently tended
        </p>
        <a
          href="{base}/notes"
          class="text-[11px] text-g-low hover:text-g-mid transition-colors no-underline"
          >all notes →</a
        >
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {#each recentNotes as note, i}
          {@const ac = accentStyle(note.accent)}
          <a
            href="{base}/notes/{note.slug}"
            class="group relative flex flex-col gap-2.5 p-5 no-underline
              bg-g-surface border border-white/[0.07] overflow-hidden
              hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200 {ac.hoverBorder}"
            style="border-radius:{i % 2 === 0
              ? '16px 12px 16px 14px/12px 16px 14px 16px'
              : '12px 16px 14px 16px/16px 12px 16px 14px'}"
          >
            <!-- Glow -->
            <div
              class="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 pointer-events-none"
              style="background:{ac.hex}"
            ></div>
            <!-- Tag -->
            <span
              class="inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-widest uppercase
              px-2.5 py-0.5 border self-start rounded-full {ac.text} {ac.border} {ac.bg}"
            >
              {note.emoji}
              {note.primaryTag}
            </span>
            <!-- Title -->
            <h3
              class="font-display font-bold text-[15px] leading-snug text-g-text line-clamp-2"
            >
              {note.title}
            </h3>
            <!-- Excerpt -->
            <p
              class="text-[12px] text-g-mid font-light leading-relaxed line-clamp-2 flex-1"
            >
              {note.excerpt}
            </p>
            <!-- Footer -->
            <div
              class="flex items-center justify-between pt-2.5 border-t border-white/[0.07] mt-auto"
            >
              <span class="text-[10px] text-g-low">{note.date ?? ""}</span>
              <span
                class="text-[10px] {ac.text} opacity-0 group-hover:opacity-100 transition-opacity"
                >→</span
              >
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ── How it works ──────────────────────────────────────────────── -->
  <section class="px-6 md:px-14 py-10 border-t border-white/[0.06]">
    <p
      class="text-[9px] uppercase tracking-[0.25em] text-g-low font-medium mb-7"
    >
      How this works
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {#each FEATURES as f, i}
        <div
          class="flex gap-4 p-5 bg-g-surface border border-white/[0.06]"
          style="border-radius:{i % 2 === 0
            ? '14px 10px 14px 12px/10px 14px 12px 14px'
            : '10px 14px 12px 14px/14px 10px 14px 12px'}"
        >
          <span class="text-2xl shrink-0 mt-0.5">{f.emoji}</span>
          <div>
            <h3 class="font-display font-bold text-[14px] text-g-text mb-1">
              {f.title}
            </h3>
            <p class="text-[12.5px] text-g-mid font-light leading-relaxed">
              {f.body}
            </p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Growth stages ─────────────────────────────────────────────── -->
  <section class="px-6 md:px-14 py-10 border-t border-white/[0.06]">
    <p
      class="text-[9px] uppercase tracking-[0.25em] text-g-low font-medium mb-6"
    >
      Note maturity
    </p>
    <div class="flex flex-wrap gap-3">
      {#each [{ icon: "🌱", label: "Seedling", desc: "A raw capture. Rough, unpolished, just planted." }, { icon: "🌿", label: "Budding", desc: "Being actively developed and shaped." }, { icon: "🌲", label: "Evergreen", desc: "Mature and stable. Won't change often." }, { icon: "🍂", label: "Compost", desc: "Retired or superseded. Kept for reference." }] as stage}
        <div
          class="flex items-start gap-3 px-4 py-3 bg-g-surface border border-white/[0.06] flex-1 min-w-[170px]"
          style="border-radius:12px 10px 12px 10px/10px 12px 10px 12px"
        >
          <span class="text-xl shrink-0">{stage.icon}</span>
          <div>
            <p class="text-[12px] font-semibold text-g-text mb-0.5">
              {stage.label}
            </p>
            <p class="text-[11px] text-g-low font-light leading-snug">
              {stage.desc}
            </p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ── Footer ────────────────────────────────────────────────────── -->
  <footer
    class="mt-auto px-6 md:px-14 py-5 border-t border-white/[0.06]
    flex items-center justify-between gap-4 flex-wrap"
  >
    <p class="text-[11px] text-g-low font-light">
      Written in Obsidian · Published via Cloudflare
    </p>
    <div class="flex gap-4 text-[11px] text-g-low">
      <a
        href="{base}/notes"
        class="hover:text-g-mid transition-colors no-underline">Garden</a
      >
      <a
        href="{base}/graph"
        class="hover:text-g-mid transition-colors no-underline">Graph</a
      >
    </div>
  </footer>
</div>
