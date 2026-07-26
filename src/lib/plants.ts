// Växtdatabas. Tider anges i veckor relativt "sista vårfrost", avstånd i cm, temp i °C.
// avstand_cm = rekommenderat avstånd mellan plantor (plantans fotavtryck).
// Baslinje: 37 vanliga köksträdgårdsväxter i svenskt klimat, sammanställd från allmänt
// vedertagen odlings- och samplanteringspraxis. Samplantering är sällan exakt vetenskap —
// listorna täcker de mest väletablerade paren, inte varje tänkbar kombination.
//
// KÄND BEGRÄNSNING: modellen räknar allt relativt "sista vårfrost" samma år. Höstplanterad
// vitlök (se vitlok) bryter mot det mönstret — den planteras på hösten, ~30 veckor FÖRE
// nästa vårs frostdatum, vilket landar bakåt i föregående år. Datumaritmetiken klarar det,
// men "min_utetemp" som begrepp ("vänta tills det är minst X°C") stämmer dåligt för en växt
// man vill sätta i AVSVALNANDE jord. Fungerar men är inte konceptuellt rent — värt att se
// över om fler höstplanterade växter (t.ex. höstlök) läggs till senare.

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
  // ---------- frukt/frukter (Solanaceae m.fl.) ----------
  {
    id: "tomat", namn: "Tomat", familj: "potatisväxter", farg: "#e05d44", symbol: "🍅",
    avstand_cm: 50,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 75,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 150,
    bra_grannar: ["basilika", "morot", "ringblomma", "lok", "persilja"],
    daliga_grannar: ["potatis", "fankal", "majs"],
  },
  {
    id: "paprika", namn: "Paprika", familj: "potatisväxter", farg: "#fb8c00", symbol: "🫑",
    avstand_cm: 40,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 15,
    dagar_till_skord: 90,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["basilika", "lok", "oregano"],
    daliga_grannar: ["bona", "fankal"],
  },
  {
    id: "potatis", namn: "Potatis", familj: "potatisväxter", farg: "#a1887f", symbol: "🥔",
    avstand_cm: 35,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 8,
    dagar_till_skord: 90,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["bona", "majs", "vitkal"],
    daliga_grannar: ["tomat", "gurka", "zucchini", "solros"],
  },

  // ---------- rotfrukter ----------
  {
    id: "morot", namn: "Morot", familj: "flockblommiga", farg: "#e8912d", symbol: "🥕",
    avstand_cm: 8,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 70,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["lok", "purjolok", "radisa", "sallat", "graslok"],
    daliga_grannar: ["dill"],
  },
  {
    id: "rodbeta", namn: "Rödbeta", familj: "mållväxter", farg: "#ad1457", symbol: "🔴",
    avstand_cm: 10,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 70,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["lok", "kalrabbi", "vitkal", "graslok"],
    daliga_grannar: ["bona"],
  },
  {
    id: "palsternacka", namn: "Palsternacka", familj: "flockblommiga", farg: "#d7ccc8", symbol: "🥕",
    avstand_cm: 10,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 4,
    dagar_till_skord: 130,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["lok", "radisa"],
    daliga_grannar: ["dill"],
  },
  {
    id: "kalrot", namn: "Kålrot", familj: "korsblommiga", farg: "#f4d35e", symbol: "🥔",
    avstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 8,
    dagar_till_skord: 90,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["dill", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },

  // ---------- kål (korsblommiga) ----------
  {
    id: "vitkal", namn: "Vitkål", familj: "korsblommiga", farg: "#c5d9a8", symbol: "🥬",
    avstand_cm: 45,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 100,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["dill", "lok", "sallat", "timjan"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "broccoli", namn: "Broccoli", familj: "korsblommiga", farg: "#2e7d32", symbol: "🥦",
    avstand_cm: 40,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 0, min_utetemp: 5,
    dagar_till_skord: 65,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["dill", "sallat", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "blomkal", namn: "Blomkål", familj: "korsblommiga", farg: "#f5f0e6", symbol: "🥦",
    avstand_cm: 45,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 8,
    dagar_till_skord: 80,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 50,
    bra_grannar: ["sallat", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "gronkal", namn: "Grönkål", familj: "korsblommiga", farg: "#33691e", symbol: "🥬",
    avstand_cm: 40,
    forsa_veckor_fore_frost: 5, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 60,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["dill", "lok"],
    daliga_grannar: ["jordgubbe"],
  },
  {
    id: "kalrabbi", namn: "Kålrabbi", familj: "korsblommiga", farg: "#aed581", symbol: "🥬",
    avstand_cm: 25,
    forsa_veckor_fore_frost: 5, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 55,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["rodbeta", "gurka", "lok"],
    daliga_grannar: ["jordgubbe", "bona"],
  },
  {
    id: "rucola", namn: "Rucola", familj: "korsblommiga", farg: "#8bc34a", symbol: "🥬",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 4,
    dagar_till_skord: 30,
    vattenbehov: "medel", solbehov: "halvskugga", hojd_cm: 20,
    bra_grannar: ["radisa", "sallat"],
    daliga_grannar: [],
  },

  // ---------- lök (amaryllisväxter) ----------
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
    id: "vitlok", namn: "Vitlök", familj: "amaryllisväxter", farg: "#f3e5ab", symbol: "🧄",
    avstand_cm: 12,
    // Höstplanterad (se filens topp-kommentar): sätts ~30 veckor före NÄSTA vårs
    // frostdatum, dvs. runt september/oktober föregående höst.
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 30, min_utetemp: 0,
    dagar_till_skord: 250,
    vattenbehov: "låg", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["rodbeta", "morot", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "purjolok", namn: "Purjolök", familj: "amaryllisväxter", farg: "#7cb342", symbol: "🧅",
    avstand_cm: 15,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 8,
    dagar_till_skord: 120,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 50,
    bra_grannar: ["morot", "sallat", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "graslok", namn: "Gräslök", familj: "amaryllisväxter", farg: "#7e57c2", symbol: "🧅",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 80,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 25,
    bra_grannar: ["morot", "jordgubbe", "rodbeta"],
    daliga_grannar: ["bona", "art"],
  },

  // ---------- baljväxter ----------
  {
    id: "bona", namn: "Böna (buskböna)", familj: "ärtväxter", farg: "#26a69a", symbol: "🫘",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 12,
    dagar_till_skord: 60,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 45,
    bra_grannar: ["potatis", "gurka", "majs", "jordgubbe"],
    daliga_grannar: ["lok", "fankal", "rodbeta"],
  },
  {
    id: "art", namn: "Ärt", familj: "ärtväxter", farg: "#9ccc65", symbol: "🫛",
    avstand_cm: 6,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 4,
    dagar_till_skord: 65,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 80,
    bra_grannar: ["morot", "radisa", "gurka"],
    daliga_grannar: ["lok", "vitlok"],
  },

  // ---------- gurkväxter ----------
  {
    id: "gurka", namn: "Gurka", familj: "gurkväxter", farg: "#43a047", symbol: "🥒",
    avstand_cm: 45,
    forsa_veckor_fore_frost: 4, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 60,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 180,
    bra_grannar: ["sallat", "bona", "dill", "majs"],
    daliga_grannar: ["potatis", "tomat"],
  },
  {
    id: "zucchini", namn: "Zucchini", familj: "gurkväxter", farg: "#558b2f", symbol: "🥒",
    avstand_cm: 80,
    forsa_veckor_fore_frost: 3, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 55,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 60,
    bra_grannar: ["majs", "dill", "ringblomma"],
    daliga_grannar: ["potatis"],
  },

  // ---------- bladgrönt ----------
  {
    id: "sallat", namn: "Sallat", familj: "korgblommiga", farg: "#7cb342", symbol: "🥬",
    avstand_cm: 25,
    forsa_veckor_fore_frost: 4, direktsadd: true,
    plantera_ut_veckor_efter_frost: -2, min_utetemp: 5,
    dagar_till_skord: 50,
    vattenbehov: "hög", solbehov: "halvskugga", hojd_cm: 20,
    bra_grannar: ["morot", "radisa", "gurka", "jordgubbe"],
    daliga_grannar: [],
  },
  {
    id: "spenat", namn: "Spenat", familj: "mållväxter", farg: "#2e7d32", symbol: "🥬",
    avstand_cm: 10,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 4, min_utetemp: 4,
    dagar_till_skord: 40,
    vattenbehov: "hög", solbehov: "halvskugga", hojd_cm: 20,
    bra_grannar: ["radisa", "lok", "jordgubbe"],
    daliga_grannar: [],
  },
  {
    id: "mangold", namn: "Mangold", familj: "mållväxter", farg: "#c62828", symbol: "🥬",
    avstand_cm: 25,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 1, min_utetemp: 5,
    dagar_till_skord: 60,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["lok", "kalrabbi"],
    daliga_grannar: [],
  },
  {
    id: "radisa", namn: "Rädisa", familj: "korsblommiga", farg: "#ef5350", symbol: "🔴",
    avstand_cm: 6,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 4, min_utetemp: 4,
    dagar_till_skord: 30,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 15,
    bra_grannar: ["morot", "sallat", "gurka", "art"],
    daliga_grannar: [],
  },

  // ---------- kryddor ----------
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
    id: "dill", namn: "Dill", familj: "flockblommiga", farg: "#9ccc65", symbol: "🌾",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 7,
    dagar_till_skord: 55,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 90,
    bra_grannar: ["gurka", "sallat", "lok", "vitkal"],
    daliga_grannar: ["morot", "fankal"],
  },
  {
    id: "persilja", namn: "Persilja", familj: "flockblommiga", farg: "#43a047", symbol: "🌿",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 5,
    dagar_till_skord: 70,
    vattenbehov: "medel", solbehov: "halvskugga", hojd_cm: 25,
    bra_grannar: ["tomat", "morot"],
    daliga_grannar: [],
  },
  {
    id: "korvel", namn: "Körvel", familj: "flockblommiga", farg: "#a5d6a7", symbol: "🌿",
    avstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 45,
    vattenbehov: "medel", solbehov: "halvskugga", hojd_cm: 25,
    bra_grannar: ["sallat", "radisa"],
    daliga_grannar: [],
  },
  {
    id: "fankal", namn: "Fänkål", familj: "flockblommiga", farg: "#c0ca33", symbol: "🌿",
    avstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 10,
    dagar_till_skord: 90,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 60,
    // Fänkål hämmar de flesta andra växter kemiskt — odlas helst för sig, inga bra grannar.
    bra_grannar: [],
    daliga_grannar: ["tomat", "bona", "gurka", "dill"],
  },
  {
    id: "timjan", namn: "Timjan", familj: "kransblommiga", farg: "#8d6e63", symbol: "🌿",
    avstand_cm: 25,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 80,
    vattenbehov: "låg", solbehov: "sol", hojd_cm: 20,
    bra_grannar: ["kalrabbi", "vitkal"],
    daliga_grannar: [],
  },
  {
    id: "oregano", namn: "Oregano", familj: "kransblommiga", farg: "#7cb342", symbol: "🌿",
    avstand_cm: 25,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 80,
    vattenbehov: "låg", solbehov: "sol", hojd_cm: 30,
    bra_grannar: ["basilika", "paprika"],
    daliga_grannar: [],
  },
  {
    id: "mynta", namn: "Mynta", familj: "kransblommiga", farg: "#26a69a", symbol: "🌿",
    avstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 60,
    vattenbehov: "hög", solbehov: "halvskugga", hojd_cm: 40,
    bra_grannar: ["vitkal", "tomat"],
    daliga_grannar: [],
  },

  // ---------- bär, blommor, övrigt ----------
  {
    id: "jordgubbe", namn: "Jordgubbe", familj: "rosväxter", farg: "#e91e63", symbol: "🍓",
    avstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -2, min_utetemp: 8,
    dagar_till_skord: 30,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 20,
    bra_grannar: ["lok", "graslok", "sallat", "spenat"],
    daliga_grannar: ["vitkal", "kalrabbi", "broccoli"],
  },
  {
    id: "ringblomma", namn: "Ringblomma", familj: "korgblommiga", farg: "#ffa726", symbol: "🌼",
    avstand_cm: 20,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 60,
    vattenbehov: "låg", solbehov: "sol", hojd_cm: 40,
    bra_grannar: ["tomat", "potatis", "vitkal", "gurka"],
    daliga_grannar: [],
  },
  {
    id: "solros", namn: "Solros", familj: "korgblommiga", farg: "#fdd835", symbol: "🌻",
    avstand_cm: 40,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 80,
    vattenbehov: "medel", solbehov: "sol", hojd_cm: 200,
    bra_grannar: ["gurka", "majs"],
    daliga_grannar: ["potatis", "bona"],
  },
  {
    id: "majs", namn: "Majs", familj: "gräsväxter", farg: "#fbc02d", symbol: "🌽",
    avstand_cm: 30,
    forsa_veckor_fore_frost: 4, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 12,
    dagar_till_skord: 90,
    vattenbehov: "hög", solbehov: "sol", hojd_cm: 200,
    bra_grannar: ["bona", "gurka", "zucchini"],
    daliga_grannar: ["tomat"],
  },
];

export const plantById: Record<string, Plant> = Object.fromEntries(PLANTS.map(p => [p.id, p]));
