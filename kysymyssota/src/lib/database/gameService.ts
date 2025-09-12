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
    );

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

    // Poista aktiivisista peleistä
    this.aktiivisetPelit.delete(peliId);

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
}

// ===============================================
// SINGLETON PELI-INSTANSSI
// ===============================================

/**
 * Singleton instance - yksi globaali pelipalvelu koko sovellukselle
 */
export const peliPalvelu = new PeliPalvelu();
