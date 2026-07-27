// Solens position och skuggor — ren matematik, inga anrop och ingen extern data.
// Algoritmen följer NOAA:s förenklade solpositionsberäkning, som är fullt tillräcklig
// för att visa åt vilket håll och hur långt en växt kastar skugga.
//
// FÖRENKLINGAR (medvetna):
//  • Skuggan beräknas platt mark, inga lutningar.
//  • Bara växternas egna skuggor räknas. Hus, staket, häckar och träd utanför
//    odlingen påverkar minst lika mycket — de går inte att rita in ännu.
//  • Tidszon antas vara svensk sommartid (UTC+2). Alla förinställda tidpunkter
//    ligger i odlingssäsongen, så det stämmer.

export interface Plats {
  namn: string;
  lat: number;
  lon: number;
}

// Ungefärliga koordinater för orter spridda över landet. Latituden är det som
// styr solhöjden; longituden justerar bara klockslaget något.
export const PLATSER: Plats[] = [
  { namn: "Kiruna", lat: 67.86, lon: 20.23 },
  { namn: "Gällivare", lat: 67.13, lon: 20.66 },
  { namn: "Luleå", lat: 65.58, lon: 22.15 },
  { namn: "Piteå", lat: 65.32, lon: 21.48 },
  { namn: "Skellefteå", lat: 64.75, lon: 20.95 },
  { namn: "Umeå", lat: 63.83, lon: 20.26 },
  { namn: "Östersund", lat: 63.18, lon: 14.64 },
  { namn: "Örnsköldsvik", lat: 63.29, lon: 18.72 },
  { namn: "Sundsvall", lat: 62.39, lon: 17.31 },
  { namn: "Hudiksvall", lat: 61.73, lon: 17.11 },
  { namn: "Mora", lat: 61.00, lon: 14.54 },
  { namn: "Gävle", lat: 60.67, lon: 17.14 },
  { namn: "Falun", lat: 60.61, lon: 15.63 },
  { namn: "Borlänge", lat: 60.48, lon: 15.44 },
  { namn: "Uppsala", lat: 59.86, lon: 17.64 },
  { namn: "Karlstad", lat: 59.40, lon: 13.51 },
  { namn: "Västerås", lat: 59.61, lon: 16.55 },
  { namn: "Örebro", lat: 59.27, lon: 15.21 },
  { namn: "Stockholm", lat: 59.33, lon: 18.07 },
  { namn: "Södertälje", lat: 59.20, lon: 17.63 },
  { namn: "Eskilstuna", lat: 59.37, lon: 16.51 },
  { namn: "Nyköping", lat: 58.75, lon: 17.01 },
  { namn: "Trollhättan", lat: 58.28, lon: 12.29 },
  { namn: "Linköping", lat: 58.41, lon: 15.62 },
  { namn: "Norrköping", lat: 58.59, lon: 16.19 },
  { namn: "Skövde", lat: 58.39, lon: 13.85 },
  { namn: "Visby", lat: 57.64, lon: 18.30 },
  { namn: "Göteborg", lat: 57.71, lon: 11.97 },
  { namn: "Borås", lat: 57.72, lon: 12.94 },
  { namn: "Jönköping", lat: 57.78, lon: 14.16 },
  { namn: "Västervik", lat: 57.76, lon: 16.64 },
  { namn: "Varberg", lat: 57.11, lon: 12.25 },
  { namn: "Växjö", lat: 56.88, lon: 14.81 },
  { namn: "Kalmar", lat: 56.66, lon: 16.36 },
  { namn: "Halmstad", lat: 56.67, lon: 12.86 },
  { namn: "Karlskrona", lat: 56.16, lon: 15.59 },
  { namn: "Helsingborg", lat: 56.05, lon: 12.69 },
  { namn: "Kristianstad", lat: 56.03, lon: 14.16 },
  { namn: "Lund", lat: 55.70, lon: 13.19 },
  { namn: "Malmö", lat: 55.60, lon: 13.00 },
  { namn: "Ystad", lat: 55.43, lon: 13.82 },
];

export const STANDARDPLATS = "Stockholm";

export function platsByNamn(namn: string): Plats {
  return PLATSER.find(p => p.namn === namn) ?? PLATSER.find(p => p.namn === STANDARDPLATS)!;
}

// Förinställda tidpunkter — täcker säsongen utan att bli en kalenderövning.
export interface Sasong { id: string; namn: string; manad: number; dag: number }
export const SASONGER: Sasong[] = [
  { id: "forsommar", namn: "Försommar", manad: 5, dag: 1 },
  { id: "midsommar", namn: "Midsommar", manad: 6, dag: 21 },
  { id: "sensommar", namn: "Sensommar", manad: 8, dag: 15 },
  { id: "hostsol", namn: "Tidig höst", manad: 9, dag: 20 },
];

export const TIDER = [
  { timme: 8, namn: "Morgon" },
  { timme: 12, namn: "Middag" },
  { timme: 18, namn: "Kväll" },
];

const rad = (g: number) => (g * Math.PI) / 180;
const grad = (r: number) => (r * 180) / Math.PI;

export interface SolPosition {
  hojdGrader: number;   // över horisonten; negativ = under
  azimutGrader: number; // 0 = norr, 90 = öst, 180 = syd, 270 = väst
  uppe: boolean;
}

// NOAA:s förenklade beräkning. `timme` anges i lokal svensk sommartid (UTC+2).
export function solPosition(plats: Plats, ar: number, manad: number, dag: number,
                            timme: number, minut = 0): SolPosition {
  const TIDSZON = 2; // CEST

  const start = Date.UTC(ar, 0, 1);
  const nu = Date.UTC(ar, manad - 1, dag);
  const dagIAret = Math.floor((nu - start) / 86400000) + 1;

  const gamma = ((2 * Math.PI) / 365) * (dagIAret - 1 + (timme - 12) / 24);

  const tidsekvation = 229.18 * (0.000075
    + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));

  const deklination = 0.006918
    - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);

  const tidsoffset = tidsekvation + 4 * plats.lon - 60 * TIDSZON;
  const sannSoltid = timme * 60 + minut + tidsoffset;
  const timvinkel = sannSoltid / 4 - 180;

  const latR = rad(plats.lat);
  const cosZenit =
    Math.sin(latR) * Math.sin(deklination) +
    Math.cos(latR) * Math.cos(deklination) * Math.cos(rad(timvinkel));
  const zenit = Math.acos(Math.min(Math.max(cosZenit, -1), 1));
  const hojd = 90 - grad(zenit);

  // Azimut räknad medurs från NORR (0 = norr, 90 = öst, 180 = syd, 270 = väst).
  // Täljaren måste vara sin(deklination) − sin(lat)·cos(zenit); omvänd ordning ger
  // vinkeln från söder i stället, vilket blir 180° fel.
  let azimut: number;
  const namnare = Math.cos(latR) * Math.sin(zenit);
  if (Math.abs(namnare) < 1e-9) {
    azimut = 180;
  } else {
    const cosAz = (Math.sin(deklination) - Math.sin(latR) * Math.cos(zenit)) / namnare;
    azimut = grad(Math.acos(Math.min(Math.max(cosAz, -1), 1)));
    if (timvinkel > 0) azimut = 360 - azimut; // eftermiddag → väst
  }

  return { hojdGrader: hojd, azimutGrader: azimut, uppe: hojd > 0 };
}

// Under några grader blir skuggan orimligt lång och säger inget användbart.
export const MIN_SOLHOJD = 5;

// Skugglängd i cm för en växt av given höjd.
export function skuggLangdCm(hojdCm: number, solhojdGrader: number): number {
  if (solhojdGrader <= MIN_SOLHOJD) return 0;
  return hojdCm / Math.tan(rad(solhojdGrader));
}

// Riktning skuggan pekar (motsatt solen), i grader medurs från norr.
export function skuggAzimut(solAzimutGrader: number): number {
  return (solAzimutGrader + 180) % 360;
}

/**
 * Ligger punkten i skuggan? Skuggan är källrektangeln svept längs (dx, dy), alltså
 * mängden av alla punkter p där p − t·(dx,dy) ligger i rektangeln för något t i [0,1].
 * Testas exakt genom att lösa ut vilka t som fungerar i x- respektive y-led.
 */
export function punktISkugga(
  px: number, py: number,
  r: { x: number; y: number; w: number; h: number },
  dx: number, dy: number,
): boolean {
  let tMin = 0, tMax = 1;

  const spann = (p: number, lo: number, hi: number, d: number): boolean => {
    if (Math.abs(d) < 1e-9) return p >= lo && p <= hi; // ingen rörelse i det ledet
    const a = (p - hi) / d, b = (p - lo) / d;
    tMin = Math.max(tMin, Math.min(a, b));
    tMax = Math.min(tMax, Math.max(a, b));
    return tMin <= tMax;
  };

  if (!spann(px, r.x, r.x + r.w, dx)) return false;
  if (!spann(py, r.y, r.y + r.h, dy)) return false;
  return tMin <= tMax;
}

/**
 * Hur stor andel (0–1) av `traffad` som ligger i skuggan från `kallare`.
 * Uppskattas genom att pricka av ett rutnät av punkter över den träffade raden.
 */
export function skuggTackning(
  traffad: { x: number; y: number; w: number; h: number },
  kallare: { x: number; y: number; w: number; h: number },
  dx: number, dy: number,
): number {
  const NX = 12, NY = 6;
  let traffar = 0;
  for (let ix = 0; ix < NX; ix++) {
    for (let iy = 0; iy < NY; iy++) {
      const px = traffad.x + ((ix + 0.5) / NX) * traffad.w;
      const py = traffad.y + ((iy + 0.5) / NY) * traffad.h;
      if (punktISkugga(px, py, kallare, dx, dy)) traffar++;
    }
  }
  return traffar / (NX * NY);
}

// Under den här andelen är skuggan för liten för att vara värd en varning.
export const SKUGG_GRANS = 0.25;

// Förskjutning i planens koordinater (x åt öster, y nedåt = söderut när norr är uppåt).
// `planetsNordDeg` roterar hela planen: 0 = norr rakt upp i bilden.
export function skuggOffset(langdCm: number, skuggAzimutGrader: number,
                            planetsNordDeg: number): { dx: number; dy: number } {
  const a = rad(skuggAzimutGrader - planetsNordDeg);
  return { dx: langdCm * Math.sin(a), dy: -langdCm * Math.cos(a) };
}
