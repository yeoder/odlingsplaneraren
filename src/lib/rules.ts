// Regelmotor — rena funktioner av trädgårdens data, inga sidoeffekter.
// Trängsel- och skuggvarningar. Kompanjon- och fuktregler kommer i M3.
import {
  MIN_COMPRESSION, rowComp, rowRect, rectInside, plantHeight, type Garden,
} from "./model";
import { plantById } from "./plants";
import { skuggAnalys, LJUSFORLUST_NOTERING, LJUSFORLUST_VARNING } from "./shade";
import { fuktKonflikter } from "./moisture";
import { grannKonflikter, grannPlus, konfliktText } from "./companions";

export interface Warning {
  id: string;
  niva: "varning" | "info";
  rubrik: string;
  text: string;
  rowId?: number;
}

// Avrundar till hela cm, men behåller en decimal när det annars ser ut som samma tal
// (7,5 cm ska inte skrivas "8 cm i stället för 8 cm").
export function formatCm(v: number): string {
  return Number.isInteger(v) ? `${v}` : v.toFixed(1).replace(".", ",");
}

export function computeWarnings(garden: Garden): Warning[] {
  const out: Warning[] = [];

  for (const row of garden.rows) {
    const plant = plantById[row.plantId];
    if (!plant) continue;

    const faktisktCm = formatCm(Math.round(plant.avstand_i_rad_cm * row.compression * 10) / 10);
    const rekCm = formatCm(plant.avstand_i_rad_cm);

    // Raden ligger utanför sin ruta — kan hända om växtdatan ändrats sedan odlingen
    // sparades och raden inte gick att passa in automatiskt vid inläsning.
    const box = garden.boxes.find(b => b.id === row.boxId);
    if (box && !rectInside(rowRect(row, plant), { x: box.x, y: box.y, w: box.w, h: box.h })) {
      out.push({
        id: `utanfor-${row.id}`,
        niva: "varning",
        rubrik: `${row.count} × ${plant.namn} ligger utanför odlingsrutan`,
        text: `Raden får inte plats i sin ruta med nuvarande avstånd ` +
          `(${plant.avstand_i_rad_cm}×${plant.radavstand_cm} cm). ` +
          `Minska antalet, gör raden smalare eller flytta den till en större ruta.`,
        rowId: row.id,
      });
    }

    if (row.compression < 0.999) {
      const procentTrangre = Math.round((1 - row.compression) * 100);
      out.push({
        id: `trangt-${row.id}`,
        niva: "varning",
        rubrik: `${row.count} × ${plant.namn} står trångt`,
        text: `Plantorna står ${procentTrangre} % tätare än rekommenderat i raden ` +
          `(${faktisktCm} cm i stället för ${rekCm} cm). ` +
          `Det går att odla så, men räkna med mindre plantor och sämre luftcirkulation. ` +
          `Minska antalet eller använd en längre odlingsruta för fullt avstånd.`,
        rowId: row.id,
      });
    } else if (row.compression > 1.001) {
      const procentGlesare = Math.round((row.compression - 1) * 100);
      out.push({
        id: `glest-${row.id}`,
        niva: "info",
        rubrik: `${row.count} × ${plant.namn} står glest`,
        text: `Plantorna har ${procentGlesare} % mer utrymme än rekommenderat ` +
          `(${faktisktCm} cm i stället för ${rekCm} cm). ` +
          `Det är helt i sin ordning – plantorna får gott om plats.`,
        rowId: row.id,
      });
    }

    // Kortat radavstånd bedöms mildare än trängsel i raden: en del av
    // standardavståndet är arbetsutrymme som en odlingsbädd inte behöver.
    const rk = rowComp(row);
    if (rk < 0.999) {
      const procent = Math.round((1 - rk) * 100);
      const faktisktRad = formatCm(Math.round(plant.radavstand_cm * rk * 10) / 10);
      out.push({
        id: `smalrad-${row.id}`,
        niva: procent > 25 ? "varning" : "info",
        rubrik: `${plant.namn}: radavståndet är kortat ${procent} %`,
        text: `Raden är ${faktisktRad} cm bred i stället för ${formatCm(plant.radavstand_cm)} cm. ` +
          `En del av standardavståndet är arbetsutrymme för att komma åt raden – i en ` +
          `odlingsbädd når man in från sidan, så det går ofta bra att korta. ` +
          `Blir det för trångt tappar plantorna ljus och luft nertill.`,
        rowId: row.id,
      });
    }
  }

  out.push(...fuktVarningar(garden));
  out.push(...kompanjonVarningar(garden));
  out.push(...skuggVarningar(garden));
  return out;
}

// Fukt: rutan kan inte vattnas rätt om både torr- och fuktälskande växter delar den.
function fuktVarningar(garden: Garden): Warning[] {
  return fuktKonflikter(garden).map(f => ({
    id: `fukt-${f.boxId}`,
    niva: "varning" as const,
    rubrik: `Rutan kan inte vattnas rätt åt båda hållen`,
    text: `${f.torra.join(", ")} vill ha det torrt mellan vattningarna medan ` +
      `${f.blota.join(", ")} vill stå jämnt fuktigt. I samma ruta ${f.sasongNamn.toLowerCase()} ` +
      `får du välja vilken som ska må bra – den andra ruttnar eller torkar. ` +
      `Flytta den ena till en egen ruta.`,
  }));
}

// Kompanjoner: dåliga grannar varnas, bra kombinationer noteras.
function kompanjonVarningar(garden: Garden): Warning[] {
  const ut: Warning[] = grannKonflikter(garden).map(k => ({
    id: k.id,
    niva: (k.sammaRuta ? "varning" : "info") as "varning" | "info",
    rubrik: k.sammaRuta
      ? `${k.aNamn} + ${k.bNamn} bör inte stå tillsammans`
      : `${k.aNamn} och ${k.bNamn} står i grannrutor`,
    text: konfliktText(k),
    rowId: k.rowId,
  }));

  for (const p of grannPlus(garden)) {
    ut.push({
      id: p.id,
      niva: "info",
      rubrik: `${p.aNamn} + ${p.bNamn} trivs ihop`,
      text: `Klassisk samplantering – de gynnar varandra i samma ruta.`,
      rowId: p.rowId,
    });
  }
  return ut;
}

// Skuggvarningar bygger på hela dygnets ljus, inte på det värsta ögonblicket.
// Se shade.ts för resonemanget: nästan varje rad skuggas till 90 % någon gång på
// morgonen eller kvällen, så toppvärden ger bara brus. Varning ges först när
// växten faktiskt får för få soltimmar för sitt läge.
//
// FÖRENKLING: bara växternas egna skuggor räknas — hus, staket, häckar och träd
// utanför odlingen påverkar minst lika mycket men finns inte i modellen.
function skuggVarningar(garden: Garden): Warning[] {
  return skuggAnalys(garden)
    .filter(p => !p.farSolNog && p.ljusforlust >= LJUSFORLUST_NOTERING)
    .map(p => {
      const forlust = Math.round(p.ljusforlust * 100);
      const varning = p.ljusforlust >= LJUSFORLUST_VARNING;
      const bov = p.kallor[0];
      const avVem = bov ? ` Mest skugga kommer från ${bov.namn}.` : "";
      return {
        id: `skugga-${p.rowId}`,
        niva: varning ? "varning" : "info",
        rubrik: `${p.namn} får bara ~${p.soltimmar} h sol (behöver ${p.kravTimmar} h)`,
        text: `Vid ${p.sasongNamn.toLowerCase()} skuggas ungefär ${forlust} % av dagens ljus ` +
          `bort från raden med ${p.namn}, som vill ha ${p.solbehov}.${avVem} ` +
          `Flytta raden till solsidan eller byt plats med en lägre gröda.`,
        rowId: p.rowId,
      } satisfies Warning;
    });
}

export const TRANGT_GRANS_TEXT =
  `Under ${Math.round(MIN_COMPRESSION * 100)} % av rekommenderat avstånd går det inte att plantera.`;
