<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { PageData } from "./$types";
  import type { Accent } from "$lib/types";

  export let data: PageData;

  // ── Types ────────────────────────────────────────────────────────────────────

  interface GNode {
    id: string;
    title: string;
    hex: string;
    accent: Accent;
    emoji: string;
    tag: string;
    status: string;
    degree: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx: number | null;
    fy: number | null;
  }
  interface GLink {
    source: string | GNode;
    target: string | GNode;
  }

  // ── Build graph ───────────────────────────────────────────────────────────────

  const nodes: GNode[] = data.notes.map((n) => ({
    id: n.slug,
    title: n.title,
    hex: accentStyle(n.accent)?.hex ?? "#b44dff",
    accent: n.accent as Accent,
    emoji: n.emoji,
    tag: n.primaryTag,
    status: n.status,
    degree: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null,
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build edges bidirectionally from backlinks
  const edgeSet = new Set<string>();
  const rawLinks: GLink[] = [];

  for (const note of data.notes) {
    for (const bl of note.backlinks ?? []) {
      if (!nodeMap.has(bl.slug)) continue;
      const a = note.slug < bl.slug ? note.slug : bl.slug;
      const b = note.slug < bl.slug ? bl.slug : note.slug;
      const key = `${a}|${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        rawLinks.push({ source: a, target: b });
      }
    }
  }

  // Degree from edge count
  for (const l of rawLinks) {
    const s = typeof l.source === "string" ? l.source : linkId(l.source);
    const t = typeof l.target === "string" ? l.target : linkId(l.target);
    nodeMap.get(s)!.degree++;
    nodeMap.get(t)!.degree++;
  }

  const allTags = [...new Set(nodes.map((n) => n.tag))].sort();
  const totalEdges = rawLinks.length;

  // ── Reactive state ────────────────────────────────────────────────────────────

  let svgEl: SVGSVGElement;
  let simLinks: GLink[] = [];
  let simNodes = nodes;

  let width = 900,
    height = 650;
  let tx = 0,
    ty = 0,
    scale = 1;
  let searchQuery = "";
  let highlightTag = "";
  let hoveredId: string | null = null;
  let tooltipX = 0,
    tooltipY = 0;
  let rafId: number;

  let draggingNode: GNode | null = null;
  let isPanning = false;
  let panSX = 0,
    panSY = 0,
    panOX = 0,
    panOY = 0;

  // ── Visual helpers ────────────────────────────────────────────────────────────

  function nodeRadius(n: GNode) {
    return Math.max(5, Math.min(20, 5 + Math.sqrt(n.degree) * 4));
  }

  $: neighborIds = (() => {
    if (!hoveredId) return null;
    const ids = new Set<string>([hoveredId]);
    for (const l of simLinks) {
      const s = linkId(l.source);
      const t = linkId(l.target);
      if (s === hoveredId) ids.add(t);
      if (t === hoveredId) ids.add(s);
    }
    return ids;
  })();

  $: filteredIds = (() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && !highlightTag) return null;
    return new Set(
      nodes
        .filter(
          (n) =>
            (!q || n.title.toLowerCase().includes(q) || n.tag.includes(q)) &&
            (!highlightTag || n.tag === highlightTag),
        )
        .map((n) => n.id),
    );
  })();

  function nodeOpacity(n: GNode): number {
    if (filteredIds && !filteredIds.has(n.id)) return 0.07;
    if (neighborIds && !neighborIds.has(n.id)) return 0.15;
    return 1;
  }

  function edgeOpacity(l: GLink): number {
    const s = linkId(l.source),
      t = linkId(l.target);
    if (filteredIds && (!filteredIds.has(s) || !filteredIds.has(t)))
      return 0.03;
    if (neighborIds && (!neighborIds.has(s) || !neighborIds.has(t)))
      return 0.06;
    return hoveredId ? 0.9 : 0.35;
  }

  function edgeStroke(l: GLink): string {
    if (!hoveredId || !neighborIds) return "rgba(255,255,255,0.3)";
    const s = linkId(l.source),
      t = linkId(l.target);
    if (neighborIds.has(s) && neighborIds.has(t)) {
      return nodeMap.get(s === hoveredId ? t : s)?.hex ?? "#b44dff";
    }
    return "rgba(255,255,255,0.04)";
  }

  // ── Mouse ────────────────────────────────────────────────────────────────────

  function svgPt(e: MouseEvent) {
    const r = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - tx) / scale,
      y: (e.clientY - r.top - ty) / scale,
    };
  }

  function hitTest(e: MouseEvent): GNode | null {
    const pt = svgPt(e);
    let best: GNode | null = null,
      bestD = Infinity;
    for (const n of simNodes) {
      const r = nodeRadius(n) + 7;
      const dx = pt.x - n.x,
        dy = pt.y - n.y,
        d = dx * dx + dy * dy;
      if (d < r * r && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  function onMouseMove(e: MouseEvent) {
    if (draggingNode) {
      const r = svgEl.getBoundingClientRect();
      draggingNode.fx = (e.clientX - r.left - tx) / scale;
      draggingNode.fy = (e.clientY - r.top - ty) / scale;
      return;
    }
    if (isPanning) {
      tx = panOX + (e.clientX - panSX);
      ty = panOY + (e.clientY - panSY);
      return;
    }
    const hit = hitTest(e);
    hoveredId = hit?.id ?? null;
    if (hit) {
      const r = svgEl.getBoundingClientRect();
      tooltipX = e.clientX - r.left;
      tooltipY = e.clientY - r.top;
    }
  }

  function onMouseDown(e: MouseEvent) {
    const hit = hitTest(e);
    if (hit) {
      draggingNode = hit;
      hit.fx = hit.x;
      hit.fy = hit.y;
      // Reheat so the sim reacts to the moved node
      sim?.alphaTarget(0.3).restart();
    } else {
      isPanning = true;
      panSX = e.clientX;
      panSY = e.clientY;
      panOX = tx;
      panOY = ty;
    }
  }

  function onMouseUp() {
    if (draggingNode) {
      // Let the node settle naturally after release
      sim?.alphaTarget(0);
      draggingNode.fx = null;
      draggingNode.fy = null;
      draggingNode = null;
    }
    isPanning = false;
  }

  function onClick(e: MouseEvent) {
    if (!isPanning) {
      const hit = hitTest(e);
      if (hit) goto(`${base}/notes/${hit.id}`);
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = svgEl.getBoundingClientRect();
    const mx = e.clientX - r.left,
      my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.15 : 0.87;
    const ns = Math.max(0.1, Math.min(5, scale * f));
    tx = mx - (mx - tx) * (ns / scale);
    ty = my - (my - ty) * (ns / scale);
    scale = ns;
  }

  function zoom(f: number) {
    const ns = Math.max(0.1, Math.min(5, scale * f));
    tx = width / 2 - (width / 2 - tx) * (ns / scale);
    ty = height / 2 - (height / 2 - ty) * (ns / scale);
    scale = ns;
  }

  function fitView() {
    if (!simNodes.length) return;
    const xs = simNodes.map((n) => n.x),
      ys = simNodes.map((n) => n.y);
    const mnX = Math.min(...xs),
      mxX = Math.max(...xs);
    const mnY = Math.min(...ys),
      mxY = Math.max(...ys);
    const gw = mxX - mnX || 1,
      gh = mxY - mnY || 1,
      pad = 80;
    const ns = Math.min((width - pad * 2) / gw, (height - pad * 2) / gh, 2);
    scale = ns;
    tx = width / 2 - (mnX + gw / 2) * ns;
    ty = height / 2 - (mnY + gh / 2) * ns;
  }

  // ── D3 force simulation ───────────────────────────────────────────────────────

  // Exposed at module scope so drag handlers can reheat the sim
  let sim: import("d3").Simulation<GNode, GLink> | null = null;

  // Type-safe accessors for D3 link endpoints (avoids 'as' in template)
  function linkX(endpoint: string | GNode): number {
    return (endpoint as GNode).x ?? 0;
  }
  function linkY(endpoint: string | GNode): number {
    return (endpoint as GNode).y ?? 0;
  }
  function linkId(endpoint: string | GNode): string {
    return typeof endpoint === "string" ? endpoint : endpoint.id;
  }

  onMount(async () => {
    const d3 = await import("d3");

    const readSize = () => {
      width = svgEl.clientWidth || 900;
      height = svgEl.clientHeight || 650;
    };

    const ro = new ResizeObserver(() => {
      readSize();
      sim?.force(
        "center",
        d3.forceCenter(width / 2, height / 2).strength(0.12),
      );
      sim?.alpha(0.3).restart();
    });
    ro.observe(svgEl);

    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    readSize();

    const linkData: GLink[] = rawLinks.map((l) => ({ ...l }));

    sim = d3
      .forceSimulation<GNode>(nodes)
      // Edge spring — pulls linked nodes toward each other
      .force(
        "link",
        d3
          .forceLink<GNode, GLink>(linkData)
          .id((d) => d.id)
          .distance(80)
          .strength(0.6),
      )
      // Repulsion — keeps nodes apart but bounded so they can't flee
      .force(
        "charge",
        d3
          .forceManyBody<GNode>()
          .strength((d) => -100 - d.degree * 15)
          .distanceMin(15)
          .distanceMax(250),
      )
      // Central gravity — strong enough to counter repulsion
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.12))
      // Radial tether — isolated (unlinked) nodes orbit near center
      .force(
        "radial",
        d3
          .forceRadial<GNode>(
            (d) => (d.degree === 0 ? 80 : 0),
            width / 2,
            height / 2,
          )
          .strength((d) => (d.degree === 0 ? 0.1 : 0)),
      )
      // Collision — prevent overlap
      .force(
        "collision",
        d3
          .forceCollide<GNode>()
          .radius((d) => nodeRadius(d) + 8)
          .strength(0.85),
      )
      .alphaDecay(0.015) // slower cool-down → more time to settle nicely
      .velocityDecay(0.38);

    sim.on("tick", () => {
      simLinks = linkData;
      simNodes = nodes;
    });

    let fitted = false;
    sim.on("end", () => {
      if (!fitted) {
        fitted = true;
        fitView();
      }
    });

    function loop() {
      simNodes = nodes;
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      sim?.stop();
    };
  });

  onDestroy(() => cancelAnimationFrame(rafId));
</script>

<svelte:head><title>Graph · Digital Garden</title></svelte:head>

<div class="fixed inset-0 z-50 flex flex-col" style="background:#0d0d14">
  <!-- Topbar -->
  <header
    class="shrink-0 flex items-center gap-3 h-[52px] px-4 border-b border-white/[0.06] z-20"
    style="background:rgba(13,13,20,0.92);backdrop-filter:blur(12px)"
  >
    <a
      href="{base}/"
      class="flex items-center gap-1.5 text-[11px] font-medium text-white/50 no-underline
        px-3 py-1.5 rounded-full border border-white/[0.08]
        hover:text-white/80 hover:border-white/20 transition-all"
    >
      ← Garden
    </a>

    <div class="relative">
      <span
        class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[13px] pointer-events-none"
        >⌕</span
      >
      <input
        type="search"
        placeholder="Search nodes…"
        bind:value={searchQuery}
        class="w-44 bg-white/[0.05] border border-white/[0.08] text-white/80 text-[12px]
          pl-8 pr-3 py-1.5 rounded-full outline-none transition-all
          focus:border-white/25 focus:bg-white/[0.07] placeholder:text-white/25
          [&::-webkit-search-cancel-button]:hidden"
      />
    </div>

    <div
      class="hidden sm:flex items-center gap-4 ml-auto text-[11px] text-white/30 font-light"
    >
      <span>{nodes.length} notes</span>
      <span class={totalEdges === 0 ? "text-amber-400/50" : ""}
        >{totalEdges} connections</span
      >
      {#if totalEdges === 0}
        <span class="text-[10px] text-amber-400/50 italic"
          >— add [[wikilinks]] to see connections</span
        >
      {/if}
    </div>

    <div
      class="flex items-center gap-1.5 {totalEdges === 0
        ? ''
        : 'ml-auto sm:ml-0'}"
    >
      <button
        on:click={fitView}
        class="text-[11px] text-white/40 hover:text-white/75 px-3 py-1.5 rounded-full
          border border-white/[0.07] hover:border-white/20 transition-all"
        >Fit</button
      >
      <button
        on:click={() => zoom(1.25)}
        class="w-7 h-7 text-sm font-bold text-white/40 hover:text-white/75 flex items-center justify-center
          rounded-full border border-white/[0.07] hover:border-white/20 transition-all"
        >+</button
      >
      <button
        on:click={() => zoom(0.8)}
        class="w-7 h-7 text-sm font-bold text-white/40 hover:text-white/75 flex items-center justify-center
          rounded-full border border-white/[0.07] hover:border-white/20 transition-all"
        >−</button
      >
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <!-- SVG canvas -->
    <div class="relative flex-1">
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        bind:this={svgEl}
        class="w-full h-full"
        style="cursor:{draggingNode
          ? 'grabbing'
          : hoveredId
            ? 'pointer'
            : 'grab'}"
        on:mousemove={onMouseMove}
        on:mousedown={onMouseDown}
        on:mouseup={onMouseUp}
        on:click={onClick}
        on:wheel|preventDefault={onWheel}
        on:mouseleave={() => {
          hoveredId = null;
          onMouseUp();
        }}
      >
        <defs>
          <pattern
            id="dot-grid"
            x="0"
            y="0"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="0.5" cy="0.5" r="0.7" fill="rgba(255,255,255,0.08)" />
          </pattern>
          <filter id="glow-node" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge
              ><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge
            >
          </filter>
          <filter id="glow-edge" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge
              ><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge
            >
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stop-color="transparent" />
            <stop offset="100%" stop-color="#0d0d14" stop-opacity="0.7" />
          </radialGradient>
        </defs>

        <!-- Dot grid (fixed to viewport, not transformed) -->
        <rect width="100%" height="100%" fill="url(#dot-grid)" />

        <!-- Pan+zoom group -->
        <g transform="translate({tx},{ty}) scale({scale})">
          <!-- Edges -->
          {#each simLinks as link}
            {@const sx = linkX(link.source)}
            {@const sy = linkY(link.source)}
            {@const tx2 = linkX(link.target)}
            {@const ty2 = linkY(link.target)}
            {@const op = edgeOpacity(link)}
            {@const col = edgeStroke(link)}
            {@const lit = op > 0.5}
            <line
              x1={sx}
              y1={sy}
              x2={tx2}
              y2={ty2}
              stroke={col}
              stroke-opacity={op}
              stroke-width={lit ? 2 : 1}
              filter={lit ? "url(#glow-edge)" : undefined}
            />
          {/each}

          <!-- Nodes -->
          {#each simNodes as node (node.id)}
            {@const r = nodeRadius(node)}
            {@const op = nodeOpacity(node)}
            {@const hov = hoveredId === node.id}
            {@const nb = !!neighborIds?.has(node.id) && !hov}
            <g
              transform="translate({node.x ?? 0},{node.y ?? 0})"
              opacity={op}
              style="transition:opacity 0.12s"
            >
              <!-- Glow halo on hover -->
              {#if hov}
                <circle
                  r={r + 12}
                  fill={node.hex}
                  fill-opacity="0.1"
                  stroke={node.hex}
                  stroke-opacity="0.2"
                  stroke-width="1.5"
                />
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={node.hex}
                  stroke-opacity="0.45"
                  stroke-width="1.2"
                  filter="url(#glow-node)"
                />
              {:else if nb}
                <circle
                  r={r + 5}
                  fill={node.hex}
                  fill-opacity="0.08"
                  stroke={node.hex}
                  stroke-opacity="0.2"
                  stroke-width="0.8"
                />
              {/if}

              <!-- Main circle -->
              <circle
                {r}
                fill={node.hex}
                fill-opacity={hov ? 1 : nb ? 0.9 : 0.72}
                stroke="rgba(255,255,255,{hov ? 0.35 : 0.18})"
                stroke-width={hov ? 1.5 : 0.7}
                filter={hov ? "url(#glow-node)" : undefined}
              />

              <!-- Emoji (only when big enough) -->
              {#if r >= 9 || hov}
                <text
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size={Math.min(r * 0.95, 13)}
                  style="pointer-events:none;user-select:none"
                  >{node.emoji}</text
                >
              {/if}

              <!-- Label -->
              <text
                y={r + (scale > 0.8 ? 13 : 10)}
                text-anchor="middle"
                fill="white"
                fill-opacity={hov
                  ? 1
                  : nb
                    ? 0.75
                    : op < 0.3
                      ? 0
                      : scale < 0.35
                        ? 0
                        : scale < 0.6
                          ? 0.4
                          : 0.55}
                font-size={Math.max(8, Math.min(12, 10 / scale))}
                style="pointer-events:none;user-select:none;transition:fill-opacity 0.12s"
                >{node.title.length > 28
                  ? node.title.slice(0, 28) + "…"
                  : node.title}</text
              >
            </g>
          {/each}
        </g>

        <!-- Vignette overlay -->
        <rect
          width="100%"
          height="100%"
          fill="url(#vignette)"
          style="pointer-events:none"
        />
      </svg>

      <!-- Tooltip -->
      {#if hoveredId}
        {@const n = nodeMap.get(hoveredId)}
        {#if n}
          <div
            class="absolute z-30 pointer-events-none"
            style="left:{Math.min(
              tooltipX + 18,
              (width || 800) - 230,
            )}px;top:{Math.max(8, tooltipY - 96)}px"
          >
            <div
              class="w-[215px] rounded-xl border border-white/[0.1] shadow-2xl overflow-hidden"
              style="background:rgba(16,16,26,0.97)"
            >
              <div
                class="h-[3px]"
                style="background:linear-gradient(90deg,{n.hex},{n.hex}88)"
              ></div>
              <div class="px-4 py-3">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-base">{n.emoji}</span>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-widest"
                    style="color:{n.hex}">{n.tag}</span
                  >
                  <span class="ml-auto text-sm">
                    {n.status === "seedling"
                      ? "🌱"
                      : n.status === "budding"
                        ? "🌿"
                        : n.status === "evergreen"
                          ? "🌲"
                          : "🍂"}
                  </span>
                </div>
                <p class="text-[13.5px] font-bold text-white leading-snug mb-2">
                  {n.title}
                </p>
                {#if n.degree > 0}
                  <p class="text-[11px] text-white/45">
                    {n.degree} connection{n.degree > 1 ? "s" : ""}
                  </p>
                {:else}
                  <p class="text-[11px] text-white/25 italic">No connections</p>
                {/if}
                <p
                  class="text-[10px] text-white/20 mt-2 border-t border-white/[0.06] pt-2"
                >
                  Click to open · Drag to reposition
                </p>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      <!-- Hint -->
      <p
        class="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-white/18 pointer-events-none whitespace-nowrap"
      >
        Scroll to zoom · Drag background to pan · Drag nodes to rearrange
      </p>
    </div>

    <!-- Tag sidebar -->
    <aside
      class="hidden lg:flex flex-col w-[165px] shrink-0 border-l border-white/[0.06]
      overflow-y-auto py-4 px-2.5 gap-0.5"
      style="background:rgba(13,13,20,0.85)"
    >
      <p
        class="text-[9px] uppercase tracking-[0.2em] text-white/30 px-2 pb-2 font-medium"
      >
        Tags
      </p>

      <button
        class="flex items-center gap-2 px-2 py-1.5 text-[11px] rounded-lg text-left
          transition-all border"
        style={!highlightTag
          ? "color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12)"
          : "color:rgba(255,255,255,0.35);border-color:transparent"}
        on:click={() => (highlightTag = "")}
      >
        <span class="text-xs">🌿</span>
        <span>All</span>
        <span class="ml-auto text-[10px] opacity-50">{nodes.length}</span>
      </button>

      {#each allTags as tag}
        {@const sample = nodes.find((n) => n.tag === tag)}
        {@const hex = sample?.hex ?? "#b44dff"}
        {@const emoji = sample?.emoji ?? "·"}
        {@const count = nodes.filter((n) => n.tag === tag).length}
        {@const active = highlightTag === tag}
        <button
          class="flex items-center gap-2 px-2 py-1.5 text-[11px] capitalize rounded-lg
            text-left transition-all border"
          style={active
            ? `color:${hex};background:${hex}1a;border-color:${hex}35`
            : "color:rgba(255,255,255,0.38);border-color:transparent"}
          on:click={() => (highlightTag = active ? "" : tag)}
        >
          <span class="text-xs">{emoji}</span>
          <span class="truncate">{tag}</span>
          <span class="ml-auto text-[10px] opacity-45">{count}</span>
        </button>
      {/each}

      <!-- Node size legend -->
      <div class="mt-auto pt-4 border-t border-white/[0.05] space-y-2.5 px-2">
        <p
          class="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium"
        >
          Node size
        </p>
        <div class="flex items-end justify-between">
          {#each [[0, "Solo"], [3, "Linked"], [7, "Hub"]] as [deg, lbl]}
            {@const r = Math.max(5, Math.min(20, 5 + Math.sqrt(deg) * 4))}
            <div class="flex flex-col items-center gap-1.5">
              <svg width={r * 2 + 2} height={r * 2 + 2}>
                <circle
                  cx={r + 1}
                  cy={r + 1}
                  {r}
                  fill="#b44dff"
                  fill-opacity="0.65"
                />
              </svg>
              <span class="text-[8px] text-white/25">{lbl}</span>
            </div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
</div>
