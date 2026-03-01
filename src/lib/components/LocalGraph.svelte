<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { ACCENT_STYLES } from "$lib/utils/tagColor";
  import type { Note, NoteSummary, Accent } from "$lib/types";

  export let note: Note;
  export let allNotes: NoteSummary[] = [];

  // ── Build local subgraph ──────────────────────────────────────────────────────

  interface LNode {
    id: string;
    title: string;
    hex: string;
    emoji: string;
    isRoot: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number | null;
    fy: number | null;
  }
  interface LLink {
    source: string | LNode;
    target: string | LNode;
  }

  // Neighbors = backlinks (incoming) + outgoing (notes whose backlinks include this slug)
  const incomingSlugs = new Set(note.backlinks.map((bl) => bl.slug));
  const outgoingSlugs = new Set(
    allNotes
      .filter(
        (n) =>
          n.slug !== note.slug &&
          n.backlinks?.some((bl) => bl.slug === note.slug),
      )
      .map((n) => n.slug),
  );
  const neighborSlugs = new Set([...incomingSlugs, ...outgoingSlugs]);

  const noteMap = new Map(allNotes.map((n) => [n.slug, n]));

  const lNodes: LNode[] = [];
  const lLinks: LLink[] = [];

  // Root node
  lNodes.push({
    id: note.slug,
    title: note.title,
    hex: ACCENT_STYLES[note.accent as Accent]?.hex ?? "#b44dff",
    emoji: note.emoji,
    isRoot: true,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null,
  });

  // Neighbor nodes + edges
  for (const slug of neighborSlugs) {
    const n = noteMap.get(slug);
    if (!n) continue;
    lNodes.push({
      id: n.slug,
      title: n.title,
      hex: ACCENT_STYLES[n.accent as Accent]?.hex ?? "#888",
      emoji: n.emoji,
      isRoot: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
    });
    lLinks.push({ source: note.slug, target: slug });
  }

  const lNodeMap = new Map(lNodes.map((n) => [n.id, n]));
  const hasConnections = lLinks.length > 0;

  // ── State ────────────────────────────────────────────────────────────────────

  let svgEl: SVGSVGElement;
  let simLinks: LLink[] = [];
  let simNodes = lNodes;
  let hoveredId: string | null = null;
  let rafId: number;
  let W = 260,
    H = 180;

  // ── Mouse ────────────────────────────────────────────────────────────────────

  function hitTest(e: MouseEvent): LNode | null {
    const r = svgEl.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best: LNode | null = null,
      bestD = Infinity;
    for (const n of simNodes) {
      const nr = n.isRoot ? 9 : 7;
      const dx = px - n.x,
        dy = py - n.y,
        d = dx * dx + dy * dy;
      if (d < (nr + 8) * (nr + 8) && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  function onMouseMove(e: MouseEvent) {
    hoveredId = hitTest(e)?.id ?? null;
  }
  function onMouseLeave() {
    hoveredId = null;
  }
  function onClick(e: MouseEvent) {
    const hit = hitTest(e);
    if (hit && !hit.isRoot) goto(`${base}/notes/${hit.id}`);
  }

  // ── D3 sim ───────────────────────────────────────────────────────────────────

  onMount(async () => {
    const d3 = await import("d3");

    W = svgEl.clientWidth || 260;
    H = svgEl.clientHeight || 180;

    const linkData: LLink[] = lLinks.map((l) => ({ ...l }));

    const sim = d3
      .forceSimulation<LNode>(lNodes)
      .force(
        "link",
        d3
          .forceLink<LNode, LLink>(linkData)
          .id((d) => d.id)
          .distance(60)
          .strength(0.8),
      )
      .force("charge", d3.forceManyBody<LNode>().strength(-120))
      .force("center", d3.forceCenter(W / 2, H / 2).strength(0.15))
      .force("collision", d3.forceCollide<LNode>().radius(18))
      .alphaDecay(0.025)
      .velocityDecay(0.45);

    sim.on("tick", () => {
      simLinks = linkData;
      simNodes = lNodes;
    });

    function loop() {
      simNodes = lNodes;
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => sim.stop();
  });

  onDestroy(() => cancelAnimationFrame(rafId));
</script>

<div
  class="rounded-[12px_10px_12px_10px/10px_12px_10px_12px] overflow-hidden
  border border-white/[0.07] bg-g-surface"
>
  <!-- Header -->
  <div
    class="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.06]"
  >
    <span class="text-[9px] uppercase tracking-[0.2em] text-g-low font-medium"
      >Local Graph</span
    >
    <a
      href="{base}/graph"
      class="text-[9px] text-g-low hover:text-g-mid transition-colors no-underline"
    >
      full graph →
    </a>
  </div>

  {#if !hasConnections}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center h-[140px] gap-2 px-4">
      <span class="text-2xl opacity-30">✦</span>
      <p class="text-[11px] text-g-low text-center leading-relaxed">
        No connections yet.<br />
        Add
        <code class="text-[10px] text-g-mid bg-g-surface2 px-1 rounded"
          >[[wikilinks]]</code
        > to connect notes.
      </p>
    </div>
  {:else}
    <!-- Graph SVG -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <svg
      bind:this={svgEl}
      class="w-full"
      style="height:180px"
      on:mousemove={onMouseMove}
      on:mouseleave={onMouseLeave}
      on:click={onClick}
      style:cursor={hoveredId && hoveredId !== note.slug
        ? "pointer"
        : "default"}
    >
      <defs>
        <radialGradient id="lg-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="transparent" />
          <stop offset="100%" stop-color="#131320" stop-opacity="0.5" />
        </radialGradient>
        <filter id="lg-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge
            ><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge
          >
        </filter>
      </defs>

      <!-- Edges -->
      {#each simLinks as link}
        {@const s = link.source}
        {@const t = link.target}
        {@const lit = hoveredId === s.id || hoveredId === t.id}
        <line
          x1={s.x ?? W / 2}
          y1={s.y ?? H / 2}
          x2={t.x ?? W / 2}
          y2={t.y ?? H / 2}
          stroke={lit
            ? (lNodeMap.get(s.isRoot ? t.id : s.id)?.hex ?? "#b44dff")
            : "rgba(255,255,255,0.2)"}
          stroke-opacity={lit ? 0.85 : 0.35}
          stroke-width={lit ? 1.5 : 0.9}
          filter={lit ? "url(#lg-glow)" : undefined}
        />
      {/each}

      <!-- Nodes -->
      {#each simNodes as n (n.id)}
        {@const r = n.isRoot ? 9 : 6}
        {@const hov = hoveredId === n.id}
        <g transform="translate({n.x ?? W / 2},{n.y ?? H / 2})">
          {#if hov || n.isRoot}
            <circle
              r={r + 5}
              fill={n.hex}
              fill-opacity="0.12"
              stroke={n.hex}
              stroke-opacity="0.3"
              stroke-width="1"
            />
          {/if}
          <circle
            {r}
            fill={n.hex}
            fill-opacity={n.isRoot ? 1 : hov ? 0.95 : 0.7}
            stroke="rgba(255,255,255,{n.isRoot ? 0.3 : 0.15})"
            stroke-width={n.isRoot ? 1.5 : 0.8}
            filter={n.isRoot ? "url(#lg-glow)" : undefined}
          />
          <!-- Emoji on root -->
          {#if n.isRoot}
            <text
              text-anchor="middle"
              dominant-baseline="central"
              font-size="8"
              style="pointer-events:none;user-select:none">{n.emoji}</text
            >
          {/if}
          <!-- Label -->
          <text
            y={r + 10}
            text-anchor="middle"
            font-size={n.isRoot ? 9 : 8}
            fill="white"
            fill-opacity={n.isRoot ? 0.85 : hov ? 0.8 : 0.45}
            style="pointer-events:none;user-select:none"
            >{n.title.length > 18 ? n.title.slice(0, 18) + "…" : n.title}</text
          >
        </g>
      {/each}

      <rect
        width="100%"
        height="100%"
        fill="url(#lg-vignette)"
        style="pointer-events:none"
      />
    </svg>
  {/if}
</div>
