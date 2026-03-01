<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { ACCENT_STYLES } from "$lib/utils/tagColor";
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
    source: GNode;
    target: GNode;
  }

  // ── Build graph data ─────────────────────────────────────────────────────────

  // Use `let` so Svelte can track reassignments for reactivity
  let nodes: GNode[] = data.notes.map((n) => ({
    id: n.slug,
    title: n.title,
    hex: ACCENT_STYLES[n.accent as Accent]?.hex ?? "#b44dff",
    accent: n.accent as Accent,
    emoji: n.emoji,
    tag: n.primaryTag,
    status: n.status,
    degree: n.links + (n.backlinks?.length ?? 0),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null,
  }));

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const linkSet = new Set<string>();
  const links: GLink[] = [];
  for (const note of data.notes) {
    for (const bl of note.backlinks ?? []) {
      const a = note.slug < bl.slug ? note.slug : bl.slug;
      const b = note.slug < bl.slug ? bl.slug : note.slug;
      const key = `${a}→${b}`;
      if (!linkSet.has(key) && nodeMap.has(a) && nodeMap.has(b)) {
        linkSet.add(key);
        links.push({ source: nodeMap.get(a)!, target: nodeMap.get(b)! });
      }
    }
  }

  const allTags = [...new Set(nodes.map((n) => n.tag))].sort();

  // ── State ────────────────────────────────────────────────────────────────────

  let svgEl: SVGSVGElement;
  let width = 800;
  let height = 600;
  let searchQuery = "";
  let highlightTag = "";
  let hoveredNode: GNode | null = null;
  let tooltipX = 0,
    tooltipY = 0;
  let tx = 0,
    ty = 0,
    scale = 1;
  let draggingNode: GNode | null = null;
  let isPanning = false;
  let panStartX = 0,
    panStartY = 0,
    panOriginTx = 0,
    panOriginTy = 0;
  let rafId: number;

  // ── Simulation constants ─────────────────────────────────────────────────────

  const REPULSION = 3500;
  const SPRING_LEN = 130;
  const SPRING_K = 0.04;
  const CENTER_K = 0.01;
  const DAMPING = 0.82;
  const SUBSTEPS = 3;

  function nodeRadius(n: GNode) {
    return Math.max(7, Math.min(22, 7 + n.degree * 2.2));
  }

  function initPositions() {
    const r = Math.min(width, height) * 0.32;
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2;
      n.x = width / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 60;
      n.y = height / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 60;
      n.vx = 0;
      n.vy = 0;
    });
  }

  function simStep() {
    for (let iter = 0; iter < SUBSTEPS; iter++) {
      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (a.fx !== null) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x || 0.01;
          const dy = a.y - b.y || 0.01;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2) || 0.1;
          const f = REPULSION / d2;
          const fx = (dx / d) * f,
            fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          if (b.fx === null) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }
      // Spring
      for (const link of links) {
        const a = link.source,
          b = link.target;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const f = (d - SPRING_LEN) * SPRING_K;
        const fx = (dx / d) * f,
          fy = (dy / d) * f;
        if (a.fx === null) {
          a.vx += fx;
          a.vy += fy;
        }
        if (b.fx === null) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      // Center gravity
      const cx = width / 2,
        cy = height / 2;
      for (const n of nodes) {
        if (n.fx !== null) continue;
        n.vx += (cx - n.x) * CENTER_K;
        n.vy += (cy - n.y) * CENTER_K;
      }
      // Integrate
      for (const n of nodes) {
        if (n.fx !== null) {
          n.x = n.fx;
          n.y = n.fy!;
          continue;
        }
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
      }
    }
  }

  // ── Reactive filter ──────────────────────────────────────────────────────────

  $: activeNodeIds = (() => {
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

  function nodeOpacity(n: GNode) {
    return !activeNodeIds || activeNodeIds.has(n.id) ? 1 : 0.1;
  }
  function linkOpacity(l: GLink) {
    if (!activeNodeIds) return 0.3;
    return activeNodeIds.has(l.source.id) && activeNodeIds.has(l.target.id)
      ? 0.5
      : 0.04;
  }

  // ── Mouse interaction ────────────────────────────────────────────────────────

  function svgPoint(e: MouseEvent) {
    const r = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - tx) / scale,
      y: (e.clientY - r.top - ty) / scale,
    };
  }

  function hitTest(e: MouseEvent): GNode | null {
    const pt = svgPoint(e);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i],
        r = nodeRadius(n) + 5;
      const dx = pt.x - n.x,
        dy = pt.y - n.y;
      if (dx * dx + dy * dy < r * r) return n;
    }
    return null;
  }

  function onMouseMove(e: MouseEvent) {
    if (draggingNode) {
      const r = svgEl.getBoundingClientRect();
      draggingNode.fx = (e.clientX - r.left - tx) / scale;
      draggingNode.fy = (e.clientY - r.top - ty) / scale;
      draggingNode.x = draggingNode.fx;
      draggingNode.y = draggingNode.fy;
      return;
    }
    if (isPanning) {
      tx = panOriginTx + (e.clientX - panStartX);
      ty = panOriginTy + (e.clientY - panStartY);
      return;
    }
    const hit = hitTest(e);
    hoveredNode = hit;
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
    } else {
      isPanning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      panOriginTx = tx;
      panOriginTy = ty;
    }
  }

  function onMouseUp() {
    if (draggingNode) {
      draggingNode.fx = null;
      draggingNode.fy = null;
      draggingNode = null;
    }
    isPanning = false;
  }

  function onClick(e: MouseEvent) {
    const hit = hitTest(e);
    if (hit) goto(`${base}/notes/${hit.id}`);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const r = svgEl.getBoundingClientRect();
    const mx = e.clientX - r.left,
      my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    const ns = Math.max(0.2, Math.min(4, scale * f));
    tx = mx - (mx - tx) * (ns / scale);
    ty = my - (my - ty) * (ns / scale);
    scale = ns;
  }

  function zoom(factor: number) {
    const cx = width / 2,
      cy = height / 2;
    const ns = Math.max(0.2, Math.min(4, scale * factor));
    tx = cx - (cx - tx) * (ns / scale);
    ty = cy - (cy - ty) * (ns / scale);
    scale = ns;
  }

  function resetView() {
    tx = 0;
    ty = 0;
    scale = 1;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  onMount(() => {
    const readSize = () => {
      width = svgEl.clientWidth || svgEl.getBoundingClientRect().width || 800;
      height =
        svgEl.clientHeight || svgEl.getBoundingClientRect().height || 600;
    };

    // Wait TWO frames: first for the DOM to paint, second for layout to settle
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        readSize();
        initPositions();

        let frame = 0;
        const ACTIVE = 180; // frames to run hot simulation

        function loop() {
          if (frame < ACTIVE) {
            simStep();
            frame++;
            // KEY FIX: reassigning `nodes` tells Svelte to re-render.
            // The array is the same reference but Svelte re-reads all node.x/y.
            nodes = nodes;
          }
          rafId = requestAnimationFrame(loop);
        }

        rafId = requestAnimationFrame(loop);
      });
    });

    const ro = new ResizeObserver(() => {
      readSize();
    });
    ro.observe(svgEl);
    return () => ro.disconnect();
  });

  onDestroy(() => cancelAnimationFrame(rafId));
</script>

<svelte:head><title>Graph · Digital Garden</title></svelte:head>

<div class="fixed inset-0 z-50 flex flex-col" style="background:#080810">
  <!-- Topbar -->
  <header
    class="flex items-center gap-3 h-[58px] px-5 border-b border-white/[0.07]
    bg-black/60 backdrop-blur-xl shrink-0 z-10"
  >
    <a
      href="{base}/"
      class="flex items-center gap-2 text-[12px] text-g-mid no-underline px-3 py-1.5
        border border-white/[0.07] bg-white/[0.04]
        hover:text-g-text hover:border-white/20 transition-all"
      style="border-radius:50px 48px 50px 48px/48px 50px 48px 50px">← Garden</a
    >

    <div class="relative max-w-xs flex-1">
      <span
        class="absolute left-3 top-1/2 -translate-y-1/2 text-g-low pointer-events-none"
        >⌕</span
      >
      <input
        type="search"
        placeholder="Search nodes…"
        bind:value={searchQuery}
        class="w-full bg-white/[0.04] border border-white/[0.07] text-g-text text-[13px]
          pl-8 pr-3 py-1.5 outline-none [&::-webkit-search-cancel-button]:hidden
          focus:border-[rgba(180,77,255,0.4)] transition-all"
        style="border-radius:48px 50px 50px 48px/50px 48px 50px 50px"
      />
    </div>

    <div
      class="hidden sm:flex items-center gap-4 ml-auto text-[11px] text-g-low font-light"
    >
      <span>{nodes.length} notes</span>
      <span>{links.length} connections</span>
    </div>

    <button
      class="text-[11px] text-g-low hover:text-g-mid px-3 py-1.5 border border-white/[0.07]
        hover:border-white/20 transition-all"
      style="border-radius:50px 48px 50px 48px/48px 50px 48px 50px"
      on:click={resetView}>⊹ Reset</button
    >
  </header>

  <!-- Canvas -->
  <div class="flex flex-1 overflow-hidden">
    <div class="relative flex-1">
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <svg
        bind:this={svgEl}
        class="w-full h-full select-none"
        style="cursor:{draggingNode
          ? 'grabbing'
          : hoveredNode
            ? 'pointer'
            : 'grab'}"
        on:mousemove={onMouseMove}
        on:mousedown={onMouseDown}
        on:mouseup={onMouseUp}
        on:click={onClick}
        on:wheel|preventDefault={onWheel}
        on:mouseleave={() => {
          hoveredNode = null;
          isPanning = false;
          onMouseUp();
        }}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge
              ><feMergeNode in="blur" /><feMergeNode
                in="SourceGraphic"
              /></feMerge
            >
          </filter>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="transparent" />
            <stop offset="100%" stop-color="#080810" stop-opacity="0.7" />
          </radialGradient>
        </defs>

        <g transform="translate({tx},{ty}) scale({scale})">
          <!-- Edges -->
          {#each links as link}
            <line
              x1={link.source.x}
              y1={link.source.y}
              x2={link.target.x}
              y2={link.target.y}
              stroke="white"
              stroke-opacity={linkOpacity(link)}
              stroke-width={scale < 0.5 ? 0.8 : 1.2}
            />
          {/each}

          <!-- Nodes -->
          {#each nodes as node (node.id)}
            {@const r = nodeRadius(node)}
            {@const hov = hoveredNode?.id === node.id}
            <g
              transform="translate({node.x},{node.y})"
              opacity={nodeOpacity(node)}
              style="transition:opacity 0.2s"
            >
              {#if hov}
                <circle
                  r={r + 8}
                  fill="none"
                  stroke={node.hex}
                  stroke-width="1.5"
                  stroke-opacity="0.45"
                  filter="url(#glow)"
                />
              {/if}
              <circle
                {r}
                fill={node.hex}
                fill-opacity={hov ? 1 : 0.82}
                stroke={hov ? "#fff" : node.hex}
                stroke-width={hov ? 1.5 : 0.6}
                stroke-opacity={hov ? 0.4 : 0.25}
              />
              {#if scale > 0.65 || hov}
                <text
                  text-anchor="middle"
                  dominant-baseline="central"
                  font-size={Math.max(8, r * 0.85)}
                  style="pointer-events:none;user-select:none"
                  >{node.emoji}</text
                >
              {/if}
              {#if scale > 1.05 || (hov && scale > 0.45)}
                <text
                  y={r + 12}
                  text-anchor="middle"
                  font-size={Math.min(11, 9 / scale)}
                  fill="rgba(255,255,255,0.8)"
                  style="pointer-events:none;user-select:none"
                  >{node.title.length > 24
                    ? node.title.slice(0, 24) + "…"
                    : node.title}</text
                >
              {/if}
            </g>
          {/each}
        </g>

        <rect
          width="100%"
          height="100%"
          fill="url(#vignette)"
          style="pointer-events:none"
        />
      </svg>

      <!-- Tooltip -->
      {#if hoveredNode}
        {@const n = hoveredNode}
        <div
          class="absolute z-20 pointer-events-none max-w-[220px]
          bg-[#13131f] border border-white/[0.13] px-3.5 py-2.5 shadow-2xl"
          style="border-radius:14px 12px 14px 12px/12px 14px 12px 14px;
            left:{Math.min(tooltipX + 14, (width || 800) - 240)}px;
            top:{Math.max(10, tooltipY - 80)}px"
        >
          <div class="flex items-center gap-2 mb-1">
            <span>{n.emoji}</span>
            <span
              class="text-[10px] font-semibold uppercase tracking-widest"
              style="color:{n.hex}">{n.tag}</span
            >
            <span class="ml-auto text-[10px]">
              {n.status === "seedling"
                ? "🌱"
                : n.status === "budding"
                  ? "🌿"
                  : n.status === "evergreen"
                    ? "🌲"
                    : "🍂"}
            </span>
          </div>
          <p class="text-[13px] font-bold text-white leading-snug">{n.title}</p>
          {#if n.degree > 0}
            <p class="text-[10px] text-g-low mt-1">
              {n.degree} connection{n.degree > 1 ? "s" : ""}
            </p>
          {/if}
          <p class="text-[10px] text-g-low/50 mt-1.5 italic">Click to open</p>
        </div>
      {/if}

      <!-- Zoom controls -->
      <div class="absolute bottom-6 right-6 flex flex-col gap-1.5">
        {#each [["+", 1.25], ["−", 0.8]] as [label, f]}
          <button
            class="w-8 h-8 text-sm font-bold text-g-mid bg-white/[0.05] border border-white/[0.1]
              hover:text-g-text hover:bg-white/[0.08] transition-all flex items-center justify-center"
            style="border-radius:10px 8px 10px 8px/8px 10px 8px 10px"
            on:click={() => zoom(f)}>{label}</button
          >
        {/each}
        <button
          class="w-8 h-8 text-[10px] text-g-low bg-white/[0.05] border border-white/[0.1]
            hover:text-g-mid hover:bg-white/[0.08] transition-all flex items-center justify-center"
          style="border-radius:10px 8px 10px 8px/8px 10px 8px 10px"
          on:click={resetView}
          title="Reset zoom">⊹</button
        >
      </div>

      <p
        class="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-white/25 pointer-events-none"
      >
        Scroll to zoom · Drag to pan · Click node to open
      </p>
    </div>

    <!-- Tag legend -->
    <aside
      class="hidden lg:flex flex-col w-[180px] shrink-0 border-l border-white/[0.07]
      overflow-y-auto py-4 px-3 gap-0.5"
      style="background:rgba(255,255,255,0.02)"
    >
      <p
        class="text-[9px] uppercase tracking-[0.22em] text-g-low px-2 mb-2 font-medium"
      >
        Tags
      </p>

      <button
        class="flex items-center gap-2 px-2 py-1.5 text-[12px] text-left transition-all
          border border-transparent rounded-[8px_6px_8px_6px/6px_8px_6px_8px]
          {!highlightTag
          ? 'text-g-text bg-white/[0.06] border-white/[0.07]'
          : 'text-g-low hover:text-g-mid'}"
        on:click={() => (highlightTag = "")}
      >
        <span class="text-xs">🌿</span>
        <span>All</span>
        <span class="ml-auto text-[10px] text-g-low">{nodes.length}</span>
      </button>

      {#each allTags as tag}
        {@const sampleNode = nodes.find((n) => n.tag === tag)}
        {@const hex = sampleNode?.hex ?? "#b44dff"}
        {@const emoji = sampleNode?.emoji ?? "·"}
        {@const count = nodes.filter((n) => n.tag === tag).length}
        {@const active = highlightTag === tag}
        <button
          class="flex items-center gap-2 px-2 py-1.5 text-[12px] capitalize text-left
            rounded-[8px_6px_8px_6px/6px_8px_6px_8px] transition-all border border-transparent
            {active ? '' : 'text-g-low hover:text-g-mid'}"
          style={active
            ? `color:${hex};background:${hex}18;border-color:${hex}30`
            : ""}
          on:click={() => (highlightTag = active ? "" : tag)}
        >
          <span class="text-xs">{emoji}</span>
          <span class="truncate">{tag}</span>
          <span class="ml-auto text-[10px] opacity-50">{count}</span>
        </button>
      {/each}

      <!-- Size legend -->
      <div class="mt-auto pt-4 border-t border-white/[0.07]">
        <p
          class="text-[9px] uppercase tracking-[0.22em] text-g-low px-2 mb-3 font-medium"
        >
          Node size
        </p>
        <div class="flex items-end gap-3 px-2">
          {#each [[1, "Few"], [4, "Some"], [8, "Many"]] as [deg, label]}
            {@const r = Math.max(7, Math.min(22, 7 + deg * 2.2))}
            <div class="flex flex-col items-center gap-1.5">
              <svg width={r * 2 + 2} height={r * 2 + 2}>
                <circle
                  cx={r + 1}
                  cy={r + 1}
                  {r}
                  fill="#b44dff"
                  fill-opacity="0.75"
                />
              </svg>
              <span class="text-[9px] text-g-low">{label}</span>
            </div>
          {/each}
        </div>
      </div>
    </aside>
  </div>
</div>
