<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getDB, paivitaKysymykset } from '../database/database.js';
  import type { Kayttaja, Kysymys, Peli, Tilasto } from '../database/schema.js';
  import { 
    GLASS_STYLES, 
    GLASS_COLORS, 
    GLASS_ANIMATIONS,
    GLASS_BACKGROUNDS,
    GLASS_LAYOUT,
    glassUtils 
  } from '../styles/glass-morphism.js';
  import { vaikeustasoLabel, vaikeustasoIcon as mapVaikeustasoIcon, vaikeustasoDisplay, SELECTABLE_VAIKEUSTASOT } from "../constants/vaikeustasot";

  // ===============================================
  // PROPS & NAVIGATION
  // ===============================================
  
  export let takaisinCallback: () => void;

  // ===============================================
  // STATE MANAGEMENT
  // ===============================================
  
  let aktiivnenValkka = 'overview'; // overview, questions, players, games, stats, settings
  let loading = false;
  
  // Data stores
  let kysymykset: Kysymys[] = [];
  let pelaajat: Kayttaja[] = [];
  let pelit: Peli[] = [];
  let tilastot: any = {};
  
  // Filters and search
  let hakuTermi = '';
  let valittuKategoria = '';
  let valittuVaikeustaso = '';
  let kategoriat: string[] = [];
  
  // Player management
  let valittuPelaaja: Kayttaja | null = null;
  let pelaajaModalAuki = false;
  let uusiPelaaja: Partial<Kayttaja> = {
    nimi: '',
    ika: undefined,
    pelaajan_vari: '#3b82f6',
    vaikeustaso_min: 'oppipoika',
    vaikeustaso_max: 'taitaja'
  };

  // ===============================================
  // LIFECYCLE
  // ===============================================
  
  onMount(async () => {
    console.log('🎯 AdminSivu onMount aloitetaan...');
    
    loading = true;
    
    try {
      await Promise.all([
        paivitaKysymyksetUI(),
        paivitaPelaajaUI(),
        lataaKategoriat(),
        lataaTilastot()
      ]);
      
      console.log('✅ AdminSivu data ladattu onnistuneesti');
    } catch (error) {
      console.error('❌ Virhe AdminSivu datan latauksessa:', error);
    } finally {
      loading = false;
    }
  });

  // ===============================================
  // DATA LOADING FUNCTIONS
  // ===============================================

  async function paivitaKysymyksetUI() {
    try {
      console.log('🔄 Päivitetään kysymykset tietokannasta...');
      
  // Huom: Älä kutsu paivitaKysymykset() automaattisesti täällä
  //       se lataa JSON-kysymykset ja saattaa ylikirjoittaa adminin lisätyt tilastot.
  console.log('ℹ️ Haetaan kysymykset suoraan tietokannasta ilman JSON-päivitystä');
      
      // Lataa kysymykset UI:hin
      const db = await getDB();
      const uudetKysymykset = await db.haeKaikkiKysymykset();
      
      console.log('📊 UI-päivitys: haettiin', uudetKysymykset.length, 'kysymystä');
      console.log('🔍 Vanhat kysymykset UI:ssa:', kysymykset.length);
      
      // Debug: tarkista onko tyhjia kysymyksia
      const tyhjatKysymykset = uudetKysymykset.filter(k => !k.kysymys || k.kysymys.trim() === '');
      if (tyhjatKysymykset.length > 0) {
        console.warn('⚠️ Löydettiin', tyhjatKysymykset.length, 'tyhjää kysymystä:', tyhjatKysymykset);
      }
      
      // Suodata pois tyhjät kysymykset
      const validitKysymykset = uudetKysymykset.filter(k => k.kysymys && k.kysymys.trim() !== '');
      console.log('✅ Valideja kysymyksiä:', validitKysymykset.length);
      
      // Pakota Svelte tunnistamaan muutos
      kysymykset = [...validitKysymykset];
      
      // Odota että DOM päivittyy
      await tick();
      
      console.log(`✅ Kysymykset päivitetty tietokannasta ja UI päivitetty: ${kysymykset.length} kysymystä`);
      console.log(`🔍 Filtteröityjä kysymyksiä: ${filteredKysymykset.length}`);
      
    } catch (error) {
      console.error('❌ Virhe kysymysten päivityksessä:', error);
      alert('Virhe kysymysten päivityksessä: ' + (error as Error).message);
    }
  }

  async function poistaVirhemerkinta(kysymysId: number) {
    console.log('✅ poistaVirhemerkinta() kutsuttu ID:lle:', kysymysId);
    if (confirm('Haluatko varmasti poistaa virhemerkinnän tästä kysymyksestä?')) {
      try {
        const db = await getDB();
        await db.poistaVirhemerkinta(kysymysId);
        console.log('✅ Virhemerkintä poistettu onnistuneesti, päivitetään UI...');
        
        // Päivitetään kysymykset
        await paivitaKysymyksetUI();
        
      } catch (error) {
        console.error('❌ Virhe virhemerkinnän poistamisessa:', error);
      }
    }
  }

  // ===============================================
  // PLAYER MANAGEMENT  
  // ===============================================

  function avaPelaajaModal(pelaaja?: Kayttaja) {
    valittuPelaaja = pelaaja || null;
    if (pelaaja) {
      // Muokkaus: lataa pelaajan tiedot
      uusiPelaaja = {
        nimi: pelaaja.nimi,
        ika: pelaaja.ika,
        pelaajan_vari: pelaaja.pelaajan_vari || '#3b82f6',
        vaikeustaso_min: pelaaja.vaikeustaso_min || 'oppipoika',
        vaikeustaso_max: pelaaja.vaikeustaso_max || 'taitaja'
      };
    } else {
      // Uusi pelaaja: nollaa lomake
      uusiPelaaja = {
        nimi: '',
        ika: undefined,
        pelaajan_vari: '#3b82f6',
        vaikeustaso_min: 'oppipoika',
        vaikeustaso_max: 'taitaja'
      };
    }
    pelaajaModalAuki = true;
  }

  async function paivitaPelaajaUI() {
    try {
      const db = await getDB();
      pelaajat = await db.haeKaikkiKayttajat();
    } catch (error) {
      console.error('Virhe pelaajien latauksessa:', error);
    }
  }

  async function poistaPelaaja(id: number) {
    if (confirm('Haluatko varmasti poistaa tämän pelaajan?')) {
      try {
        const db = await getDB();
        await db.poistaKayttaja(id);
        await paivitaPelaajaUI();
      } catch (error) {
        console.error('Virhe pelaajan poistamisessa:', error);
        alert('Virhe pelaajan poistamisessa: ' + (error as Error).message);
      }
    }
  }

  // Pelaaja-modalin funktiot
  function suljePelaajaModal() {
    pelaajaModalAuki = false;
    valittuPelaaja = null;
    uusiPelaaja = {
      nimi: '',
      ika: undefined,
      pelaajan_vari: '#3b82f6',
      vaikeustaso_min: 'oppipoika',
      vaikeustaso_max: 'taitaja'
    };
  }

  async function tallennaPelaaja() {
    console.log('💾 tallennaPelaaja() kutsuttu');
    
    // Validoi että nimi on asetettu
    if (!uusiPelaaja.nimi?.trim()) {
      alert('Pelaajan nimi on pakollinen!');
      return;
    }
    
    try {
      const db = await getDB();
      
      if (valittuPelaaja) {
        // Päivitä olemassa oleva pelaaja
        console.log('📝 Päivitetään pelaaja ID:', valittuPelaaja.id);
        const paivitettyPelaaja: Kayttaja = {
          ...valittuPelaaja,
          nimi: uusiPelaaja.nimi.trim(),
          ika: uusiPelaaja.ika,
          pelaajan_vari: uusiPelaaja.pelaajan_vari || '#3b82f6',
          vaikeustaso_min: uusiPelaaja.vaikeustaso_min || 'oppipoika',
          vaikeustaso_max: uusiPelaaja.vaikeustaso_max || 'taitaja'
        };
        await db.paivitaKayttaja(paivitettyPelaaja);
        console.log('✅ Pelaaja päivitetty onnistuneesti');
      } else {
        // Luo uusi pelaaja - käytä oikeita parametreja
        console.log('➕ Luodaan uusi pelaaja:', uusiPelaaja.nimi);
        await db.lisaaKayttaja(
          uusiPelaaja.nimi.trim(),
          uusiPelaaja.ika,
          uusiPelaaja.vaikeustaso_min || 'oppipoika',
          uusiPelaaja.vaikeustaso_max || 'taitaja',
          uusiPelaaja.pelaajan_vari || '#3b82f6'
        );
        console.log('✅ Uusi pelaaja luotu onnistuneesti');
      }
      
      suljePelaajaModal();
      await paivitaPelaajaUI();
      
    } catch (error) {
      console.error('❌ Virhe pelaajan tallentamisessa:', error);
      alert('Virhe pelaajan tallentamisessa!');
    }
  }

  // ===============================================
  // GAME AND STATS FUNCTIONS
  // ===============================================

  async function lataaPelit() {
    try {
      const db = await getDB();
      pelit = await db.haeKaikkiPelit();
    } catch (error) {
      console.error('Virhe pelien latauksessa:', error);
    }
  }

  async function lataaTilastot() {
    try {
      const db = await getDB();
      // Lasketaan tilastot manuaalisesti saatavilla olevista tiedoista
      tilastot = {
        keskiarvoPisteet: 0 // Placeholder
      };
    } catch (error) {
      console.error('Virhe tilastojen latauksessa:', error);
    }
  }

  async function lataaKategoriat() {
    try {
      const db = await getDB();
      const kaikki = await db.haeKaikkiKysymykset();
      kategoriat = [...new Set(kaikki.map(k => k.kategoria).filter(k => k))];
    } catch (error) {
      console.error('Virhe kategorioiden latauksessa:', error);
    }
  }

  // ===============================================
  // UTILITY FUNCTIONS
  // ===============================================
  // FILTERED DATA (REACTIVE)
  // ===============================================

  $: filteredKysymykset = kysymykset.filter(k => {
    const matchesSearch = !hakuTermi || 
      k.kysymys.toLowerCase().includes(hakuTermi.toLowerCase()) ||
      k.oikea_vastaus.toLowerCase().includes(hakuTermi.toLowerCase());
    
    const matchesCategory = !valittuKategoria || k.kategoria === valittuKategoria;
    const matchesDifficulty = !valittuVaikeustaso || k.vaikeustaso === valittuVaikeustaso;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  function vaikeustasoIcon(vaikeustaso: string): string {
    return mapVaikeustasoIcon(vaikeustaso);
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Reactive tilastot
  $: tilastoData = {
    yhteensaKysymyksia: kysymykset.length,
    yhteensaPelaajia: pelaajat.length,
    yhteensaPeleja: pelit.length,
    keskiarvokinePisteet: tilastot.keskiarvoPisteet?.toFixed(1) || '0.0'
  };
</script>

<!-- Glass effect background with floating particles -->
<div class="relative min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-blue-900">
  <!-- Floating elements background -->
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    <div class="absolute top-20 left-20 w-32 h-32 bg-blue-400/20 rounded-full blur-xl animate-pulse"></div>
    <div class="absolute top-40 right-32 w-24 h-24 bg-purple-400/20 rounded-full blur-lg animate-bounce"></div>
    <div class="absolute bottom-40 left-16 w-40 h-40 bg-pink-400/20 rounded-full blur-xl animate-pulse"></div>
    <div class="absolute bottom-20 right-20 w-28 h-28 bg-green-400/20 rounded-full blur-lg animate-bounce"></div>
    <div class="absolute top-1/2 left-1/3 w-20 h-20 bg-yellow-400/20 rounded-full blur-md animate-pulse"></div>
  </div>

  <!-- Main content container -->
  <div class="relative z-10 max-w-7xl mx-auto px-4 py-6">
    
    <!-- Navigation Card -->
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6 mb-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          🛠️ Admin Dashboard
        </h1>
        <button 
          class="px-6 py-3 bg-white/20 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                 hover:bg-white/30 dark:hover:bg-surface-700/60 transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg"
          on:click={takaisinCallback}
        >
          ← Takaisin päävalikkoon
        </button>
      </div>
      
      <!-- Tab Navigation -->
      <nav class="flex flex-wrap gap-3 mt-6">
        <button 
          class="px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
                 {aktiivnenValkka === 'overview' 
                   ? 'bg-primary-500/80 text-white shadow-lg' 
                   : 'bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60'}"
          on:click={() => aktiivnenValkka = 'overview'}
        >
          📊 Yleiskatsaus
        </button>
        <button 
          class="px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
                 {aktiivnenValkka === 'questions' 
                   ? 'bg-primary-500/80 text-white shadow-lg' 
                   : 'bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60'}"
          on:click={() => aktiivnenValkka = 'questions'}
        >
          ❓ Kysymykset
        </button>
        <button 
          class="px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
                 {aktiivnenValkka === 'players' 
                   ? 'bg-primary-500/80 text-white shadow-lg' 
                   : 'bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60'}"
          on:click={() => aktiivnenValkka = 'players'}
        >
          👥 Pelaajat
        </button>
        <button 
          class="px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
                 {aktiivnenValkka === 'games' 
                   ? 'bg-primary-500/80 text-white shadow-lg' 
                   : 'bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60'}"
          on:click={() => aktiivnenValkka = 'games'}
        >
          🎮 Pelit
        </button>
        <button 
          class="px-6 py-3 rounded-xl border border-white/30 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]
                 {aktiivnenValkka === 'stats' 
                   ? 'bg-primary-500/80 text-white shadow-lg' 
                   : 'bg-white/20 dark:bg-surface-800/50 hover:bg-white/30 dark:hover:bg-surface-700/60'}"
          on:click={() => aktiivnenValkka = 'stats'}
        >
          📈 Tilastot
        </button>
      </nav>
    </div>

{#if loading}
  <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-12">
    <div class="flex flex-col items-center justify-center space-y-4">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      <div class="text-xl">Ladataan admin-paneelia...</div>
    </div>
  </div>

{:else if aktiivnenValkka === 'overview'}
  <!-- Overview Dashboard -->
  <div class="space-y-6">
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6 text-center">
        <div class="text-4xl mb-3">❓</div>
        <div class="text-3xl font-bold text-primary-500 mb-1">{tilastoData.yhteensaKysymyksia}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Kysymystä</div>
      </div>
      
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6 text-center">
        <div class="text-4xl mb-3">👥</div>
        <div class="text-3xl font-bold text-secondary-500 mb-1">{tilastoData.yhteensaPelaajia}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Pelaajaa</div>
      </div>
      
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6 text-center">
        <div class="text-4xl mb-3">🎮</div>
        <div class="text-3xl font-bold text-tertiary-500 mb-1">{tilastoData.yhteensaPeleja}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Peliä pelattu</div>
      </div>
      
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6 text-center">
        <div class="text-4xl mb-3">🏆</div>
        <div class="text-3xl font-bold text-warning-500 mb-1">{tilastoData.keskiarvokinePisteet}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Keskiarvo pisteet</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
      <h3 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
        🚀 Pikavalinnat
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          class="px-6 py-4 bg-secondary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={() => avaPelaajaModal()}
        >
          👤 Lisää pelaaja
        </button>
        <button 
          class="px-6 py-4 bg-error-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={async () => {
            if (confirm('Haluatko varmasti nollata kaikki pelaajat? Tämä poistaa kaikki pelaajatilit pysyvästi.')) {
              try {
                const db = await getDB();
                await db.tyhjennaKayttajat();
                // Poista myös valitut asetukset paikallisesta tallennuksesta, jotta asetussivu päivittyy oikein
                try { localStorage.removeItem('peliasetukset'); } catch(e) { /* ignore */ }
                await paivitaPelaajaUI();
                // Informoi muut komponentit muutoksesta
                try { window.dispatchEvent(new CustomEvent('players-reset')); } catch(e) { /* ignore */ }
                alert('Pelaajatietokanta nollattu.');
              } catch (err) {
                console.error('Virhe pelaajien nollauksessa:', err);
                alert('Pelaajien nollaus epäonnistui: ' + (err as Error).message);
              }
            }
          }}
        >
          🔄 Nollaa pelaajat
        </button>
        <button 
          class="px-6 py-4 bg-warning-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={paivitaKysymyksetUI}
        >
          🔄 Päivitä kysymykset
        </button>
        <button 
          class="px-6 py-4 bg-tertiary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={() => aktiivnenValkka = 'stats'}
        >
          📊 Näytä tilastot
        </button>
      </div>
    </div>
  </div>

{:else if aktiivnenValkka === 'questions'}
  <!-- Questions Management -->
  <div class="space-y-6">
    <!-- Filters and Search -->
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
      <h3 class="text-xl font-bold mb-4">🔍 Haku ja suodattimet</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input 
          class="px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
          type="text"
          placeholder="🔍 Hae kysymyksiä..."
          bind:value={hakuTermi}
        />
        
        <select 
          class="px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
          bind:value={valittuKategoria}
        >
          <option value="">Kaikki kategoriat</option>
          {#each kategoriat as kategoria}
            <option value={kategoria}>{kategoria}</option>
          {/each}
        </select>
        
        <select 
          class="px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                 focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
          bind:value={valittuVaikeustaso}
        >
          <option value="">Kaikki vaikeudet</option>
          {#each SELECTABLE_VAIKEUSTASOT as taso}
            <option value={taso}>{vaikeustasoDisplay(taso)}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Questions List -->
    <div class="space-y-4">
      {#each filteredKysymykset as kysymys (kysymys.id)}
        <div 
          class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6
                 {kysymys.virhe ? 'border-red-400/50 shadow-red-400/20' : ''}"
        >
          <!-- Header row with badges and question -->
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-2xl">{vaikeustasoIcon(kysymys.vaikeustaso)}</span>
              {#if kysymys.virhe}
                <span class="text-red-500 text-xl" title="Kysymyksessä on ilmoitettu virhe">🚨</span>
                <button 
                  class="px-3 py-1 bg-red-500/80 text-white text-sm rounded-lg hover:bg-red-600/80 transition-colors"
                  on:click={() => poistaVirhemerkinta(kysymys.id!)}
                >
                  Poista virhemerkintä
                </button>
              {/if}
              {#if kysymys.kategoria}
                <span class="px-3 py-1 bg-secondary-500/80 text-white text-sm rounded-lg">{kysymys.kategoria}</span>
              {/if}
              <span class="px-3 py-1 bg-primary-500/80 text-white text-sm rounded-lg">{kysymys.pistemaara_perus}p</span>
              {#if kysymys.lahde === 'admin'}
                <span class="px-3 py-1 bg-warning-500/80 text-white text-sm rounded-lg">Admin</span>
              {/if}
            </div>
          </div>
          
          <!-- Question text -->
          <h4 class="text-lg font-semibold mb-4 leading-tight">{kysymys.kysymys}</h4>

          <!-- Answers in compact format -->
          <div class="space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-green-500 font-semibold">✓ Oikea vastaus:</span>
              <span class="text-green-400 font-medium">{kysymys.oikea_vastaus}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-red-500 font-semibold">✗ Väärät vastaukset:</span>
              <span class="text-red-300">
                {JSON.parse(kysymys.vaarat_vastaukset || '[]').join(' • ')}
              </span>
            </div>
            <!-- Kysymyksen tilastot: oikeat / väärät / prosentti -->
            <div class="flex items-center gap-4 mt-3 text-sm">
              <div class="flex items-center gap-2">
                <span class="text-green-600 font-semibold">✓ Oikeita:</span>
                <span class="font-medium">{kysymys.oikeita_vastauksia || 0}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-red-600 font-semibold">✗ Vääriä:</span>
                <span class="font-medium">{kysymys.vaaria_vastauksia || 0}</span>
              </div>
              <div class="flex items-center gap-2 text-surface-600">
                <span class="font-semibold">📈 Prosentti:</span>
                <span class="font-medium">
                  {((kysymys.oikeita_vastauksia || 0) + (kysymys.vaaria_vastauksia || 0)) > 0
                    ? Math.round(((kysymys.oikeita_vastauksia || 0) / ((kysymys.oikeita_vastauksia || 0) + (kysymys.vaaria_vastauksia || 0))) * 1000) / 10 + '%'
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'players'}
  <!-- Players Management -->
  <div class="space-y-6">
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          👥 Pelaajien hallinta
        </h2>
        <button 
          class="px-6 py-3 bg-primary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={() => avaPelaajaModal()}
        >
          ➕ Uusi pelaaja
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {#each pelaajat as pelaaja (pelaaja.id)}
        <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
          <div class="flex items-center space-x-4 mb-4">
            <div 
              class="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              style="background: {pelaaja.pelaajan_vari || '#3b82f6'}"
            >
              {pelaaja.nimi.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 class="font-semibold text-lg">{pelaaja.nimi}</h4>
              <div class="text-sm text-surface-600 dark:text-surface-400">
                Ikä: {pelaaja.ika || 'Ei määritelty'}
              </div>
            </div>
          </div>
          
          <div class="space-y-3 mb-6">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">Vaikeustaso:</span>
              <span class="text-lg">{vaikeustasoIcon(pelaaja.vaikeustaso_min || 'oppipoika')}</span>
              <span class="text-sm">-</span>
              <span class="text-lg">{vaikeustasoIcon(pelaaja.vaikeustaso_max || 'taitaja')}</span>
            </div>
              <div class="text-sm text-surface-600 dark:text-surface-400">
              {vaikeustasoLabel(pelaaja.vaikeustaso_min || 'oppipoika')} → {vaikeustasoLabel(pelaaja.vaikeustaso_max || 'taitaja')}
            </div>
          </div>
          
          <div class="flex justify-end space-x-3">
            <button 
              class="px-4 py-2 bg-secondary-500/80 text-white rounded-lg backdrop-blur-sm transition-all duration-300 
                     hover:scale-[1.02] hover:shadow-lg border border-white/30"
              on:click={() => avaPelaajaModal(pelaaja)}
              title="Muokkaa"
            >
              ✏️ Muokkaa
            </button>
            <button 
              class="px-4 py-2 bg-error-500/80 text-white rounded-lg backdrop-blur-sm transition-all duration-300 
                     hover:scale-[1.02] hover:shadow-lg border border-white/30"
              on:click={() => poistaPelaaja(pelaaja.id!)}
              title="Poista"
            >
              🗑️ Poista
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'games'}
  <!-- Games History -->
  <div class="space-y-6">
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          🎮 Pelien historia
        </h2>
        <button 
          class="px-6 py-3 bg-tertiary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                 hover:scale-[1.02] hover:shadow-lg border border-white/30"
          on:click={lataaPelit}
        >
          🔄 Päivitä
        </button>
      </div>
    </div>

    <div class="space-y-4">
      {#each pelit as peli (peli.id)}
        <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-semibold text-lg mb-2">🎮 Peli #{peli.id}</h4>
              <div class="text-sm text-surface-600 dark:text-surface-400">
                📅 {formatDate(peli.aloitettu)}
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold text-primary-500">{peli.kysymysten_maara}</div>
              <div class="text-sm text-surface-600 dark:text-surface-400">kysymystä</div>
              <div class="text-lg font-semibold text-warning-500 mt-1">{peli.pisteet}p</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'stats'}
  <!-- Statistics -->
  <div class="space-y-6">
    <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
      <h2 class="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
        📈 Tilastot
      </h2>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
        <h3 class="text-lg font-semibold mb-4 text-center">📂 Kysymykset kategoriansa</h3>
        <div class="space-y-2">
          {#each kategoriat as kategoria}
            <div class="flex justify-between py-2 px-3 bg-white/50 dark:bg-surface-800/50 rounded-lg">
              <span class="font-medium">{kategoria}</span>
              <span class="font-bold text-primary-500">{kysymykset.filter(k => k.kategoria === kategoria).length}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
        <h3 class="text-lg font-semibold mb-4 text-center">🎯 Vaikeustasot</h3>
        <div class="space-y-2">
          {#each SELECTABLE_VAIKEUSTASOT as taso}
            <div class="flex justify-between items-center py-2 px-3 bg-white/50 dark:bg-surface-800/50 rounded-lg">
              <span class="flex items-center gap-2">
                <span class="text-lg">{vaikeustasoIcon(taso)}</span>
                <span class="font-medium">{vaikeustasoLabel(taso)}</span>
              </span>
              <span class="font-bold text-primary-500">{kysymykset.filter(k => k.vaikeustaso === taso).length}</span>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="bg-white/90 dark:bg-surface-900/90 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-6">
        <h3 class="text-lg font-semibold mb-4 text-center">🎮 Yleistä</h3>
        <div class="space-y-4">
          <div class="text-center p-3 bg-white/50 dark:bg-surface-800/50 rounded-lg">
            <div class="text-2xl font-bold text-tertiary-500">{pelit.length}</div>
            <div class="text-sm text-surface-600 dark:text-surface-400">Pelejä yhteensä</div>
          </div>
          <div class="text-center p-3 bg-white/50 dark:bg-surface-800/50 rounded-lg">
            <div class="text-2xl font-bold text-secondary-500">{pelaajat.length}</div>
            <div class="text-sm text-surface-600 dark:text-surface-400">Pelaajia yhteensä</div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Player Modal -->
{#if pelaajaModalAuki}
  <div 
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    role="dialog" 
    aria-modal="true"
    tabindex="-1"
    on:mousedown={(e) => {
      if (e.target === e.currentTarget) {
        suljePelaajaModal();
      }
    }}
    on:keydown={(e) => e.key === 'Escape' && suljePelaajaModal()}
  >
    <div 
      class="bg-white/95 dark:bg-surface-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 
             w-full max-w-md max-h-[90vh] overflow-y-auto"
      role="dialog"
      tabindex="-1"
      on:keydown={(e) => e.key === 'Enter' && e.preventDefault()}
    >
      <div class="p-6">
        <h3 class="text-2xl font-bold mb-6 bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          {valittuPelaaja ? '✏️ Muokkaa pelaajaa' : '➕ Uusi pelaaja'}
        </h3>
        
        <div class="space-y-4">
          <div>
            <label for="pelaaja-nimi" class="block text-sm font-medium mb-2">Nimi</label>
            <input 
              id="pelaaja-nimi"
              class="w-full px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                     focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
              type="text" 
              bind:value={uusiPelaaja.nimi} 
              placeholder="Pelaajan nimi" 
            />
          </div>
          
          <div>
            <label for="pelaaja-ika" class="block text-sm font-medium mb-2">Ikä</label>
            <input 
              id="pelaaja-ika"
              class="w-full px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                     focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
              type="number" 
              bind:value={uusiPelaaja.ika} 
              min="3" 
              max="120" 
              placeholder="Ikä" 
            />
          </div>
          
          <div>
            <label for="pelaaja-vari" class="block text-sm font-medium mb-2">Pelaajan väri</label>
            <div class="flex items-center gap-3">
              <input 
                id="pelaaja-vari"
                class="w-16 h-12 rounded-lg border border-white/30 cursor-pointer"
                type="color" 
                bind:value={uusiPelaaja.pelaajan_vari} 
              />
              <span class="text-sm text-surface-600 dark:text-surface-400">
                Valittu: {uusiPelaaja.pelaajan_vari}
              </span>
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="pelaaja-min-vaikeus" class="block text-sm font-medium mb-2">Min vaikeustaso</label>
                <select 
                id="pelaaja-min-vaikeus"
                class="w-full px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                       focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
                bind:value={uusiPelaaja.vaikeustaso_min}
              >
                {#each SELECTABLE_VAIKEUSTASOT as taso}
                  <option value={taso}>{vaikeustasoDisplay(taso)}</option>
                {/each}
              </select>
            </div>
            
            <div>
              <label for="pelaaja-max-vaikeus" class="block text-sm font-medium mb-2">Max vaikeustaso</label>
                <select 
                id="pelaaja-max-vaikeus"
                class="w-full px-4 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                       focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all duration-300"
                bind:value={uusiPelaaja.vaikeustaso_max}
              >
                {#each SELECTABLE_VAIKEUSTASOT as taso}
                  <option value={taso}>{vaikeustasoDisplay(taso)}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
        
        <div class="flex justify-end space-x-3 mt-8">
          <button 
            class="px-6 py-3 bg-white/50 dark:bg-surface-800/50 backdrop-blur-sm rounded-xl border border-white/30 
                   hover:bg-white/70 dark:hover:bg-surface-700/60 transition-all duration-300"
            on:click={suljePelaajaModal}
          >
            Peruuta
          </button>
          <button 
            class="px-6 py-3 bg-primary-500/80 text-white rounded-xl backdrop-blur-sm transition-all duration-300 
                   hover:scale-[1.02] hover:shadow-lg border border-white/30"
            on:click={tallennaPelaaja}
          >
            💾 Tallenna
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

  </div>
</div>
