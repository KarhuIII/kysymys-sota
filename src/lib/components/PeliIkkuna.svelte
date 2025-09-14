<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getDB } from "../database/database.js";
  import type { Kayttaja, Kysymys } from "../database/schema.js";
  import { peliPalvelu } from "../database/gameService.js";
  import { 
    GLASS_STYLES, 
    GLASS_COLORS, 
    GLASS_ANIMATIONS,
    GLASS_BACKGROUNDS,
    GLASS_LAYOUT,
    glassUtils 
  } from '../styles/glass-morphism.js';

  // ===============================================
  // PROPS & TILAN HALLINTA (Props & State Management)
  // ===============================================

  export let pelaajat: Kayttaja[] = [];
  export let takaisinCallback: () => void;
  export let kierrosMaara: number = 10;
  export let kategoria: string | undefined = undefined; // Kategoriasuodatus

  let nykyinenKysymys: Kysymys | null = null;
  let vastausVaihtoehdot: string[] = [];
  let valittuVastaus: string | null = null;
  let loading = true;
  let putoaaAika = false;
  let pisteytys = false;
  let saatuPisteet = 0; // Viimeksi saadut pisteet animaatiota varten
  let pisteytysViesti = ""; // Satunnainen pisteytysviesti

  // Pisteytysviestit
  let pisteytysViestit: { oikeat_vastaukset: string[]; vaarat_vastaukset: string[] } = {
    oikeat_vastaukset: [],
    vaarat_vastaukset: []
  };

  // Kello
  let aika = 30; // 30 sekuntia per kysymys
  let ajastin: NodeJS.Timeout | null = null;
  let kellon_vari = "#10b981"; // Vihreä

  // Pelin tila
  let pelaajaIndex = 0;
  let kysymysNumero = 1;
  $: maxKysymykset = kierrosMaara;
  let pelaajanPisteet: { [key: string]: number } = {};
  let sekoitetutPelaajat: Kayttaja[] = []; // Satunnaisessa järjestyksessä pelaajat
  let kysytytKysymykset: Set<number> = new Set(); // Seuraa kysyttyjä kysymyksiä ID:n perusteella
  let peliPysaytetty = false; // Pelin pysäytystila
  
  // DB / peliseuranta
  let pelaajaPelit: Map<number, number> = new Map(); // kayttajaId -> peliId
  let pelaajanKysymysCount: Record<number, number> = {};
  let kysymysAloitettu = 0;

  // ===============================================
  // ELINKAARIFUNKTIOT (Lifecycle Functions)
  // ===============================================

  onMount(async () => {
    // Lataa pisteytysviestit
    await lataaPisteytysViestit();

    if (pelaajat.length > 0) {
      // Sekoita pelaajat satunnaiseen järjestykseen
      sekoitetutPelaajat = sekoitaArray([...pelaajat]);

      // Alusta pelaajakohtaiset pisteet
      sekoitetutPelaajat.forEach((pelaaja) => {
        pelaajanPisteet[pelaaja.nimi] = 0;
      });

      // Nollaa kysytyt kysymykset uutta peliä varten
      kysytytKysymykset.clear();
      console.log("🎮 Uusi peli aloitettu - kysytyt kysymykset nollattu");

      await aloitaUusiKysymys();
    }
  });

  onDestroy(() => {
    if (ajastin) {
      clearInterval(ajastin);
    }
  });

  // ===============================================
  // PISTEYTYSVIESTIT (Scoring Messages)
  // ===============================================

  /**
   * Lataa pisteytysviestit JSON-tiedostosta
   */
  async function lataaPisteytysViestit() {
    try {
      const response = await fetch("/src/lib/data/pisteytysviestit.json");
      if (response.ok) {
        pisteytysViestit = await response.json();
        console.log("📨 Pisteytysviestit ladattu:", pisteytysViestit);
      } else {
        console.warn("⚠️ Pisteytysviestien lataus epäonnistui");
        // Käytä oletusviestejä
        pisteytysViestit = {
          oikeat_vastaukset: ["🎉 Loistavaa!", "⭐ Mahtavaa!", "🔥 Erinomaista!"],
          vaarat_vastaukset: ["😞 Väärin!", "😔 Ei osuma!", "😕 Huti!"]
        };
      }
    } catch (error) {
      console.error("❌ Virhe pisteytysviestien latauksessa:", error);
      // Käytä oletusviestejä
      pisteytysViestit = {
        oikeat_vastaukset: ["🎉 Loistavaa!", "⭐ Mahtavaa!", "🔥 Erinomaista!"],
        vaarat_vastaukset: ["😞 Väärin!", "😔 Ei osuma!", "😕 Huti!"]
      };
    }
  }

  /**
   * Valitse satunnainen pisteytysviesti
   */
  function valitseSatunnainenViesti(oikea: boolean): string {
    const viestit = oikea 
      ? pisteytysViestit.oikeat_vastaukset 
      : pisteytysViestit.vaarat_vastaukset;
    
    if (viestit.length === 0) {
      return oikea ? "🎉 Oikein!" : "😞 Väärin!";
    }
    
    const satunnainenIndex = Math.floor(Math.random() * viestit.length);
    return viestit[satunnainenIndex];
  }

  // ===============================================
  // PELILOGIIKKA (Game Logic)
  // ===============================================

  /**
   * Valitse sopiva vaikeustaso pelaajan asetuksista
   */
  function valitsePelaajanVaikeustaso(
    pelaaja: Kayttaja
  ): "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari" {
    const vaikeuastasot: ("oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari")[] = [];

    // Määritä käytettävissä olevat vaikeuastasot pelaajan asetusten mukaan
    const minTaso = pelaaja.vaikeustaso_min || "oppipoika";
    const maxTaso = pelaaja.vaikeustaso_max || "taitaja";

    const tasot = ["oppipoika", "taitaja", "mestari", "kuningas", "suurmestari"] as const;
    const minIndex = tasot.indexOf(minTaso);
    const maxIndex = tasot.indexOf(maxTaso);

    // Lisää kaikki tasot min ja max väliltä
    for (let i = minIndex; i <= maxIndex; i++) {
      vaikeuastasot.push(tasot[i]);
    }

    // Valitse satunnainen taso sallittujen joukosta
    const valittu =
      vaikeuastasot[Math.floor(Math.random() * vaikeuastasot.length)];

    return valittu;
  }

  /**
   * Aloita uusi kysymys nykyiselle pelaajalle
   */
  async function aloitaUusiKysymys() {
    loading = true;
    valittuVastaus = null;
    pisteytys = false;

    console.log(`🎯 Aloitetaan uusi kysymys pelaajalle ${pelaajaIndex + 1}/${sekoitetutPelaajat.length}`);

    try {
      const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];

      if (!nykyinenPelaaja) {
        console.error("Ei löytynyt pelaajaa indeksillä:", pelaajaIndex);
        return;
      }

      console.log(`👤 Nykyinen pelaaja: ${nykyinenPelaaja.nimi} (min: ${nykyinenPelaaja.vaikeustaso_min || 'oppipoika'}, max: ${nykyinenPelaaja.vaikeustaso_max || 'taitaja'})`);

      // Valitse sopiva vaikeustaso tälle pelaajalle
      const valittuVaikeustaso = valitsePelaajanVaikeustaso(nykyinenPelaaja);
      console.log(`🎲 Valittu vaikeustaso: ${valittuVaikeustaso}`);

      // Hae kysymys suoraan tietokannasta pelaajan vaikeustasolle
      const db = await getDB();

      // Varmista että pelaajalle on luotu peli tietokantaan
      if (nykyinenPelaaja.id !== undefined && !pelaajaPelit.has(nykyinenPelaaja.id)) {
        try {
          const uusiPeliId = await db.aloitaPeli(nykyinenPelaaja.id);
          pelaajaPelit.set(nykyinenPelaaja.id, uusiPeliId);
          pelaajanKysymysCount[nykyinenPelaaja.id] = 0;
          console.log('🎮 Luotu peli pelaajalle', nykyinenPelaaja.nimi, 'peliId=', uusiPeliId);
        } catch (err) {
          console.warn('⚠️ Pelin luonti epäonnistui tietokantaan:', err);
        }
      }

      // Yritä löytää kysymys jota ei ole vielä kysytty
      let kysymys: Kysymys | undefined = undefined;
      let yritykset = 0;
      const maxYritykset = 20; // Estää ikuisen silmukan

      do {
        kysymys = await db.haeSatunnainenKysymys(
          kategoria, // kategoria-suodatus
          valittuVaikeustaso // pelaajan tason mukainen kysymys
        );
        yritykset++;

        // Jos löydettiin uusi kysymys tai yritetty tarpeeksi
        if (
          !kysymys ||
          !kysytytKysymykset.has(kysymys.id!) ||
          yritykset >= maxYritykset
        ) {
          break;
        }
      } while (yritykset < maxYritykset);

      console.log(`🔍 Kysymyshaku valmis: yrityksiä ${yritykset}, kysymys löytyi: ${!!kysymys}`);
      if (kysymys) {
        console.log(`📋 Kysymys: "${kysymys.kysymys?.substring(0, 50)}..." (ID: ${kysymys.id}, vaikeustaso: ${kysymys.vaikeustaso})`);
      }

      if (kysymys) {
        nykyinenKysymys = kysymys;
        // Merkitse aloitusaika vastausta varten
        kysymysAloitettu = Date.now();

        // Merkitse kysymys kysytyksi
        if (kysymys.id) {
          kysytytKysymykset.add(kysymys.id);
          console.log(`🎯 Kysytty kysymys ${kysymys.id}: "${kysymys.kysymys}"`);
          console.log(
            `📝 Kysyttyjä kysymyksiä yhteensä: ${kysytytKysymykset.size}`
          );
        }

        // Generoi 4 vaihtoehtoa (1 oikea + 3 väärää)
        vastausVaihtoehdot = generoiVastausVaihtoehdot(nykyinenKysymys);

        // Aloita ajastin
        aloitaAjastin();
      } else {
        // Jos ei löydy kysymyksiä, siirry seuraavaan
        console.warn(
          `❌ Ei löytynyt uutta kysymystä vaikeustasolle: ${valittuVaikeustaso}`
        );
        console.warn(
          `📝 Kysyttyjä kysymyksiä: ${kysytytKysymykset.size}, Yrityksiä: ${yritykset}`
        );

        // Jos kysymyksiä on kysytty paljon, voidaan nollata lista
        if (kysytytKysymykset.size > 15) {
          console.log("🔄 Nollataan kysytyt kysymykset - kysymykset loppuivat");
          kysytytKysymykset.clear();
        }

        seuraavaKysymys();
      }
    } catch (error) {
      console.error("Virhe kysymyksen latauksessa:", error);
    } finally {
      loading = false;
    }
  }

  /**
   * Generoi 4 vastausvaihtoehtoa (1 oikea + 3 väärää)
   */
  function generoiVastausVaihtoehdot(kysymys: Kysymys): string[] {
    const vaihtoehdot = [kysymys.oikea_vastaus];

    // Lisää väärät vastaukset JSON-stringistä
    try {
      const vaaratVastaukset = JSON.parse(kysymys.vaarat_vastaukset);
      vaaratVastaukset.forEach((vastaus: string) => {
        if (vaihtoehdot.length < 4) {
          vaihtoehdot.push(vastaus);
        }
      });
    } catch (error) {
      console.error("Virhe väärien vastausten parsimisessa:", error);
    }

    // Täytä tarvittaessa yleisvaihtoehdoilla
    while (vaihtoehdot.length < 4) {
      const yleisVaihtoehdot = [
        "En tiedä",
        "Mikään näistä",
        "Kaikki edellä mainitut",
        "Ei mikään",
      ];
      for (const vaihtoehto of yleisVaihtoehdot) {
        if (!vaihtoehdot.includes(vaihtoehto) && vaihtoehdot.length < 4) {
          vaihtoehdot.push(vaihtoehto);
        }
      }
    }

    // Sekoita vaihtoehdot
    return sekoitaArray(vaihtoehdot);
  }

  /**
   * Sekoita array
   */
  function sekoitaArray<T>(array: T[]): T[] {
    const sekoitettu = [...array];
    for (let i = sekoitettu.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sekoitettu[i], sekoitettu[j]] = [sekoitettu[j], sekoitettu[i]];
    }
    return sekoitettu;
  }

  /**
   * Aloita ajastin
   */
  function aloitaAjastin() {
    if (peliPysaytetty) return; // Älä aloita ajastinta jos peli on pysäytetty

    aika = 30;
    putoaaAika = false;
    kellon_vari = "#10b981"; // Vihreä

    if (ajastin) clearInterval(ajastin);

    ajastin = setInterval(() => {
      if (peliPysaytetty) return; // Pysäytä ajastin jos peli pysäytetty

      aika--;

      // Vaihda kellon väri ajan mukaan
      if (aika > 20) {
        kellon_vari = "#10b981"; // Vihreä
      } else if (aika > 10) {
        kellon_vari = "#f59e0b"; // Oranssi
      } else {
        kellon_vari = "#ef4444"; // Punainen
        putoaaAika = true;
      }

      if (aika <= 0) {
        aikaLoppui();
      }
    }, 1000);
  }

  /**
   * Pysäytä peli
   */
  function pysaytaPeli() {
    peliPysaytetty = true;
    if (ajastin) {
      clearInterval(ajastin);
      ajastin = null;
    }
  }

  /**
   * Jatka peliä
   */
  function jatkaPelia() {
    peliPysaytetty = false;
    if (nykyinenKysymys && !pisteytys && !valittuVastaus) {
      // Jatka ajastinta vain jos kysymys on aktiivinen
      aloitaAjastin();
    }
  }

  /**
   * Aika loppui
   */
  function aikaLoppui() {
    if (ajastin) {
      clearInterval(ajastin);
      ajastin = null;
    }

    // Automaattisesti väärä vastaus
    tarkistaVastaus(null);
  }

  /**
   * Käsittele vastauksen valinta
   */
  function valitseVastaus(vastaus: string) {
    if (peliPysaytetty || valittuVastaus || pisteytys) return;

    valittuVastaus = vastaus;

    // Pysäytä ajastin
    if (ajastin) {
      clearInterval(ajastin);
      ajastin = null;
    }

    tarkistaVastaus(vastaus);
  }

  /**
   * Tarkista vastaus ja anna pisteet
   */
  async function tarkistaVastaus(vastaus: string | null) {
    pisteytys = true;
    const db = await getDB();
    const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];

    // Tarkista vastaus suoraan kysymyksestä
    const oikea = vastaus === nykyinenKysymys?.oikea_vastaus;

    // Valitse satunnainen pisteytysviesti
    pisteytysViesti = valitseSatunnainenViesti(oikea);

    const vastausaikaMs = kysymysAloitettu ? Date.now() - kysymysAloitettu : 0;

    if (oikea && nykyinenKysymys) {
      // Käytä kysymyksen omia pisteitä
      const pisteet = nykyinenKysymys.pistemaara_perus;
      pelaajanPisteet[nykyinenPelaaja.nimi] += pisteet;
      saatuPisteet = pisteet; // Tallenna animaatiota varten

      // Pisteet tallentuvat vain pelaajanPisteet-objektiin, ei tietokantaan tässä vaiheessa
    } else {
      saatuPisteet = 0; // Ei pisteitä väärästä vastauksesta
    }

    // Tallenna vastaus tietokantaan, jos peli-id löytyy
    try {
      const kayttajaId = nykyinenPelaaja.id;
      const peliId = kayttajaId !== undefined ? pelaajaPelit.get(kayttajaId) : undefined;
      if (peliId && nykyinenKysymys && nykyinenKysymys.id) {
        await db.tallennaPeliVastaus(
          peliId,
          nykyinenKysymys.id,
          vastaus || '',
          oikea,
          vastausaikaMs,
          nykyinenKysymys.kategoria
        );
        console.log('✅ Vastaus tallennettu tietokantaan:', { peliId, kysymysId: nykyinenKysymys.id, oikea, vastausaikaMs });

        // Kasvata pelaajan vastauslaskuria
        if (kayttajaId !== undefined) {
          pelaajanKysymysCount[kayttajaId] = (pelaajanKysymysCount[kayttajaId] || 0) + 1;
        }
      } else {
        console.warn('⚠️ PeliId tai kysymys puuttuu, vastausta ei tallennettu');
      }
    } catch (err) {
      console.error('❌ Vastausta tallennettaessa tapahtui virhe:', err);
    }

    // Näytä tulos hetki ja siirry seuraavaan
    setTimeout(() => {
      seuraavaKysymys();
    }, 500);
  }

  /**
   * Siirry seuraavaan kysymykseen tai pelaajaan
   */
  function seuraavaKysymys() {
    // Siirry seuraavaan pelaajaan jokaiseen kysymyksen jälkeen
    pelaajaIndex++;

    // Jos kaikki pelaajat ovat vastanneet, nosta kysymysnumeroa
    if (pelaajaIndex >= sekoitetutPelaajat.length) {
      pelaajaIndex = 0; // Takaisin ensimmäiseen pelaajaan
      kysymysNumero++;

      // Tarkista onko kaikki kierrokset pelattu
      if (kysymysNumero > maxKysymykset) {
        // Peli päättyi
        naytaTulokset();
        return;
      }
    }

    aloitaUusiKysymys();
  }

  /**
   * Näytä lopputulokset
   */
  function naytaTulokset() {
    // Tulokset näytetään komponentissa
    nykyinenKysymys = null;
    // Kun peli päättyy, tallenna pelien lopetus ja tilastot
    (async () => {
      try {
        const db = await getDB();
        for (const [kayttajaId, peliId] of pelaajaPelit.entries()) {
          const pisteet = pelaajanPisteet[sekoitetutPelaajat.find(p => p.id === kayttajaId)?.nimi || ''] || 0;
          const vastaukset = await db.haePeliVastauksetByPeliId(peliId);
          const oikeita = vastaukset.filter(v => v.oikein).length;
          const vaaria = vastaukset.filter(v => !v.oikein).length;
          const yhteensa = vastaukset.length;
          const vastausprosentti = yhteensa > 0 ? (oikeita / yhteensa) * 100 : 0;
          const kategoriat: Record<string, { oikeita: number; vaaria: number }> = {};
          for (const v of vastaukset) {
            const k = v.kategoria || 'Tuntematon';
            if (!kategoriat[k]) kategoriat[k] = { oikeita: 0, vaaria: 0 };
            if (v.oikein) kategoriat[k].oikeita++;
            else kategoriat[k].vaaria++;
          }

          console.log('📊 Tallennetaan lopputilastot pelaajalle', kayttajaId, { pisteet, oikeita, vaaria, yhteensa, vastausprosentti, kategoriat });

          // Päivitä peli ja pelaajan pisteet
          try {
            await db.lopetaPeli(peliId, pisteet, pelaajanKysymysCount[kayttajaId] || yhteensa);
          } catch (err) {
            console.warn('⚠️ lopetaPeli epäonnistui:', err);
          }

          try {
            await db.paivitaKayttajanPisteet(kayttajaId, pisteet);
          } catch (err) {
            console.warn('⚠️ paivitaKayttajanPisteet epäonnistui:', err);
          }

          // Tallenna tilasto
          try {
            await db.tallennaTilasto({
              kayttaja_id: kayttajaId,
              pelatut_pelit: 1,
              kokonais_pisteet: pisteet,
              oikeita_vastauksia: oikeita,
              vaaria_vastauksia: vaaria,
              vastausprosentti,
              kategoriatilastot: kategoriat,
              paivays: new Date().toISOString(),
            });
          } catch (err) {
            console.warn('⚠️ tallennaTilasto epäonnistui:', err);
          }
        }
      } catch (error) {
        console.error('❌ Virhe tallennettaessa lopputilastoja:', error);
      }
    })();
  }

  /**
   * Hae pelaajan värikoodi
   */
  function haePelaajanVari(pelaaja: Kayttaja): string {
    return pelaaja.pelaajan_vari || "#3b82f6";
  }

  /**
   * Muunna vaikeustaso tähtimerkiksi
   */
  function vaikeustasoTahtina(vaikeustaso: string): string {
    switch (vaikeustaso) {
      case "oppipoika":
        return "🪵";
      case "taitaja":
        return "🎨";
      case "mestari":
        return "⚔️";
      case "kuningas":
        return "👑";
      case "suurmestari":
        return "🌌";
      default:
        return "🪵";
    }
  }

  /**
   * Ilmoita virhe kysymyksessä
   */
  async function ilmoitaVirhe() {
    if (!nykyinenKysymys?.id) return;
    
    try {
      const db = await getDB();
      await db.merkitseVirheeliiseksi(nykyinenKysymys.id);
      console.log("✅ Virhe ilmoitettu kysymyksestä:", nykyinenKysymys.id);
      
      // Näytä vahvistusviesti
      alert("Kiitos ilmoituksesta! Virhe on merkitty ja järjestelmänvalvoja tarkistaa kysymyksen.");
    } catch (error) {
      console.error("❌ Virhe ilmoituksen lähettämisessä:", error);
      alert("Virhe ilmoituksen lähettämisessä. Yritä uudelleen.");
    }
  }

  /**
   * Formatoi aika näyttöä varten
   */
  function formatoiAika(aika: number): string {
    return aika.toString().padStart(2, "0");
  }

  /**
   * Palaa takaisin päävalikkoon
   */
  function palaaNavigation() {
    if (ajastin) {
      clearInterval(ajastin);
    }
    takaisinCallback();
  }
</script>

<!-- =============================================== -->
<!-- PÄÄSISÄLTÖ (Main Content) -->
<!-- =============================================== -->

<!-- Glass effect background with floating particles -->
<div class="{GLASS_BACKGROUNDS.main}">
  <!-- Floating elements background -->
  <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
    {@html GLASS_BACKGROUNDS.floatingParticles}
  </div>

  <!-- Main layout with sidebar structure -->
  <div class="{GLASS_BACKGROUNDS.contentLayer} min-h-screen">
    <div class="flex">
      <!-- Left Sidebar - Defensive Cards -->
      <div class="w-72 p-4 space-y-4">
        <h3 class="text-lg font-bold text-center mb-4 {GLASS_COLORS.titleGradient}">🛡️ Puolustuskortit</h3>
        
        <!-- Kysymyksen vaihto -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🎭 Kysymyksen vaihto – jos et halua vastata, vaihda kortti toiseen."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🎭</span>
            <span class="text-blue-400 font-medium">Kysymyksen vaihto</span>
          </div>
        </button>
        
        <!-- Aikalisä -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🕑 Aikalisä – saat ylimääräisen hetken miettimiseen."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🕑</span>
            <span class="text-cyan-400 font-medium">Aikalisä</span>
          </div>
        </button>
        
        <!-- Tuplapisteet -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🎯 Tuplapisteet – seuraava oikea vastaus antaa 2× pisteet."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🎯</span>
            <span class="text-teal-400 font-medium">Tuplapisteet</span>
          </div>
        </button>
        
        <!-- Puolitus (50/50) -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🪄 Puolitus – poistaa kaksi väärää vastausta (50/50)."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🪄</span>
            <span class="text-indigo-400 font-medium">Puolitus</span>
          </div>
        </button>
      </div>

      <!-- Main Game Area -->
      <div class="flex-1 max-w-5xl mx-auto p-4 space-y-4">
        <!-- Header Card -->
        <div class="{GLASS_STYLES.card} p-4">
          <div class="flex justify-between items-center">
            <button 
              class="{glassUtils.button('ghost')}"
              on:click={palaaNavigation}
            >
              ← Takaisin
            </button>

            <h1 class="text-4xl font-bold {GLASS_COLORS.titleGradient}">
              🎯 Kysymyssota
            </h1>

            <div class="text-right">
              <div class="text-sm {GLASS_COLORS.textSecondary}">Kysymys</div>
              <div class="text-xl font-bold">{kysymysNumero}/{maxKysymykset}</div>
            </div>
          </div>
        </div>

        {#if loading}
          <!-- Loading Animation -->
          <div class="{GLASS_STYLES.card} p-12">
            <div class="{GLASS_LAYOUT.flexCenter} space-y-4">
              <div class="{GLASS_ANIMATIONS.spinner}"></div>
              <span class="text-lg">Ladataan kysymystä...</span>
            </div>
          </div>
        {:else if nykyinenKysymys}
          <!-- Game View -->
          <div class="space-y-4">
      <!-- Nykyinen pelaaja, pelaajajärjestys ja ajastin -->
      <div class="flex justify-between items-center">
        <!-- Nykyinen pelaaja (vasen) -->
        <div class="flex items-center space-x-4 flex-1">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style="background: linear-gradient(135deg, {haePelaajanVari(
              sekoitetutPelaajat[pelaajaIndex]
            )}, {haePelaajanVari(sekoitetutPelaajat[pelaajaIndex])}dd)"
          >
            <span class="text-lg font-bold text-white">
              {sekoitetutPelaajat[pelaajaIndex].nimi.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div
              class="text-lg font-bold"
              style="color: {haePelaajanVari(sekoitetutPelaajat[pelaajaIndex])}"
            >
              {sekoitetutPelaajat[pelaajaIndex].nimi}
            </div>
            <div
              class="text-sm {GLASS_COLORS.textSecondary} transition-all duration-500"
              class:text-green-400={pisteytys && saatuPisteet > 0}
              class:font-bold={pisteytys && saatuPisteet > 0}
              class:animate-pulse={pisteytys && saatuPisteet > 0}
            >
              💎 {pelaajanPisteet[sekoitetutPelaajat[pelaajaIndex].nimi] || 0} pistettä
            </div>
          </div>
        </div>

        <!-- Pelaajajärjestys (keskellä) -->
        <div class="flex-1 flex justify-center">
          <div class="{GLASS_STYLES.cardLight} p-3">
            <div class="text-xs {GLASS_COLORS.textSecondary} text-center mb-2">
              Pelijärjestys
            </div>
            <div class="flex items-center space-x-2">
              {#each sekoitetutPelaajat as pelaaja, index}
                <div class="flex items-center">
                  <div
                    class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                    class:scale-125={index === pelaajaIndex}
                    class:ring-2={index === pelaajaIndex}
                    class:ring-white={index === pelaajaIndex}
                    style="background: linear-gradient(135deg, {haePelaajanVari(
                      pelaaja
                    )}, {haePelaajanVari(pelaaja)}dd); color: white;"
                  >
                    {pelaaja.nimi.charAt(0).toUpperCase()}
                  </div>
                  {#if index < sekoitetutPelaajat.length - 1}
                    <div class="{GLASS_COLORS.textSecondary} text-xs mx-1">→</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>

        <!-- Ajastin (oikea) -->
        <div class="flex-1 flex justify-end">
          <div class="text-center">
            <button
              class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-2xl transition-all duration-300 hover:scale-110 cursor-pointer relative"
              class:animate-pulse={putoaaAika}
              style="background: linear-gradient(135deg, {kellon_vari}, {kellon_vari}dd); box-shadow: 0 0 20px {kellon_vari}66;"
              on:click={() =>
                nykyinenKysymys && !pisteytys
                  ? peliPysaytetty
                    ? jatkaPelia()
                    : pysaytaPeli()
                  : null}
              disabled={!nykyinenKysymys || pisteytys}
              title={peliPysaytetty
                ? "Klikkaa jatkaaksesi peliä"
                : "Klikkaa pysäyttääksesi pelin"}
            >
              {#if peliPysaytetty}
                <div
                  class="absolute inset-0 flex items-center justify-center text-xl"
                >
                  ▶️
                </div>
              {:else}
                {formatoiAika(aika)}
              {/if}
            </button>
            <div class="text-xs {GLASS_COLORS.textSecondary} mt-1">
              {peliPysaytetty ? "Pysäytetty" : "sekuntia"}
            </div>
          </div>
        </div>
      </div>

      <!-- Kysymys -->
      <div class="{GLASS_STYLES.card} p-8 relative"
        class:border-red-400={nykyinenKysymys.virhe}
        class:bg-red-100={nykyinenKysymys.virhe}
      >
        <!-- Pistemäärä ja vaikeustaso yläkulmissa -->
        <div class="flex justify-between items-start mb-4">
          <div class="flex items-center space-x-2">
            <div
              class="{GLASS_STYLES.cardLight} p-2 px-3 transition-all duration-500"
              class:animate-pulse={pisteytys && saatuPisteet > 0}
              class:scale-110={pisteytys && saatuPisteet > 0}
              class:border-green-400={pisteytys && saatuPisteet > 0}
              style={pisteytys && saatuPisteet > 0
                ? "background-color: rgb(34 197 94 / 0.3);"
                : ""}
            >
              <div class="text-xl font-bold text-primary-300">
                {nykyinenKysymys.pistemaara_perus}
              </div>
              <div class="text-sm font-bold text-primary-400">💎</div>
            </div>
          </div>
          <div
            class="text-4xl opacity-75"
            title="Vaikeustaso: {nykyinenKysymys.vaikeustaso}"
          >
            {vaikeustasoTahtina(nykyinenKysymys.vaikeustaso)}
          </div>
        </div>

        <h2 class="text-2xl font-bold text-center mb-4">
          {nykyinenKysymys.kysymys}
        </h2>

        {#if nykyinenKysymys.kategoria}
          <div class="text-center">
            <span
              class="inline-block px-3 py-1 rounded-full text-sm bg-primary-500/20 text-primary-500"
            >
              📚 {nykyinenKysymys.kategoria}
            </span>
          </div>
        {/if}

        <!-- Virheilmoitusnappi oikeassa alakulmassa -->
        <button
          class="absolute bottom-4 right-4 p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-all duration-200 text-xs"
          on:click={ilmoitaVirhe}
          title="Ilmoita virhe kysymyksessä"
        >
          🚨
        </button>
      </div>

      <!-- Vastausvaihtoehdot -->
      <div class="relative">
        {#if peliPysaytetty}
          <!-- Pysäytyksen overlay -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg"
          >
            <div class="text-center p-6">
              <div class="text-4xl mb-2">⏸️</div>
              <div class="text-xl font-bold text-white mb-2">
                Peli pysäytetty
              </div>
              <div class="text-sm {GLASS_COLORS.textSecondary}">
                Klikkaa kelloa jatkaaksesi peliä
              </div>
            </div>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each vastausVaihtoehdot as vastaus, index}
            {@const kirjain = String.fromCharCode(65 + index)}
            {@const pelaajanVari = haePelaajanVari(sekoitetutPelaajat[pelaajaIndex])}
            {@const matalaKontrasti = pelaajanVari + '40'} <!-- 25% läpinäkyvyys -->
            {@const korkeampiKontrasti = pelaajanVari + '80'} <!-- 50% läpinäkyvyys -->
            <!-- A, B, C, D -->
            <button
              class="{GLASS_STYLES.card} p-6 text-left transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
              class:border-green-400={pisteytys && vastaus === nykyinenKysymys?.oikea_vastaus}
              class:border-red-400={pisteytys && vastaus === valittuVastaus && vastaus !== nykyinenKysymys?.oikea_vastaus}
              class:opacity-50={pisteytys && vastaus !== nykyinenKysymys?.oikea_vastaus && vastaus !== valittuVastaus}
              class:scale-[1.02]={valittuVastaus === vastaus}
              style="border-color: {matalaKontrasti}; background: linear-gradient(135deg, {matalaKontrasti} 0%, rgba(255,255,255,0.1) 100%);"
              disabled={peliPysaytetty || valittuVastaus !== null || pisteytys}
              on:click={() => valitseVastaus(vastaus)}
            >
              <div class="flex items-center space-x-4">
                <div
                  class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-lg transition-all duration-300"
                  style="background-color: {pisteytys 
                    ? (vastaus === nykyinenKysymys?.oikea_vastaus 
                       ? '#10b981' 
                       : vastaus === valittuVastaus && vastaus !== nykyinenKysymys?.oikea_vastaus 
                         ? '#ef4444' 
                         : '#6b7280')
                    : korkeampiKontrasti}; 
                    box-shadow: 0 4px 12px {pisteytys 
                      ? (vastaus === nykyinenKysymys?.oikea_vastaus 
                         ? 'rgba(16, 185, 129, 0.4)' 
                         : vastaus === valittuVastaus && vastaus !== nykyinenKysymys?.oikea_vastaus 
                           ? 'rgba(239, 68, 68, 0.4)' 
                           : 'rgba(0, 0, 0, 0.1)')
                      : matalaKontrasti};"
                >
                  {kirjain}
                </div>
                <div class="flex-1 text-lg">
                  {vastaus}
                </div>

                {#if pisteytys && vastaus === nykyinenKysymys?.oikea_vastaus}
                  <div class="text-green-500 text-xl">✓</div>
                {:else if pisteytys && vastaus === valittuVastaus && vastaus !== nykyinenKysymys?.oikea_vastaus}
                  <div class="text-red-500 text-xl">✗</div>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Pisteytysviesti -->
      {#if pisteytys}
        <div class="text-center py-4">
          {#if valittuVastaus === nykyinenKysymys?.oikea_vastaus}
            <div class="text-2xl font-bold text-green-500 animate-bounce">
              {pisteytysViesti} +{saatuPisteet} pistettä
            </div>
            <div class="text-lg text-green-400 mt-2">
              💎 Pisteitä: {pelaajanPisteet[
                sekoitetutPelaajat[pelaajaIndex].nimi
              ] || 0}
            </div>
          {:else}
            <div class="text-2xl font-bold text-red-500">
              {pisteytysViesti}
            </div>
            <div class="text-lg text-red-400 mt-2">
              Oikea vastaus: {nykyinenKysymys?.oikea_vastaus}
            </div>
            <div class="text-lg text-red-400 mt-1">
              💎 Pisteet: {pelaajanPisteet[
                sekoitetutPelaajat[pelaajaIndex].nimi
              ] || 0}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <!-- Lopputulokset -->
    <div class="space-y-8">
      <div class="text-center">
        <h2 class="text-3xl font-bold mb-8">🏆 Peli päättyi!</h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {#each Object.entries(pelaajanPisteet).sort(([, a], [, b]) => b - a) as [pelaajanimi, pisteet], index}
            {@const pelaaja = sekoitetutPelaajat.find(
              (p) => p.nimi === pelaajanimi
            )}
            {#if pelaaja}
              <div
                class="{GLASS_STYLES.card} p-6 transition-all duration-300"
                style="border-color: {haePelaajanVari(pelaaja)};"
              >
                <div class="text-center space-y-4">
                  <div class="text-2xl">
                    {#if index === 0}🥇{:else if index === 1}🥈{:else if index === 2}🥉{:else}🏅{/if}
                  </div>
                  <div
                    class="w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg"
                    style="background: linear-gradient(135deg, {haePelaajanVari(
                      pelaaja
                    )}, {haePelaajanVari(pelaaja)}dd)"
                  >
                    <span class="text-xl font-bold text-white">
                      {pelaaja.nimi.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <h3
                    class="text-xl font-bold"
                    style="color: {haePelaajanVari(pelaaja)}"
                  >
                    {pelaaja.nimi}
                  </h3>
                  <div class="text-3xl font-bold text-primary-500">
                    {pisteet} pistettä
                  </div>
                </div>
              </div>
            {/if}
          {/each}
        </div>

        <div class="text-center mt-8">
          <button
            class="{glassUtils.button('primary')} text-xl px-8 py-3"
            on:click={palaaNavigation}
          >
            🏠 Takaisin päävalikkoon
          </button>
        </div>
      </div>
    </div>
  {/if}
  </div>

      <!-- Right Sidebar - Battle Cards -->
      <div class="w-72 p-4 space-y-4">
        <h3 class="text-lg font-bold text-center mb-4 {GLASS_COLORS.titleGradient}">⚔️ Taistelukortit</h3>
        
        <!-- Pakota vaihto -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="📦 Pakota vaihto – anna oma kysymyksesi jollekin toiselle ja ota hänen kysymyksensä."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">📦</span>
            <span class="text-primary-400 font-medium">Pakota vaihto</span>
          </div>
        </button>
        
        <!-- Nollaus -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🌀 Nollaus – valitse pelaaja, jonka edellinen pistelisäys mitätöidään."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🌀</span>
            <span class="text-purple-400 font-medium">Nollaus</span>
          </div>
        </button>
        
        <!-- Sekoitus -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🌪️ Sekoitus – kaikkien pelaajien seuraavat kysymykset sekoitetaan satunnaisesti."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🌪️</span>
            <span class="text-emerald-400 font-medium">Sekoitus</span>
          </div>
        </button>
        
        <!-- Bonus -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="⭐ Bonus – jos vastaat oikein, saat heti toisen kysymyksen."
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">⭐</span>
            <span class="text-orange-400 font-medium">Bonus</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  /* Glass morphism yhteensopivat siirtymät */
  .hover-scale {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .hover-scale:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
  }
</style>
