# Kysymysten ja viestien lisääminen

Tämä hakemisto sisältää kysymykset JSON-tiedostoina vaikeustasoittain jaoteltuina sekä pisteytysviestit.

## Tiedostorakenne

- `kysymykset-oppipoika.json` - 🪵 Oppipoika kysymykset (10 pistettä)
- `kysymykset-taitaja.json` - 🎨 Taitaja kysymykset (20 pistettä)
- `kysymykset-mestari.json` - ⚔️ Mestari kysymykset (30 pistettä)
- `kysymykset-kuningas.json` - 👑 Kuningas kysymykset (40 pistettä)
- `kysymykset-suurmestari.json` - 🌌 Suurmestari kysymykset (50 pistettä)
- `pisteytysviestit.json` - Satunnaiset viestit oikeille ja väärille vastauksille

## Pisteytysviestit

`pisteytysviestit.json` sisältää satunnaisia viestejä jotka näytetään kun pelaaja vastaa kysymykseen:

```json
{
  "oikeat_vastaukset": [
    "🎉 Loistavaa!",
    "⭐ Mahtavaa!",
    "🔥 Erinomaista!"
  ],
  "vaarat_vastaukset": [
    "😞 Väärin!",
    "😔 Ei osuma!",
    "😕 Huti!"
  ]
}
```

### Pisteytysviestien lisääminen

1. Avaa `pisteytysviestit.json`
2. Lisää uusia viestejä `oikeat_vastaukset` tai `vaarat_vastaukset` taulukoihin
3. Käytä emojeja ja positiivista/kannustavaa kieltä
4. Peli valitsee satunnaisesti jonkin viesteistä joka kerta

## Kysymyksen muoto

Jokainen kysymys on JSON-objekti seuraavassa muodossa:

```json
{
  "kysymys": "Kysymysteksti tähän?",
  "oikea_vastaus": "Oikea vastaus",
  "vaarat_vastaukset": ["Väärä 1", "Väärä 2", "Väärä 3"],
  "kategoria": "Aihe/kategoria",
  "vaikeustaso": "oppipoika|taitaja|mestari|kuningas|suurmestari",
  "pistemaara_perus": 10
}
```

## Ohjeita

1. **Vaikeustasot:**
   - `oppipoika`: 10 pistettä, 🪵 perustietoa
   - `taitaja`: 20 pistettä, 🎨 yleissivistystä
   - `mestari`: 30 pistettä, ⚔️ erikoistietoa
   - `kuningas`: 40 pistettä, 👑 asiantuntijatietoa
   - `suurmestari`: 50 pistettä, 🌌 eksperttitietoa

2. **Kategoriat:** Voit käyttää mitä tahansa kategoriaa (Eläimet, Maantieto, Tiede, jne.)

3. **Vastaukset:** Anna aina 3 väärää vaihtoehtoa `vaarat_vastaukset` -taulukossa

4. **Testaus:** Kun muutat tiedostoja, tyhjennä selaimen tietokanta (Developer Tools > Application > Storage) että uudet kysymykset latautuvat

## Uusien kysymysten lisääminen

1. Avaa sopiva JSON-tiedosto
2. Lisää uusi kysymysobjekti taulukon loppuun
3. Varmista JSON-syntaksi (pilkut, lainausmerkit)
4. Tallenna tiedosto
5. Sovellus lataa uudet kysymykset automaattisesti seuraavalla kerralla
