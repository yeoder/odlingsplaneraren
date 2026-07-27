// Regelmotor — rena funktioner av trädgårdens data, inga sidoeffekter.
// Just nu: trängselvarningar. Kompanjon-, fukt- och skuggregler kommer i M3/M4.
import { MIN_COMPRESSION, rowComp, type Garden } from "./model";
import { plantById } from "./plants";

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

  return out;
}

export const TRANGT_GRANS_TEXT =
  `Under ${Math.round(MIN_COMPRESSION * 100)} % av rekommenderat avstånd går det inte att plantera.`;
