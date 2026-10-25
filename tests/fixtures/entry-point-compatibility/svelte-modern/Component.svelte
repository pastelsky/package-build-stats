<script lang="ts">
  import type { Snippet } from "svelte"
  import { counter } from "./counter.svelte.js"
  let { children }: { children?: Snippet } = $props()
</script>
<button onclick={() => counter.value++}>{counter.value}</button>
{@render children?.()}
