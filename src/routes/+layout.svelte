<script lang="ts">
  import "../app.css";
  import Blobs from "$lib/components/Blobs.svelte";
  import Topbar from "$lib/components/Topbar.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { page } from "$app/stores";
  import { base } from "$app/paths";
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  let sidebarOpen = false;

  $: if ($page.url) sidebarOpen = false;

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") sidebarOpen = false;
  }
</script>

<svelte:window on:keydown={onKeydown} />

<Blobs />

<div class="relative z-10 flex flex-col min-h-screen">
  <Topbar {sidebarOpen} on:toggleSidebar={() => (sidebarOpen = !sidebarOpen)} />

  <div class="flex h-[calc(100vh-58px)]">
    <!-- Desktop sidebar -->
    <div class="hidden md:block shrink-0">
      <Sidebar
        notes={data.notes}
        totalNotes={data.notes.length}
        open={false}
        on:close={() => {}}
      />
    </div>

    <!-- Mobile sidebar drawer -->
    <div class="md:hidden">
      <Sidebar
        notes={data.notes}
        totalNotes={data.notes.length}
        open={sidebarOpen}
        on:close={() => (sidebarOpen = false)}
      />
    </div>

    <main class="flex-1 min-w-0 overflow-y-auto" id="main-content">
      <slot />
    </main>
  </div>
</div>

<!-- Graph FAB — hidden on the graph page itself -->
{#if !$page.url.pathname.endsWith("/graph")}
  <a
    href="{base}/graph"
    class="fixed bottom-6 right-6 z-30 w-12 h-12 text-white font-bold text-base
    bg-gradient-to-br from-[#b44dff] to-[#ff5c3a]
    shadow-[0_0_24px_rgba(180,77,255,0.4),0_0_48px_rgba(180,77,255,0.15)]
    hover:scale-110 hover:shadow-[0_0_36px_rgba(180,77,255,0.6)]
    transition-all duration-200 no-underline
    flex items-center justify-center
    focus-visible:ring-2 focus-visible:ring-[#b44dff]/50"
    style="border-radius: 52% 48% 54% 46% / 48% 54% 46% 52%;
         animation: breatheFab 10s ease-in-out infinite alternate"
    title="Graph view"
    aria-label="Graph view">✦</a
  >
{/if}
