<script lang="ts">
  import { targetPicker } from '../stores/targetPicker';
  import { GLASS_STYLES, GLASS_COLORS } from '../styles/glass-morphism';
  import { onDestroy } from 'svelte';
  import type { PickerState } from '../stores/targetPicker';

  let state: PickerState;
  const unsub = targetPicker.subscribe(s => state = s);
  onDestroy(() => unsub());

  function confirm(target: any) {
    if (state.confirmCallback) state.confirmCallback(target);
    targetPicker.close();
  }

  function close() {
    targetPicker.close();
  }
</script>

{#if state?.visible}
  <div class="fixed inset-0 flex items-center justify-center bg-black/60" style="z-index:10050;">
    <div class="mx-4 md:mx-8 lg:mx-16 {GLASS_STYLES.card} p-6 w-full max-w-3xl overflow-auto" style="max-height:85vh;">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-xl font-bold {GLASS_COLORS.titleGradient}">Valitse kohde</h3>
        <div class="text-sm {GLASS_COLORS.textSecondary}">Kortti: {state.kortti?.nimi} • Hinta: {state.kortti?.kustannus} pistettä</div>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        {#each state.players as pelaaja}
          <button class="{GLASS_STYLES.cardLight} p-3 rounded-lg flex flex-col items-center text-left hover:scale-[1.02] transition" on:click={() => confirm(pelaaja)}>
            <div class="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold mb-2" style="background: linear-gradient(135deg, #60a5fa, #60a5fa33);">{pelaaja.nimi.charAt(0).toUpperCase()}</div>
            <div class="text-sm font-semibold">{pelaaja.nimi}</div>
          </button>
        {/each}
      </div>

      <div class="text-right mt-4">
        <button class="{GLASS_STYLES.buttonGhost}" on:click={close}>Peruuta</button>
      </div>
    </div>
  </div>
{/if}
