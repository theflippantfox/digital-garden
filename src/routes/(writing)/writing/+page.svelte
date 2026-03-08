<script lang="ts">
  import { base } from "$app/paths";
  import type { PageData } from "./$types";
  import type { NoteSummary } from "$lib/types";

  export let data: PageData;

  $: pieces = (data.pieces ?? []) as NoteSummary[];

  const SUBTYPE_LABELS: Record<string, string> = {
    poem: "Poetry",
    poetry: "Poetry",
    story: "Short Fiction",
    essay: "Essay",
    "long-form": "Long Form",
  };

  const SUBTYPE_ORDER = ["poem", "poetry", "story", "essay", "long-form"];

  function subtypeLabel(s: string | null) {
    return s ? (SUBTYPE_LABELS[s.toLowerCase()] ?? s) : "Other";
  }

  // Group by subtype, preserving order
  $: grouped = (() => {
    const map = new Map<string, NoteSummary[]>();
    for (const p of pieces) {
      const key = (p.subtype ?? "other").toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort groups: known types first, then rest
    const sorted = new Map<string, NoteSummary[]>();
    for (const k of SUBTYPE_ORDER) {
      if (map.has(k)) sorted.set(k, map.get(k)!);
    }
    for (const [k, v] of map) {
      if (!sorted.has(k)) sorted.set(k, v);
    }
    return sorted;
  })();

  let filter = "";
  $: filtered = filter
    ? pieces.filter(
        (p) =>
          p.title.toLowerCase().includes(filter.toLowerCase()) ||
          (p.subtype ?? "").toLowerCase().includes(filter.toLowerCase()),
      )
    : null;
</script>

<svelte:head>
  <title>Writing</title>
</svelte:head>

<div class="page">
  <!-- Nav -->
  <nav>
    <a href="{base}/" class="back-link">← Garden</a>
    <span class="nav-title">Writing</span>
    <span class="piece-count"
      >{pieces.length} piece{pieces.length !== 1 ? "s" : ""}</span
    >
  </nav>

  <!-- Masthead -->
  <header class="masthead">
    <div class="rule-top"></div>
    <div class="masthead-inner">
      <p class="masthead-kicker">A collection of</p>
      <h1 class="masthead-title">Writing</h1>
      <p class="masthead-sub">Poetry · Fiction · Essays · Long-form</p>
    </div>
    <div class="rule-bottom"></div>
  </header>

  <!-- Search -->
  <div class="search-row">
    <input
      type="search"
      placeholder="Filter pieces…"
      bind:value={filter}
      class="search-input"
    />
  </div>

  <!-- Content -->
  <main class="toc">
    {#if filtered !== null}
      <!-- Flat filtered list -->
      <section class="toc-section">
        <ol class="piece-list">
          {#each filtered as piece}
            <li class="piece-row">
              <a href="{base}/writing/{piece.slug}" class="piece-link">
                <span class="piece-title">{piece.title}</span>
                <span class="piece-dots"></span>
                <span class="piece-meta">
                  {#if piece.subtype}<span class="piece-type"
                      >{subtypeLabel(piece.subtype)}</span
                    >{/if}
                  {#if piece.date}<span class="piece-date">{piece.date}</span
                    >{/if}
                </span>
              </a>
            </li>
          {/each}
          {#if filtered.length === 0}
            <li class="no-results">Nothing matches "{filter}"</li>
          {/if}
        </ol>
      </section>
    {:else}
      <!-- Grouped by subtype -->
      {#each [...grouped.entries()] as [key, items]}
        <section class="toc-section">
          <h2 class="section-heading">
            <span class="section-label">{subtypeLabel(key)}</span>
            <span class="section-count">{items.length}</span>
          </h2>
          <ol class="piece-list">
            {#each items as piece, i}
              <li class="piece-row" style="animation-delay:{i * 40}ms">
                <a href="{base}/writing/{piece.slug}" class="piece-link">
                  <span class="piece-num">{String(i + 1).padStart(2, "0")}</span
                  >
                  <span class="piece-title">{piece.title}</span>
                  <span class="piece-dots"></span>
                  <span class="piece-meta">
                    {#if piece.date}<span class="piece-date">{piece.date}</span
                      >{/if}
                  </span>
                </a>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    {/if}

    {#if pieces.length === 0}
      <div class="empty">
        <p>No pieces yet.</p>
        <p class="empty-hint">
          Add <code>type: creative</code> to a note's frontmatter.
        </p>
      </div>
    {/if}
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-rule"></div>
    <p class="footer-text">fin.</p>
  </footer>
</div>

<style>
  .page {
    position: relative;
    z-index: 1;
    max-width: 680px;
    margin: 0 auto;
    padding: 0 2rem 6rem;
  }

  /* ── Nav ── */
  nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.75rem 0 0;
    font-family: "Lora", serif;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    color: rgba(226, 213, 195, 0.35);
  }
  .back-link {
    color: rgba(226, 213, 195, 0.45);
    text-decoration: none;
    transition: color 0.2s;
  }
  .back-link:hover {
    color: rgba(226, 213, 195, 0.8);
  }
  .nav-title {
    color: rgba(226, 213, 195, 0.25);
  }
  .piece-count {
    margin-left: auto;
  }

  /* ── Masthead ── */
  .masthead {
    margin: 3.5rem 0 3rem;
    text-align: center;
  }
  .rule-top,
  .rule-bottom {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(201, 169, 110, 0.4),
      transparent
    );
    margin-bottom: 2rem;
  }
  .rule-bottom {
    margin-top: 2rem;
    margin-bottom: 0;
  }
  .masthead-kicker {
    font-family: "Lora", serif;
    font-style: italic;
    font-size: 0.85rem;
    color: rgba(201, 169, 110, 0.6);
    letter-spacing: 0.15em;
    margin: 0 0 0.6rem;
  }
  .masthead-title {
    font-family: "Playfair Display", serif;
    font-weight: 900;
    font-size: clamp(3.5rem, 10vw, 5.5rem);
    line-height: 1;
    color: #e2d5c3;
    letter-spacing: -0.02em;
    margin: 0 0 0.75rem;
  }
  .masthead-sub {
    font-family: "Lora", serif;
    font-size: 0.78rem;
    color: rgba(226, 213, 195, 0.35);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }

  /* ── Search ── */
  .search-row {
    margin-bottom: 2.5rem;
    display: flex;
    justify-content: center;
  }
  .search-input {
    width: 100%;
    max-width: 340px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(201, 169, 110, 0.25);
    color: #e2d5c3;
    font-family: "Lora", serif;
    font-size: 0.85rem;
    padding: 0.5rem 0.25rem;
    outline: none;
    text-align: center;
    transition: border-color 0.2s;
  }
  .search-input::placeholder {
    color: rgba(226, 213, 195, 0.25);
    font-style: italic;
  }
  .search-input:focus {
    border-color: rgba(201, 169, 110, 0.6);
  }
  .search-input::-webkit-search-cancel-button {
    display: none;
  }

  /* ── ToC ── */
  .toc {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .toc-section {
  }
  .section-heading {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin: 0 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(201, 169, 110, 0.15);
  }
  .section-label {
    font-family: "Playfair Display", serif;
    font-style: italic;
    font-size: 1.1rem;
    color: rgba(201, 169, 110, 0.8);
    font-weight: 400;
  }
  .section-count {
    font-family: "Lora", serif;
    font-size: 0.7rem;
    color: rgba(226, 213, 195, 0.25);
    letter-spacing: 0.1em;
  }

  .piece-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .piece-row {
    animation: fadeUp 0.4s ease both;
  }
  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .piece-link {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.7rem 0;
    border-bottom: 1px solid rgba(226, 213, 195, 0.06);
    text-decoration: none;
    color: inherit;
    transition: color 0.2s;
  }
  .piece-link:hover {
    color: #c9a96e;
  }
  .piece-link:hover .piece-dots {
    border-color: rgba(201, 169, 110, 0.25);
  }

  .piece-num {
    font-family: "Lora", serif;
    font-size: 0.68rem;
    color: rgba(226, 213, 195, 0.2);
    letter-spacing: 0.05em;
    flex-shrink: 0;
    width: 1.6rem;
  }
  .piece-title {
    font-family: "Playfair Display", serif;
    font-size: 1rem;
    font-weight: 400;
    color: #e2d5c3;
    transition: color 0.2s;
    flex-shrink: 0;
  }
  .piece-link:hover .piece-title {
    color: #c9a96e;
  }

  .piece-dots {
    flex: 1;
    min-width: 2rem;
    border-bottom: 1px dotted rgba(226, 213, 195, 0.12);
    margin-bottom: 0.3em;
    transition: border-color 0.2s;
  }

  .piece-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }
  .piece-type {
    font-family: "Lora", serif;
    font-style: italic;
    font-size: 0.72rem;
    color: rgba(201, 169, 110, 0.5);
  }
  .piece-date {
    font-family: "Lora", serif;
    font-size: 0.68rem;
    color: rgba(226, 213, 195, 0.2);
    letter-spacing: 0.05em;
  }

  .no-results,
  .empty {
    font-family: "Lora", serif;
    font-style: italic;
    color: rgba(226, 213, 195, 0.3);
    font-size: 0.9rem;
    padding: 2rem 0;
    text-align: center;
  }
  .empty-hint {
    font-size: 0.78rem;
    margin-top: 0.5rem;
    color: rgba(226, 213, 195, 0.2);
  }
  .empty-hint code {
    font-family: monospace;
    background: rgba(201, 169, 110, 0.08);
    padding: 0.1em 0.4em;
    border-radius: 3px;
    font-style: normal;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 5rem;
    text-align: center;
  }
  .footer-rule {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(201, 169, 110, 0.2),
      transparent
    );
    margin-bottom: 1.5rem;
  }
  .footer-text {
    font-family: "Playfair Display", serif;
    font-style: italic;
    font-size: 0.85rem;
    color: rgba(226, 213, 195, 0.2);
  }
</style>
