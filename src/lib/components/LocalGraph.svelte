<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { Note, NoteSummary } from "$lib/types";

  export let note: Note;
  export let allNotes: NoteSummary[] = [];

  // ── Build local subgraph ──────────────────────────────────────────────────────

  const incomingSlugs = new Set(note.backlinks.map((bl) => bl.slug));
  const outgoingSlugs = new Set(
    allNotes
      .filter(
        (n) =>
          n.slug !== note.slug &&
          (n.backlinks ?? []).some((bl) => bl.slug === note.slug),
      )
      .map((n) => n.slug),
  );
  const neighborSlugs = new Set([...incomingSlugs, ...outgoingSlugs]);
  const hasConnections = neighborSlugs.size > 0;
  const noteMap = new Map(allNotes.map((n) => [n.slug, n]));

  let container: HTMLDivElement;
  let sigmaInst: any = null;

  onMount(async () => {
    if (!browser || !hasConnections) return;

    const [{ default: Graph }, { default: Sigma }, { default: forceAtlas2 }] =
      await Promise.all([
        import("graphology"),
        import("sigma"),
        import("graphology-layout-forceatlas2"),
      ]);

    const graph = new Graph({ type: "undirected", multi: false });
    const rootAc = accentStyle(note.accent);

    // Root node
    graph.addNode(note.slug, {
      label: note.title,
      x: 0,
      y: 0,
      size: 11,
      color: rootAc.hex,
      activeColor: rootAc.hex,
      isRoot: true,
    });

    // Neighbor nodes
    for (const slug of neighborSlugs) {
      const n = noteMap.get(slug);
      if (!n) continue;
      const ac = accentStyle(n.accent);
      // Spread on a circle around root
      const angle = (graph.order / neighborSlugs.size) * 2 * Math.PI;
      graph.addNode(slug, {
        label: n.title,
        x: Math.cos(angle) * 60,
        y: Math.sin(angle) * 60,
        size: 7,
        color: ac.hex,
        activeColor: ac.hex,
        isRoot: false,
      });
      graph.addEdge(note.slug, slug, {
        color: rootAc.hex + "44",
        activeColor: rootAc.hex + "cc",
        size: 1,
      });
    }

    // Synchronous FA2 — small graph, instant
    forceAtlas2.assign(graph, {
      iterations: 150,
      settings: {
        gravity: 2,
        scalingRatio: 2,
        slowDown: 8,
        adjustSizes: false,
      },
    });

    let _hovered: string | null = null;

    sigmaInst = new Sigma(graph, container, {
      renderEdgeLabels: false,
      labelFont: '"Epilogue", sans-serif',
      labelColor: { color: "rgba(255,255,255,0.7)" },
      labelSize: 9,
      labelWeight: "500",
      labelRenderedSizeThreshold: -Infinity,
      stagePadding: 16,
      minCameraRatio: 0.5,
      maxCameraRatio: 4,
      enableEdgeEvents: false,

      nodeReducer(node: string, data: any) {
        const res = { ...data };
        if (_hovered) {
          if (node === _hovered) {
            res.size = data.size * 1.6;
            res.color = data.activeColor; // keep accent color, just bigger
            res.zIndex = 10;
          } else if (graph.areNeighbors(_hovered, node)) {
            res.size = data.size * 1.2;
            res.zIndex = 5;
          } else {
            res.color = "rgba(255,255,255,0.06)";
            res.label = "";
            res.size = data.size * 0.65;
          }
        }
        return res;
      },

      edgeReducer(edge: string, data: any) {
        const res = { ...data };
        if (_hovered) {
          if (graph.hasExtremity(edge, _hovered)) {
            res.color = data.activeColor;
            res.size = 2;
          } else {
            res.color = "rgba(255,255,255,0.04)";
            res.size = 0.5;
          }
        }
        return res;
      },
    });

    sigmaInst.on("enterNode", ({ node }: { node: string }) => {
      _hovered = node;
      container.style.cursor = graph.getNodeAttribute(node, "isRoot")
        ? "default"
        : "pointer";
      sigmaInst.refresh();
    });
    sigmaInst.on("leaveNode", () => {
      _hovered = null;
      container.style.cursor = "default";
      sigmaInst.refresh();
    });

    // Click neighbor → navigate (root node does nothing)
    let hasDragged = false;
    sigmaInst.getMouseCaptor().on("mousemovebody", () => {
      hasDragged = true;
    });
    sigmaInst.on("downNode", () => {
      hasDragged = false;
    });
    sigmaInst.on("clickNode", ({ node }: { node: string }) => {
      if (hasDragged) return;
      if (!graph.getNodeAttribute(node, "isRoot"))
        goto(`${base}/notes/${node}`);
    });

    return () => sigmaInst?.kill();
  });

  onDestroy(() => {
    if (browser) sigmaInst?.kill();
  });
</script>

<div
  class="w-full rounded-[12px_10px_12px_10px/10px_12px_10px_12px] overflow-hidden
  border border-white/[0.07] bg-g-surface"
>
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
    <div class="flex flex-col items-center justify-center h-[200px] gap-2 px-4">
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
    <div
      bind:this={container}
      style="width:100%;height:220px;background:transparent"
    ></div>
  {/if}
</div>
