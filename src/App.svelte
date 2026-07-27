<script lang="ts">
  import { onMount } from "svelte";
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap, plantHeight } from "./lib/model";
  import { PLANTS, plantById, plantsPerM2, type Plant } from "./lib/plants";
  import { computeWarnings, type Warning } from "./lib/rules";
  import { computeSchedule, formateraDatum, ATGARD_RUBRIK, type Vecka, type Atgard } from "./lib/schedule";
  import { PLATSER, SASONGER, TIDER, MIN_SOLHOJD } from "./lib/sun";

  // let (inte const): omtilldelas efter mutationer så Svelte uppdaterar vyn
  let garden = loadGarden();
  let canvas: GardenCanvas;

  let warnings: Warning[] = computeWarnings(garden);
  let selection: { kind: "box" | "row"; id: number } | null = null;
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
  }
  function toggleSkugga() {
    garden.visaSkugga = !garden.visaSkugga;
    solChanged();
  }

  onMount(() => { sol = canvas?.aktuellSol().sol ?? null; });

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

  function countChanged() {
    rowCount = Math.max(1, Math.round(rowCount || 1));
    if (selectedPlantId) canvas.startPlacingRow(selectedPlantId, rowCount);
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

<header>
  <h1>🌱 Odlingsplaneraren</h1>
  <div class="controls">
    <label>Odlingens storlek:
      <input type="number" bind:value={widthM} min="1" max="100" step="0.5" on:change={applySize} /> ×
      <input type="number" bind:value={heightM} min="1" max="100" step="0.5" on:change={applySize} /> m
    </label>
    <label title="Utgångspunkt för hela årsschemat">Sista vårfrost:
      <input type="date" class="date" bind:value={garden.sistaFrostDatum} on:change={frostChanged} />
    </label>
  </div>
</header>

<div class="toolbar">
  {#if !locked}
    <label>Ruta/gång:
      <input type="number" bind:value={boxW} min="0.2" max="20" step="0.1" /> ×
      <input type="number" bind:value={boxH} min="0.2" max="20" step="0.1" /> m
    </label>
    <button on:click={() => place("odling")}>🟫 Placera odlingsruta</button>
    <button on:click={() => place("gang")}>▨ Placera gång</button>
  {/if}
  <button class="lock" class:on={locked} on:click={toggleLock}>
    {locked ? "🔒 Layout låst" : "🔓 Lås layout"}
  </button>

  <span class="sep"></span>

  <button on:click={() => canvas.rotateSelection()} disabled={!selection}
          title="Roterar markerad ruta (med sina växter) eller markerad rad">
    ⟳ Rotera{selection ? selection.kind === "box" ? " rutan" : " raden" : ""}
  </button>
  <button on:click={() => canvas.deleteSelection()} disabled={!selection}>🗑 Ta bort</button>
  <button class:on={garden.showLabels} on:click={toggleLabels}>🏷 Namnskyltar</button>
  <button class:on={garden.visaSkugga} on:click={toggleSkugga}>☀️ Skuggor</button>

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
        <input type="number" bind:value={rowCount} min="1" max="200" on:change={countChanged} />
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
    {#if garden.visaSkugga}
      <div class="solrad">
        <label>📍 <select bind:value={garden.platsNamn} on:change={solChanged}>
          {#each PLATSER as p}<option value={p.namn}>{p.namn}</option>{/each}
        </select></label>

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

        {#if sol}
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
    {/if}
    <GardenCanvas bind:this={canvas} {garden} onchange={onCanvasChange}
                  onselect={(s) => selection = s} />
  </div>

  {#if warnings.length}
    <section class="warnpanel">
      <div class="warnhead-row">
        <h2>Varningar &amp; noteringar <span class="count">{warnings.length}</span></h2>
        <button class="linkbtn" on:click={toggleAllWarnings}>
          {allCollapsed ? "Visa alla" : "Minimera alla"}
        </button>
      </div>
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
    </section>
  {/if}
</main>

<section class="schema">
  <div class="schema-head">
    <h2>Årsschema — vad gör jag när?</h2>
    <span class="schema-hint">
      Veckorna räknas från sista vårfrost ({garden.sistaFrostDatum}). Skörd står inte med –
      den sker när grödan ser färdig ut, inte efter kalender.
    </span>
  </div>

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
</section>

<svelte:window on:keydown={(e) => { if (infoPlantId && e.key === "Escape") infoPlantId = null; }} />

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
            {#each infoPlant.daliga_grannar as id}
              {#if plantById[id]}
                <button class="tag" on:click={() => infoPlantId = id}>{plantById[id].symbol} {plantById[id].namn}</button>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

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
  .schema-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
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
</style>
