<script lang="ts">
  import { onMount } from "svelte";
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap, plantHeight } from "./lib/model";
  import { PLANTS, plantById, plantsPerM2, type Plant } from "./lib/plants";
  import { computeWarnings, type Warning } from "./lib/rules";
  import { computeSchedule, formateraDatum, ATGARD_RUBRIK, type Vecka, type Atgard } from "./lib/schedule";
  import { PLATSER, SASONGER, TIDER, MIN_SOLHOJD, platsByNamn } from "./lib/sun";
  import { uppskattadVarfrost, uppskattadHostfrost, sasongslangdDagar } from "./lib/klimat";
  import { skuggAnalys, type SkuggPost } from "./lib/shade";
  import { ORSAK_TEXT } from "./lib/companions";

  // let (inte const): omtilldelas efter mutationer så Svelte uppdaterar vyn
  let garden = loadGarden();
  let canvas: GardenCanvas;

  let warnings: Warning[] = computeWarnings(garden);
  let selection: { kind: "box" | "row"; id: number } | null = null;
  let placerar = false;
  let schema: Vecka[] = computeSchedule(garden);
  const ATGARDER: Atgard[] = ["forsa", "direktsa", "planteraUt"];

  function refreshWarnings() {
    warnings = computeWarnings(garden);
    schema = computeSchedule(garden);
  }

  function frostChanged() {
    saveGarden(garden);
    schema = computeSchedule(garden);
  }

  // --- sol & skugga ---
  let sol: { hojdGrader: number; azimutGrader: number; uppe: boolean } | null = null;
  function solChanged() {
    garden = garden;
    saveGarden(garden);
    canvas?.redraw();
    sol = canvas?.aktuellSol().sol ?? null;
    refreshWarnings(); // skuggvarningarna beror på tid, plats och väderstreck
  }
  function toggleSkugga() {
    garden.visaSkugga = !garden.visaSkugga;
    solChanged();
  }

  onMount(() => { sol = canvas?.aktuellSol().sol ?? null; });

  // --- skuggöversyn ---
  let visaSkuggoversyn = false;

  // --- export/utskrift ---
  // Ingen PDF-bibliotek behövs: en dold utskriftssektion fylls med en bild av
  // odlingen (fångad från canvasen i full storlek, inte bara det synliga
  // utsnittet) plus varningar och hela schemat, och webbläsarens vanliga
  // utskriftsdialog ("Spara som PDF") tar hand om resten.
  let exportBild = "";
  let exportDatum = "";
  function exportPlan() {
    exportBild = canvas?.exportImageDataUrl() ?? "";
    exportDatum = new Date().toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
    // ge Svelte en tick att sätta in bilden i DOM:en innan utskriftsdialogen öppnas
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }
  let skuggposter: SkuggPost[] = [];
  $: if (visaSkuggoversyn) skuggposter = skuggAnalys(garden);

  // --- startsida ---
  // Byte av ort föreslår nya frostdatum: säsongen i Kiruna är flera månader
  // kortare än i Malmö, och det ändrar hela årsschemat.
  function platsBytt() {
    const p = platsByNamn(garden.platsNamn);
    const ar = new Date(garden.sistaFrostDatum + "T12:00:00").getFullYear();
    garden.sistaFrostDatum = uppskattadVarfrost(p, ar);
    garden.forstaHostfrostDatum = uppskattadHostfrost(p, ar);
    garden = garden;
  }
  $: sasongslangd = sasongslangdDagar(garden.sistaFrostDatum, garden.forstaHostfrostDatum);

  let panelHopfalld = false;
  let schemaHopfalld = false;
  let panLage = false;
  let visaInstallningar = false;

  function startaOdlingen() {
    garden.uppsatt = true;
    applySize();
    saveGarden(garden);
    visaInstallningar = false;
    schema = computeSchedule(garden);
  }
  // Kompassen på startsidan använder samma vinkel som planen och skuggorna.
  let kompassSetupEl: HTMLDivElement;
  function vridSetupKompass(e: PointerEvent) {
    if (e.buttons !== 1 && e.type !== "pointerdown") return;
    const r = kompassSetupEl.getBoundingClientRect();
    const mx = r.left + r.width / 2, my = r.top + r.height / 2;
    const v = (Math.atan2(e.clientX - mx, my - e.clientY) * 180) / Math.PI;
    garden.sunDirectionDeg = Math.round(((v % 360) + 360) % 360);
    garden = garden;
  }

  // minimerade varningar (id → hopfälld)
  let collapsed: Record<string, boolean> = {};
  $: allCollapsed = warnings.length > 0 && warnings.every(w => collapsed[w.id]);
  function toggleWarning(id: string) {
    collapsed = { ...collapsed, [id]: !collapsed[id] };
  }
  function toggleAllWarnings() {
    const fäll = !allCollapsed;
    collapsed = Object.fromEntries(warnings.map(w => [w.id, fäll]));
  }

  let widthM = garden.widthCm / 100;
  let heightM = garden.heightCm / 100;

  // boxmått (meter)
  let boxW = 1.2;
  let boxH = 2.4;

  // plantering
  let selectedPlantId: string | null = null;
  let rowCount = 10;
  let plantFilter = "";
  $: filteredPlants = plantFilter.trim()
    ? PLANTS.filter(p => p.namn.toLowerCase().includes(plantFilter.trim().toLowerCase()))
    : PLANTS;

  function applySize() {
    garden.widthCm = snap(Math.max(100, widthM * 100));
    garden.heightCm = snap(Math.max(100, heightM * 100));
    widthM = garden.widthCm / 100;
    heightM = garden.heightCm / 100;
    saveGarden(garden);
    canvas.refresh();
  }

  function place(typ: "odling" | "gang") {
    selectedPlantId = null;
    canvas.startPlacing(typ, boxW * 100, boxH * 100);
  }

  function pickPlant(id: string) {
    selectedPlantId = id;
    canvas.startPlacingRow(id, rowCount);
  }

  // Måtten ska ändra den ruta som redan hänger i muspekaren, inte kräva att man
  // klickar på "Placera" igen. Rotationen behålls.
  function boxSizeChanged() {
    canvas?.updatePlacingSize(boxW * 100, boxH * 100);
  }
  function countChanged() {
    rowCount = Math.max(1, Math.round(rowCount || 1));
    canvas?.updatePlacingCount(rowCount);
  }

  // Under placering roterar knappen det som placeras — annars den markerade rutan.
  function rotateClicked() {
    canvas?.rotateAny();
  }

  let locked = garden.locked;
  function toggleLock() {
    locked = garden.locked = !garden.locked;
    saveGarden(garden);
    canvas.redraw();
  }

  function onCanvasChange() {
    // canvas kan saknas om komponenten hinner rapportera innan bindningen satts
    if (canvas && !canvas.isPlacingRow()) selectedPlantId = null;
    refreshWarnings();
  }

  function toggleLabels() {
    garden.showLabels = !garden.showLabels;
    garden = garden;
    saveGarden(garden);
    canvas.redraw();
  }

  // Höjdjustering (används av skuggberäkningen i M4)
  function setHeight(plantId: string, värde: number) {
    const h = Math.max(5, Math.min(400, Math.round(värde)));
    garden.plantHeights[plantId] = h;
    garden = garden;
    saveGarden(garden);
    canvas.redraw();
  }
  function resetHeight(plantId: string) {
    delete garden.plantHeights[plantId];
    garden = garden;
    saveGarden(garden);
    canvas.redraw();
  }

  // infokort
  let infoPlantId: string | null = null;
  $: infoPlant = infoPlantId ? plantById[infoPlantId] : null;

  const SOL_TEXT: Record<Plant["solbehov"], string> = {
    sol: "Full sol", halvskugga: "Halvskugga", skugga: "Skugga",
  };
  const VATTEN_TEXT: Record<Plant["vattenbehov"], string> = {
    "låg": "Lite", "medel": "Måttligt", "hög": "Mycket",
  };
  function densityText(p: Plant): string {
    const perM2 = plantsPerM2(p);
    if (perM2 >= 1) return `${Math.round(perM2)} st/m²`;
    const areaPerPlant = Math.round((1 / perM2) * 10) / 10;
    return `1 st/${areaPerPlant} m²`;
  }
</script>

{#if !garden.uppsatt || visaInstallningar}
  <div class="setup">
    <div class="setupkort">
      <h1>🌱 Odlingsplaneraren</h1>
      <p class="ingress">
        Rita upp din odling i verkliga mått, placera växter med rätt avstånd och få
        varningar om trängsel och skugga – plus ett årsschema för sådd och utplantering.
      </p>

      <div class="falt">
        <label>Hur stor är odlingen?
          <span class="matt">
            <input type="number" bind:value={widthM} min="1" max="100" step="0.5" /> ×
            <input type="number" bind:value={heightM} min="1" max="100" step="0.5" /> m
          </span>
        </label>

        <label>Närmaste ort
          <select bind:value={garden.platsNamn} on:change={platsBytt}>
            {#each PLATSER as p}<option value={p.namn}>{p.namn}</option>{/each}
          </select>
          <small>Ger solens höjd, skuggornas längd och förslag på frostdatum.</small>
        </label>

        <div class="frostpar">
          <label>Sista vårfrost
            <input type="date" bind:value={garden.sistaFrostDatum} />
          </label>
          <label>Första höstfrost
            <input type="date" bind:value={garden.forstaHostfrostDatum} />
          </label>
        </div>
        <small class="frosthjalp">
          Säsongen blir {sasongslangd} dagar lång. Datumen är uppskattade ur ortens
          latitud – justera dem gärna, ett frosthål eller ett kustnära läge kan skilja
          flera veckor från grannbyn.
        </small>
      </div>

      <div class="kompassfalt">
        <div class="kompass-setup" bind:this={kompassSetupEl}
             on:pointerdown={vridSetupKompass} on:pointermove={vridSetupKompass}>
          <div class="ros-setup" style="transform: rotate({-garden.sunDirectionDeg}deg)">
            <span class="v n">N</span><span class="v o">Ö</span>
            <span class="v s">S</span><span class="v va">V</span>
            <span class="nal"></span>
          </div>
        </div>
        <div>
          <strong>Vrid kompassen så norr stämmer</strong>
          <p>
            Dra i kompassen tills norr pekar åt samma håll som i verkligheten, sett
            uppifrån din odling. Det är det enda solen behöver veta – skuggorna räknas
            sedan ut åt rätt håll automatiskt.
          </p>
          <span class="riktning">Norr ligger {garden.sunDirectionDeg}° medurs från uppåt</span>
        </div>
      </div>

      <button class="starta" on:click={startaOdlingen}>
        {garden.uppsatt ? "Spara och tillbaka till odlingen" : "Starta odlingen →"}
      </button>
      {#if visaInstallningar}
        <button class="linkbtn mitten-lank" on:click={() => visaInstallningar = false}>Avbryt</button>
      {/if}
    </div>
  </div>
{:else}
<header>
  <h1>🌱 Odlingsplaneraren</h1>
  <div class="controls">
    <!-- Grunduppgifterna är låsta efter uppstart: ändras de mitt i planeringen
         skalas hela vyn om och man tappar bort sig. -->
    <span class="fast">{garden.widthCm / 100} × {garden.heightCm / 100} m</span>
    <span class="fast">📍 {garden.platsNamn}</span>
    <span class="fast" title="Sista vårfrost → första höstfrost">
      ❄ {garden.sistaFrostDatum} → {garden.forstaHostfrostDatum}
    </span>
    <button class="installningar" on:click={() => visaInstallningar = true}>⚙ Ändra</button>
    <button class="installningar" on:click={exportPlan}>📄 Exportera / Skriv ut</button>
  </div>
</header>

<div class="toolbar">
  {#if !locked}
    <label>Ruta/gång:
      <input type="number" bind:value={boxW} min="0.2" max="20" step="0.1" on:input={boxSizeChanged} /> ×
      <input type="number" bind:value={boxH} min="0.2" max="20" step="0.1" on:input={boxSizeChanged} /> m
    </label>
    <button on:click={() => place("odling")}>🟫 Placera odlingsruta</button>
    <button on:click={() => place("gang")}>▨ Placera gång</button>
  {/if}
  <button class="lock" class:on={locked} on:click={toggleLock}>
    {locked ? "🔒 Layout låst" : "🔓 Lås layout"}
  </button>

  <span class="sep"></span>

  <button on:click={rotateClicked} disabled={!selection && !placerar}
          title="Roterar det du håller på att placera, annars markerad ruta eller rad">
    ⟳ Rotera{placerar ? "" : selection ? (selection.kind === "box" ? " rutan" : " raden") : ""}
  </button>
  <button on:click={() => canvas.deleteSelection()} disabled={!selection}>🗑 Ta bort</button>
  <button class:on={garden.showLabels} on:click={toggleLabels}>🏷 Namnskyltar</button>
  <button class:on={garden.visaSkugga} on:click={toggleSkugga}>☀️ Skuggor</button>
  <button class:on={panLage} on:click={() => panLage = !panLage}
          title="I panoreringsläge kan du dra runt och zooma utan att råka flytta växter eller rutor">
    {panLage ? "🖐 Panorerar" : "🖐 Panorera"}
  </button>

  <span class="hint">
    {#if !selection}
      Klicka på en ruta eller rad för att markera den.
    {:else if selection.kind === "box"}
      Odlingsruta markerad — roteras med sina växter.
    {:else}
      Plantrad markerad — högerklicka för antal och utglesning.
    {/if}
  </span>
</div>

<main>
  <aside>
    <div class="asidehead">
      <h2>Växter</h2>
      <input class="search" type="search" placeholder="Sök växt…" bind:value={plantFilter} />
      <label class="countrow">Antal i raden:
        <input type="number" bind:value={rowCount} min="1" max="200" on:input={countChanged} />
      </label>
    </div>
    <div class="plantlist">
      {#each filteredPlants as p}
        <div class="pcard" class:active={selectedPlantId === p.id}>
          <button class="pcard-main" on:click={() => pickPlant(p.id)} title="Plantera {p.namn}">
            <span class="picon" style="background:{p.farg}22; border-color:{p.farg}">{p.symbol}</span>
            <span class="pinfo">
              <span class="pnamn">{p.namn}</span>
              <span class="pmeta">
                {p.avstand_i_rad_cm}×{p.radavstand_cm} cm · {plantHeight(garden, p.id, p.hojd_cm)} cm hög
                {#if garden.plantHeights[p.id]}<em>✎</em>{/if}
              </span>
            </span>
          </button>
          <button class="pcard-info" on:click={() => infoPlantId = p.id}
                  title="Info om {p.namn}" aria-label="Info om {p.namn}">ⓘ</button>
        </div>
      {:else}
        <p class="asidehint">Ingen växt matchar "{plantFilter}".</p>
      {/each}
    </div>
    <p class="asidehint">
      Välj växt → klicka i en odlingsruta. <b>R</b> roterar innan placering.
    </p>
  </aside>
  <div class="mitten">
    <!-- Tidpunkten styr både skuggorna och vilka rader som står i jorden,
         så raden visas alltid – annars vet man inte varför en rad är överstruken. -->
    <div class="solrad">
        <!-- Orten sätts vid uppstart och ändras via inställningarna. -->
        <button class="oversyn" on:click={() => visaSkuggoversyn = true}>🔎 Skuggöversyn</button>

        <span class="grupp">
          {#each SASONGER as s}
            <button class:on={garden.solSasong === s.id}
                    on:click={() => { garden.solSasong = s.id; solChanged(); }}>{s.namn}</button>
          {/each}
        </span>

        <span class="grupp">
          {#each TIDER as t}
            <button class:on={garden.solTimme === t.timme}
                    on:click={() => { garden.solTimme = t.timme; solChanged(); }}>
              {t.namn} {t.timme}
            </button>
          {/each}
        </span>

        <label class="skjut">
          <input type="range" min="4" max="22" step="1"
                 bind:value={garden.solTimme} on:input={solChanged} />
          <span class="klocka">{String(garden.solTimme).padStart(2, "0")}:00</span>
        </label>

        {#if sol && garden.visaSkugga}
          <span class="solinfo">
            {#if !sol.uppe || sol.hojdGrader <= MIN_SOLHOJD}
              Solen står för lågt – ingen meningsfull skugga
            {:else}
              Solhöjd {Math.round(sol.hojdGrader)}° · solen i
              {#if sol.azimutGrader < 67.5}nordost{:else if sol.azimutGrader < 112.5}öster
              {:else if sol.azimutGrader < 157.5}sydost{:else if sol.azimutGrader < 202.5}söder
              {:else if sol.azimutGrader < 247.5}sydväst{:else if sol.azimutGrader < 292.5}väster
              {:else}nordväst{/if}
            {/if}
          </span>
        {/if}
      </div>
    <GardenCanvas bind:this={canvas} {garden} {panLage} onchange={onCanvasChange}
                  onselect={(s) => selection = s}
                  onplacing={(p) => placerar = p} />
  </div>

  <!-- Panelen ligger alltid kvar: dyker den upp och försvinner ändras ritytans
       bredd, och vyn skalas om mitt i att man vrider kompassen. -->
  <section class="warnpanel" class:hopfalld={panelHopfalld}>
    {#if panelHopfalld}
      <button class="panelflik" on:click={() => panelHopfalld = false}
              title="Visa varningar och noteringar">
        ◀ <span class="flikcount" class:tom={warnings.length === 0}>{warnings.length}</span>
      </button>
    {:else}
      <div class="warnhead-row">
        <h2>Varningar &amp; noteringar <span class="count">{warnings.length}</span></h2>
        <button class="panelmin" on:click={() => panelHopfalld = true} title="Minimera panelen">▶</button>
      </div>
      {#if warnings.length === 0}
        <p class="asidehint">Inga varningar – allt ser bra ut.</p>
      {:else}
        <button class="linkbtn" on:click={toggleAllWarnings}>
          {allCollapsed ? "Visa alla" : "Minimera alla"}
        </button>
      {/if}
      {#each warnings as w}
        <div class="warn" class:info={w.niva === "info"} class:collapsed={collapsed[w.id]}>
          <div class="warnrow">
            <button class="warnhead" on:click={() => w.rowId != null && canvas.selectRow(w.rowId)}>
              {w.niva === "varning" ? "⚠" : "ℹ"} {w.rubrik}
            </button>
            <button class="minbtn" on:click={() => toggleWarning(w.id)}
                    title={collapsed[w.id] ? "Visa förklaring" : "Minimera"}
                    aria-label={collapsed[w.id] ? "Visa förklaring" : "Minimera"}>
              {collapsed[w.id] ? "+" : "−"}
            </button>
          </div>
          {#if !collapsed[w.id]}
            <span class="warntext">{w.text}</span>
          {/if}
        </div>
      {/each}
    {/if}
  </section>
</main>

<section class="schema" class:hopfalld={schemaHopfalld}>
  <div class="schema-head">
    <button class="schema-toggle" on:click={() => schemaHopfalld = !schemaHopfalld}
            title={schemaHopfalld ? "Visa årsschemat" : "Minimera årsschemat"}>
      {schemaHopfalld ? "▲" : "▼"}
    </button>
    <h2>Årsschema — vad gör jag när?</h2>
    {#if !schemaHopfalld}
      <span class="schema-hint">
        Veckorna räknas från sista vårfrost ({garden.sistaFrostDatum}). Skörd står inte med –
        den sker när grödan ser färdig ut, inte efter kalender.
      </span>
    {/if}
  </div>

  {#if !schemaHopfalld}
    {#if schema.length === 0}
      <p class="schema-tom">Plantera något i odlingen så byggs schemat upp här automatiskt.</p>
    {:else}
      <div class="schema-scroll">
        <table>
          <thead>
            <tr>
              <th class="vkol">Vecka</th>
              {#each ATGARDER as a}<th>{ATGARD_RUBRIK[a]}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each schema as v}
              <tr>
                <td class="vkol">
                  <strong>V {v.vecka}</strong>
                  <span class="vdatum">{formateraDatum(v.datum)}</span>
                </td>
                {#each ATGARDER as a}
                  <td>
                    {#if v.atgarder[a].length}
                      {#each v.atgarder[a] as post}
                        <span class="chip {a}">{post.text}</span>
                      {/each}
                    {:else}
                      <span class="tomcell">–</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</section>
{/if}

{#if visaSkuggoversyn}
  <div class="modal-backdrop" on:click={() => visaSkuggoversyn = false}>
    <div class="modal-card bred" on:click|stopPropagation>
      <button class="modal-close" on:click={() => visaSkuggoversyn = false} aria-label="Stäng">✕</button>
      <h3>🔎 Skuggöversyn</h3>
      <p class="modal-desc">
        Varje rad har följts timme för timme genom dygnet, vid alla fyra säsonger.
        Timmarna vägs med solens styrka – en skugga mitt på dagen kostar mycket ljus,
        samma skugga sent på kvällen nästan inget. Här visas den säsong då raden
        har det sämst.
      </p>

      {#if skuggposter.length === 0}
        <p class="asidehint">Inga plantrader att analysera ännu.</p>
      {:else}
        <div class="oversyn-scroll">
          <table class="oversyntabell">
            <thead>
              <tr>
                <th>Rad</th><th>Vill ha</th><th>Sol/dag</th>
                <th>Ljus som skuggas bort</th><th>Sämst vid</th><th>Skuggas mest av</th>
              </tr>
            </thead>
            <tbody>
              {#each skuggposter as p}
                <tr class:brist={!p.farSolNog}>
                  <td><strong>{p.antal} × {p.namn}</strong></td>
                  <td>{p.solbehov} ({p.kravTimmar} h)</td>
                  <td>
                    <span class="timmar" class:ok={p.farSolNog}>{p.soltimmar} h</span>
                  </td>
                  <td>
                    <span class="stapel"><span class="fyllnad" style="width:{Math.round(p.ljusforlust * 100)}%"></span></span>
                    {Math.round(p.ljusforlust * 100)} %
                  </td>
                  <td>{p.sasongNamn}</td>
                  <td>
                    {#if p.kallor.length}
                      {p.kallor.slice(0, 2).map(k => `${k.namn} (${Math.round(k.andel * 100)} %)`).join(", ")}
                    {:else}
                      <span class="tomcell">–</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="asidehint fotnot">
          Bara växternas egna skuggor räknas. Hus, staket, häckar och träd utanför
          odlingen påverkar minst lika mycket men finns inte i modellen.
        </p>
      {/if}
    </div>
  </div>
{/if}

<svelte:window on:keydown={(e) => {
  if (e.key !== "Escape") return;
  if (infoPlantId) infoPlantId = null;
  else if (visaSkuggoversyn) visaSkuggoversyn = false;
}} />

{#if infoPlant}
  <div class="modal-backdrop" on:click={() => infoPlantId = null}>
    <div class="modal-card" on:click|stopPropagation>
      <button class="modal-close" on:click={() => infoPlantId = null} aria-label="Stäng">✕</button>
      <div class="modal-head">
        <span class="modal-icon" style="background:{infoPlant.farg}22">{infoPlant.symbol}</span>
        <h3>{infoPlant.namn}</h3>
      </div>
      <p class="modal-desc">{infoPlant.beskrivning}</p>
      <div class="statgrid">
        <div class="stat"><span class="statlabel">☀️ Sol</span><span>{SOL_TEXT[infoPlant.solbehov]}</span></div>
        <div class="stat"><span class="statlabel">💧 Vatten</span><span>{VATTEN_TEXT[infoPlant.vattenbehov]}</span></div>
        <div class="stat"><span class="statlabel">⛰️ Jord</span><span>{infoPlant.jord}</span></div>
        <div class="stat"><span class="statlabel">📏 Täthet</span><span>{densityText(infoPlant)}</span></div>
        <div class="stat">
          <span class="statlabel">↔ Avstånd</span>
          <span>{infoPlant.avstand_i_rad_cm} cm i raden<br />{infoPlant.radavstand_cm} cm mellan rader</span>
        </div>
        <div class="stat">
          <span class="statlabel">⚖️ Skörd</span>
          <span>{infoPlant.skord_kg_per_m2 != null ? `${infoPlant.skord_kg_per_m2} kg/m²` : "Prydnadsväxt"}</span>
        </div>
        <div class="stat"><span class="statlabel">🕐 Skördetid</span><span>~{infoPlant.dagar_till_skord} dagar</span></div>
      </div>

      {#if infoPlant.avstand_notering}
        <p class="notering">ℹ️ {infoPlant.avstand_notering}</p>
      {/if}

      <div class="heightbox">
        <span class="statlabel">📐 Höjd — påverkar skuggberäkningen</span>
        <div class="heightrow">
          <input type="range" min="5" max="250" step="5"
                 value={plantHeight(garden, infoPlant.id, infoPlant.hojd_cm)}
                 on:input={(e) => setHeight(infoPlant.id, +e.currentTarget.value)} />
          <input type="number" min="5" max="400" step="5"
                 value={plantHeight(garden, infoPlant.id, infoPlant.hojd_cm)}
                 on:change={(e) => setHeight(infoPlant.id, +e.currentTarget.value)} />
          <span class="unit">cm</span>
        </div>
        {#if garden.plantHeights[infoPlant.id]}
          <button class="linkbtn" on:click={() => resetHeight(infoPlant.id)}>
            Återställ till standard ({infoPlant.hojd_cm} cm)
          </button>
        {/if}
      </div>
      {#if infoPlant.bra_grannar.length}
        <div class="companions">
          <h4 class="good">👍 Bra grannar</h4>
          <div class="tags">
            {#each infoPlant.bra_grannar as id}
              {#if plantById[id]}
                <button class="tag" on:click={() => infoPlantId = id}>{plantById[id].symbol} {plantById[id].namn}</button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
      {#if infoPlant.daliga_grannar.length}
        <div class="companions">
          <h4 class="bad">👎 Dåliga grannar</h4>
          <div class="tags">
            {#each infoPlant.daliga_grannar as d}
              {#if plantById[d.id]}
                <button class="tag" on:click={() => infoPlantId = d.id}
                        title="Undvik: {ORSAK_TEXT[d.orsak]}">
                  {plantById[d.id].symbol} {plantById[d.id].namn}
                  <span class="orsak">{d.orsak}</span>
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Osynlig i vanligt läge, visas bara via @media print (se print-export-CSS).
     Innehåller alltid HELA schemat och alla varningar oavsett vad som är
     minimerat på skärmen, så exporten inte tappar information. -->
<div class="print-export">
  <h1>🌱 {garden.widthCm / 100}×{garden.heightCm / 100} m odling — {garden.platsNamn}</h1>
  <p class="print-meta">
    Exporterad {exportDatum} · Sista vårfrost {garden.sistaFrostDatum} ·
    Första höstfrost {garden.forstaHostfrostDatum}
  </p>

  {#if exportBild}
    <img class="print-img" src={exportBild} alt="Karta över odlingen" />
  {/if}

  <h2>Varningar &amp; noteringar</h2>
  {#if warnings.length === 0}
    <p>Inga varningar – allt ser bra ut.</p>
  {:else}
    <ul class="print-warnlist">
      {#each warnings as w}
        <li>
          <strong>{w.niva === "varning" ? "⚠" : "ℹ"} {w.rubrik}</strong>
          <span>{w.text}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <h2>Årsschema — vad gör jag när?</h2>
  {#if schema.length === 0}
    <p>Inga planterade rader ännu.</p>
  {:else}
    <table class="print-schema">
      <thead>
        <tr>
          <th>Vecka</th>
          {#each ATGARDER as a}<th>{ATGARD_RUBRIK[a]}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each schema as v}
          <tr>
            <td>V {v.vecka}<br /><small>{formateraDatum(v.datum)}</small></td>
            {#each ATGARDER as a}
              <td>{v.atgarder[a].length ? v.atgarder[a].map(p => p.text).join(", ") : "–"}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  header {
    background: #4e7a3a; color: #fff; padding: 10px 18px;
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
  }
  h1 { font-size: 1.15rem; margin: 0; }
  .controls { display: flex; align-items: center; gap: 14px; font-size: 0.9rem; flex-wrap: wrap; }
  header input { width: 60px; border: none; border-radius: 4px; padding: 4px 6px; }
  header input.date { width: auto; }
  .toolbar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 8px 18px; background: #fff; border-bottom: 1px solid #d8d2c4; font-size: 0.85rem;
  }
  .toolbar input { width: 55px; border: 1px solid #d8d2c4; border-radius: 4px; padding: 4px 6px; }
  .toolbar button {
    border: 1px solid #d8d2c4; border-radius: 6px; background: #faf8f3;
    padding: 6px 12px; cursor: pointer; font-size: 0.85rem;
  }
  .toolbar button:hover:not(:disabled) { background: #eaf2e3; }
  .toolbar button:disabled { opacity: 0.45; cursor: default; }
  .toolbar button.lock.on { background: #2e5d1e; color: #fff; border-color: #2e5d1e; }
  .toolbar button.on { background: #2e5d1e; color: #fff; border-color: #2e5d1e; }
  .sep { width: 1px; height: 22px; background: #e0d9c8; }
  .hint { color: #8a8371; font-size: 0.75rem; }

  main { flex: 1; padding: 12px; min-height: 0; display: flex; gap: 12px; }
  .mitten { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .solrad {
    flex: none; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: #fff; border: 1px solid #d8d2c4; border-radius: 8px;
    padding: 7px 10px; font-size: 0.8rem;
  }
  .solrad select {
    border: 1px solid #d8d2c4; border-radius: 5px; padding: 4px 6px; font-size: 0.8rem;
  }
  .grupp { display: flex; gap: 4px; }
  .solrad button {
    border: 1px solid #d8d2c4; border-radius: 6px; background: #faf8f3;
    padding: 4px 10px; cursor: pointer; font-size: 0.78rem;
  }
  .solrad button:hover { background: #eaf2e3; }
  .solrad button.on { background: #e8a33d; color: #fff; border-color: #e8a33d; }
  .skjut { display: flex; align-items: center; gap: 6px; }
  .skjut input { width: 110px; }
  .klocka { font-variant-numeric: tabular-nums; color: #6d6757; }
  .solinfo { color: #8a6d00; margin-left: auto; }
  .oversyn {
    border: 1px solid #d8d2c4; border-radius: 6px; background: #faf8f3;
    padding: 4px 12px; cursor: pointer; font-size: 0.78rem; font-weight: 600;
  }
  .oversyn:hover { background: #eaf2e3; }

  .modal-card.bred { width: 720px; max-width: 100%; }
  .oversyn-scroll { overflow-x: auto; }
  .oversyntabell { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
  .oversyntabell th, .oversyntabell td {
    border-bottom: 1px solid #eee5d3; padding: 6px 8px; text-align: left; white-space: nowrap;
  }
  .oversyntabell th {
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; color: #8a8371;
  }
  .oversyntabell tr.brist { background: #fdf7e6; }
  .timmar { font-weight: 700; color: #b3402a; }
  .timmar.ok { color: #3d6b28; }
  .stapel {
    display: inline-block; width: 60px; height: 7px; border-radius: 4px;
    background: #eee5d3; vertical-align: middle; margin-right: 6px; overflow: hidden;
  }
  .fyllnad { display: block; height: 100%; background: #e6a700; }
  .fotnot { margin-top: 10px; }
  aside {
    width: 220px; flex: none; background: #fff; border: 1px solid #d8d2c4;
    border-radius: 8px; padding: 12px; display: flex; flex-direction: column; min-height: 0;
  }
  aside h2 { font-size: 0.95rem; margin: 0 0 8px; }
  .asidehead { flex: none; }
  .search {
    width: 100%; border: 1px solid #d8d2c4; border-radius: 4px; padding: 5px 8px;
    margin-bottom: 8px; font-size: 0.83rem; box-sizing: border-box;
  }
  .countrow { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; margin-bottom: 8px; }
  .countrow input { width: 60px; border: 1px solid #d8d2c4; border-radius: 4px; padding: 4px 6px; }
  .plantlist {
    display: flex; flex-direction: column; flex: 1; min-height: 60px;
    overflow-y: auto; border-top: 1px solid #eee5d3; border-bottom: 1px solid #eee5d3;
    padding: 4px 0; margin-bottom: 8px;
  }
  .pcard {
    display: flex; align-items: stretch; gap: 0; margin: 3px 0; flex: none;
    border: 1px solid #d8d2c4; border-radius: 10px; background: #faf8f3; overflow: hidden;
  }
  .pcard:hover { background: #eaf2e3; }
  .pcard.active { outline: 2px solid #4e7a3a; background: #eaf2e3; }
  .pcard-main {
    display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
    text-align: left; padding: 8px 6px 8px 8px; border: none; background: none; cursor: pointer;
  }
  .picon {
    width: 38px; height: 38px; flex: none; border-radius: 10px; border: 2px solid;
    display: flex; align-items: center; justify-content: center; font-size: 1.35rem;
  }
  .pinfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .pnamn { font-size: 0.88rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pmeta { font-size: 0.7rem; color: #8a8371; }
  .pmeta em { color: #4e7a3a; font-style: normal; }
  .pcard-info {
    flex: none; width: 30px; border: none; border-left: 1px solid #e6dfd0;
    background: none; cursor: pointer; font-size: 0.9rem; color: #a89d87;
  }
  .pcard-info:hover { background: #4e7a3a; color: #fff; }
  .asidehint { font-size: 0.72rem; color: #77705f; line-height: 1.4; flex: none; }

  .warnpanel {
    width: 250px; flex: none; background: #fff; border: 1px solid #d8d2c4;
    border-radius: 8px; padding: 12px; overflow-y: auto; display: flex;
    flex-direction: column; gap: 6px;
  }
  .warnpanel.hopfalld { width: 34px; padding: 6px 2px; align-items: center; overflow: hidden; }
  .panelflik {
    border: none; background: none; cursor: pointer; color: #6d6757;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    font-size: 0.8rem; padding: 4px 0; width: 100%;
  }
  .flikcount {
    background: #e6a700; color: #fff; border-radius: 10px;
    padding: 1px 6px; font-size: 0.7rem; font-weight: 700;
  }
  .flikcount.tom { background: #d8d2c4; color: #6d6757; }
  .panelmin {
    border: none; background: none; cursor: pointer; color: #a89d87;
    font-size: 0.75rem; padding: 2px 4px;
  }
  .panelmin:hover { color: #4e7a3a; }

  /* ---- startsida ---- */
  .setup {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 24px; overflow-y: auto;
  }
  .setupkort {
    background: #fff; border: 1px solid #d8d2c4; border-radius: 14px;
    padding: 28px; max-width: 560px; width: 100%; box-shadow: 0 4px 24px #0001;
  }
  .setupkort h1 { font-size: 1.5rem; margin: 0 0 6px; }
  .ingress { font-size: 0.88rem; color: #6d6757; line-height: 1.55; margin: 0 0 20px; }
  .falt { display: flex; flex-direction: column; gap: 14px; }
  .falt label { display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; font-weight: 600; }
  .falt small { font-weight: 400; color: #8a8371; font-size: 0.74rem; }
  .falt input, .falt select {
    border: 1px solid #d8d2c4; border-radius: 6px; padding: 7px 9px; font-size: 0.9rem;
  }
  .matt { display: flex; align-items: center; gap: 8px; }
  .frostpar { display: flex; gap: 12px; }
  .frostpar label { flex: 1; }
  .frosthjalp { font-size: 0.74rem; color: #8a8371; line-height: 1.45; }
  .matt input { width: 90px; }
  .kompassfalt {
    display: flex; gap: 16px; align-items: flex-start;
    margin: 20px 0; padding: 14px; background: #faf8f3;
    border: 1px solid #eee5d3; border-radius: 10px;
  }
  .kompassfalt strong { font-size: 0.85rem; }
  .kompassfalt p { font-size: 0.78rem; color: #6d6757; line-height: 1.5; margin: 4px 0 6px; }
  .riktning { font-size: 0.74rem; color: #8a8371; }
  .kompass-setup {
    position: relative; flex: none; width: 96px; height: 96px; border-radius: 50%;
    background: #fff; border: 1px solid #d8d2c4; cursor: grab; touch-action: none;
  }
  .kompass-setup:active { cursor: grabbing; }
  .ros-setup { position: absolute; inset: 0; }
  .ros-setup .v {
    position: absolute; left: 50%; top: 50%; font-size: 0.72rem; font-weight: 700; color: #8a8371;
  }
  .ros-setup .n  { transform: translate(-50%, -50%) translateY(-36px); color: #b3402a; }
  .ros-setup .s  { transform: translate(-50%, -50%) translateY(36px); }
  .ros-setup .o  { transform: translate(-50%, -50%) translateX(36px); }
  .ros-setup .va { transform: translate(-50%, -50%) translateX(-36px); }
  .ros-setup .nal {
    position: absolute; left: 50%; top: 16px; width: 3px; height: 32px;
    background: linear-gradient(#b3402a 0 60%, #c9c1ae 60% 100%);
    transform: translateX(-50%); border-radius: 2px;
  }
  .starta {
    width: 100%; border: none; border-radius: 8px; background: #4e7a3a; color: #fff;
    padding: 12px; font-size: 0.95rem; font-weight: 600; cursor: pointer;
  }
  .starta:hover { background: #3f6430; }
  .mitten-lank { display: block; margin: 8px auto 0; }
  .fast {
    background: #ffffff26; border-radius: 5px; padding: 3px 8px; font-size: 0.82rem;
  }
  .installningar {
    border: 1px solid #ffffff55; border-radius: 6px; background: #ffffff1a;
    color: #fff; padding: 4px 10px; cursor: pointer; font-size: 0.8rem;
  }
  .installningar:hover { background: #ffffff33; }
  .warnpanel h2 { font-size: 0.95rem; margin: 0; }
  .warnhead-row {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 8px; margin-bottom: 4px;
  }
  .count {
    background: #e6ddc8; color: #6d6757; border-radius: 10px;
    padding: 1px 7px; font-size: 0.72rem; font-weight: 600;
  }
  .warn {
    border: 1px solid #f0d9a0; background: #fdf7e6;
    border-radius: 8px; padding: 6px 8px;
    display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;
  }
  .warn.info { border-color: #cfe0c4; background: #f3f8ef; }
  .warnrow { display: flex; align-items: flex-start; gap: 6px; }
  .warnhead {
    flex: 1; text-align: left; border: none; background: none; cursor: pointer;
    font-weight: 600; color: #8a6d00; font-size: 0.78rem; padding: 0; line-height: 1.35;
  }
  .warnhead:hover { text-decoration: underline; }
  .warn.info .warnhead { color: #3d6b28; }
  .minbtn {
    flex: none; width: 20px; height: 20px; border: 1px solid #e0d4b0;
    border-radius: 4px; background: #fff; cursor: pointer;
    font-size: 0.85rem; line-height: 1; color: #8a8371; padding: 0;
  }
  .minbtn:hover { background: #f0e6cc; }
  .warn.info .minbtn { border-color: #cfe0c4; }
  .warntext { color: #6d6757; line-height: 1.45; }

  .notering {
    font-size: 0.75rem; color: #5f5a4b; line-height: 1.45; margin: 0 0 10px;
    background: #f6f2e7; border-left: 3px solid #d8c9a0; border-radius: 0 5px 5px 0;
    padding: 7px 10px;
  }
  .heightbox {
    border: 1px solid #eee5d3; border-radius: 8px; padding: 8px 10px;
    background: #faf8f3; margin-bottom: 4px;
  }
  .heightrow { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .heightrow input[type=range] { flex: 1; min-width: 0; }
  .heightrow input[type=number] {
    width: 62px; border: 1px solid #d8d2c4; border-radius: 4px; padding: 4px 6px; font-size: 0.83rem;
  }
  .unit { font-size: 0.78rem; color: #8a8371; }
  .linkbtn {
    border: none; background: none; color: #4e7a3a; cursor: pointer;
    font-size: 0.74rem; padding: 4px 0 0; text-decoration: underline;
  }

  /* ---- årsschema ---- */
  .schema {
    flex: none; margin: 0 12px 12px; background: #fff; border: 1px solid #d8d2c4;
    border-radius: 8px; padding: 12px; max-height: 34vh; display: flex; flex-direction: column;
  }
  .schema.hopfalld { max-height: none; }
  .schema-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .schema.hopfalld .schema-head { margin-bottom: 0; }
  .schema-toggle {
    flex: none; border: 1px solid #d8d2c4; border-radius: 5px; background: #faf8f3;
    width: 24px; height: 22px; cursor: pointer; font-size: 0.7rem; color: #8a8371;
    align-self: center;
  }
  .schema-toggle:hover { background: #eaf2e3; }
  .schema h2 { font-size: 0.95rem; margin: 0; }
  .schema-hint { font-size: 0.72rem; color: #8a8371; }
  .schema-tom { font-size: 0.78rem; color: #77705f; margin: 0; }
  .schema-scroll { overflow: auto; min-height: 0; }
  .schema table { border-collapse: collapse; width: 100%; font-size: 0.78rem; }
  .schema th, .schema td {
    border-bottom: 1px solid #eee5d3; padding: 5px 8px; text-align: left; vertical-align: top;
  }
  .schema thead th {
    position: sticky; top: 0; background: #faf8f3; z-index: 1;
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: #8a8371;
  }
  .schema .vkol { white-space: nowrap; width: 1%; }
  .vdatum { display: block; font-size: 0.68rem; color: #a89d87; }
  .chip {
    display: inline-block; margin: 1px 3px 1px 0; padding: 2px 8px;
    border-radius: 12px; font-size: 0.74rem; border: 1px solid;
  }
  .chip.forsa { background: #f3ecfa; border-color: #d9c9ec; color: #5b3a86; }
  .chip.direktsa { background: #eef6e8; border-color: #cfe0c4; color: #3d6b28; }
  .chip.planteraUt { background: #fdf3e6; border-color: #f0dcb8; color: #8a5d00; }
  .tomcell { color: #d4cbb8; }

  .modal-backdrop {
    position: fixed; inset: 0; background: #2e2a2288; z-index: 100;
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  .modal-card {
    position: relative; background: #fff; border-radius: 12px; padding: 20px;
    width: 360px; max-width: 100%; max-height: 85vh; overflow-y: auto;
    box-shadow: 0 8px 32px #0004;
  }
  .modal-close {
    position: absolute; top: 12px; right: 12px; border: none; background: none;
    font-size: 1rem; cursor: pointer; color: #8a8371; width: 28px; height: 28px; border-radius: 50%;
  }
  .modal-close:hover { background: #f4f1ea; }
  .modal-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .modal-icon {
    width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; font-size: 1.4rem; flex: none;
  }
  .modal-head h3 { margin: 0; font-size: 1.15rem; }
  .modal-desc { font-size: 0.85rem; color: #5a5648; line-height: 1.5; margin: 0 0 14px; }
  .statgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .stat {
    background: #faf8f3; border: 1px solid #eee5d3; border-radius: 8px;
    padding: 7px 10px; font-size: 0.83rem; display: flex; flex-direction: column; gap: 2px;
  }
  .statlabel { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em; color: #8a8371; }
  .companions { margin-top: 10px; }
  .companions h4 { font-size: 0.8rem; margin: 0 0 6px; }
  .companions h4.good { color: #2e5d1e; }
  .companions h4.bad { color: #b3402a; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tag {
    border: 1px solid #d8d2c4; border-radius: 20px; background: #faf8f3;
    padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  }
  .tag:hover { background: #eaf2e3; }
  .orsak {
    font-size: 0.66rem; color: #a8836b; background: #f3ece4;
    border-radius: 8px; padding: 1px 6px; margin-left: 4px;
  }

  /* ---- export/utskrift ---- */
  .print-export { display: none; }

  @media print {
    /* Svelte monterar allt i #app, inte direkt i body — döljer #app:s övriga
       barn (header/main/schema) men behåller dem i DOM:en. */
    :global(#app > *:not(.print-export)) { display: none !important; }
    .print-export { display: block; }

    .print-export h1 { font-size: 1.3rem; margin: 0 0 4px; }
    .print-export h2 {
      font-size: 1rem; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px;
    }
    .print-meta { font-size: 0.8rem; color: #555; margin: 0 0 16px; }
    .print-img { width: 100%; max-height: 70vh; object-fit: contain; border: 1px solid #ccc; }

    .print-warnlist { list-style: none; padding: 0; margin: 0; }
    .print-warnlist li {
      break-inside: avoid; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #eee;
    }
    .print-warnlist strong { display: block; font-size: 0.85rem; }
    .print-warnlist span { font-size: 0.78rem; color: #444; }

    .print-schema { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
    .print-schema th, .print-schema td {
      border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top;
    }
    .print-schema thead { display: table-header-group; } /* upprepa rubriken på varje sida */
    .print-schema tr { break-inside: avoid; }
  }
</style>
