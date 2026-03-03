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

  // Incoming: notes that link to this note (backlinks)
  const incomingSlugs = new Set(note.backlinks.map((bl) => bl.slug));
  // Outgoing: notes this note links to (notes whose backlinks include current slug)
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

  // ── Component state ───────────────────────────────────────────────────────────

  let container: HTMLDivElement;
  let sigmaInst: any = null;

  // ── Mount ─────────────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!browser || !hasConnections) return;

    const [{ default: Graph }, { default: Sigma }, { default: forceAtlas2 }] =
      await Promise.all([
        import("graphology"),
        import("sigma"),
        import("graphology-layout-forceatlas2"),
      ]);

    const graph = new Graph({ type: "undirected", multi: false });

    // Root node
    const rootAc = accentStyle(note.accent);
    graph.addNode(note.slug, {
      label: note.title,
      x: 0,
      y: 0,
      size: 10,
      color: rootAc.hex,
      isRoot: true,
      emoji: note.emoji,
    });

    // Neighbor nodes
    for (const slug of neighborSlugs) {
      const n = noteMap.get(slug);
      if (!n) continue;
      const ac = accentStyle(n.accent);
      graph.addNode(slug, {
        label: n.title,
        x: Math.random() * 100 - 50,
        y: Math.random() * 100 - 50,
        size: 6,
        color: ac.hex,
        isRoot: false,
        emoji: n.emoji,
      });
      graph.addEdge(note.slug, slug, {
        color: rootAc.hex + "55",
        activeColor: rootAc.hex + "bb",
        size: 0.8,
      });
    }

    // Run FA2 synchronously — small graph, no need for worker
    forceAtlas2.assign(graph, {
      iterations: 120,
      settings: {
        gravity: 2,
        scalingRatio: 1.5,
        slowDown: 5,
        adjustSizes: false,
      },
    });

    // Sigma
    let _hovered: string | null = null;

    sigmaInst = new Sigma(graph, container, {
      renderEdgeLabels: false,
      labelFont: '"Epilogue", sans-serif',
      labelColor: { color: "rgba(255,255,255,0.75)" },
      labelSize: 9,
      labelWeight: "500",
      labelRenderedSizeThreshold: -Infinity, // always show labels at this scale
      stagePadding: 20,
      minCameraRatio: 0.5,
      maxCameraRatio: 4,
      enableEdgeEvents: false,

      nodeReducer(node: string, data: any) {
        const res = { ...data };
        if (_hovered) {
          if (node === _hovered) {
            res.size = data.size * 1.6;
            res.zIndex = 10;
          } else if (graph.areNeighbors(_hovered, node)) {
            res.size = data.size * 1.2;
            res.zIndex = 5;
          } else {
            res.color = "#1e1e2e";
            res.label = "";
            res.size = data.size * 0.7;
          }
        }
        return res;
      },

      edgeReducer(edge: string, data: any) {
        const res = { ...data };
        if (_hovered && graph.hasExtremity(edge, _hovered)) {
          res.color = data.activeColor;
          res.size = 1.5;
        } else if (_hovered) {
          res.hidden = true;
        }
        return res;
      },
    });

    // Hover
    sigmaInst.on("enterNode", ({ node }: { node: string }) => {
      _hovered = node;
      sigmaInst.refresh();
    });
    sigmaInst.on("leaveNode", () => {
      _hovered = null;
      sigmaInst.refresh();
    });

    // Click neighbor → navigate
    sigmaInst.on("clickNode", ({ node }: { node: string }) => {
      if (node !== note.slug) goto(`${base}/notes/${node}`);
    });
  });

  onDestroy(() => {
    if (browser) sigmaInst?.kill();
  });
</script>

<div
  class="w-full rounded-[12px_10px_12px_10px/10px_12px_10px_12px] overflow-hidden
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
      style="width:100%;height:220px;background:#131320"
    ></div>
  {/if}
</div>
