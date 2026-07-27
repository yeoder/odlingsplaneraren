// Årsschema — vad som ska göras vilken vecka, härlett ur planteringarna och
// datumet för sista vårfrost. Ren datumaritmetik, inga anrop någonstans.
//
// Skörd ingår medvetet INTE: man skördar när det ser färdigt ut, inte enligt kalender.
// dagar_till_skord finns kvar i växtdatan som upplysning per växt.
import type { Garden } from "./model";
import { plantById, type Plant } from "./plants";

export type Atgard = "forsa" | "direktsa" | "planteraUt";

export const ATGARD_RUBRIK: Record<Atgard, string> = {
  forsa: "Förså inne",
  direktsa: "Direktså",
  planteraUt: "Plantera ut",
};

export interface VeckoPost {
  plantId: string;
  text: string; // växtnamn, ev. med villkor
}

export interface Vecka {
  vecka: number;
  ar: number;
  datum: Date; // veckans måndag — för sortering och datumetikett
  atgarder: Record<Atgard, VeckoPost[]>;
}

function addWeeks(iso: string, veckor: number): Date {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + Math.round(veckor * 7));
  return d;
}

// ISO-8601 veckonummer (måndag som första dag, vecka 1 innehåller 4 januari)
export function isoVecka(d: Date): { vecka: number; ar: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const veckodag = t.getUTCDay() || 7; // söndag = 7
  t.setUTCDate(t.getUTCDate() + 4 - veckodag); // flytta till torsdagen i samma vecka
  const arsStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const vecka = Math.ceil(((t.getTime() - arsStart.getTime()) / 86400000 + 1) / 7);
  return { vecka, ar: t.getUTCFullYear() };
}

function veckansMandag(d: Date): Date {
  const m = new Date(d);
  const veckodag = m.getDay() || 7;
  m.setDate(m.getDate() - (veckodag - 1));
  m.setHours(12, 0, 0, 0);
  return m;
}

export function formateraDatum(d: Date): string {
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

// ---------- odlingsperiod och höjd över tid ----------
// Behövs för skuggberäkningen: en solros är inte 200 cm i april, och en rädisa
// är skördad långt innan solrosen hunnit bli hög.

/** Datum då växten står i jorden på plats (utplanterad eller direktsådd). */
export function iJordDatum(p: Plant, frostISO: string): Date {
  if (p.forsa_veckor_fore_frost != null) {
    return addWeeks(frostISO, p.plantera_ut_veckor_efter_frost ?? 0);
  }
  return addWeeks(frostISO, -(p.direktsadd_veckor_fore_frost ?? 0));
}

/** Ungefärligt datum då grödan är färdig — slutet på den huvudsakliga odlingsperioden. */
export function fardigDatum(p: Plant, frostISO: string): Date {
  const d = iJordDatum(p, frostISO);
  d.setDate(d.getDate() + p.dagar_till_skord);
  return d;
}

// En gröda rensas sällan bort samma dag den blir färdig — den står kvar ett tag till.
// Andelen är proportionell mot odlingstiden: en rädisa dras upp snabbt, medan en
// solros eller tomat får stå kvar i veckor efter att den börjat ge skörd.
const EFTERPERIOD_ANDEL = 0.3;

/** Datum då grödan antas vara borttagen ur odlingen. */
export function urJordDatum(p: Plant, frostISO: string): Date {
  const d = fardigDatum(p, frostISO);
  d.setDate(d.getDate() + Math.round(p.dagar_till_skord * EFTERPERIOD_ANDEL));
  return d;
}

export function staarIJord(p: Plant, frostISO: string, datum: Date): boolean {
  return datum >= iJordDatum(p, frostISO) && datum <= urJordDatum(p, frostISO);
}

/**
 * Uppskattad höjd vid ett givet datum: noll innan plantering, full höjd när grödan
 * är färdig, linjärt däremellan.
 * FÖRENKLING: verklig tillväxt är S-formad (långsam start, snabb mitt), men linjärt
 * räcker gott för att avgöra om en växt hunnit bli hög nog att skugga en annan.
 */
export function hojdVidDatum(p: Plant, slutHojdCm: number, frostISO: string, datum: Date): number {
  const start = iJordDatum(p, frostISO).getTime();
  const slut = fardigDatum(p, frostISO).getTime();
  const t = datum.getTime();
  if (t < start) return 0;
  if (t >= slut || slut <= start) return slutHojdCm;
  return slutHojdCm * ((t - start) / (slut - start));
}

/** Datumet som en vald säsong motsvarar, med år hämtat ur frostdatumet. */
export function sasongensDatum(frostISO: string, manad: number, dag: number): Date {
  const ar = new Date((frostISO || "2026-05-15") + "T12:00:00").getFullYear();
  return new Date(ar, manad - 1, dag, 12, 0, 0);
}

export function computeSchedule(garden: Garden): Vecka[] {
  const frost = garden.sistaFrostDatum;
  if (!frost) return [];

  const anvanda = [...new Set(garden.rows.map(r => r.plantId))]
    .map(id => plantById[id])
    .filter((p): p is Plant => !!p);

  // vecko-nyckel -> Vecka
  const kartan = new Map<string, Vecka>();

  function lagg(datum: Date, atgard: Atgard, post: VeckoPost) {
    const mandag = veckansMandag(datum);
    const { vecka, ar } = isoVecka(datum);
    const nyckel = `${ar}-${vecka}`;
    let v = kartan.get(nyckel);
    if (!v) {
      v = { vecka, ar, datum: mandag, atgarder: { forsa: [], direktsa: [], planteraUt: [] } };
      kartan.set(nyckel, v);
    }
    if (!v.atgarder[atgard].some(p => p.plantId === post.plantId)) {
      v.atgarder[atgard].push(post);
    }
  }

  for (const p of anvanda) {
    if (p.forsa_veckor_fore_frost != null) {
      lagg(addWeeks(frost, -p.forsa_veckor_fore_frost), "forsa", {
        plantId: p.id, text: p.namn,
      });
      lagg(addWeeks(frost, p.plantera_ut_veckor_efter_frost ?? 0), "planteraUt", {
        plantId: p.id, text: `${p.namn} (om ≥ ${p.min_utetemp} °C ute)`,
      });
    } else {
      lagg(addWeeks(frost, -(p.direktsadd_veckor_fore_frost ?? 0)), "direktsa", {
        plantId: p.id, text: `${p.namn} (jordtemp ≥ ${p.min_utetemp} °C)`,
      });
    }
  }

  return [...kartan.values()].sort((a, b) => a.datum.getTime() - b.datum.getTime());
}
