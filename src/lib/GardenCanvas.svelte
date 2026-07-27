<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Konva from "konva";
  import {
    GRID_CM, MIN_COMPRESSION, MAX_COMPRESSION, MIN_ROW_COMPRESSION, rowComp, snap, overlaps, saveGarden, rowRect,
    rectsOverlap, rectInside, rotatedBox, rotatedRow, plantHeight,
    type Garden, type Box, type PlantRow, type Rect,
  } from "./model";
  import { plantById } from "./plants";
  import { formatCm } from "./rules";
  import {
    solPosition, skuggLangdCm, skuggAzimut, skuggOffset, platsByNamn, SASONGER, MIN_SOLHOJD,
  } from "./sun";
  import { staarIJord, hojdVidDatum, sasongensDatum } from "./schedule";

  export let garden: Garden;
  export let onchange: () => void = () => {};
  export let onselect: (sel: { kind: "box" | "row"; id: number } | null) => void = () => {};

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let gridLayer: Konva.Layer;
  let boxLayer: Konva.Layer;
  let shadowLayer: Konva.Layer;
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

  // hovertext som följer muspekaren
  let hover = { visible: false, x: 0, y: 0, namn: "", rad1: "", rad2: "", status: "" };

  // --- kompass: definierar vilket håll som är norr på planen ---
  // Samma vinkel används av skuggberäkningen, så bild och sol kan aldrig glida isär.
  let kompassEl: HTMLDivElement;
  let vrider = false;

  function vridTill(e: PointerEvent) {
    const r = kompassEl.getBoundingClientRect();
    const mx = r.left + r.width / 2, my = r.top + r.height / 2;
    // 0° = norr uppåt i bilden, växande medurs
    const vinkel = (Math.atan2(e.clientX - mx, my - e.clientY) * 180) / Math.PI;
    garden.sunDirectionDeg = Math.round(((vinkel % 360) + 360) % 360);
    garden = garden;
    renderShadows();
    commit();
  }
  function kompassNed(e: PointerEvent) {
    vrider = true;
    kompassEl.setPointerCapture(e.pointerId);
    vridTill(e);
  }
  function kompassRor(e: PointerEvent) { if (vrider) vridTill(e); }
  function kompassUpp(e: PointerEvent) {
    vrider = false;
    kompassEl.releasePointerCapture?.(e.pointerId);
  }
  function nollstallKompass() {
    garden.sunDirectionDeg = 0;
    garden = garden;
    renderShadows();
    commit();
  }

  $: solAzimut = garden.visaSkugga ? aktuellSol().sol : null;

  // Egen inmatningsdialog. window.prompt() finns inte i alla miljöer (kastar
  // "prompt() is not supported"), så namngivning och antal görs i appen i stället.
  let dialog: {
    visible: boolean; titel: string; varde: string; typ: "text" | "number";
    onOk: (v: string) => void;
  } = { visible: false, titel: "", varde: "", typ: "text", onOk: () => {} };
  let dialogInput: HTMLInputElement | undefined;

  function askInput(titel: string, varde: string, typ: "text" | "number", onOk: (v: string) => void) {
    dialog = { visible: true, titel, varde, typ, onOk };
    setTimeout(() => { dialogInput?.focus(); dialogInput?.select(); }, 0);
  }
  function dialogOk() {
    const v = dialog.varde;
    dialog = { ...dialog, visible: false };
    dialog.onOk(v);
  }
  function dialogCancel() { dialog = { ...dialog, visible: false }; }

  // Panoreringsläge: rutor och rader går inte att dra, bara vyn flyttas. Utan det
  // är det lätt att råka rycka med sig en planta när man vill förflytta sig i planen.
  export let panLage = false;

  // Under placering stängs panorering av: annars blir minsta musrörelse med knappen nere
  // ett scendrag istället för ett klick, och ingenting placeras.
  function syncInteractionMode() {
    if (!stage) return;
    const isPlacing = placing !== null || placingRow !== null;
    stage.draggable(!isPlacing);
    renderAll();
  }

  $: if (stage) { panLage; syncInteractionMode(); }

  export function startPlacing(typ: "odling" | "gang", wCm: number, hCm: number) {
    cancelPlacing();
    placing = { typ, w: snap(wCm), h: snap(hCm) };
    menu.visible = false;
    syncInteractionMode();
  }
  export function startPlacingRow(plantId: string, count: number) {
    cancelPlacing();
    placingRow = { plantId, count: Math.max(1, Math.round(count)), rotationDeg: 0 };
    menu.visible = false;
    syncInteractionMode();
  }
  export function cancelPlacing() {
    placing = null;
    placingRow = null;
    ghostGroup?.destroy();
    ghostGroup = null;
    ghostState = { valid: false };
    ghostLayer?.batchDraw();
    syncInteractionMode();
  }
  export function isPlacingRow(): boolean { return placingRow !== null; }

  function commit() {
    saveGarden(garden);
    onchange();
  }

  // Konva skickar "click" även för högerknappen, före "contextmenu". Utan den här
  // spärren hinner klick-hanteraren rita om (och förstöra) gruppen som just
  // högerklickades, så kontextmenyn aldrig öppnas.
  function isRightClick(e: Konva.KonvaEventObject<MouseEvent>): boolean {
    return (e.evt as MouseEvent)?.button === 2;
  }

  // --- validering ---
  function boxValid(b: Box, ignoreId?: number): boolean {
    if (b.x < 0 || b.y < 0 || b.x + b.w > garden.widthCm || b.y + b.h > garden.heightCm) return false;
    return !garden.boxes.some(o => o.id !== ignoreId && overlaps(b, o));
  }

  function boxRect(b: Box): Rect { return { x: b.x, y: b.y, w: b.w, h: b.h }; }

  // Prova att lägga en rad med mittpunkt nära (cx, cy) i boxen: returnerar justerad rad eller null.
  // Komprimerar automatiskt ner till MIN_COMPRESSION om raden är något för lång för boxen.
  // `wanted` = önskad avståndsfaktor (>1 = utglesad); krymps om raden inte får plats.
  function fitRow(plantId: string, count: number, rotationDeg: number,
                  cx: number, cy: number, box: Box, ignoreRowId?: number,
                  wanted = 1, wantedRow = 1): PlantRow | null {
    const plant = plantById[plantId];
    const iRad = plant.avstand_i_rad_cm;
    const vertical = rotationDeg % 180 !== 0;
    const along = vertical ? box.h : box.w;   // boxens mått längs raden
    const across = vertical ? box.w : box.h;  // tvärs raden

    // radavståndet krymps bara så långt som behövs för att rymmas på tvären
    let rowCompression = Math.min(Math.max(wantedRow, MIN_ROW_COMPRESSION), 1);
    if (plant.radavstand_cm * rowCompression > across) {
      rowCompression = across / plant.radavstand_cm;
      if (rowCompression < MIN_ROW_COMPRESSION) return null;
    }

    let compression = Math.min(Math.max(wanted, MIN_COMPRESSION), MAX_COMPRESSION);
    if (count * iRad * compression > along) {
      compression = along / (count * iRad);
      if (compression < MIN_COMPRESSION) return null; // mer än 20 % för trångt
    }

    const row: PlantRow = {
      id: -1, boxId: box.id, plantId, count,
      x: snap(cx), y: snap(cy), rotationDeg, compression, rowCompression,
    };
    // kläm in mittpunkten så rektangeln hamnar helt i boxen
    const r0 = rowRect(row, plant);
    row.x = snap(Math.min(Math.max(row.x, box.x + r0.w / 2), box.x + box.w - r0.w / 2));
    row.y = snap(Math.min(Math.max(row.y, box.y + r0.h / 2), box.y + box.h - r0.h / 2));
    const r = rowRect(row, plant);
    if (!rectInside(r, boxRect(box))) return null; // snap kan putta ut vid exakt passform
    // överlapp mot andra rader (oavsett box — rader ligger alltid i boxar)
    for (const q of garden.rows) {
      if (q.id === ignoreRowId) continue;
      if (rectsOverlap(r, rowRect(q, plantById[q.plantId]))) return null;
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
      const r = rowRect(preview, plant);
      g.add(new Konva.Rect({
        ...r, width: r.w, height: r.h,
        dash: [6, 4], stroke: "#c62828", fill: "#c6282822",
        strokeWidth: 2 / stage.scaleX(),
        cornerRadius: Math.min(plant.avstand_i_rad_cm, plant.radavstand_cm) / 2,
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
    const iRad = plant.avstand_i_rad_cm;
    const rAvst = plant.radavstand_cm;
    const r = rowRect(row, plant);
    const tight = row.compression < 0.999;
    const spread = row.compression > 1.001;
    const local = opts.ghost ? { x: r.x, y: r.y } : { x: 0, y: 0 }; // riktiga rader ritas i grupp-koordinater
    const s = stage.scaleX();

    // fotavtryck
    g.add(new Konva.Rect({
      x: local.x, y: local.y, width: r.w, height: r.h,
      fill: plant.farg + "33",
      stroke: opts.ghost ? "#4e7a3a" : tight ? "#e6a700" : plant.farg,
      strokeWidth: (opts.ghost ? 2 : tight ? 2 : 1.2) / s,
      dash: opts.ghost ? [8, 4] : undefined,
      cornerRadius: Math.min(iRad, rAvst) / 2,
    }));

    const vertical = row.rotationDeg % 180 !== 0;
    const step = iRad * row.compression;

    // Radens kantlinjer visar radavståndet — bandets bredd är utrymmet raden tar
    // på tvären. Plantorna själva ritas som cirklar (avståndet i raden).
    if (!opts.ghost) {
      const kant = { stroke: plant.farg, strokeWidth: 1.4 / s, opacity: 0.75, listening: false };
      if (vertical) {
        g.add(new Konva.Line({ points: [local.x, local.y, local.x, local.y + r.h], ...kant }));
        g.add(new Konva.Line({ points: [local.x + r.w, local.y, local.x + r.w, local.y + r.h], ...kant }));
      } else {
        g.add(new Konva.Line({ points: [local.x, local.y, local.x + r.w, local.y], ...kant }));
        g.add(new Konva.Line({ points: [local.x, local.y + r.h, local.x + r.w, local.y + r.h], ...kant }));
      }
    }

    // Plantan är en cirkel med växtens avstånd i raden som diameter.
    const radie = iRad / 2 * 0.85;
    for (let i = 0; i < row.count; i++) {
      const off = (i + 0.5) * step - (row.count * step) / 2;
      const px = local.x + r.w / 2 + (vertical ? 0 : off);
      const py = local.y + r.h / 2 + (vertical ? off : 0);

      // Utglesad rad: streckad ring visar utrymmet plantan fått. Den fyllda cirkeln
      // hålls alltid på växtens verkliga mått – mer plats gör inte plantan större.
      if (spread && !opts.ghost) {
        g.add(new Konva.Circle({
          x: px, y: py, radius: step / 2 * 0.9,
          stroke: plant.farg, strokeWidth: 1 / s,
          dash: [4 / s, 3 / s], opacity: 0.5, listening: false,
        }));
      }

      g.add(new Konva.Circle({
        x: px, y: py, radius: radie,
        fill: plant.farg, opacity: opts.ghost ? 0.5 : 0.9,
        stroke: "#ffffff88", strokeWidth: 1 / s,
      }));

      if (radie * s >= 5) {
        g.add(new Konva.Text({
          x: px - radie, y: py - radie * 0.7,
          width: radie * 2, align: "center",
          text: plant.symbol, fontSize: radie * 1.2,
          listening: false,
        }));
      }
    }
    if (tight && !opts.ghost) {
      g.add(new Konva.Text({
        x: local.x + r.w - 14, y: local.y - 6, text: "⚠", fontSize: 14 / s,
        listening: false,
      }));
    }
  }

  // Namnskylt bredvid raden — liten, utanför fotavtrycket så den inte skymmer plantorna.
  function drawRowLabel(g: Konva.Group, row: PlantRow) {
    const plant = plantById[row.plantId];
    const r = rowRect(row, plant);
    const s = stage.scaleX();
    const fontSize = 11 / s;
    const text = `${row.count} × ${plant.namn}`;
    const padX = 4 / s, padY = 2 / s;
    const approxW = text.length * fontSize * 0.55 + padX * 2;
    const label = new Konva.Group({ x: r.w / 2 - approxW / 2, y: -(fontSize + padY * 2 + 3 / s) });
    label.add(new Konva.Rect({
      width: approxW, height: fontSize + padY * 2,
      fill: "#fffffff2", stroke: plant.farg, strokeWidth: 1 / s, cornerRadius: 3 / s,
    }));
    label.add(new Konva.Text({
      x: padX, y: padY, text, fontSize, fill: "#3e3a33",
    }));
    label.listening(false);
    g.add(label);
  }

  function renderRows() {
    rowLayer.destroyChildren();
    for (const row of garden.rows) {
      const plant = plantById[row.plantId];
      const r = rowRect(row, plant);
      const g = new Konva.Group({
        x: r.x, y: r.y, draggable: placing === null && placingRow === null && !panLage,
      });
      drawRowShape(g, row);
      if (garden.showLabels) drawRowLabel(g, row);

      if (selectedRowId === row.id) {
        g.add(new Konva.Rect({
          x: 0, y: 0, width: r.w, height: r.h,
          stroke: "#2e5d1e", strokeWidth: 2.5 / stage.scaleX(),
          dash: [4, 3], listening: false,
          cornerRadius: Math.min(plant.avstand_i_rad_cm, plant.radavstand_cm) / 2,
        }));
      }

      const faktisktCm = formatCm(Math.round(plant.avstand_i_rad_cm * row.compression * 10) / 10);
      const title = {
        namn: `${plant.symbol} ${row.count} × ${plant.namn}`,
        rad1: `${faktisktCm} cm i raden (rek. ${plant.avstand_i_rad_cm}) · ${plant.radavstand_cm} cm mellan rader`,
        rad2: `Höjd ${plantHeight(garden, plant.id, plant.hojd_cm)} cm`,
        status: row.compression < 0.999
          ? `⚠ ${Math.round((1 - row.compression) * 100)} % trängre än rekommenderat`
          : row.compression > 1.001
            ? `Utglesad ${Math.round((row.compression - 1) * 100)} %`
            : "",
      };

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
          ? fitRow(row.plantId, row.count, row.rotationDeg, cx, cy, box, row.id, row.compression, rowComp(row))
          : null;
        if (fitted) {
          row.x = fitted.x; row.y = fitted.y;
          row.boxId = fitted.boxId; row.compression = fitted.compression;
          commit();
        }
        renderRows(); // ogiltig flytt ⇒ tillbaka
      });
      g.on("click tap", (e) => {
        // vid placering: låt klicket nå scenen, den sköter placeringen
        if (placing || placingRow || isRightClick(e)) return;
        e.cancelBubble = true;
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
      g.on("mouseenter mousemove", () => {
        if (!placing && !placingRow) container.style.cursor = "move";
        const p = stage.getPointerPosition();
        if (p) hover = { visible: true, x: p.x, y: p.y, ...title };
      });
      g.on("mouseleave", () => {
        container.style.cursor = placing || placingRow ? "crosshair" : "grab";
        hover = { ...hover, visible: false };
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
      const isPlacing = placing !== null || placingRow !== null;
      const g = new Konva.Group({
        x: b.x, y: b.y, draggable: !garden.locked && !isPlacing && !panLage, id: String(b.id),
      });

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
        renderAll();
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
        // vid placering: låt klicket nå scenen, den sköter placeringen
        if (placing || placingRow || isRightClick(e)) return;
        e.cancelBubble = true;
        selectedBoxId = b.id; selectedRowId = null; menu.visible = false;
        renderAll();
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

  // --- skuggor (M4) ---
  // Skuggan ritas som ett svep: radens fotavtryck plus samma rektangel förskjuten
  // åt skuggans håll, sammanbundna till ett hölje.
  export function aktuellSol() {
    const plats = platsByNamn(garden.platsNamn);
    const sasong = SASONGER.find(s => s.id === garden.solSasong) ?? SASONGER[1];
    const frost = garden.sistaFrostDatum || "2026-05-15";
    const datum = sasongensDatum(frost, sasong.manad, sasong.dag);
    const sol = solPosition(plats, datum.getFullYear(), sasong.manad, sasong.dag, garden.solTimme);
    return { plats, sasong, sol, datum, frost };
  }

  function konvexHolje(punkter: { x: number; y: number }[]): number[] {
    const p = [...punkter].sort((a, b) => a.x - b.x || a.y - b.y);
    const kryss = (o: any, a: any, b: any) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const bygg = (pts: typeof p) => {
      const ut: typeof p = [];
      for (const pt of pts) {
        while (ut.length >= 2 && kryss(ut[ut.length - 2], ut[ut.length - 1], pt) <= 0) ut.pop();
        ut.push(pt);
      }
      ut.pop();
      return ut;
    };
    const holje = [...bygg(p), ...bygg([...p].reverse())];
    return holje.flatMap(pt => [pt.x, pt.y]);
  }

  function renderShadows() {
    shadowLayer.destroyChildren();
    if (!garden.visaSkugga) { shadowLayer.batchDraw(); return; }

    const { sol, datum, frost } = aktuellSol();
    if (!sol.uppe || sol.hojdGrader <= MIN_SOLHOJD) { shadowLayer.batchDraw(); return; }

    const az = skuggAzimut(sol.azimutGrader);
    for (const row of garden.rows) {
      const plant = plantById[row.plantId];
      // Växten kastar bara skugga när den faktiskt står i jorden vid det valda
      // datumet, och med den höjd den hunnit få då — inte sin fullvuxna höjd.
      if (!plant || !staarIJord(plant, frost, datum)) continue;
      const hojd = hojdVidDatum(plant, plantHeight(garden, plant.id, plant.hojd_cm), frost, datum);
      const langd = skuggLangdCm(hojd, sol.hojdGrader);
      if (langd < 5) continue;
      const { dx, dy } = skuggOffset(langd, az, garden.sunDirectionDeg);

      const r = rowRect(row, plant);
      const horn = [
        { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
        { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
      ];
      const alla = [...horn, ...horn.map(h => ({ x: h.x + dx, y: h.y + dy }))];
      shadowLayer.add(new Konva.Line({
        points: konvexHolje(alla),
        closed: true, fill: "#2b3a1a", opacity: 0.22, listening: false,
      }));
    }
    shadowLayer.batchDraw();
  }

  function renderAll() {
    renderBoxes();
    renderRows();
    renderShadows();
    onselect(getSelection());
  }

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
      const d = plantById[row.plantId].radavstand_cm;
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (box) {
        const vertical = row.rotationDeg % 180 !== 0;
        // lägg dubbletten ett radavstånd åt sidan (tvärs raden)
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

  // Roterar en box 90° tillsammans med sina plantrader. Returnerar false om det
  // inte går (boxen hamnar utanför/överlappar, eller någon rad inte längre får plats).
  function rotateBoxWithRows(b: Box): boolean {
    const nb = rotatedBox(b);
    if (!boxValid(nb, b.id)) return false;

    const rows = garden.rows.filter(r => r.boxId === b.id);
    const moved = rows.map(r => rotatedRow(r, b, nb));

    // varje roterad rad måste rymmas i den nya boxen och inte krocka med de andra
    const nbRect = { x: nb.x, y: nb.y, w: nb.w, h: nb.h };
    for (let i = 0; i < moved.length; i++) {
      const ri = rowRect(moved[i], plantById[moved[i].plantId]);
      if (!rectInside(ri, nbRect)) return false;
      for (let j = i + 1; j < moved.length; j++) {
        if (rectsOverlap(ri, rowRect(moved[j], plantById[moved[j].plantId]))) return false;
      }
    }

    Object.assign(b, nb);
    moved.forEach((m, i) => Object.assign(rows[i], m));
    return true;
  }

  function actRotate() {
    const b = menuBox();
    if (b) {
      if (rotateBoxWithRows(b)) { commit(); renderAll(); }
      else alert("Rutan kan inte roteras här – den (eller dess växter) får inte plats.");
    }
    const row = menuRow();
    if (row) {
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (box) {
        const fitted = fitRow(row.plantId, row.count, (row.rotationDeg + 90) % 180,
                             row.x, row.y, box, row.id, row.compression, rowComp(row));
        if (fitted) {
          row.rotationDeg = fitted.rotationDeg;
          row.x = fitted.x; row.y = fitted.y; row.compression = fitted.compression;
          commit(); renderRows();
        } else alert("Raden får inte plats roterad i rutan.");
      }
    }
    menu.visible = false;
  }

  function actCount() {
    const row = menuRow(); if (!row) return;
    menu.visible = false;
    askInput("Antal plantor i raden", String(row.count), "number", (v) => {
      const n = Math.max(1, Math.round(Number(v) || row.count));
      const box = garden.boxes.find(bb => bb.id === row.boxId);
      if (!box) return;
      const fitted = fitRow(row.plantId, n, row.rotationDeg, row.x, row.y, box, row.id,
                            row.compression, rowComp(row));
      if (fitted) {
        row.count = n; row.x = fitted.x; row.y = fitted.y; row.compression = fitted.compression;
        commit(); renderRows();
      } else {
        alert(`${n} st ryms inte här (max 20 % komprimering i raden).`);
      }
    });
  }

  // Sprider ut radens plantor så de fyller rutans längd (t.ex. 3 pumpor i en hel ruta),
  // eller återgår till växtens rekommenderade avstånd.
  function actSpacing(mode: "sprid" | "normal") {
    const row = menuRow(); if (!row) return;
    const box = garden.boxes.find(bb => bb.id === row.boxId);
    if (!box) return;
    const d = plantById[row.plantId].avstand_i_rad_cm;
    const along = row.rotationDeg % 180 !== 0 ? box.h : box.w;
    const wanted = mode === "sprid" ? along / (row.count * d) : 1;
    const fitted = fitRow(row.plantId, row.count, row.rotationDeg, row.x, row.y, box, row.id,
                          wanted, rowComp(row));
    if (fitted) {
      row.x = fitted.x; row.y = fitted.y; row.compression = fitted.compression;
      commit(); renderRows();
    }
    menu.visible = false;
  }

  // Radavståndet (radens bredd) kan kortas mer än avståndet i raden — i en bädd når
  // man in från sidan, så en del av standardavståndet är arbetsutrymme man inte behöver.
  function actRowSpacing(steg: number) {
    const row = menuRow(); if (!row) return;
    const box = garden.boxes.find(bb => bb.id === row.boxId);
    if (!box) return;
    const wantedRow = Math.min(Math.max(rowComp(row) + steg, MIN_ROW_COMPRESSION), 1);
    const fitted = fitRow(row.plantId, row.count, row.rotationDeg, row.x, row.y, box, row.id,
                          row.compression, wantedRow);
    if (fitted) {
      row.x = fitted.x; row.y = fitted.y;
      row.compression = fitted.compression; row.rowCompression = fitted.rowCompression;
      commit(); renderRows();
    }
    menu.visible = false;
  }

  function actRename() {
    const b = menuBox(); if (!b) return;
    menu.visible = false;
    askInput("Namn på odlingsrutan", b.label, "text", (name) => {
      b.label = name.trim();
      commit(); renderBoxes();
    });
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

  // --- API för verktygsradens knappar ---
  export function getSelection(): { kind: "box" | "row"; id: number } | null {
    if (selectedRowId !== null) return { kind: "row", id: selectedRowId };
    if (selectedBoxId !== null) return { kind: "box", id: selectedBoxId };
    return null;
  }

  export function rotateSelection() {
    const sel = getSelection();
    if (!sel) return;
    menu = { ...menu, kind: sel.kind, id: sel.id };
    actRotate();
  }

  export function deleteSelection() {
    const sel = getSelection();
    if (!sel) return;
    if (sel.kind === "box" && garden.locked) return;
    menu = { ...menu, kind: sel.kind, id: sel.id };
    actDelete();
  }

  export function selectRow(id: number) {
    selectedRowId = id;
    selectedBoxId = null;
    menu.visible = false;
    renderAll();
  }

  // Växtdatan justeras löpande (avstånden har t.ex. höjts till standardvärden).
  // En sparad odling kan därför innehålla rader som numera är för stora för sin ruta.
  // Passa in dem igen vid inläsning så inget ritas utanför rutan.
  function normalizeRows() {
    let andrat = false;
    for (const row of garden.rows) {
      const box = garden.boxes.find(b => b.id === row.boxId);
      if (!box) continue;
      const r = rowRect(row, plantById[row.plantId]);
      if (rectInside(r, boxRect(box))) continue;

      // först: behåll antalet, låt fitRow krympa avstånd/radavstånd och flytta in raden
      let fitted = fitRow(row.plantId, row.count, row.rotationDeg, row.x, row.y, box, row.id,
                          row.compression, rowComp(row));
      // annars: prova rotera 90°, ibland får raden plats på tvären
      if (!fitted) {
        fitted = fitRow(row.plantId, row.count, (row.rotationDeg + 90) % 180, row.x, row.y,
                        box, row.id, row.compression, rowComp(row));
      }
      if (fitted) {
        row.x = fitted.x; row.y = fitted.y; row.rotationDeg = fitted.rotationDeg;
        row.compression = fitted.compression; row.rowCompression = fitted.rowCompression;
        andrat = true;
      }
      // Får raden ändå inte plats lämnas den orörd — regelmotorn flaggar den
      // så användaren själv kan minska antalet eller flytta den.
    }
    // saveGarden, inte commit(): körs under onMount innan förälderns
    // komponentbindning finns, så onchange får inte anropas här.
    if (andrat) saveGarden(garden);
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
    shadowLayer = new Konva.Layer({ listening: false });
    rowLayer = new Konva.Layer();
    ghostLayer = new Konva.Layer({ listening: false });
    stage.add(gridLayer, boxLayer, shadowLayer, rowLayer, ghostLayer);

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
      // högerklick hanteras av contextmenu — annars stängs menyn direkt efter att den öppnats
      if ((e.evt as MouseEvent)?.button === 2) return;
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
    normalizeRows();
    fitToView();

    if (import.meta.env.DEV) {
      // testkrok för utveckling: placera rad programmatiskt (används ej i produktion)
      (window as any).__oc = {
        garden,
        menyState: () => menu,
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

  <div class="kompass" bind:this={kompassEl}
       on:pointerdown={kompassNed} on:pointermove={kompassRor} on:pointerup={kompassUpp}
       on:dblclick={nollstallKompass}
       title="Dra för att vrida planen så norr stämmer med verkligheten. Dubbelklick nollställer.">
    <div class="ros" style="transform: rotate({-garden.sunDirectionDeg}deg)">
      <span class="v n">N</span><span class="v o">Ö</span>
      <span class="v s">S</span><span class="v va">V</span>
      <span class="nal"></span>
    </div>
    {#if solAzimut?.uppe && solAzimut.hojdGrader > MIN_SOLHOJD}
      <!-- solen ritas av ::before, som bär förskjutningen ut mot kanten -->
      <span class="sol" style="transform: rotate({solAzimut.azimutGrader - garden.sunDirectionDeg}deg)"></span>
    {/if}
  </div>

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
      ({plantById[placingRow.plantId].avstand_i_rad_cm} cm i raden,
       {plantById[placingRow.plantId].radavstand_cm} cm radavstånd) —
      klicka i en odlingsruta · <b>R</b> roterar · <b>Esc</b> avslutar
      <button on:click={cancelPlacing}>Klar</button>
    </div>
  {/if}

  {#if hover.visible && !placing && !placingRow}
    <div class="tooltip" style="left:{hover.x + 14}px; top:{hover.y + 14}px">
      <b>{hover.namn}</b>
      <span>{hover.rad1}</span>
      <span>{hover.rad2}</span>
      {#if hover.status}<span class="tipstatus">{hover.status}</span>{/if}
    </div>
  {/if}

  {#if menu.visible}
    <div class="menu" style="left:{menu.x}px; top:{menu.y}px">
      <button on:click={actDuplicate}>⧉ Duplicera</button>
      <button on:click={actRotate}>⟳ Rotera 90°</button>
      {#if menu.kind === "row"}
        <button on:click={actCount}>🔢 Ändra antal…</button>
        <button on:click={() => actSpacing("sprid")}>↔ Sprid ut i rutan</button>
        <button on:click={() => actSpacing("normal")}>⇥ Normalt avstånd</button>
        <button on:click={() => actRowSpacing(-0.1)}>⇕ Smalare rad</button>
        <button on:click={() => actRowSpacing(0.1)}>⇕ Bredare rad</button>
      {/if}
      {#if menu.kind === "box" && menuBox()?.typ === "odling"}
        <button on:click={actRename}>✏️ Namnge…</button>
      {/if}
      <button class="danger" on:click={actDelete}>🗑 Ta bort</button>
    </div>
  {/if}

  {#if dialog.visible}
    <div class="dlg-backdrop" on:click={dialogCancel}>
      <div class="dlg" on:click|stopPropagation>
        <label for="dlg-input">{dialog.titel}</label>
        <input id="dlg-input" bind:this={dialogInput} type={dialog.typ} bind:value={dialog.varde}
               on:keydown={(e) => { if (e.key === "Enter") dialogOk(); if (e.key === "Escape") dialogCancel(); }} />
        <div class="dlg-btns">
          <button on:click={dialogCancel}>Avbryt</button>
          <button class="primary" on:click={dialogOk}>OK</button>
        </div>
      </div>
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
  .kompass {
    position: absolute; top: 10px; right: 10px; z-index: 15;
    width: 74px; height: 74px; border-radius: 50%;
    background: #fffffff2; border: 1px solid #d8d2c4; box-shadow: 0 2px 8px #0002;
    cursor: grab; touch-action: none; user-select: none;
  }
  .kompass:active { cursor: grabbing; }
  .ros { position: absolute; inset: 0; }
  .ros .v {
    position: absolute; font-size: 0.66rem; font-weight: 700; color: #8a8371;
    left: 50%; top: 50%; transform-origin: center;
  }
  .ros .n  { transform: translate(-50%, -50%) translateY(-27px); color: #b3402a; }
  .ros .s  { transform: translate(-50%, -50%) translateY(27px); }
  .ros .o  { transform: translate(-50%, -50%) translateX(27px); }
  .ros .va { transform: translate(-50%, -50%) translateX(-27px); }
  .ros .nal {
    position: absolute; left: 50%; top: 12px; width: 2px; height: 25px;
    background: linear-gradient(#b3402a 0 60%, #c9c1ae 60% 100%);
    transform: translateX(-50%); border-radius: 1px;
  }
  .kompass .sol {
    position: absolute; left: 50%; top: 50%; font-size: 0.8rem;
    width: 0; height: 0; display: grid; place-items: center;
    transform-origin: center;
  }
  .kompass .sol::before {
    content: "☀️"; position: absolute; transform: translateY(-30px);
  }
  .tooltip {
    position: absolute; z-index: 20; pointer-events: none;
    background: #fffffff5; border: 1px solid #d8d2c4; border-radius: 6px;
    padding: 6px 9px; font-size: 0.75rem; line-height: 1.35;
    box-shadow: 0 2px 10px #0003; display: flex; flex-direction: column;
    max-width: 220px; color: #3e3a33;
  }
  .tooltip b { font-size: 0.82rem; }
  .tooltip span { color: #6d6757; }
  .tooltip .tipstatus { color: #a07800; font-weight: 600; }
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

  .dlg-backdrop {
    position: absolute; inset: 0; z-index: 30; background: #2e2a2233;
    display: flex; align-items: center; justify-content: center;
  }
  .dlg {
    background: #fff; border: 1px solid #d8d2c4; border-radius: 10px;
    padding: 16px; min-width: 260px; box-shadow: 0 6px 24px #0004;
    display: flex; flex-direction: column; gap: 8px;
  }
  .dlg label { font-size: 0.85rem; font-weight: 600; }
  .dlg input {
    border: 1px solid #d8d2c4; border-radius: 5px; padding: 7px 9px; font-size: 0.9rem;
  }
  .dlg-btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  .dlg-btns button {
    border: 1px solid #d8d2c4; border-radius: 6px; background: #faf8f3;
    padding: 6px 14px; cursor: pointer; font-size: 0.85rem;
  }
  .dlg-btns button.primary { background: #4e7a3a; color: #fff; border-color: #4e7a3a; }
</style>
