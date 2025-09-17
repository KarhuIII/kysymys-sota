<script lang="ts">
  import { onMount } from 'svelte';
  import { getDB } from '../database/database.js';
  import type { Kayttaja } from '../database/schema.js';
  import { peliPalvelu } from '../database/gameService.js';
  import { 
    GLASS_STYLES, 
    GLASS_COLORS, 
    GLASS_ANIMATIONS,
    GLASS_BACKGROUNDS,
    GLASS_LAYOUT,
    glassUtils 
  } from '../styles/glass-morphism.js';
  import { vaikeustasoDisplay, SELECTABLE_VAIKEUSTASOT } from "../constants/vaikeustasot";

  // ===============================================
  // PROPS (Props)
  // ===============================================
  
  export let aloitaPeliPelaajilla: ((pelaajat: Kayttaja[], kierrosMaara: number) => void) | undefined = undefined;

  // ===============================================
  // TILAN HALLINTA (State Management)
  // ===============================================
  
  // Tallennetut pelaajat tietokannasta
  let tallennetutPelaajat: Kayttaja[] = [];
  let loading = true;
  
  // Valitut pelaajat (tallennetuista)
  let valitutPelaajat: Set<number> = new Set(); // Pelaaja ID:t
  
  // Vieraspelaajat (väliaikaiset, ei tallenneta)
  let vierasPelaajat: Kayttaja[] = [];
  
  // Uuden vieraspelaajan tiedot
  let uusiVieras = {
    nimi: '',
    ika: undefined as number | undefined,
  vaikeustaso_min: 'oppipoika' as "oppipoika" | "taitaja" | "mestari" | "kuningas",
  vaikeustaso_max: 'taitaja' as "oppipoika" | "taitaja" | "mestari" | "kuningas",
    pelaajan_vari: '#3b82f6'
  };
  
  // Modaalit
  let vierasPelaajaModal = false;
  
  // Kategorioiden hallinta
  let saatavilla_kategoriat: { [kategoria: string]: number } = {};
  let valitutKategoriat: Set<string> = new Set();
  
  // Peliasetukset
  let kierrosMaara = 10;
  const kierrosMaaraVaihtoehdot = [5, 10, 15, 20, 25, 30];
  
  // Pelaajan värien lista
  const pelaajaVarit = [
    { nimi: 'Sininen', koodi: '#3b82f6' },
    { nimi: 'Vihreä', koodi: '#10b981' },
    { nimi: 'Violetti', koodi: '#8b5cf6' },
    { nimi: 'Pinkki', koodi: '#ec4899' },
    { nimi: 'Oranssi', koodi: '#f59e0b' },
    { nimi: 'Punainen', koodi: '#ef4444' },
    { nimi: 'Indigo', koodi: '#6366f1' },
    { nimi: 'Vaaleanvihreä', koodi: '#84cc16' }
  ];

  // ===============================================
  // ELINKAARIFUNKTIOT (Lifecycle Functions)
  // ===============================================
  
  onMount(() => {
    // Lataa aluksi tiedot (ei odoteta palautusta)
    void lataaTiedot();

    // Kuuntele tapahtumaa, jos pelaajat nollataan muualta sovellusta
    const onPlayersReset = () => {
      console.log('ℹ️ Pelaajat nollattu, ladataan tiedot uudelleen...');
      void lataaTiedot();
    };

    window.addEventListener('players-reset', onPlayersReset as EventListener);

    // Palauta siivousfunktio, joka poistetaan kun komponentti tuhoutuu
    return () => {
      window.removeEventListener('players-reset', onPlayersReset as EventListener);
    };
  });

  async function lataaTiedot() {
    try {
      loading = true;
      const db = await getDB();
      
      // Lataa tallennetut pelaajat
      tallennetutPelaajat = await db.haeKaikkiKayttajat();
      
      // Lataa kategoriat
      saatavilla_kategoriat = await peliPalvelu.haeKategoriatMaarineen();
      
      // Lataa tallennetut asetukset localStorage:sta tai aseta oletukset
      const tallennetutAsetukset = localStorage.getItem('peliasetukset');
      if (tallennetutAsetukset) {
        try {
          const asetukset = JSON.parse(tallennetutAsetukset);
          valitutPelaajat = new Set(asetukset.valitutPelaajat || tallennetutPelaajat.map(p => p.id!));
          valitutKategoriat = new Set(asetukset.valitutKategoriat || Object.keys(saatavilla_kategoriat));
          kierrosMaara = asetukset.kierrosMaara || 10;
        } catch (e) {
          // Jos tallennetut asetukset ovat viallisia, käytä oletuksia
          asetaOletukset();
        }
      } else {
        // Ensimmäinen käyttökerta - valitse kaikki oletuksena
        asetaOletukset();
      }
      
      loading = false;
    } catch (error) {
      console.error('Virhe tietojen lataamisessa:', error);
      loading = false;
    }
  }

  function asetaOletukset() {
    valitutPelaajat = new Set(tallennetutPelaajat.map(p => p.id!));
    valitutKategoriat = new Set(Object.keys(saatavilla_kategoriat));
    kierrosMaara = 10;
  }

  // Tallenna asetukset kun ne muuttuvat
  function tallennaAsetukset() {
    const asetukset = {
      valitutPelaajat: Array.from(valitutPelaajat),
      valitutKategoriat: Array.from(valitutKategoriat),
      kierrosMaara
    };
    localStorage.setItem('peliasetukset', JSON.stringify(asetukset));
  }

  // ===============================================
  // PELAAJIEN HALLINTA (Player Management)
  // ===============================================
  
  function togglePelaajaValinta(pelaajaId: number) {
    if (valitutPelaajat.has(pelaajaId)) {
      valitutPelaajat.delete(pelaajaId);
    } else {
      valitutPelaajat.add(pelaajaId);
    }
    valitutPelaajat = new Set(valitutPelaajat); // Triggeröi reactivity
    tallennaAsetukset(); // Tallenna muutos
  }
  
  function valitseKaikki() {
    valitutPelaajat = new Set(tallennetutPelaajat.map(p => p.id!));
  }
  
  function tyhjennäValinnat() {
    valitutPelaajat.clear();
    valitutPelaajat = new Set();
  }
  
  function avaaVierasPelaajaModal() {
    // Resetoi lomake
    uusiVieras = {
      nimi: '',
      ika: undefined,
      vaikeustaso_min: 'oppipoika',
      vaikeustaso_max: 'taitaja',
      pelaajan_vari: '#3b82f6'
    };
    vierasPelaajaModal = true;
  }
  
  function lisaaVierasPelaaja() {
    if (!uusiVieras.nimi.trim()) return;
    
    // Luo väliaikainen pelaaja (ei ID:tä, ei tallenneta)
    const vierasPelaaja: Kayttaja = {
      nimi: uusiVieras.nimi.trim(),
      ika: uusiVieras.ika,
      vaikeustaso_min: uusiVieras.vaikeustaso_min,
      vaikeustaso_max: uusiVieras.vaikeustaso_max,
      pelaajan_vari: uusiVieras.pelaajan_vari,
      luotu: new Date().toISOString()
    };
    
    vierasPelaajat = [...vierasPelaajat, vierasPelaaja];
    vierasPelaajaModal = false;
  }
  
  function poistaVierasPelaaja(index: number) {
    vierasPelaajat.splice(index, 1);
    vierasPelaajat = [...vierasPelaajat];
  }

  // ===============================================
  // PELIN ALOITUS (Game Start)
  // ===============================================
  
  function aloitaPeli() {
    // Yhdistä valitut tallennetut pelaajat ja vieraspelaajat
    const valitutTallennetut = tallennetutPelaajat.filter(p => valitutPelaajat.has(p.id!));
    const kaikkiPelaajat = [...valitutTallennetut, ...vierasPelaajat];
    
    if (kaikkiPelaajat.length === 0) {
      alert('Valitse vähintään yksi pelaaja!');
      return;
    }
    
    if (aloitaPeliPelaajilla) {
      aloitaPeliPelaajilla(kaikkiPelaajat, kierrosMaara);
    }
  }

  // ===============================================
  // KATEGORIOIDEN HALLINTA (Category Management)
  // ===============================================
  
  function toggleKategoria(kategoria: string) {
    if (valitutKategoriat.has(kategoria)) {
      valitutKategoriat.delete(kategoria);
    } else {
      valitutKategoriat.add(kategoria);
    }
    valitutKategoriat = new Set(valitutKategoriat);
    tallennaAsetukset(); // Tallenna muutos
  }
  
  $: yhteensaPelaajat = Array.from(valitutPelaajat).length + vierasPelaajat.length;
</script>

<div class="{GLASS_LAYOUT.container} {GLASS_LAYOUT.section}">
  <!-- Header Card with Glass Effect -->
  <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card} text-center">
    <h1 class="text-4xl font-bold mb-2 {GLASS_COLORS.titleGradient}">🎮 Peliasetukset</h1>
    <p class="{GLASS_COLORS.textSecondary}">Valitse pelaajat ja aloita peli</p>
  </div>

  {#if loading}
    <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card} text-center">
      <div class="{GLASS_COLORS.textSecondary}">Ladataan...</div>
    </div>
  {:else}
    <!-- VAIHE 1: PELAAJIEN VALINTA -->
    <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card} {GLASS_LAYOUT.spacing.medium}">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-semibold">👥 Pelaajat ({yhteensaPelaajat} valittu)</h2>
        <div class="flex gap-2">
          <button class="{glassUtils.button('ghost', 'btn-sm')}" on:click={valitseKaikki}>
            Valitse kaikki
          </button>
          <button class="{glassUtils.button('ghost', 'btn-sm')}" on:click={tyhjennäValinnat}>
            Tyhjennä
          </button>
        </div>
      </div>

      <!-- Tallennetut pelaajat -->
      {#if tallennetutPelaajat.length > 0}
        <div>
          <h3 class="text-lg font-medium mb-3">💾 Tallennetut pelaajat</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-5">
            {#each tallennetutPelaajat as pelaaja (pelaaja.id)}
              <div 
                class="{glassUtils.depthButton(valitutPelaajat.has(pelaaja.id!))}"
                on:click={() => togglePelaajaValinta(pelaaja.id!)}
                on:keydown={(e) => e.key === 'Enter' && togglePelaajaValinta(pelaaja.id!)}
                role="button"
                tabindex="0"
              >
                  <!-- Glass effect tausta -->
                  {#if valitutPelaajat.has(pelaaja.id!)}
                    <div 
                      class="absolute inset-0 rounded-lg shadow-lg" 
                      style="background: {pelaaja.pelaajan_vari || '#6366f1'}40; backdrop-filter: blur(8px);"
                    ></div>
                  {:else}
                    <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm rounded-lg shadow-inner"></div>
                  {/if}
                  
                  <div class="relative z-10 flex items-center gap-3 w-full">
                    <div 
                      class="w-8 h-8 rounded-full flex-shrink-0" 
                      style="background-color: {pelaaja.pelaajan_vari || '#6366f1'}"
                    ></div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm">{pelaaja.nimi}</div>
                      <div class="text-xs text-surface-600-400">
                        {#if pelaaja.vaikeustaso_max}
                          {vaikeustasoDisplay(pelaaja.vaikeustaso_max)}
                        {/if}
                        {#if pelaaja.ika}, {pelaaja.ika}v{/if}
                      </div>
                    </div>
                  </div>
                </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Vieraspelaajat -->
      <div>
        <div class="flex justify-between items-center mb-3">
          <h3 class="text-lg font-medium">👤 Vieraspelaajat</h3>
          <button class="{glassUtils.button('primary', 'btn-sm')}" on:click={avaaVierasPelaajaModal}>
            + Lisää vieraspelaaja
          </button>
        </div>
        
        {#if vierasPelaajat.length > 0}
          <div class="space-y-2">
            {#each vierasPelaajat as vieras, index}
              <div class="flex items-center gap-3 p-3 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-sm ">
                <div 
                  class="w-6 h-6 rounded-full flex-shrink-0" 
                  style="background-color: {vieras.pelaajan_vari}"
                ></div>
                <div class="flex-1">
                  <span class="font-medium">{vieras.nimi}</span>
                  <span class="text-xs text-surface-600-400 ml-2">
                    {#if vieras.vaikeustaso_max}
                      {vaikeustasoDisplay(vieras.vaikeustaso_max)}
                    {/if}
                    {#if vieras.ika}, {vieras.ika}v{/if}
                  </span>
                </div>
                <button 
                  class="{glassUtils.button('ghost', 'btn-sm')}"
                  on:click={() => poistaVierasPelaaja(index)}
                >
                  ✕
                </button>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-surface-600-400 italic">
            Ei vieraspelaajia. Klikkaa "+ Lisää vieraspelaaja" lisätäksesi väliaikaisia pelaajia.
          </p>
        {/if}
      </div>
    </div>

    <!-- VAIHE 2: PELIASETUKSET -->
    <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card} {GLASS_LAYOUT.spacing.medium}">
      <h2 class="text-2xl font-semibold">⚙️ Peliasetukset</h2>
      
      <!-- Kierrosmäärä -->
      <div>
        <div class="mb-3">
          <span class="text-lg font-medium">Kierrosten määrä</span>
        </div>
        <div class="flex gap-3 flex-wrap justify-center">
          {#each kierrosMaaraVaihtoehdot as maara}
            <button 
              class="{kierrosMaara === maara 
                ? 'px-6 py-3 text-lg font-semibold bg-white/90 dark:bg-white/20 backdrop-blur-sm rounded-xl shadow-lg text-surface-900 dark:text-white transition-all duration-300'
                : 'px-6 py-3 text-lg font-semibold rounded-xl border-0 hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-300 text-surface-700 dark:text-surface-300'
              }"
              on:click={() => { kierrosMaara = maara; tallennaAsetukset(); }}
            >
              <span class="relative z-10">{maara}</span>
            </button>
          {/each}
        </div>
        <div class="text-center mt-2">
          <span class="text-sm text-surface-600-400">Valittu: </span>
          <span class="text-primary-600 font-bold">{kierrosMaara} kierrosta</span>
        </div>
      </div>

      <!-- Kategoriat -->
      <div>
        <div class="mb-2">
          <span>Kategoriat (tyhjä = kaikki)</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {#each Object.entries(saatavilla_kategoriat) as [kategoria, maara]}
            <div 
              class="{glassUtils.depthButton(valitutKategoriat.has(kategoria), 'p-3 text-sm text-center font-medium')}"
              on:click={() => toggleKategoria(kategoria)}
              on:keydown={(e) => e.key === 'Enter' && toggleKategoria(kategoria)}
              role="button"
              tabindex="0"
            >
              <!-- Glass effect tausta kategorioille -->
              {#if valitutKategoriat.has(kategoria)}
                <div class="absolute inset-0 bg-white/80 dark:bg-white/20 backdrop-blur-sm rounded shadow-lg"></div>
              {:else}
                <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm rounded shadow-inner"></div>
              {/if}
              
              <div class="relative z-10">
                <span class="block text-xs font-bold">{kategoria}</span>
                <span class="block text-xs opacity-70">({maara})</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- VAIHE 3: ALOITA PELI -->
    <div class="{GLASS_STYLES.card} {GLASS_LAYOUT.padding.card} text-center">
      <button 
        class="{glassUtils.button('primary', 'text-xl px-8 py-3')}"
        disabled={yhteensaPelaajat === 0}
        on:click={aloitaPeli}
      >
        🚀 Aloita peli ({yhteensaPelaajat} pelaajaa, {kierrosMaara} kierrosta)
      </button>
    </div>
  {/if}
</div>

<!-- VIERASPELAAJA MODAALI -->
{#if vierasPelaajaModal}
  <div class="modal-backdrop" role="dialog" aria-label="Modal" tabindex="-1" on:click={() => vierasPelaajaModal = false} on:keydown={(e) => e.key === 'Escape' && (vierasPelaajaModal = false)}>
    <div class="{GLASS_STYLES.modal} {GLASS_LAYOUT.padding.modal} w-full max-w-md" role="dialog" tabindex="-1" on:click|stopPropagation on:keydown={() => {}}>
      <header class="modal-header">
        <h3 class="h3">👤 Lisää vieraspelaaja</h3>
      </header>
      <section class="modal-body space-y-4">
        <!-- Nimi -->
        <label class="label">
          <span>Pelaajan nimi *</span>
          <input 
            class="input" 
            type="text" 
            bind:value={uusiVieras.nimi}
            placeholder="Anna nimi..."
            maxlength="50"
          />
        </label>

        <!-- Ikä -->
        <label class="label">
          <span>Ikä (vapaaehtoinen)</span>
          <input 
            class="input" 
            type="number" 
            bind:value={uusiVieras.ika}
            min="3"
            max="120"
            placeholder="Esim. 25"
          />
        </label>

        <!-- Vaikeustasot -->
        <div class="grid grid-cols-2 gap-4">
          <label class="label">
            <span>Min taso</span>
            <select class="select" bind:value={uusiVieras.vaikeustaso_min}>
              {#each SELECTABLE_VAIKEUSTASOT as taso}
                <option value={taso}>{vaikeustasoDisplay(taso)}</option>
              {/each}
            </select>
          </label>

          <label class="label">
            <span>Max taso</span>
            <select class="select" bind:value={uusiVieras.vaikeustaso_max}>
              {#each SELECTABLE_VAIKEUSTASOT as taso}
                <option value={taso}>{vaikeustasoDisplay(taso)}</option>
              {/each}
            </select>
          </label>
        </div>

        <!-- Väri -->
        <label class="label">
          <span>Pelaajan väri</span>
          <div class="grid grid-cols-4 gap-2 mt-2">
            {#each pelaajaVarit as vari}
              <button
                type="button"
                class="w-10 h-10 rounded-full border-4 transition-all hover:scale-110"
                class:border-white={uusiVieras.pelaajan_vari === vari.koodi}
                class:shadow-lg={uusiVieras.pelaajan_vari === vari.koodi}
                class:border-surface-300={uusiVieras.pelaajan_vari !== vari.koodi}
                style="background-color: {vari.koodi}"
                on:click={() => uusiVieras.pelaajan_vari = vari.koodi}
                title={vari.nimi}
                aria-label="Valitse väri {vari.nimi}"
              ></button>
            {/each}
          </div>
        </label>
      </section>
      <footer class="modal-footer flex gap-2">
        <button class="{glassUtils.button('ghost', 'flex-1')}" on:click={() => vierasPelaajaModal = false}>
          Peruuta
        </button>
        <button 
          class="{glassUtils.button('primary', 'flex-1')}" 
          disabled={!uusiVieras.nimi.trim()}
          on:click={lisaaVierasPelaaja}
        >
          Lisää pelaaja
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .modal {
    max-height: 90vh;
    overflow-y: auto;
  }
</style>