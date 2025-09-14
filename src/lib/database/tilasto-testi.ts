// Tilastofunktioiden testi
// Voit käyttää tätä testataksesi tilastofunktioita konsolissa

import { peliPalvelu } from './gameService.js';

/**
 * Testaa kaikki tilastofunktiot ja tulosta tulokset konsoliin
 */
export async function testaaKaikkiTilastot() {
  console.log('🔍 Testataan tilastofunktioita...\n');

  try {
    // Testaa jokainen tilastofunktio erikseen
    console.log('📊 Eniten pisteitä:');
    const enitenPisteet = await peliPalvelu.haePelaajaEnitenPisteilla();
    if (enitenPisteet) {
      console.log(`   👑 ${enitenPisteet.pelaaja?.nimi}: ${enitenPisteet.pisteet} pistettä`);
    } else {
      console.log('   💭 Ei vielä pelaajia pisteitä');
    }

    console.log('\n✅ Eniten oikeita vastauksia:');
    const enitenOikeat = await peliPalvelu.haePelaajaEnitenOikeilla();
    if (enitenOikeat) {
      console.log(`   👑 ${enitenOikeat.pelaaja?.nimi}: ${enitenOikeat.oikeitaVastauksia} oikeaa vastausta`);
    } else {
      console.log('   💭 Ei vielä pelaajia oikeilla vastauksilla');
    }

    console.log('\n❌ Eniten vääriä vastauksia:');
    const enitenVaarat = await peliPalvelu.haePelaajaEnitenVaarilla();
    if (enitenVaarat) {
      console.log(`   👑 ${enitenVaarat.pelaaja?.nimi}: ${enitenVaarat.vaariaVastauksia} väärää vastausta`);
    } else {
      console.log('   💭 Ei vielä pelaajia väärillä vastauksilla');
    }

    console.log('\n🎯 Paras vastausprosentti:');
    const parasProsentti = await peliPalvelu.haePelaajaParhaallaProsent();
    if (parasProsentti) {
      console.log(`   👑 ${parasProsentti.pelaaja?.nimi}: ${parasProsentti.vastausprosentti}% (${parasProsentti.oikeitaVastauksia}/${parasProsentti.yhteensaVastauksia})`);
    } else {
      console.log('   💭 Ei vielä tarpeeksi pelaajia vastausprosentille');
    }

    console.log('\n😰 Vaikein kategoria:');
    const vaikeinKategoria = await peliPalvelu.haeVaikeinKategoria();
    if (vaikeinKategoria) {
      console.log(`   💀 ${vaikeinKategoria.kategoria}: ${vaikeinKategoria.vaikeusprosen}% väärää (${vaikeinKategoria.vaariaVastauksia}/${vaikeinKategoria.yhteensaVastauksia})`);
    } else {
      console.log('   💭 Ei vielä tarpeeksi vastauksia kategorioille');
    }

    console.log('\n📋 Kaikki tilastot yhtenä objektina:');
    const yleisTilastot = await peliPalvelu.haeYleisTilastot();
    console.log('   📊 YleisTilastot objekti:', yleisTilastot);

  } catch (error) {
    console.error('❌ Virhe tilastoja testatessa:', error);
  }
}

/**
 * Voit kutsua tätä funktiota konsolista:
 * 
 * import { testaaKaikkiTilastot } from './src/lib/database/tilasto-testi.js';
 * testaaKaikkiTilastot();
 */