<script lang="ts">
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap } from "./lib/model";

  const garden = loadGarden();
  let canvas: GardenCanvas;

  let widthM = garden.widthCm / 100;
  let heightM = garden.heightCm / 100;

  // boxmått (meter)
  let boxW = 1.2;
  let boxH = 2.4;

  function applySize() {
    garden.widthCm = snap(Math.max(100, widthM * 100));
    garden.heightCm = snap(Math.max(100, heightM * 100));
    widthM = garden.widthCm / 100;
    heightM = garden.heightCm / 100;
    saveGarden(garden);
    canvas.refresh();
  }

  function place(typ: "odling" | "gang") {
    canvas.startPlacing(typ, boxW * 100, boxH * 100);
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
  <label>Ruta/gång:
    <input type="number" bind:value={boxW} min="0.2" max="20" step="0.1" /> ×
    <input type="number" bind:value={boxH} min="0.2" max="20" step="0.1" /> m
  </label>
  <button on:click={() => place("odling")}>🟫 Placera odlingsruta</button>
  <button on:click={() => place("gang")}>▨ Placera gång</button>
  <span class="hint">Dra för att flytta · högerklick för meny · Delete tar bort markerad · scrolla = zoom · rutnät 5 cm</span>
</div>

<main>
  <GardenCanvas bind:this={canvas} {garden} />
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
  .hint { color: #8a8371; font-size: 0.75rem; }
  main { flex: 1; padding: 12px; min-height: 0; }
</style>
