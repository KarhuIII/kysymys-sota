<script lang="ts">
  import svelteLogo from './assets/svelte.svg';
  import viteLogo from '/vite.svg';
  import Counter from './lib/Counter.svelte';
  import AsetuksetSivu from './lib/components/AsetuksetSivu.svelte';
  import PeliIkkuna from './lib/components/PeliIkkuna.svelte';
  import AdminSivu from './lib/components/AdminSivu.svelte';
  import type { Kayttaja } from './lib/database/schema.js';
  import { AppBar, Switch, Modal } from '@skeletonlabs/skeleton-svelte';
  import { peliPalvelu } from './lib/database/gameService.js';
  import { onMount } from 'svelte';
  
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
  
  // Pelin tila
  let peliPelaajat: Kayttaja[] = [];
  let pelinKierrosMaara: number = 10; // Tallennetaan kierrosmäärä

  // ===============================================
  // ELINKAARIFUNKTIOT (Lifecycle Functions)
  // ===============================================
  
  onMount(async () => {
    try {
      // Lataa kategoriat ja tilastot asynkronisesti
      kategoriat = await peliPalvelu.haeKategoriatMaarineen();
      parhaatTulokset = await peliPalvelu.haeParhaatTulokset(5);
      kayttajanTilastot = await peliPalvelu.haeKayttajanTilastot(kayttajaNimi);
      
      if (kayttajanTilastot) {
        pelatutKierrokset = kayttajanTilastot.pelatut_pelit || 0;
        pisteet = kayttajanTilastot.kokonais_pisteet || 0;
      }
    } catch (error) {
      console.error('Virhe tietojen lataamisessa:', error);
      // Aseta oletusarvot jos tietokanta ei toimi
      kategoriat = { 'Eläimet': 0, 'Maantieto': 0, 'Värit': 0 };
    }
  });

  // ===============================================
  // TOIMINTOFUNKTIOT (Action Functions)
  // ===============================================
  
  /**
   * Navigoi toiselle sivulle
   */
  function navigoi(sivu: 'etusivu' | 'asetukset' | 'peli' | 'tilastot' | 'admin') {
    nykyinenSivu = sivu;
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
   * Pika-aloitus - luo testipelaajan ja siirry peliin
   */
  async function aloitaPeli() {
    try {
      // Luo yksinkertainen testipelaaja
      const testipelaaja: Omit<Kayttaja, 'id'> = {
        nimi: 'Testipelaaja',
        ika: 25,
        vaikeustaso_min: 'oppipoika',
        vaikeustaso_max: 'taitaja',
        pelaajan_vari: '#3b82f6',
        pisteet_yhteensa: 0,
        luotu: new Date().toISOString()
      };

      // Siirry peliin testipelaajalla
      peliPelaajat = [testipelaaja as Kayttaja];
      nykyinenSivu = 'peli';
    } catch (error) {
      console.error('Virhe pika-aloituksessa:', error);
    }
  }
  
  function vaihdaTeema() {
    // Demo toiminto teeman vaihtamiseen
  }
</script>

<!-- =============================================== -->
<!-- PÄÄSOVELLUS (Main Application) -->
<!-- =============================================== -->

<main>
  <div class="grid grid-rows-[auto_1fr_auto] min-h-screen">
    <!-- Header -->
    <header class="bg-surface-100-900/80 backdrop-blur-sm p-4 border-b border-surface-200-800/50 sticky top-0 z-10">
      <div class="container mx-auto flex justify-between items-center">
        <h1 class="text-xl font-semibold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
          <button class="text-xl font-bold" on:click={() => navigoi('etusivu')}>
            🎯 Kysymys-sota
          </button>
        </h1>
        
        <!-- Navigointipainikkeet -->
        <nav class="flex gap-2">
          <button 
            class="btn btn-sm"
            class:variant-filled-primary={nykyinenSivu === 'etusivu'}
            class:variant-soft={nykyinenSivu !== 'etusivu'}
            on:click={() => navigoi('etusivu')}
          >
            🏠 Etusivu
          </button>
          <button 
            class="btn btn-sm"
            class:variant-filled-primary={nykyinenSivu === 'asetukset'}
            class:variant-soft={nykyinenSivu !== 'asetukset'}
            on:click={() => navigoi('asetukset')}
          >
            ⚙️ Asetukset
          </button>
          <button 
            class="btn btn-sm"
            class:variant-filled-primary={nykyinenSivu === 'tilastot'}
            class:variant-soft={nykyinenSivu !== 'tilastot'}
            on:click={() => navigoi('tilastot')}
          >
            📊 Tilastot
          </button>
        </nav>
      </div>
    </header>

    <!-- Sisältöalue -->
    <div class="flex-1">
      {#if nykyinenSivu === 'asetukset'}
        <AsetuksetSivu {aloitaPeliPelaajilla} />
      {:else if nykyinenSivu === 'admin'}
        <AdminSivu takaisinCallback={() => navigoi('etusivu')} />
      {:else if nykyinenSivu === 'peli'}
        <PeliIkkuna pelaajat={peliPelaajat} kierrosMaara={pelinKierrosMaara} takaisinCallback={palaaPelistaAsetuksiin} />
      {:else if nykyinenSivu === 'etusivu'}
        <!-- Etusivu -->
        <div class="container mx-auto grid grid-cols-1 xl:grid-cols-[250px_minmax(0px,_1fr)_250px] gap-6 p-6">
          <!-- Sidebar (Left) -->
          <aside class="sticky top-24 col-span-1 hidden h-fit xl:block">
            <div class="card p-6 space-y-4 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
              <h3 class="text-lg font-medium">🎮 Pelivalikko</h3>
              <nav class="space-y-2">
                <button class="block w-full text-left p-3 rounded-lg hover:variant-soft-primary transition-all duration-200" on:click={() => navigoi('etusivu')}>🏠 Etusivu</button>
                <button class="block w-full text-left p-3 rounded-lg hover:variant-soft-primary transition-all duration-200" on:click={() => navigoi('asetukset')}>⚙️ Asetukset</button>
                <button class="block w-full text-left p-3 rounded-lg hover:variant-soft-primary transition-all duration-200" on:click={() => navigoi('tilastot')}>📊 Tilastot</button>
                <button class="block w-full text-left p-3 rounded-lg hover:variant-soft-primary transition-all duration-200">❓ Ohjeet</button>
              </nav>
            </div>
          </aside>
          
          <!-- Main Content -->
          <main class="col-span-1 space-y-6">
            <!-- Hero Card -->
            <div class="card p-8 text-center shadow-xl bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900 dark:to-secondary-900 border border-primary-200 dark:border-primary-800">
              <div class="space-y-4">
                <div class="mx-auto w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-lg">
                  <span class="text-2xl">🧠</span>
                </div>
                <h2 class="text-3xl font-bold">Tervetuloa Kysymys-sotaan!</h2>
                <p class="text-lg opacity-80">Hauska tietokilpailu koko perheelle</p>
                <div class="flex gap-3 justify-center items-center">
                  <button class="btn variant-filled-primary shadow-lg" on:click={() => navigoi('asetukset')}>
                    ⚙️ Asetukset
                  </button>
                  <button class="btn variant-filled-secondary shadow-lg" on:click={aloitaPeli}>
                    🎯 Pika-aloitus
                  </button>
                  <button class="btn variant-filled-tertiary shadow-lg" on:click={() => navigoi('admin')}>
                    🛠️ Admin
                  </button>
                </div>
                <span class="text-sm opacity-70">Pelattu {pelatutKierrokset} kierrosta</span>
              </div>
            </div>
            
            <!-- Features Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="card p-6 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
                <div class="space-y-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                    <span class="text-white text-xl">👨‍👩‍👧‍👦</span>
                  </div>
                  <h3 class="text-xl font-semibold">Perheystävällinen</h3>
                  <p class="text-surface-600-400">Sopii kaikenikäisille - lapsista isovanhempiin.</p>
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
              
              <div class="card p-6 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
                <div class="space-y-4">
                  <div class="w-12 h-12 bg-gradient-to-br from-secondary-500 to-secondary-700 rounded-lg flex items-center justify-center shadow-md">
                    <span class="text-white text-xl">🎓</span>
                  </div>
                  <h3 class="text-xl font-semibold">Hauska ja Opettavainen</h3>
                  <p class="text-surface-600-400">Opi uutta samalla kun pidät hauskaa!</p>
                  <div class="flex items-center gap-3">
                    <Switch />
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Stats Card -->
            <div class="card p-6 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
              <h3 class="text-xl font-semibold mb-6">📈 Pelitilastot</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-primary-500">{pisteet}</div>
                  <div class="text-sm text-surface-600-400">Pisteitä yhteensä</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-secondary-500">{pelatutKierrokset}</div>
                  <div class="text-sm text-surface-600-400">Pelikertaa</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-tertiary-500">{Object.keys(kategoriat).length}</div>
                  <div class="text-sm text-surface-600-400">Kategoriaa</div>
                </div>
                <div class="text-center space-y-2">
                  <div class="text-3xl font-bold text-warning-500">{Object.values(kategoriat).reduce((sum, count) => sum + count, 0)}</div>
                  <div class="text-sm text-surface-600-400">Kysymystä</div>
                </div>
              </div>
            </div>
          </main>
          
          <!-- Sidebar (Right) -->
          <aside class="sticky top-24 col-span-1 hidden h-fit xl:block">
            <div class="space-y-4">
              <div class="card p-6 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
                <h3 class="text-lg font-medium mb-4">🎮 Pika-toiminnot</h3>
                <div class="space-y-3">
                  <button class="btn variant-soft-primary w-full justify-start shadow-sm" on:click={() => navigoi('asetukset')}>
                    <span>⚙️</span>
                    <span>Asetukset</span>
                  </button>
                  <button class="btn variant-soft-secondary w-full justify-start shadow-sm" on:click={() => navigoi('tilastot')}>
                    <span>📊</span>
                    <span>Katso tilastoja</span>
                  </button>
                  <button class="btn variant-soft-tertiary w-full justify-start shadow-sm">
                    <span>❓</span>
                    <span>Ohjeet</span>
                  </button>
                </div>
              </div>
              
              <div class="card p-6 shadow-lg bg-surface-100-900/90 backdrop-blur-sm border border-surface-200-800">
                <h3 class="text-lg font-medium mb-4">🏆 Kategoriat</h3>
                <div class="space-y-3">
                  {#each Object.entries(kategoriat) as [kategoria, maara]}
                    <div class="flex justify-between items-center">
                      <span class="text-sm">📚 {kategoria}</span>
                      <span class="badge variant-filled-primary">{maara} kysymystä</span>
                    </div>
                  {/each}
                  {#if Object.keys(kategoriat).length === 0}
                    <div class="text-sm text-surface-600-400">Ladataan kategorioita...</div>
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
          <div class="text-center text-surface-600-400">
            Tilastot-sivu tulossa pian...
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <footer class="bg-surface-100-900/80 backdrop-blur-sm p-6 border-t border-surface-200-800/50">
      <div class="container mx-auto text-center space-y-2">
        <div class="text-sm text-surface-600-400">
          Tehty ❤️:llä <span class="text-primary-500 font-semibold"> - Pienille ja suurille tietoviisaille</span>
        </div>
        <div class="text-xs text-surface-500-500">
          © 2025 Kysymys-sota
        </div>
      </div>
    </footer>
  </div>
</main>


