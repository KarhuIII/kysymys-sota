// Kysymyssota - IndexedDB selainpohjainen tietokanta
import type {
  Kayttaja,
  Kysymys,
  Peli,
  PeliVastaus,
  Tilasto,
} from "./schema.js";

// Importoi kysymykset JSON-tiedostoista
import oppipoikaKysymykset from "../data/kysymykset-oppipoika.json";
import taitajaKysymykset from "../data/kysymykset-taitaja.json";
import mestariKysymykset from "../data/kysymykset-mestari.json";
import kuningasKysymykset from "../data/kysymykset-kuningas.json";
import suurmestariKysymykset from "../data/kysymykset-suurmestari.json";

export class KysymyssotaDB {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = "KysymyssotaDB";
  private readonly DB_VERSION = 1;

  /**
   * Tyhjentää kaikki taulut tietokannassa ja alustaa kysymykset uudelleen
   */
  public async tyhjennaTaulut(): Promise<void> {
    if (!this.db) return;

    console.log("🗑️ Tyhjennetään kaikki taulut...");

    const transaction = this.db.transaction([
      "kysymykset", 
      "kayttajat", 
      "pelit", 
      "pelien_vastaukset", 
      "tilastot"
    ], "readwrite");

    // Tyhjennä kaikki taulut
    const kysymyksetStore = transaction.objectStore("kysymykset");
    const kayttajatStore = transaction.objectStore("kayttajat");
    const pelitStore = transaction.objectStore("pelit");
    const vastauksetStore = transaction.objectStore("pelien_vastaukset");
    const tilastotStore = transaction.objectStore("tilastot");

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const req = kysymyksetStore.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = kayttajatStore.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = pelitStore.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = vastauksetStore.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
      new Promise<void>((resolve, reject) => {
        const req = tilastotStore.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
    ]);

    console.log("✅ Kaikki taulut tyhjennetty");

    // Lataa kysymykset uudelleen
    await this.lisaaEsimerkkiKysymyksia();
    console.log("✅ Kysymykset ladattu uudelleen");
  }

  constructor() {
    this.alustaDB();
  }

  private async alustaDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log("✅ Tietokanta avattu onnistuneesti");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Käyttäjät (Players) - Pelaajien tiedot ja asetukset
        if (!db.objectStoreNames.contains("kayttajat")) {
          const kayttajatStore = db.createObjectStore("kayttajat", {
            keyPath: "id",
            autoIncrement: true,
          });
          kayttajatStore.createIndex("nimi", "nimi", { unique: true });
          kayttajatStore.createIndex("ika", "ika", { unique: false });
          kayttajatStore.createIndex("vaikeustaso_min", "vaikeustaso_min", {
            unique: false,
          });
          kayttajatStore.createIndex("vaikeustaso_max", "vaikeustaso_max", {
            unique: false,
          });
        }

        // Kysymykset (Questions) - Tietovisailukysymykset
        if (!db.objectStoreNames.contains("kysymykset")) {
          const kysymyksetStore = db.createObjectStore("kysymykset", {
            keyPath: "id",
            autoIncrement: true,
          });
          kysymyksetStore.createIndex("kategoria", "kategoria", {
            unique: false,
          });
          kysymyksetStore.createIndex("vaikeustaso", "vaikeustaso", {
            unique: false,
          });
          kysymyksetStore.createIndex("pistemaara_perus", "pistemaara_perus", {
            unique: false,
          });
        }

        // Pelit (GameSessions) - Yksittäiset pelikierrokset
        if (!db.objectStoreNames.contains("pelit")) {
          const pelitStore = db.createObjectStore("pelit", {
            keyPath: "id",
            autoIncrement: true,
          });
          pelitStore.createIndex("kayttaja_id", "kayttaja_id", {
            unique: false,
          });
          pelitStore.createIndex("aloitettu", "aloitettu", { unique: false });
          pelitStore.createIndex("lopetettu", "lopetettu", { unique: false });
        }

        // Pelin vastaukset
        if (!db.objectStoreNames.contains("peli_vastaukset")) {
          const vastauksetStore = db.createObjectStore("peli_vastaukset", {
            keyPath: "id",
            autoIncrement: true,
          });
          vastauksetStore.createIndex("peli_id", "peli_id", { unique: false });
        }

                // Tilastot
        if (!db.objectStoreNames.contains("tilastot")) {
          const tilastotStore = db.createObjectStore("tilastot", {
            keyPath: "id",
            autoIncrement: true,
          });
          tilastotStore.createIndex("kayttaja_id", "kauttaja_id", {
            unique: false,
          });
        }
        
        // Alusta kysymykset kun tietokanta luodaan ensimmäistä kertaa
        console.log("🆕 Uusi tietokanta luotu, lisätään esimerkkikysymyksiä...");
        setTimeout(() => this.lisaaEsimerkkiKysymyksia(), 100);
      };
    });
  }

  private async lisaaEsimerkkiKysymyksia(): Promise<void> {
    if (!this.db) return;

    console.log("🔍 Tarkistetaan kysymykset tietokannassa...");

    const transaction = this.db.transaction(["kysymykset"], "readonly");
    const store = transaction.objectStore("kysymykset");
    const count = await this.getCount(store);

    console.log(`📊 Tietokannassa on ${count} kysymystä`);

    // Lataa aina JSON-kysymykset (myös jos tietokannassa on jo kysymyksiä)
    console.log("📥 Ladataan kysymykset JSON-tiedostoista...");

    // Yhdistä kaikki kysymykset JSON-tiedostoista
    const kaikkiKysymykset = [
      ...(Array.isArray(oppipoikaKysymykset) ? oppipoikaKysymykset : [oppipoikaKysymykset]),
      ...(Array.isArray(taitajaKysymykset) ? taitajaKysymykset : [taitajaKysymykset]),
      ...(Array.isArray(mestariKysymykset) ? mestariKysymykset : [mestariKysymykset]),
      ...(Array.isArray(kuningasKysymykset) ? kuningasKysymykset : [kuningasKysymykset]),
      ...(Array.isArray(suurmestariKysymykset) ? suurmestariKysymykset : [suurmestariKysymykset]),
    ];

    console.log(`🔢 Ladattiin yhteensä ${kaikkiKysymykset.length} kysymystä`);
    console.log("📝 Oppipoika:", Array.isArray(oppipoikaKysymykset) ? oppipoikaKysymykset.length : 1);
    console.log("📝 Taitaja:", Array.isArray(taitajaKysymykset) ? taitajaKysymykset.length : 1);
    console.log("📝 Mestari:", Array.isArray(mestariKysymykset) ? mestariKysymykset.length : 1);
    console.log("📝 Kuningas:", Array.isArray(kuningasKysymykset) ? kuningasKysymykset.length : 1);
    console.log("📝 Suurmestari:", Array.isArray(suurmestariKysymykset) ? suurmestariKysymykset.length : 1);

    if (count === 0) {
      // Muunna JSON-muotoiset kysymykset tietokantamuotoon
      const kysymykset = kaikkiKysymykset.flatMap((k: any) => {
        if (Array.isArray(k)) {
          return k.map((item: any) => ({
            kysymys: item.kysymys,
            oikea_vastaus: item.oikea_vastaus,
            vaarat_vastaukset: JSON.stringify(item.vaarat_vastaukset),
            kategoria: item.kategoria || "",
            vaikeustaso: item.vaikeustaso as "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
            pistemaara_perus: item.pistemaara_perus || 10,
            luotu: new Date().toISOString(),
            lahde: "json" as any, // Merkitse JSON-lähteiseksi
          }));
        } else {
          return [{
            kysymys: k.kysymys,
            oikea_vastaus: k.oikea_vastaus,
            vaarat_vastaukset: JSON.stringify(k.vaarat_vastaukset),
            kategoria: k.kategoria || "",
            vaikeustaso: k.vaikeustaso as "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
            pistemaara_perus: k.pistemaara_perus || 10,
            luotu: new Date().toISOString(),
            lahde: "json" as any, // Merkitse JSON-lähteiseksi
          }];
        }
      });

      // Debug: laske vaikeustasojen määrät
      const vaikeustasoLaskuri: Record<string, number> = {};
      kysymykset.forEach(k => {
        vaikeustasoLaskuri[k.vaikeustaso] = (vaikeustasoLaskuri[k.vaikeustaso] || 0) + 1;
      });
      console.log("🔍 Tietokantaan lisättävät kysymykset vaikeustasoittain:");
      Object.entries(vaikeustasoLaskuri).forEach(([taso, maara]) => {
        console.log(`  ${taso}: ${maara} kysymystä`);
      });

      const writeTransaction = this.db.transaction(["kysymykset"], "readwrite");
      const writeStore = writeTransaction.objectStore("kysymykset");

      for (const kysymys of kysymykset) {
        writeStore.add(kysymys);
      }

      console.log("✅ Kysymykset lisätty tietokantaan!");
    } else {
      console.log(
        "ℹ️ Kysymykset jo tietokannassa, käytä paivitaKysymykset() päivittääksesi",
      );
    }
  }

  private async getCount(store: IDBObjectStore): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===============================================
  // TIETOKANNAN HALLINTA (Database Management)
  // ===============================================

  /**
   * Päivitä JSON-kysymykset säilyttäen admin-paneelissa lisätyt
   */
  async paivitaKysymykset(): Promise<void> {
    if (!this.db) return;

    console.log("🔄 Päivitetään JSON-kysymykset säilyttäen admin-lisäykset...");

    // Hae ensin kaikki nykyiset kysymykset
    const nykyisetKysymykset = await this.haeKaikkiKysymykset();
    
    // Etsi admin-paneelissa lisätyt kysymykset
    const adminKysymykset = nykyisetKysymykset.filter(k => {
      return (k as any).lahde === "admin";
    });

    console.log(`💾 Säilytetään ${adminKysymykset.length} admin-kysymystä`);
    console.log("🔍 Admin-kysymykset:", adminKysymykset.map(k => k.kysymys.substring(0, 50)));

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    // Tyhjennä kaikki kysymykset
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    console.log("✅ Kysymykset tyhjennetty, ladataan JSON + admin-kysymykset...");

    // Lataa JSON-kysymykset
    await this.lisaaEsimerkkiKysymyksia();
    
    // Lisää takaisin admin-kysymykset
    for (const kysymys of adminKysymykset) {
      const { id, ...kysymysIlmanId } = kysymys;
      // Varmista että lahde on "admin"
      (kysymysIlmanId as any).lahde = "admin";
      console.log("🔄 Lisätään takaisin admin-kysymys:", kysymysIlmanId.kysymys.substring(0, 50));
      await this.lisaaKysymys(kysymysIlmanId);
    }
    
    console.log(`✅ Päivitys valmis: JSON + ${adminKysymykset.length} admin-kysymystä`);
  }

  // ===============================================
  // KÄYTTÄJÄHALLINTA (Player Management)
  // ===============================================

  /**
   * Lisää uusi pelaaja tietokantaan
   * @param nimi - Pelaajan nimi
   * @param ika - Pelaajan ikä (valinnainen)
   * @param vaikeustasoMin - Pelaajan minimi vaikeustaso (valinnainen)
   * @param vaikeustasoMax - Pelaajan maksimi vaikeustaso (valinnainen)
   * @returns Pelaajan ID
   */
  public async lisaaKayttaja(
    nimi: string,
    ika?: number,
    vaikeustasoMin?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
    vaikeustasoMax?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari",
    pelaajanVari?: string,
  ): Promise<number> {
    if (!this.db) throw new Error("Tietokanta ei ole alustettuu");

    const transaction = this.db.transaction(["kayttajat"], "readwrite");
    const store = transaction.objectStore("kayttajat");

    const kayttaja: Omit<Kayttaja, "id"> = {
      nimi,
      ika,
      vaikeustaso_min: vaikeustasoMin,
      vaikeustaso_max: vaikeustasoMax,
      pelaajan_vari: pelaajanVari,
      pisteet_yhteensa: 0,
      luotu: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.add(kayttaja);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Hae pelaaja ID:n perusteella
   * @param id - Pelaajan ID
   * @returns Pelaajan tiedot tai undefined
   */

  /**
   * Hae pelaaja ID:n perusteella
   * @param id - Pelaajan ID
   * @returns Pelaajan tiedot tai undefined
   */
  public async haeKayttaja(id: number): Promise<Kayttaja | undefined> {
    if (!this.db) return undefined;

    const transaction = this.db.transaction(["kayttajat"], "readonly");
    const store = transaction.objectStore("kayttajat");

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Hae pelaaja nimen perusteella
   * @param nimi - Pelaajan nimi
   * @returns Pelaajan tiedot tai undefined
   */
  public async haeKayttajaNimella(nimi: string): Promise<Kayttaja | undefined> {
    if (!this.db) return undefined;

    const transaction = this.db.transaction(["kayttajat"], "readonly");
    const store = transaction.objectStore("kayttajat");
    const index = store.index("nimi");

    return new Promise((resolve, reject) => {
      const request = index.get(nimi);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Päivitä pelaajan kokonaispistemäärä
   * @param kayttajaId - Pelaajan ID
   * @param lisaPisteet - Lisättävät pisteet
   */
  public async paivitaKayttajanPisteet(
    kayttajaId: number,
    lisaPisteet: number,
  ): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(["kayttajat"], "readwrite");
    const store = transaction.objectStore("kayttajat");

    return new Promise((resolve, reject) => {
      const getRequest = store.get(kayttajaId);

      getRequest.onsuccess = () => {
        const kayttaja = getRequest.result as Kayttaja;
        if (kayttaja) {
          kayttaja.pisteet_yhteensa =
            (kayttaja.pisteet_yhteensa || 0) + lisaPisteet;
          kayttaja.viimeksi_pelattu = new Date().toISOString();

          const putRequest = store.put(kayttaja);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error("Pelaajaa ei löytynyt"));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Päivitä pelaajan tiedot
   * @param kayttaja Päivitettävät käyttäjän tiedot
   */
  public async paivitaKayttaja(kayttaja: Kayttaja): Promise<void> {
    if (!this.db || !kayttaja.id) {
      throw new Error('Tietokanta ei ole käytettävissä tai käyttäjän ID puuttuu');
    }

    const transaction = this.db.transaction(["kayttajat"], "readwrite");
    const store = transaction.objectStore("kayttajat");

    return new Promise((resolve, reject) => {
      const request = store.put(kayttaja);
      
      request.onsuccess = () => {
        console.log('✅ Käyttäjä päivitetty onnistuneesti:', kayttaja.nimi);
        resolve();
      };
      
      request.onerror = () => {
        console.error('❌ Virhe käyttäjän päivittämisessä:', request.error);
        reject(request.error);
      };
    });
  }

  // ===============================================
  // KYSYMYSHALLINTA (Question Management)
  // ===============================================

  /**
   * Hae satunnainen kysymys annetuilla kriteereillä
   * @param kategoria - Kysymyksen kategoria (valinnainen)
   * @param vaikeustaso - Kysymyksen vaikeustaso (valinnainen)
   * @param pelajanIka - Pelaajan ikä pisteiden laskentaa varten (valinnainen)
   * @returns Satunnainen kysymys tai undefined
   */
  public async haeSatunnainenKysymys(
    kategoria?: string,
    vaikeustaso?: string,
    pelajanIka?: number,
  ): Promise<Kysymys | undefined> {
    if (!this.db) return undefined;

    console.log(`🔍 Haetaan kysymys: kategoria=${kategoria}, vaikeustaso=${vaikeustaso}`);

    const transaction = this.db.transaction(["kysymykset"], "readonly");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      const kysymykset: Kysymys[] = [];
      const kaikki: Kysymys[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const kysymys = cursor.value as Kysymys;
          kaikki.push(kysymys);

          // Suodata kategoria ja vaikeustaso
          if (
            (!kategoria || kysymys.kategoria === kategoria) &&
            (!vaikeustaso || kysymys.vaikeustaso === vaikeustaso)
          ) {
            kysymykset.push(kysymys);
          }

          cursor.continue();
        } else {
          // Debug-lokitus
          console.log(`📊 Yhteensä kysymyksiä tietokannassa: ${kaikki.length}`);
          console.log(`📊 Suodatettu kysymyksiä: ${kysymykset.length}`);
          if (vaikeustaso) {
            const vaikeustasoKysymykset = kaikki.filter(k => k.vaikeustaso === vaikeustaso);
            console.log(`📊 ${vaikeustaso}-tason kysymyksiä: ${vaikeustasoKysymykset.length}`);
          }

          // Valitse satunnainen kysymys
          if (kysymykset.length > 0) {
            const satunnainenIndex = Math.floor(
              Math.random() * kysymykset.length,
            );
            const valittu = kysymykset[satunnainenIndex];
            console.log(`✅ Valittiin kysymys: ${valittu.kysymys?.substring(0, 50)}... (ID: ${valittu.id})`);
            resolve(valittu);
          } else {
            console.log(`❌ Ei löytynyt kysymyksiä kriteereillä: kategoria=${kategoria}, vaikeustaso=${vaikeustaso}`);
            resolve(undefined);
          }
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Hae kaikki kategoriat kysymysten lukumäärineen
   * @returns Objekti jossa avain=kategoria, arvo=kysymysten määrä
   */
  public async haeKategoriatMaarineen(): Promise<{
    [kategoria: string]: number;
  }> {
    if (!this.db) return {};

    const transaction = this.db.transaction(["kysymykset"], "readonly");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      const kategoriaLaskurit = new Map<string, number>();
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const kysymys = cursor.value as Kysymys;
          const nykyinenMaara = kategoriaLaskurit.get(kysymys.kategoria) || 0;
          kategoriaLaskurit.set(kysymys.kategoria, nykyinenMaara + 1);
          cursor.continue();
        } else {
          // Muunna Map objektiksi ja järjestä aakkosjärjestykseen
          const tulos: { [kategoria: string]: number } = {};
          const jarjestetytKategoriat = Array.from(
            kategoriaLaskurit.keys(),
          ).sort();

          jarjestetytKategoriat.forEach((kategoria) => {
            tulos[kategoria] = kategoriaLaskurit.get(kategoria)!;
          });

          resolve(tulos);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Hae kaikki saatavilla olevat kategoriat
   * @returns Lista kategorioista aakkosjärjestyksessä
   */
  public async haeKategoriat(): Promise<string[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction(["kysymykset"], "readonly");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      const kategoriat = new Set<string>();
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const kysymys = cursor.value as Kysymys;
          kategoriat.add(kysymys.kategoria);
          cursor.continue();
        } else {
          resolve(Array.from(kategoriat).sort());
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // ===============================================
  // PELIHALLINTA (Game Management)
  // ===============================================

  /**
   * Aloita uusi peli pelaajalle
   * @param kayttajaId - Pelaajan ID
   * @returns Uuden pelin ID
   */
  public async aloitaPeli(kayttajaId: number): Promise<number> {
    if (!this.db) throw new Error("Tietokanta ei ole alustettu");

    const transaction = this.db.transaction(["pelit"], "readwrite");
    const store = transaction.objectStore("pelit");

    const peli: Omit<Peli, "id"> = {
      kayttaja_id: kayttajaId,
      aloitettu: new Date().toISOString(),
      pisteet: 0,
      kysymysten_maara: 0,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(peli);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Lopeta peli ja tallenna tulokset
   * @param peliId - Pelin ID
   * @param pisteet - Pelissä saadut pisteet
   * @param kysymystenMaara - Pelattujen kysymysten määrä
   */
  public async lopetaPeli(
    peliId: number,
    pisteet: number,
    kysymystenMaara: number,
  ): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(["pelit"], "readwrite");
    const store = transaction.objectStore("pelit");

    return new Promise((resolve, reject) => {
      const getRequest = store.get(peliId);

      getRequest.onsuccess = () => {
        const peli = getRequest.result as Peli;
        if (peli) {
          peli.lopetettu = new Date().toISOString();
          peli.pisteet = pisteet;
          peli.kysymysten_maara = kysymystenMaara;

          const putRequest = store.put(peli);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error("Peliä ei löytynyt"));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Tallenna pelaajan vastaus kysymykseen
   * @param peliId - Pelin ID
   * @param kysymysId - Kysymyksen ID
   * @param annettuVastaus - Pelaajan antama vastaus
   * @param oikein - Oliko vastaus oikein
   * @param vastausaikaMs - Vastausaika millisekunneissa
   */
  public async tallennaPeliVastaus(
    peliId: number,
    kysymysId: number,
    annettuVastaus: string,
    oikein: boolean,
    vastausaikaMs: number,
  ): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(["peli_vastaukset"], "readwrite");
    const store = transaction.objectStore("peli_vastaukset");

    const vastaus: Omit<PeliVastaus, "id"> = {
      peli_id: peliId,
      kysymys_id: kysymysId,
      annettu_vastaus: annettuVastaus,
      oikein,
      vastausaika_ms: vastausaikaMs,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(vastaus);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===============================================
  // TILASTOT (Statistics)
  // ===============================================

  /**
   * Hae pelaajan tilastot kaikista peleistä
   * @param kayttajaId - Pelaajan ID
   * @returns Tilastot tai null
   */
  public async haeKayttajanTilastot(kayttajaId: number): Promise<any> {
    if (!this.db) return null;

    const transaction = this.db.transaction(["pelit"], "readonly");
    const store = transaction.objectStore("pelit");
    const index = store.index("kayttaja_id");

    return new Promise((resolve, reject) => {
      const pelit: Peli[] = [];
      const request = index.openCursor(kayttajaId);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const peli = cursor.value as Peli;
          if (peli.lopetettu) {
            pelit.push(peli);
          }
          cursor.continue();
        } else {
          // Laske tilastot
          const tilastot = {
            pelatut_pelit: pelit.length,
            kokonais_pisteet: pelit.reduce((sum, p) => sum + p.pisteet, 0),
            keskiarvo_pisteet:
              pelit.length > 0
                ? pelit.reduce((sum, p) => sum + p.pisteet, 0) / pelit.length
                : 0,
            paras_tulos:
              pelit.length > 0 ? Math.max(...pelit.map((p) => p.pisteet)) : 0,
          };
          resolve(tilastot);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Hae parhaat tulokset kaikkien pelaajien keskuudessa
   * @param raja - Montako tulosta haetaan (oletus: 10)
   * @returns Lista parhaista tuloksista
   */
  public async haeParhaatTulokset(raja: number = 10): Promise<any[]> {
    if (!this.db) return [];

    const transaction = this.db.transaction(["pelit", "kayttajat"], "readonly");
    const pelitStore = transaction.objectStore("pelit");
    const kayttajatStore = transaction.objectStore("kayttajat");

    return new Promise((resolve, reject) => {
      const tulokset: any[] = [];
      const request = pelitStore.openCursor();

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const peli = cursor.value as Peli;
          if (peli.lopetettu) {
            try {
              const kayttaja = await this.haeKayttaja(peli.kayttaja_id);
              if (kayttaja) {
                tulokset.push({
                  nimi: kayttaja.nimi,
                  pisteet: peli.pisteet,
                  lopetettu: peli.lopetettu,
                });
              }
            } catch (error) {
              console.error("Virhe käyttäjän haussa:", error);
            }
          }
          cursor.continue();
        } else {
          // Järjestä pisteiden mukaan ja rajaa
          tulokset.sort((a, b) => b.pisteet - a.pisteet);
          resolve(tulokset.slice(0, raja));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Sulje tietokantayhteys
   */
  public sulje(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Hae kaikki kysymykset (admin-käyttöön)
   */
  public async haeKaikkiKysymykset(): Promise<Kysymys[]> {
    console.log("🔍 haeKaikkiKysymykset() kutsuttu");
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      return [];
    }

    const transaction = this.db.transaction(["kysymykset"], "readonly");
    const store = transaction.objectStore("kysymykset");
    console.log("📊 Transaktio luotu, haetaan kysymyksiä...");

    return new Promise((resolve, reject) => {
      const kysymykset: Kysymys[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          kysymykset.push(cursor.value as Kysymys);
          cursor.continue();
        } else {
          console.log(`✅ Ladattu ${kysymykset.length} kysymystä`);
          resolve(kysymykset);
        }
      };

      request.onerror = () => {
        console.error("❌ Virhe kysymysten haussa:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Hae kaikki pelit (admin-käyttöön)
   */
  public async haeKaikkiPelit(): Promise<Peli[]> {
    console.log("🔍 haeKaikkiPelit() kutsuttu");
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      return [];
    }

    const transaction = this.db.transaction(["pelit"], "readonly");
    const store = transaction.objectStore("pelit");
    console.log("📊 Transaktio luotu, haetaan pelejä...");

    return new Promise((resolve, reject) => {
      const pelit: Peli[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          pelit.push(cursor.value as Peli);
          cursor.continue();
        } else {
          console.log(`✅ Ladattu ${pelit.length} peliä`);
          resolve(pelit);
        }
      };

      request.onerror = () => {
        console.error("❌ Virhe pelien haussa:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Hae kaikki käyttäjät (admin-käyttöön)
   */
  public async haeKaikkiKayttajat(): Promise<Kayttaja[]> {
    console.log("🔍 haeKaikkiKayttajat() kutsuttu");
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      return [];
    }

    const transaction = this.db.transaction(["kayttajat"], "readonly");
    const store = transaction.objectStore("kayttajat");
    console.log("📊 Transaktio luotu, haetaan käyttäjiä...");

    return new Promise((resolve, reject) => {
      const kayttajat: Kayttaja[] = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          kayttajat.push(cursor.value as Kayttaja);
          cursor.continue();
        } else {
          console.log(`✅ Ladattu ${kayttajat.length} käyttäjää`);
          resolve(kayttajat);
        }
      };

      request.onerror = () => {
        console.error("❌ Virhe käyttäjien haussa:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Päivitä kysymys (admin-käyttöön)
   */
  public async paivitaKysymys(kysymys: Kysymys): Promise<void> {
    console.log("🔄 paivitaKysymys() kutsuttu kysymykselle:", kysymys.id);
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      const request = store.put(kysymys);

      request.onsuccess = () => {
        console.log("✅ Kysymys päivitetty:", kysymys.id);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ Virhe kysymyksen päivittämisessä:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Merkitse kysymys virheelliseksi
   */
  public async merkitseVirheeliiseksi(kysymysId: number): Promise<void> {
    console.log("🚫 merkitseVirheeliiseksi() kutsuttu kysymykselle:", kysymysId);
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      // Hae ensin kysymys
      const getRequest = store.get(kysymysId);
      
      getRequest.onsuccess = () => {
        const kysymys = getRequest.result as Kysymys;
        if (kysymys) {
          // Merkitse virheelliseksi
          kysymys.virhe = true;
          
          // Tallenna takaisin
          const putRequest = store.put(kysymys);
          putRequest.onsuccess = () => {
            console.log("✅ Kysymys merkitty virheelliseksi:", kysymysId);
            resolve();
          };
          putRequest.onerror = () => {
            console.error("❌ Virhe kysymyksen merkitsemisessä virheelliseksi:", putRequest.error);
            reject(putRequest.error);
          };
        } else {
          console.error("❌ Kysymystä ei löytynyt:", kysymysId);
          reject(new Error("Kysymystä ei löytynyt"));
        }
      };

      getRequest.onerror = () => {
        console.error("❌ Virhe kysymyksen haussa:", getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Poista virhemerkintä kysymyksestä
   */
  public async poistaVirhemerkinta(kysymysId: number): Promise<void> {
    console.log("✅ poistaVirhemerkinta() kutsuttu kysymykselle:", kysymysId);
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      // Hae ensin kysymys
      const getRequest = store.get(kysymysId);
      
      getRequest.onsuccess = () => {
        const kysymys = getRequest.result as Kysymys;
        if (kysymys) {
          // Poista virhemerkintä
          kysymys.virhe = false;
          
          // Tallenna takaisin
          const putRequest = store.put(kysymys);
          putRequest.onsuccess = () => {
            console.log("✅ Virhemerkintä poistettu kysymyksestä:", kysymysId);
            resolve();
          };
          putRequest.onerror = () => {
            console.error("❌ Virhe virhemerkinnän poistamisessa:", putRequest.error);
            reject(putRequest.error);
          };
        } else {
          console.error("❌ Kysymystä ei löytynyt:", kysymysId);
          reject(new Error("Kysymystä ei löytynyt"));
        }
      };

      getRequest.onerror = () => {
        console.error("❌ Virhe kysymyksen haussa:", getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * Lisää uusi kysymys (admin-käyttöön)
   */
  public async lisaaKysymys(kysymys: Omit<Kysymys, 'id'>): Promise<Kysymys> {
    console.log("➕ lisaaKysymys() kutsuttu");
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    // Aseta luotu-aika jos ei ole määritelty
    const kysymysLuonnilla = {
      ...kysymys,
      luotu: kysymys.luotu || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const request = store.add(kysymysLuonnilla);

      request.onsuccess = () => {
        const id = request.result as number;
        console.log("✅ Uusi kysymys lisätty, ID:", id);
        const lisattyKysymys = { ...kysymysLuonnilla, id } as Kysymys;
        resolve(lisattyKysymys);
      };

      request.onerror = () => {
        console.error("❌ Virhe kysymyksen lisäämisessä:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Poista kysymys (admin-käyttöön)
   */
  public async poistaKysymys(id: string): Promise<void> {
    console.log("🗑️ poistaKysymys() kutsuttu ID:lle:", id);
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kysymykset"], "readwrite");
    const store = transaction.objectStore("kysymykset");

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log("✅ Kysymys poistettu:", id);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ Virhe kysymyksen poistamisessa:", request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Poista käyttäjä (admin-käyttöön)
   */
  public async poistaKayttaja(id: string | number): Promise<void> {
    const idNum = typeof id === 'string' ? parseInt(id) : id;
    console.log("🗑️ poistaKayttaja() kutsuttu ID:lle:", id, "-> muunnettu:", idNum, "tyyppi:", typeof idNum);
    if (!this.db) {
      console.warn("⚠️ Tietokanta ei ole käytettävissä");
      throw new Error("Tietokanta ei ole käytettävissä");
    }

    const transaction = this.db.transaction(["kayttajat"], "readwrite");
    const store = transaction.objectStore("kayttajat");

    return new Promise((resolve, reject) => {
      const request = store.delete(idNum);

      request.onsuccess = () => {
        console.log("✅ Käyttäjä poistettu:", idNum);
        resolve();
      };

      request.onerror = () => {
        console.error("❌ Virhe käyttäjän poistamisessa:", request.error);
        reject(request.error);
      };
    });
  }
}

// ===============================================
// SINGLETON TIETOKANTA-INSTANSSI
// ===============================================

// Singleton instance - odottaa alusitusta
let dbInstance: KysymyssotaDB | null = null;

/**
 * Hae tai luo tietokanta-instanssi
 * @returns Tietokanta-instanssi
 */
export const getDB = async (): Promise<KysymyssotaDB> => {
  if (!dbInstance) {
    dbInstance = new KysymyssotaDB();
    // Odota että tietokanta on alustettu
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return dbInstance;
};

/**
 * Tyhjentää koko tietokannan ja alustaa sen uudelleen
 */
export const tyhjennaJaAlustaUudelleen = async (): Promise<void> => {
  console.log("🗑️ Tyhjennetään koko tietokanta...");
  
  // Sulje nykyinen yhteys
  if (dbInstance) {
    dbInstance.sulje();
  }
  
  // Poista tietokanta kokonaan
  return new Promise<void>((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase("KysymyssotaDB");
    
    deleteRequest.onsuccess = async () => {
      console.log("✅ Tietokanta poistettu");
      dbInstance = null;
      
      // Luo uusi tietokanta
      console.log("🆕 Luodaan uusi tietokanta...");
      try {
        await getDB();
        console.log("✅ Uusi tietokanta luotu ja alustettu");
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    deleteRequest.onerror = () => {
      console.error("❌ Virhe tietokannan poistossa:", deleteRequest.error);
      reject(deleteRequest.error);
    };
    
    deleteRequest.onblocked = () => {
      console.warn("⚠️ Tietokannan poisto estetty - sulje muut välilehdet");
      reject(new Error("Database deletion blocked"));
    };
  });
};

/**
 * Päivitä kysymykset tietokannassa - lataa JSON-tiedostoista uudelleen
 */
export const paivitaKysymykset = async (): Promise<void> => {
  const db = await getDB();
  await db.paivitaKysymykset();
};
