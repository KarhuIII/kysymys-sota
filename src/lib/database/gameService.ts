// Kysymyssota Game Service
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
    peliId: number,
    vastaus: string,
  ): Promise<{
    oikein: boolean;
    oikeaVastaus: string;
    pisteet: number;
  } | null> {
    const db = await this.varmistaTietokanta();
    const peli = this.aktiivisetPelit.get(peliId);
    if (!peli || !peli.nykyinenKysymys || !peli.kysymysAloitettu) return null;

    const kysymys = peli.nykyinenKysymys;
    const oikein =
      vastaus.toLowerCase().trim() ===
      kysymys.oikea_vastaus.toLowerCase().trim();
    const vastausaika = Date.now() - peli.kysymysAloitettu;

    // Laske pisteet (nopeampi vastaus = enemmän pisteitä)
    // Käytetään kysymyksen peruspisteitä ja lisätään nopeusbonus
    let pisteet = 0;
    if (oikein) {
      // Käytä kysymyksen omaa pistemaara_perus-arvoa
      const perusPisteet =
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
      const nopeusBonusKerroin = Math.max(0, (10000 - vastausaika) / 10000);
      const nopeusBonus = Math.round(perusPisteet * 0.5 * nopeusBonusKerroin);

      pisteet = perusPisteet + nopeusBonus;

      // Ikäkerroin: nuoremmille helpompi, vanhemmille haastavampi
      if (peli.kayttaja.ika) {
        const ikaKerroin =
          peli.kayttaja.ika < 12 ? 1.2 : peli.kayttaja.ika > 50 ? 0.8 : 1.0;
        pisteet = Math.round(pisteet * ikaKerroin);
      }

      peli.pisteet += pisteet;
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
    console.log('📝 Vastaus tallennettu:', {
      peliId,
      kysymysId: kysymys.id,
      annettuVastaus: vastaus,
      oikein,
      vastausaikaMs: vastausaika,
      kategoria: kysymys.kategoria
    });

    return {
      oikein,
      oikeaVastaus: kysymys.oikea_vastaus,
      pisteet,
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
      const tilastot = await db.haeTilastot();
      if (!tilastot || tilastot.length === 0) return null;

      // Järjestä pisteiden mukaan laskevasti
      const sorted = tilastot.sort((a: any, b: any) => (b.kokonais_pisteet || 0) - (a.kokonais_pisteet || 0));
      
      if (sorted.length > 0 && sorted[0].kokonais_pisteet > 0) {
        // Hae pelaajan tiedot
        const pelaaja = await db.haeKayttajaById(sorted[0].kayttaja_id);
        return {
          pelaaja,
          pisteet: sorted[0].kokonais_pisteet
        };
      }
      
      return null;
    } catch (error) {
      console.error('Virhe eniten pisteitä haettaessa:', error);
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

      return {
        enitenPisteet,
        enitenOikeat,
        enitenVaarat,
        parasProsentti,
        vaikeinKategoria
      };
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
