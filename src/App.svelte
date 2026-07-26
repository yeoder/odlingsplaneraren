<script lang="ts">
  import GardenCanvas from "./lib/GardenCanvas.svelte";
  import { loadGarden, saveGarden, snap } from "./lib/model";

  const garden = loadGarden();
  let canvas: GardenCanvas;

  let widthM = garden.widthCm / 100;
  let heightM = garden.heightCm / 100;

  function applySize() {
    garden.widthCm = snap(Math.max(100, widthM * 100));
    garden.heightCm = snap(Math.max(100, heightM * 100));
    widthM = garden.widthCm / 100;
    heightM = garden.heightCm / 100;
    saveGarden(garden);
    canvas.refresh();
  }
</script>

<header>
  <h1>🌱 Odlingsplaneraren</h1>
  <div class="controls">
    <label>Odlingens storlek:
      <input type="number" bind:value={widthM} min="1" max="100" step="0.5" on:change={applySize} /> ×
      <input type="number" bind:value={heightM} min="1" max="100" step="0.5" on:change={applySize} /> m
    </label>
    <span class="hint">Scrolla för zoom · dra för att panorera · rutnät 5 cm</span>
  </div>
</header>

<main>
  <GardenCanvas bind:this={canvas} {garden} />
</main>

<style>
  header {
    background: #4e7a3a;
    color: #fff;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  h1 { font-size: 1.15rem; margin: 0; }
  .controls { display: flex; align-items: center; gap: 14px; font-size: 0.9rem; flex-wrap: wrap; }
  input { width: 60px; border: none; border-radius: 4px; padding: 4px 6px; }
  .hint { opacity: 0.75; font-size: 0.8rem; }
  main { flex: 1; padding: 12px; min-height: 0; }
</style>
