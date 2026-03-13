<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { accentStyle } from "$lib/utils/tagColor";
  import type { PageData } from "./$types";
  import type { NoteSummary } from "$lib/types";

  export let data: PageData;

  $: notes = (data.notes ?? []) as NoteSummary[];
  $: allTags = [...new Set(notes.map((n) => n.primaryTag))].sort();

  // Obsidian uses very small nodes — base 2.5 px, +0.6 px per link, max 10 px.
  // Hubs are visibly larger but the scale is subtle, not dramatic.
  function nodeSize(degree: number): number {
    return Math.min(2.5 + degree * 0.6, 10);
  }

  // ─── UI state ─────────────────────────────────────────────────────────────────

  let sigmaContainer: HTMLDivElement;
  let searchQuery = "";
  let activeTags = new Set<string>();
  let showOrphans = true;
  let showPhysics = false;
  let isRunning = true;
  let focusDepth = 2;

  // ── Physics parameters (exposed to panel sliders) ─────────────────────────────
  // Center gravity: base spring pulling every node toward origin.
  // Degree scale: multiplier on gravity per link  →  hubs get sucked in, orphans float out.
  // Repulsion: charge between every pair of nodes.
  // Link strength / distance: edge-spring stiffness and rest length.
  // Damping: velocity decay per tick (< 1 = dissipation).
  // Orphan ring: target orbit radius for degree-0 nodes.
  let pCenterGravity = 0.008; // much stronger inward pull → tight central ball
  let pDegreeGravScale = 0.02; // moderate degree bonus — hubs go deeper but not extreme
  let pRepelStrength = 380; // lower repulsion → nodes pack densely like Obsidian
  let pLinkStrength = 0.22; // stiffer edge springs → tight dandelion clusters
  let pLinkDistance = 30; // shorter rest length → compact branch clusters
  let pDamping = 0.86; // slightly higher → settles faster, less bounce
  let pOrphanRing = 420; // larger ring → orphans clearly outside the main blob

  let hoveredId: string | null = null;
  let selectedId: string | null = null;
  let mouseX = 0,
    mouseY = 0;

  type CtxMenu = { x: number; y: number; node: string };
  let contextMenu: CtxMenu | null = null;
  let pinnedNodes = new Set<string>();
  let selectedConnections: NoteSummary[] = [];

  // ─── Sigma / graph refs ───────────────────────────────────────────────────────

  let sigmaInst: any = null;
  let graphInst: any = null;

  // Mutable closure state used inside Sigma reducers
  let _hovered: string | null = null;
  let _selected: string | null = null;
  let _hoverNeighbors = new Set<string>();
  let _selectedNeighborMap = new Map<string, number>();
  let _pinnedNodes = new Set<string>();
  let _activeTags = new Set<string>();
  let _showOrphans = true;
  let _search = "";

  // ─── Physics engine ───────────────────────────────────────────────────────────

  interface PhysNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    degree: number;
    fixed: boolean;
  }

  let physNodes: PhysNode[] = [];
  let physEdges: [number, number][] = []; // index-pairs into physNodes
  let nodeIndexMap = new Map<string, number>();
  let rafId: number | null = null;
  let _tickCount = 0;

  function physTick() {
    if (!isRunning || !sigmaInst) return;
    rafId = requestAnimationFrame(physTick);
    _tickCount++;

    const n = physNodes.length;
    const maxRepelDist = 220; // range cutoff for O(n²) repulsion — skips distant pairs

    // ── 1. Gravity (degree-weighted) + orphan outward spring ──────────────────
    for (let i = 0; i < n; i++) {
      const nd = physNodes[i];
      if (nd.fixed) continue;

      // Hubs: strong inward pull.  Orphans: near-zero pull → drift outward.
      const grav = pCenterGravity * (1 + nd.degree * pDegreeGravScale);
      nd.vx -= nd.x * grav;
      nd.vy -= nd.y * grav;

      // Orphan ring: push degree-0 nodes toward pOrphanRing (forceRadial-style)
      if (nd.degree === 0) {
        const r = Math.sqrt(nd.x * nd.x + nd.y * nd.y) || 1;
        if (r < pOrphanRing) {
          const push = 0.0045 * (pOrphanRing - r);
          nd.vx += (nd.x / r) * push;
          nd.vy += (nd.y / r) * push;
        }
      }
    }

    // ── 2. Node-node repulsion ─────────────────────────────────────────────────
    // O(n²) with range culling; effective perf is O(n·k) where k = avg neighbours
    // within maxRepelDist.  Fine for gardens with < ~600 notes.
    for (let i = 0; i < n; i++) {
      const a = physNodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = physNodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.001;
        if (d2 > maxRepelDist * maxRepelDist) continue;

        const d = Math.sqrt(d2);
        // Higher-degree nodes carry a slightly stronger charge (they occupy more space)
        const str = (pRepelStrength * (1 + (a.degree + b.degree) * 0.015)) / d2;
        const fx = (dx / d) * str;
        const fy = (dy / d) * str;
        if (!a.fixed) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // ── 3. Collision guard (hard-body: nodes never overlap) ───────────────────
    for (let i = 0; i < n; i++) {
      const a = physNodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = physNodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy || 0.001;
        const minDist = a.size + b.size + 3;
        if (d2 >= minDist * minDist) continue;
        const d = Math.sqrt(d2);
        const push = ((minDist - d) / d) * 0.5;
        const fx = dx * push,
          fy = dy * push;
        if (!a.fixed) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // ── 4. Link spring (edge attraction toward rest length) ────────────────────
    for (const [ai, bi] of physEdges) {
      const a = physNodes[ai],
        b = physNodes[bi];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - pLinkDistance) * pLinkStrength;
      const fx = (dx / d) * f,
        fy = (dy / d) * f;
      if (!a.fixed) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixed) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // ── 5. Integrate, damp, write back to graphology ──────────────────────────
    let totalKE = 0;
    for (const nd of physNodes) {
      if (nd.fixed) continue;
      nd.vx *= pDamping;
      nd.vy *= pDamping;
      nd.x += nd.vx;
      nd.y += nd.vy;
      totalKE += nd.vx * nd.vx + nd.vy * nd.vy;
      graphInst.setNodeAttribute(nd.id, "x", nd.x);
      graphInst.setNodeAttribute(nd.id, "y", nd.y);
    }

    sigmaInst.refresh();

    // Auto-settle when kinetic energy drops to negligible (min 3 s warm-up)
    if (_tickCount > 180 && totalKE / Math.max(n, 1) < 0.0008) {
      isRunning = false;
      rafId = null;
    }
  }

  function startPhysics(maxMs = 0) {
    if (rafId) cancelAnimationFrame(rafId);
    _tickCount = 0;
    isRunning = true;
    rafId = requestAnimationFrame(physTick);
    if (maxMs > 0) setTimeout(stopPhysics, maxMs);
  }

  function stopPhysics() {
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function toggleLayout() {
    isRunning ? stopPhysics() : startPhysics();
  }

  // Kick a fresh burst when a slider changes; if already running, new params
  // take effect on the very next tick automatically.
  function applyPhysics() {
    if (!isRunning) startPhysics(6000);
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

  // ─── BFS ──────────────────────────────────────────────────────────────────────

  function getBfsNeighbors(start: string, depth: number): Map<string, number> {
    const dist = new Map<string, number>([[start, 0]]);
    if (!graphInst) return dist;
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const d = dist.get(cur)!;
      if (d >= depth) continue;
      for (const nb of graphInst.neighbors(cur) as string[]) {
        if (!dist.has(nb)) {
          dist.set(nb, d + 1);
          queue.push(nb);
        }
      }
    }
    return dist;
  }

  // ─── Physics slider config (must live in <script> — block-body arrows break in templates) ──

  interface PhysSlider {
    label: string;
    hint: string;
    min: number;
    max: number;
    step: number;
    get: () => number;
    set: (v: number) => void;
  }

  $: physicsSliders = [
    {
      label: "Center gravity",
      hint: "Base spring toward origin",
      min: 0.001,
      max: 0.01,
      step: 0.001,
      get: () => pCenterGravity,
      set: (v: number) => {
        pCenterGravity = v;
      },
    },
    {
      label: "Degree scale",
      hint: "Extra gravity per link (hubs↓)",
      min: 0.01,
      max: 0.1,
      step: 0.01,
      get: () => pDegreeGravScale,
      set: (v: number) => {
        pDegreeGravScale = v;
      },
    },
    {
      label: "Repulsion",
      hint: "Charge pushback between nodes",
      min: 100,
      max: 500,
      step: 25,
      get: () => pRepelStrength,
      set: (v: number) => {
        pRepelStrength = v;
      },
    },
    {
      label: "Link strength",
      hint: "Edge spring stiffness",
      min: 0.01,
      max: 0.5,
      step: 0.01,
      get: () => pLinkStrength,
      set: (v: number) => {
        pLinkStrength = v;
      },
    },
    {
      label: "Link distance",
      hint: "Edge rest length (px)",
      min: 30,
      max: 250,
      step: 5,
      get: () => pLinkDistance,
      set: (v: number) => {
        pLinkDistance = v;
      },
    },
    {
      label: "Damping",
      hint: "Velocity decay per tick",
      min: 0.5,
      max: 0.98,
      step: 0.01,
      get: () => pDamping,
      set: (v: number) => {
        pDamping = v;
      },
    },
    {
      label: "Orphan ring",
      hint: "Target radius for solo nodes",
      min: 100,
      max: 600,
      step: 10,
      get: () => pOrphanRing,
      set: (v: number) => {
        pOrphanRing = v;
      },
    },
  ] as PhysSlider[];

  // ─── Svelte → closure sync ────────────────────────────────────────────────────

  $: if (sigmaInst) {
    _search = searchQuery;
    _activeTags = new Set(activeTags);
    _showOrphans = showOrphans;
    if (_selected)
      _selectedNeighborMap = getBfsNeighbors(_selected, focusDepth);
    sigmaInst.refresh();
  }

  // ─── Selection helpers ────────────────────────────────────────────────────────

  function selectNode(node: string) {
    _selected = node;
    selectedId = node;
    _selectedNeighborMap = getBfsNeighbors(node, focusDepth);
    selectedConnections = graphInst
      ? ((graphInst.neighbors(node) as string[])
          .map((s: string) => notes.find((n) => n.slug === s))
          .filter(Boolean) as NoteSummary[])
      : [];
    sigmaInst?.refresh();
  }

  function clearSelection() {
    _selected = null;
    selectedId = null;
    _selectedNeighborMap.clear();
    selectedConnections = [];
    sigmaInst?.refresh();
  }

  function openNote(slug: string) {
    goto(`${base}/notes/${slug}`);
  }

  function toggleTag(tag: string) {
    activeTags.has(tag) ? activeTags.delete(tag) : activeTags.add(tag);
    activeTags = new Set(activeTags);
  }

  function togglePin(nodeId: string) {
    const idx = nodeIndexMap.get(nodeId);
    if (_pinnedNodes.has(nodeId)) {
      _pinnedNodes.delete(nodeId);
      pinnedNodes.delete(nodeId);
      if (idx !== undefined) physNodes[idx].fixed = false;
    } else {
      _pinnedNodes.add(nodeId);
      pinnedNodes.add(nodeId);
      if (idx !== undefined) physNodes[idx].fixed = true;
    }
    pinnedNodes = new Set(pinnedNodes);
    sigmaInst?.refresh();
  }

  // ─── Mount ────────────────────────────────────────────────────────────────────

  onMount(async () => {
    if (!browser) return;

    // Only graphology + sigma — no FA2 worker needed
    const [{ default: Graph }, { default: Sigma }] = await Promise.all([
      import("graphology"),
      import("sigma"),
    ]);

    graphInst = new Graph({ type: "undirected", multi: false });

    // Deduplicate
    const seenSlug = new Set<string>();
    const noteList = ((data.notes ?? []) as NoteSummary[]).filter((n) => {
      if (seenSlug.has(n.slug)) return false;
      seenSlug.add(n.slug);
      return true;
    });
    const slugSet = new Set(noteList.map((n) => n.slug));

    // ── Pre-compute actual degree from backlinks ───────────────────────────────
    const degreeMap = new Map<string, number>();
    noteList.forEach((n) => degreeMap.set(n.slug, 0));
    const edgeSeen = new Set<string>();
    for (const note of noteList) {
      for (const bl of note.backlinks ?? []) {
        if (!slugSet.has(bl.slug)) continue;
        const key = [note.slug, bl.slug].sort().join("||");
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        degreeMap.set(note.slug, (degreeMap.get(note.slug) ?? 0) + 1);
        degreeMap.set(bl.slug, (degreeMap.get(bl.slug) ?? 0) + 1);
      }
    }

    // ── Add nodes – initial position by degree: hubs near centre, orphans far ─
    noteList.forEach((note, i) => {
      const deg = degreeMap.get(note.slug) ?? 0;
      const ac = accentStyle(note.accent);
      const targetR =
        deg === 0
          ? pOrphanRing // orphans start at the ring
          : Math.max(15, 140 / Math.sqrt(deg + 1)); // hubs near centre, tighter initial spread
      const angle = (i / noteList.length) * 2 * Math.PI;
      const jitter = (Math.random() - 0.5) * 20; // break perfect symmetry
      graphInst.addNode(note.slug, {
        label: note.title,
        x: Math.cos(angle) * (targetR + jitter),
        y: Math.sin(angle) * (targetR + jitter),
        size: nodeSize(deg),
        color: ac.hex,
        activeColor: ac.hex,
        tag: note.primaryTag,
        status: note.status,
        emoji: note.emoji,
        degree: deg,
      });
    });

    // ── Add edges ─────────────────────────────────────────────────────────────
    edgeSeen.clear();
    for (const note of noteList) {
      for (const bl of note.backlinks ?? []) {
        if (!slugSet.has(bl.slug)) continue;
        const key = [note.slug, bl.slug].sort().join("||");
        if (edgeSeen.has(key)) continue;
        edgeSeen.add(key);
        const ac = accentStyle(note.accent);
        graphInst.addEdgeWithKey(key, note.slug, bl.slug, {
          color: ac.hex + "33",
          activeColor: ac.hex + "cc",
          size: 1,
        });
      }
    }

    // ── Build physics arrays ───────────────────────────────────────────────────
    physNodes = [];
    nodeIndexMap.clear();
    noteList.forEach((note, i) => {
      nodeIndexMap.set(note.slug, i);
      physNodes.push({
        id: note.slug,
        x: graphInst.getNodeAttribute(note.slug, "x"),
        y: graphInst.getNodeAttribute(note.slug, "y"),
        vx: 0,
        vy: 0,
        size: nodeSize(degreeMap.get(note.slug) ?? 0),
        degree: degreeMap.get(note.slug) ?? 0,
        fixed: false,
      });
    });

    physEdges = [];
    graphInst.forEachEdge((_e: string, _a: any, src: string, tgt: string) => {
      const ai = nodeIndexMap.get(src),
        bi = nodeIndexMap.get(tgt);
      if (ai !== undefined && bi !== undefined) physEdges.push([ai, bi]);
    });

    // ── Sigma ─────────────────────────────────────────────────────────────────
    sigmaInst = new Sigma(graphInst, sigmaContainer, {
      renderEdgeLabels: false,
      labelFont: '"Epilogue", sans-serif',
      labelColor: { color: "rgba(255,255,255,0.75)" },
      labelSize: 11,
      labelWeight: "500",
      labelRenderedSizeThreshold: 3,
      stagePadding: 60,
      minCameraRatio: 0.03,
      maxCameraRatio: 25,
      enableEdgeEvents: false,

      nodeReducer(node: string, data: any) {
        const res = { ...data };
        if (!_showOrphans && data.degree === 0) {
          res.hidden = true;
          return res;
        }

        if (_selected) {
          const depth = _selectedNeighborMap.get(node);
          if (node === _selected) {
            res.size = data.size * 2.4;
            res.color = data.activeColor;
            res.zIndex = 10;
          } else if (depth === 1) {
            res.size = data.size * 1.35;
            res.color = data.activeColor;
            res.zIndex = 8;
          } else if (depth !== undefined) {
            const fade = Math.max(0.22, 1 - (depth - 1) * 0.28);
            res.size = data.size * Math.max(0.6, 1 - (depth - 1) * 0.12);
            res.color = `rgba(255,255,255,${fade * 0.55})`;
            res.zIndex = Math.max(1, 6 - depth);
          } else {
            res.color = "rgba(255,255,255,0.032)";
            res.label = "";
            res.size = data.size * 0.3;
            res.zIndex = 0;
          }
          return res;
        }

        if (_activeTags.size > 0 && !_activeTags.has(data.tag)) {
          res.color = "rgba(255,255,255,0.042)";
          res.label = "";
          res.size = data.size * 0.4;
          return res;
        }

        if (_hovered) {
          if (node === _hovered) {
            res.size = data.size * 1.85;
            res.color = data.activeColor;
            res.zIndex = 10;
          } else if (_hoverNeighbors.has(node)) {
            res.size = data.size * 1.2;
            res.zIndex = 5;
          } else {
            res.color = "rgba(255,255,255,0.05)";
            res.label = "";
            res.size = data.size * 0.48;
          }
          return res;
        }

        if (_search) {
          const q = _search.toLowerCase();
          if (
            !(data.label ?? "").toLowerCase().includes(q) &&
            !(data.tag ?? "").toLowerCase().includes(q)
          ) {
            res.color = "rgba(255,255,255,0.038)";
            res.label = "";
            res.size = data.size * 0.36;
          }
        }
        return res;
      },

      edgeReducer(edge: string, data: any) {
        const res = { ...data };
        const [s, t] = graphInst.extremities(edge);

        if (_selected) {
          const sd = _selectedNeighborMap.get(s),
            td = _selectedNeighborMap.get(t);
          if (sd !== undefined && td !== undefined) {
            const mx = Math.max(sd, td);
            if (mx === 0) {
              res.color = data.activeColor;
              res.size = 3;
            } else if (mx === 1) {
              res.color = data.activeColor;
              res.size = 2;
            } else {
              res.color = `rgba(255,255,255,${Math.max(0.04, 0.3 - mx * 0.07)})`;
              res.size = 1;
            }
          } else {
            res.color = "rgba(255,255,255,0.015)";
            res.size = 0.3;
          }
          return res;
        }

        if (_activeTags.size > 0) {
          const sg = graphInst.getNodeAttribute(s, "tag") ?? "";
          const tg = graphInst.getNodeAttribute(t, "tag") ?? "";
          if (!_activeTags.has(sg) && !_activeTags.has(tg)) {
            res.color = "rgba(255,255,255,0.015)";
            res.size = 0.3;
            return res;
          }
        }

        if (_hovered) {
          res.color = graphInst.hasExtremity(edge, _hovered)
            ? data.activeColor
            : "rgba(255,255,255,0.028)";
          res.size = graphInst.hasExtremity(edge, _hovered) ? 2 : 0.5;
          return res;
        }

        if (_search) {
          const q = _search.toLowerCase();
          const sl = (
            graphInst.getNodeAttribute(s, "label") ?? ""
          ).toLowerCase();
          const tl = (
            graphInst.getNodeAttribute(t, "label") ?? ""
          ).toLowerCase();
          if (!sl.includes(q) && !tl.includes(q)) {
            res.color = "rgba(255,255,255,0.022)";
            res.size = 0.4;
          }
        }
        return res;
      },
    });

    // ── Events ────────────────────────────────────────────────────────────────

    sigmaInst.on("enterNode", ({ node }: any) => {
      _hovered = node;
      _hoverNeighbors = new Set(graphInst.neighbors(node));
      hoveredId = node;
      sigmaInst.refresh();
    });
    sigmaInst.on("leaveNode", () => {
      _hovered = null;
      _hoverNeighbors.clear();
      hoveredId = null;
      sigmaInst.refresh();
    });
    sigmaInst.on("clickNode", ({ node }: any) => {
      if (hasDragged) return;
      contextMenu = null;
      _selected === node ? clearSelection() : selectNode(node);
    });
    sigmaInst.on("doubleClickNode", ({ node }: any) => {
      openNote(node);
    });
    sigmaInst.on("clickStage", () => {
      clearSelection();
      contextMenu = null;
    });
    sigmaInst.on("rightClickNode", (e: any) => {
      e.event.original?.preventDefault();
      contextMenu = { x: e.event.x, y: e.event.y, node: e.node };
    });
    sigmaInst.on("rightClickStage", (e: any) => {
      e.event.original?.preventDefault();
      contextMenu = null;
    });

    // ── Drag ──────────────────────────────────────────────────────────────────

    let dragNode: string | null = null;
    let dragStartX = 0,
      dragStartY = 0;
    let hasDragged = false;

    sigmaInst.on("downNode", (e: any) => {
      dragNode = e.node;
      hasDragged = false;
      dragStartX = e.event.x;
      dragStartY = e.event.y;
      const idx = nodeIndexMap.get(e.node);
      if (idx !== undefined) physNodes[idx].fixed = true; // pin during drag
      e.event.preventSigmaDefault();
      e.event.original?.preventDefault();
    });

    sigmaInst.getMouseCaptor().on("mousemovebody", (e: any) => {
      mouseX = e.x ?? 0;
      mouseY = e.y ?? 0;
      if (!dragNode) return;
      if (!hasDragged) {
        const dx = (e.x ?? 0) - dragStartX,
          dy = (e.y ?? 0) - dragStartY;
        if (Math.sqrt(dx * dx + dy * dy) > 4) hasDragged = true;
      }
      if (!hasDragged) return;
      const pos = sigmaInst.viewportToGraph(e);
      const idx = nodeIndexMap.get(dragNode);
      if (idx !== undefined) {
        physNodes[idx].x = pos.x;
        physNodes[idx].y = pos.y;
        physNodes[idx].vx = 0;
        physNodes[idx].vy = 0;
      }
      graphInst.setNodeAttribute(dragNode, "x", pos.x);
      graphInst.setNodeAttribute(dragNode, "y", pos.y);
      // Keep physics alive so neighbours react to the drag
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(physTick);
      }
      e.preventSigmaDefault();
      e.original?.preventDefault();
      e.original?.stopPropagation();
    });

    const stopDrag = () => {
      if (dragNode) {
        if (!_pinnedNodes.has(dragNode)) {
          const idx = nodeIndexMap.get(dragNode);
          if (idx !== undefined) physNodes[idx].fixed = false;
        }
        if (!isRunning) startPhysics(4000); // let neighbours settle after drop
      }
      dragNode = null;
    };
    sigmaInst.getMouseCaptor().on("mouseup", stopDrag);
    sigmaInst.getMouseCaptor().on("mouseleave", stopDrag);

    // ── Start ─────────────────────────────────────────────────────────────────
    startPhysics(10_000); // max 10 s, auto-settle kicks in earlier via KE check
  });

  onDestroy(() => {
    if (!browser) return;
    stopPhysics();
    sigmaInst?.kill();
  });

  // ─── Derived ─────────────────────────────────────────────────────────────────

  $: hoveredNote = hoveredId ? notes.find((n) => n.slug === hoveredId) : null;
  $: selectedNote = selectedId
    ? notes.find((n) => n.slug === selectedId)
    : null;

  $: totalEdges = (() => {
    const slugSet = new Set(notes.map((n) => n.slug));
    const edgeSeen = new Set<string>();
    let count = 0;
    for (const note of notes) {
      for (const bl of note.backlinks ?? []) {
        if (!slugSet.has(bl.slug)) continue;
        const key = [note.slug, bl.slug].sort().join("||");
        if (!edgeSeen.has(key)) {
          edgeSeen.add(key);
          count++;
        }
      }
    }
    return count;
  })();

  $: searchMatches = searchQuery
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (n.primaryTag ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      ).length
    : 0;
</script>

<svelte:head><title>Graph · Digital Garden</title></svelte:head>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="fixed inset-0 z-50 flex flex-col overflow-hidden"
  style="background:#0d0d14"
  on:click={() => {
    contextMenu = null;
  }}
>
  <!-- ── Topbar ──────────────────────────────────────────────────────────────── -->
  <header
    class="shrink-0 flex items-center gap-2.5 h-[52px] px-4 border-b border-white/[0.06] z-20"
    style="background:rgba(13,13,20,0.93);backdrop-filter:blur(14px)"
  >
    <a
      href="{base}/"
      class="flex items-center gap-1.5 text-[11px] font-medium text-white/50 no-underline
        px-3 py-1.5 rounded-full border border-white/[0.08]
        hover:text-white/80 hover:border-white/20 transition-all shrink-0"
      >← Garden</a
    >

    <div class="relative shrink-0">
      <span
        class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-[13px] pointer-events-none select-none"
        >⌕</span
      >
      <input
        type="search"
        placeholder="Search nodes…"
        bind:value={searchQuery}
        class="w-40 bg-white/[0.05] border border-white/[0.08] text-white/80 text-[12px]
          pl-8 pr-8 py-1.5 rounded-full outline-none transition-all
          focus:border-white/22 focus:bg-white/[0.07] placeholder:text-white/22
          [&::-webkit-search-cancel-button]:hidden"
      />
      {#if searchQuery && searchMatches > 0}
        <span
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none tabular-nums"
          >{searchMatches}</span
        >
      {/if}
    </div>

    <div
      class="hidden sm:flex items-center gap-1.5 text-[11px] text-white/22 font-light"
    >
      <span>{notes.length} notes</span><span class="text-white/12">·</span><span
        >{totalEdges} links</span
      >
    </div>

    {#if activeTags.size > 0}
      <div class="hidden md:flex items-center gap-1 flex-wrap max-w-[200px]">
        {#each [...activeTags] as tag}
          {@const sample = notes.find((n) => n.primaryTag === tag)}
          {@const hex = accentStyle(sample?.accent ?? "violet").hex}
          <button
            class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style="background:{hex}18;color:{hex};border:1px solid {hex}30"
            on:click|stopPropagation={() => toggleTag(tag)}
            >{tag} <span class="opacity-60">×</span></button
          >
        {/each}
        <button
          class="text-[10px] text-white/30 hover:text-white/60 px-1.5 transition-colors"
          on:click|stopPropagation={() => {
            activeTags = new Set();
          }}>clear</button
        >
      </div>
    {/if}

    <div class="ml-auto flex items-center gap-1.5">
      <button
        on:click|stopPropagation={() => {
          showOrphans = !showOrphans;
        }}
        class="hidden sm:block text-[11px] px-3 py-1.5 rounded-full border transition-all
          {!showOrphans
          ? 'text-amber-400/70 border-amber-400/28 bg-amber-400/[0.07]'
          : 'text-white/32 border-white/[0.07] hover:text-white/58 hover:border-white/14'}"
        >{showOrphans ? "Hide orphans" : "Show orphans"}</button
      >

      <button
        on:click|stopPropagation={() => {
          showPhysics = !showPhysics;
        }}
        class="text-[11px] px-3 py-1.5 rounded-full border transition-all
          {showPhysics
          ? 'text-[#b44dff] border-[rgba(180,77,255,0.38)] bg-[rgba(180,77,255,0.09)]'
          : 'text-white/32 border-white/[0.07] hover:text-white/58 hover:border-white/14'}"
        >Physics</button
      >

      <button
        on:click|stopPropagation={toggleLayout}
        title={isRunning ? "Pause layout" : "Resume layout"}
        class="w-7 h-7 flex items-center justify-center rounded-full border text-[10px] transition-all
          {isRunning
          ? 'text-[#b44dff] border-[rgba(180,77,255,0.32)] bg-[rgba(180,77,255,0.07)]'
          : 'text-white/28 border-white/[0.07] hover:text-white/55'}"
        >{isRunning ? "⏸" : "▶"}</button
      >

      <button
        on:click|stopPropagation={fitView}
        class="text-[11px] text-white/32 hover:text-white/68 px-3 py-1.5 rounded-full border border-white/[0.07] hover:border-white/14 transition-all"
        >Fit</button
      >
      <button
        on:click|stopPropagation={zoomIn}
        class="w-7 h-7 text-sm font-bold text-white/32 hover:text-white/68 flex items-center justify-center rounded-full border border-white/[0.07] hover:border-white/14 transition-all"
        >+</button
      >
      <button
        on:click|stopPropagation={zoomOut}
        class="w-7 h-7 text-sm font-bold text-white/32 hover:text-white/68 flex items-center justify-center rounded-full border border-white/[0.07] hover:border-white/14 transition-all"
        >−</button
      >
    </div>
  </header>

  <!-- ── Main body ───────────────────────────────────────────────────────────── -->
  <div class="flex flex-1 overflow-hidden">
    <!-- ── Left sidebar ─────────────────────────────────────────────────────── -->
    <aside
      class="hidden lg:flex flex-col w-[165px] shrink-0 border-r border-white/[0.06]
        overflow-y-auto py-4 px-2.5 gap-0.5 z-10"
      style="background:rgba(13,13,20,0.88)"
    >
      <p
        class="text-[9px] uppercase tracking-[0.22em] text-white/25 px-2 pb-2 font-semibold"
      >
        Tags {#if activeTags.size > 0}<span class="text-[#b44dff]/60"
            >({activeTags.size})</span
          >{/if}
      </p>

      <button
        class="flex items-center gap-2 px-2 py-1.5 text-[11px] rounded-lg text-left transition-all border"
        style={activeTags.size === 0
          ? "color:rgba(255,255,255,0.82);background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.11)"
          : "color:rgba(255,255,255,0.32);border-color:transparent;background:transparent"}
        on:click|stopPropagation={() => {
          activeTags = new Set();
        }}
      >
        <span class="text-xs">🌿</span><span>All</span>
        <span class="ml-auto text-[10px] opacity-40">{notes.length}</span>
      </button>

      {#each allTags as tag}
        {@const sample = notes.find((n) => n.primaryTag === tag)}
        {@const hex = accentStyle(sample?.accent ?? "violet").hex}
        {@const count = notes.filter((n) => n.primaryTag === tag).length}
        {@const active = activeTags.has(tag)}
        <button
          class="flex items-center gap-2 px-2 py-1.5 text-[11px] capitalize rounded-lg text-left transition-all border"
          style={active
            ? `color:${hex};background:${hex}16;border-color:${hex}2e`
            : "color:rgba(255,255,255,0.35);border-color:transparent;background:transparent"}
          on:click|stopPropagation={() => toggleTag(tag)}
        >
          <span class="text-[11px] shrink-0">{sample?.emoji ?? "·"}</span>
          <span class="truncate flex-1">{tag}</span>
          <span class="text-[10px] opacity-38">{count}</span>
          {#if active}<span style="color:{hex};font-size:8px">✓</span>{/if}
        </button>
      {/each}

      <div class="mt-auto pt-4 border-t border-white/[0.05] px-2 space-y-3">
        <div>
          <p
            class="text-[9px] uppercase tracking-[0.2em] text-white/22 font-semibold mb-2.5"
          >
            Degree
          </p>
          <div class="flex items-end justify-between">
            {#each [[0, "Solo"], [5, "Linked"], [12, "Hub"]] as [deg, lbl]}
              {@const r = nodeSize(+deg)}
              <div class="flex flex-col items-center gap-1.5">
                <svg width={r * 2 + 2} height={r * 2 + 2}>
                  <circle
                    cx={r + 1}
                    cy={r + 1}
                    {r}
                    fill="#b44dff"
                    fill-opacity="0.55"
                  />
                </svg>
                <span class="text-[8px] text-white/22">{lbl}</span>
              </div>
            {/each}
          </div>
        </div>
        <div>
          <p
            class="text-[9px] uppercase tracking-[0.2em] text-white/22 font-semibold mb-1.5"
          >
            Status
          </p>
          {#each [["🌱", "Seedling"], ["🌿", "Budding"], ["🌲", "Evergreen"]] as [e, l]}
            <div class="flex items-center gap-1.5 py-0.5">
              <span class="text-[10px]">{e}</span><span
                class="text-[9px] text-white/22">{l}</span
              >
            </div>
          {/each}
        </div>
        {#if pinnedNodes.size > 0}
          <div class="pt-2 border-t border-white/[0.05]">
            <p
              class="text-[9px] uppercase tracking-[0.2em] text-white/22 font-semibold mb-1.5"
            >
              Pinned
            </p>
            {#each [...pinnedNodes] as slug}
              {@const pn = notes.find((n) => n.slug === slug)}
              {#if pn}
                <button
                  class="w-full flex items-center gap-1.5 py-0.5 text-[10px] text-amber-400/55 hover:text-amber-400/80 transition-colors text-left truncate"
                  on:click|stopPropagation={() => selectNode(slug)}
                  ><span>📌</span><span class="truncate">{pn.title}</span
                  ></button
                >
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    </aside>

    <!-- ── Graph canvas ──────────────────────────────────────────────────────── -->
    <div class="relative flex-1">
      <div
        class="absolute inset-0 z-0"
        style="background:#0d0d14;background-image:radial-gradient(circle,rgba(255,255,255,0.075) 1px,transparent 1px);background-size:28px 28px;"
      ></div>

      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div
        bind:this={sigmaContainer}
        class="absolute inset-0 z-10"
        style="background:transparent"
        on:contextmenu|preventDefault
      ></div>

      <div
        class="absolute inset-0 z-20 pointer-events-none"
        style="background:radial-gradient(ellipse at center,transparent 42%,rgba(13,13,20,0.7) 100%)"
      ></div>

      <!-- Hover tooltip -->
      {#if hoveredNote && !selectedId}
        {@const ac = accentStyle(hoveredNote.accent)}
        <div
          class="absolute z-30 pointer-events-none"
          style="left:{Math.min(mouseX + 18, 820)}px;top:{Math.max(
            8,
            mouseY - 125,
          )}px"
        >
          <div
            class="w-[212px] rounded-xl border border-white/[0.09] shadow-2xl overflow-hidden"
            style="background:rgba(14,14,22,0.98)"
          >
            <div
              class="h-[2.5px]"
              style="background:linear-gradient(90deg,{ac.hex},{ac.hex}44)"
            ></div>
            <div class="px-4 py-3 space-y-1.5">
              <div class="flex items-center gap-2">
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
              <p class="text-[13px] font-bold text-white leading-snug">
                {hoveredNote.title}
              </p>
              <p class="text-[10px] text-white/32">
                {hoveredNote.backlinks?.length ?? 0} connection{(hoveredNote
                  .backlinks?.length ?? 0) !== 1
                  ? "s"
                  : ""}
              </p>
              <p
                class="text-[9.5px] text-white/18 pt-1 border-t border-white/[0.055]"
              >
                Click to focus · Dbl-click to open · Right-click for options
              </p>
            </div>
          </div>
        </div>
      {/if}

      {#if !selectedId}
        <p
          class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-[10px] text-white/16 pointer-events-none whitespace-nowrap select-none"
        >
          Click to focus · Double-click to open · Right-click for options · Drag
          to rearrange
        </p>
      {:else}
        <p
          class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 text-[10px] text-white/16 pointer-events-none whitespace-nowrap select-none"
        >
          Click background to deselect · Click a neighbour to shift focus
        </p>
      {/if}

      <!-- Context menu -->
      {#if contextMenu}
        {@const cmNode = contextMenu.node}
        {@const cmNote = notes.find((n) => n.slug === cmNode)}
        {@const cmAc = cmNote ? accentStyle(cmNote.accent) : { hex: "#b44dff" }}
        {@const isPinned = pinnedNodes.has(cmNode)}
        {@const isFocused = selectedId === cmNode}
        <div
          class="absolute z-50 w-[192px] rounded-xl overflow-hidden shadow-2xl"
          style="
            left:{contextMenu.x < (browser ? window.innerWidth : 1200) - 220
            ? contextMenu.x + 6
            : contextMenu.x - 198}px;
            top:{contextMenu.y < (browser ? window.innerHeight : 800) - 200
            ? contextMenu.y + 6
            : contextMenu.y - 170}px;
            background:rgba(14,14,22,0.98);border:1px solid rgba(255,255,255,0.1);
          "
          on:click|stopPropagation
        >
          <div class="px-3.5 py-2.5 border-b border-white/[0.07]">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="text-[11px]">{cmNote?.emoji ?? "·"}</span>
              <span
                class="text-[9px] font-bold uppercase tracking-widest"
                style="color:{cmAc.hex}">{cmNote?.primaryTag}</span
              >
            </div>
            <p class="text-[11.5px] font-semibold text-white/80 leading-tight">
              {cmNote?.title ?? cmNode}
            </p>
          </div>
          <div class="py-1">
            <button
              class="w-full text-left px-3.5 py-2 text-[11.5px] text-white/55 hover:bg-white/[0.05] hover:text-white/88 transition-colors flex items-center gap-2.5"
              on:click={() => {
                openNote(cmNode);
                contextMenu = null;
              }}
              ><span class="text-[12px] opacity-70">↗</span> Open note</button
            >
            <button
              class="w-full text-left px-3.5 py-2 text-[11.5px] transition-colors flex items-center gap-2.5
                {isFocused
                ? 'text-[#b44dff]/80 bg-[#b44dff]/[0.06]'
                : 'text-white/55 hover:bg-white/[0.05] hover:text-white/88'}"
              on:click={() => {
                isFocused ? clearSelection() : selectNode(cmNode);
                contextMenu = null;
              }}
              ><span class="text-[12px] opacity-70">◎</span>
              {isFocused ? "Clear focus" : "Focus here"}</button
            >
            <button
              class="w-full text-left px-3.5 py-2 text-[11.5px] transition-colors flex items-center gap-2.5
                {isPinned
                ? 'text-amber-400/75 hover:bg-amber-400/[0.05]'
                : 'text-white/55 hover:bg-white/[0.05] hover:text-white/88'}"
              on:click={() => {
                togglePin(cmNode);
                contextMenu = null;
              }}
              ><span class="text-[11px]">📌</span>
              {isPinned ? "Unpin node" : "Pin node"}</button
            >
          </div>
        </div>
      {/if}

      <!-- Physics panel -->
      {#if showPhysics}
        <div
          class="absolute top-4 right-4 z-40 w-[240px] rounded-xl border border-white/[0.09] overflow-hidden shadow-2xl"
          style="background:rgba(14,14,22,0.97)"
          on:click|stopPropagation
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
          >
            <span
              class="text-[10px] uppercase tracking-[0.2em] text-white/42 font-semibold"
              >Physics</span
            >
            <button
              on:click={() => (showPhysics = false)}
              class="text-white/22 hover:text-white/62 text-[18px] leading-none transition-colors"
              >×</button
            >
          </div>
          <div class="px-4 py-4 space-y-4">
            {#each physicsSliders as s}
              <div>
                <div class="flex justify-between mb-1">
                  <div>
                    <label class="text-[11px] text-white/52 leading-none"
                      >{s.label}</label
                    >
                    <p class="text-[9px] text-white/22 mt-0.5">{s.hint}</p>
                  </div>
                  <span
                    class="text-[11px] text-white/28 tabular-nums self-start mt-0.5"
                    >{s
                      .get()
                      .toFixed(s.step < 0.1 ? 3 : s.step < 1 ? 2 : 0)}</span
                  >
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.get()}
                  on:input={(e) => s.set(parseFloat(e.currentTarget.value))}
                  on:change={applyPhysics}
                  class="w-full h-1 rounded-full appearance-none cursor-pointer bg-white/[0.09]
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-[#b44dff] [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            {/each}
            <button
              on:click={() => {
                pCenterGravity = 0.018;
                pDegreeGravScale = 0.04;
                pRepelStrength = 380;
                pLinkStrength = 0.22;
                pLinkDistance = 52;
                pDamping = 0.86;
                pOrphanRing = 420;
                applyPhysics();
              }}
              class="w-full text-[11px] text-white/28 hover:text-white/58 py-1.5 rounded-lg border border-white/[0.07] hover:border-white/14 transition-all"
              >Reset defaults</button
            >
          </div>
        </div>
      {/if}
    </div>

    <!-- ── Right panel: selected node ───────────────────────────────────────── -->
    {#if selectedNote}
      {@const note = selectedNote}
      {@const ac = accentStyle(note.accent)}
      <aside
        class="hidden lg:flex flex-col w-[252px] shrink-0 border-l border-white/[0.06] overflow-hidden z-10"
        style="background:rgba(12,12,19,0.97)"
        on:click|stopPropagation
      >
        <div style="background:{ac.hex}0c">
          <div
            class="h-[2.5px]"
            style="background:linear-gradient(90deg,{ac.hex},{ac.hex}2a)"
          ></div>
          <div class="px-4 pt-4 pb-3.5">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-[1.5rem] leading-none shrink-0"
                  >{note.emoji}</span
                >
                <div class="min-w-0">
                  <p
                    class="text-[9px] font-bold uppercase tracking-widest leading-none mb-1"
                    style="color:{ac.hex}"
                  >
                    {note.primaryTag}
                  </p>
                  <p class="text-[9px] text-white/28">
                    {note.status === "seedling"
                      ? "🌱 Seedling"
                      : note.status === "budding"
                        ? "🌿 Budding"
                        : note.status === "evergreen"
                          ? "🌲 Evergreen"
                          : "🍂"}
                  </p>
                </div>
              </div>
              <button
                on:click={clearSelection}
                class="text-white/18 hover:text-white/52 text-xl leading-none mt-0.5 shrink-0 transition-colors"
                >×</button
              >
            </div>
            <h3 class="text-[13.5px] font-bold text-white leading-snug">
              {note.title}
            </h3>
            <p class="text-[10px] text-white/28 mt-1.5">
              {selectedConnections.length} direct connection{selectedConnections.length !==
              1
                ? "s"
                : ""}
              {#if pinnedNodes.has(note.slug)}
                · <span class="text-amber-400/55">📌 pinned</span>{/if}
            </p>
          </div>
        </div>

        <div class="px-4 py-3 border-b border-white/[0.055]">
          <div class="flex items-center justify-between mb-2.5">
            <span
              class="text-[9.5px] uppercase tracking-[0.16em] text-white/28 font-semibold"
              >Focus depth</span
            >
            <span
              class="text-[10px] font-bold tabular-nums"
              style="color:{ac.hex}"
              >{focusDepth} hop{focusDepth !== 1 ? "s" : ""}</span
            >
          </div>
          <div class="flex gap-1">
            {#each [1, 2, 3, 4, 5] as d}
              <button
                class="flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all border"
                style={focusDepth === d
                  ? `background:${ac.hex}1e;border-color:${ac.hex}45;color:${ac.hex}`
                  : "background:rgba(255,255,255,0.025);border-color:rgba(255,255,255,0.065);color:rgba(255,255,255,0.26)"}
                on:click={() => {
                  focusDepth = d;
                }}>{d}</button
              >
            {/each}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div class="px-4 py-3">
            <p
              class="text-[9px] uppercase tracking-[0.2em] text-white/22 font-semibold mb-2"
            >
              Connections
            </p>
            {#if selectedConnections.length === 0}
              <p class="text-[11px] text-white/18 italic py-2">
                No connections yet
              </p>
            {:else}
              <div class="space-y-0.5">
                {#each [...selectedConnections].sort( (a, b) => (a?.title ?? "").localeCompare(b?.title ?? ""), ) as conn}
                  {#if conn}
                    {@const connAc = accentStyle(conn.accent)}
                    <button
                      class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all group hover:bg-white/[0.038]"
                      on:click={() => selectNode(conn.slug)}
                    >
                      <span class="text-[11px] shrink-0">{conn.emoji}</span>
                      <span
                        class="text-[11.5px] text-white/50 group-hover:text-white/78 truncate transition-colors leading-tight flex-1"
                        >{conn.title}</span
                      >
                      <span
                        class="w-1.5 h-1.5 rounded-full shrink-0 opacity-60"
                        style="background:{connAc.hex}"
                      ></span>
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="px-4 py-3 border-t border-white/[0.055] space-y-2 shrink-0">
          <button
            on:click={() => openNote(note.slug)}
            class="w-full py-2.5 rounded-lg text-[12px] font-semibold transition-all"
            style="background:{ac.hex}18;border:1px solid {ac.hex}38;color:{ac.hex}"
            >Open note ↗</button
          >
          <button
            on:click={() => togglePin(note.slug)}
            class="w-full py-2 rounded-lg text-[11px] transition-all border"
            style={pinnedNodes.has(note.slug)
              ? "background:rgba(251,191,36,0.07);border-color:rgba(251,191,36,0.22);color:rgba(251,191,36,0.65)"
              : "background:rgba(255,255,255,0.025);border-color:rgba(255,255,255,0.065);color:rgba(255,255,255,0.32)"}
            >{pinnedNodes.has(note.slug)
              ? "📌 Pinned · click to unpin"
              : "📌 Pin node"}</button
          >
        </div>
      </aside>
    {/if}
  </div>
</div>
