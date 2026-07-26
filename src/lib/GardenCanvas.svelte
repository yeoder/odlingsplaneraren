<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Konva from "konva";
  import { GRID_CM, snap, overlaps, saveGarden, type Garden, type Box } from "./model";

  export let garden: Garden;
  export let onchange: () => void = () => {};

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let gridLayer: Konva.Layer;
  let boxLayer: Konva.Layer;
  let ghostLayer: Konva.Layer;

  // --- läge ---
  let placing: { typ: "odling" | "gang"; w: number; h: number } | null = null;
  let ghost: Konva.Rect | null = null;
  let selectedId: number | null = null;
  let nextId = 1;

  // kontextmeny (HTML ovanpå canvasen)
  let menu = { visible: false, x: 0, y: 0, boxId: 0 };

  export function startPlacing(typ: "odling" | "gang", wCm: number, hCm: number) {
    placing = { typ, w: snap(wCm), h: snap(hCm) };
    menu.visible = false;
  }
  export function cancelPlacing() {
    placing = null;
    ghost?.destroy();
    ghost = null;
    ghostLayer?.batchDraw();
  }

  function commit() {
    saveGarden(garden);
    onchange();
  }

  // --- validering ---
  function isValid(b: Box, ignoreId?: number): boolean {
    if (b.x < 0 || b.y < 0 || b.x + b.w > garden.widthCm || b.y + b.h > garden.heightCm) return false;
    return !garden.boxes.some(o => o.id !== ignoreId && overlaps(b, o));
  }

  // --- placering med spökrektangel ---
  function worldPos(): { x: number; y: number } | null {
    const p = stage.getPointerPosition();
    if (!p) return null;
    return { x: (p.x - stage.x()) / stage.scaleX(), y: (p.y - stage.y()) / stage.scaleY() };
  }

  function moveGhost() {
    if (!placing) return;
    const wp = worldPos();
    if (!wp) return;
    let x = snap(wp.x - placing.w / 2);
    let y = snap(wp.y - placing.h / 2);
    x = Math.min(Math.max(x, 0), Math.max(garden.widthCm - placing.w, 0));
    y = Math.min(Math.max(y, 0), Math.max(garden.heightCm - placing.h, 0));
    const candidate = { id: -1, typ: placing.typ, x, y, w: placing.w, h: placing.h, label: "" } as Box;
    const ok = isValid(candidate);
    if (!ghost) {
      ghost = new Konva.Rect({ dash: [8, 4], strokeWidth: 2, listening: false });
      ghostLayer.add(ghost);
    }
    ghost.setAttrs({
      x, y, width: placing.w, height: placing.h,
      stroke: ok ? "#4e7a3a" : "#c62828",
      fill: ok ? "#4e7a3a22" : "#c6282822",
      strokeWidth: 2 / stage.scaleX(),
    });
    ghostLayer.batchDraw();
  }

  function tryPlace() {
    if (!placing) return false;
    if (!ghost) return true; // inget spöke = klick utanför, ignorera
    const b: Box = {
      id: nextId++,
      typ: placing.typ,
      x: ghost.x(), y: ghost.y(),
      w: placing.w, h: placing.h,
      label: "",
    };
    if (!isValid(b)) return true; // rött spöke → placera inte, behåll läget
    garden.boxes.push(b);
    renderBoxes();
    commit();
    return true;
  }

  // --- boxrendering ---
  function renderBoxes() {
    boxLayer.destroyChildren();
    const sw = () => 1 / stage.scaleX();

    for (const b of garden.boxes) {
      const g = new Konva.Group({ x: b.x, y: b.y, draggable: !garden.locked, id: String(b.id) });

      const isGang = b.typ === "gang";
      g.add(new Konva.Rect({
        width: b.w, height: b.h,
        fill: isGang ? "#cfc8b8" : "#8d6e63",
        stroke: selectedId === b.id ? "#2e5d1e" : isGang ? "#a89d87" : "#5d4037",
        strokeWidth: (selectedId === b.id ? 3 : 1.5) * sw(),
        cornerRadius: 3,
        dash: isGang ? [10, 5] : undefined,
      }));

      const fs = Math.min(14, Math.max(8, Math.min(b.w, b.h) / 6));
      // låst läge: dölj all text på boxarna så den inte stör vid plantering
      const labelText = garden.locked
        ? ""
        : isGang
          ? `gång ${b.w / 100}×${b.h / 100} m`
          : `${b.label ? b.label + " · " : ""}${b.w / 100}×${b.h / 100} m`;
      if (labelText) {
        g.add(new Konva.Text({
          x: 4, y: 4, width: b.w - 8,
          text: labelText,
          fontSize: fs, fill: isGang ? "#77705f" : "#ffffffbb",
          listening: false,
        }));
      }

      // snap under drag
      g.dragBoundFunc(function (pos) {
        const s = stage.scaleX();
        const gx = snap((pos.x - stage.x()) / s);
        const gy = snap((pos.y - stage.y()) / s);
        return { x: gx * s + stage.x(), y: gy * s + stage.y() };
      });

      g.on("dragstart", () => { selectedId = b.id; menu.visible = false; renderBoxes(); });
      g.on("dragend", () => {
        const cand = { ...b, x: snap(g.x()), y: snap(g.y()) };
        if (isValid(cand, b.id)) {
          b.x = cand.x; b.y = cand.y;
          commit();
        }
        renderBoxes(); // ogiltig flytt ⇒ ritas tillbaka på gamla platsen
      });

      g.on("click tap", (e) => {
        e.cancelBubble = true;
        if (placing) return;
        selectedId = b.id;
        menu.visible = false;
        renderBoxes();
      });

      g.on("contextmenu", (e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (garden.locked) return;
        selectedId = b.id;
        renderBoxes();
        const r = container.getBoundingClientRect();
        menu = {
          visible: true,
          x: Math.min(e.evt.clientX - r.left, r.width - 180),
          y: Math.min(e.evt.clientY - r.top, r.height - 190),
          boxId: b.id,
        };
      });

      g.on("mouseenter", () => { if (!placing) container.style.cursor = "move"; });
      g.on("mouseleave", () => { container.style.cursor = placing ? "crosshair" : "grab"; });

      boxLayer.add(g);
    }
    boxLayer.batchDraw();
  }

  // --- kontextmenyns åtgärder ---
  function menuBox(): Box | undefined {
    return garden.boxes.find(b => b.id === menu.boxId);
  }
  function actDuplicate() {
    const b = menuBox(); if (!b) return;
    const copy: Box = { ...b, id: nextId++ };
    // prova platser: höger, under, vänster, över — annars samma plats förskjuten tills ledigt
    const tries = [
      { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h },
      { x: b.x - b.w, y: b.y }, { x: b.x, y: b.y - b.h },
    ];
    let placed = false;
    for (const t of tries) {
      const cand = { ...copy, ...t };
      if (isValid(cand)) { copy.x = cand.x; copy.y = cand.y; placed = true; break; }
    }
    if (!placed) {
      let d = GRID_CM * 2;
      while (d < garden.widthCm) {
        const cand = { ...copy, x: b.x + d, y: b.y + d };
        if (isValid(cand)) { copy.x = cand.x; copy.y = cand.y; placed = true; break; }
        d += GRID_CM * 2;
      }
    }
    if (placed) { garden.boxes.push(copy); selectedId = copy.id; commit(); renderBoxes(); }
    menu.visible = false;
  }
  function actRotate() {
    const b = menuBox(); if (!b) return;
    const cand = { ...b, w: b.h, h: b.w };
    cand.x = Math.min(cand.x, garden.widthCm - cand.w);
    cand.y = Math.min(cand.y, garden.heightCm - cand.h);
    if (isValid(cand, b.id)) { Object.assign(b, cand); commit(); renderBoxes(); }
    menu.visible = false;
  }
  function actRename() {
    const b = menuBox(); if (!b) return;
    const name = prompt("Namn på odlingsrutan:", b.label);
    if (name !== null) { b.label = name.trim(); commit(); renderBoxes(); }
    menu.visible = false;
  }
  function actDelete() {
    garden.boxes = garden.boxes.filter(b => b.id !== menu.boxId);
    garden.rows = garden.rows.filter(r => r.boxId !== menu.boxId);
    selectedId = null;
    commit(); renderBoxes();
    menu.visible = false;
  }

  // --- grid (från M0) ---
  function drawGrid() {
    gridLayer.destroyChildren();
    const W = garden.widthCm, H = garden.heightCm;
    gridLayer.add(new Konva.Rect({
      x: 0, y: 0, width: W, height: H,
      fill: "#efe9dc", stroke: "#8d6e63", strokeWidth: 2 / stage.scaleX(),
    }));
    const scale = stage.scaleX();
    const minor = scale > 1.4 ? GRID_CM : scale > 0.3 ? 50 : 100;
    for (let x = 0; x <= W; x += minor) {
      const major = x % 100 === 0, mid = x % 50 === 0;
      gridLayer.add(new Konva.Line({
        points: [x, 0, x, H],
        stroke: major ? "#c4b8a4" : mid ? "#d8d0bf" : "#e4ddcd",
        strokeWidth: (major ? 1.2 : 0.6) / scale,
      }));
    }
    for (let y = 0; y <= H; y += minor) {
      const major = y % 100 === 0, mid = y % 50 === 0;
      gridLayer.add(new Konva.Line({
        points: [0, y, W, y],
        stroke: major ? "#c4b8a4" : mid ? "#d8d0bf" : "#e4ddcd",
        strokeWidth: (major ? 1.2 : 0.6) / scale,
      }));
    }
    for (let x = 100; x < W; x += 100) {
      gridLayer.add(new Konva.Text({ x: x + 3, y: 3, text: `${x / 100} m`, fontSize: 11 / scale, fill: "#a89d87" }));
    }
    for (let y = 100; y < H; y += 100) {
      gridLayer.add(new Konva.Text({ x: 3, y: y + 3, text: `${y / 100} m`, fontSize: 11 / scale, fill: "#a89d87" }));
    }
    gridLayer.batchDraw();
  }

  function fitToView() {
    const pad = 24;
    const sw = container.clientWidth, sh = container.clientHeight;
    const s = Math.min((sw - pad * 2) / garden.widthCm, (sh - pad * 2) / garden.heightCm);
    stage.scale({ x: s, y: s });
    stage.position({ x: (sw - garden.widthCm * s) / 2, y: (sh - garden.heightCm * s) / 2 });
    drawGrid();
    renderBoxes();
  }

  export function refresh() {
    if (stage) fitToView();
  }

  // rita om boxarna utan att röra zoom/position (t.ex. vid lås/upplås)
  export function redraw() {
    if (!stage) return;
    if (garden.locked) { cancelPlacing(); menu.visible = false; selectedId = null; }
    renderBoxes();
  }

  onMount(() => {
    nextId = garden.boxes.concat(garden.rows as any).reduce((m: number, o: any) => Math.max(m, o.id), 0) + 1;

    stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true,
    });
    gridLayer = new Konva.Layer({ listening: false });
    boxLayer = new Konva.Layer();
    ghostLayer = new Konva.Layer({ listening: false });
    stage.add(gridLayer, boxLayer, ghostLayer);

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
      renderBoxes();
      if (ghost) moveGhost();
    });

    stage.on("mousemove", moveGhost);

    stage.on("click tap", (e) => {
      menu.visible = false;
      if (placing) { tryPlace(); return; }
      if (e.target === stage || e.target.getLayer() === gridLayer) {
        selectedId = null;
        renderBoxes();
      }
    });

    // förhindra webbläsarens meny på hela ytan
    container.addEventListener("contextmenu", (e) => e.preventDefault());

    // panorering ska inte starta när man drar en box
    stage.on("dragstart", (e) => {
      if (e.target !== stage) stage.draggable(false);
    });
    stage.on("dragend", () => stage.draggable(true));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cancelPlacing(); menu.visible = false; }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null
          && !garden.locked && !(e.target instanceof HTMLInputElement)) {
        garden.boxes = garden.boxes.filter(b => b.id !== selectedId);
        garden.rows = garden.rows.filter(r => r.boxId !== selectedId);
        selectedId = null;
        commit(); renderBoxes();
      }
    };
    window.addEventListener("keydown", onKey);

    let userAdjusted = false;
    stage.on("wheel dragend", () => { userAdjusted = true; });
    const ro = new ResizeObserver(() => {
      stage.width(container.clientWidth);
      stage.height(container.clientHeight);
      if (userAdjusted) { drawGrid(); renderBoxes(); }
      else fitToView(); // första layouten + fönsterresize innan användaren zoomat/panorerat
    });
    ro.observe(container);
    fitToView();

    return () => { ro.disconnect(); window.removeEventListener("keydown", onKey); };
  });

  onDestroy(() => stage?.destroy());

  $: container && (container.style.cursor = placing ? "crosshair" : "grab");
</script>

<div class="wrap">
  <div class="canvas" bind:this={container}></div>

  {#if placing}
    <div class="placebar">
      Placerar {placing.typ === "gang" ? "gång" : "odlingsruta"} {placing.w / 100}×{placing.h / 100} m —
      klicka för att placera (flera gånger OK) · <b>Esc</b> avslutar
      <button on:click={cancelPlacing}>Klar</button>
    </div>
  {/if}

  {#if menu.visible}
    <div class="menu" style="left:{menu.x}px; top:{menu.y}px">
      <button on:click={actDuplicate}>⧉ Duplicera</button>
      <button on:click={actRotate}>⟳ Rotera 90°</button>
      {#if menuBox()?.typ === "odling"}
        <button on:click={actRename}>✏️ Namnge…</button>
      {/if}
      <button class="danger" on:click={actDelete}>🗑 Ta bort</button>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; width: 100%; height: 100%; }
  .canvas {
    width: 100%; height: 100%;
    background: #dcd6c8; border-radius: 8px; overflow: hidden;
  }
  .placebar {
    position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
    background: #2e5d1e; color: #fff; padding: 6px 14px; border-radius: 20px;
    font-size: 0.82rem; display: flex; gap: 10px; align-items: center;
    box-shadow: 0 2px 8px #0004; white-space: nowrap;
  }
  .placebar button {
    border: none; border-radius: 12px; padding: 3px 12px; cursor: pointer;
    background: #fff; color: #2e5d1e; font-weight: 600;
  }
  .menu {
    position: absolute; z-index: 10; min-width: 160px;
    background: #fff; border: 1px solid #d8d2c4; border-radius: 8px;
    box-shadow: 0 4px 16px #0003; padding: 4px; display: flex; flex-direction: column;
  }
  .menu button {
    text-align: left; border: none; background: none; padding: 7px 10px;
    border-radius: 5px; cursor: pointer; font-size: 0.85rem;
  }
  .menu button:hover { background: #eaf2e3; }
  .menu button.danger:hover { background: #fde8e6; color: #b3402a; }
</style>
