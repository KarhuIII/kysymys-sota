// Kysymyssota - Tietokantaschema ja TypeScript-rajapinnat
// TypeScript-rajapinnat tietokannan entiteeteille

/**
 * Pelaaja (Player) - Sisältää pelaajan perustiedot ja asetukset
 */
export interface Kayttaja {
  id?: number; // Automaattinen tunniste
  nimi: string; // Pelaajan nimi
  ika?: number; // Pelaajan ikä (määrittää sopivat kysymykset)
  vaikeustaso_min?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari"; // Minimi vaikeustaso pelaajalle
  vaikeustaso_max?: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari"; // Maksimi vaikeustaso pelaajalle
  pelaajan_vari?: string; // Pelaajan värikoodi (esim. #3b82f6)
  pisteet_yhteensa?: number; // Kaikki pelaajan keräämät pisteet
  luotu: string; // Milloin pelaaja luotiin
  viimeksi_pelattu?: string; // Milloin viimeksi pelasi
}

/**
 * Kysymys (Question) - Yksittäinen tietovisailukysymys
 */
export interface Kysymys {
  id?: number; // Automaattinen tunniste
  kysymys: string; // Kysymysteksti
  oikea_vastaus: string; // Oikea vastaus
  vaarat_vastaukset: string; // JSON-stringinä: väärien vastausten lista
  kategoria: string; // Kategoria (esim. avaruus, historia, eläimet)
  vaikeustaso: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari"; // Kysymyksen vaikeustaso
  pistemaara_perus: number; // Peruspisteet ennen ikäkerroimen vaikutusta
  luotu: string; // Milloin kysymys luotiin
  virhe?: boolean; // Onko kysymyksessä ilmoitettu virhe
  lahde?: "json" | "admin"; // Kysymyksen lähde: JSON-tiedosto vai admin-paneeli
  // Tilastokentät
  oikeita_vastauksia?: number; // Kuinka monta kertaa tämän kysymyksen kohdalla on vastattu oikein
  vaaria_vastauksia?: number; // Kuinka monta kertaa väärin
}

/**
 * Peli (GameSession) - Yksittäinen pelikierros
 */
export interface Peli {
  id?: number; // Automaattinen tunniste
  kayttaja_id: number; // Viittaus pelaajaan
  aloitettu: string; // Aloitusaika (ISO string)
  lopetettu?: string; // Lopetusaika (ISO string, tyhjä jos kesken)
  pisteet: number; // Pelissä saadut kokonaispisteet
  kysymysten_maara: number; // Kuinka monta kysymystä pelattiin
}

/**
 * PeliVastaus (GameAnswer) - Yksittäinen vastaus pelissä
 */
export interface PeliVastaus {
  id?: number; // Automaattinen tunniste
  peli_id: number; // Viittaus peliin
  kysymys_id: number; // Viittaus kysymykseen
  annettu_vastaus: string; // Pelaajan antama vastaus
  oikein: boolean; // Oliko vastaus oikein
  vastausaika_ms: number; // Vastausaika millisekunneissa
  kategoria?: string; // Kysymyksen kategoria
}

/**
 * Tilasto (Statistics) - Pelaajan tilastotiedot kategorioittain
 */
export interface Tilasto {
  id?: number; // Automaattinen tunniste
  kayttaja_id: number; // Viittaus pelaajaan
  kategoria: string; // Kategorian nimi
  pelatut_pelit: number; // Pelattujen pelien määrä tässä kategoriassa
  kokonais_pisteet: number; // Kokonaispisteet tässä kategoriassa
  oikeat_vastaukset: number; // Oikeiden vastausten määrä
  vaarat_vastaukset: number; // Väärien vastausten määrä
  keskimaarainen_vastausaika: number; // Keskimääräinen vastausaika ms
  paivitetty: string; // Milloin tilastot viimeksi päivitettiin
}
