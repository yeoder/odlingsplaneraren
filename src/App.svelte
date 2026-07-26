<script lang="ts">
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap } from "./lib/model";
  import { PLANTS, plantById, plantsPerM2, type Plant } from "./lib/plants";

  const garden = loadGarden();
  let canvas: GardenCanvas;

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
    // avmarkera växtknappen när placeringen avslutas via Esc/Klar
    if (!canvas.isPlacingRow()) selectedPlantId = null;
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
  function densityText(avstandCm: number): string {
    const perM2 = plantsPerM2(avstandCm);
    if (perM2 >= 1) return `${Math.round(perM2 * 10) / 10} st/m²`;
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
    {locked ? "🔒 Layout låst — klicka för att låsa upp" : "🔓 Lås layout"}
  </button>
  <span class="hint">
    {#if locked}
      Layouten är låst — välj växt och antal till vänster, klicka i en odlingsruta för att plantera.
    {:else}
      Dra för att flytta · högerklick för meny · Delete tar bort markerad · scrolla = zoom · rutnät 5 cm
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
        <div class="plantrow">
          <button class="plantbtn" class:active={selectedPlantId === p.id} on:click={() => pickPlant(p.id)}>
            <span class="swatch" style="background:{p.farg}"></span>
            <span class="pname">{p.symbol} {p.namn}</span>
            <small>ø{p.avstand_cm} cm</small>
          </button>
          <button class="infobtn" on:click={() => infoPlantId = p.id}
                  title="Mer info om {p.namn}" aria-label="Mer info om {p.namn}">ⓘ</button>
        </div>
      {:else}
        <p class="asidehint">Ingen växt matchar "{plantFilter}".</p>
      {/each}
    </div>
    <p class="asidehint">
      Välj växt → klicka i en odlingsruta. <b>R</b> roterar innan placering. Är boxen något
      för kort komprimeras raden automatiskt (max 20 %) och märks med ⚠.
    </p>
  </aside>
  <GardenCanvas bind:this={canvas} {garden} onchange={onCanvasChange} />
</main>

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
        <div class="stat"><span class="statlabel">📏 Täthet</span><span>{densityText(infoPlant.avstand_cm)}</span></div>
        <div class="stat">
          <span class="statlabel">⚖️ Skörd</span>
          <span>{infoPlant.skord_kg_per_m2 != null ? `${infoPlant.skord_kg_per_m2} kg/m²` : "Prydnadsväxt"}</span>
        </div>
        <div class="stat"><span class="statlabel">🕐 Skördetid</span><span>~{infoPlant.dagar_till_skord} dagar</span></div>
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
  .toolbar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 8px 18px; background: #fff; border-bottom: 1px solid #d8d2c4; font-size: 0.85rem;
  }
  .toolbar input { width: 55px; border: 1px solid #d8d2c4; border-radius: 4px; padding: 4px 6px; }
  .toolbar button {
    border: 1px solid #d8d2c4; border-radius: 6px; background: #faf8f3;
    padding: 6px 12px; cursor: pointer; font-size: 0.85rem;
  }
  .toolbar button:hover { background: #eaf2e3; }
  .toolbar button.lock.on { background: #2e5d1e; color: #fff; border-color: #2e5d1e; }
  .hint { color: #8a8371; font-size: 0.75rem; }

  main { flex: 1; padding: 12px; min-height: 0; display: flex; gap: 12px; }
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
  .plantrow { display: flex; align-items: stretch; gap: 4px; margin: 2px 0; flex: none; }
  .plantbtn {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-align: left;
    padding: 6px 8px; border: 1px solid #d8d2c4; border-radius: 6px;
    background: #faf8f3; cursor: pointer; font-size: 0.83rem;
  }
  .plantbtn:hover { background: #eaf2e3; }
  .plantbtn.active { outline: 2px solid #4e7a3a; background: #eaf2e3; }
  .swatch { width: 13px; height: 13px; border-radius: 50%; flex: none; }
  .pname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .plantbtn small { color: #8a8371; flex: none; }
  .infobtn {
    flex: none; width: 24px; border: 1px solid #d8d2c4; border-radius: 50%;
    background: #faf8f3; cursor: pointer; font-size: 0.8rem; color: #8a8371; line-height: 1;
  }
  .infobtn:hover { background: #4e7a3a; color: #fff; border-color: #4e7a3a; }
  .asidehint { font-size: 0.72rem; color: #77705f; line-height: 1.4; flex: none; }

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
