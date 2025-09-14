import { getDB } from './database.js';

export async function debugDumpTilastot() {
  const db = await getDB();
  try {
    console.log('🔎 Aloitetaan DB-dumppi...');
    const pelit = await db.haeKaikkiPelit();
    console.log('🎮 Pelit:', pelit);

    const vastaukset = await db.haePeliVastaukset();
    console.log('✍️ Kaikki peli_vastaukset:', vastaukset);

    const tilastot = await db.haeTilastot();
    console.log('📈 Tilastot:', tilastot);

    // Myös pelikohtaiset vastaukset esimerkin vuoksi, jos on pelejä
    if (pelit && pelit.length > 0) {
      const first = pelit[0];
      const peliId = first.id;
      if (typeof peliId === 'number') {
        const peliVast = await db.haePeliVastauksetByPeliId(peliId);
        console.log(`✍️ Vastaukset pelille ${peliId}:`, peliVast);
      }
    }

    console.log('🔎 DB-dumppi valmis');
  } catch (error) {
    console.error('❌ DB-dump epäonnistui:', error);
  }
}

// Vie globaaliksi funktioksi konsolia varten
if (typeof globalThis !== 'undefined') {
  (globalThis as any).debugDumpTilastot = debugDumpTilastot;
}
