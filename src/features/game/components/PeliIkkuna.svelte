<script lang="ts">
  // Wrapper that forwards props to the existing component location so we can
  // migrate gradually. Keep the public API identical to the original.
  import Original from '../../../lib/components/PeliIkkuna.svelte';

  export let pelaajat: any;
  export let kierrosMaara: number;
  export let kategoria: string | undefined;
  export let takaisinCallback: () => void;
</script>

<!-- Forward props to the original implementation for now -->
<Original {pelaajat} {kierrosMaara} {kategoria} {takaisinCallback} />
