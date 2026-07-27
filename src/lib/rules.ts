// Regelmotor — rena funktioner av trädgårdens data, inga sidoeffekter.
// Trängsel- och skuggvarningar. Kompanjon- och fuktregler kommer i M3.
import {
  MIN_COMPRESSION, rowComp, rowRect, rectInside, rectsOverlap, plantHeight,
  type Garden, type Rect,
} from "./model";
import { plantById } from "./plants";
import {
  solPosition, skuggLangdCm, skuggAzimut, skuggOffset, platsByNamn, SASONGER, MIN_SOLHOJD,
} from "./sun";

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

  out.push(...skuggVarningar(garden));
  return out;
}

// Skuggvarningar: en hög rad som skuggar en lägre solälskande rad.
// FÖRENKLING: skuggan approximeras med sitt omslutande rektangelområde, och bara
// växternas egna skuggor räknas — hus, staket och träd finns inte i modellen.
function skuggVarningar(garden: Garden): Warning[] {
  const ut: Warning[] = [];
  if (!garden.visaSkugga) return ut;

  const plats = platsByNamn(garden.platsNamn);
  const sasong = SASONGER.find(s => s.id === garden.solSasong) ?? SASONGER[1];
  const ar = new Date(garden.sistaFrostDatum || "2026-05-15").getFullYear();
  const sol = solPosition(plats, ar, sasong.manad, sasong.dag, garden.solTimme);
  if (!sol.uppe || sol.hojdGrader <= MIN_SOLHOJD) return ut;

  const az = skuggAzimut(sol.azimutGrader);
  const tid = `${sasong.namn.toLowerCase()} kl ${String(garden.solTimme).padStart(2, "0")}`;

  for (const kastare of garden.rows) {
    const pk = plantById[kastare.plantId];
    if (!pk) continue;
    const hojdK = plantHeight(garden, pk.id, pk.hojd_cm);
    const langd = skuggLangdCm(hojdK, sol.hojdGrader);
    if (langd < 10) continue;

    const rk = rowRect(kastare, pk);
    const { dx, dy } = skuggOffset(langd, az, garden.sunDirectionDeg);
    const skugga: Rect = {
      x: Math.min(rk.x, rk.x + dx),
      y: Math.min(rk.y, rk.y + dy),
      w: rk.w + Math.abs(dx),
      h: rk.h + Math.abs(dy),
    };

    for (const traffad of garden.rows) {
      if (traffad.id === kastare.id) continue;
      const pt = plantById[traffad.plantId];
      if (!pt) continue;
      const hojdT = plantHeight(garden, pt.id, pt.hojd_cm);
      if (hojdT >= hojdK * 0.8) continue; // ungefär lika hög — skuggar inte nämnvärt
      if (!rectsOverlap(skugga, rowRect(traffad, pt))) continue;

      const solalskare = pt.solbehov === "sol";
      ut.push({
        id: `skugga-${kastare.id}-${traffad.id}`,
        niva: solalskare ? "varning" : "info",
        rubrik: solalskare
          ? `${pt.namn} skuggas av ${pk.namn}`
          : `${pt.namn} står i skugga av ${pk.namn}`,
        text: solalskare
          ? `${pk.namn} (${hojdK} cm) kastar ${Math.round(langd)} cm skugga ${tid} och ` +
            `täcker ${pt.namn}, som vill ha full sol. Flytta den lägre raden till ` +
            `solsidan eller byt plats på raderna.`
          : `${pk.namn} (${hojdK} cm) skuggar ${pt.namn} ${tid} – men ${pt.namn} ` +
            `trivs i ${pt.solbehov}, så det är snarare en fördel.`,
        rowId: traffad.id,
      });
    }
  }
  return ut;
}

export const TRANGT_GRANS_TEXT =
  `Under ${Math.round(MIN_COMPRESSION * 100)} % av rekommenderat avstånd går det inte att plantera.`;
