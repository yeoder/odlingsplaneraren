// Växtdatabas. Tider anges i veckor relativt "sista vårfrost", avstånd i cm, temp i °C.
// avstand_cm = rekommenderat avstånd mellan plantor (plantans fotavtryck).
// OBS: exempeldata — utökas och kvalitetssäkras separat.

export type Vattenbehov = "låg" | "medel" | "hög";
export type Solbehov = "sol" | "halvskugga" | "skugga";

export interface Plant {
  id: string;
  namn: string;
  familj: string;
  farg: string;
  symbol: string;
  avstand_cm: number;
  forsa_veckor_fore_frost: number | null; // null = förkultiveras ej
  direktsadd: boolean;
  direktsadd_veckor_fore_frost?: number; // negativ = efter frost
  plantera_ut_veckor_efter_frost?: number;
  min_utetemp: number;
  dagar_till_skord: number; // endast upplysning — genererar inga schemarader
  vattenbehov: Vattenbehov;
  solbehov: Solbehov;
  hojd_cm: number;
  bra_grannar: string[];
  daliga_grannar: string[];
}

export const PLANTS: Plant[] = [
  {
    id: "tomat", namn: "Tomat", familj: "potatisväxter", farg: "#e05d44", symbol: "🍅",
    avstand_cm: 50,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 75,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 150,
    bra_grannar: ["basilika", "morot", "ringblomma", "lok"],
    daliga_grannar: ["potatis", "fankal", "majs"],
  },
  {
    id: "morot", namn: "Morot", familj: "flockblommiga", farg: "#e8912d", symbol: "🥕",
    avstand_cm: 8,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 70,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["tomat", "lok", "sallat", "radisa"],
    daliga_grannar: ["dill"],
  },
  {
    id: "sallat", namn: "Sallat", familj: "korgblommiga", farg: "#7cb342", symbol: "🥬",
    avstand_cm: 25,
    forsa_veckor_fore_frost: 4, direktsadd: true,
    plantera_ut_veckor_efter_frost: -2, min_utetemp: 5,
    dagar_till_skord: 50,
    vattenbehov: "hög", solbehov: "halvskugga", hojd_cm: 20,
    bra_grannar: ["morot", "radisa", "gurka", "jordgubbe"],
    daliga_grannar: ["persilja"],
  },
  {
    id: "potatis", namn: "Potatis", familj: "potatisväxter", farg: "#a1887f", symbol: "🥔",
    avstand_cm: 35,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 8,
    dagar_till_skord: 90,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["bona", "majs", "kal"],
    daliga_grannar: ["tomat", "gurka", "solros"],
  },
  {
    id: "lok", namn: "Lök", familj: "amaryllisväxter", farg: "#ab47bc", symbol: "🧅",
    avstand_cm: 12,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 100,
    vattenbehov: "låg", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["morot", "tomat", "sallat", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "gurka", namn: "Gurka", familj: "gurkväxter", farg: "#43a047", symbol: "🥒",
    avstand_cm: 45,
    forsa_veckor_fore_frost: 4, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 60,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 180,
    bra_grannar: ["sallat", "bona", "dill"],
    daliga_grannar: ["potatis", "tomat"],
  },
  {
    id: "bona", namn: "Böna (buskböna)", familj: "ärtväxter", farg: "#26a69a", symbol: "🫘",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 12,
    dagar_till_skord: 60,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 45,
    bra_grannar: ["potatis", "gurka", "majs", "jordgubbe"],
    daliga_grannar: ["lok", "fankal"],
  },
  {
    id: "basilika", namn: "Basilika", familj: "kransblommiga", farg: "#66bb6a", symbol: "🌿",
    avstand_cm: 20,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 40,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["tomat"],
    daliga_grannar: [],
  },
  {
    id: "radisa", namn: "Rädisa", familj: "korsblommiga", farg: "#ef5350", symbol: "🔴",
    avstand_cm: 6,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 4, min_utetemp: 4,
    dagar_till_skord: 30,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 15,
    bra_grannar: ["morot", "sallat", "gurka"],
    daliga_grannar: [],
  },
  {
    id: "dill", namn: "Dill", familj: "flockblommiga", farg: "#9ccc65", symbol: "🌾",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 7,
    dagar_till_skord: 55,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 90,
    bra_grannar: ["gurka", "sallat", "lok"],
    daliga_grannar: ["morot"],
  },
];

export const plantById: Record<string, Plant> = Object.fromEntries(PLANTS.map(p => [p.id, p]));
