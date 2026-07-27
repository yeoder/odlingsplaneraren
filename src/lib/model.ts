// Datamodell — alla mått i centimeter (heltal), snappgrid 5 cm.
export const GRID_CM = 5;

export interface Garden {
  widthCm: number;
  heightCm: number;
  sunDirectionDeg: number; // 0 = norr uppåt
  locked: boolean; // låst layout: boxar kan inte flyttas/ändras, bara planteras i
  showLabels: boolean; // visa namnskyltar vid varje rad
  plantHeights: Record<string, number>; // användarens höjdjusteringar per växt (cm)
  boxes: Box[];
  rows: PlantRow[];
}

// Boxen har ingen egen fuktnivå — vilken fukt boxen bör hållas i härleds från
// vattenbehovet hos de växter som planteras i den (regelmotorn varnar vid blandning).
export interface Box {
  id: number;
  typ: "odling" | "gang";
  x: number; // cm, övre vänstra hörnet
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface PlantRow {
  id: number;
  boxId: number;
  plantId: string;
  count: number;
  x: number; // cm, radens mittpunkt
  y: number;
  rotationDeg: number;
  // Avståndsfaktor mot växtens rekommenderade avstånd.
  // < 1 = trängre än rekommenderat (varnas), 1 = precis rätt, > 1 = utglesat.
  compression: number;
}

export function newGarden(): Garden {
  return {
    widthCm: 800, heightCm: 500, sunDirectionDeg: 0, locked: false,
    showLabels: false, plantHeights: {}, boxes: [], rows: [],
  };
}

export function snap(cm: number): number {
  return Math.round(cm / GRID_CM) * GRID_CM;
}

// Hur tätt en plantrad får tryckas ihop (0.8 = 20 % under rek. avstånd)
export const MIN_COMPRESSION = 0.8;
// Hur glest den får spridas ut (3 = tredubbelt avstånd, för t.ex. färre pumpor i en hel ruta)
export const MAX_COMPRESSION = 3;

export interface Rect { x: number; y: number; w: number; h: number }

// Minsta delen av en växt som geometrin behöver: avstånd längs raden och mellan rader.
export interface Spacing {
  avstand_i_rad_cm: number;
  radavstand_cm: number;
}

// Plantradens fotavtryck i cm (rektangel runt mittpunkten, roterad i 90°-steg).
// Längden styrs av avståndet i raden (× komprimering), bredden av radavståndet —
// det är radavståndet som håller isär två rader intill varandra.
export function rowRect(r: PlantRow, s: Spacing): Rect {
  const L = r.count * s.avstand_i_rad_cm * r.compression;
  const W = s.radavstand_cm;
  const vertical = r.rotationDeg % 180 !== 0;
  const w = vertical ? W : L;
  const h = vertical ? L : W;
  return { x: r.x - w / 2, y: r.y - h / 2, w, h };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function rectInside(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function overlaps(a: Box, b: Box): boolean {
  // kant-mot-kant räknas INTE som överlapp
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Boxen roterad 90° medurs kring sin egen mitt.
export function rotatedBox(b: Box): Box {
  return {
    ...b,
    w: b.h, h: b.w,
    x: snap(b.x + b.w / 2 - b.h / 2),
    y: snap(b.y + b.h / 2 - b.w / 2),
  };
}

// En rads nya läge när dess box roteras 90° medurs. Räknas i boxens lokala
// koordinater, så resultatet är exakt oavsett var boxens mitt hamnar i rutnätet:
// en punkt (lx, ly) i den gamla boxen hamnar på (gammal höjd − ly, lx) i den nya.
export function rotatedRow(r: PlantRow, oldBox: Box, newBox: Box): PlantRow {
  const lx = r.x - oldBox.x;
  const ly = r.y - oldBox.y;
  return {
    ...r,
    x: snap(newBox.x + (oldBox.h - ly)),
    y: snap(newBox.y + lx),
    rotationDeg: (r.rotationDeg + 90) % 180,
  };
}

// Växtens höjd med användarens ev. justering (för skuggberäkning i M4).
export function plantHeight(garden: Garden, plantId: string, standardHojd: number): number {
  return garden.plantHeights?.[plantId] ?? standardHojd;
}

const KEY = "odlingsplaneraren";

export function loadGarden(): Garden {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newGarden(), ...JSON.parse(raw) };
  } catch { /* korrupt data → börja om */ }
  return newGarden();
}

export function saveGarden(g: Garden): void {
  localStorage.setItem(KEY, JSON.stringify(g));
}
