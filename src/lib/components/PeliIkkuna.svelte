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
  // Modal / notification
  let modalVisible = false;
  let modalMessage = "";
  let modalTimeout: number | null = null;

  function showModal(message: string, ms = 2500) {
    modalMessage = message;
    modalVisible = true;
    if (modalTimeout) window.clearTimeout(modalTimeout);
    modalTimeout = window.setTimeout(() => {
      modalVisible = false;
      modalTimeout = null;
    }, ms);
  }

  function hideModal() {
    modalVisible = false;
    if (modalTimeout) {
      window.clearTimeout(modalTimeout);
      modalTimeout = null;
    }
  }

    // Erikoiskortit (data)
    import erikoiskortit from "../data/erikoiskortit.json";

    // In-memory aktiiviset erikoiskorttiefektit (pelaajaId -> efektit)
    const activeCardEffects: Record<number, any> = {};

  // Pisteytysviestit
  let pisteytysViestit: { oikeat_vastaukset: string[]; vaarat_vastaukset: string[] } = {
    oikeat_vastaukset: [],
    vaarat_vastaukset: []
  };

  // Kello
  let aika = 30; // 30 sekuntia per kysymys
  let ajastin: NodeJS.Timeout | null = null;
  let kellon_vari = "#10b981"; // Vihreä

  // Reactive clock visuals: glow and pulse depending on remaining time
  $: clockBoxShadow = aika <= 10
    ? `0 12px 40px ${kellon_vari}55, 0 2px 6px rgba(0,0,0,0.08) inset`
    : aika <= 20
    ? `0 8px 28px ${kellon_vari}44, 0 2px 6px rgba(0,0,0,0.06) inset`
    : `0 4px 12px ${kellon_vari}22, 0 2px 6px rgba(0,0,0,0.04) inset`;

  $: clockAnimation = aika <= 10 ? `pulse-fast 0.8s infinite ease-in-out` : aika <= 20 ? `pulse-slow 1.6s infinite ease-in-out` : 'none';

  // Huom: yllä olevat reaktiiviset muuttujat muuttuvat automaattisesti kun `aika` tai
  // `kellon_vari` päivittyvät. Ne ohjaavat kellon varjon ja animaation intensiteettiä
  // (ei muuta pelilogiikkaa — vain visuaalinen palaute pelaajille).

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
  // Pelaajan pisteet lasketaan pelin aikana (käytetään valuuttana erikoiskortteihin)
  // Pelaajan pisteet näkyvät jo `pelaajanPisteet`-objektissa (nimi -> pisteet)

  // Palauttaa pelaajan id nykyisestä indeksistä (tai undefined)
  function nykyinenPelaajaId(): number | undefined {
    const p = sekoitetutPelaajat[pelaajaIndex];
    return p && typeof p.id !== 'undefined' ? p.id : undefined;
  }

  /*
    Huomautus: useimmat seuraavista util-funktioista ovat pieniä apureita UI- ja korttilogiikan
    tukemiseksi. Ne eivät tee pysyviä muutoksia sovelluksen tilaan ellei niitä nimenomaisesti
    kutsuta toiminnon yhteydessä (esim. kortin käyttö vähentää pisteitä ja tallentaa lokin DB:hen).
  */

  // Estää kortin käytön kun pelaaja on jo vastannut nykyiseen kysymykseen (odotusaika / pisteytys)
  function canUseKortti(): boolean {
    if (valittuVastaus !== null || pisteytys) {
      showModal('Et voi käyttää kortteja sen jälkeen kun olet vastannut.');
      return false;
    }
    return true;
  }

  // Target selection state for attack cards
  let targetSelectionVisible = false;
  let pendingKortti: any = null;
  let selectedTarget: Kayttaja | null = null;
  let showConfirmForTarget = false;

  import { targetPicker } from '../stores/targetPicker';

  // Open the target picker for an attack card key (delegate UI to app-level overlay)
  function openTargetSelection(korttiKey: string) {
    if (!canUseKortti()) return;
    const kortti = (erikoiskortit as any).find((k: any) => k.key === korttiKey);
    if (!kortti) return showModal('Korttia ei loydy');

    const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
    if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
    const kustannus = Number(kortti.kustannus || 0);
    const nimi = nykyinenPelaaja.nimi;
    const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
    if (isNaN(kustannus)) { showModal('Kortin kustannus ei ole kelvollinen'); return; }
    if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');

    // Deduct cost locally and persist usage immediately (as before)
    pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
    (async () => {
      try {
        const db = await getDB();
        const peliId = typeof nykyinenPelaaja.id !== 'undefined' ? (pelaajaPelit.get(nykyinenPelaaja.id) || null) : null;
        await db.tallennaKortinKaytto({
          peli_id: peliId,
          kayttaja_id: nykyinenPelaaja.id,
          kortti_key: kortti.key,
          kustannus: kustannus,
          parametrit: kortti.parametrit || {}
        });
      } catch (e) {
        console.warn('Kortin tallennus epäonnistui:', e);
      }
    })();

    // Open the top-level overlay, pass players and a confirm callback
    targetPicker.open(kortti, sekoitetutPelaajat, async (target) => {
      // On confirm: apply card effects to the selected target
      try {
        const tid = Number(target.id);
        if (kortti.key === 'ajan_puolitus') {
          activeCardEffects[tid] = activeCardEffects[tid] || {};
          activeCardEffects[tid].ajan_puolitus = Number(kortti.parametrit?.puolitusSekunteina || 15);
          activeCardEffects[tid].ajan_puolitus_remainingQuestions = Number(kortti.parametrit?.kestoKysymyksina || 1);
          showModal(`Ajan puolitus aktivoitu: ${target.nimi} saa seuraavaksi vain ${activeCardEffects[tid].ajan_puolitus}s`);
        } else if (kortti.key === 'pakota_vaihto') {
          showModal(`Pakota vaihto aktivoitu kohteelle ${target.nimi}`);
        } else if (kortti.key === 'nollaus') {
          showModal(`Nollaus aktivoitu kohteelle ${target.nimi}`);
        } else {
          showModal(`${kortti.nimi} aktivoitu kohteelle ${target.nimi}`);
        }
      } catch (err) {
        console.error('Kortin kaytto epäonnistui:', err);
        showModal('Kortin käyttö epäonnistui');
      }
    });
  }

  // performPendingAttackOn: suorittaa odottavan hyökkäyksen valittua targetia kohtaan.
  // Tämä funktio päivittää paikallisen tilan (pelaajan pisteet) ja tallentaa kortin
  // käytön tietokantaan. Korttien varsinaiset peliefektit (esim. ajan puolitus) asetetaan
  // `activeCardEffects`-objektiin, jota muut funktiot lukevat kysymyksen alkaessa.

  // Perform the pending attack card on selected target player
  async function performPendingAttackOn(target: Kayttaja) {
    if (!pendingKortti) return;
    try {
      const kortti = pendingKortti;
      const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
      if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
      const db = await getDB();
      const kustannus = Number(kortti.kustannus || 0);
      const nimi = nykyinenPelaaja.nimi;

      // Deduct cost locally and persist usage
      pelaajanPisteet[nimi] = (pelaajanPisteet[nimi] || 0) - kustannus;
      await db.tallennaKortinKaytto({
        peli_id: pelaajaPelit.get(nykyinenPelaaja.id) || null,
        kayttaja_id: nykyinenPelaaja.id,
        kortti_key: kortti.key,
        kustannus: kustannus,
        parametrit: kortti.parametrit || {}
      });

      const tid = Number(target.id);
      // Apply card-specific effects for attack cards
      if (kortti.key === 'ajan_puolitus') {
        activeCardEffects[tid] = activeCardEffects[tid] || {};
        activeCardEffects[tid].ajan_puolitus = Number(kortti.parametrit?.puolitusSekunteina || 15);
        activeCardEffects[tid].ajan_puolitus_remainingQuestions = Number(kortti.parametrit?.kestoKysymyksina || 1);
        showModal(`Ajan puolitus aktivoitu: ${target.nimi} saa seuraavaksi vain ${activeCardEffects[tid].ajan_puolitus}s`);
      } else if (kortti.key === 'pakota_vaihto') {
        // Minimal: persist and notify. Full swap logic is game-state heavy.
        showModal(`Pakota vaihto aktivoitu kohteelle ${target.nimi}`);
      } else if (kortti.key === 'nollaus') {
        // Minimal: persist and notify. Implement zeroing logic elsewhere if needed.
        showModal(`Nollaus aktivoitu kohteelle ${target.nimi}`);
      } else {
        // Fallback: just notify
        showModal(`${kortti.nimi} aktivoitu kohteelle ${target.nimi}`);
      }
    } catch (err) {
      console.error('Kortin kaytto epäonnistui:', err);
      showModal('Kortin käyttö epäonnistui');
    } finally {
      pendingKortti = null;
      targetSelectionVisible = false;
    }
  }

  // Helper called by Confirm button to ensure non-null target
  function performConfirmIfSelected() {
    if (selectedTarget) {
      // cast non-nullable
      performPendingAttackOn(selectedTarget as Kayttaja);
    }
  }

  // Hae kortin kustannus erikoiskortit datasta
  function kortinKustannus(key: string): number {
    try {
      const k = (erikoiskortit as any).find((it: any) => it.key === key);
      return Number(k?.kustannus || 0);
    } catch (e) {
      return 0;
    }
  }

  // Tarkistaa onko pelaajalla riittävästi pisteitä (valuutta = pisteet)
  function pelaajallaOnRiittavasti(kayttajaId: number | undefined, kustannus: number) {
    // Jos kayttajaId puuttuu (esim. guest-tila), käytä nykyistä pelaajaa indeksin avulla
    let pelaaja: Kayttaja | undefined;
    if (typeof kayttajaId !== 'undefined') {
      pelaaja = sekoitetutPelaajat.find(p => p.id === kayttajaId);
    }
    if (!pelaaja) {
      pelaaja = sekoitetutPelaajat[pelaajaIndex];
    }
    if (!pelaaja) return false;
    const nimi = pelaaja.nimi;
    return (pelaajanPisteet[nimi] || 0) >= kustannus;
  }

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
      // Aloitustila: pelaajan pisteet nollataan komponentin sisäisesti
      sekoitetutPelaajat.forEach(p => {
        pelaajanPisteet[p.nimi] = 0;
      });
    }
  });

  onDestroy(() => {
    if (ajastin) {
      clearInterval(ajastin);
    }
  });

  /*
    Elinkaarimuodot (onMount/onDestroy) huolehtivat komponentin alustus- ja
    siivoustoiminnoista. onMount lataa tarvittavat dataresurssit ja aloittaa
    ensimmäisen kysymyksen, onDestroy varmistaa että ajastin siivotaan kun
    komponentti poistetaan näkymästä.
  */

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
    // Tässä funktiossa haetaan seuraava kysymys tietokannasta, asetetaan vastausvaihtoehdot
    // ja käynnistetään ajastin. Funktion sisällä huomioidaan myös pelaajakohtaiset
    // erikoiskorttiefektit (esim. ajan puolitus), jotka voivat muuttaa alkavaa ajastusaikaa.
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

        // Aloita ajastin: käytä local startSeconds jotta edellisen pelaajan jäljellä oleva 'aika' ei vuoda
        let startSeconds = 30;
        try {
          const nykyinen = sekoitetutPelaajat[pelaajaIndex];
          if (nykyinen && typeof nykyinen.id !== 'undefined') {
            const pid = Number(nykyinen.id);
            const efekti = activeCardEffects[pid];
            if (efekti && typeof efekti.ajan_puolitus === 'number') {
              // Apply reduced time for this player's question
              startSeconds = Number(efekti.ajan_puolitus) || 15;
              // Consume lifetime
              if (typeof efekti.ajan_puolitus_remainingQuestions === 'number') {
                efekti.ajan_puolitus_remainingQuestions = Math.max(0, efekti.ajan_puolitus_remainingQuestions - 1);
                if (efekti.ajan_puolitus_remainingQuestions <= 0) delete efekti.ajan_puolitus_remainingQuestions;
              }
              // Remove the direct effect value so it doesn't apply again
              delete efekti.ajan_puolitus;
              const hasAny = Object.keys(efekti).some(k => !!efekti[k]);
              if (!hasAny) delete activeCardEffects[pid];
              console.log(`⏱️ Ajan puolitus applied for playerId=${pid}, time=${startSeconds}`);
            }
          }
        } catch (e) {
          console.warn('⚠️ Virhe ajan_puolitus effectin soveltamisessa:', e);
        }

        // Start timer with the computed local startSeconds
        aloitaAjastin(startSeconds);
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
  function aloitaAjastin(startSeconds?: number) {
    // Aloittaa / käynnistää sekuntipohjaisen ajastuksen. Jos peli on pysäytetty,
    // funktio ei tee mitään. Ajastin päivittää `aika`-muuttujaa joka sekunti ja
    // asettaa kellon värin/arvot visuaalista palautetta varten (vihreä -> oranssi -> punainen).
    if (peliPysaytetty) return; // Älä aloita ajastinta jos peli on pysäytetty

    // If a startSeconds was provided, use it; otherwise default to 30
    if (typeof startSeconds === 'number') {
      aika = startSeconds;
    } else if (!aika || typeof aika !== 'number') {
      aika = 30;
    }
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
      aloitaAjastin(aika);
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
    // Funktio arvioi vastauksen oikeellisuuden, laskee pisteet (mukaan lukien
    // mahdolliset erikoisefektien vaikutukset kuten tuplapisteet), tallentaa vastauksen
    // tietokantaan ja hoitaa siirtymisen seuraavaan kysymykseen. Pisteytys on suojattu
    // lipulla `pisteytys` jotta kaksinkertaiset kutsut (esim. timeout + click) eivät
    // aiheuta kaksinkertaista palkintoa.
    // Prevent double-processing (calls from both click and timeout)
    if (pisteytys) {
      console.warn('tarkistaVastaus called but scoring already in progress');
      return;
    }
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
      let pisteet = nykyinenKysymys.pistemaara_perus;
      // Tarkista onko pelaajalla aktiivisia erikoiskorttiefektejä (esim. tuplapisteet)
      if (nykyinenPelaaja && typeof nykyinenPelaaja.id !== 'undefined') {
        const pid = Number(nykyinenPelaaja.id);
        const efekti = activeCardEffects[pid];
        if (efekti && typeof efekti.tuplapisteet === 'number' && efekti.tuplapisteet > 0) {
          console.log(`🔍 Tuplapisteet before consumption for playerId=${pid}:`, efekti.tuplapisteet);
          pisteet = pisteet * 2;
          // Kuluta yksi tuplapisteen käyttö safely
          efekti.tuplapisteet = Math.max(0, efekti.tuplapisteet - 1);
          console.log(`🔍 Tuplapisteet after consumption for playerId=${pid}:`, efekti.tuplapisteet);
        }
      }
  // Debug: log before changing points to detect unexpected increments
  const playerName = (nykyinenPelaaja && nykyinenPelaaja.nimi) ? nykyinenPelaaja.nimi : 'tuntematon';
  const beforePoints = pelaajanPisteet[playerName] || 0;
  console.log('🏷️ Awarding points:', { player: playerName, before: beforePoints, add: pisteet, efekt: activeCardEffects[nykyinenPelaaja?.id ?? -1] });
  pelaajanPisteet[playerName] = beforePoints + pisteet;
  saatuPisteet = pisteet; // Tallenna animaatiota varten
  console.log('✅ Points after award:', { player: playerName, after: pelaajanPisteet[playerName] });
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

    // Näytä tulos hetki ja päätä pitääkö pelaaja saada lisävuoro (Bonus)
    let keepTurn = false;
    try {
      if (oikea && nykyinenPelaaja && typeof nykyinenPelaaja.id !== 'undefined') {
        const pid = Number(nykyinenPelaaja.id);
        const efekti = activeCardEffects[pid];
        if (efekti && typeof efekti.bonus === 'number' && efekti.bonus > 0) {
          console.log(`⭐ Bonus consumed for playerId=${pid}: before=${efekti.bonus}`);
          // Consume one bonus use
          efekti.bonus = Math.max(0, efekti.bonus - 1);
          // Decrement lifetime if present
          if (typeof efekti.bonus_remainingQuestions === 'number') {
            efekti.bonus_remainingQuestions = Math.max(0, efekti.bonus_remainingQuestions - 1);
            if (efekti.bonus_remainingQuestions <= 0) delete efekti.bonus_remainingQuestions;
          }
          if (efekti.bonus <= 0) delete efekti.bonus;

          // If no other keys remain, remove the whole effect object
          const hasAny = efekti && Object.keys(efekti).some(k => !!efekti[k]);
          if (!hasAny) {
            delete activeCardEffects[pid];
            console.log(`🗑️ Poistettu kaikki efektit pelaajalta ${pid} (bonus kulutettu)`);
          }

          keepTurn = true;
        }
      }
    } catch (e) {
      console.warn('⚠️ Virhe bonuksen kulutuksessa tarkistaVastaus:', e);
    }

    setTimeout(() => {
      if (keepTurn) {
        showModal('Bonus: saat lisävuoron!');
        // Start a new question for the same player (do not advance index)
        aloitaUusiKysymys();
      } else {
        seuraavaKysymys();
      }
    }, 3500);
  }

  /**
   * Siirry seuraavaan kysymykseen tai pelaajaan
   */
  function seuraavaKysymys() {
    // Muista pelaaja, joka juuri vastasi (hänen efektinsä voivat vanhentua)
    const juuriVastannut = sekoitetutPelaajat[pelaajaIndex];

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

      // Kun pelaajan vuoro loppuu, laske hänen aktiivisten korttiefektien jäljellä oleva kesto
      try {
        if (juuriVastannut && typeof juuriVastannut.id !== 'undefined') {
          const pid = Number(juuriVastannut.id);
          const efekti = activeCardEffects[pid];
          if (efekti) {
            // Tuplapisteet: laske remainingQuestions
            if (typeof efekti.tuplapisteet_remainingQuestions === 'number') {
              efekti.tuplapisteet_remainingQuestions = Math.max(0, efekti.tuplapisteet_remainingQuestions - 1);
              console.log(`⏳ Tuplapisteet remaining for playerId=${pid}:`, efekti.tuplapisteet_remainingQuestions);
              if (efekti.tuplapisteet_remainingQuestions <= 0) {
                // Poista tuplapisteet kokonaan
                efekti.tuplapisteet = 0;
                delete efekti.tuplapisteet_remainingQuestions;
              }
            }
            // Bonus: laske remainingQuestions
            if (typeof efekti.bonus_remainingQuestions === 'number') {
              efekti.bonus_remainingQuestions = Math.max(0, efekti.bonus_remainingQuestions - 1);
              console.log(`⏳ Bonus remaining for playerId=${pid}:`, efekti.bonus_remainingQuestions);
              if (efekti.bonus_remainingQuestions <= 0) {
                efekti.bonus = 0;
                delete efekti.bonus_remainingQuestions;
              }
            }
            // Ajan puolitus: laske remainingQuestions
            if (typeof efekti.ajan_puolitus_remainingQuestions === 'number') {
              efekti.ajan_puolitus_remainingQuestions = Math.max(0, efekti.ajan_puolitus_remainingQuestions - 1);
              console.log(`⏳ Ajan puolitus remaining for playerId=${pid}:`, efekti.ajan_puolitus_remainingQuestions);
              if (efekti.ajan_puolitus_remainingQuestions <= 0) {
                delete efekti.ajan_puolitus_remainingQuestions;
              }
            }

            // Jos efektissä ei ole enää mitään, poista objekti
            const hasAny = Object.keys(efekti).some(k => {
              return (k !== 'tuplapisteet_remainingQuestions' && k !== 'bonus_remainingQuestions') && !!efekti[k];
            });
            if (!hasAny) {
              delete activeCardEffects[pid];
              console.log(`🗑️ Poistettu kaikki efektit pelaajalta ${pid}`);
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Virhe efektien päättelyssä seuraavaKysymys:', e);
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
            // Emit peliLoppui for this player so listeners (App) can refresh leaderboard
            try {
              const payload = { kayttajaId, pisteet, peliId };
              console.log('\ud83d\udd14 PeliIkkuna emitting peliLoppui (from naytaTulokset):', payload);
              (peliPalvelu as any).emit && (peliPalvelu as any).emit('peliLoppui', payload);
            } catch (e) {
              console.warn('Emit peliLoppui failed:', e);
            }
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

  <!-- Global notification modal: centered vertically (much lower) so it covers main question area.
       z-48 keeps it below the target-picker overlay (z-50) but above in-game elements. Placed at top-level
       to avoid stacking-context issues from inner cards (e.g. "Pelijärjestys"). -->
  {#if modalVisible}
    <!-- Bottom-anchored modal: fixed to bottom of viewport, full-width container, modal card sits above bottom edge -->
    <div style="position:fixed; left:0; right:0; bottom:0; z-index:48; display:flex; align-items:flex-end; justify-content:center; pointer-events:none;">
      <!-- Optional semi-transparent clickable backdrop behind card to dismiss (covers entire width but not full height) -->
      <button type="button" aria-label="Sulje ilmoitus" on:click={hideModal} style="position:absolute; left:0; right:0; bottom:0; top:0; background:rgba(0,0,0,0.0); border:0; padding:0; margin:0; pointer-events:auto;"></button>

      <div style="position:relative; pointer-events:auto; width:100%; max-width:960px; margin:0 24px 24px 24px;">
        <div class="rounded-t-lg p-4 bg-black/95 text-white shadow-2xl text-center">
          {modalMessage}
        </div>
      </div>
    </div>
  {/if}

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
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('kysymyksen_vaihto'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('kysymyksen_vaihto'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('kysymyksen_vaihto'))}
          on:click={async () => { if (!canUseKortti()) return;
            try {
              const kortti = (erikoiskortit as any).find((k: any) => k.key === 'kysymyksen_vaihto');
              if (!kortti) return showModal('Korttia ei loydy');
              const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
              if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
              const db = await getDB();
              const kustannus = Number(kortti.kustannus || 0);
              const nimi = nykyinenPelaaja.nimi;
              const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
              if (isNaN(kustannus)) { showModal('Kortin kustannus ei ole kelvollinen'); return; }
              if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');
              // Vähennä pisteitä ja tallenna käyttö
              pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
              const peliId = typeof nykyinenPelaaja.id !== 'undefined' ? (pelaajaPelit.get(nykyinenPelaaja.id) || null) : null;
              await db.tallennaKortinKaytto({
                peli_id: peliId,
                kayttaja_id: nykyinenPelaaja.id,
                kortti_key: kortti.key,
                kustannus: kustannus,
                parametrit: kortti.parametrit || {}
              });
              showModal('Kysymyksen vaihto aktivoitu');
              // Remove the current question from the "asked" set so it can be reused later
              try {
                if (nykyinenKysymys && typeof nykyinenKysymys.id !== 'undefined') {
                  const removed = kysytytKysymykset.delete(nykyinenKysymys.id);
                  console.log('🔁 Kysymyksen vaihto: poistettu nykyinen kysymys kysytytKysymykset - removed=', removed, 'id=', nykyinenKysymys.id);
                }
              } catch (e) {
                console.warn('⚠️ Virhe poistaessa nykyistä kysymystä kysytytKysymykset-setistä:', e);
              }

              // Start a fresh question for the same player without scoring the previous one
              // Stop any running timer to avoid race conditions; aloitaUusiKysymys will restart it
              if (ajastin) {
                clearInterval(ajastin);
                ajastin = null;
              }
              await aloitaUusiKysymys();
            } catch (err) {
              console.error('Kortin kaytto epäonnistui:', err);
              showModal('Kortin käyttö epäonnistui');
            }
          }}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🎭</span>
            <span class="text-blue-400 font-medium">Kysymyksen vaihto - 10</span>
          </div>
        </button>
        
        <!-- Bonus (moved to defense) -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="⭐ Bonus – jos vastaat oikein, saat heti toisen kysymyksen."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('bonus'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('bonus'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('bonus'))}
          on:click={async () => { if (!canUseKortti()) return;
            try {
              const kortti = (erikoiskortit as any).find((k: any) => k.key === 'bonus');
              if (!kortti) return showModal('Korttia ei loydy');
              const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
              if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
              const db = await getDB();
              const kustannus = Number(kortti.kustannus || 0);
              const nimi = nykyinenPelaaja.nimi;
              const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
              if (isNaN(kustannus)) { showModal('Kortin kustannus ei ole kelvollinen'); return; }
              if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');
              // Vähennä pisteitä ja tallenna käyttö
              pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
              await db.tallennaKortinKaytto({
             peli_id: typeof nykyinenPelaaja.id !== 'undefined' ? (pelaajaPelit.get(nykyinenPelaaja.id) || null) : null,
                kayttaja_id: nykyinenPelaaja.id,
                kortti_key: kortti.key,
                kustannus: kustannus,
                parametrit: kortti.parametrit || {}
              });
              // Apply 'bonus' effect: mark activeCardEffects so next correct doesn't pass turn
              const bid = Number(nykyinenPelaaja.id);
              activeCardEffects[bid] = activeCardEffects[bid] || {};
              activeCardEffects[bid].bonus = (activeCardEffects[bid].bonus || 0) + (kortti.parametrit?.lisaVuoro || 1);
              // set lifetime so effect doesn't persist across multiple player's turns
              activeCardEffects[bid].bonus_remainingQuestions = Number(kortti.parametrit?.kestoKysymyksina || 1);
              showModal('Bonus aktivoitu — saat lisävuoron seuraavasta oikeasta vastauksesta');
            } catch (err) {
              console.error('Kortin kaytto epäonnistui:', err);
              showModal('Kortin käyttö epäonnistui');
            }
          }}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">⭐</span>
            <span class="text-orange-400 font-medium">Bonus - 10</span>
          </div>
        </button>
        
        <!-- Tuplapisteet (nappi toimii alempana) -->
        <!-- Tuplapisteet functionality -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🎯 Tuplapisteet – seuraava oikea vastaus antaa 2× pisteet."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('tuplapisteet'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('tuplapisteet'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('tuplapisteet'))}
          on:click={async () => { if (!canUseKortti()) return;
            try {
              const kortti = (erikoiskortit as any).find((k: any) => k.key === 'tuplapisteet');
              if (!kortti) return alert('Korttia ei loydy');
              const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
              if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return alert('Pelaaja ei tunnistettu');
              const db = await getDB();
              const kustannus = Number(kortti.kustannus || 0);
              const nimi = nykyinenPelaaja.nimi;
              const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
              if (isNaN(kustannus)) {
                showModal('Kortin kustannus ei ole kelvollinen');
                return;
              }
              if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');

              // Vähennä pisteitä paikallisesta tilasta ja tallenna käyttö
              pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
              await db.tallennaKortinKaytto({
             peli_id: typeof nykyinenPelaaja.id !== 'undefined' ? (pelaajaPelit.get(nykyinenPelaaja.id) || null) : null,
                kayttaja_id: nykyinenPelaaja.id,
                kortti_key: kortti.key,
                kustannus: kustannus,
                parametrit: kortti.parametrit || {}
              });

              // Aktivoi efekteja pelaajalle (seuraava oikea vastaus tuplaa)
              const pid = typeof nykyinenPelaaja.id !== 'undefined' ? Number(nykyinenPelaaja.id) : null;
              if (pid === null) {
                console.warn('Tuplapisteet: pelaaja id puuttuu, efektiä ei aktivoitu');
              } else {
                  activeCardEffects[pid] = activeCardEffects[pid] || {};
                  // Track uses and remaining question-lifetime so effect won't persist to next round
                  activeCardEffects[pid].tuplapisteet = (activeCardEffects[pid].tuplapisteet || 0) + 1;
                  activeCardEffects[pid].tuplapisteet_remainingQuestions = Number(kortti.parametrit?.kestoKysymyksina || 1);
                  console.log(`🔁 Tuplapisteet aktivoitu for playerId=${pid}. uses=${activeCardEffects[pid].tuplapisteet}, remainingQuestions=${activeCardEffects[pid].tuplapisteet_remainingQuestions}`);
                  showModal('Tuplapisteet aktivoitu — seuraava oikea vastaus antaa kaksinkertaiset pisteet.');
              }
            } catch (err) {
              console.error('Kortin kaytto epäonnistui:', err);
              showModal('Kortin käyttö epäonnistui');
            }
          }}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🎯</span>
            <span class="text-teal-400 font-medium">Tuplapisteet - 5</span>
          </div>
        </button>
        
        <!-- Puolitus (50/50) -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🪄 Puolitus – poistaa kaksi väärää vastausta (50/50)."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('puolitus'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('puolitus'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('puolitus'))}
          on:click={async () => { if (!canUseKortti()) return;
            try {
              const kortti = (erikoiskortit as any).find((k: any) => k.key === 'puolitus');
              if (!kortti) return showModal('Korttia ei loydy');
              const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
              if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
              const db = await getDB();
              const kustannus = Number(kortti.kustannus || 0);
              const nimi = nykyinenPelaaja.nimi;
              const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
              if (isNaN(kustannus)) { showModal('Kortin kustannus ei ole kelvollinen'); return; }
              if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');
              // Deduct & persist
              pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
              await db.tallennaKortinKaytto({
             peli_id: typeof nykyinenPelaaja.id !== 'undefined' ? (pelaajaPelit.get(nykyinenPelaaja.id) || null) : null,
                kayttaja_id: nykyinenPelaaja.id,
                kortti_key: kortti.key,
                kustannus: kustannus,
                parametrit: kortti.parametrit || {}
              });
              // Remove up to 2 wrong answers from current options
              if (nykyinenKysymys) {
                const oikea = nykyinenKysymys.oikea_vastaus;
                const wrongs = vastausVaihtoehdot.filter(v => v !== oikea && v !== undefined);
                // randomly remove up to 'poistettavat' (default 2)
                const poistettavat = Number(kortti.parametrit?.poistettavat || 2);
                let removed = 0;
                let opts = [...vastausVaihtoehdot];
                while (removed < poistettavat && wrongs.length > 0 && opts.length > 1) {
                  const idx = Math.floor(Math.random() * wrongs.length);
                  const val = wrongs.splice(idx,1)[0];
                  const removeIndex = opts.indexOf(val);
                  if (removeIndex >= 0) { opts.splice(removeIndex,1); removed++; }
                }
                vastausVaihtoehdot = opts;
                showModal(`Puolitus aktivoitu – poistettiin ${removed} vaihtoehtoa`);
              } else {
                showModal('Puolitus aktivoitu');
              }
            } catch (err) {
              console.error('Kortin kaytto epäonnistui:', err);
              showModal('Kortin käyttö epäonnistui');
            }
          }}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🪄</span>
            <span class="text-indigo-400 font-medium">Puolitus - 10</span>
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
              🎯 Kysymys-sota
            </h1>

            <div class="text-right">
              <div class="text-sm {GLASS_COLORS.textSecondary}">Kysymys</div>
              <div class="text-xl font-bold">{kysymysNumero}/{maxKysymykset}</div>
            </div>
              <!-- modal handled globally above -->
              <!-- target picker UI moved to app-level TargetPickerOverlay component -->
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
      <!-- Nykyinen pelaaja / ajastin (keskitetty) -->
      <div class="flex justify-center items-center space-x-4">
        <!-- All players compact badges next to clock -->
        <div class="flex items-center space-x-2 px-2 py-1 rounded-md">
          {#each sekoitetutPelaajat as pelaaja, idx}
            {@const color = haePelaajanVari(pelaaja)}
            <div class="flex items-center space-x-2 px-2 py-1 rounded-md transition-all duration-200"
              style="background: linear-gradient(135deg, {color}22, {color}08); border: 2px solid {idx === pelaajaIndex ? color + 'aa' : 'transparent'}; box-shadow: {idx === pelaajaIndex ? '0 4px 14px ' + color + '55' : 'none'};">
              <div class="w-7 h-7 rounded-sm flex items-center justify-center font-bold text-white text-sm" style="background: linear-gradient(135deg, {color}, {color}cc);">{pelaaja.nimi.charAt(0).toUpperCase()}</div>
              <div class="text-xs font-semibold" style="color: {color}">{pelaaja.nimi}</div>
              <div class="text-xs {GLASS_COLORS.textSecondary} ml-1">{pelaajanPisteet[pelaaja.nimi] || 0} 💎</div>
            </div>
          {/each}
        </div>
        <div class="text-center">
          <button
            class="{GLASS_STYLES.card} flex items-center justify-center w-14 h-14 rounded-md text-lg font-bold text-white transition-all duration-200 hover:scale-105 cursor-pointer relative clock-button"
            class:pulse-fast={aika <= 10}
            class:pulse-slow={aika <= 20 && aika > 10}
            style="background: linear-gradient(135deg, {kellon_vari}25, {kellon_vari}12); border: 1px solid {kellon_vari}33; box-shadow: {clockBoxShadow}; backdrop-filter: blur(6px); --clock-glow: {kellon_vari}55; --clock-glow-mid: {kellon_vari}44; --clock-glow-soft: {kellon_vari}22;"
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
              <div class="absolute inset-0 flex items-center justify-center text-base">
                ▶️
              </div>
            {:else}
              {formatoiAika(aika)}
            {/if}
          </button>
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
              Pisteitä: {pelaajanPisteet[
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
              Pisteet: {pelaajanPisteet[
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
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('pakota_vaihto'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('pakota_vaihto'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('pakota_vaihto'))}
          on:click={() => openTargetSelection('pakota_vaihto')}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">📦</span>
            <span class="text-primary-400 font-medium">Pakota vaihto - 5</span>
          </div>
        </button>
        <!-- Ajan puolitus (new attack card) -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="⏱️ Ajan puolitus – valitun pelaajan seuraava kysymys on vain 15s."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('ajan_puolitus'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('ajan_puolitus'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('ajan_puolitus'))}
          on:click={() => openTargetSelection('ajan_puolitus')}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">⏱️</span>
            <span class="text-red-400 font-medium">Ajan puolitus - 5</span>
          </div>
        </button>

        <!-- Nollaus -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🌀 Nollaus – valitse pelaaja, jonka edellinen pistelisäys mitätöidään."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('nollaus'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('nollaus'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('nollaus'))}
          on:click={() => openTargetSelection('nollaus')}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🌀</span>
            <span class="text-purple-400 font-medium">Nollaus - 10</span>
          </div>
        </button>
        
        <!-- Sekoitus -->
        <button 
          class="{GLASS_STYLES.card} p-4 w-full transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] shadow-inner scale-95"
          title="🌪️ Sekoitus – kaikkien pelaajien seuraavat kysymykset sekoitetaan satunnaisesti."
          aria-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('sekoitus'))}
          class:opacity-60={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('sekoitus'))}
          class:card-disabled={!pelaajallaOnRiittavasti(nykyinenPelaajaId(), kortinKustannus('sekoitus'))}
          on:click={async () => { if (!canUseKortti()) return;
            try {
              const kortti = (erikoiskortit as any).find((k: any) => k.key === 'sekoitus');
              if (!kortti) return showModal('Korttia ei loydy');
              const nykyinenPelaaja = sekoitetutPelaajat[pelaajaIndex];
              if (!nykyinenPelaaja || typeof nykyinenPelaaja.id === 'undefined') return showModal('Pelaaja ei tunnistettu');
              const db = await getDB();
              const kustannus = Number(kortti.kustannus || 0);
              const nimi = nykyinenPelaaja.nimi;
              const nykyisetPisteet = pelaajanPisteet[nimi] || 0;
              if (isNaN(kustannus)) { showModal('Kortin kustannus ei ole kelvollinen'); return; }
              if (nykyisetPisteet < kustannus) return showModal('Ei tarpeeksi pisteitä');
              // Vähennä pisteitä ja tallenna käyttö
              pelaajanPisteet[nimi] = nykyisetPisteet - kustannus;
              await db.tallennaKortinKaytto({
                peli_id: pelaajaPelit.get(nykyinenPelaaja.id) || null,
                kayttaja_id: nykyinenPelaaja.id,
                kortti_key: kortti.key,
                kustannus: kustannus,
                parametrit: kortti.parametrit || {}
              });
              // Mark an effect that will make next question(s) for all players random.
              const vaikutusKysymyksina = Number(kortti.parametrit?.vaikutusKysymyksina || 1);
              // Apply per-player effect so expiration logic can clean it up later
              sekoitetutPelaajat.forEach(p => {
                if (typeof p.id === 'undefined') return;
                const pid = Number(p.id);
                activeCardEffects[pid] = activeCardEffects[pid] || {};
                activeCardEffects[pid].sekoitus = (activeCardEffects[pid].sekoitus || 0) + 1;
                activeCardEffects[pid].sekoitus_remainingQuestions = Math.max(
                  activeCardEffects[pid].sekoitus_remainingQuestions || 0,
                  vaikutusKysymyksina
                );
              });
              console.log(`300 Sekoitus aktivoitu for all players: vaikutusKysymyksina=${vaikutusKysymyksina}`);
              showModal('Sekoitus aktivoitu');
            } catch (err) {
              console.error('Kortin kaytto epäonnistui:', err);
              showModal('Kortin käyttö epäonnistui');
            }
          }}
        >
          <div class="flex flex-col items-center">
            <span class="text-3xl mb-2">🌪️</span>
            <span class="text-emerald-400 font-medium">Sekoitus - 5</span>
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

  /* Clock pulse animations */
  @keyframes pulse-slow {
    0% {
      transform: scale(1);
      box-shadow: 0 6px 14px rgba(0,0,0,0.06), 0 0 0 0 var(--clock-glow-soft, rgba(0,0,0,0));
    }
    50% {
      transform: scale(1.06);
      box-shadow: 0 14px 36px rgba(0,0,0,0.12), 0 0 24px 4px var(--clock-glow-mid, rgba(0,0,0,0));
    }
    100% {
      transform: scale(1);
      box-shadow: 0 6px 14px rgba(0,0,0,0.06), 0 0 0 0 var(--clock-glow-soft, rgba(0,0,0,0));
    }
  }

  @keyframes pulse-fast {
    0% {
      transform: scale(1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.08), 0 0 0 0 var(--clock-glow-soft, rgba(0,0,0,0));
    }
    50% {
      transform: scale(1.12);
      box-shadow: 0 20px 48px rgba(0,0,0,0.18), 0 0 40px 8px var(--clock-glow, rgba(0,0,0,0));
    }
    100% {
      transform: scale(1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.08), 0 0 0 0 var(--clock-glow-soft, rgba(0,0,0,0));
    }
  }

  /* Helper class for clock to ensure smooth animation and better performance */
  .clock-button {
    will-change: transform, box-shadow;
    transform-origin: center center;
  }

  /* Class-based animations so Svelte's scoped CSS keyframes are correctly applied
     when toggling based on reactive state. These classes repeat infinitely. */
  .pulse-slow {
    animation: pulse-slow 1.6s infinite ease-in-out;
  }

  .pulse-fast {
    animation: pulse-fast 0.8s infinite ease-in-out;
  }

  /* Disabled/insufficient-pisteet look for cards */
  .card-disabled {
    background: rgba(0,0,0,0.45) !important;
    color: #ddd !important;
    border-color: rgba(255,255,255,0.06) !important;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
    pointer-events: none;
  }
</style>
