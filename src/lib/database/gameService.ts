// GAME SERVICE — PELILOGIIKKA (LYHYESTI)
// Tämä moduuli on pelin authoritative-palvelu sovelluksen sisällä.
// - Kaikki pistelaskut ja tilamuutokset tehdään täällä (esim. vastaaKysymykseen).
// - UI saa takaisin päivitetyt pisteet ja pistemäärän erittelyn (perus, nopeus, ikäkerroin, streak).
// - Tallenna / emit -toiminnot tehdään DB-helperin kautta, jotta historia ja UI pysyvät synkronoituna.
// Muuta: Älä duplikoi pisteiden logiikkaa UI:ssa — UI saa palvelulta valmiit arvot.

// Kysymysmestari Game Service
// Pelitoimintojen hallinta ja logiikka

import { getDB } from "./database.js";
import type { Kysymys, Kayttaja } from "./schema.js";

// ===============================================
// RAJAPINNAT (Interfaces)
// ===============================================

/**
 * PeliTilanne - Aktiivisen pelin tilan seuranta
 */
export interface PeliTilanne {
  peliId: number; // Pelin tunniste
  kayttaja: Kayttaja; // Pelaajan tiedot
  nykyinenKysymys?: Kysymys; // Tällä hetkellä aktiivinen kysymys
  vastausvaihtoehdot?: string[]; // Sekoitetut vastausvaihtoehdot
  pisteet: number; // Pelissä tähän mennessä kerätyt pisteet
  kysymysNro: number; // Nykyisen kysymyksen numero (1, 2, 3...)
  kokonaisKysymyksia: number; // Kokonaismäärä kysymyksiä pelissä
  aloitusaika: number; // Pelin aloitusaika (timestamp)
  kysymysAloitettu?: number; // Nykyisen kysymyksen aloitusaika (timestamp)
}

/**
 * PeliTulos - Pelin lopputuloksen tiedot
 */
export interface PeliTulos {
  pisteet: number; // Kokonaispisteet
  kokonaisKysymyksia: number; // Pelattujen kysymysten määrä
  oikeitaVastauksia: number; // Oikeiden vastausten määrä
  keskimaarainenVastausaika: number; // Keskimääräinen vastausaika
  kategoria?: string; // Pelin kategoria (jos rajattu)
}

// ===============================================
// PELIHALLINTA-LUOKKA (Game Service Class)
// ===============================================

export class PeliPalvelu {
  // Aktiivisten pelien tallennuspaikka (Map: peliId -> PeliTilanne)
  private aktiivisetPelit: Map<number, PeliTilanne> = new Map();
  // Track consecutive correct answers per peliId (for streak bonuses)
  // Keep optional in-memory cache as fallback (not required)
  // Streaks are persisted in DB via 'streaks' store
  private streaks: Map<number, number> = new Map();
  // Tietokanta-instanssi (alustetaan tarpeen mukaan)
  private db: any = null;
  // Yksinkertainen event-käsittelijä leaderboardin päivitystä varten
  private listeners: { [event: string]: Array<(...args: any[]) => void> } = {};

  // ===============================================
  // YKSITYISET APUFUNKTIOT (Private Helpers)
  // ===============================================

  /**
   * Varmista että tietokanta on alustettu
   * @returns Tietokanta-instanssi
   */
  private async varmistaTietokanta() {
    if (!this.db) {
      this.db = await getDB();
    }
    return this.db;
  }

  // ===============================================
  // JULKISET METODIT (Public Methods)
  // ===============================================

  /**
   * Aloita uusi peli pelaajalle
   * @param kayttajaNimi - Pelaajan nimi
   * @param kysymystenMaara - Kysymysten määrä pelissä (oletus: 10)
   * @param kategoria - Rajoita tiettyyn kategoriaan (valinnainen)
   * @param vaikeustaso - Rajoita tiettyyn vaikeusteoon (valinnainen)
   * @returns Uuden pelin tilanne
   */
  public async aloitaPeli(
    kayttajaNimi: string,
    kysymystenMaara: number = 10,
    kategoria?: string,
    vaikeustaso?: string,
    kayttajanIka?: number,
    vaikeustasoMin?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
    vaikeustasoMax?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
  ): Promise<PeliTilanne> {
    const db = await this.varmistaTietokanta();

    // Hae tai luo käyttäjä (nyt laajemmilla tiedoilla)
    let kayttaja = await db.haeKayttajaNimella(kayttajaNimi);
    if (!kayttaja) {
      const kayttajaId = await db.lisaaKayttaja(
        kayttajaNimi,
        kayttajanIka,
        vaikeustasoMin,
        vaikeustasoMax,
      );
      kayttaja = await db.haeKayttaja(kayttajaId);
    }

    if (!kayttaja) {
      throw new Error("Käyttäjän luominen epäonnistui");
    }

    // Luo uusi peli tietokantaan
    const peliId = await db.aloitaPeli(kayttaja.id);

    // Luo pelitilanne
    const peliTilanne: PeliTilanne = {
      peliId,
      kayttaja,
      pisteet: 0,
      kysymysNro: 0,
      kokonaisKysymyksia: kysymystenMaara,
      aloitusaika: Date.now(),
    };

    // Tallenna aktiivisiin peleihin
    this.aktiivisetPelit.set(peliId, peliTilanne);

    // Hae ensimmäinen kysymys
    await this.haeSeuraavaKysymys(peliId, kategoria, vaikeustaso);

    return peliTilanne;
  }

  /**
   * Hae seuraava kysymys peliin
   * @param peliId - Pelin tunniste
   * @param kategoria - Kysymyksen kategoria (valinnainen)
   * @param vaikeustaso - Kysymyksen vaikeustaso (valinnainen)
   * @returns Päivitetty pelitilanne tai null jos peli on päättynyt
   */
  public async haeSeuraavaKysymys(
    peliId: number,
    kategoria?: string,
    vaikeustaso?: string,
  ): Promise<PeliTilanne | null> {
    const db = await this.varmistaTietokanta();
    const peli = this.aktiivisetPelit.get(peliId);
    if (!peli) return null;

    // Tarkista onko peli päättynyt
    if (peli.kysymysNro >= peli.kokonaisKysymyksia) {
      return await this.lopetaPeli(peliId);
    }

    // Hae satunnainen kysymys
    const kysymys = await db.haeSatunnainenKysymys(kategoria, vaikeustaso);
    if (!kysymys) return null;

    // Luo vastausvaihtoehdot
    const vaaratVastaukset = JSON.parse(kysymys.vaarat_vastaukset);
    const vastausvaihtoehdot = [
      kysymys.oikea_vastaus,
      ...vaaratVastaukset,
    ].sort(() => Math.random() - 0.5); // Sekoita järjestys

    // Päivitä pelitilanne
    peli.nykyinenKysymys = kysymys;
    peli.vastausvaihtoehdot = vastausvaihtoehdot;
    peli.kysymysNro += 1;
    peli.kysymysAloitettu = Date.now();

    return peli;
  }

  /**
   * Käsittele pelaajan vastaus kysymykseen
   * @param peliId - Pelin tunniste
   * @param vastaus - Pelaajan antama vastaus
   * @returns Vastauksen tulos (oikein/väärin, pisteet, oikea vastaus)
   */
  public async vastaaKysymykseen(
    peliId: number | null,
    vastaus: string,
  ): Promise<{
    oikein: boolean;
    oikeaVastaus: string;
    pisteet: number;
    perusPisteet?: number;
    speedBonus?: number;
    quickBonus?: number;
    ageKerroin?: number;
    streakAfter?: number;
    streakBonus?: number;
  } | null> {
    const db = await this.varmistaTietokanta();
    if (peliId === null) {
      // No peliId: cannot compute streaks or use activePelit; attempt to find question by other means
      console.warn('vastaaKysymykseen called without peliId; falling back to minimal persistence');
      // Attempt to save minimal answer record if possible (DB helper may accept nulls)
      // We don't have the question context here, so return minimal result
      try {
        // DB cannot be updated without question context; return no-points response
      } catch (e) {}
      return {
        oikein: false,
        oikeaVastaus: '',
        pisteet: 0
      };
    }

    const peli = this.aktiivisetPelit.get(peliId as number);
    if (!peli || !peli.nykyinenKysymys || !peli.kysymysAloitettu) return null;

    const kysymys = peli.nykyinenKysymys;
    const oikein =
      vastaus.toLowerCase().trim() ===
      kysymys.oikea_vastaus.toLowerCase().trim();
    const vastausaika = Date.now() - peli.kysymysAloitettu;

  // Laske pisteet (nopeampi vastaus = enemmän pisteitä)
  // Käytetään kysymyksen peruspisteitä ja lisätään nopeusbonus
  let pisteet = 0;
    let streakAfter = 0;
    let streakBonus = 0;
    // breakdown vars
  let perusPisteet: number = 0;
  let nopeusBonus: number = 0;
  let ikaKerroin: number = 1.0;
    if (oikein) {
      // Käytä kysymyksen omaa pistemaara_perus-arvoa
      perusPisteet =
        kysymys.pistemaara_perus ||
        (kysymys.vaikeustaso === "oppipoika"
          ? 10
          : kysymys.vaikeustaso === "taitaja"
            ? 20
            : kysymys.vaikeustaso === "mestari"
              ? 30
              : kysymys.vaikeustaso === "kuningas"
                ? 40
                : 50); // suurmestari

      // Bonuspisteet nopeudesta (max 10 sekuntia)
      // Laske nopeusbonus: 0..10 pistettä riippuen vastausajasta (0s => 10, 10s => 0)
      try {
        const secondsTaken = Math.max(0, Math.floor((vastausaika || 0) / 1000));
        nopeusBonus = Math.max(0, Math.round(10 - Math.min(10, secondsTaken)));
      } catch (e) {
        nopeusBonus = 0;
      }

      // Pisteet: peruspisteet + nopeusbonus (quick-bonus poistettu)
      pisteet = perusPisteet + nopeusBonus;

      // Ikäkerroin: sovelletaan AINOASTAAN silloin kun kysymys on 'suurmestari' tasoa.
      // Käytämme eksplisiittistä tarkistusta kysymyksen vaikeustasosta, jotta ikäkerroin
      // ei vaikuta tavallisiin perus- tai keskitasoihin.
      if (typeof peli.kayttaja.ika === 'number' && kysymys.vaikeustaso === 'suurmestari') {
        ikaKerroin = peli.kayttaja.ika < 12 ? 1.2 : peli.kayttaja.ika > 50 ? 0.8 : 1.0;
        pisteet = Math.round(pisteet * ikaKerroin);
      }

      peli.pisteet += pisteet;

      // Update streaks (persisted in DB)
      try {
        const prev = (await db.haeStreakByPeliId(peliId)) || 0;
        const next = prev + 1;
        streakAfter = next;
        if (next >= 3) {
          // award combo and reset
          streakBonus = 50;
          pisteet += streakBonus;
          await db.paivitaStreak(peliId, 0);
          this.streaks.set(peliId, 0);
        } else {
          await db.paivitaStreak(peliId, next);
          this.streaks.set(peliId, next);
        }
      } catch (e) {
        console.warn('streak update failed (db):', e);
        // Fallback to in-memory
        const prev = this.streaks.get(peliId) || 0;
        const next = prev + 1;
        streakAfter = next;
        if (next >= 3) {
          streakBonus = 50;
          pisteet += streakBonus;
          this.streaks.set(peliId, 0);
        } else {
          this.streaks.set(peliId, next);
        }
      }
    }
    else {
      // reset streak on wrong answer (persist)
      try {
        await db.paivitaStreak(peliId, 0);
        this.streaks.set(peliId, 0);
      } catch (e) {
        console.warn('streak reset failed (db):', e);
        try { this.streaks.set(peliId, 0); } catch(e) {}
      }
    }
    // Tallenna vastaus tietokantaan
    await db.tallennaPeliVastaus(
      peliId,
      kysymys.id,
      vastaus,
      oikein,
      vastausaika,
      kysymys.kategoria
    );
      console.log('📝 Vastaus tallennettu (server):', {
      peliId,
      kysymysId: kysymys.id,
      annettuVastaus: vastaus,
      oikein,
      vastausaikaMs: vastausaika,
      kategoria: kysymys.kategoria,
      pisteet,
        // quickAnswerBonus removed
      streakAfter,
      streakBonus
    });

    // Save pelitapahtuma with enriched payload
      try {
      await db.tallennaPelitapahtumaJaEmit({
        peli_id: peliId,
        kayttaja_id: peli.kayttaja?.id ?? null,
        tyyppi: 'vastaus',
        payload: {
          kysymys_id: kysymys.id,
          oikein,
          annettu_vastaus: vastaus || '',
          vastausaika_ms: vastausaika,
          pisteet,
          // quick_bonus removed
          streak_after: streakAfter,
          streak_bonus: streakBonus
        },
        paivays: new Date().toISOString(),
      });
      
    } catch (e) {
      console.warn('Ei voitu tallennaPelitapahtuma (vastaus - server):', e);
    }

    return {
      oikein,
      oikeaVastaus: kysymys.oikea_vastaus,
      pisteet,
      perusPisteet: perusPisteet,
      speedBonus: nopeusBonus,
      // quickBonus removed from response
      ageKerroin: ikaKerroin,
      streakAfter,
      streakBonus
    };
  }

  /**
   * Lopeta peli ja tallenna tulokset
   * @param peliId - Pelin tunniste
   * @returns Lopullinen pelitilanne tai null
   */
  public async lopetaPeli(peliId: number): Promise<PeliTilanne | null> {
    const db = await this.varmistaTietokanta();
    const peli = this.aktiivisetPelit.get(peliId);
    if (!peli) return null;

    // Päivitä tietokanta
    await db.lopetaPeli(peliId, peli.pisteet, peli.kysymysNro);

    // Päivitä pelaajan kokonaispistemäärä
    await db.paivitaKayttajanPisteet(peli.kayttaja.id!, peli.pisteet);

    // Tallenna tilastot
    try {
      // Hae kaikki pelaajan vastaukset tästä pelistä
      const peliVastaukset = await db.haePeliVastauksetByPeliId(peliId);
  const oikeita = peliVastaukset.filter((v: any) => v.oikein).length;
  const vaaria = peliVastaukset.filter((v: any) => !v.oikein).length;
      const yhteensa = peliVastaukset.length;
      const vastausprosentti = yhteensa > 0 ? (oikeita / yhteensa) * 100 : 0;
      const kategoriat: Record<string, { oikeita: number, vaaria: number }> = {};
      for (const v of peliVastaukset) {
        const kategoria = v.kategoria || 'Tuntematon';
        if (!kategoriat[kategoria]) kategoriat[kategoria] = { oikeita: 0, vaaria: 0 };
        if (v.oikein) kategoriat[kategoria].oikeita++;
        else kategoriat[kategoria].vaaria++;
      }
      console.log('📊 Pelin tilastot kerätty ja tallennetaan:', {
        pisteet: peli.pisteet,
        oikeita,
        vaaria,
        yhteensa,
        vastausprosentti,
        kategoriat
      });
      await db.tallennaTilasto({
        kayttaja_id: peli.kayttaja.id!,
        pelatut_pelit: 1,
        kokonais_pisteet: peli.pisteet,
        oikeita_vastauksia: oikeita,
        vaaria_vastauksia: vaaria,
        vastausprosentti,
        kategoriatilastot: kategoriat,
        paivays: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Tilastojen tallennus epäonnistui:', error);
    }

    // Poista aktiivisista peleistä
    this.aktiivisetPelit.delete(peliId);

    // Poista tallennettu streak-tieto pelille
    try {
      await db.poistaStreak(peliId);
    } catch (e) {
      console.warn('streak deletion failed (db):', e);
    }

    // Emit event that game ended and leaderboard may need refresh
    try {
      const kayttajaId = peli.kayttaja.id;
      const totalPoints = peli.pisteet;
      console.log('🔔 Emitting peliLoppui event for kayttajaId:', kayttajaId, 'points:', totalPoints, 'peliId:', peliId);
      (this.listeners['peliLoppui'] || []).forEach(fn => {
        try { fn({ kayttajaId, totalPoints, peliId }); } catch (e) { console.warn('Listener error', e); }
      });
    } catch (e) {
      console.warn('Error emitting peliLoppui event:', e);
    }

    return peli;
  }

  // ===============================================
  // TIEDONHAKU JA TILASTOT (Data Queries & Stats)
  // ===============================================

  /**
   * Hae aktiivisen pelin tila
   * @param peliId - Pelin tunniste
   * @returns Pelitilanne tai null
   */
  public haePeliTilanne(peliId: number): PeliTilanne | null {
    return this.aktiivisetPelit.get(peliId) || null;
  }

  /**
   * Hae pelaajan tilastot nimellä
   * @param kayttajaNimi - Pelaajan nimi
   * @returns Tilastot tai null
   */
  public async haeKayttajanTilastot(kayttajaNimi: string) {
    const db = await this.varmistaTietokanta();
    const kayttaja = await db.haeKayttajaNimella(kayttajaNimi);
    if (!kayttaja) return null;

    return await db.haeKayttajanTilastot(kayttaja.id);
  }

  /**
   * Hae parhaat tulokset leaderboardia varten
   * @param raja - Montako tulosta haetaan (oletus: 10)
   * @returns Lista parhaista tuloksista
   */
  public async haeParhaatTulokset(raja: number = 10) {
    const db = await this.varmistaTietokanta();
    return await db.haeParhaatTulokset(raja);
  }

  /**
   * Hae kaikki saatavilla olevat kategoriat kysymysten määrineen
   * @returns Objekti jossa avain=kategoria, arvo=kysymysten määrä
   */
  public async haeKategoriatMaarineen(): Promise<{
    [kategoria: string]: number;
  }> {
    const db = await this.varmistaTietokanta();
    return await db.haeKategoriatMaarineen();
  }

  /**
   * Hae kaikki saatavilla olevat kategoriat
   * @returns Lista kategorioista
   */
  public async haeKategoriat(): Promise<string[]> {
    const db = await this.varmistaTietokanta();
    return await db.haeKategoriat();
  }

  /**
   * Hae kaikki käyttäjät/pelaajat
   * @returns Lista kaikista käyttäjistä
   */
  public async haeKaikkiKayttajat() {
    const db = await this.varmistaTietokanta();
    return await db.haeKaikkiKayttajat();
  }

  /**
   * Hae top-pelaajat kokonaispisteiden mukaan laskevasti
   * @param raja - Kuinka monta pelaajaa näytetään (oletus: 10)
   */
  public async haeTopPelaajat(raja: number = 10) {
    const db = await this.varmistaTietokanta();
    try {
      const pelaajat = await db.haeKaikkiKayttajat();
      if (!pelaajat || pelaajat.length === 0) return [];
      const sorted = pelaajat.sort((a: any, b: any) => (b.pisteet_yhteensa || 0) - (a.pisteet_yhteensa || 0));
      console.log('\ud83c\udfc6 haeTopPelaajat - pelaajia haettu:', pelaajat.length, 'top-1:', sorted[0] ? { nimi: sorted[0].nimi, pisteet_yhteensa: sorted[0].pisteet_yhteensa } : null);
      return sorted.slice(0, raja);
    } catch (error) {
      console.error('Virhe top-pelaajien haussa:', error);
      return [];
    }
  }

  /**
   * Rekisteröi event-kuuntelijan
   * @param event - tapahtuman nimi (esim. 'peliLoppui')
   * @param fn - callback
   */
  public on(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  /**
   * Poista event-kuuntelija
   */
  public off(event: string, fn: (...args: any[]) => void) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }

  /**
   * Julkinen emit-metodi, jotta muut komponentit voivat laukaista tapahtumia
   * @param event - tapahtuman nimi
   * @param payload - tapahtuman data
   */
  public emit(event: string, payload?: any) {
    try {
      console.log('\ud83d\udd14 peliPalvelu.emit called:', event, payload, 'listeners:', (this.listeners[event] || []).length);
      (this.listeners[event] || []).forEach(fn => {
        try { fn(payload); } catch (e) { console.warn('Listener error', e); }
      });
    } catch (e) {
      console.warn('Error emitting event', e);
    }
  }

  // ===============================================
  // TILASTOFUNKTIOT (Statistics Functions)
  // ===============================================

  /**
   * Hae pelaaja jolla on eniten pisteitä
   * @returns Pelaaja eniten pisteillä tai null jos ei pelaajia
   */
  public async haePelaajaEnitenPisteilla() {
    const db = await this.varmistaTietokanta();

    try {
      // Prefer using persistent user totals (kayttajat.pisteet_yhteensa) for overall leaderboard
      const pelaajat = await db.haeKaikkiKayttajat();
      if (!pelaajat || pelaajat.length === 0) return null;

      const sorted = pelaajat.sort((a: any, b: any) => (b.pisteet_yhteensa || 0) - (a.pisteet_yhteensa || 0));
      const top = sorted[0];
      if (top && (top.pisteet_yhteensa || 0) > 0) {
        return {
          pelaaja: top,
          pisteet: top.pisteet_yhteensa || 0,
        };
      }

      // Fallback: if no kayttajat totals, try tilastot summary
      const tilastot = await db.haeTilastot();
      if (tilastot && tilastot.length > 0) {
        const sortedTilastot = tilastot.sort((a: any, b: any) => (b.kokonais_pisteet || 0) - (a.kokonais_pisteet || 0));
        if (sortedTilastot.length > 0 && sortedTilastot[0].kokonais_pisteet > 0) {
          const pelaaja = await db.haeKayttajaById(sortedTilastot[0].kayttaja_id);
          return {
            pelaaja,
            pisteet: sortedTilastot[0].kokonais_pisteet,
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Virhe eniten pisteitä haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae peli jolla on eniten pisteitä, mutta suosii pelejä joissa oli vähemmän
   * kysymyksiä tie-breakerina. Käytännössä valitsee pelin jolla on korkein
   * pisteet; jos useita yhtä suuria pisteitä, palautetaan se jonka
   * kysymysten_maara on pienin.
   */
  public async haeEnitenPisteitaVahimmillaKysymyksilla() {
    const db = await this.varmistaTietokanta();
    try {
      const pelit = await db.haeKaikkiPelit();
      if (!pelit || pelit.length === 0) return null;
      const finished = pelit.filter((p: any) => p.lopetettu);
      if (finished.length === 0) return null;

      // Sort by points desc, then by kysymysten_maara asc
      finished.sort((a: any, b: any) => {
        const pa = a.pisteet || 0;
        const pb = b.pisteet || 0;
        if (pb !== pa) return pb - pa; // higher points first
        const ka = a.kysymysten_maara || Number.MAX_SAFE_INTEGER;
        const kb = b.kysymysten_maara || Number.MAX_SAFE_INTEGER;
        return ka - kb; // fewer questions first
      });

      const top = finished[0];
      const pelaaja = await db.haeKayttajaById(top.kayttaja_id);
      return {
        peli: top,
        pelaaja,
        pisteet: top.pisteet,
        kysymysten_maara: top.kysymysten_maara || null,
      };
    } catch (error) {
      console.error('Virhe haettaessa eniten pisteitä vähimmillä kysymyksillä:', error);
      return null;
    }
  }

  /**
   * Laske eniten kysytty aihe (kategoriat perustuen peli_vastaukset)
   */
  public async haeEnitenKysyttyaAihe() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;
      const counts: Record<string, number> = {};
      for (const v of vastaukset) {
        const k = v.kategoria || 'Tuntematon';
        counts[k] = (counts[k] || 0) + 1;
      }
      let topK = null;
      let topCount = 0;
      for (const [k, c] of Object.entries(counts)) {
        if (c > topCount) {
          topCount = c;
          topK = k;
        }
      }
      return { kategoria: topK, maara: topCount };
    } catch (error) {
      console.error('Virhe haettaessa eniten kysyttyä aihetta:', error);
      return null;
    }
  }

  /**
   * Pelaaja jolla on eniten peräkkäisiä oikeita vastauksia (putki)
   */
  public async haeSuurinPutkiOikeita() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;

      // Oletetaan että vastaukset eivät ole välttämättä järjestyksessä, joten järjestä: pelaaja_id, peli_id, id
      vastaukset.sort((a: any, b: any) => {
        const pa = a.kayttaja_id || a.pelaaja_id || 0;
        const pb = b.kayttaja_id || b.pelaaja_id || 0;
        if (pa !== pb) return pa - pb;
        const ppi = a.peli_id || a.peliId || 0;
        const ppj = b.peli_id || b.peliId || 0;
        if (ppi !== ppj) return ppi - ppj;
        return (a.id || 0) - (b.id || 0);
      });

      const maksimit: Record<number, number> = {};
      const nykyinen: Record<number, number> = {};

      for (const v of vastaukset) {
        const pid = v.kayttaja_id ?? v.pelaaja_id ?? v.kayttaja ?? null;
        if (!pid) continue;
        const onOikein = v.oikein ?? v.on_oikein ?? false;
        if (onOikein) {
          nykyinen[pid] = (nykyinen[pid] || 0) + 1;
          maksimit[pid] = Math.max(maksimit[pid] || 0, nykyinen[pid]);
        } else {
          nykyinen[pid] = 0;
        }
      }

      // Etsi paras pelaaja
      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(maksimit)) {
        const id = Number(k);
        if (v > topVal) {
          topVal = v;
          topId = id;
        }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, putki: topVal };
    } catch (error) {
      console.error('Virhe suurinta putkea haettaessa:', error);
      return null;
    }
  }

  /**
   * Pelaaja jolla on eniten peräkkäisiä vääriä vastauksia
   */
  public async haeSuurinPutkiVaaria() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;

      vastaukset.sort((a: any, b: any) => {
        const pa = a.kayttaja_id || a.pelaaja_id || 0;
        const pb = b.kayttaja_id || b.pelaaja_id || 0;
        if (pa !== pb) return pa - pb;
        const ppi = a.peli_id || a.peliId || 0;
        const ppj = b.peli_id || b.peliId || 0;
        if (ppi !== ppj) return ppi - ppj;
        return (a.id || 0) - (b.id || 0);
      });

      const maksimit: Record<number, number> = {};
      const nykyinen: Record<number, number> = {};

      for (const v of vastaukset) {
        const pid = v.kayttaja_id ?? v.pelaaja_id ?? v.kayttaja ?? null;
        if (!pid) continue;
        const onOikein = v.oikein ?? v.on_oikein ?? false;
        if (!onOikein) {
          nykyinen[pid] = (nykyinen[pid] || 0) + 1;
          maksimit[pid] = Math.max(maksimit[pid] || 0, nykyinen[pid]);
        } else {
          nykyinen[pid] = 0;
        }
      }

      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(maksimit)) {
        const id = Number(k);
        if (v > topVal) {
          topVal = v;
          topId = id;
        }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, putkiVaaria: topVal };
    } catch (error) {
      console.error('Virhe suurinta vääriä putkea haettaessa:', error);
      return null;
    }
  }

  /**
   * Eniten vastauksia "viimeisellä sekunnilla" - määritelty tässä 9000-10000ms
   */
  public async haeEnitenVastauksiaViimeisellaSekunnilla() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;
      const threshold = 9000; // ms
      const counts: Record<number, number> = {};
      for (const v of vastaukset) {
        const pid = v.kayttaja_id ?? v.pelaaja_id ?? v.kayttaja ?? null;
        const aika = v.vastausaika_ms ?? v.vastausaika ?? null;
        if (!pid || typeof aika !== 'number') continue;
        if (aika >= threshold) counts[pid] = (counts[pid] || 0) + 1;
      }
      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(counts)) {
        const id = Number(k);
        if (v > topVal) {
          topVal = v;
          topId = id;
        }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, maara: topVal };
    } catch (error) {
      console.error('Virhe haettaessa vastauksia viimeisellä sekunnilla:', error);
      return null;
    }
  }

  /**
   * Pelaaja joka on pelannut eniten pelejä
   */
  public async haePelaajaEnitenPelia() {
    const db = await this.varmistaTietokanta();
    try {
      const pelit = await db.haeKaikkiPelit();
      if (!pelit || pelit.length === 0) return null;
      const counts: Record<number, number> = {};
      for (const p of pelit) {
        if (!p.lopetettu) continue;
        const pid = p.kayttaja_id;
        if (!pid) continue;
        counts[pid] = (counts[pid] || 0) + 1;
      }
      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(counts)) {
        const id = Number(k);
        if (v > topVal) {
          topVal = v;
          topId = id;
        }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, pelit: topVal };
    } catch (error) {
      console.error('Virhe haettaessa pelaajaa joka on pelannut eniten pelejä:', error);
      return null;
    }
  }

  /**
   * Hae pelaaja jolla on eniten oikeita vastauksia
   * @returns Pelaaja eniten oikeilla vastauksilla tai null jos ei pelaajia
   */
  public async haePelaajaEnitenOikeilla() {
    const db = await this.varmistaTietokanta();
    
    try {
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;

      // Järjestä oikeiden vastausten mukaan laskevasti
      const sorted = tilastot.sort((a: any, b: any) => (b.oikeita_vastauksia || 0) - (a.oikeita_vastauksia || 0));
      
      if (sorted.length > 0 && sorted[0].oikeita_vastauksia > 0) {
        // Hae pelaajan tiedot
        const pelaaja = await db.haeKayttajaById(sorted[0].kayttaja_id);
        return {
          pelaaja,
          oikeitaVastauksia: sorted[0].oikeita_vastauksia
        };
      }
      
      return null;
    } catch (error) {
      console.error('Virhe eniten oikeita vastauksia haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae pelaaja jolla on eniten vääriä vastauksia
   * @returns Pelaaja eniten väärillä vastauksilla tai null jos ei pelaajia
   */
  public async haePelaajaEnitenVaarilla() {
    const db = await this.varmistaTietokanta();
    
    try {
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;

      // Järjestä väärien vastausten mukaan laskevasti
      const sorted = tilastot.sort((a: any, b: any) => (b.vaaria_vastauksia || 0) - (a.vaaria_vastauksia || 0));
      
      if (sorted.length > 0 && sorted[0].vaaria_vastauksia > 0) {
        // Hae pelaajan tiedot
        const pelaaja = await db.haeKayttajaById(sorted[0].kayttaja_id);
        return {
          pelaaja,
          vaariaVastauksia: sorted[0].vaaria_vastauksia
        };
      }
      
      return null;
    } catch (error) {
      console.error('Virhe eniten vääriä vastauksia haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae pelaaja parhaalla vastausprosentilla
   * @param minimipelit - Vähimmäispelimäärä huomioidakseen (oletus: 3)
   * @returns Pelaaja parhaalla vastausprosentilla tai null jos ei pelaajia
   */
  public async haePelaajaParhaallaProsent(minimipelit: number = 1) {
    const db = await this.varmistaTietokanta();
    
    try {
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;

      // Suodata pelaajat joilla on tarpeeksi pelejä ja laske vastausprosentit
      const pelaajatProsentit = tilastot
        .filter((t: any) => (t.pelatut_pelit || 0) >= minimipelit)
        .map((t: any) => {
          const oikeita = t.oikeita_vastauksia || 0;
          const vaaria = t.vaaria_vastauksia || 0;
          const yhteensa = oikeita + vaaria;
          const prosentti = yhteensa > 0 ? (oikeita / yhteensa) * 100 : 0;
          
          return {
            ...t,
            vastausprosentti: prosentti,
            yhteensaVastauksia: yhteensa
          };
        })
        .filter((t: any) => t.yhteensaVastauksia > 0) // Vain ne joilla on vastauksia
        .sort((a: any, b: any) => b.vastausprosentti - a.vastausprosentti);
      
      if (pelaajatProsentit.length > 0) {
        const paras = pelaajatProsentit[0];
        // Hae pelaajan tiedot
        const pelaaja = await db.haeKayttajaById(paras.kayttaja_id);
        return {
          pelaaja,
          vastausprosentti: Math.round(paras.vastausprosentti * 10) / 10, // Pyöristä yhteen desimaaliin
          oikeitaVastauksia: paras.oikeita_vastauksia || 0,
          vaariaVastauksia: paras.vaaria_vastauksia || 0,
          yhteensaVastauksia: paras.yhteensaVastauksia
        };
      }
      
      return null;
    } catch (error) {
      console.error('Virhe parasta vastausprosenttia haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae vaikein kategoria (eniten vääriä vastauksia)
   * @returns Vaikein kategoria tai null jos ei tietoja
   */
  public async haeVaikeinKategoria() {
    const db = await this.varmistaTietokanta();
    
    try {
      // Hae kaikki peli_vastaukset tiedot
      const peliVastaukset = await db.haePeliVastaukset();
      if (!peliVastaukset || peliVastaukset.length === 0) return null;

      // Ryhmittele kategorioittain ja laske väärien vastausten määrät
      const kategoriatilastot: { [kategoria: string]: { oikeita: number, vaaria: number } } = {};

      for (const vastaus of peliVastaukset) {
        const kategoria = vastaus.kategoria || 'Tuntematon';
        
        if (!kategoriatilastot[kategoria]) {
          kategoriatilastot[kategoria] = { oikeita: 0, vaaria: 0 };
        }

        if (vastaus.on_oikein) {
          kategoriatilastot[kategoria].oikeita++;
        } else {
          kategoriatilastot[kategoria].vaaria++;
        }
      }

      // Etsi kategoria jossa eniten vääriä vastauksia
      let vaikeinKategoria = null;
      let enitenVaaria = 0;

      for (const [kategoria, stats] of Object.entries(kategoriatilastot)) {
        const yhteensa = stats.oikeita + stats.vaaria;
        // Huomioi vain kategoriat joissa on vähintään 10 vastausta
        if (yhteensa >= 10 && stats.vaaria > enitenVaaria) {
          enitenVaaria = stats.vaaria;
          vaikeinKategoria = {
            kategoria,
            vaariaVastauksia: stats.vaaria,
            oikeitaVastauksia: stats.oikeita,
            yhteensaVastauksia: yhteensa,
            vaikeusprosen: Math.round((stats.vaaria / yhteensa) * 1000) / 10 // Pyöristä 1 desimaaliin
          };
        }
      }

      return vaikeinKategoria;
    } catch (error) {
      console.error('Virhe vaikeinta kategoriaa haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae pelissä saadut korkeimmat pisteet yhdestä pelistä
   */
  public async haeEnitenPisteitaYhdessaPeli() {
    const db = await this.varmistaTietokanta();
    try {
      const pelit = await db.haeKaikkiPelit();
      if (!pelit || pelit.length === 0) return null;
      const finished = pelit.filter((p: any) => p.lopetettu);
      if (finished.length === 0) return null;
      const maxPeli = finished.reduce((prev: any, cur: any) => (cur.pisteet > (prev.pisteet || 0) ? cur : prev), finished[0]);
      const pelaaja = await db.haeKayttajaById(maxPeli.kayttaja_id);
      return {
        peli: maxPeli,
        pelaaja,
        pisteet: maxPeli.pisteet,
        kysymysten_maara: maxPeli.kysymysten_maara || null,
      };
    } catch (error) {
      console.error('Virhe eniten pisteitä yhdessä pelissä haettaessa:', error);
      return null;
    }
  }

  /**
   * Hae nopein vastaaja (keskiarvo vastausaikojen perusteella). Jos ei vastausaikoja,
   * palauttaa null.
   */
  public async haeNopeinVastaaja() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;

      // Ryhmittele pelaajittain ja laske keskiarvo vastausajoista (oikeat ensin, muuten kaikki)
      const pelaajaAikataulut: Record<number, number[]> = {};
      for (const v of vastaukset) {
        // Vastausaika kentässä `vastausaika_ms` käytössä
        const pid = v.kayttaja_id || v.pelaaja_id || v.kayttaja || v.peli_id && null;
        // We don't always have player id on peli_vastaukset in some formats; try to use kayttaja_id if present
        const kayttajaId = v.kayttaja_id ?? v.kayttaja ?? null;
        const aika = v.vastausaika_ms ?? v.vastausaika ?? null;
        if (!kayttajaId || typeof aika !== 'number') continue;
        if (!pelaajaAikataulut[kayttajaId]) pelaajaAikataulut[kayttajaId] = [];
        pelaajaAikataulut[kayttajaId].push(aika);
      }

      const keskiarvot: Array<{ id: number; avg: number }> = [];
      for (const [idStr, arr] of Object.entries(pelaajaAikataulut)) {
        if (!arr || arr.length === 0) continue;
        const id = Number(idStr);
        const avg = arr.reduce((s, a) => s + a, 0) / arr.length;
        keskiarvot.push({ id, avg });
      }

      if (keskiarvot.length === 0) return null;
      keskiarvot.sort((a, b) => a.avg - b.avg);
      const paras = keskiarvot[0];
      const pelaaja = await db.haeKayttajaById(paras.id);
      return {
        pelaaja,
        keskimaarainenVastausaikaMs: Math.round(paras.avg),
      };
    } catch (error) {
      console.error('Virhe nopeimman vastaajan haussa:', error);
      return null;
    }
  }

  /**
   * Kaikkien pelaajien yhteispisteet
   */
  public async haeKaikkienPelaajienYhteispisteet() {
    const db = await this.varmistaTietokanta();
    try {
      const pelaajat = await db.haeKaikkiKayttajat();
      if (!pelaajat || pelaajat.length === 0) return 0;
      return pelaajat.reduce((s: number, p: any) => s + (p.pisteet_yhteensa || 0), 0);
    } catch (error) {
      console.error('Virhe kaikkien pelaajien yhteispisteiden haussa:', error);
      return 0;
    }
  }

  /**
   * Kategoria-läpäisyprosentit ja eniten käytetty kategoria
   */
  public async haeKategoriaTilastot() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return { kategorioittain: {}, enitenKaytetty: null };

      const kategoriat: Record<string, { oikeat: number; kaikki: number }> = {};
      for (const v of vastaukset) {
        const k = v.kategoria || 'Tuntematon';
        if (!kategoriat[k]) kategoriat[k] = { oikeat: 0, kaikki: 0 };
        kategoriat[k].kaikki += 1;
        const onOikein = v.oikein ?? v.on_oikein ?? false;
        if (onOikein) kategoriat[k].oikeat += 1;
      }

      const kategorioittain: Record<string, { oikeat: number; kaikki: number; prosentti: number }> = {};
      let enitenKaytetty = null;
      let enitenKaytettyMaara = 0;
      for (const [k, stats] of Object.entries(kategoriat)) {
        const prosentti = stats.kaikki > 0 ? Math.round((stats.oikeat / stats.kaikki) * 1000) / 10 : 0;
        kategorioittain[k] = { oikeat: stats.oikeat, kaikki: stats.kaikki, prosentti };
        if (stats.kaikki > enitenKaytettyMaara) {
          enitenKaytettyMaara = stats.kaikki;
          enitenKaytetty = k;
        }
      }

      return { kategorioittain, enitenKaytetty };
    } catch (error) {
      console.error('Virhe kategoria-tilastojen haussa:', error);
      return { kategorioittain: {}, enitenKaytetty: null };
    }
  }

  /**
   * Placeholder: Eniten tuplapisteitä saatu (erikoiskortit)
   */
  public async haeEnitenTuplapisteita() {
    // Placeholder - ei vielä tallenneta erikoiskortteja
    return null;
  }

  /**
   * Hae pelaaja jolla on eniten oikeita vastauksia (kokonaistilasto, summattu)
   */
  public async haePelaajaEnitenOikeitaKokonaistilasto() {
    const db = await this.varmistaTietokanta();
    try {
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;
      const counts: Record<number, number> = {};
      for (const t of tilastot) {
        const id = t.kayttaja_id;
        counts[id] = (counts[id] || 0) + (t.oikeat_vastaukset || 0);
      }
      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(counts)) {
        const id = Number(k);
        if (v > topVal) { topVal = v; topId = id; }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, oikeitaVastauksia: topVal };
    } catch (e) {
      console.error('Virhe haettaessa pelaajaa eniten oikeita (kokonais):', e);
      return null;
    }
  }

  /**
   * Hae pelaaja jolla on eniten vääriä vastauksia (kokonaistilasto, summattu)
   */
  public async haePelaajaEnitenVaariaKokonaistilasto() {
    const db = await this.varmistaTietokanta();
    try {
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;
      const counts: Record<number, number> = {};
      for (const t of tilastot) {
        const id = t.kayttaja_id;
        counts[id] = (counts[id] || 0) + (t.vaarat_vastaukset || 0);
      }
      let topId: number | null = null;
      let topVal = 0;
      for (const [k, v] of Object.entries(counts)) {
        const id = Number(k);
        if (v > topVal) { topVal = v; topId = id; }
      }
      if (!topId) return null;
      const pelaaja = await db.haeKayttajaById(topId);
      return { pelaaja, vaariaVastauksia: topVal };
    } catch (e) {
      console.error('Virhe haettaessa pelaajaa eniten vääriä (kokonais):', e);
      return null;
    }
  }

  /**
   * Hae nopein yksittäinen vastaus (min vastausaika ms)
   */
  public async haeNopeinYksittainenVastaus() {
    const db = await this.varmistaTietokanta();
    try {
      const vastaukset = await db.haePeliVastaukset();
      if (!vastaukset || vastaukset.length === 0) return null;
      let top = null;
      let topMs = Number.MAX_SAFE_INTEGER;
      for (const v of vastaukset) {
        const aika = v.vastausaika_ms ?? v.vastausaika ?? null;
        if (typeof aika !== 'number') continue;
        if (aika < topMs) { topMs = aika; top = v; }
      }
      if (!top) return null;
      const pelaajaId = top.kayttaja_id ?? top.pelaaja_id ?? top.kayttaja ?? null;
      const pelaaja = pelaajaId ? await db.haeKayttajaById(pelaajaId) : null;
      return { pelaaja, ms: topMs, vastaus: top.annettu_vastaus };
    } catch (e) {
      console.error('Virhe haettaessa nopeinta yksittäistä vastausta:', e);
      return null;
    }
  }


  /**
   * Placeholder: Eniten käytetty erikoiskortti
   */
  public async haeEnitenKaytettyErikoiskortti() {
    // Placeholder - ei vielä tallenneta erikoiskortteja
    return null;
  }


  /**
   * Hae kaikki tilastot yhtenä objektina (yleiskatsaus)
   * @returns Yhteenveto kaikista tilastoista
   */
  public async haeYleisTilastot() {
    try {
      const [
        enitenPisteet,
        enitenOikeat,
        enitenVaarat,
        parasProsentti,
        vaikeinKategoria
      ] = await Promise.all([
        this.haePelaajaEnitenPisteilla(),
        this.haePelaajaEnitenOikeilla(),
        this.haePelaajaEnitenVaarilla(),
        this.haePelaajaParhaallaProsent(),
        this.haeVaikeinKategoria()
      ]);

      // Fetch additional aggregated stats
      const [
        enitenYhdessaPeli,
        nopeinVastaaja,
        kaikkienPisteet,
        kategoriaTilastot,
        enitenTuplat,
        enitenErikoiskortti,
        suurinPutkiOikeita,
        suurinPutkiVaaria,
        vastauksiaViimeSekunnilla,
        enitenPelia,
        enitenOikeitaKokonaistilasto,
        enitenVaariaKokonaistilasto,
        nopeinYksittainen
      ] = await Promise.all([
        this.haeEnitenPisteitaYhdessaPeli(),
        this.haeNopeinVastaaja(),
        this.haeKaikkienPelaajienYhteispisteet(),
          this.haeKategoriaTilastot(),
          this.haeEnitenTuplapisteita(),
          this.haeEnitenKaytettyErikoiskortti(),
          this.haeSuurinPutkiOikeita(),
          this.haeSuurinPutkiVaaria(),
          this.haeEnitenVastauksiaViimeisellaSekunnilla(),
          this.haePelaajaEnitenPelia(),
          this.haePelaajaEnitenOikeitaKokonaistilasto(),
          this.haePelaajaEnitenVaariaKokonaistilasto(),
          this.haeNopeinYksittainenVastaus()
      ]);

      // Normalize and provide placeholders for UI
      const normalized = {
        enitenPisteet: enitenPisteet || { pelaaja: null, pisteet: '-' },
        enitenOikeat: enitenOikeat || { pelaaja: null, oikeitaVastauksia: '-' },
        enitenVaarat: enitenVaarat || { pelaaja: null, vaariaVastauksia: '-' },
        parasProsentti: parasProsentti || null,
        vaikeinKategoria: vaikeinKategoria || null,
        enitenYhdessaPeli: enitenYhdessaPeli || null,
        nopeinVastaaja: nopeinVastaaja || null,
        kaikkienPisteet: typeof kaikkienPisteet === 'number' ? kaikkienPisteet : 0,
        kategoriaTilastot: kategoriaTilastot || { kategorioittain: {}, enitenKaytetty: null },
        enitenTuplat: enitenTuplat || { message: 'Ei tallennettu' },
        enitenErikoiskortti: enitenErikoiskortti || { nimi: 'Ei dataa', maara: '-' },
        suurinPutkiOikeita: suurinPutkiOikeita || { pelaaja: null, putki: '-' },
        suurinPutkiVaaria: suurinPutkiVaaria || { pelaaja: null, putkiVaaria: '-' },
        vastauksiaViimeSekunnilla: vastauksiaViimeSekunnilla || { pelaaja: null, maara: '-' },
        enitenPelia: enitenPelia || { pelaaja: null, pelit: '-' },
        enitenOikeitaKokonaistilasto: enitenOikeitaKokonaistilasto || { pelaaja: null, oikeitaVastauksia: '-' },
        enitenVaariaKokonaistilasto: enitenVaariaKokonaistilasto || { pelaaja: null, vaariaVastauksia: '-' },
        nopeinYksittainen: nopeinYksittainen || { pelaaja: null, ms: '-' }
      };

      return normalized;
    } catch (error) {
      console.error('Virhe yleistilastojen haussa:', error);
      return null;
    }
  }
}

// ===============================================
// SINGLETON PELI-INSTANSSI
// ===============================================

/**
 * Singleton instance - yksi globaali pelipalvelu koko sovellukselle
 */
export const peliPalvelu = new PeliPalvelu();
