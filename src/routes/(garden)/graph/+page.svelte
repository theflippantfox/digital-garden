<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { PageData } from "./$types";
  import type { NoteSummary } from "$lib/types";

  export let data: PageData;

  // ── Data ─────────────────────────────────────────────────────────────────────

  $: notes = (data.notes ?? []) as NoteSummary[];
  $: allTags = [...new Set(notes.map((n) => n.primaryTag))].sort();

  function nodeSize(degree: number) {
    return Math.max(4, Math.min(20, 4 + Math.sqrt(degree) * 3.5));
  }

  // ── Svelte UI state ──────────────────────────────────────────────────────────

  let sigmaContainer: HTMLDivElement;
  let searchQuery = "";
  let highlightTag = "";
  let showPhysics = false;
  let isRunning = true;

  let gravity = 1;
  let scalingRatio = 2;
  let slowDown = 5;

  let hoveredId: string | null = null;
  let mouseX = 0,
    mouseY = 0;

  // ── Sigma closure state (non-reactive) ───────────────────────────────────────

  let sigmaInst: any = null;
  let graphInst: any = null;
  let fa2Inst: any = null;

  let _hovered: string | null = null;
  let _neighbors: Set<string> = new Set();
  let _search = "";
  let _tag = "";

  $: if (sigmaInst) {
    _search = searchQuery;
    _tag = highlightTag;
    sigmaInst.refresh();
  }

  // ── Physics ──────────────────────────────────────────────────────────────────

  async function applyPhysics() {
    if (!graphInst) return;
    fa2Inst?.kill();
    const { default: FA2Layout } = await import(
      "graphology-layout-forceatlas2/worker"
    );
    fa2Inst = new FA2Layout(graphInst, {
      settings: {
        gravity,
        scalingRatio,
        slowDown,
        barnesHutOptimize: graphInst.order > 100,
        adjustSizes: false,
      },
    });
    if (isRunning) fa2Inst.start();
  }

  function toggleLayout() {
    isRunning = !isRunning;
    if (!fa2Inst) return;
    if (isRunning) fa2Inst.start();
    else fa2Inst.stop();
  }

  function fitView() {
    sigmaInst?.getCamera().animatedReset({ duration: 400 });
  }
  function zoomIn() {
    sigmaInst?.getCamera().animatedZoom({ duration: 200 });
  }
  function zoomOut() {
    sigmaInst?.getCamera().animatedUnzoom({ duration: 200 });
  }

  // ── Mount ────────────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!browser) return;

    const [
      { default: Graph },
      { default: Sigma },
      { default: forceAtlas2 },
      { default: FA2Layout },
    ] = await Promise.all([
      import("graphology"),
      import("sigma"),
      import("graphology-layout-forceatlas2"),
      import("graphology-layout-forceatlas2/worker"),
    ]);

    graphInst = new Graph({ type: "undirected", multi: false });

    const noteList = (data.notes ?? []) as NoteSummary[];
    const slugSet = new Set(noteList.map((n) => n.slug));

    // Nodes
    noteList.forEach((note, i) => {
      const ac = accentStyle(note.accent);
      const angle = (i / noteList.length) * 2 * Math.PI;
      graphInst.addNode(note.slug, {
        label: note.title,
        x: Math.cos(angle) * 200,
        y: Math.sin(angle) * 200,
        size: nodeSize(0),
        color: ac.hex,
        activeColor: ac.hex,
        tag: note.primaryTag,
        status: note.status,
        emoji: note.emoji,
        degree: 0,
      });
    });

    // Edges
    const edgeSeen = new Set<string>();
    for (const note of noteList) {
      for (const bl of note.backlinks ?? []) {
        if (!slugSet.has(bl.slug)) continue;
        const key = [note.slug, bl.slug].sort().join("||");
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        const ac = accentStyle(note.accent);
        graphInst.addEdgeWithKey(key, note.slug, bl.slug, {
          color: ac.hex + "44",
          activeColor: ac.hex + "cc",
          size: 0.8,
        });
        graphInst.setNodeAttribute(
          note.slug,
          "degree",
          graphInst.getNodeAttribute(note.slug, "degree") + 1,
        );
        graphInst.setNodeAttribute(
          bl.slug,
          "degree",
          graphInst.getNodeAttribute(bl.slug, "degree") + 1,
        );
      }
    }

    // Resize nodes by actual degree
    graphInst.forEachNode((node: string) => {
      graphInst.setNodeAttribute(
        node,
        "size",
        nodeSize(graphInst.getNodeAttribute(node, "degree")),
      );
    });

    // Sync FA2 initial layout
    forceAtlas2.assign(graphInst, {
      iterations: 200,
      settings: {
        gravity: 1,
        scalingRatio: 2,
        slowDown: 10,
        barnesHutOptimize: graphInst.order > 100,
        adjustSizes: false,
      },
    });

    // Sigma
    sigmaInst = new Sigma(graphInst, sigmaContainer, {
      renderEdgeLabels: false,
      labelFont: '"Epilogue", sans-serif',
      labelColor: { color: "rgba(255,255,255,0.8)" },
      labelSize: 11,
      labelWeight: "500",
      labelRenderedSizeThreshold: 3,
      stagePadding: 60,
      minCameraRatio: 0.03,
      maxCameraRatio: 25,
      enableEdgeEvents: false,

      nodeReducer(node: string, data: any) {
        const res = { ...data };
        if (_hovered) {
          if (node === _hovered) {
            res.size = data.size * 1.7;
            res.zIndex = 10;
          } else if (_neighbors.has(node)) {
            res.size = data.size * 1.2;
            res.zIndex = 5;
          } else {
            res.color = "#1e1e2e";
            res.label = "";
            res.size = data.size * 0.6;
          }
        }
        if (_search) {
          const q = _search.toLowerCase();
          const hit =
            (data.label ?? "").toLowerCase().includes(q) ||
            (data.tag ?? "").toLowerCase().includes(q);
          if (!hit) {
            res.color = "#18182a";
            res.label = "";
            res.size = data.size * 0.4;
          } else {
            res.highlighted = true;
            res.zIndex = (res.zIndex ?? 0) + 5;
          }
        }
        if (_tag && data.tag !== _tag) {
          res.color = "#18182a";
          res.label = "";
          res.size = data.size * 0.5;
        }
        return res;
      },

      edgeReducer(edge: string, data: any) {
        const res = { ...data };
        if (_hovered) {
          if (graphInst.hasExtremity(edge, _hovered)) {
            res.color = data.activeColor;
            res.size = 2;
          } else res.hidden = true;
        }
        if (_search || _tag) {
          const [s, t] = graphInst.extremities(edge);
          const sl = (
            graphInst.getNodeAttribute(s, "label") ?? ""
          ).toLowerCase();
          const tl = (
            graphInst.getNodeAttribute(t, "label") ?? ""
          ).toLowerCase();
          const sg = graphInst.getNodeAttribute(s, "tag") ?? "";
          const tg = graphInst.getNodeAttribute(t, "tag") ?? "";
          if (
            _search &&
            !sl.includes(_search.toLowerCase()) &&
            !tl.includes(_search.toLowerCase())
          )
            res.hidden = true;
          if (_tag && sg !== _tag && tg !== _tag) res.hidden = true;
        }
        return res;
      },
    });

    // Events
    sigmaInst.on("enterNode", ({ node }: { node: string }) => {
      _hovered = node;
      _neighbors = new Set(graphInst.neighbors(node));
      hoveredId = node;
      sigmaInst.refresh();
    });
    sigmaInst.on("leaveNode", () => {
      _hovered = null;
      _neighbors.clear();
      hoveredId = null;
      sigmaInst.refresh();
    });
    sigmaInst.on("clickNode", ({ node }: { node: string }) =>
      goto(`${base}/notes/${node}`),
    );

    // Drag
    let dragNode: string | null = null;
    let dragging = false;
    sigmaInst.on("downNode", (e: any) => {
      dragging = true;
      dragNode = e.node;
      e.event.preventSigmaDefault();
      e.event.original?.preventDefault();
    });
    sigmaInst.getMouseCaptor().on("mousemovebody", (e: any) => {
      mouseX = e.x ?? 0;
      mouseY = e.y ?? 0;
      if (!dragging || !dragNode) return;
      const pos = sigmaInst.viewportToGraph(e);
      graphInst.setNodeAttribute(dragNode, "x", pos.x);
      graphInst.setNodeAttribute(dragNode, "y", pos.y);
      e.preventSigmaDefault();
      e.original?.preventDefault();
      e.original?.stopPropagation();
    });
    const stopDrag = () => {
      dragging = false;
      dragNode = null;
    };
    sigmaInst.getMouseCaptor().on("mouseup", stopDrag);
    sigmaInst.getMouseCaptor().on("mouseleave", stopDrag);

    // FA2 worker
    fa2Inst = new FA2Layout(graphInst, {
      settings: {
        gravity,
        scalingRatio,
        slowDown,
        barnesHutOptimize: graphInst.order > 100,
        adjustSizes: false,
      },
    });
    fa2Inst.start();
  });

  onDestroy(() => {
    if (!browser) return;
    fa2Inst?.kill();
    sigmaInst?.kill();
  });

  $: hoveredNote = hoveredId ? notes.find((n) => n.slug === hoveredId) : null;
  $: totalEdges = (() => {
    const slugSet = new Set(notes.map((n) => n.slug));
    const seen = new Set<string>();
    let count = 0;
    for (const note of notes) {
      for (const bl of note.backlinks ?? []) {
        if (!slugSet.has(bl.slug)) continue;
        const key = [note.slug, bl.slug].sort().join("||");
        if (!seen.has(key)) {
          seen.add(key);
          count++;
        }
      }
    }
    return count;
  })();
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
        hover:text-white/80 hover:border-white/20 transition-all">← Garden</a
    >

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
      class="hidden sm:flex items-center gap-4 text-[11px] text-white/30 font-light"
    >
      <span>{notes.length} notes</span>
      <span class={totalEdges === 0 ? "text-amber-400/50" : ""}
        >{totalEdges} connections</span
      >
    </div>

    <div class="ml-auto flex items-center gap-1.5">
      <button
        on:click={() => (showPhysics = !showPhysics)}
        class="text-[11px] px-3 py-1.5 rounded-full border transition-all
          {showPhysics
          ? 'text-[#b44dff] border-[rgba(180,77,255,0.4)] bg-[rgba(180,77,255,0.1)]'
          : 'text-white/40 border-white/[0.07] hover:text-white/70 hover:border-white/20'}"
        >Physics</button
      >

      <button
        on:click={toggleLayout}
        title={isRunning ? "Pause" : "Resume"}
        class="w-7 h-7 flex items-center justify-center rounded-full border text-[10px] transition-all
          {isRunning
          ? 'text-[#b44dff] border-[rgba(180,77,255,0.35)] bg-[rgba(180,77,255,0.08)]'
          : 'text-white/30 border-white/[0.07] hover:text-white/60'}"
        >{isRunning ? "⏸" : "▶"}</button
      >

      <button
        on:click={fitView}
        class="text-[11px] text-white/40 hover:text-white/75 px-3 py-1.5 rounded-full
          border border-white/[0.07] hover:border-white/20 transition-all"
        >Fit</button
      >
      <button
        on:click={zoomIn}
        class="w-7 h-7 text-sm font-bold text-white/40 hover:text-white/75 flex items-center justify-center
          rounded-full border border-white/[0.07] hover:border-white/20 transition-all"
        >+</button
      >
      <button
        on:click={zoomOut}
        class="w-7 h-7 text-sm font-bold text-white/40 hover:text-white/75 flex items-center justify-center
          rounded-full border border-white/[0.07] hover:border-white/20 transition-all"
        >−</button
      >
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden relative">
    <!-- Graph area -->
    <div class="relative flex-1">
      <!-- Dot grid -->
      <div
        class="absolute inset-0 z-0"
        style="
        background:#0d0d14;
        background-image:radial-gradient(circle,rgba(255,255,255,0.08) 1px,transparent 1px);
        background-size:28px 28px;
      "
      ></div>

      <!-- Sigma container -->
      <div bind:this={sigmaContainer} class="absolute inset-0 z-10"></div>

      <!-- Vignette (pointer-events:none passes through to sigma) -->
      <div
        class="absolute inset-0 z-20 pointer-events-none"
        style="
        background:radial-gradient(ellipse at center,transparent 45%,rgba(13,13,20,0.75) 100%);
      "
      ></div>

      <!-- Tooltip -->
      {#if hoveredNote}
        {@const ac = accentStyle(hoveredNote.accent)}
        <div
          class="absolute z-30 pointer-events-none"
          style="left:{Math.min(mouseX + 20, 860)}px;top:{Math.max(
            8,
            mouseY - 110,
          )}px"
        >
          <div
            class="w-[215px] rounded-xl border border-white/[0.1] shadow-2xl overflow-hidden"
            style="background:rgba(14,14,22,0.98)"
          >
            <div
              class="h-[3px]"
              style="background:linear-gradient(90deg,{ac.hex},{ac.hex}66)"
            ></div>
            <div class="px-4 py-3">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-base">{hoveredNote.emoji}</span>
                <span
                  class="text-[10px] font-semibold uppercase tracking-widest"
                  style="color:{ac.hex}">{hoveredNote.primaryTag}</span
                >
                <span class="ml-auto text-sm">
                  {hoveredNote.status === "seedling"
                    ? "🌱"
                    : hoveredNote.status === "budding"
                      ? "🌿"
                      : hoveredNote.status === "evergreen"
                        ? "🌲"
                        : "🍂"}
                </span>
              </div>
              <p class="text-[13.5px] font-bold text-white leading-snug mb-2">
                {hoveredNote.title}
              </p>
              {#if (hoveredNote.backlinks?.length ?? 0) > 0}
                <p class="text-[11px] text-white/45">
                  {hoveredNote.backlinks.length} connection{hoveredNote
                    .backlinks.length !== 1
                    ? "s"
                    : ""}
                </p>
              {:else}
                <p class="text-[11px] text-white/25 italic">
                  No connections yet
                </p>
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

      <!-- Hint -->
      <p
        class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-[10px] text-white/20 pointer-events-none whitespace-nowrap"
      >
        Scroll to zoom · Drag background to pan · Drag nodes to rearrange
      </p>

      <!-- Physics panel -->
      {#if showPhysics}
        <div
          class="absolute top-4 right-4 z-40 w-[220px] rounded-xl border border-white/[0.1] overflow-hidden shadow-2xl"
          style="background:rgba(14,14,22,0.97)"
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
          >
            <span
              class="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium"
              >Physics</span
            >
            <button
              on:click={() => (showPhysics = false)}
              class="text-white/30 hover:text-white/70 text-[18px] leading-none transition-colors"
              >×</button
            >
          </div>
          <div class="px-4 py-4 space-y-5">
            <div>
              <div class="flex justify-between mb-1.5">
                <label class="text-[11px] text-white/55">Gravity</label>
                <span class="text-[11px] text-white/35 tabular-nums"
                  >{gravity}</span
                >
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                bind:value={gravity}
                on:change={applyPhysics}
                class="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/10
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[#b44dff] [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div>
              <div class="flex justify-between mb-1.5">
                <label class="text-[11px] text-white/55">Repulsion</label>
                <span class="text-[11px] text-white/35 tabular-nums"
                  >{scalingRatio}</span
                >
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                bind:value={scalingRatio}
                on:change={applyPhysics}
                class="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/10
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[#b44dff] [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <div>
              <div class="flex justify-between mb-1.5">
                <label class="text-[11px] text-white/55">Slow down</label>
                <span class="text-[11px] text-white/35 tabular-nums"
                  >{slowDown}</span
                >
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                bind:value={slowDown}
                on:change={applyPhysics}
                class="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/10
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-[#b44dff] [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <button
              on:click={() => {
                gravity = 1;
                scalingRatio = 2;
                slowDown = 5;
                applyPhysics();
              }}
              class="w-full text-[11px] text-white/35 hover:text-white/65 py-1.5 rounded-lg
                border border-white/[0.07] hover:border-white/15 transition-all"
            >
              Reset defaults
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Tag sidebar -->
    <aside
      class="hidden lg:flex flex-col w-[165px] shrink-0 border-l border-white/[0.06]
      overflow-y-auto py-4 px-2.5 gap-0.5 z-10"
      style="background:rgba(13,13,20,0.85)"
    >
      <p
        class="text-[9px] uppercase tracking-[0.2em] text-white/30 px-2 pb-2 font-medium"
      >
        Tags
      </p>

      <button
        class="flex items-center gap-2 px-2 py-1.5 text-[11px] rounded-lg text-left transition-all border"
        style={!highlightTag
          ? "color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12)"
          : "color:rgba(255,255,255,0.35);border-color:transparent"}
        on:click={() => (highlightTag = "")}
      >
        <span class="text-xs">🌿</span><span>All</span>
        <span class="ml-auto text-[10px] opacity-50">{notes.length}</span>
      </button>

      {#each allTags as tag}
        {@const sample = notes.find((n) => n.primaryTag === tag)}
        {@const hex = accentStyle(sample?.accent ?? "violet").hex}
        {@const count = notes.filter((n) => n.primaryTag === tag).length}
        {@const active = highlightTag === tag}
        <button
          class="flex items-center gap-2 px-2 py-1.5 text-[11px] capitalize rounded-lg text-left transition-all border"
          style={active
            ? `color:${hex};background:${hex}1a;border-color:${hex}35`
            : "color:rgba(255,255,255,0.38);border-color:transparent"}
          on:click={() => (highlightTag = active ? "" : tag)}
        >
          <span class="text-xs">{sample?.emoji ?? "·"}</span>
          <span class="truncate">{tag}</span>
          <span class="ml-auto text-[10px] opacity-45">{count}</span>
        </button>
      {/each}

      <!-- Legend -->
      <div class="mt-auto pt-4 border-t border-white/[0.05] space-y-2.5 px-2">
        <p
          class="text-[9px] uppercase tracking-[0.2em] text-white/30 font-medium"
        >
          Node size
        </p>
        <div class="flex items-end justify-between">
          {#each [[0, "Solo"], [4, "Linked"], [10, "Hub"]] as [deg, lbl]}
            {@const r = nodeSize(deg)}
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
