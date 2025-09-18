<script lang="ts">
  import svelteLogo from './assets/svelte.svg';
  import viteLogo from '/vite.svg';
  import Counter from './lib/Counter.svelte';
  import AsetuksetSivu from './lib/components/AsetuksetSivu.svelte';
  import PeliIkkuna from './features/game/components/PeliIkkuna.svelte';
  import AdminSivu from './lib/components/AdminSivu.svelte';
  import TargetPickerOverlay from './lib/components/TargetPickerOverlay.svelte';
  import AppHeader from './lib/components/AppHeader.svelte';
  import type { Kayttaja } from './lib/database/schema.js';
  import { AppBar, Switch, Modal } from '@skeletonlabs/skeleton-svelte';
  import { peliPalvelu } from './lib/database/gameService.js';
  import { onMount } from 'svelte';
  import { onDestroy } from 'svelte';
  import { 
    GLASS_STYLES, 
    GLASS_COLORS, 
    GLASS_ANIMATIONS,
    GLASS_BACKGROUNDS,
    GLASS_LAYOUT,
    glassUtils 
  } from './lib/styles/glass-morphism.js';
  
  // ===============================================
  // TILAN HALLINTA (State Management)
  // ===============================================
  
  let nykyinenSivu: 'etusivu' | 'asetukset' | 'peli' | 'tilastot' | 'admin' = 'etusivu';
  let pelatutKierrokset: number = 0;
  let pisteet: number = 0;
  let kayttajaNimi: string = 'Testipelaaja';
  let kategoriat: { [kategoria: string]: number } = {};
  let parhaatTulokset: any[] = [];
  let kayttajanTilastot: any = null;
  let leijuvatElementit: any = null;
  
  // Leijuvat elementit - näkyvät elementit ja niiden tilat
  let nakyvatElementit: any[] = [];
  
  // Pelin tila
  let peliPelaajat: Kayttaja[] = [];
  let pelinKierrosMaara: number = 10; // Tallennetaan kierrosmäärä
  let pelinKategoria: string | undefined = undefined; // Kategoriasuodatus
  let kaikkiPelaajat: Kayttaja[] = []; // Kaikki pelaajat näytettäväksi
  let topPelaajat: Kayttaja[] = [];
  // Event handler reference for peliLoppui; declared in module scope so onDestroy
  // can clean it up. Assigned inside onMount.
  let peliLoppuiHandler: ((data: any) => void) | null = null;

  // Helper to refresh leaderboard
  async function refreshTopPelaajat() {
    try {
      topPelaajat = await peliPalvelu.haeTopPelaajat(8);
        console.log('\ud83d\udd0d refreshTopPelaajat called - fetching top players...');
        topPelaajat = await peliPalvelu.haeTopPelaajat(8);
        console.log('\ud83c\udfc6 refreshTopPelaajat result:', topPelaajat.map(p => ({ id: p.id, nimi: p.nimi, pisteet: p.pisteet_yhteensa })));
    } catch (e) {
      console.warn('Top-pelaajien päivitys epäonnistui:', e);
    }
  }

    // Tilastotilamuuttuja
    let yleisTilastot: any = null;

  // ===============================================
  // ELINKAARIFUNKTIOT (Lifecycle Functions)
  // ===============================================
  
  async function lataaYleisTilastot() {
    try {
      yleisTilastot = await peliPalvelu.haeYleisTilastot();
    } catch (error) {
      console.warn('Ei voitu ladata yleisiä tilastoja:', error);
      yleisTilastot = null;
    }
  }

  onMount(async () => {
    try {
      // Lataa kategoriat ja tilastot asynkronisesti
      kategoriat = await peliPalvelu.haeKategoriatMaarineen();
      parhaatTulokset = await peliPalvelu.haeParhaatTulokset(5);
      // Lataa top-pelaajat
      await refreshTopPelaajat();
      kayttajanTilastot = await peliPalvelu.haeKayttajanTilastot(kayttajaNimi);
      // Lataa yleiset tilastot
      await lataaYleisTilastot();
      
      // Lataa kaikki pelaajat näytettäväksi
      try {
        const pelaajat = await peliPalvelu.haeKaikkiKayttajat();
        if (pelaajat) {
          kaikkiPelaajat = pelaajat.sort((a: any, b: any) => 
            new Date(b.luotu).getTime() - new Date(a.luotu).getTime()
          );
        }
      } catch (error) {
        console.warn('Ei voitu ladata pelaajia:', error);
      }
      
      // Lataa leijuvat elementit
      try {
        const response = await fetch('/leijuvat_elementit.json');
        if (response.ok) {
          leijuvatElementit = await response.json();
          // Alusta leijuvat elementit kun data on ladattu
          setTimeout(() => {
            alustaLeijuvatElementit();
            // Päivitä elementtejä 15-30s välein satunnaisesti
            function asetaSatunnainenPaivitys() {
              const aika = 15000 + Math.random() * 15000; // 15-30s
              setTimeout(() => {
                paivitaLeijuvatElementit();
                asetaSatunnainenPaivitys(); // Rekursiivinen kutsu seuraavalle satunnaiselle ajalle
              }, aika);
            }
            asetaSatunnainenPaivitys(); // Aloita satunnaiset päivitykset
          }, 1000); // 1s viive että sivu on valmis
        }
      } catch (error) {
        console.warn('Ei voitu ladata leijuvia elementtejä:', error);
      }
      
      if (kayttajanTilastot) {
        pelatutKierrokset = kayttajanTilastot.pelatut_pelit || 0;
        pisteet = kayttajanTilastot.kokonais_pisteet || 0;
      }
    } catch (error) {
      console.error('Virhe tietojen lataamisessa:', error);
      // Aseta oletusarvot jos tietokanta ei toimi
      kategoriat = { 'Eläimet': 0, 'Maantieto': 0, 'Värit': 0 };
    }
    // Rekisteröi kuuntelija peli-lopetustapahtumille jotta leaderboard päivittyy reaaliaikaisesti
    peliLoppuiHandler = async (data: any) => {
      console.log('🔔 peliLoppui event received:', data);
      await refreshTopPelaajat();
    };
    console.log('ℹ️ Rekisteröidään peliLoppui-kuuntelija, nykyinen topPelaajat:', topPelaajat.length);
    peliPalvelu.on('peliLoppui', peliLoppuiHandler);
  });

  // Cleanup: remove the peliLoppui listener when component is destroyed.
  onDestroy(() => {
    if (peliLoppuiHandler) {
      try { peliPalvelu.off('peliLoppui', peliLoppuiHandler); } catch (e) { /* ignore */ }
      peliLoppuiHandler = null;
    }
  });


  // ===============================================
  // TOIMINTOFUNKTIOT (Action Functions)
  // ===============================================
  
  // Luo satunnainen elementti kaikista kategorioista
  function luoSatunnainenElementti() {
    if (!leijuvatElementit) return null;
    
    const kaikkiElementit = [
      ...leijuvatElementit.kategoriat || [],
      ...leijuvatElementit.liput || [],
      ...leijuvatElementit.kaavat_ja_lauseet || [],
      ...leijuvatElementit.kulttuuri || []
    ];
    
    if (kaikkiElementit.length === 0) return null;
    
    const randomElement = kaikkiElementit[Math.floor(Math.random() * kaikkiElementit.length)];
    return {
      ...randomElement,
      id: Math.random().toString(36).substr(2, 9),
      sijainti: luoSatunnainenSijainti(),
      luontiaika: Date.now(),
      opacity: 0 // Aloita näkymättömänä fade-in varten
    };
  }

  // Apufunktio satunnaisen sijainnin luomiseen
  function luoSatunnainenSijainti() {
    // Satunnaiset liikkuvuussuunnat - kaikki suunnat mahdollisia
    const deltaY = -60 + Math.random() * 120; // -60 to +60px (ylös ja alas)
    const deltaX = -60 + Math.random() * 120; // -60 to +60px (vasemmalle ja oikealle)
    const rotation = -4 + Math.random() * 8; // -4 to +4 degrees (enemmän kierroa)
    
    return {
      top: Math.random() * 130 - 15 + '%', // -15% to 115% - sallii reunojen yli
      left: Math.random() * 130 - 15 + '%', // -15% to 115% - sallii reunojen yli
      animationDelay: Math.random() * 2 + 's', // 0-2s lyhyempi viive
      animationDuration: (2 + Math.random() * 3) + 's', // 2-5s nopeammat animaatiot
      deltaY: deltaY,
      deltaX: deltaX,
      rotation: rotation
    };
  }

  // Alusta näkyvät elementit
  function alustaLeijuvatElementit() {
    if (!leijuvatElementit) return;
    
    nakyvatElementit = [];
    for (let i = 0; i < 96; i++) { // 64 elementtiä
      const elementti = luoSatunnainenElementti();
      if (elementti) {
        // Porrastetut viiveet - osa alkaa heti, osa myöhemmin
        elementti.sijainti.animationDelay = (i * 0.1) + 's'; // 0, 0.1s, 0.2s, 0.3s...
        elementti.opacity = 0.6; // Näkyväksi kun on luotu
        nakyvatElementit.push(elementti);
      }
    }
  }

  // Satunnaisempi ja nopeampi elementtien vaihto
  function paivitaLeijuvatElementit() {
    if (!leijuvatElementit || nakyvatElementit.length === 0) return;
    
    // Valitse 2-4 elementtiä vaihdettavaksi kerralla (enemmän dynamiikkaa)
    const vaihdettavienMaara = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < vaihdettavienMaara; i++) {
      // Satunnainen viive jokaiselle elementille
      setTimeout(() => {
        const indeksi = Math.floor(Math.random() * nakyvatElementit.length);
        const vanhaElementti = nakyvatElementit[indeksi];
        
        // ENSIN fade out täysin
        vanhaElementti.opacity = 0;
        
        // ODOTA että fade out on valmis, SITTEN vaihda teksti
        setTimeout(() => {
          const uusiElementti = luoSatunnainenElementti();
          if (uusiElementti) {
            // Aloita uusi elementti näkymättömänä
            uusiElementti.opacity = 0;
            nakyvatElementit[indeksi] = uusiElementti;
            nakyvatElementit = [...nakyvatElementit]; // Triggeri reactivity
            
            // SITTEN fade in uusi teksti
            setTimeout(() => {
              uusiElementti.opacity = 0.5 + Math.random() * 0.3; // 0.5-0.8 opacity
            }, 50); // Pieni viive että DOM päivittyy
          }
        }, 600); // Odota fade out (500ms) + puskuri
      }, i * 1000); // 1s viive per elementti
    }
  }
  
  /**
   * Navigoi toiselle sivulle
   */
  function navigoi(sivu: 'etusivu' | 'asetukset' | 'peli' | 'tilastot' | 'admin') {
    nykyinenSivu = sivu;
    // Kun navigoidaan tilastoihin, ladataan ajantasaiset yleistilastot
    if (sivu === 'tilastot') {
      // ei blokata UI:ta — ladataan taustalla
      lataaYleisTilastot().catch((e) => console.warn('Tilastojen lataus epäonnistui:', e));
    }
  }
  
  /**
   * Aloita peli pelaajilla
   */
  function aloitaPeliPelaajilla(pelaajat: Kayttaja[], kierrosMaara: number) {
    peliPelaajat = pelaajat;
    pelinKierrosMaara = kierrosMaara;
    console.log('🎮 Aloitetaan peli kierrosmäärällä:', kierrosMaara);
    nykyinenSivu = 'peli';
  }
  
  /**
   * Palaa takaisin asetuksiin pelistä
   */
  function palaaPelistaAsetuksiin() {
    nykyinenSivu = 'asetukset';
    peliPelaajat = [];
    pelinKierrosMaara = 10; // Reset kierrosmäärä
  }
  /**
   * Pika-aloitus - käyttää kaikkia olemassa olevia pelaajia
   */
  async function aloitaPeli() {
    try {
      // Hae kaikki käyttäjät
      const kayttajat = await peliPalvelu.haeKaikkiKayttajat();
      
      if (kayttajat && kayttajat.length > 0) {
        // Käytä kaikkia pelaajia
        const kaikkiPelaajat = kayttajat.sort((a: any, b: any) => 
          new Date(b.luotu).getTime() - new Date(a.luotu).getTime()
        );
        
        peliPelaajat = kaikkiPelaajat;
        nykyinenSivu = 'peli';
        console.log(`Aloitettu peli pelaajilla: ${kaikkiPelaajat.map((p: any) => p.nimi).join(', ')}`);
      } else {
        // Jos ei ole pelaajia, siirry asetuksiin luomaan uusi
        console.log('Ei pelaajia - siirretään asetuksiin');
        nykyinenSivu = 'asetukset';
      }
    } catch (error) {
      console.error('Virhe pika-aloituksessa:', error);
      // Fallback: siirry asetuksiin
      nykyinenSivu = 'asetukset';
    }
  }
  
  /**
   * Aloita peli tietyllä kategorialla - käyttää kaikkia olemassa olevia pelaajia
   */
  async function aloitaPeliKategorialla(kategoria: string) {
    try {
      // Hae kaikki käyttäjät
      const kayttajat = await peliPalvelu.haeKaikkiKayttajat();
      
      if (kayttajat && kayttajat.length > 0) {
        // Käytä kaikkia pelaajia
        const kaikkiPelaajat = kayttajat.sort((a: any, b: any) => 
          new Date(b.luotu).getTime() - new Date(a.luotu).getTime()
        );
        
        // Siirry peliin kategorialla kaikilla pelaajilla
        peliPelaajat = kaikkiPelaajat;
        pelinKierrosMaara = 5; // Lyhyempi peli kategorioille
        pelinKategoria = kategoria; // Aseta kategoriasuodatus
        console.log(`Aloitetaan peli kategorialla: ${kategoria}, pelaajat: ${kaikkiPelaajat.map((p: any) => p.nimi).join(', ')}`);
        nykyinenSivu = 'peli';
      } else {
        // Jos ei ole pelaajia, siirry asetuksiin luomaan uusi
        console.log('Ei pelaajia kategoriapelille - siirretään asetuksiin');
        nykyinenSivu = 'asetukset';
      }
    } catch (error) {
      console.error('Virhe kategoriapikapelissä:', error);
      // Fallback: siirry asetuksiin
      nykyinenSivu = 'asetukset';
    }
  }
  
  function vaihdaTeema() {
    // Demo toiminto teeman vaihtamiseen
  }

  // Helper to safely access kategoria stats in template
  function formatKategoriaStat(k: string) {
    try {
      return (yleisTilastot && yleisTilastot.kategoriaTilastot && yleisTilastot.kategoriaTilastot.kategorioittain && (yleisTilastot.kategoriaTilastot.kategorioittain as any)[k]) || { prosentti: 0, oikeat: 0, kaikki: 0 };
    } catch (e) {
      return { prosentti: 0, oikeat: 0, kaikki: 0 };
    }
  }
</script>

<!-- =============================================== -->
<!-- PÄÄSOVELLUS (Main Application) -->
<!-- =============================================== -->

<!-- Glass effect background with floating particles -->
<div class="{GLASS_BACKGROUNDS.main}">
  <!-- Floating elements background -->
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {@html GLASS_BACKGROUNDS.floatingParticles}
  </div>

  <main class="{GLASS_BACKGROUNDS.contentLayer}">
    <div class="grid grid-rows-[auto_1fr_auto] min-h-screen">
      <!-- Header (extracted to AppHeader component) -->
      <AppHeader {nykyinenSivu} on:navigate={(e) => navigoi(e.detail)} />

    <!-- Sisältöalue -->
    <div class="flex-1">
      {#if nykyinenSivu === 'asetukset'}
        <AsetuksetSivu {aloitaPeliPelaajilla} />
      {:else if nykyinenSivu === 'admin'}
        <AdminSivu takaisinCallback={() => navigoi('etusivu')} />
      {:else if nykyinenSivu === 'peli'}
        <PeliIkkuna pelaajat={peliPelaajat} kierrosMaara={pelinKierrosMaara} kategoria={pelinKategoria} takaisinCallback={palaaPelistaAsetuksiin} />
      {:else if nykyinenSivu === 'etusivu'}
        <!-- Etusivu -->
        <div class="container mx-auto grid grid-cols-1 xl:grid-cols-[250px_minmax(0px,_1fr)_250px] gap-6 p-6">
          <!-- Sidebar (Left) -->
          <aside class="sticky top-24 col-span-1 hidden h-fit xl:block">
            <div class="{GLASS_STYLES.card} p-6 space-y-4">
              <h3 class="text-lg font-medium">🎮 Pikapeli-kategoriat</h3>
              <div class="space-y-3">
                {#each Object.entries(kategoriat).sort(([,a], [,b]) => b - a).slice(0, 5) as [kategoria, maara]}
                  <button 
                    class="{glassUtils.button('ghost')} w-full justify-start" 
                    on:click={() => aloitaPeliKategorialla(kategoria)}
                  >
                    <span>📚</span>
                    <span>{kategoria}</span>
                  </button>
                {/each}
                {#if Object.keys(kategoriat).length === 0}
                  <div class="text-sm {GLASS_COLORS.textSecondary}">Ladataan kategorioita...</div>
                {/if}
              </div>
              
              <!-- Pelaajat -->
              {#if kaikkiPelaajat.length > 0}
                <div class="border-t border-white/20 pt-1">
                  <h4 class="text-sm font-medium mb-3 {GLASS_COLORS.textSecondary}">👥 Pelaajat ({kaikkiPelaajat.length})</h4>
                  <div class="flex flex-wrap gap-1">
                    {#each kaikkiPelaajat.slice(0, 8) as pelaaja}
                      <div 
                        class="flex items-center justify-center rounded px-2 py-1 text-white" 
                        style="background-color: {pelaaja.pelaajan_vari || '#6366f1'}"
                      >
                        <span class="text-xs font-medium truncate max-w-[60px]">{pelaaja.nimi}</span>
                      </div>
                    {/each}
                    {#if kaikkiPelaajat.length > 8}
                      <div class="flex items-center gap-1 {GLASS_STYLES.cardLight} rounded px-2 py-1">
                        <span class="text-xs {GLASS_COLORS.textSecondary}">+{kaikkiPelaajat.length - 8}</span>
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </aside>
          
          <!-- Main Content -->
          <main class="col-span-1 space-y-6">
            <!-- Hero Card -->
            <div class="{GLASS_STYLES.card} p-8 text-center relative overflow-hidden">
              <!-- Leijuvat elementit taustalla -->
              <div class="absolute inset-0 opacity-70">
                {#if nakyvatElementit && nakyvatElementit.length > 0}
                  {#each nakyvatElementit as elementti (elementti.id)}
                    <div 
                      class="floating-item-custom absolute pointer-events-none select-none text-primary dark:text-primary transition-opacity duration-200"
                      style="
                        top: {elementti.sijainti.top}; 
                        left: {elementti.sijainti.left}; 
                        font-size: {elementti.koko === 'xl' ? '2rem' : elementti.koko === 'lg' ? '1.5rem' : '1rem'}; 
                        opacity: {elementti.opacity || 0.6};
                        animation-delay: {elementti.sijainti.animationDelay};
                        animation-duration: {elementti.sijainti.animationDuration};
                        --delta-y: {elementti.sijainti.deltaY}px;
                        --delta-x: {elementti.sijainti.deltaX}px;
                        --rotation: {elementti.sijainti.rotation}deg;
                      "
                    >
                      {elementti.teksti}
                    </div>
                  {/each}
                {/if}
              </div>
              
              <!-- Varsinainen sisältö -->
              <div class="relative z-10">
                <!-- Koko sisältö kortti lasiefektillä -->
                <div class="{GLASS_STYLES.cardLight} p-8 space-y-4 max-w-md mx-auto">
                  <div class="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-lg mx-auto">
                    <span class="text-2xl">🧠</span>
                  </div>
                  <h2 class="text-3xl font-bold">Tervetuloa <span class="inline-flex items-center">Kysymysmestariin!</span></h2>
                  <p class="text-lg opacity-80">Hauska tietokilpailu koko perheelle</p>
                  <div class="flex gap-3 justify-center items-center">
                    <button class="{glassUtils.button('primary')} text-lg px-8 py-3" on:click={() => navigoi('asetukset')}>
                      🚀 Pelaa!
                    </button>
                  </div>
                  <span class="text-sm opacity-70">Pelattu {pelatutKierrokset} kierrosta</span>
                </div>
              </div>
            </div>
            
            <!-- Features Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="{GLASS_STYLES.card} p-6">
                <div class="space-y-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                    <span class="text-white text-xl">👨‍👩‍👧‍👦</span>
                  </div>
                  <h3 class="text-xl font-semibold">Perheystävällinen</h3>
                  <p class="{GLASS_COLORS.textSecondary}">Sopii kaikenikäisille - lapsista isovanhempiin.</p>
                  <ul class="space-y-2 text-sm">
                    <li class="flex items-center gap-2">
                      <span class="text-success-500">✓</span>
                      <span>Helpot kysymykset lapsille</span>
                    </li>
                    <li class="flex items-center gap-2">
                      <span class="text-success-500">✓</span>
                      <span>Haastavia kysymyksiä aikuisille</span>
                    </li>
                  </ul>
                </div>
              </div>
              
              <div class="{GLASS_STYLES.card} p-6">
                <div class="space-y-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-secondary-500 to-secondary-700 rounded-lg flex items-center justify-center shadow-md">
                    <span class="text-white text-xl">🎓</span>
                  </div>
                  <h3 class="text-xl font-semibold">Hauska ja Opettavainen</h3>
                  <p class="{GLASS_COLORS.textSecondary}">Opi uutta samalla kun pidät hauskaa!</p>
                  <div class="flex items-center gap-3">
                    <Switch />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Stats Card -->
            <div class="{GLASS_STYLES.card} p-6">
              <h3 class="text-xl font-semibold mb-6">📈 Pelitilastot</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-primary-500">{pisteet}</div>
                  <div class="text-sm {GLASS_COLORS.textSecondary}">Pisteitä yhteensä</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-secondary-500">{pelatutKierrokset}</div>
                  <div class="text-sm {GLASS_COLORS.textSecondary}">Pelikertaa</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-tertiary-500">{Object.keys(kategoriat).length}</div>
                  <div class="text-sm {GLASS_COLORS.textSecondary}">Kategoriaa</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-warning-500">{Object.values(kategoriat).reduce((sum, count) => sum + count, 0)}</div>
                  <div class="text-sm {GLASS_COLORS.textSecondary}">Kysymystä</div>
                </div>
              </div>
            </div>
          </main>
          
          <!-- Sidebar (Right) -->
          <aside class="sticky top-24 col-span-1 hidden h-fit xl:block">
            <div class="space-y-4">
              <div class="{GLASS_STYLES.card} p-6">
                <h3 class="text-lg font-medium mb-4">🎮 Pika-toiminnot</h3>
                <div class="space-y-3">
                  <button class="{glassUtils.button('ghost')} w-full justify-start" on:click={() => navigoi('asetukset')}>
                    <span>⚙️</span>
                    <span>Asetukset</span>
                  </button>
                  <button class="{glassUtils.button('ghost')} w-full justify-start" on:click={() => navigoi('tilastot')}>
                    <span>📊</span>
                    <span>Katso tilastoja</span>
                  </button>
                  <button class="{glassUtils.button('ghost')} w-full justify-start">
                    <span>❓</span>
                    <span>Ohjeet</span>
                  </button>
                </div>
              </div>
              
              <div class="{GLASS_STYLES.card} p-6">
                <h3 class="text-lg font-medium">🏆 Top-lista</h3>
                <div class="mt-3 space-y-2">
                  {#if topPelaajat && topPelaajat.length > 0}
                    {#each topPelaajat as p, i}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="w-6 h-6 rounded-full" style="background-color: {p.pelaajan_vari || '#6366f1'}"></div>
                          <div class="text-sm truncate max-w-[120px]">{i+1}. {p.nimi}</div>
                        </div>
                        <div class="text-sm font-semibold">{p.pisteet_yhteensa || 0}</div>
                      </div>
                    {/each}
                  {:else}
                    <div class="text-sm {GLASS_COLORS.textSecondary}">Ei pelaajia</div>
                  {/if}
                </div>
              </div>
            </div>
          </aside>
        </div>
      {:else if nykyinenSivu === 'tilastot'}
          <!-- Tilastot-sivu -->
          <div class="container mx-auto p-6">
            <h2 class="text-3xl font-bold text-center mb-8">📊 Pelitilastot</h2>
            {#if yleisTilastot}
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <!-- enitenPisteet -->
                <div class="{GLASS_STYLES.card} p-4 patch-1">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten pisteitä</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenPisteet?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenPisteet?.pisteet || '-' } pistettä</div>
                </div>

                <!-- enitenOikeat -->
                <div class="{GLASS_STYLES.card} p-4 patch-2">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten oikeita vastauksia</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenOikeat?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenOikeat?.oikeitaVastauksia || '-' } kpl</div>
                </div>

                <!-- enitenVaarat -->
                <div class="{GLASS_STYLES.card} p-4 patch-3">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten vääriä vastauksia</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenVaarat?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenVaarat?.vaariaVastauksia || '-' } kpl</div>
                </div>

                <!-- parasProsentti -->
                <div class="{GLASS_STYLES.card} p-4 patch-4">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Paras vastausprosentti</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.parasProsentti?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.parasProsentti?.vastausprosentti ? yleisTilastot.parasProsentti.vastausprosentti + '%' : '-'}</div>
                </div>

                <!-- vaikeinKategoria -->
                <div class="{GLASS_STYLES.card} p-4 patch-5">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Vaikein kategoria</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.vaikeinKategoria?.kategoria || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.vaikeinKategoria?.vaikeusprosen ? yleisTilastot.vaikeinKategoria.vaikeusprosen + '%' : '-'}</div>
                </div>

                <!-- enitenYhdessaPeli -->
                <div class="{GLASS_STYLES.card} p-4 patch-6">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Piste-ennätys yhdessä pelissä</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenYhdessaPeli?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenYhdessaPeli?.pisteet || '-'} pistettä</div>
                </div>

                <!-- nopeinVastaaja -->
                <div class="{GLASS_STYLES.card} p-4 patch-7">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Nopein vastaaja (keskiarvo)</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.nopeinVastaaja?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.nopeinVastaaja?.keskimaarainenVastausaikaMs ? yleisTilastot.nopeinVastaaja.keskimaarainenVastausaikaMs + ' ms' : '-'}</div>
                </div>

                <!-- kaikkienPisteet -->
                <div class="{GLASS_STYLES.card} p-4 patch-8">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Yhteispisteet kaikilta pelaajilta</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.kaikkienPisteet || 0}</div>
                  <div class="text-sm mt-1">Kaikki pelaajat yhteensä</div>
                </div>

                <!-- kategoriaTilastot -->
                <div class="{GLASS_STYLES.card} p-4 patch-9">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Läpäisyprosentti kategorioittain</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.kategoriaTilastot?.enitenKaytetty || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">Näytä kategorioiden läpäisyprosentit</div>
                </div>

                <!-- enitenTuplat (placeholder) -->
                <div class="{GLASS_STYLES.card} p-4 patch-1">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten tuplapisteitä</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenTuplat?.message || 'Ei tallennettu'}</div>
                  <div class="text-sm mt-1">Placeholder</div>
                </div>

                <!-- enitenErikoiskortti (placeholder) -->
                <div class="{GLASS_STYLES.card} p-4 patch-2">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten käytetty erikoiskortti</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenErikoiskortti?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenErikoiskortti?.maara || '-'}</div>
                </div>

                <!-- suurinPutkiOikeita -->
                <div class="{GLASS_STYLES.card} p-4 patch-3">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten peräkkäisiä oikeita</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.suurinPutkiOikeita?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.suurinPutkiOikeita?.putki || '-'}</div>
                </div>

                <!-- suurinPutkiVaaria -->
                <div class="{GLASS_STYLES.card} p-4 patch-4">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten peräkkäisiä vääriä</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.suurinPutkiVaaria?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.suurinPutkiVaaria?.putkiVaaria || '-'}</div>
                </div>

                <!-- vastauksiaViimeSekunnilla -->
                <div class="{GLASS_STYLES.card} p-4 patch-5">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten vastauksia viimeisellä sekunnilla</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.vastauksiaViimeSekunnilla?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.vastauksiaViimeSekunnilla?.maara || '-'}</div>
                </div>

                <!-- enitenPelia -->
                <div class="{GLASS_STYLES.card} p-4 patch-6">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten pelejä pelannut pelaaja</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenPelia?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenPelia?.pelit || '-' } peliä</div>
                </div>

                <!-- enitenOikeitaKokonaistilasto -->
                <div class="{GLASS_STYLES.card} p-4 patch-7">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten oikeita (kokonais)</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenOikeitaKokonaistilasto?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenOikeitaKokonaistilasto?.oikeitaVastauksia || '-'}</div>
                </div>

                <!-- enitenVaariaKokonaistilasto -->
                <div class="{GLASS_STYLES.card} p-4 patch-8">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Eniten vääriä (kokonais)</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.enitenVaariaKokonaistilasto?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.enitenVaariaKokonaistilasto?.vaariaVastauksia || '-'}</div>
                </div>

                <!-- nopeinYksittainen -->
                <div class="{GLASS_STYLES.card} p-4 patch-9">
                  <div class="text-xs {GLASS_COLORS.textSecondary}">Nopein yksittäinen vastaus</div>
                  <div class="text-lg font-bold mt-1">{yleisTilastot.nopeinYksittainen?.pelaaja?.nimi || 'Ei dataa'}</div>
                  <div class="text-sm mt-1">{yleisTilastot.nopeinYksittainen?.ms ? yleisTilastot.nopeinYksittainen.ms + ' ms' : '-'}</div>
                </div>
              </div>
            {:else}
              <div class="text-center text-surface-600-400">Tilastoja ei voitu ladata.</div>
            {/if}
          </div>
      {/if}
    </div>

    <!-- Footer -->
    <footer class="{GLASS_STYLES.card} p-6 border-t border-white/20 dark:border-white/10">
      <div class="container mx-auto text-center space-y-2">
        <div class="text-sm text-surface-600-400">
          Tehty ❤️:llä <span class="text-primary-500 font-semibold"> - Pienille ja suurille tietovisailijoille</span>
        </div>
        <div class="text-xs text-surface-500-500">
          © 2025 <span class="inline-flex items-center">Kysymysmestariö </span>
        </div>
      </div>
    </footer>
  </div>
</main>
  <!-- Global target-picker overlay (renders at the app root so it sits above other stacking contexts) -->
  <TargetPickerOverlay />
</div>

<style>
  .floating-item-custom {
    animation: floatCustom 5s ease-in-out infinite;
    transition: all 0.3s ease;
    will-change: transform, opacity;
  }
  
  @keyframes floatCustom {
    0% {
      transform: translateY(0px) translateX(0px) rotate(0deg) scale(0.8);
      opacity: 0;
    }
    5% {
      opacity: 0.3;
    }
    10% {
      opacity: 0.8;
      transform: translateY(-5px) translateX(2px) rotate(0.5deg) scale(0.9);
    }
    25% {
      transform: translateY(-15px) translateX(8px) rotate(1deg) scale(1);
      opacity: 1;
    }
    50% {
      transform: translateY(-25px) translateX(-10px) rotate(-1deg) scale(1.1);
      opacity: 1;
    }
    75% {
      transform: translateY(-35px) translateX(15px) rotate(1.5deg) scale(1);
      opacity: 0.8;
    }
    90% {
      transform: translateY(-45px) translateX(-5px) rotate(-0.5deg) scale(0.9);
      opacity: 0.4;
    }
    95% {
      opacity: 0.1;
    }
    100% {
      transform: translateY(-50px) translateX(0px) rotate(0deg) scale(0.8);
      opacity: 0;
    }
  }
  
  .floating-item-custom {
    animation: customFloat 2s ease-out infinite;
    transition: all 0.2s ease;
    will-change: transform, opacity;
  }
  
  @keyframes customFloat {
    0% {
      transform: translateY(0px) translateX(0px) rotate(0deg) scale(1);
      opacity: 0.8;
    }
    100% {
      transform: translateY(var(--delta-y)) translateX(var(--delta-x)) rotate(var(--rotation)) scale(1.15);
      opacity: 0.2;
    }
  }
</style>


