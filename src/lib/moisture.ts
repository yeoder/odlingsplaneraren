// Fuktprofil per odlingsruta — härledd ur växterna, aldrig inställd av användaren.
//
// Rutan har medvetet ingen egen fuktinställning: det finns ingen källa till "hur fuktigt
// det är just där". Däremot vet vi vad varje växt vill ha, och det är växterna man
// planterar som avgör hur rutan bör skötas.
//
// Två saker gör beräkningen ärligare än ett enkelt medelvärde:
//  • Bara rader som står i jorden SAMTIDIGT räknas. En rädisa som är skördad i maj
//    ska inte styra bevattningen i augusti.
//  • Raderna vägs efter YTA, inte antal. En pumpa som täcker halva rutan säger mer om
//    hur rutan ska vattnas än tre korta kryddrader.
import { rowRect, type Box, type Garden, type PlantRow } from "./model";
import { plantById, type Plant, type Vattenbehov } from "./plants";
import { staarIJord, sasongensDatum } from "./schedule";
import { SASONGER } from "./sun";

export const NIVA: Record<Vattenbehov, number> = { "låg": 0, "medel": 1, "hög": 2 };

export const FUKT_ETIKETT: Record<Vattenbehov, string> = {
  "låg": "Låt torka upp mellan vattningar",
  "medel": "Lagom fuktig",
  "hög": "Håll jämnt fuktig",
};

// En växt måste uppta minst så här stor del av det planterade i rutan för att
// räknas som en verklig konflikt. Utan gränsen skulle en enda basilikaplanta i
// hörnet av ett lökland utlösa varning.
const MIN_ANDEL = 0.15;

export interface FuktProfil {
  boxId: number;
  niva: Vattenbehov;      // sammanvägd rekommendation
  etikett: string;
  konflikt: boolean;      // både låg- och högkrävande med betydande yta
  torra: string[];        // växtnamn som vill ha det torrare
  blota: string[];        // växtnamn som vill ha det blötare
  sasongNamn: string;     // säsongen då konflikten uppstår
}

function radYta(row: PlantRow, p: Plant): number {
  const r = rowRect(row, p);
  return r.w * r.h;
}

/**
 * Fuktprofil för en ruta vid en given tidpunkt, eller null om inget växer där då.
 */
export function boxFuktVid(garden: Garden, box: Box, datum: Date): FuktProfil | null {
  const frost = garden.sistaFrostDatum || "2026-05-15";
  const hostfrost = garden.forstaHostfrostDatum;

  const aktiva = garden.rows
    .filter(r => r.boxId === box.id)
    .map(r => ({ row: r, plant: plantById[r.plantId] }))
    .filter(x => x.plant && staarIJord(x.plant, frost, datum, hostfrost));
  if (aktiva.length === 0) return null;

  const totalYta = aktiva.reduce((s, a) => s + radYta(a.row, a.plant), 0);
  if (totalYta === 0) return null;

  let viktadNiva = 0;
  const andelPerNiva: Record<Vattenbehov, number> = { "låg": 0, "medel": 0, "hög": 0 };
  const namnPerNiva: Record<Vattenbehov, Set<string>> = {
    "låg": new Set(), "medel": new Set(), "hög": new Set(),
  };

  for (const a of aktiva) {
    const andel = radYta(a.row, a.plant) / totalYta;
    viktadNiva += NIVA[a.plant.vattenbehov] * andel;
    andelPerNiva[a.plant.vattenbehov] += andel;
    namnPerNiva[a.plant.vattenbehov].add(a.plant.namn);
  }

  const niva: Vattenbehov = viktadNiva < 0.67 ? "låg" : viktadNiva < 1.34 ? "medel" : "hög";

  // Bara ytterligheterna krockar. "medel" mot "låg" eller "hög" går att jämka.
  const konflikt = andelPerNiva["låg"] >= MIN_ANDEL && andelPerNiva["hög"] >= MIN_ANDEL;

  return {
    boxId: box.id,
    niva,
    etikett: FUKT_ETIKETT[niva],
    konflikt,
    torra: [...namnPerNiva["låg"]],
    blota: [...namnPerNiva["hög"]],
    sasongNamn: "",
  };
}

/** Fuktprofil vid den tidpunkt användaren tittar på (för etiketten i ritytan). */
export function boxFuktNu(garden: Garden, box: Box): FuktProfil | null {
  const sasong = SASONGER.find(s => s.id === garden.solSasong) ?? SASONGER[1];
  const datum = sasongensDatum(garden.sistaFrostDatum || "2026-05-15", sasong.manad, sasong.dag);
  return boxFuktVid(garden, box, datum);
}

/**
 * Söker igenom hela säsongen efter fuktkonflikter, på samma sätt som skuggorna:
 * en konflikt ska hittas åt användaren, inte bara när den råkar bläddra fram
 * rätt tidpunkt.
 */
export function fuktKonflikter(garden: Garden): FuktProfil[] {
  const ut = new Map<number, FuktProfil>();
  const frost = garden.sistaFrostDatum || "2026-05-15";

  for (const sasong of SASONGER) {
    const datum = sasongensDatum(frost, sasong.manad, sasong.dag);
    for (const box of garden.boxes) {
      if (box.typ !== "odling" || ut.has(box.id)) continue;
      const profil = boxFuktVid(garden, box, datum);
      if (profil?.konflikt) ut.set(box.id, { ...profil, sasongNamn: sasong.namn });
    }
  }
  return [...ut.values()];
}
