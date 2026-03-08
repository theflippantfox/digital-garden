<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,600&family=Lora:ital,wght@0,400;0,500;1,400&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="writing-shell">
  <slot />
</div>

<style>
  /* ── Writing shell — overrides the garden's dark-tech palette ── */
  :global(.writing-shell) {
    min-height: 100vh;
    background: #0a0907;
    color: #e2d5c3;
    font-family: "Lora", Georgia, serif;
  }

  /* Warm grain texture — lighter than garden's cold grain */
  :global(.writing-shell)::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
    opacity: 0.7;
  }

  /* Suppress the garden's body::after grain so it doesn't stack */
  :global(body):has(.writing-shell)::after {
    display: none;
  }
</style>
