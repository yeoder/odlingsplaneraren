<script lang="ts">
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap } from "./lib/model";
  import { PLANTS } from "./lib/plants";

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
    <h2>Växter</h2>
    <label class="countrow">Antal i raden:
      <input type="number" bind:value={rowCount} min="1" max="200" on:change={countChanged} />
    </label>
    <div class="plantlist">
      {#each PLANTS as p}
        <button class="plantbtn" class:active={selectedPlantId === p.id} on:click={() => pickPlant(p.id)}>
          <span class="swatch" style="background:{p.farg}"></span>
          <span class="pname">{p.symbol} {p.namn}</span>
          <small>ø{p.avstand_cm} cm</small>
        </button>
      {/each}
    </div>
    <p class="asidehint">
      Välj växt → klicka i en odlingsruta. Raden läggs med rätt avstånd mellan plantorna.
      <b>R</b> roterar innan placering. Är boxen något för kort komprimeras raden automatiskt
      (max 20 %) och märks med ⚠. Dra rader för att flytta, högerklicka för meny.
    </p>
  </aside>
  <GardenCanvas bind:this={canvas} {garden} onchange={onCanvasChange} />
</main>

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
    border-radius: 8px; padding: 12px; overflow-y: auto;
  }
  aside h2 { font-size: 0.95rem; margin: 0 0 8px; }
  .countrow { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; margin-bottom: 8px; }
  .countrow input { width: 60px; border: 1px solid #d8d2c4; border-radius: 4px; padding: 4px 6px; }
  .plantlist { display: flex; flex-direction: column; }
  .plantbtn {
    display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
    margin: 2px 0; padding: 6px 8px; border: 1px solid #d8d2c4; border-radius: 6px;
    background: #faf8f3; cursor: pointer; font-size: 0.83rem;
  }
  .plantbtn:hover { background: #eaf2e3; }
  .plantbtn.active { outline: 2px solid #4e7a3a; background: #eaf2e3; }
  .swatch { width: 13px; height: 13px; border-radius: 50%; flex: none; }
  .pname { flex: 1; }
  .plantbtn small { color: #8a8371; }
  .asidehint { font-size: 0.72rem; color: #77705f; line-height: 1.4; }
</style>
