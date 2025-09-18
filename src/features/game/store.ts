import { writable } from 'svelte/store';
import type { Kayttaja, Kysymys } from '../../../lib/database/schema.js';

// Centralized game stores — migrate state from App and PeliIkkuna here.
export const peliPelaajat = writable<Kayttaja[]>([]);
export const pelinKierrosMaara = writable<number>(10);
export const nykyinenKysymys = writable<Kysymys | null>(null);
export const pelaajanPisteet = writable<Record<string, number>>({});

export function resetPeli() {
  peliPelaajat.set([]);
  pelinKierrosMaara.set(10);
  nykyinenKysymys.set(null);
  pelaajanPisteet.set({});
}
