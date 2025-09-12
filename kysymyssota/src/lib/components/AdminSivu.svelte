<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getDB, paivitaKysymykset } from '../database/database.js';
  import type { Kayttaja, Kysymys, Peli, Tilasto } from '../database/schema.js';

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
      
      // Päivitä kysymykset tietokannasta
      await paivitaKysymykset();
      
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
    switch (vaikeustaso) {
      case 'oppipoika': return '🪵';
      case 'taitaja': return '🎨';
      case 'mestari': return '⚔️';
      case 'kuningas': return '👑';
      case 'suurmestari': return '🌌';
      default: return '🪵';
    }
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

<!-- Admin Container - Keskitetty ja rajoitettu leveys -->
<div class="max-w-7xl mx-auto px-4 py-6">
  <!-- Admin navigation -->
  <div class="card p-4 mb-6">
  <nav class="flex flex-wrap gap-2">
    <button 
      class="btn {aktiivnenValkka === 'overview' ? 'variant-filled-primary' : 'variant-ghost'}"
      on:click={() => aktiivnenValkka = 'overview'}
    >
      📊 Yleiskatsaus
    </button>
    <button 
      class="btn {aktiivnenValkka === 'questions' ? 'variant-filled-primary' : 'variant-ghost'}"
      on:click={() => aktiivnenValkka = 'questions'}
    >
      ❓ Kysymykset
    </button>
    <button 
      class="btn {aktiivnenValkka === 'players' ? 'variant-filled-primary' : 'variant-ghost'}"
      on:click={() => aktiivnenValkka = 'players'}
    >
      👥 Pelaajat
    </button>
    <button 
      class="btn {aktiivnenValkka === 'games' ? 'variant-filled-primary' : 'variant-ghost'}"
      on:click={() => aktiivnenValkka = 'games'}
    >
      🎮 Pelit
    </button>
    <button 
      class="btn {aktiivnenValkka === 'stats' ? 'variant-filled-primary' : 'variant-ghost'}"
      on:click={() => aktiivnenValkka = 'stats'}
    >
      📈 Tilastot
    </button>
    <button class="btn variant-ghost ml-auto" on:click={takaisinCallback}>
      ← Takaisin
    </button>
  </nav>
</div>

{#if loading}
  <div class="flex justify-center p-8">
    <div class="text-lg">Ladataan...</div>
  </div>
{:else if aktiivnenValkka === 'overview'}
  <!-- Overview Dashboard -->
  <div class="space-y-6">
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-6 text-center backdrop-blur-md bg-white/10 dark:bg-black/10">
        <div class="text-3xl mb-2">❓</div>
        <div class="text-2xl font-bold text-primary-500">{tilastoData.yhteensaKysymyksia}</div>
        <div class="text-sm text-surface-600-400">Kysymystä</div>
      </div>
      
      <div class="card p-6 text-center backdrop-blur-md bg-white/10 dark:bg-black/10">
        <div class="text-3xl mb-2">👥</div>
        <div class="text-2xl font-bold text-secondary-500">{tilastoData.yhteensaPelaajia}</div>
        <div class="text-sm text-surface-600-400">Pelaajaa</div>
      </div>
      
      <div class="card p-6 text-center backdrop-blur-md bg-white/10 dark:bg-black/10">
        <div class="text-3xl mb-2">🎮</div>
        <div class="text-2xl font-bold text-tertiary-500">{tilastoData.yhteensaPeleja}</div>
        <div class="text-sm text-surface-600-400">Peliä pelattu</div>
      </div>
      
      <div class="card p-6 text-center backdrop-blur-md bg-white/10 dark:bg-black/10">
        <div class="text-3xl mb-2">🏆</div>
        <div class="text-2xl font-bold text-warning-500">{tilastoData.keskiarvokinePisteet}</div>
        <div class="text-sm text-surface-600-400">Keskiarvo pisteet</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card p-6">
      <h3 class="text-xl font-bold mb-4">🚀 Pikavalinnat</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button class="btn variant-filled-secondary" on:click={() => avaPelaajaModal()}>
          👤 Lisää pelaaja
        </button>
        <button class="btn variant-filled-warning" on:click={paivitaKysymyksetUI}>
          🔄 Päivitä kysymykset
        </button>
        <button class="btn variant-filled-tertiary" on:click={() => aktiivnenValkka = 'stats'}>
          📊 Näytä tilastot
        </button>
      </div>
    </div>
  </div>

{:else if aktiivnenValkka === 'questions'}
  <!-- Questions Management -->
  <div class="space-y-6">
    <!-- Filters and Search -->
    <div class="card p-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input 
          class="input"
          type="text"
          placeholder="🔍 Hae kysymyksiä..."
          bind:value={hakuTermi}
        />
        
        <select class="select" bind:value={valittuKategoria}>
          <option value="">Kaikki kategoriat</option>
          {#each kategoriat as kategoria}
            <option value={kategoria}>{kategoria}</option>
          {/each}
        </select>
        
        <select class="select" bind:value={valittuVaikeustaso}>
          <option value="">Kaikki vaikeudet</option>
          <option value="oppipoika">🪵 Oppipoika</option>
          <option value="taitaja">🎨 Taitaja</option>
          <option value="mestari">⚔️ Mestari</option>
          <option value="kuningas">👑 Kuningas</option>
          <option value="suurmestari">🌌 Suurmestari</option>
        </select>
      </div>
    </div>

    <!-- Questions List -->
    <div class="grid grid-cols-1 gap-3">
      {#each filteredKysymykset as kysymys (kysymys.id)}
        <div 
          class="card p-3 backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10"
          class:border-red-400={kysymys.virhe}
          style={kysymys.virhe ? "box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);" : ""}
        >
          <!-- Header row with badges and question -->
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-base">{vaikeustasoIcon(kysymys.vaikeustaso)}</span>
              {#if kysymys.virhe}
                <span class="text-red-500" title="Kysymyksessä on ilmoitettu virhe">🚨</span>
              {/if}
              {#if kysymys.kategoria}
                <span class="badge variant-filled-secondary text-xs">{kysymys.kategoria}</span>
              {/if}
              <span class="badge variant-filled-primary text-xs">{kysymys.pistemaara_perus}p</span>
              {#if kysymys.lahde === 'admin'}
                <span class="badge variant-filled-warning text-xs">Admin</span>
              {/if}
            </div>
          </div>
          
          <!-- Question text -->

          <!-- Answers in compact format -->
          <div class="text-sm space-y-1">
            <div class="flex flex-wrap items-center gap-1">
                <h4 class="text-base font-semibold mb-2 leading-tight">{kysymys.kysymys}</h4>
              <span class="text-green-500 font-semibold text-xs">✓</span>
              <span class="text-green-400">{kysymys.oikea_vastaus}</span>
              <span class="text-red-400 font-semibold text-xs">✗</span>
              <span class="text-red-300">
                {JSON.parse(kysymys.vaarat_vastaukset || '[]').join(' • ')}
              </span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'players'}
  <!-- Players Management -->
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold">Pelaajien hallinta</h2>
      <button class="btn variant-filled-primary" on:click={() => avaPelaajaModal()}>
        ➕ Uusi pelaaja
      </button>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each pelaajat as pelaaja (pelaaja.id)}
        <div class="card p-4">
          <div class="flex items-center space-x-4 mb-4">
            <div 
              class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
              style="background: {pelaaja.pelaajan_vari || '#3b82f6'}"
            >
              {pelaaja.nimi.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 class="font-semibold">{pelaaja.nimi}</h4>
              <div class="text-sm text-surface-600-400">Ikä: {pelaaja.ika || 'Ei määritelty'}</div>
            </div>
          </div>
          
          <div class="space-y-2 text-sm">
            <div>Vaikeustaso: {vaikeustasoIcon(pelaaja.vaikeustaso_min || 'oppipoika')} - {vaikeustasoIcon(pelaaja.vaikeustaso_max || 'taitaja')}</div>
          </div>
          
          <div class="flex justify-end space-x-2 mt-4">
            <button 
              class="btn-icon variant-filled-secondary"
              on:click={() => avaPelaajaModal(pelaaja)}
              title="Muokkaa"
            >
              ✏️
            </button>
            <button 
              class="btn-icon variant-filled-error"
              on:click={() => poistaPelaaja(pelaaja.id!)}
              title="Poista"
            >
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'games'}
  <!-- Games History -->
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold">Pelien historia</h2>
      <button class="btn variant-filled-tertiary" on:click={lataaPelit}>
        🔄 Päivitä
      </button>
    </div>

    <div class="space-y-4">
      {#each pelit as peli (peli.id)}
        <div class="card p-4">
          <div class="flex justify-between items-start">
            <div>
              <h4 class="font-semibold">Peli #{peli.id}</h4>
              <div class="text-sm text-surface-600-400">
                {formatDate(peli.aloitettu)}
              </div>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold">{peli.kysymysten_maara} kysymystä</div>
              <div class="text-sm">Pisteet: {peli.pisteet}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>

{:else if aktiivnenValkka === 'stats'}
  <!-- Statistics -->
  <div class="space-y-6">
    <h2 class="text-2xl font-bold">Tilastot</h2>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="card p-6 text-center">
        <h3 class="text-lg font-semibold mb-2">Kysymykset kategoriansa</h3>
        {#each kategoriat as kategoria}
          <div class="flex justify-between py-1">
            <span>{kategoria}</span>
            <span>{kysymykset.filter(k => k.kategoria === kategoria).length}</span>
          </div>
        {/each}
      </div>
      
      <div class="card p-6 text-center">
        <h3 class="text-lg font-semibold mb-2">Vaikeustasot</h3>
        {#each ['oppipoika', 'taitaja', 'mestari', 'kuningas', 'suurmestari'] as taso}
          <div class="flex justify-between py-1">
            <span>{vaikeustasoIcon(taso)} {taso}</span>
            <span>{kysymykset.filter(k => k.vaikeustaso === taso).length}</span>
          </div>
        {/each}
      </div>
      
      <div class="card p-6 text-center">
        <h3 class="text-lg font-semibold mb-2">Pelit</h3>
        <div class="space-y-2">
          <div>Pelejä yhteensä: {pelit.length}</div>
          <div>Pelaajia yhteensä: {pelaajat.length}</div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Player Modal -->
{#if pelaajaModalAuki}
  <div 
    class="modal-backdrop" 
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
      class="modal backdrop-blur-md bg-white/10 dark:bg-black/10 border border-white/20 dark:border-white/10" 
      role="dialog"
      tabindex="-1"
      on:keydown={(e) => e.key === 'Enter' && e.preventDefault()}
    >
      <header class="modal-header">
        <h3>{valittuPelaaja ? 'Muokkaa pelaajaa' : 'Uusi pelaaja'}</h3>
      </header>
      
      <section class="modal-body space-y-4">
        <label class="label">
          <span>Nimi</span>
          <input class="input" type="text" bind:value={uusiPelaaja.nimi} placeholder="Pelaajan nimi" />
        </label>
        
        <label class="label">
          <span>Ikä</span>
          <input class="input" type="number" bind:value={uusiPelaaja.ika} min="3" max="120" placeholder="Ikä" />
        </label>
        
        <label class="label">
          <span>Pelaajan väri</span>
          <input class="input" type="color" bind:value={uusiPelaaja.pelaajan_vari} />
        </label>
        
        <div class="grid grid-cols-2 gap-4">
          <label class="label">
            <span>Min vaikeustaso</span>
            <select class="select" bind:value={uusiPelaaja.vaikeustaso_min}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
              <option value="suurmestari">🌌 Suurmestari</option>
            </select>
          </label>
          
          <label class="label">
            <span>Max vaikeustaso</span>
            <select class="select" bind:value={uusiPelaaja.vaikeustaso_max}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
              <option value="suurmestari">🌌 Suurmestari</option>
            </select>
          </label>
        </div>
      </section>
      
      <footer class="modal-footer">
        <button class="btn variant-ghost" on:click={suljePelaajaModal}>
          Peruuta
        </button>
        <button class="btn variant-filled-primary" on:click={tallennaPelaaja}>
          Tallenna
        </button>
      </footer>
    </div>
  </div>
{/if}

<!-- Sulkeva admin container div -->
</div>
