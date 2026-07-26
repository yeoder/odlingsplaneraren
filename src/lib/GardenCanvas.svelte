<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Konva from "konva";
  import { GRID_CM, type Garden } from "./model";

  export let garden: Garden;

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let gridLayer: Konva.Layer;

  // px per cm vid zoom 1 (0.9 ⇒ 8 m bred trädgård ≈ 720 px)
  const BASE = 0.9;

  function drawGrid() {
    gridLayer.destroyChildren();
    const W = garden.widthCm, H = garden.heightCm;

    // markyta
    gridLayer.add(new Konva.Rect({
      x: 0, y: 0, width: W, height: H,
      fill: "#efe9dc", stroke: "#8d6e63", strokeWidth: 2 / stage.scaleX(),
    }));

    const scale = stage.scaleX() * BASE;
    // rita 5 cm-linjer bara när de är urskiljbara, annars 50 cm-nivån
    const minor = scale > 1.6 ? GRID_CM : scale > 0.35 ? 50 : 100;

    for (let x = 0; x <= W; x += minor) {
      const major = x % 100 === 0, mid = x % 50 === 0;
      gridLayer.add(new Konva.Line({
        points: [x, 0, x, H],
        stroke: major ? "#c4b8a4" : mid ? "#d8d0bf" : "#e4ddcd",
        strokeWidth: (major ? 1.2 : 0.6) / stage.scaleX(),
      }));
    }
    for (let y = 0; y <= H; y += minor) {
      const major = y % 100 === 0, mid = y % 50 === 0;
      gridLayer.add(new Konva.Line({
        points: [0, y, W, y],
        stroke: major ? "#c4b8a4" : mid ? "#d8d0bf" : "#e4ddcd",
        strokeWidth: (major ? 1.2 : 0.6) / stage.scaleX(),
      }));
    }

    // metermarkeringar
    for (let x = 100; x < W; x += 100) {
      gridLayer.add(new Konva.Text({
        x: x + 3, y: 3, text: `${x / 100} m`,
        fontSize: 11 / stage.scaleX(), fill: "#a89d87",
      }));
    }
    for (let y = 100; y < H; y += 100) {
      gridLayer.add(new Konva.Text({
        x: 3, y: y + 3, text: `${y / 100} m`,
        fontSize: 11 / stage.scaleX(), fill: "#a89d87",
      }));
    }
    gridLayer.batchDraw();
  }

  function fitToView() {
    const pad = 24;
    const sw = container.clientWidth, sh = container.clientHeight;
    const s = Math.min((sw - pad * 2) / garden.widthCm, (sh - pad * 2) / garden.heightCm);
    stage.scale({ x: s, y: s });
    stage.position({
      x: (sw - garden.widthCm * s) / 2,
      y: (sh - garden.heightCm * s) / 2,
    });
    drawGrid();
  }

  export function refresh() {
    if (stage) fitToView();
  }

  onMount(() => {
    stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true, // panorering
    });
    gridLayer = new Konva.Layer({ listening: false });
    stage.add(gridLayer);

    // zoom med scrollhjul, centrerat på muspekaren
    stage.on("wheel", (e) => {
      e.evt.preventDefault();
      const old = stage.scaleX();
      const pointer = stage.getPointerPosition()!;
      const dir = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
      const s = Math.min(Math.max(old * dir, 0.05), 20);
      const world = { x: (pointer.x - stage.x()) / old, y: (pointer.y - stage.y()) / old };
      stage.scale({ x: s, y: s });
      stage.position({ x: pointer.x - world.x * s, y: pointer.y - world.y * s });
      drawGrid();
    });

    const ro = new ResizeObserver(() => {
      stage.width(container.clientWidth);
      stage.height(container.clientHeight);
      drawGrid();
    });
    ro.observe(container);
    fitToView();
    return () => ro.disconnect();
  });

  onDestroy(() => stage?.destroy());
</script>

<div class="canvas" bind:this={container}></div>

<style>
  .canvas {
    width: 100%;
    height: 100%;
    background: #dcd6c8;
    border-radius: 8px;
    overflow: hidden;
    cursor: grab;
  }
  .canvas:active { cursor: grabbing; }
</style>
