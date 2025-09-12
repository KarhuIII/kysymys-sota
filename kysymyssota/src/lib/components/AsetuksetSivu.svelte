<script lang="ts">
  import { onMount } from 'svelte';
  import { getDB } from '../database/database.js';
  import type { Kayttaja } from '../database/schema.js';
  import { peliPalvelu } from '../database/gameService.js';

  // ===============================================
  // PROPS (Props)
  // ===============================================
  
  export let aloitaPeliPelaajilla: ((pelaajat: Kayttaja[], kierrosMaara: number) => void) | undefined = undefined;

  // ===============================================
  // TILAN HALLINTA (State Management)
  // ===============================================
  
  let pelaajat: Kayttaja[] = [];
  let loading = true;
  let uusiPelaajaModal = false;
  let muokkaaPelaajaModal = false;
  let editoitavaPelaaja: Kayttaja | null = null;
  
  // Kategorioiden hallinta
  let saatavilla_kategoriat: { [kategoria: string]: number } = {};
  let valitutKategoriat: Set<string> = new Set();
  
  // Peliasetukset
  let kierrosMaara = 10; // Oletuksena 10 kysymystä
  const kierrosMaaraVaihtoehdot = [5, 10, 15, 20, 25, 30];
  
  // Uuden pelaajan tiedot
  let uusiNimi = '';
  let uusiIka: number | undefined = undefined;
  let uusiVaikeustasoMin: 'oppipoika' | 'taitaja' | 'mestari' | 'kuningas' | 'suurmestari' = 'oppipoika';
  let uusiVaikeustasoMax: 'oppipoika' | 'taitaja' | 'mestari' | 'kuningas' | 'suurmestari' = 'taitaja';
  let uusiVari = '#3b82f6'; // Sininen oletuksena

  // Pelaajan värien lista (värikoodit teema-väreille)
  const pelaajaVarit = [
    { nimi: 'Sininen', koodi: '#3b82f6', gradientFrom: 'from-blue-500', gradientTo: 'to-blue-700' },
    { nimi: 'Vihreä', koodi: '#10b981', gradientFrom: 'from-emerald-500', gradientTo: 'to-emerald-700' },
    { nimi: 'Violetti', koodi: '#8b5cf6', gradientFrom: 'from-violet-500', gradientTo: 'to-violet-700' },
    { nimi: 'Pinkki', koodi: '#ec4899', gradientFrom: 'from-pink-500', gradientTo: 'to-pink-700' },
    { nimi: 'Oranssi', koodi: '#f59e0b', gradientFrom: 'from-amber-500', gradientTo: 'to-amber-700' },
    { nimi: 'Punainen', koodi: '#ef4444', gradientFrom: 'from-red-500', gradientTo: 'to-red-700' },
    { nimi: 'Indigo', koodi: '#6366f1', gradientFrom: 'from-indigo-500', gradientTo: 'to-indigo-700' },
    { nimi: 'Vaaleanvihreä', koodi: '#84cc16', gradientFrom: 'from-lime-500', gradientTo: 'to-lime-700' }
  ];

  // ===============================================
  // ELINKAARIFUNKTIOT (Lifecycle Functions)
  // ===============================================

  onMount(async () => {
    await lataaPelaajat();
    await lataaKategoriat();
  });

  // ===============================================
  // TIETOKANTAFUNKTIOT (Database Functions)
  // ===============================================

  /**
   * Lataa saatavilla olevat kategoriat
   */
  async function lataaKategoriat() {
    try {
      saatavilla_kategoriat = await peliPalvelu.haeKategoriatMaarineen();
      // Valitse kaikki kategoriat oletuksena
      valitutKategoriat = new Set(Object.keys(saatavilla_kategoriat));
    } catch (error) {
      console.error('Virhe kategorioiden latauksessa:', error);
    }
  }

  /**
   * Lataa kaikki pelaajat tietokannasta
   */
  async function lataaPelaajat() {
    try {
      loading = true;
      const db = await getDB();
      // Hae kaikki käyttäjät (tarvitsemme uuden metodin tietokantaan)
      pelaajat = await haeKaikkiPelaajat(db);
    } catch (error) {
      console.error('Virhe pelaajien latauksessa:', error);
    } finally {
      loading = false;
    }
  }

  /**
   * Apufunktio kaikkien pelaajien hakemiseen
   */
  async function haeKaikkiPelaajat(db: any): Promise<Kayttaja[]> {
    return new Promise((resolve, reject) => {
      if (!db.db) return resolve([]);
      
      const transaction = db.db.transaction(['kayttajat'], 'readonly');
      const store = transaction.objectStore('kayttajat');
      const pelaajat: Kayttaja[] = [];

      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          pelaajat.push(cursor.value);
          cursor.continue();
        } else {
          resolve(pelaajat);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Tallenna uusi pelaaja
   */
  async function tallennaUusiPelaaja() {
    if (!uusiNimi.trim()) return;

    try {
      const db = await getDB();
      
      await db.lisaaKayttaja(
        uusiNimi.trim(),
        uusiIka,
        uusiVaikeustasoMin,
        uusiVaikeustasoMax,
        uusiVari  // Lisätään väri parametriksi
      );

      // Tyhjennä lomake ja sulje modal
      uusiNimi = '';
      uusiIka = undefined;
      uusiVaikeustasoMin = 'oppipoika';
      uusiVaikeustasoMax = 'taitaja';
      uusiVari = '#3b82f6';
      uusiPelaajaModal = false;

      // Lataa pelaajat uudelleen
      await lataaPelaajat();
    } catch (error) {
      console.error('Virhe pelaajan tallennuksessa:', error);
      alert('Virhe pelaajan tallennuksessa!');
    }
  }

  /**
   * Avaa pelaajan muokkaustila
   */
  async function avaaMuokkaus(pelaaja: Kayttaja) {
    editoitavaPelaaja = pelaaja;
    uusiNimi = pelaaja.nimi;
    uusiIka = pelaaja.ika;
    uusiVaikeustasoMin = pelaaja.vaikeustaso_min || 'oppipoika';
    uusiVaikeustasoMax = pelaaja.vaikeustaso_max || 'taitaja';
    uusiVari = pelaaja.pelaajan_vari || '#3b82f6';
    muokkaaPelaajaModal = true;
  }

  /**
   * Tallenna pelaajan muutokset
   */
  async function tallennaMuutokset() {
    if (!editoitavaPelaaja || !uusiNimi.trim()) return;

    try {
      const db = await getDB();
      
      // Päivitä pelaajan tiedot
      const paivitettyPelaaja: Kayttaja = {
        ...editoitavaPelaaja,
        nimi: uusiNimi.trim(),
        ika: uusiIka,
        vaikeustaso_min: uusiVaikeustasoMin,
        vaikeustaso_max: uusiVaikeustasoMax,
        pelaajan_vari: uusiVari
      };

      await paivitaPelaajanTiedot(db, paivitettyPelaaja);

      // Tyhjennä lomake ja sulje modal
      editoitavaPelaaja = null;
      uusiNimi = '';
      uusiIka = undefined;
      uusiVaikeustasoMin = 'oppipoika';
      uusiVaikeustasoMax = 'taitaja';
      uusiVari = '#3b82f6';
      muokkaaPelaajaModal = false;

      // Lataa pelaajat uudelleen
      await lataaPelaajat();
    } catch (error) {
      console.error('Virhe pelaajan päivityksessä:', error);
      alert('Virhe pelaajan päivityksessä!');
    }
  }

  /**
   * Apufunktio pelaajan tietojen päivittämiseen tietokannassa
   */
  async function paivitaPelaajanTiedot(db: any, pelaaja: Kayttaja): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!db.db || !pelaaja.id) return reject(new Error('Tietokanta ei ole saatavilla tai pelaajan ID puuttuu'));
      
      const transaction = db.db.transaction(['kayttajat'], 'readwrite');
      const store = transaction.objectStore('kayttajat');
      
      const request = store.put(pelaaja);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Poista pelaaja
   */
  async function poistaPelaaja(pelaaja: Kayttaja) {
    if (!pelaaja.id) return;
    
    const vahvistus = confirm(`Haluatko varmasti poistaa pelaajan "${pelaaja.nimi}"?\n\nTämä poistaa myös kaikki pelaajan pelitiedot pysyvästi.`);
    if (!vahvistus) return;

    try {
      const db = await getDB();
      await poistaPelaajaKannasta(db, pelaaja.id);
      
      // Lataa pelaajat uudelleen
      await lataaPelaajat();
    } catch (error) {
      console.error('Virhe pelaajan poistamisessa:', error);
      alert('Virhe pelaajan poistamisessa!');
    }
  }

  /**
   * Apufunktio pelaajan poistamiseen tietokannasta
   */
  async function poistaPelaajaKannasta(db: any, pelaajaId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!db.db) return reject(new Error('Tietokanta ei ole saatavilla'));
      
      const transaction = db.db.transaction(['kayttajat'], 'readwrite');
      const store = transaction.objectStore('kayttajat');
      
      const request = store.delete(pelaajaId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Peruuta muokkaus
   */
  function peruutaMuokkaus() {
    editoitavaPelaaja = null;
    uusiNimi = '';
    uusiIka = undefined;
    uusiVaikeustasoMin = 'oppipoika';
    uusiVaikeustasoMax = 'taitaja';
    uusiVari = '#3b82f6';
    muokkaaPelaajaModal = false;
  }

  // ===============================================
  // APUFUNKTIOT (Helper Functions)
  // ===============================================

  /**
   * Hae pelaajan värin gradient-luokat
   */
  function haePelaajanVariGradient(pelaaja: Kayttaja): string {
    if (pelaaja.pelaajan_vari) {
      // Käytä tallennettua väriä
      return `from-[${pelaaja.pelaajan_vari}] to-[${pelaaja.pelaajan_vari}dd]`;
    }
    
    // Käytetään pelaajan ID:tä värin valintaan fallbackina
    const variIndex = ((pelaaja.id || 1) - 1) % pelaajaVarit.length;
    const vari = pelaajaVarit[variIndex];
    return `${vari.gradientFrom} ${vari.gradientTo}`;
  }

  /**
   * Hae pelaajan värikoodi
   */
  function haePelaajanVariKoodi(pelaaja: Kayttaja): string {
    if (pelaaja.pelaajan_vari) {
      return pelaaja.pelaajan_vari;
    }
    
    const variIndex = ((pelaaja.id || 1) - 1) % pelaajaVarit.length;
    return pelaajaVarit[variIndex].koodi;
  }

  /**
   * Vaihda kategorian valinta
   */
  function vaihdaKategorianValinta(kategoria: string) {
    if (valitutKategoriat.has(kategoria)) {
      valitutKategoriat.delete(kategoria);
    } else {
      valitutKategoriat.add(kategoria);
    }
    valitutKategoriat = valitutKategoriat; // Trigger reactive update
  }

  /**
   * Valitse kaikki kategoriat
   */
  function valitseKaikkiKategoriat() {
    valitutKategoriat = new Set(Object.keys(saatavilla_kategoriat));
  }

  /**
   * Poista kaikki kategoriat
   */
  function poistaKaikkiKategoriat() {
    valitutKategoriat = new Set();
  }

  /**
   * Aloita peli valituilla pelaajilla
   */
  async function aloitaPeli() {
    if (pelaajat.length === 0) {
      alert('Lisää ensin vähintään yksi pelaaja!');
      return;
    }

    if (valitutKategoriat.size === 0) {
      alert('Valitse vähintään yksi kategoria!');
      return;
    }

    console.log('🎮 Aloitetaan peli kategorioilla:', Array.from(valitutKategoriat));
    console.log('🔢 Kierrosmäärä:', kierrosMaara);

    // Käytä callback-funktiota jos saatavilla
    if (aloitaPeliPelaajilla) {
      aloitaPeliPelaajilla(pelaajat, kierrosMaara);
      return;
    }

    // Legacy-toiminto (vanhalle toteutukselle)
    const valittuPelaaja = pelaajat[0];
    
    try {
      const peli = await peliPalvelu.aloitaPeli(
        valittuPelaaja.nimi,
        kierrosMaara, // Käytä valittua kierrosmäärää
        undefined, // Ei kategoriarajoitusta
        undefined, // Ei vaikeustaso-rajoitusta
        valittuPelaaja.ika,
        valittuPelaaja.vaikeustaso_min,
        valittuPelaaja.vaikeustaso_max
      );
      
      alert(`Peli aloitettu pelaajalle ${valittuPelaaja.nimi}! Ensimmäinen kysymys: ${peli.nykyinenKysymys?.kysymys}`);
    } catch (error) {
      console.error('Virhe pelin aloituksessa:', error);
      alert('Virhe pelin aloituksessa!');
    }
  }

  /**
   * Formatoi ikä näyttöä varten
   */
  function formatoiIka(ika?: number): string {
    return ika ? `${ika} vuotta` : 'Ei määritelty';
  }

  /**
   * Formatoi vaikeustaso näyttöä varten
   */
  function formatoiVaikeustaso(taso?: string): string {
    switch (taso) {
      case 'oppipoika': return '🪵 Oppipoika';
      case 'taitaja': return '🎨 Taitaja';
      case 'mestari': return '⚔️ Mestari';
      case 'kuningas': return '👑 Kuningas';
      case 'suurmestari': return '🌌 Suurmestari';
      default: return 'Ei määritelty';
    }
  }
</script>

<!-- =============================================== -->
<!-- PÄÄSISÄLTÖ (Main Content) -->
<!-- =============================================== -->

<div class="container mx-auto p-6 space-y-8">
  <!-- Otsikko -->
  <div class="text-center space-y-4">
    <h1 class="text-4xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
      ⚙️ Peliasetukset
    </h1>
    <p class="text-lg text-surface-600-400">
      Hallitse pelaajia ja heidän asetuksiaan
    </p>
  </div>

  <!-- Pelaajien lista -->
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-semibold">👥 Pelaajat ({pelaajat.length})</h2>
      <button 
        class="btn variant-filled-primary shadow-lg"
        on:click={() => uusiPelaajaModal = true}
      >
        ➕ Lisää pelaaja
      </button>
    </div>

    {#if loading}
      <!-- Latausanimaatio -->
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        <span class="ml-3 text-lg">Ladataan pelaajia...</span>
      </div>
    {:else if pelaajat.length === 0}
      <!-- Tyhjä tila -->
      <div class="text-center py-12 space-y-4">
        <div class="text-6xl">🎮</div>
        <h3 class="text-xl font-medium">Ei pelaajia vielä</h3>
        <p class="text-surface-600-400">Aloita lisäämällä ensimmäinen pelaaja!</p>
        <button 
          class="btn variant-filled-primary"
          on:click={() => uusiPelaajaModal = true}
        >
          Lisää ensimmäinen pelaaja
        </button>
      </div>
    {:else}
      <!-- Pelaajien kortit -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each pelaajat as pelaaja (pelaaja.id)}
          <div 
            class="card p-6 shadow-xl border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl relative backdrop-blur bg-white/10 dark:bg-black/10"
            style="border-color: {haePelaajanVariKoodi(pelaaja)}; box-shadow: 0 0 20px {haePelaajanVariKoodi(pelaaja)}33; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);"
          >
            <!-- Poista-painike yläkulmassa -->
            <button 
              class="absolute top-3 right-3 w-8 h-8 text-red-500 flex items-center justify-center transition-all duration-200 hover:scale-110 z-10"
              style="text-shadow: 0 2px 4px rgba(0,0,0,0.75);"
              on:click={() => poistaPelaaja(pelaaja)}
              title="Poista pelaaja"
            >
              ✕
            </button>

            <!-- Pelaajan avatar ja nimi -->
            <div class="text-center space-y-4 mb-6">
              <div 
                class="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg"
                style="background: linear-gradient(135deg, {haePelaajanVariKoodi(pelaaja)}, {haePelaajanVariKoodi(pelaaja)}dd)"
              >
                <span class="text-2xl font-bold text-white">
                  {pelaaja.nimi.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 class="text-xl font-bold" style="color: {haePelaajanVariKoodi(pelaaja)}">
                {pelaaja.nimi}
              </h3>
            </div>

            <!-- Pelaajan tiedot -->
            <div class="space-y-3 mb-6">
              <div class="flex justify-between items-center">
                <span class="text-sm text-surface-600-400">Ikä:</span>
                <span class="font-medium">{formatoiIka(pelaaja.ika)}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-sm text-surface-600-400">Min. taso:</span>
                <span class="text-sm">{formatoiVaikeustaso(pelaaja.vaikeustaso_min)}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-sm text-surface-600-400">Max. taso:</span>
                <span class="text-sm">{formatoiVaikeustaso(pelaaja.vaikeustaso_max)}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-sm text-surface-600-400">Pisteet:</span>
                <span class="font-bold text-lg" style="color: {haePelaajanVariKoodi(pelaaja)}">>
                  {pelaaja.pisteet_yhteensa || 0}
                </span>
              </div>
            </div>

            <!-- Muokkaa-painike -->
            <div class="mt-6">
              <button 
                class="btn btn-sm variant-soft w-full"
                style="background-color: {haePelaajanVariKoodi(pelaaja)}22; color: {haePelaajanVariKoodi(pelaaja)}"
                on:click={() => avaaMuokkaus(pelaaja)}
              >
                ✏️ Muokkaa pelaajaa
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Peliasetukset -->
  <div class="card p-6 mb-6 space-y-4 bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
    <h3 class="text-xl font-bold">🎯 Peliasetukset</h3>
    
    <!-- Kierrosmäärä -->
    <div class="space-y-3">
      <span class="text-sm font-medium">🔢 Kierrosmäärä</span>
      <div class="flex gap-2 flex-wrap">
        {#each kierrosMaaraVaihtoehdot as vaihtoehto}
          <button
            class="btn btn-sm px-3 py-1 transition-all duration-200"
            class:variant-filled-primary={kierrosMaara === vaihtoehto}
            class:variant-soft={kierrosMaara !== vaihtoehto}
            on:click={() => kierrosMaara = vaihtoehto}
          >
            {vaihtoehto}
          </button>
        {/each}
      </div>
      <div class="text-xs text-surface-600-400">
        <span class="font-medium text-primary-500">{kierrosMaara}</span> kysymystä per peli
      </div>
    </div>
  </div>

  <!-- Kategoriavalinta -->
  {#if Object.keys(saatavilla_kategoriat).length > 0}
    <div class="card p-6 mb-6 space-y-4 bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
      <div class="flex justify-between items-center">
        <h3 class="text-xl font-bold">🎯 Kategoriat</h3>
        <div class="flex gap-2">
          <button class="btn variant-soft-primary btn-sm" on:click={valitseKaikkiKategoriat}>
            Valitse kaikki
          </button>
          <button class="btn variant-soft-secondary btn-sm" on:click={poistaKaikkiKategoriat}>
            Poista kaikki
          </button>
        </div>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each Object.entries(saatavilla_kategoriat) as [kategoria, maara]}
          <label class="card p-3 cursor-pointer hover:variant-soft-primary transition-all duration-200"
                 class:variant-filled-primary={valitutKategoriat.has(kategoria)}
                 class:variant-soft={!valitutKategoriat.has(kategoria)}>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  class="checkbox" 
                  checked={valitutKategoriat.has(kategoria)}
                  on:change={() => vaihdaKategorianValinta(kategoria)}
                />
                <span class="font-medium">📚 {kategoria}</span>
              </div>
              <span class="badge variant-filled-secondary text-xs">
                {maara} kys.
              </span>
            </div>
          </label>
        {/each}
      </div>
      
      <div class="text-center text-sm text-surface-600-400">
        Valittu {valitutKategoriat.size} / {Object.keys(saatavilla_kategoriat).length} kategoriaa
      </div>
    </div>
  {/if}

  <!-- Iso aloita peli -painike -->
  {#if pelaajat.length > 0}
    <div class="text-center py-8">
      <button 
        class="btn variant-filled-primary text-xl px-12 py-4 shadow-2xl hover:scale-105 transition-all duration-300"
        class:variant-filled-surface={valitutKategoriat.size === 0}
        style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); box-shadow: 0 10px 30px #3b82f633;"
        on:click={aloitaPeli}
        disabled={valitutKategoriat.size === 0}
      >
        🚀 ALOITA KYSYMYSSOTA
      </button>
      <p class="text-sm text-surface-600-400 mt-2">
        {#if valitutKategoriat.size === 0}
          Valitse vähintään yksi kategoria aloittaaksesi
        {:else}
          Pelaajat vastaavat vuorotellen oman vaikeustason kysymyksiin
        {/if}
      </p>
    </div>
  {/if}
</div>

<!-- =============================================== -->
<!-- UUSI PELAAJA MODAL -->
<!-- =============================================== -->

{#if uusiPelaajaModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="card p-8 max-w-md w-full space-y-6 shadow-2xl backdrop-blur-md bg-white/20 dark:bg-black/20" style="backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.2);">
      <h3 class="text-2xl font-bold text-center">➕ Lisää uusi pelaaja</h3>
      
      <div class="space-y-4">
        <!-- Nimi -->
        <div>
          <label for="pelaaja-nimi" class="label text-sm font-medium mb-2">
            <span>Pelaajan nimi *</span>
          </label>
          <input 
            id="pelaaja-nimi"
            type="text" 
            class="input variant-form-material" 
            placeholder="Kirjoita nimi..."
            bind:value={uusiNimi}
            maxlength="20"
          />
        </div>

        <!-- Ikä -->
        <div>
          <label for="pelaaja-ika" class="label text-sm font-medium mb-2">
            <span>Ikä (valinnainen)</span>
          </label>
          <input 
            id="pelaaja-ika"
            type="number" 
            class="input variant-form-material" 
            placeholder="Esim. 25"
            bind:value={uusiIka}
            min="3"
            max="99"
          />
        </div>

        <!-- Vaikeustasot -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="min-taso" class="label text-sm font-medium mb-2">
              <span>Min. taso</span>
            </label>
            <select id="min-taso" class="select variant-form-material" bind:value={uusiVaikeustasoMin}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
            </select>
          </div>

          <div>
            <label for="max-taso" class="label text-sm font-medium mb-2">
              <span>Max. taso</span>
            </label>
            <select id="max-taso" class="select variant-form-material" bind:value={uusiVaikeustasoMax}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
            </select>
          </div>
        </div>

        <!-- Väri -->
        <div>
          <span class="text-sm font-medium mb-2 block">Pelaajan väri</span>
          <div class="grid grid-cols-4 gap-2">
            {#each pelaajaVarit as vari}
              <button
                type="button"
                class="w-12 h-12 rounded-full border-2 transition-all duration-200 hover:scale-110"
                class:border-white={uusiVari === vari.koodi}
                class:border-gray-300={uusiVari !== vari.koodi}
                style="background: linear-gradient(135deg, {vari.koodi}, {vari.koodi}dd);"
                on:click={() => uusiVari = vari.koodi}
                title={vari.nimi}
              >
                {#if uusiVari === vari.koodi}
                  <span class="text-white text-lg">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Painikkeet -->
      <div class="flex gap-3">
        <button 
          class="btn variant-soft flex-1"
          on:click={() => uusiPelaajaModal = false}
        >
          Peruuta
        </button>
        <button 
          class="btn variant-filled-primary flex-1"
          disabled={!uusiNimi.trim()}
          on:click={tallennaUusiPelaaja}
        >
          Tallenna
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- =============================================== -->
<!-- MUOKKAA PELAAJA MODAL -->
<!-- =============================================== -->

{#if muokkaaPelaajaModal && editoitavaPelaaja}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="card p-8 max-w-md w-full space-y-6 shadow-2xl backdrop-blur bg-white/20 dark:bg-black/20" style="backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);">
      <h3 class="text-2xl font-bold text-center">✏️ Muokkaa pelaajaa</h3>
      
      <div class="space-y-4">
        <!-- Nimi -->
        <div>
          <label for="muokkaa-nimi" class="label text-sm font-medium mb-2">
            <span>Pelaajan nimi *</span>
          </label>
          <input 
            id="muokkaa-nimi"
            type="text" 
            class="input variant-form-material" 
            placeholder="Kirjoita nimi..."
            bind:value={uusiNimi}
            maxlength="20"
          />
        </div>

        <!-- Ikä -->
        <div>
          <label for="muokkaa-ika" class="label text-sm font-medium mb-2">
            <span>Ikä (valinnainen)</span>
          </label>
          <input 
            id="muokkaa-ika"
            type="number" 
            class="input variant-form-material" 
            placeholder="Esim. 25"
            bind:value={uusiIka}
            min="3"
            max="99"
          />
        </div>

        <!-- Vaikeustasot -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="muokkaa-min-taso" class="label text-sm font-medium mb-2">
              <span>Min. taso</span>
            </label>
            <select id="muokkaa-min-taso" class="select variant-form-material" bind:value={uusiVaikeustasoMin}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
            </select>
          </div>

          <div>
            <label for="muokkaa-max-taso" class="label text-sm font-medium mb-2">
              <span>Max. taso</span>
            </label>
            <select id="muokkaa-max-taso" class="select variant-form-material" bind:value={uusiVaikeustasoMax}>
              <option value="oppipoika">🪵 Oppipoika</option>
              <option value="taitaja">🎨 Taitaja</option>
              <option value="mestari">⚔️ Mestari</option>
              <option value="kuningas">👑 Kuningas</option>
            </select>
          </div>
        </div>

        <!-- Väri -->
        <div>
          <span class="text-sm font-medium mb-2 block">Pelaajan väri</span>
          <div class="grid grid-cols-4 gap-2">
            {#each pelaajaVarit as vari}
              <button
                type="button"
                class="w-12 h-12 rounded-full border-2 transition-all duration-200 hover:scale-110"
                class:border-white={uusiVari === vari.koodi}
                class:border-gray-300={uusiVari !== vari.koodi}
                style="background: linear-gradient(135deg, {vari.koodi}, {vari.koodi}dd);"
                on:click={() => uusiVari = vari.koodi}
                title={vari.nimi}
              >
                {#if uusiVari === vari.koodi}
                  <span class="text-white text-lg">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Painikkeet -->
      <div class="flex gap-3">
        <button 
          class="btn variant-soft flex-1"
          on:click={peruutaMuokkaus}
        >
          Peruuta
        </button>
        <button 
          class="btn variant-filled-primary flex-1"
          disabled={!uusiNimi.trim()}
          on:click={tallennaMuutokset}
        >
          Tallenna muutokset
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Hover-efektit pelaajan korteille */
  .card:hover {
    transform: translateY(-4px);
  }
  
  /* Sujuvat siirtymät */
  .card {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Modal animaatio */
  .fixed {
    animation: fadeIn 0.3s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
