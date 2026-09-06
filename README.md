# Swipe Review

Tinder-stijl CSV-leadreview. Importeer een leadlijst, swipe elk record naar
rechts (goedkeuren) of links (afkeuren), en exporteer de resultaten. Alles
gebeurt client-side — er is geen backend en er verlaat geen data je toestel.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open de getoonde `localhost`-URL. Wijzigingen worden live herladen.

## Build

```bash
npm run build
```

Dit zet een deploybare static build in `dist/` (inclusief PWA-manifest,
service worker en iconen). Testen van die build lokaal:

```bash
npm run preview
```

## Deployen

**Vercel**

```bash
npx vercel --prod
```

(of: koppel de repo in [vercel.com](https://vercel.com) — framework-preset
"Vite" wordt automatisch herkend, build command `npm run build`, output
directory `dist`.)

**Netlify**

```bash
npx netlify deploy --prod --dir=dist
```

(of: koppel de repo in [netlify.com](https://netlify.com) met build command
`npm run build` en publish directory `dist`.)

Beide platformen serveren de app via HTTPS, wat vereist is om de PWA
("Toevoegen aan beginscherm") te kunnen installeren.

## Installeren op je telefoon

**iOS (Safari)**

1. Open de gedeployde link in Safari.
2. Tik op het deel-icoon (vierkant met pijl omhoog) onderin.
3. Kies **Zet op beginscherm**.
4. De app opent voortaan als losstaande app, zonder browserbalk.

**Android (Chrome)**

1. Open de gedeployde link in Chrome.
2. Tik op het menu (⋮) rechtsboven.
3. Kies **App installeren** (of **Toevoegen aan startscherm**).
4. De app verschijnt als icoon op je startscherm.

Na installatie werkt het reviewen van een al geïmporteerde lijst ook zonder
internetverbinding — voortgang wordt lokaal opgeslagen (IndexedDB) en
overleeft het sluiten van de app of een refresh.

## Gebruik

1. **Importeren** — sleep een of meerdere CSV's op het scherm, of tik om te
   kiezen. Werkt met LinkedIn Sales Navigator-exports, Apollo-lijsten en
   generieke CSV's.
2. **Kolommen koppelen** — veelvoorkomende kolommen (naam, functie, bedrijf,
   locatie, LinkedIn URL, branche, bedrijfsgrootte, notities) worden
   automatisch herkend. Klopt iets niet, corrigeer het handmatig.
3. **Reviewen** — swipe de kaart naar rechts om goed te keuren, naar links om
   af te keuren. Op desktop werkt slepen met de muis; pijltjestoetsen en de
   ✕/✓-knoppen zijn de toegankelijke fallback. Cmd/Ctrl+Z (of de
   "Ongedaan"-knop) maakt de laatste beslissing ongedaan.
4. **Exporteren** — download `goedgekeurd.csv`, `afgekeurd.csv`, of één
   bestand met alle rijen plus een toegevoegde statuskolom. Kolomvolgorde en
   rijvolgorde blijven behouden.

## Techniek

- Vite + React + TypeScript
- Tailwind CSS 4 voor styling
- Framer Motion voor de swipe-gebaren (drag, rotatie, kleuroverlay, fly-out)
- PapaParse voor CSV-parsen/exporteren
- idb-keyval (IndexedDB) voor het bewaren van voortgang tussen sessies
- vite-plugin-pwa voor manifest + service worker (installeerbaar, offline
  reviewen na eerste bezoek)
