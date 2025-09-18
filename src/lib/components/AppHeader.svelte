<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { GLASS_STYLES, GLASS_COLORS, glassUtils } from '../styles/glass-morphism.js';

  export let nykyinenSivu: string = 'etusivu';
  const dispatch = createEventDispatcher();

  function nav(sivu: string) {
    dispatch('navigate', sivu);
  }
</script>

<header class="{GLASS_STYLES.card} sticky top-0 z-10 m-2 rounded-xl">
  <div class="container mx-auto flex justify-between items-center p-4">
    <h1 class="text-xl font-semibold {GLASS_COLORS.titleGradient}">
      <button class="text-xl font-bold" on:click={() => nav('etusivu')}>
        <span class="flex items-center space-x-2"><span>🎯 Kysymysmestari</span><span class="text-[10px] font-semibold inline-block px-2 py-0.5 rounded-full bg-red-600 text-white">alpha</span></span>
      </button>
    </h1>

    <!-- Navigointipainikkeet -->
    <nav class="flex gap-2">
      <button class="{glassUtils.button(nykyinenSivu === 'etusivu' ? 'primary' : 'ghost')}" on:click={() => nav('etusivu')}>🏠 Etusivu</button>
      <button class="{glassUtils.button(nykyinenSivu === 'asetukset' ? 'primary' : 'ghost')}" on:click={() => nav('asetukset')}>⚙️ Asetukset</button>
      <button class="{glassUtils.button(nykyinenSivu === 'tilastot' ? 'primary' : 'ghost')}" on:click={() => nav('tilastot')}>📊 Tilastot</button>
      <button class="{glassUtils.button(nykyinenSivu === 'admin' ? 'primary' : 'ghost')}" on:click={() => nav('admin')}>🛠️ Admin</button>
    </nav>
  </div>
</header>

<style>
  /* Header uses styles from glass-morphism; minimal local rules here */
</style>
