# Odlingsplaneraren — Grundplan

## Vad appen är
Ett **webbprogram på internet** — vem som helst öppnar en URL och ritar upp sin egen odling
i verkliga mått, placerar odlingsboxar och plantrader med korrekta växtavstånd, får varningar
(trängsel, dåliga grannar, skugga) och ett årsschema.
**Ingen AI, ingen server, inga konton** — varje användares trädgård sparas i den egna webbläsaren
(localStorage) och kan exporteras/importeras som fil för att dela eller flytta mellan enheter.

## Teknikval
| Del | Val | Motiv |
|---|---|---|
| Publicering | **GitHub Pages** (publikt repo) | Gratis, publik URL, deploy automatiskt vid varje push |
| UI-ramverk | **Svelte + Vite** | Litet, snabbt, lätt att läsa |
| Rityta | **Konva.js** (canvas) | Drag & drop, rotation, snap, zoom — beprövat |
| Språk | **TypeScript** | Typad växtdatabas och geometri = färre buggar |
| Lagring | localStorage + export/import av JSON-fil | Ingen server behövs, användaren äger sin data |
| PWA-manifest | Ja | Kan "installeras" på mobil/dator och funkar offline i trädgården |

Högerklicksmenyer byggs i appen (egen kontextmeny på canvasen) — fungerar i alla webbläsare.
Ritytan görs responsiv så den funkar på både dator och surfplatta/mobil (touch-drag).

## Koordinatsystem
- Allt lagras i **centimeter** (heltal). Ingen pixelmatte i datamodellen.
- **Snappgrid: 5 cm.** Allt (boxar, gångar, plantrader) snappar till 5 cm-rastret
  → symmetriska linjer och boxar kant-i-kant utan glapp.
- Zoom/panorering i ritytan; rastret ritas ljust, var 50 cm en tydligare linje, var 100 cm siffra.

## Datamodell (kärnan)
```ts
Garden      { widthCm, heightCm, sunDirection: grader (0=N), boxes: Box[] }
Box         { id, x, y, w, h, rotation?, typ: "odling"|"gång", fukt: "låg"|"medel"|"hög", label }
PlantRow    { id, boxId, plantId, count, x, y, rotationDeg, compression: 0.8–1.0 }
Plant       { id, namn, familj, avstand_cm, hojd_cm, vattenbehov, sol, tider..., grannar... }
```
- **PlantRow är enheten man drar** — en fyrkant, `count × avstånd` lång och `avstånd` bred.
  En enskild planta = rad med count 1.
- `compression` = användarens medvetna ihoptryckning (1.0 = fullt avstånd, 0.8 = 20 % trängre).

## Regler (regelmotorn, ren funktion av modellen)
1. **Boxar får inte överlappa** — kollisionskontroll vid drag/släpp; kant-mot-kant OK (snappet hjälper).
2. **Plantrader måste ligga helt i sin box**, får inte överlappa andra rader i boxen.
   - Ryms med 80–99 % av rek. avstånd → tillåts, **gul varning "trångt"**.
   - Under 80 % → blockeras.
3. **Avstånd/kompanjoner gäller bara inom samma box.** Två boxar mot varandra är ändå separata
   (olika bevattning). Boxens `fukt`-nivå jämförs mot växtens `vattenbehov` → varning vid mismatch.
4. **Kompanjoner:** dåliga grannar i samma box → röd varning; bra grannar → grön bock.
5. **Sol & skugga:** trädgården har en riktning (kompassros i hörnet).
   - Morgonsol ≈ öst, kvällssol ≈ väst, mitt på dagen ≈ syd.
   - Förenklad modell: en växt kastar skugga `hojd_cm × faktor` åt väst (morgon) resp. öst (kväll),
     och åt norr (mitt på dagen). Låga växter i skuggzonen från höga → varning
     ("Sallaten skuggas av tomaterna på förmiddagen") — eller grönt om växten gillar halvskugga.
   - Visualisering: tona skuggzoner när man slår på "visa skugga (morgon/middag/kväll)".

## Interaktioner
- **Rita box:** ange B×L i cm/m → spökrektangel följer musen, snappar, rött om overlap → klick placerar.
- **Högerklick på box:** Duplicera (hamnar snappad intill), Rotera 90°, Egenskaper (fukt, namn), Ta bort.
- **Plantrad:** välj växt + antal (t.ex. 20 rädisor) → drag in i box; handtag för rotation (snap 15°/90°);
  dra i änden för att ändra antal; högerklick → komprimera/duplicera/ta bort.
- **Flytta allt med drag & drop**, Ctrl+Z ångra, Delete tar bort markerat.

## Paneler
1. **Rityta** (störst) med kompassros och zoomkontroller.
2. **Verktyg/växtbibliotek** (vänster): sök, växter med färg + ø-avstånd.
3. **Varningar & tips** (höger): klick på varning markerar objektet i ritytan.
4. **Årsschema** (flik): genereras från frostdatum + planterade växter; export till fil.

## Milstolpar
- **M0 — Projektskelett:** Svelte + Vite + Konva igång, rityta med 5 cm-grid. Publikt repo på GitHub + Pages-deploy (appen ligger live från dag 1).
- **M1 — Boxar:** placera/flytta/duplicera (högerklick)/rotera boxar och gångar, snap, ingen overlap, spara/ladda fil.
- **M2 — Plantrader:** drag & drop av rader med rätt mått, rotation, komprimering 80–100 % med varning, avstånd mot boxkant/andra rader.
- **M3 — Regelmotor:** kompanjoner, fukt per box, varningspanel kopplad till ritytan.
- **M4 — Sol & skugga:** riktning, höjder, skuggzoner morgon/middag/kväll.
- **M5 — Årsschema & finputs:** kalender, export/import av trädgårdsfil, ångra/gör om, PWA (offline + installerbar).

## Växtdatabasen
Ligger kvar som egen JSON (dagens `plants.js` konverteras). Utökas löpande med fler växter;
fälten är redan definierade (avstånd, höjd, vatten, sol, tider relativt sista frost, grannar).
