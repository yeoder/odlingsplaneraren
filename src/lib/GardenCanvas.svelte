<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Konva from "konva";
  import {
    GRID_CM, MIN_COMPRESSION, snap, overlaps, saveGarden, rowRect, rectsOverlap, rectInside,
    type Garden, type Box, type PlantRow, type Rect,
  } from "./model";
  import { plantById } from "./plants";

  export let garden: Garden;
  export let onchange: () => void = () => {};

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let gridLayer: Konva.Layer;
  let boxLayer: Konva.Layer;
  let rowLayer: Konva.Layer;
  let ghostLayer: Konva.Layer;

  // --- läge ---
  let placing: { typ: "odling" | "gang"; w: number; h: number } | null = null;
  let placingRow: { plantId: string; count: number; rotationDeg: number } | null = null;
  let ghostGroup: Konva.Group | null = null;
  let ghostState: { valid: boolean; row?: PlantRow } = { valid: false };
  let selectedBoxId: number | null = null;
  let selectedRowId: number | null = null;
  let nextId = 1;

  // kontextmeny (HTML ovanpå canvasen)
  let menu = { visible: false, x: 0, y: 0, kind: "box" as "box" | "row", id: 0 };

  export function startPlacing(typ: "odling" | "gang", wCm: number, hCm: number) {
    cancelPlacing();
    placing = { typ, w: snap(wCm), h: snap(hCm) };
    menu.visible = false;
  }
  export function startPlacingRow(plantId: string, count: number) {
    cancelPlacing();
    placingRow = { plantId, count: Math.max(1, Math.round(count)), rotationDeg: 0 };
    menu.visible = false;
  }
  export function cancelPlacing() {
    placing = null;
    placingRow = null;
    ghostGroup?.destroy();
    ghostGroup = null;
    ghostState = { valid: false };
    ghostLayer?.batchDraw();
  }
  export function isPlacingRow(): boolean { return placingRow !== null; }

  function commit() {
    saveGarden(garden);
    onchange();
  }

  // --- validering ---
  function boxValid(b: Box, ignoreId?: number): boolean {
    if (b.x < 0 || b.y < 0 || b.x + b.w > garden.widthCm || b.y + b.h > garden.heightCm) return false;
    return !garden.boxes.some(o => o.id !== ignoreId && overlaps(b, o));
  }

  function boxRect(b: Box): Rect { return { x: b.x, y: b.y, w: b.w, h: b.h }; }

  // Prova att lägga en rad med mittpunkt nära (cx, cy) i boxen: returnerar justerad rad eller null.
  // Komprimerar automatiskt ner till MIN_COMPRESSION om raden är något för lång för boxen.
  function fitRow(plantId: string, count: number, rotationDeg: number,
                  cx: number, cy: number, box: Box, ignoreRowId?: number): PlantRow | null {
    const d = plantById[plantId].avstand_cm;
    const vertical = rotationDeg % 180 !== 0;
    const along = vertical ? box.h : box.w;   // boxens mått längs raden
    const across = vertical ? box.w : box.h;  // tvärs raden
    if (across < d) return null;              // raden är bredare än boxen

    let compression = 1;
    if (count * d > along) {
      compression = along / (count * d);
      if (compression < MIN_COMPRESSION) return null; // mer än 20 % för trångt
    }

    const row: PlantRow = {
      id: -1, boxId: box.id, plantId, count,
      x: snap(cx), y: snap(cy), rotationDeg, compression,
    };
    // kläm in mittpunkten så rektangeln hamnar helt i boxen
    const r0 = rowRect(row, d);
    row.x = snap(Math.min(Math.max(row.x, box.x + r0.w / 2), box.x + box.w - r0.w / 2));
    row.y = snap(Math.min(Math.max(row.y, box.y + r0.h / 2), box.y + box.h - r0.h / 2));
    const r = rowRect(row, d);
    if (!rectInside(r, boxRect(box))) return null; // snap kan putta ut vid exakt passform
    // överlapp mot andra rader (oavsett box — rader ligger alltid i boxar)
    for (const q of garden.rows) {
      if (q.id === ignoreRowId) continue;
      if (rectsOverlap(r, rowRect(q, plantById[q.plantId].avstand_cm))) return null;
    }
    return row;
  }

  // --- muskoordinater ---
  function worldPos(): { x: number; y: number } | null {
    const p = stage.getPointerPosition();
    if (!p) return null;
    return { x: (p.x - stage.x()) / stage.scaleX(), y: (p.y - stage.y()) / stage.scaleY() };
  }
  function odlingBoxAt(x: number, y: number): Box | undefined {
    return garden.boxes.find(b => b.typ === "odling" &&
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  // --- spöken ---
  function moveGhost() {
    if (placing) moveBoxGhost();
    else if (placingRow) moveRowGhost();
  }

  function ensureGhostGroup(): Konva.Group {
    if (!ghostGroup) {
      ghostGroup = new Konva.Group({ listening: false });
      ghostLayer.add(ghostGroup);
    }
    ghostGroup.destroyChildren();
    return ghostGroup;
  }

  function moveBoxGhost() {
    if (!placing) return;
    const wp = worldPos(); if (!wp) return;
    let x = snap(wp.x - placing.w / 2);
    let y = snap(wp.y - placing.h / 2);
    x = Math.min(Math.max(x, 0), Math.max(garden.widthCm - placing.w, 0));
    y = Math.min(Math.max(y, 0), Math.max(garden.heightCm - placing.h, 0));
    const cand = { id: -1, typ: placing.typ, x, y, w: placing.w, h: placing.h, label: "" } as Box;
    const ok = boxValid(cand);
    ghostState = { valid: ok };
    const g = ensureGhostGroup();
    g.add(new Konva.Rect({
      x, y, width: placing.w, height: placing.h,
      dash: [8, 4],
      stroke: ok ? "#4e7a3a" : "#c62828",
      fill: ok ? "#4e7a3a22" : "#c6282822",
      strokeWidth: 2 / stage.scaleX(),
    }));
    ghostLayer.batchDraw();
  }

  function moveRowGhost() {
    if (!placingRow) return;
    const wp = worldPos(); if (!wp) return;
    const g = ensureGhostGroup();
    const plant = plantById[placingRow.plantId];
    const box = odlingBoxAt(wp.x, wp.y);
    const fitted = box
      ? fitRow(placingRow.plantId, placingRow.count, placingRow.rotationDeg, wp.x, wp.y, box)
      : null;

    if (fitted) {
      ghostState = { valid: true, row: fitted };
      drawRowShape(g, fitted, { ghost: true });
    } else {
      ghostState = { valid: false };
      // rött spöke med nominell längd, centrerat på musen
      const preview: PlantRow = {
        id: -1, boxId: -1, plantId: placingRow.plantId, count: placingRow.count,
        x: wp.x, y: wp.y, rotationDeg: placingRow.rotationDeg, compression: 1,
      };
      const r = rowRect(preview, plant.avstand_cm);
      g.add(new Konva.Rect({
        ...r, width: r.w, height: r.h,
        dash: [6, 4], stroke: "#c62828", fill: "#c6282822",
        strokeWidth: 2 / stage.scaleX(), cornerRadius: plant.avstand_cm / 2,
      }));
    }
    ghostLayer.batchDraw();
  }

  function tryPlaceBox() {
    if (!placing || !ghostState.valid || !ghostGroup) return;
    const rect = ghostGroup.findOne("Rect") as Konva.Rect;
    const b: Box = {
      id: nextId++, typ: placing.typ,
      x: rect.x(), y: rect.y(), w: placing.w, h: placing.h, label: "",
    };
    if (!boxValid(b)) return;
    garden.boxes.push(b);
    renderAll();
    commit();
  }

  function tryPlaceRow() {
    if (!placingRow || !ghostState.valid || !ghostState.row) return;
    const row = { ...ghostState.row, id: nextId++ };
    garden.rows.push(row);
    renderAll();
    commit();
  }

  // --- rendering: plantrad ---
  function drawRowShape(g: Konva.Group, row: PlantRow, opts: { ghost?: boolean } = {}) {
    const plant = plantById[row.plantId];
    const d = plant.avstand_cm;
    const r = rowRect(row, d);
    const tight = row.compression < 0.999;
    const local = opts.ghost ? { x: r.x, y: r.y } : { x: 0, y: 0 }; // riktiga rader ritas i grupp-koordinater

    // fotavtryck
    g.add(new Konva.Rect({
      x: local.x, y: local.y, width: r.w, height: r.h,
      fill: plant.farg + "33",
      stroke: opts.ghost ? "#4e7a3a" : tight ? "#e6a700" : plant.farg,
      strokeWidth: (opts.ghost ? 2 : tight ? 2 : 1.2) / stage.scaleX(),
      dash: opts.ghost ? [8, 4] : undefined,
      cornerRadius: d / 2,
    }));

    // enskilda plantor
    const vertical = row.rotationDeg % 180 !== 0;
    const step = d * row.compression;
    const radius = d / 2 * 0.85;
    for (let i = 0; i < row.count; i++) {
      const off = (i + 0.5) * step - (row.count * step) / 2;
      const px = local.x + r.w / 2 + (vertical ? 0 : off);
      const py = local.y + r.h / 2 + (vertical ? off : 0);
      g.add(new Konva.Circle({
        x: px, y: py, radius,
        fill: plant.farg, opacity: opts.ghost ? 0.5 : 0.9,
        stroke: "#ffffff88", strokeWidth: 1 / stage.scaleX(),
      }));
      if (d >= 10) {
        g.add(new Konva.Text({
          x: px - radius, y: py - radius * 0.7,
          width: radius * 2, align: "center",
          text: plant.symbol, fontSize: radius * 1.2,
          listening: false,
        }));
      }
    }
    if (tight && !opts.ghost) {
      g.add(new Konva.Text({
        x: local.x + r.w - 14, y: local.y - 6, text: "⚠", fontSize: 14 / stage.scaleX(),
        listening: false,
      }));
    }
  }

  function renderRows() {
    rowLayer.destroyChildren();
    for (const row of garden.rows) {
      const plant = plantById[row.plantId];
      const d = plant.avstand_cm;
      const r = rowRect(row, d);
      const g = new Konva.Group({ x: r.x, y: r.y, draggable: true });
      drawRowShape(g, row);

      if (selectedRowId === row.id) {
        g.add(new Konva.Rect({
          x: 0, y: 0, width: r.w, height: r.h,
          stroke: "#2e5d1e", strokeWidth: 2.5 / stage.scaleX(),
          dash: [4, 3], cornerRadius: d / 2, listening: false,
        }));
      }

      const pct = Math.round(row.compression * 100);
      const title = `${row.count} × ${plant.namn} · ${plant.avstand_cm} cm` +
        (row.compression < 0.999 ? ` · komprimerad till ${pct} % — trångt!` : "");

      g.dragBoundFunc(function (pos) {
        const s = stage.scaleX();
        const gx = snap((pos.x - stage.x()) / s);
        const gy = snap((pos.y - stage.y()) / s);
        return { x: gx * s + stage.x(), y: gy * s + stage.y() };
      });
      g.on("dragstart", () => {
        selectedRowId = row.id; selectedBoxId = null; menu.visible = false;
        stage.draggable(false);
      });
      g.on("dragend", () => {
        stage.draggable(true);
        const cx = g.x() + r.w / 2, cy = g.y() + r.h / 2;
        const box = odlingBoxAt(cx, cy);
        const fitted = box
          ? fitRow(row.plantId, row.count, row.rotationDeg, cx, cy, box, row.id)
          : null;
        if (fitted) {
          row.x = fitted.x; row.y = fitted.y;
          row.boxId = fitted.boxId; row.compression = fitted.compression;
          commit();
        }
        renderRows(); // ogiltig flytt ⇒ tillbaka
      });
      g.on("click tap", (e) => {
        e.cancelBubble = true;
        if (placing || placingRow) return;
        selectedRowId = row.id; selectedBoxId = null; menu.visible = false;
        renderAll();
      });
      g.on("contextmenu", (e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        selectedRowId = row.id; selectedBoxId = null;
        renderAll();
        const rc = container.getBoundingClientRect();
        menu = {
          visible: true, kind: "row", id: row.id,
          x: Math.min(e.evt.clientX - rc.left, rc.width - 180),
          y: Math.min(e.evt.clientY - rc.top, rc.height - 170),
        };
      });
      g.on("mouseenter", () => { container.style.cursor = "move"; container.title = title; });
      g.on("mouseleave", () => {
        container.style.cursor = placing || placingRow ? "crosshair" : "grab";
        container.title = "";
      });
      rowLayer.add(g);
    }
    rowLayer.batchDraw();
  }

  // --- rendering: boxar ---
  function renderBoxes() {
    boxLayer.destroyChildren();
    const sw = () => 1 / stage.scaleX();

    for (const b of garden.boxes) {
      const g = new Konva.Group({ x: b.x, y: b.y, draggable: !garden.locked, id: String(b.id) });

      const isGang = b.typ === "gang";
      g.add(new Konva.Rect({
        width: b.w, height: b.h,
        fill: isGang ? "#cfc8b8" : "#8d6e63",
        stroke: selectedBoxId === b.id ? "#2e5d1e" : isGang ? "#a89d87" : "#5d4037",
        strokeWidth: (selectedBoxId === b.id ? 3 : 1.5) * sw(),
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

      g.dragBoundFunc(function (pos) {
        const s = stage.scaleX();
        const gx = snap((pos.x - stage.x()) / s);
        const gy = snap((pos.y - stage.y()) / s);
        return { x: gx * s + stage.x(), y: gy * s + stage.y() };
      });

      g.on("dragstart", () => {
        selectedBoxId = b.id; selectedRowId = null; menu.visible = false;
        stage.draggable(false);
        renderBoxes();
      });
      g.on("dragend", () => {
        stage.draggable(true);
        const cand = { ...b, x: snap(g.x()), y: snap(g.y()) };
        if (boxValid(cand, b.id)) {
          const dx = cand.x - b.x, dy = cand.y - b.y;
          b.x = cand.x; b.y = cand.y;
          // flytta med boxens rader
          for (const row of garden.rows) {
            if (row.boxId === b.id) { row.x += dx; row.y += dy; }
          }
          commit();
        }
        renderAll();
      });

      g.on("click tap", (e) => {
        e.cancelBubble = true;
        if (placing || placingRow) return;
        selectedBoxId = b.id; selectedRowId = null; menu.visible = false;
        renderBoxes();
      });

      g.on("contextmenu", (e) => {
        e.evt.preventDefault();
        e.cancelBubble = true;
        if (garden.locked) return;
        selectedBoxId = b.id; selectedRowId = null;
        renderBoxes();
        const rc = container.getBoundingClientRect();
        menu = {
          visible: true, kind: "box", id: b.id,
          x: Math.min(e.evt.clientX - rc.left, rc.width - 180),
          y: Math.min(e.evt.clientY - rc.top, rc.height - 190),
        };
      });

      g.on("mouseenter", () => { if (!placing && !placingRow && !garden.locked) container.style.cursor = "move"; });
      g.on("mouseleave", () => { container.style.cursor = placing || placingRow ? "crosshair" : "grab"; });

      boxLayer.add(g);
    }
    boxLayer.batchDraw();
  }

  function renderAll() { renderBoxes(); renderRows(); }

  // --- kontextmenyns åtgärder ---
  function menuBox(): Box | undefined {
    return menu.kind === "box" ? garden.boxes.find(b => b.id === menu.id) : undefined;
  }
  function menuRow(): PlantRow | undefined {
    return menu.kind === "row" ? garden.rows.find(r => r.id === menu.id) : undefined;
  }

  function actDuplicate() {
    const b = menuBox();
    if (b) {
      const copy: Box = { ...b, id: nextId++ };
      const tries = [
        { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h },
        { x: b.x - b.w, y: b.y }, { x: b.x, y: b.y - b.h },
      ];
      let placed = false;
      for (const t of tries) {
        const cand = { ...copy, ...t };
        if (boxValid(cand)) { copy.x = cand.x; copy.y = cand.y; placed = true; break; }
      }
      if (!placed) {
        let dd = GRID_CM * 2;
        while (dd < garden.widthCm) {
          const cand = { ...copy, x: b.x + dd, y: b.y + dd };
          if (boxValid(cand)) { copy.x = cand.x; copy.y = cand.y; placed = true; break; }
          dd += GRID_CM * 2;
        }
      }
      if (placed) { garden.boxes.push(copy); selectedBoxId = copy.id; commit(); renderAll(); }
    }
    const row = menuRow();
    if (row) {
      const d = plantById[row.plantId].avstand_cm;
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (box) {
        const vertical = row.rotationDeg % 180 !== 0;
        // lägg dubbletten en radbredd åt sidan (tvärs raden)
        const offsets = vertical ? [[d, 0], [-d, 0]] : [[0, d], [0, -d]];
        for (const [dx, dy] of offsets) {
          const fitted = fitRow(row.plantId, row.count, row.rotationDeg, row.x + dx, row.y + dy, box);
          if (fitted && Math.abs(fitted.x - row.x) + Math.abs(fitted.y - row.y) > 0.01) {
            garden.rows.push({ ...fitted, id: nextId++ });
            commit(); renderRows();
            break;
          }
        }
      }
    }
    menu.visible = false;
  }

  function actRotate() {
    const b = menuBox();
    if (b) {
      const cand = { ...b, w: b.h, h: b.w };
      cand.x = Math.min(cand.x, garden.widthCm - cand.w);
      cand.y = Math.min(cand.y, garden.heightCm - cand.h);
      if (boxValid(cand, b.id)) { Object.assign(b, cand); commit(); renderAll(); }
    }
    const row = menuRow();
    if (row) {
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (box) {
        const fitted = fitRow(row.plantId, row.count, (row.rotationDeg + 90) % 180, row.x, row.y, box, row.id);
        if (fitted) {
          row.rotationDeg = fitted.rotationDeg;
          row.x = fitted.x; row.y = fitted.y; row.compression = fitted.compression;
          commit(); renderRows();
        }
      }
    }
    menu.visible = false;
  }

  function actCount() {
    const row = menuRow(); if (!row) return;
    const v = prompt("Antal plantor i raden:", String(row.count));
    if (v !== null) {
      const n = Math.max(1, Math.round(Number(v) || row.count));
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (box) {
        const fitted = fitRow(row.plantId, n, row.rotationDeg, row.x, row.y, box, row.id);
        if (fitted) {
          row.count = n; row.x = fitted.x; row.y = fitted.y; row.compression = fitted.compression;
          commit(); renderRows();
        } else {
          alert(`${n} st ryms inte här (max 20 % komprimering).`);
        }
      }
    }
    menu.visible = false;
  }

  function actRename() {
    const b = menuBox(); if (!b) return;
    const name = prompt("Namn på odlingsrutan:", b.label);
    if (name !== null) { b.label = name.trim(); commit(); renderBoxes(); }
    menu.visible = false;
  }

  function actDelete() {
    if (menu.kind === "box") {
      garden.boxes = garden.boxes.filter(b => b.id !== menu.id);
      garden.rows = garden.rows.filter(r => r.boxId !== menu.id);
      selectedBoxId = null;
    } else {
      garden.rows = garden.rows.filter(r => r.id !== menu.id);
      selectedRowId = null;
    }
    commit(); renderAll();
    menu.visible = false;
  }

  // --- grid ---
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
    renderAll();
  }

  export function refresh() {
    if (stage) fitToView();
  }

  // rita om utan att röra zoom/position (t.ex. vid lås/upplås)
  export function redraw() {
    if (!stage) return;
    if (garden.locked) { menu.visible = false; selectedBoxId = null; }
    renderAll();
  }

  onMount(() => {
    nextId = [...garden.boxes, ...garden.rows].reduce((m, o) => Math.max(m, o.id), 0) + 1;

    stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true,
    });
    gridLayer = new Konva.Layer({ listening: false });
    boxLayer = new Konva.Layer();
    rowLayer = new Konva.Layer();
    ghostLayer = new Konva.Layer({ listening: false });
    stage.add(gridLayer, boxLayer, rowLayer, ghostLayer);

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
      renderAll();
      moveGhost();
    });

    stage.on("mousemove", moveGhost);

    stage.on("click tap", (e) => {
      menu.visible = false;
      if (placing) { moveGhost(); tryPlaceBox(); return; }
      if (placingRow) { moveGhost(); tryPlaceRow(); return; }
      if (e.target === stage || e.target.getLayer() === gridLayer) {
        selectedBoxId = null; selectedRowId = null;
        renderAll();
      }
    });

    container.addEventListener("contextmenu", (e) => e.preventDefault());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cancelPlacing(); menu.visible = false; }
      if (e.key.toLowerCase() === "r" && placingRow) {
        placingRow.rotationDeg = (placingRow.rotationDeg + 90) % 180;
        moveGhost();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !(e.target instanceof HTMLInputElement)) {
        if (selectedRowId !== null) {
          garden.rows = garden.rows.filter(r => r.id !== selectedRowId);
          selectedRowId = null;
          commit(); renderAll();
        } else if (selectedBoxId !== null && !garden.locked) {
          garden.boxes = garden.boxes.filter(b => b.id !== selectedBoxId);
          garden.rows = garden.rows.filter(r => r.boxId !== selectedBoxId);
          selectedBoxId = null;
          commit(); renderAll();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    let userAdjusted = false;
    stage.on("wheel dragend", () => { userAdjusted = true; });
    const ro = new ResizeObserver(() => {
      stage.width(container.clientWidth);
      stage.height(container.clientHeight);
      if (userAdjusted) { drawGrid(); renderAll(); }
      else fitToView();
    });
    ro.observe(container);
    fitToView();

    if (import.meta.env.DEV) {
      // testkrok för utveckling: placera rad programmatiskt (används ej i produktion)
      (window as any).__oc = {
        garden,
        placeRowAt(plantId: string, count: number, x: number, y: number, rot = 0) {
          const box = odlingBoxAt(x, y);
          const fitted = box ? fitRow(plantId, count, rot, x, y, box) : null;
          if (fitted) { garden.rows.push({ ...fitted, id: nextId++ }); renderAll(); commit(); }
          return fitted;
        },
      };
    }

    return () => { ro.disconnect(); window.removeEventListener("keydown", onKey); };
  });

  onDestroy(() => stage?.destroy());

  $: container && (container.style.cursor = placing || placingRow ? "crosshair" : "grab");
</script>

<div class="wrap">
  <div class="canvas" bind:this={container}></div>

  {#if placing}
    <div class="placebar">
      Placerar {placing.typ === "gang" ? "gång" : "odlingsruta"} {placing.w / 100}×{placing.h / 100} m —
      klicka för att placera · <b>Esc</b> avslutar
      <button on:click={cancelPlacing}>Klar</button>
    </div>
  {/if}
  {#if placingRow}
    <div class="placebar">
      Planterar {placingRow.count} × {plantById[placingRow.plantId].namn}
      (avstånd {plantById[placingRow.plantId].avstand_cm} cm) —
      klicka i en odlingsruta · <b>R</b> roterar · <b>Esc</b> avslutar
      <button on:click={cancelPlacing}>Klar</button>
    </div>
  {/if}

  {#if menu.visible}
    <div class="menu" style="left:{menu.x}px; top:{menu.y}px">
      <button on:click={actDuplicate}>⧉ Duplicera</button>
      <button on:click={actRotate}>⟳ Rotera 90°</button>
      {#if menu.kind === "row"}
        <button on:click={actCount}>🔢 Ändra antal…</button>
      {/if}
      {#if menu.kind === "box" && menuBox()?.typ === "odling"}
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
