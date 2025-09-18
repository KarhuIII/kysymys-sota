# Koodikatsaus ja muistiinpanot

Päivitetty: 2025-09-18

Tämä tiedosto sisältää yhteenvedon käydystä keskustelusta, tehdyt muutokset ja löydetyt ongelmat sekä ehdotukset jatkotoimista.

## Yhteenveto

Projektissa on Svelte + TypeScript -sovellus, joka käyttää IndexedDB:tä paikalliseen tallennukseen `KysymysmestariDB`-wrapperin kautta. Keskustelun tavoitteena oli:

- Tallentaa pelaajakohtaiset streakit (peräkkäiset oikein vastatut) pysyvästi IndexedDB:hen.
- DRY: vähentää toistoa lisäämällä keskitetty DB-helper `tallennaPelitapahtumaJaEmit`, joka tallentaa pelitapahtuman ja emittoi globaalin tapahtuman UI:n päivitystä varten.
- Suorittaa koodin läpikäynti ja korvata manuaaliset tallennus+emit -kuviot useissa komponenttifunktioissa.

Toteutettuja muutoksia (lyhyesti):

- Lisätty `streaks` object store IndexedDB-skeemaan.
- Lisätty DB-metodit: `haeStreakByPeliId`, `paivitaStreak`, `poistaStreak`.
- Lisätty `tallennaPelitapahtumaJaEmit`-apufunktio `KysymysmestariDB`:hen.
- Päivitetty `PeliPalvelu.vastaaKysymykseen` käyttämään DB-pohjaista streak-logiikkaa (in-memory-fallback säilytettiin virhetilanteita varten).
- Käytiin läpi ja korjattiin useita UI-tiedostoja (mm. `src/lib/components/PeliIkkuna.svelte` ja `src/lib/components/AdminSivu.svelte`) käyttämään uutta helperia manuaalisten tallennus+emit -kutsujen sijaan.
- Suoritettiin TypeScript/Svelte -tarkistus (`npm run check`) — tulos: 0 virhettä, 0 varoitusta.

## Löydetyt ongelmat, riskit ja parannusehdotukset

Tässä on konsolidoitu lista havainnoista, priorisoituna. Nämä ovat havaintoja — ei tehtyjä korjauksia.

Korkea prioriteetti

- R1: Kilpailu- ja atomisuusongelmat streak-päivityksissä
  - Nykyinen toteutus tekee erillisiä DB-luku- ja kirjoitusoperaatioita. Jos useampi kirjoitus tapahtuu samanaikaisesti (esim. useita vastauksia nopeasti), päivitykset voivat mennä ristiin ja yhdistelmästä voi kadota.
  - Suositus: suorita lukeminen ja kirjoittaminen samalla IndexedDB-transaktiolla tai käytä optimistista versiota/kontrollia (version field tai compare-and-swap). Toinen vaihtoehto on serialisoida päivitykset per-peli (simple mutex tai queue).

- R2: DB-migraatioiden hallinta
  - Storejen luonti ja version bump -logiikka tulisi keskittää DB-initialisointiin. Varmista, että on selkeä upgrade-path ja siirrot (onupgradeneeded) käsitellään turvallisesti.

- R3: Epäselvä virhekäsittely ja fallback-logiikka
  - PeliPalvelu pitää in-memory-streakeja fallbackina jos DB-kirjaus epäonnistuu. Tämä voi johtaa eroon DB:n ja muistissa olevan tilan välillä.
  - Suositus: tee selkeä synkronointistrategia offline-tilalle tai näytä käyttäjälle virhe; älä jätä tilaa hiljaa epäjohdonmukaiseksi.

Keskitaso

- M1: Tallenna/Emit -apufunktio ja tapahtuma-API
  - `tallennaPelitapahtumaJaEmit` on hyvä DRY-parannus, mutta varmista että kaikki kutsujat tietävät milloin funktio heittää virheen ja milloin se vain lokalisoi.
  - Suositus: dokumentoi funktio ja paluuarvot; harkitse, pitäisikö emit tapahtua *vain* onnistuneen tallennuksen jälkeen (nyt se tapahtuu sen jälkeen — käytä varmuutta).

- M2: Skeeman tyyppirajaukset
  - Lisää `Streak`-tyyppi `src/lib/database/schema.ts`-tiedostoon, jotta TypeScript varmistaa oikean muodon käytön kaikkialla.

- M3: Event-namespace ja globalit CustomEventit
  - Käytössä on globaali CustomEvent `pelitapahtuma-uusi`. Tämä toimii, mutta voi aiheuttaa nimi- ja sidonnaisuusongelmia laajassa sovelluksessa.
  - Suositus: mieti event-emitter -abstraktiota tai rajattuja event-busseja (esim. per-component tai store-pohjainen Svelte store) testattavuuden parantamiseksi.

Matala prioriteetti

- L1: Koodin toisteisuus pelilogiikassa komponentissa
  - `PeliIkkuna.svelte` on suuri ja sisältää liiketoimintalogiikkaa suoraan komponentissa. Tämä tekee testaamisesta ja ylläpidosta haastavaa.
  - Suositus: erottele liiketoimintalogiikka erillisiin palveluihin tai moduleihin (esim. `peliController.ts`) ja pidä Svelte-komponentit esityskerrosmaisina.

- L2: Kommentointi ja dokumentaatio
  - Joissain uusissa metodeissa ja fallback-polkuissa dokumentointi puuttuu.

## Ehdotetut seuraavat askeleet

1. Suorita runtime smoke-testit: aja dev-server, pelaa peliä, toista peräkkäisiä vastauksia, lataa sivu uudelleen kesken pelin ja varmista, että streak säilyy.
2. Toteuta atominen streak-päivitys (keskitetty transaktio tai serialisointi per peli).
3. Lisää `Streak`-tyyppi `schema.ts` ja dokumentoi `tallennaPelitapahtumaJaEmit` käytös.
4. Harkitse tapahtuma-abstrahiota (Svelte store / event emitter) korvaamaan globaali CustomEvent.
5. Refaktoroi `PeliIkkuna.svelte` pienempiin osiin ja siirrä logiikka palveluihin.

## Muistiinpanot ja linkit

- Muutokset tehtiin tiedostoihin mm.:
  - `src/lib/database/database.ts` (uudet metodit ja `streaks`-store)
  - `src/lib/database/gameService.ts` (streak-logiikka integroituna)
  - `src/lib/components/PeliIkkuna.svelte` (useita save+emit -> helper -korvauksia)
  - `src/lib/components/AdminSivu.svelte` (vastaavat korvaukset)

Jos haluat, voin tehdä seuraavat muutokset automaattisesti: implementoida atomisen päivityksen, lisätä tyyppimäärityksen `Streak` tai refaktoroida `PeliIkkuna.svelte` palvelu+esitysjaoksi.

---
Tämän tiedoston on generoitu automaattisesti keskustelun yhteenvedon perusteella. Ota yhteyttä jos haluat muokkauksia tai käännöksen englanniksi.
