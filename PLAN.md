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
Box         { id, x, y, w, h, rotation?, typ: "odling"|"gång", label }
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
   (olika bevattning). Boxen har **ingen egen fuktinställning** — det är växterna som placeras
   som avgör hur fuktig boxen bör hållas: regelmotorn härleder boxens fuktprofil ur växternas
   `vattenbehov` och varnar när växter med olika behov blandas i samma box.
4. **Kompanjoner:** dåliga grannar i samma box → röd varning; bra grannar → grön bock.
5. **Sol & skugga:** trädgården har en riktning (kompassros i hörnet).
   - Morgonsol ≈ öst, kvällssol ≈ väst, mitt på dagen ≈ syd.
   - Förenklad modell: en växt kastar skugga `hojd_cm × faktor` åt väst (morgon) resp. öst (kväll),
     och åt norr (mitt på dagen). Låga växter i skuggzonen från höga → varning
     ("Sallaten skuggas av tomaterna på förmiddagen") — eller grönt om växten gillar halvskugga.
   - Visualisering: tona skuggzoner när man slår på "visa skugga (morgon/middag/kväll)".

## Interaktioner
- **Rita box:** ange B×L i cm/m → spökrektangel följer musen, snappar, rött om overlap → klick placerar.
- **Högerklick på box:** Duplicera (hamnar snappad intill), Rotera 90°, Namnge, Ta bort.
- **Lås layout:** när boxarna är på plats låser man layouten (🔒-knapp) → boxar kan inte flyttas,
  ändras eller tas bort av misstag under planteringen, och **all text på boxarna döljs**
  så den inte stör. Upplåsning med samma knapp.
- **Plantrad:** välj växt + antal (t.ex. 20 rädisor) → drag in i box; handtag för rotation (snap 15°/90°);
  dra i änden för att ändra antal; högerklick → komprimera/duplicera/ta bort.
- **Flytta allt med drag & drop**, Ctrl+Z ångra, Delete tar bort markerat.

## Paneler
1. **Rityta** (störst) med kompassros och zoomkontroller.
2. **Verktyg/växtbibliotek** (vänster): sök, växter med färg + ø-avstånd.
3. **Varningar & tips** (höger): klick på varning markerar objektet i ritytan.
4. **Årsschema** (flik): genereras från frostdatum + planterade växter; export till fil.
   - **Veckobaserat, inte datum.** Åtgärder grupperas per vecka och typ:
     `V 12 — Förså: tomat, basilika · Direktså: rädisa`
   - **Ingen skörd i schemat** — man skördar när man ser att det är färdigt.
     (`dagar_till_skord` behålls i växtdatan som upplysning per växt, men genererar inga schemarader.)

## Milstolpar
- **M0 — Projektskelett:** Svelte + Vite + Konva igång, rityta med 5 cm-grid. Publikt repo på GitHub + Pages-deploy (appen ligger live från dag 1).
- **M1 — Boxar:** placera/flytta/duplicera (högerklick)/rotera boxar och gångar, snap, ingen overlap, spara/ladda fil.
- **M2 — Plantrader:** drag & drop av rader med rätt mått, rotation, komprimering 80–100 % med varning, avstånd mot boxkant/andra rader.
- **M3 — Regelmotor:** kompanjoner och fukt per box. KLAR.

## M3 i detalj — fukt och kompanjoner

### Fuktkvot per odlingsruta (härledd, aldrig inställd)
Rutan har medvetet ingen egen fuktinställning. Det är **växterna som står i rutan som
avgör** hur fuktig den bör hållas. Varje växt har redan `vattenbehov` (låg/medel/hög).

Beräkning i `rules.ts`:
1. Samla `vattenbehov` för alla rader som står i rutan **samtidigt** (använd `staarIJord`
   — en rädisa som är skördad i maj ska inte styra bevattningen i augusti).
2. Vikta efter hur stor yta varje rad upptar, inte antal rader: en enda pumpa som täcker
   halva rutan väger tyngre än tre korta kryddrader.
3. Rutans rekommendation = det viktade läget, visas som en etikett på rutan
   ("Håll fuktig" / "Lagom" / "Låt torka upp mellan vattningar").
4. **Varning vid spridning:** finns både `låg` och `hög` i samma ruta går de inte att
   vattna rätt samtidigt — den ena ruttnar eller den andra torkar. Skillnaden `medel`
   mot `låg`/`hög` är en notering, inte en varning.

Exempel som ska falla ut: lök (låg) tillsammans med sallat (hög) i samma ruta ⇒ varning.
Lök tillsammans med morot (medel) ⇒ tyst.

### Kompanjoner — bra och dåliga grannar
Data finns redan (`bra_grannar` / `daliga_grannar`), men **saknar orsak**. Utan orsak kan
varningen bara säga "dåliga grannar", vilket inte hjälper någon att bedöma hur allvarligt
det är. Utöka därför datamodellen:

```ts
daliga_grannar: [{ id: "potatis", orsak: "sjukdom" }, ...]
```
Orsakstyper och hur långt de når:
| Orsak | Räckvidd | Exempel |
|---|---|---|
| `vatten` | samma ruta | lök + sallat |
| `sjukdom` | samma ruta **och** angränsande rutor | tomat + potatis (bladmögel) |
| `skadedjur` | samma ruta och angränsande | morot + dill (morotsfluga) |
| `konkurrens` | samma ruta | fänkål hämmar det mesta kemiskt |
| `rot` | samma ruta | grovrotade som stör rotfrukter |

Bra grannar ger en grön notering, inte en varning. Räckvidd "angränsande" definieras som
rutor vars kanter ligger inom ~50 cm från varandra.

### Uppdelning i koden
- `rules.ts` får `fuktVarningar(garden)` och `kompanjonVarningar(garden)`, båda rena
  funktioner precis som `skuggVarningar`.
- Rutans fuktetikett ritas i `GardenCanvas` när layouten är låst (som namnskyltarna).
- Allt hamnar i den befintliga varningspanelen med samma minimeringsbeteende.

### Medvetet utanför M3
Växtföljd mellan år (samma familj på samma plats två år i rad) kräver att odlingen sparas
per säsong — det hör hemma efter M5/M6 när flera odlingar kan finnas sparade.
- **M4 — Sol & skugga:** riktning, höjder, skuggzoner morgon/middag/kväll.
- **M5 — Årsschema & finputs:** kalender, export/import av trädgårdsfil, ångra/gör om, PWA (offline + installerbar).
- **M6 — Startsida & återfinning:** "Starta odlingen" med egen id, och ett sätt att hitta
  tillbaka till sin odling om webbläsarens data rensas. Se avsnittet nedan.

## Startsida och att hitta tillbaka till sin odling (M6, sist)
Varje användares odling lever redan isolerat: allt sparas i **deras egen webbläsare**
(localStorage), så två användare kan aldrig påverka varandras höjdjusteringar eller rutnamn.
Det som saknas är att kunna återfinna sin egen odling efter en rensning eller på en annan enhet.

Två vägar, båda utan server:
1. **Exportera/importera fil** — enklast och helt utan begränsningar i storlek.
2. **Delbar länk** — hela odlingen komprimeras och läggs i länkens adress. "Koden" blir
   alltså själva länken. Fungerar utan konto och utan att något lagras centralt, men
   begränsas av hur lång en adress får vara (stora odlingar kan bli för stora).

En kort kod av typen "ABC-123" som hämtar odlingen kräver att odlingarna lagras någonstans
centralt — alltså en server och därmed konton, drift och personuppgiftsansvar. Det ligger
utanför projektets premiss (ingen server, inga konton) och bör i så fall vara ett medvetet
eget beslut, inte något som smyger sig in.

## Idéer värda att ta efter (från odlis.se)
Odlis är en **guide som genererar en plan åt användaren** (ort → ytor → grödor → färdig plan).
Vår app är ett **ritverktyg där man placerar exakt** — olika produkter, men några av deras
grepp löser problem vi ändå har:

1. **Ort → klimatzon → frostdatum** (hög prioritet). Användaren söker sin ort och får zon +
   sista frost automatiskt, istället för att behöva veta sitt frostdatum. Ren uppslagstabell,
   ingen AI. Löser den enskilt viktigaste inputen för hela schemat (M5).
2. **Säsongskarta** — 12-månadersrutnät med färgade staplar per gröda
   (inomhussådd / direktsådd / utplantering). Visuellt komplement till veckolistan.
   OBS: skörd ska INTE vara med hos oss, enligt beslut ovan.
3. **"Denna vecka"-widget** — vad ska jag göra just nu, framhävt.
4. **Kategorifilter i växtlistan** (fruktgrönsaker, kålväxter, kryddor, lökväxter) — vi har
   redan `familj` i växtdatan och 39 växter gör listan lång.
5. **Estimerad totalskörd** för hela odlingen — vi har `skord_kg_per_m2`, summera per box/plan.
6. **Standardmått som snabbval** — pallkrage 120×80 m.fl. istället för att skriva mått varje gång.

Endast koncept/UX är av intresse — deras texter, växtdata och sortförslag är deras eget innehåll.

## Växtdatabasen
Ligger kvar som egen JSON (dagens `plants.js` konverteras). Utökas löpande med fler växter;
fälten är redan definierade (avstånd, höjd, vatten, sol, tider relativt sista frost, grannar).
