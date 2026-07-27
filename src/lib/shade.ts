// Skugganalys över ett helt dygn.
//
// VARFÖR INTE "VÄRSTA ÖGONBLICKET": nästan varje rad skuggas till 90 % någon gång —
// tidig morgon och sen kväll står solen så lågt att allting kastar långa skuggor.
// Att rapportera toppvärdet ger därför en varning för nästan varje granne, och säger
// inget om hur mycket ljus växten faktiskt förlorar.
//
// I stället vägs varje timme med solens styrka. Instrålningen mot marken är ungefär
// proportionell mot sin(solhöjd): en skugga kl 13 när solen står 50° upp kostar mycket
// ljus, medan samma skugga kl 20 när solen står 8° upp knappt kostar något. Det ger
// två användbara mått:
//   • ljusforlust — andel av dagens ljus som skuggas bort (det som avgör varningen)
//   • soltimmar   — antal timmar med huvudsakligen direkt sol (det odlare tänker i)
import { rowRect, plantHeight, type Garden, type Rect } from "./model";
import { plantById, type Plant } from "./plants";
import {
  solPosition, skuggLangdCm, skuggAzimut, skuggOffset, platsByNamn,
  SASONGER, MIN_SOLHOJD, punktISkugga,
} from "./sun";
import { staarIJord, hojdVidDatum } from "./schedule";

// Tumregler för hur mycket direkt sol olika lägen kräver per dag.
export const SOLKRAV: Record<Plant["solbehov"], number> = {
  sol: 6,
  halvskugga: 4,
  skugga: 2,
};

// Under den här ljusförlusten är skuggan en normal del av att odla tätt.
export const LJUSFORLUST_NOTERING = 0.15;
export const LJUSFORLUST_VARNING = 0.30;

const FORSTA_TIMMEN = 4;
const SISTA_TIMMEN = 22;

// En timme räknas som "soltimme" först när solen står så pass högt att ljuset gör
// nytta. Utan den gränsen skulle 04:00 med solen i horisonten räknas som full sol
// och en midsommardag se ut att ge 18 timmars odlingsljus.
const NYTTIG_SOLHOJD = 15;

export interface Skuggkalla {
  namn: string;
  andel: number; // hur stor del av ljusförlusten den står för
}

export interface SkuggPost {
  rowId: number;
  namn: string;
  antal: number;
  solbehov: Plant["solbehov"];
  kravTimmar: number;
  soltimmar: number;      // uppskattade timmar direkt sol den valda dagen
  ljusforlust: number;    // 0–1
  sasongNamn: string;     // säsongen då det är som sämst
  kallor: Skuggkalla[];
  farSolNog: boolean;
}

interface Kastare { rect: Rect; dx: number; dy: number; namn: string }

/** Andel av rutan som ligger i skugga från någon av kastarna (punktprov). */
function skuggadAndel(traffad: Rect, kastare: Kastare[]): number {
  if (kastare.length === 0) return 0;
  const NX = 8, NY = 4;
  let traffar = 0;
  for (let ix = 0; ix < NX; ix++) {
    for (let iy = 0; iy < NY; iy++) {
      const px = traffad.x + ((ix + 0.5) / NX) * traffad.w;
      const py = traffad.y + ((iy + 0.5) / NY) * traffad.h;
      if (kastare.some(k => punktISkugga(px, py, k.rect, k.dx, k.dy))) traffar++;
    }
  }
  return traffar / (NX * NY);
}

/** Full analys per plantrad: sol och skugga över dygnet, för den värsta säsongen. */
export function skuggAnalys(garden: Garden): SkuggPost[] {
  const plats = platsByNamn(garden.platsNamn);
  const frost = garden.sistaFrostDatum || "2026-05-15";
  const resultat = new Map<number, SkuggPost>();

  for (const sasong of SASONGER) {
    const ar = new Date(frost + "T12:00:00").getFullYear();
    const datum = new Date(ar, sasong.manad - 1, sasong.dag, 12);

    // rader som står i jorden just den här säsongen
    const aktiva = garden.rows
      .map(r => ({ row: r, plant: plantById[r.plantId] }))
      .filter(x => x.plant && staarIJord(x.plant, frost, datum));
    if (aktiva.length === 0) continue;

    // per rad: viktad ljusförlust och soltimmar under dygnet
    const summa = new Map<number, { vikt: number; forlust: number; soltimmar: number;
                                    perKalla: Map<string, number> }>();
    for (const a of aktiva) {
      summa.set(a.row.id, { vikt: 0, forlust: 0, soltimmar: 0, perKalla: new Map() });
    }

    for (let timme = FORSTA_TIMMEN; timme <= SISTA_TIMMEN; timme++) {
      const sol = solPosition(plats, ar, sasong.manad, sasong.dag, timme);
      if (!sol.uppe || sol.hojdGrader <= MIN_SOLHOJD) continue;

      // Instrålningen mot marken är ungefär proportionell mot sin(solhöjd).
      const vikt = Math.sin((sol.hojdGrader * Math.PI) / 180);
      const az = skuggAzimut(sol.azimutGrader);

      // alla skuggkastare den här timmen
      const kastare: (Kastare & { rowId: number })[] = [];
      for (const a of aktiva) {
        const hojd = hojdVidDatum(a.plant, plantHeight(garden, a.plant.id, a.plant.hojd_cm),
                                  frost, datum);
        const langd = skuggLangdCm(hojd, sol.hojdGrader);
        if (langd < 10) continue;
        const { dx, dy } = skuggOffset(langd, az, garden.sunDirectionDeg);
        kastare.push({ rect: rowRect(a.row, a.plant), dx, dy, namn: a.plant.namn, rowId: a.row.id });
      }

      for (const a of aktiva) {
        const egenHojd = hojdVidDatum(a.plant, plantHeight(garden, a.plant.id, a.plant.hojd_cm),
                                      frost, datum);
        // bara högre grannar kan skugga meningsfullt
        const relevanta = kastare.filter(k => {
          if (k.rowId === a.row.id) return false;
          const annan = aktiva.find(x => x.row.id === k.rowId);
          if (!annan) return false;
          const h = hojdVidDatum(annan.plant, plantHeight(garden, annan.plant.id, annan.plant.hojd_cm),
                                 frost, datum);
          return h > egenHojd * 1.25;
        });

        const rect = rowRect(a.row, a.plant);
        const andel = skuggadAndel(rect, relevanta);
        const post = summa.get(a.row.id)!;
        post.vikt += vikt;
        post.forlust += vikt * andel;
        if (andel < 0.5 && sol.hojdGrader >= NYTTIG_SOLHOJD) post.soltimmar += 1;

        // fördela skulden mellan kastarna för att kunna peka ut vem som skuggar mest
        if (andel > 0) {
          for (const k of relevanta) {
            const enskild = skuggadAndel(rect, [k]);
            if (enskild > 0) {
              post.perKalla.set(k.namn, (post.perKalla.get(k.namn) ?? 0) + vikt * enskild);
            }
          }
        }
      }
    }

    for (const a of aktiva) {
      const post = summa.get(a.row.id)!;
      if (post.vikt === 0) continue;
      const ljusforlust = post.forlust / post.vikt;
      const tidigare = resultat.get(a.row.id);
      if (tidigare && tidigare.ljusforlust >= ljusforlust) continue;

      const totalSkuld = [...post.perKalla.values()].reduce((s, v) => s + v, 0);
      const kallor: Skuggkalla[] = [...post.perKalla.entries()]
        .map(([namn, v]) => ({ namn, andel: totalSkuld > 0 ? v / totalSkuld : 0 }))
        .sort((x, y) => y.andel - x.andel);

      const krav = SOLKRAV[a.plant.solbehov];
      resultat.set(a.row.id, {
        rowId: a.row.id,
        namn: a.plant.namn,
        antal: a.row.count,
        solbehov: a.plant.solbehov,
        kravTimmar: krav,
        soltimmar: post.soltimmar,
        ljusforlust,
        sasongNamn: sasong.namn,
        kallor,
        farSolNog: post.soltimmar >= krav,
      });
    }
  }

  return [...resultat.values()].sort((a, b) => b.ljusforlust - a.ljusforlust);
}
