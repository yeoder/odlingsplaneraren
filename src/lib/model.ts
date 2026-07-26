// Datamodell — alla mått i centimeter (heltal), snappgrid 5 cm.
export const GRID_CM = 5;

export interface Garden {
  widthCm: number;
  heightCm: number;
  sunDirectionDeg: number; // 0 = norr uppåt
  boxes: Box[];
  rows: PlantRow[];
}

export interface Box {
  id: number;
  typ: "odling" | "gang";
  x: number; // cm, övre vänstra hörnet
  y: number;
  w: number;
  h: number;
  fukt: "låg" | "medel" | "hög";
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
  compression: number; // 0.8–1.0
}

export function newGarden(): Garden {
  return { widthCm: 800, heightCm: 500, sunDirectionDeg: 0, boxes: [], rows: [] };
}

export function snap(cm: number): number {
  return Math.round(cm / GRID_CM) * GRID_CM;
}

export function overlaps(a: Box, b: Box): boolean {
  // kant-mot-kant räknas INTE som överlapp
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
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
