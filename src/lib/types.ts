export interface Pelaaja {
  id: string;
  nimi: string;
  vari: string;
  pisteet: number;
  min_vaikeustaso: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari";
  max_vaikeustaso: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari";
  luotu: string;
}

export interface Kysymys {
  id: number;
  kysymys: string;
  oikea_vastaus: string;
  vaarat_vastaukset: string; // JSON string array
  kategoria: string;
  vaikeustaso: "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari";
  pistemaara_perus: number;
  luotu: string;
}

export interface Pelitilanne {
  pelaajat: Pelaaja[];
  nykyinen_pelaaja_indeksi: number;
  nykyinen_kysymys: Kysymys | null;
  vastaus_annettu: boolean;
  peli_kaynnissa: boolean;
  kierros: number;
  pausen: boolean;
}

export type Vaikeustaso = "oppipoika" | "taitaja" | "mestari" | "kuningas" | "suurmestari";
