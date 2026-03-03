<script lang="ts">
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // Extract note title from the URL if it's a /notes/[slug] 404
  $: slug = $page.url.pathname.match(/\/notes\/([^/]+)/)?.[1] ?? null;
  $: noteName = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : null;

  $: is404 = $page.status === 404;

  let prevUrl = "";
  onMount(() => {
    if (browser) prevUrl = document.referrer;
  });

  // Check if we came from within the garden
  $: hasPrev =
    prevUrl &&
    new URL(prevUrl || "http://x").hostname ===
      (browser ? location.hostname : "");
</script>

<svelte:head>
  <title
    >{is404 ? "Note not found" : "Something went wrong"} · Digital Garden</title
  >
</svelte:head>

<div class="min-h-full flex items-center justify-center px-6 py-20">
  <div class="text-center max-w-[460px]">
    <!-- Animated plant -->
    <div class="relative inline-flex items-center justify-center mb-8">
      <!-- Glow -->
      <div
        class="absolute w-32 h-32 rounded-full blur-3xl opacity-20"
        style="background: radial-gradient(circle, #b44dff, #ff5c3a)"
      ></div>

      <!-- SVG illustration -->
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="err-grad" x1="0" y1="96" x2="96" y2="0">
            <stop offset="0%" stop-color="#b44dff" stop-opacity="0.4" />
            <stop offset="100%" stop-color="#ff5c3a" stop-opacity="0.4" />
          </linearGradient>
        </defs>
        <!-- Pot -->
        <path
          d="M34 72 L36 84 Q48 88 60 84 L62 72 Z"
          fill="#b44dff"
          fill-opacity="0.25"
          stroke="#b44dff"
          stroke-opacity="0.4"
          stroke-width="1"
        />
        <rect
          x="30"
          y="68"
          width="36"
          height="6"
          rx="3"
          fill="#b44dff"
          fill-opacity="0.2"
          stroke="#b44dff"
          stroke-opacity="0.35"
          stroke-width="1"
        />
        <!-- Soil -->
        <ellipse
          cx="48"
          cy="68"
          rx="16"
          ry="3"
          fill="#b44dff"
          fill-opacity="0.15"
        />
        <!-- Wilted stem -->
        <path
          d="M48 67 C48 60 44 54 40 48 C36 42 42 36 48 38"
          stroke="url(#err-grad)"
          stroke-width="2.5"
          stroke-linecap="round"
          fill="none"
        />
        <!-- Drooping leaves -->
        <path
          d="M44 54 C38 52 32 56 30 62"
          stroke="#b44dff"
          stroke-opacity="0.6"
          stroke-width="2"
          stroke-linecap="round"
          fill="none"
        />
        <path
          d="M41 46 C35 42 32 34 36 30"
          stroke="#e0428a"
          stroke-opacity="0.55"
          stroke-width="2"
          stroke-linecap="round"
          fill="none"
        />
        <!-- Question mark bud -->
        <text
          x="45"
          y="35"
          font-size="16"
          fill="#ffb84d"
          fill-opacity="0.9"
          font-family="serif"
          font-weight="bold">?</text
        >
      </svg>
    </div>

    <!-- Status -->
    <p
      class="text-[10px] uppercase tracking-[0.3em] font-medium mb-3"
      style="color:#b44dff"
    >
      {$page.status} · {is404 ? "Not Found" : "Error"}
    </p>

    <!-- Headline -->
    <h1
      class="font-display font-black text-[clamp(22px,4vw,32px)] tracking-tight text-g-text leading-snug mb-3"
    >
      {#if is404 && noteName}
        "{noteName}" doesn't exist
      {:else if is404}
        This page doesn't exist
      {:else}
        Something went wrong
      {/if}
    </h1>

    <!-- Body -->
    <p class="text-[13.5px] text-g-mid font-light leading-relaxed mb-8">
      {#if is404 && noteName}
        This note either hasn't been planted yet, was moved, or the link is
        broken. Try searching the garden for it.
      {:else if is404}
        The page you're looking for isn't here.
      {:else}
        {$page.error?.message ?? "An unexpected error occurred."}
      {/if}
    </p>

    <!-- Actions -->
    <div class="flex flex-wrap items-center justify-center gap-3">
      {#if hasPrev}
        <button
          on:click={() => history.back()}
          class="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium
            text-white no-underline border border-white/[0.12] bg-g-surface
            hover:border-white/25 hover:bg-g-surface2 transition-all"
          style="border-radius:12px 10px 12px 10px/10px 12px 10px 12px"
        >
          ← Go back
        </button>
      {/if}

      <a
        href="{base}/notes"
        class="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold
          text-white no-underline
          bg-gradient-to-br from-[#b44dff] to-[#7c3aff]
          hover:from-[#bf5fff] hover:to-[#9148ff]
          shadow-[0_0_18px_rgba(180,77,255,0.35)]
          hover:shadow-[0_0_28px_rgba(180,77,255,0.55)]
          transition-all"
        style="border-radius:10px 12px 10px 12px/12px 10px 12px 10px"
      >
        Browse the garden →
      </a>

      {#if is404 && noteName}
        <a
          href="{base}/notes?q={encodeURIComponent(noteName)}"
          class="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[12px]
            text-g-low no-underline hover:text-g-mid transition-colors"
        >
          ⌕ Search for "{noteName}"
        </a>
      {/if}
    </div>
  </div>
</div>
