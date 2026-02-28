<script lang="ts">
  import { STATUS_META } from '$lib/types';
  import type { NoteStatus } from '$lib/types';

  export let status: NoteStatus;
  export let size: 'sm' | 'md' = 'sm';

  $: meta = STATUS_META[status];
</script>

<span
  class="inline-flex items-center gap-1 font-medium border rounded-full whitespace-nowrap
    {size === 'sm' ? 'text-[10px] px-2.5 py-0.5 tracking-wide' : 'text-xs px-3 py-1'}
    {status === 'seedling'  ? 'text-emerald-400 border-emerald-400/25 bg-emerald-400/8' : ''}
    {status === 'budding'   ? 'text-green-300   border-green-300/25   bg-green-300/8'   : ''}
    {status === 'evergreen' ? 'text-green-200   border-green-200/25   bg-green-200/8'   : ''}
    {status === 'compost'   ? 'text-amber-500   border-amber-500/25   bg-amber-500/8'   : ''}
  "
  title="Note status: {meta.label}"
>
  <span aria-hidden="true">{meta.icon}</span>
  {meta.label}
</span>
