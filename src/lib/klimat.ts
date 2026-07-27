// Frostdatum utifrån latitud.
//
// Odlingssäsongen är dramatiskt olika lång i landet: i Skåne kan man skörda in i
// november medan säsongen i Kiruna är slut i början av september. Vårfrosten skjuter
// bara fram starten — utan ett höstfrostdatum skulle en grönkål "stå kvar till
// 4 november" även norr om polcirkeln.
//
// Värdena är LINJÄRA UPPSKATTNINGAR ur latitud, kalibrerade mot ungefärliga
// medianvärden för Malmö, Stockholm, Umeå och Kiruna. De tar inte hänsyn till
// kustnärhet, höjd över havet eller lokala frosthål — en dalsänka kan ha frost
// flera veckor före omgivningen. Datumen är därför förslag som användaren kan
// ändra i inställningarna.
import type { Plats } from "./sun";

const REF_LAT = 55.6;           // Malmö
const VAR_DOY_REF = 115;        // ~25 april
const VAR_PER_GRAD = 3.74;      // dagar senare per breddgrad norrut
const HOST_DOY_REF = 305;       // ~1 november
const HOST_PER_GRAD = 4.96;     // dagar tidigare per breddgrad norrut

function franDagNummer(ar: number, doy: number): string {
  const d = new Date(ar, 0, 1);
  d.setDate(d.getDate() + Math.round(doy) - 1);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dag}`;
}

/** Uppskattad sista vårfrost för orten, som ISO-datum. */
export function uppskattadVarfrost(plats: Plats, ar: number): string {
  return franDagNummer(ar, VAR_DOY_REF + VAR_PER_GRAD * (plats.lat - REF_LAT));
}

/** Uppskattad första höstfrost för orten, som ISO-datum. */
export function uppskattadHostfrost(plats: Plats, ar: number): string {
  return franDagNummer(ar, HOST_DOY_REF - HOST_PER_GRAD * (plats.lat - REF_LAT));
}

export type Frosttalighet = "känslig" | "lätt" | "hård";

/**
 * Hur många dagar efter första höstfrost växten kan stå kvar.
 * Frostkänsliga växter svartnar första natten under noll; grönkål och palsternacka
 * blir tvärtom sötare av frosten och kan tas långt in på vintern.
 */
export const FROSTMARGINAL_DAGAR: Record<Frosttalighet, number> = {
  "känslig": 0,
  "lätt": 14,
  "hård": 45,
};

/** Antal dagar mellan vår- och höstfrost — säsongens längd på orten. */
export function sasongslangdDagar(varfrostISO: string, hostfrostISO: string): number {
  const v = new Date(varfrostISO + "T12:00:00").getTime();
  const h = new Date(hostfrostISO + "T12:00:00").getTime();
  return Math.max(0, Math.round((h - v) / 86400000));
}
