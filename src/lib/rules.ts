// Regelmotor — rena funktioner av trädgårdens data, inga sidoeffekter.
// Trängsel- och skuggvarningar. Kompanjon- och fuktregler kommer i M3.
import {
  MIN_COMPRESSION, rowComp, rowRect, rectInside, plantHeight, type Garden,
} from "./model";
import { plantById } from "./plants";
import {
  solPosition, skuggLangdCm, skuggAzimut, skuggOffset, platsByNamn, SASONGER, TIDER,
  MIN_SOLHOJD, skuggTackning, SKUGG_GRANS,
} from "./sun";
import { staarIJord, hojdVidDatum, sasongensDatum } from "./schedule";

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
//
// Hela säsongen genomsöks — alla förinställda säsonger och tider — och för varje par
// rapporteras det värsta läget. Annars skulle en varning bara dyka upp om användaren
// råkade vrida fram just den tidpunkt då problemet uppstår, och skuggproblem skulle
// bli något man hittar av en slump i stället för något appen berättar.
//
// Tidpunkten spelar roll i två led. Dels är växterna olika höga vid olika datum —
// en solros är inte 200 cm i maj. Dels står de inte i jorden samtidigt: rädisor är
// skördade långt innan solrosen hunnit bli hög, och ska då inte varnas för.
//
// FÖRENKLING: bara växternas egna skuggor räknas — hus, staket, häckar och träd
// utanför odlingen påverkar minst lika mycket men finns inte i modellen.
function skuggVarningar(garden: Garden): Warning[] {
  const plats = platsByNamn(garden.platsNamn);
  const frost = garden.sistaFrostDatum || "2026-05-15";

  // par-nyckel -> värsta observerade läget
  interface Varst {
    andel: number; tid: string; hojdK: number; langd: number;
    pk: string; pt: string; solbehov: string; traffadId: number;
  }
  const varst = new Map<string, Varst>();

  for (const sasong of SASONGER) {
    const datum = sasongensDatum(frost, sasong.manad, sasong.dag);
    for (const t of TIDER) {
      const sol = solPosition(plats, datum.getFullYear(), sasong.manad, sasong.dag, t.timme);
      if (!sol.uppe || sol.hojdGrader <= MIN_SOLHOJD) continue;
      const az = skuggAzimut(sol.azimutGrader);
      const tid = `${sasong.namn.toLowerCase()} kl ${String(t.timme).padStart(2, "0")}`;

      for (const kastare of garden.rows) {
        const pk = plantById[kastare.plantId];
        if (!pk || !staarIJord(pk, frost, datum)) continue;

        const hojdK = hojdVidDatum(pk, plantHeight(garden, pk.id, pk.hojd_cm), frost, datum);
        const langd = skuggLangdCm(hojdK, sol.hojdGrader);
        if (langd < 10) continue;

        const rk = rowRect(kastare, pk);
        const { dx, dy } = skuggOffset(langd, az, garden.sunDirectionDeg);

        for (const traffad of garden.rows) {
          if (traffad.id === kastare.id) continue;
          const pt = plantById[traffad.plantId];
          if (!pt || !staarIJord(pt, frost, datum)) continue;

          const hojdT = hojdVidDatum(pt, plantHeight(garden, pt.id, pt.hojd_cm), frost, datum);
          if (hojdT >= hojdK * 0.8) continue; // ungefär lika höga — skuggar inte nämnvärt

          const andel = skuggTackning(rowRect(traffad, pt), rk, dx, dy);
          if (andel < SKUGG_GRANS) continue; // nuddar bara — inte värt en varning

          const nyckel = `${kastare.id}-${traffad.id}`;
          const fore = varst.get(nyckel);
          if (!fore || andel > fore.andel) {
            varst.set(nyckel, {
              andel, tid, hojdK, langd,
              pk: pk.namn, pt: pt.namn, solbehov: pt.solbehov, traffadId: traffad.id,
            });
          }
        }
      }
    }
  }

  return [...varst.entries()].map(([nyckel, v]) => {
    const procent = Math.round(v.andel * 100);
    const solalskare = v.solbehov === "sol";
    return {
      id: `skugga-${nyckel}`,
      niva: solalskare ? "varning" : "info",
      rubrik: solalskare
        ? `${v.pt} skuggas upp till ${procent} % av ${v.pk}`
        : `${v.pt} står delvis i skugga av ${v.pk}`,
      text: solalskare
        ? `Som värst vid ${v.tid}: ${v.pk} är då ungefär ${Math.round(v.hojdK)} cm hög och ` +
          `kastar ${Math.round(v.langd)} cm skugga, som täcker ${procent} % av raden med ` +
          `${v.pt}. ${v.pt} vill ha full sol – flytta den till solsidan eller byt plats på raderna.`
        : `${v.pk} skuggar som mest ${procent} % av ${v.pt} (vid ${v.tid}) – men ${v.pt} ` +
          `trivs i ${v.solbehov}, så det är snarare en fördel.`,
      rowId: v.traffadId,
    } satisfies Warning;
  });
}

export const TRANGT_GRANS_TEXT =
  `Under ${Math.round(MIN_COMPRESSION * 100)} % av rekommenderat avstånd går det inte att plantera.`;
