// Växtdatabas. Tider anges i veckor relativt "sista vårfrost", avstånd i cm, temp i °C.
//
// AVSTÅND ANGES I TVÅ LED, precis som i odlingslitteraturen:
//   avstand_i_rad_cm = mellan plantorna längs raden
//   radavstand_cm    = mellan raderna (tvärs raden)
// För de flesta växter är radavståndet större än avståndet i raden — morötter sås
// t.ex. tätt i raden men behöver luft mellan raderna.
//
// Värdena är STANDARDREKOMMENDATIONER. Radavståndet i litteraturen rymmer två saker:
// plantans eget utrymmesbehov OCH arbetsutrymme att komma åt för rensning och skörd.
// I en odlingsbädd når man in från sidan, så radavståndet kan ofta kortas en bit utan
// att plantorna far illa — därför kan raderna komprimeras i appen (med varning), och
// mer än avståndet i raden kan komprimeras. Se MIN_ROW_COMPRESSION i model.ts.
//
// Baslinje: köksträdgårdsväxter i svenskt klimat, sammanställd från allmänt vedertagen
// odlings- och samplanteringspraxis. Samplantering är sällan exakt vetenskap — listorna
// täcker de mest väletablerade paren, inte varje tänkbar kombination.
// skord_kg_per_m2 och jord/beskrivning är grova referensvärden för hobbyodling, inte
// facit — verklig skörd varierar mycket med sort, väder och skötsel.
//
// OBS: Ringblomma (Calendula) och Tagetes är olika växter som båda kallas "sammetsblomma"/
// "marigold" i dagligt tal — de är avsiktligt separata poster här.
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
  avstand_i_rad_cm: number; // mellan plantor längs raden
  radavstand_cm: number;    // mellan rader
  avstand_notering?: string; // t.ex. skillnad mellan sorttyper
  forsa_veckor_fore_frost: number | null; // null = förkultiveras ej
  direktsadd: boolean;
  direktsadd_veckor_fore_frost?: number; // negativ = efter frost
  plantera_ut_veckor_efter_frost?: number;
  min_utetemp: number;
  dagar_till_skord: number; // endast upplysning — genererar inga schemarader
  skordeperiod_dagar: number; // hur länge grödan står kvar efter mognad
  skuggtathet: number; // 0–1: hur mycket ljus bladverket blockerar
  vattenbehov: Vattenbehov;
  solbehov: Solbehov;
  jord: string; // kort jordbeskrivning för infokortet
  hojd_cm: number;
  skord_kg_per_m2?: number; // ungefärlig skörd; utelämnas för prydnadsväxter
  beskrivning: string; // kort körtext för infokortet
  bra_grannar: string[];
  daliga_grannar: string[];
}

export const PLANTS: Plant[] = [
  // ---------- frukt/frukter (Solanaceae m.fl.) ----------
  {
    id: "tomat", namn: "Tomat", familj: "potatisväxter", farg: "#e05d44", symbol: "🍅",
    avstand_i_rad_cm: 60, radavstand_cm: 90,
    avstand_notering: "Värdena gäller indeterminata (högväxande) sorter: 60–90 cm i raden, " +
      "90–120 cm mellan rader. Determinata (buskiga) sorter klarar sig med 45–60 cm i raden " +
      "och 75–100 cm mellan rader.",
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 75,
    skordeperiod_dagar: 60, skuggtathet: 0.7,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, väldränerad", hojd_cm: 150,
    skord_kg_per_m2: 8,
    beskrivning: "Odlingens favorit – kräver stöd och regelbunden vattning men belönar med smakrik skörd hela sommaren.",
    bra_grannar: ["basilika", "morot", "ringblomma", "tagetes", "lok", "persilja"],
    daliga_grannar: ["potatis", "fankal", "majs"],
  },
  {
    id: "paprika", namn: "Paprika", familj: "potatisväxter", farg: "#fb8c00", symbol: "🫑",
    avstand_i_rad_cm: 45, radavstand_cm: 60,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 15,
    dagar_till_skord: 90,
    skordeperiod_dagar: 45, skuggtathet: 0.7,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, varm jord", hojd_cm: 60,
    skord_kg_per_m2: 3,
    beskrivning: "Vill ha värme och lång säsong – klarar sig bäst i växthus eller varmt, skyddat läge.",
    bra_grannar: ["basilika", "lok", "oregano"],
    daliga_grannar: ["bona", "fankal"],
  },
  {
    id: "potatis", namn: "Potatis", familj: "potatisväxter", farg: "#a1887f", symbol: "🥔",
    avstand_i_rad_cm: 30, radavstand_cm: 70,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 8,
    dagar_till_skord: 90,
    skordeperiod_dagar: 30, skuggtathet: 0.7,
    vattenbehov: "medel", solbehov: "sol", jord: "Lucker, något sur jord", hojd_cm: 60,
    skord_kg_per_m2: 4,
    beskrivning: "Enkel och tacksam – kupa jord runt plantorna för större knölar och skydd mot bladmögel.",
    bra_grannar: ["bona", "majs", "vitkal", "tagetes"],
    daliga_grannar: ["tomat", "gurka", "zucchini", "solros", "pumpa"],
  },

  // ---------- rotfrukter ----------
  {
    id: "morot", namn: "Morot", familj: "flockblommiga", farg: "#e8912d", symbol: "🥕",
    avstand_i_rad_cm: 4, radavstand_cm: 25,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 70,
    skordeperiod_dagar: 90, skuggtathet: 0.4,
    vattenbehov: "medel", solbehov: "sol", jord: "Djup, stenfri jord", hojd_cm: 30,
    skord_kg_per_m2: 4,
    beskrivning: "Sås tätt i raden och gallras – långsam att gro men mycket tålig. Ger stor skörd på liten yta.",
    bra_grannar: ["lok", "purjolok", "radisa", "sallat", "graslok"],
    daliga_grannar: ["dill"],
  },
  {
    id: "rodbeta", namn: "Rödbeta", familj: "mållväxter", farg: "#ad1457", symbol: "🔴",
    avstand_i_rad_cm: 10, radavstand_cm: 25,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 70,
    skordeperiod_dagar: 75, skuggtathet: 0.6,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, ej färsk gödsel", hojd_cm: 30,
    skord_kg_per_m2: 4,
    beskrivning: "Odlas för både rot och blad – tåligt och lättodlat, bra växt för nybörjare.",
    bra_grannar: ["lok", "kalrabbi", "vitkal", "graslok"],
    daliga_grannar: ["bona"],
  },
  {
    id: "palsternacka", namn: "Palsternacka", familj: "flockblommiga", farg: "#d7ccc8", symbol: "🥕",
    avstand_i_rad_cm: 10, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 4,
    dagar_till_skord: 130,
    skordeperiod_dagar: 90, skuggtathet: 0.45,
    vattenbehov: "medel", solbehov: "sol", jord: "Djup, lucker jord", hojd_cm: 30,
    skord_kg_per_m2: 3,
    beskrivning: "Lång odlingssäsong men smaken förbättras av frost – skörda gärna efter första kölden.",
    bra_grannar: ["lok", "radisa"],
    daliga_grannar: ["dill"],
  },
  {
    id: "kalrot", namn: "Kålrot", familj: "korsblommiga", farg: "#f4d35e", symbol: "🥔",
    avstand_i_rad_cm: 30, radavstand_cm: 45,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 8,
    dagar_till_skord: 90,
    skordeperiod_dagar: 60, skuggtathet: 0.6,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, fast jord", hojd_cm: 40,
    skord_kg_per_m2: 5,
    beskrivning: "Storväxande rotfrukt som lagrar bra – ger mycket mat per planterad yta.",
    bra_grannar: ["dill", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },

  // ---------- kål (korsblommiga) ----------
  {
    id: "vitkal", namn: "Vitkål", familj: "korsblommiga", farg: "#c5d9a8", symbol: "🥬",
    avstand_i_rad_cm: 50, radavstand_cm: 60,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 100,
    skordeperiod_dagar: 60, skuggtathet: 0.8,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, fuktighållande", hojd_cm: 40,
    skord_kg_per_m2: 6,
    beskrivning: "Tar plats och tid men lagrar utmärkt – en klassiker för vinterförråd.",
    bra_grannar: ["dill", "lok", "sallat", "timjan"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "broccoli", namn: "Broccoli", familj: "korsblommiga", farg: "#2e7d32", symbol: "🥦",
    avstand_i_rad_cm: 45, radavstand_cm: 60,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 0, min_utetemp: 5,
    dagar_till_skord: 65,
    skordeperiod_dagar: 45, skuggtathet: 0.8,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, fuktighållande", hojd_cm: 60,
    skord_kg_per_m2: 2,
    beskrivning: "Skörda huvudknoppen innan den blommar – nya sidoskott ger sedan flera skördar till.",
    bra_grannar: ["dill", "sallat", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "blomkal", namn: "Blomkål", familj: "korsblommiga", farg: "#f5f0e6", symbol: "🥦",
    avstand_i_rad_cm: 50, radavstand_cm: 60,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 8,
    dagar_till_skord: 80,
    skordeperiod_dagar: 14, skuggtathet: 0.8,
    vattenbehov: "hög", solbehov: "sol", jord: "Mycket näringsrik jord", hojd_cm: 50,
    skord_kg_per_m2: 2.5,
    beskrivning: "Kräver jämn tillgång på vatten och näring för att bilda fasta, vita huvuden.",
    bra_grannar: ["sallat", "lok"],
    daliga_grannar: ["jordgubbe", "tomat"],
  },
  {
    id: "gronkal", namn: "Grönkål", familj: "korsblommiga", farg: "#33691e", symbol: "🥬",
    avstand_i_rad_cm: 45, radavstand_cm: 60,
    forsa_veckor_fore_frost: 5, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 60,
    skordeperiod_dagar: 120, skuggtathet: 0.8,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, tålig jord", hojd_cm: 60,
    skord_kg_per_m2: 2,
    beskrivning: "Tålig mot kyla – smaken blir sötare efter de första frostnätterna.",
    bra_grannar: ["dill", "lok"],
    daliga_grannar: ["jordgubbe"],
  },
  {
    id: "kalrabbi", namn: "Kålrabbi", familj: "korsblommiga", farg: "#aed581", symbol: "🥬",
    avstand_i_rad_cm: 25, radavstand_cm: 35,
    forsa_veckor_fore_frost: 5, direktsadd: false,
    plantera_ut_veckor_efter_frost: -1, min_utetemp: 5,
    dagar_till_skord: 55,
    skordeperiod_dagar: 21, skuggtathet: 0.65,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, lucker jord", hojd_cm: 30,
    skord_kg_per_m2: 3,
    beskrivning: "Snabbväxande och mild i smaken – skörda medan knölen fortfarande är golfbollsstor.",
    bra_grannar: ["rodbeta", "gurka", "lok"],
    daliga_grannar: ["jordgubbe", "bona"],
  },
  {
    id: "rucola", namn: "Rucola", familj: "korsblommiga", farg: "#8bc34a", symbol: "🥬",
    avstand_i_rad_cm: 10, radavstand_cm: 20,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 4,
    dagar_till_skord: 30,
    skordeperiod_dagar: 21, skuggtathet: 0.55,
    vattenbehov: "medel", solbehov: "halvskugga", jord: "Lätt, fuktighållande jord", hojd_cm: 20,
    skord_kg_per_m2: 1.5,
    beskrivning: "Snabb och pepprig sallat – så om flera gånger under säsongen för ständig skörd.",
    bra_grannar: ["radisa", "sallat"],
    daliga_grannar: [],
  },

  // ---------- lök (amaryllisväxter) ----------
  {
    id: "lok", namn: "Lök", familj: "amaryllisväxter", farg: "#ab47bc", symbol: "🧅",
    avstand_i_rad_cm: 10, radavstand_cm: 25,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 100,
    skordeperiod_dagar: 14, skuggtathet: 0.35,
    vattenbehov: "låg", solbehov: "sol", jord: "Väldränerad, näringsrik", hojd_cm: 40,
    skord_kg_per_m2: 4,
    beskrivning: "Långsam start men lagringsbar länge – låt looken torka ordentligt innan förvaring.",
    bra_grannar: ["morot", "tomat", "sallat", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "vitlok", namn: "Vitlök", familj: "amaryllisväxter", farg: "#f3e5ab", symbol: "🧄",
    avstand_i_rad_cm: 15, radavstand_cm: 30,
    // Höstplanterad (se filens topp-kommentar): sätts ~30 veckor före NÄSTA vårs
    // frostdatum, dvs. runt september/oktober föregående höst.
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 30, min_utetemp: 0,
    dagar_till_skord: 250,
    skordeperiod_dagar: 14, skuggtathet: 0.35,
    vattenbehov: "låg", solbehov: "sol", jord: "Väldränerad, lucker jord", hojd_cm: 40,
    skord_kg_per_m2: 2,
    beskrivning: "Höstplanteras och övervintrar i jorden – skördas följande sommar när bladen gulnar.",
    bra_grannar: ["rodbeta", "morot", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "purjolok", namn: "Purjolök", familj: "amaryllisväxter", farg: "#7cb342", symbol: "🧅",
    avstand_i_rad_cm: 15, radavstand_cm: 35,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 8,
    dagar_till_skord: 120,
    skordeperiod_dagar: 90, skuggtathet: 0.4,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, fuktighållande", hojd_cm: 50,
    skord_kg_per_m2: 4,
    beskrivning: "Tålig och frosthärdig – kan ofta skördas långt in på vintern direkt från bädden.",
    bra_grannar: ["morot", "sallat", "jordgubbe"],
    daliga_grannar: ["bona", "art"],
  },
  {
    id: "graslok", namn: "Gräslök", familj: "amaryllisväxter", farg: "#7e57c2", symbol: "🧅",
    avstand_i_rad_cm: 20, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 80,
    skordeperiod_dagar: 150, skuggtathet: 0.35,
    vattenbehov: "medel", solbehov: "sol", jord: "De flesta jordar", hojd_cm: 25,
    skord_kg_per_m2: 1,
    beskrivning: "Flerårig krydda som gärna delas – klipp återkommande för nya, mjuka strån.",
    bra_grannar: ["morot", "jordgubbe", "rodbeta"],
    daliga_grannar: ["bona", "art"],
  },

  // ---------- baljväxter ----------
  {
    id: "bona", namn: "Böna (buskböna)", familj: "ärtväxter", farg: "#26a69a", symbol: "🫘",
    avstand_i_rad_cm: 10, radavstand_cm: 50,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 12,
    dagar_till_skord: 60,
    skordeperiod_dagar: 40, skuggtathet: 0.65,
    vattenbehov: "medel", solbehov: "sol", jord: "Lucker, väldränerad jord", hojd_cm: 45,
    skord_kg_per_m2: 3,
    beskrivning: "Kvävefixerande buskböna som förbättrar jorden – enkel och pålitlig skörd.",
    bra_grannar: ["potatis", "gurka", "majs", "jordgubbe"],
    daliga_grannar: ["lok", "fankal", "rodbeta"],
  },
  {
    id: "art", namn: "Ärt", familj: "ärtväxter", farg: "#9ccc65", symbol: "🫛",
    avstand_i_rad_cm: 5, radavstand_cm: 40,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 4,
    dagar_till_skord: 65,
    skordeperiod_dagar: 30, skuggtathet: 0.6,
    vattenbehov: "medel", solbehov: "sol", jord: "Lucker, kalkrik jord", hojd_cm: 80,
    skord_kg_per_m2: 2,
    beskrivning: "Kallälskande – så tidigt på våren innan värmen sätter fart på skadeinsekter.",
    bra_grannar: ["morot", "radisa", "gurka"],
    daliga_grannar: ["lok", "vitlok"],
  },

  // ---------- gurkväxter ----------
  {
    id: "gurka", namn: "Gurka", familj: "gurkväxter", farg: "#43a047", symbol: "🥒",
    avstand_i_rad_cm: 45, radavstand_cm: 90,
    forsa_veckor_fore_frost: 4, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 60,
    skordeperiod_dagar: 45, skuggtathet: 0.75,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, varm jord", hojd_cm: 180,
    skord_kg_per_m2: 8,
    beskrivning: "Trivs bäst med stöd att klättra på – jämn vattning ger raka, sötare frukter.",
    bra_grannar: ["sallat", "bona", "dill", "majs"],
    daliga_grannar: ["potatis", "tomat"],
  },
  {
    id: "zucchini", namn: "Zucchini", familj: "gurkväxter", farg: "#558b2f", symbol: "🥒",
    avstand_i_rad_cm: 80, radavstand_cm: 100,
    forsa_veckor_fore_frost: 3, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 55,
    skordeperiod_dagar: 45, skuggtathet: 0.85,
    vattenbehov: "hög", solbehov: "sol", jord: "Mycket näringsrik jord", hojd_cm: 60,
    skord_kg_per_m2: 10,
    beskrivning: "Extremt produktiv – en enda planta kan ge skörd flera gånger i veckan hela sommaren.",
    bra_grannar: ["majs", "dill", "ringblomma"],
    daliga_grannar: ["potatis"],
  },
  {
    id: "pumpa", namn: "Pumpa", familj: "gurkväxter", farg: "#f4511e", symbol: "🎃",
    avstand_i_rad_cm: 100, radavstand_cm: 150,
    forsa_veckor_fore_frost: 3, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 100,
    skordeperiod_dagar: 20, skuggtathet: 0.85,
    vattenbehov: "hög", solbehov: "sol", jord: "Varm, mycket näringsrik", hojd_cm: 40,
    skord_kg_per_m2: 10,
    beskrivning: "Storväxande – ger enorm skörd men behöver plats, gärna 1 m² eller mer per planta.",
    bra_grannar: ["majs", "bona", "tagetes"],
    daliga_grannar: ["potatis"],
  },

  // ---------- bladgrönt ----------
  {
    id: "sallat", namn: "Sallat", familj: "korgblommiga", farg: "#7cb342", symbol: "🥬",
    avstand_i_rad_cm: 25, radavstand_cm: 35,
    forsa_veckor_fore_frost: 4, direktsadd: true,
    plantera_ut_veckor_efter_frost: -2, min_utetemp: 5,
    dagar_till_skord: 50,
    skordeperiod_dagar: 20, skuggtathet: 0.75,
    vattenbehov: "hög", solbehov: "halvskugga", jord: "Fuktighållande, näringsrik", hojd_cm: 20,
    skord_kg_per_m2: 2,
    beskrivning: "Snabbväxande och mångsidig – så lite i taget för jämn skörd hela säsongen.",
    bra_grannar: ["morot", "radisa", "gurka", "jordgubbe"],
    daliga_grannar: [],
  },
  {
    id: "spenat", namn: "Spenat", familj: "mållväxter", farg: "#2e7d32", symbol: "🥬",
    avstand_i_rad_cm: 10, radavstand_cm: 25,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 4, min_utetemp: 4,
    dagar_till_skord: 45,
    skordeperiod_dagar: 21, skuggtathet: 0.7,
    vattenbehov: "hög", solbehov: "halvskugga", jord: "Näringsrik, fuktighållande", hojd_cm: 20,
    skord_kg_per_m2: 2.5,
    beskrivning: "Går snabbt i blom vid värme – odla tidigt på våren eller under sensommar/höst.",
    bra_grannar: ["radisa", "lok", "jordgubbe"],
    daliga_grannar: [],
  },
  {
    id: "mangold", namn: "Mangold", familj: "mållväxter", farg: "#c62828", symbol: "🥬",
    avstand_i_rad_cm: 30, radavstand_cm: 40,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 1, min_utetemp: 5,
    dagar_till_skord: 60,
    skordeperiod_dagar: 90, skuggtathet: 0.75,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik jord", hojd_cm: 40,
    skord_kg_per_m2: 3,
    beskrivning: "Vacker och tålig – skörda de yttre bladen löpande så växer plantan vidare.",
    bra_grannar: ["lok", "kalrabbi"],
    daliga_grannar: [],
  },
  {
    id: "radisa", namn: "Rädisa", familj: "korsblommiga", farg: "#ef5350", symbol: "🔴",
    avstand_i_rad_cm: 5, radavstand_cm: 15,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 4, min_utetemp: 4,
    dagar_till_skord: 30,
    skordeperiod_dagar: 14, skuggtathet: 0.55,
    vattenbehov: "medel", solbehov: "sol", jord: "Lätt, lucker jord", hojd_cm: 15,
    skord_kg_per_m2: 2,
    beskrivning: "Snabbast av alla – klar på en dryg månad, perfekt för otåliga nybörjare.",
    bra_grannar: ["morot", "sallat", "gurka", "art"],
    daliga_grannar: [],
  },

  // ---------- kryddor ----------
  {
    id: "basilika", namn: "Basilika", familj: "kransblommiga", farg: "#66bb6a", symbol: "🌿",
    avstand_i_rad_cm: 25, radavstand_cm: 35,
    forsa_veckor_fore_frost: 6, direktsadd: false,
    plantera_ut_veckor_efter_frost: 2, min_utetemp: 12,
    dagar_till_skord: 40,
    skordeperiod_dagar: 60, skuggtathet: 0.6,
    vattenbehov: "hög", solbehov: "sol", jord: "Varm, väldränerad jord", hojd_cm: 30,
    skord_kg_per_m2: 1,
    beskrivning: "Värmeälskande krydda – nyp bort blomknoppar för en buskigare, mer smakrik planta.",
    bra_grannar: ["tomat"],
    daliga_grannar: [],
  },
  {
    id: "dill", namn: "Dill", familj: "flockblommiga", farg: "#9ccc65", symbol: "🌾",
    avstand_i_rad_cm: 10, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 0, min_utetemp: 7,
    dagar_till_skord: 55,
    skordeperiod_dagar: 60, skuggtathet: 0.4,
    vattenbehov: "medel", solbehov: "sol", jord: "De flesta jordar", hojd_cm: 90,
    skord_kg_per_m2: 1,
    beskrivning: "Självsår gärna – låt några plantor gå i frö så kommer nästa års skörd av sig själv.",
    bra_grannar: ["gurka", "sallat", "lok", "vitkal"],
    daliga_grannar: ["morot", "fankal"],
  },
  {
    id: "persilja", namn: "Persilja", familj: "flockblommiga", farg: "#43a047", symbol: "🌿",
    avstand_i_rad_cm: 15, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 3, min_utetemp: 5,
    dagar_till_skord: 70,
    skordeperiod_dagar: 90, skuggtathet: 0.5,
    vattenbehov: "medel", solbehov: "halvskugga", jord: "Näringsrik, fuktighållande", hojd_cm: 25,
    skord_kg_per_m2: 1,
    beskrivning: "Tvåårig ört som odlas som ettårig – långsam att gro, ha tålamod de första veckorna.",
    bra_grannar: ["tomat", "morot"],
    daliga_grannar: [],
  },
  {
    id: "korvel", namn: "Körvel", familj: "flockblommiga", farg: "#a5d6a7", symbol: "🌿",
    avstand_i_rad_cm: 15, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: 2, min_utetemp: 5,
    dagar_till_skord: 45,
    skordeperiod_dagar: 45, skuggtathet: 0.45,
    vattenbehov: "medel", solbehov: "halvskugga", jord: "Fuktighållande, skuggtålig", hojd_cm: 25,
    skord_kg_per_m2: 1,
    beskrivning: "Mild anisliknande smak – trivs svalare och skuggigare än de flesta andra örter.",
    bra_grannar: ["sallat", "radisa"],
    daliga_grannar: [],
  },
  {
    id: "fankal", namn: "Fänkål", familj: "flockblommiga", farg: "#c0ca33", symbol: "🌿",
    avstand_i_rad_cm: 30, radavstand_cm: 45,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 10,
    dagar_till_skord: 90,
    skordeperiod_dagar: 30, skuggtathet: 0.45,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, väldränerad", hojd_cm: 60,
    skord_kg_per_m2: 2,
    beskrivning: "Stark smak och kemiskt hämmande på grannarna – odla gärna för sig själv i egen ruta.",
    // Fänkål hämmar de flesta andra växter kemiskt — odlas helst för sig, inga bra grannar.
    bra_grannar: [],
    daliga_grannar: ["tomat", "bona", "gurka", "dill"],
  },
  {
    id: "timjan", namn: "Timjan", familj: "kransblommiga", farg: "#8d6e63", symbol: "🌿",
    avstand_i_rad_cm: 30, radavstand_cm: 40,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 80,
    skordeperiod_dagar: 120, skuggtathet: 0.55,
    vattenbehov: "låg", solbehov: "sol", jord: "Torr, mager jord", hojd_cm: 20,
    skord_kg_per_m2: 0.5,
    beskrivning: "Medelhavsört som ogillar blöt jord – vattna sparsamt för starkast smak och arom.",
    bra_grannar: ["kalrabbi", "vitkal"],
    daliga_grannar: [],
  },
  {
    id: "oregano", namn: "Oregano", familj: "kransblommiga", farg: "#7cb342", symbol: "🌿",
    avstand_i_rad_cm: 30, radavstand_cm: 40,
    forsa_veckor_fore_frost: 8, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 10,
    dagar_till_skord: 80,
    skordeperiod_dagar: 120, skuggtathet: 0.6,
    vattenbehov: "låg", solbehov: "sol", jord: "Torr, mager jord", hojd_cm: 30,
    skord_kg_per_m2: 0.5,
    beskrivning: "Tålig krypväxt som breder ut sig – funkar fint som doftande marktäckare mellan grönsaker.",
    bra_grannar: ["basilika", "paprika"],
    daliga_grannar: [],
  },
  {
    id: "mynta", namn: "Mynta", familj: "kransblommiga", farg: "#26a69a", symbol: "🌿",
    avstand_i_rad_cm: 35, radavstand_cm: 45,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 60,
    skordeperiod_dagar: 120, skuggtathet: 0.65,
    vattenbehov: "hög", solbehov: "halvskugga", jord: "Fuktig jord", hojd_cm: 40,
    skord_kg_per_m2: 1,
    beskrivning: "Sprider sig aggressivt via utlöpare – odla helst i egen kruka eller väl avgränsad ruta.",
    bra_grannar: ["vitkal", "tomat"],
    daliga_grannar: [],
  },

  // ---------- bär, blommor, övrigt ----------
  {
    id: "jordgubbe", namn: "Jordgubbe", familj: "rosväxter", farg: "#e91e63", symbol: "🍓",
    avstand_i_rad_cm: 30, radavstand_cm: 50,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -2, min_utetemp: 8,
    dagar_till_skord: 110,
    skordeperiod_dagar: 30, skuggtathet: 0.7,
    vattenbehov: "hög", solbehov: "sol", jord: "Näringsrik, väldränerad", hojd_cm: 20,
    skord_kg_per_m2: 1.5,
    beskrivning: "Ge plantorna ett år att etablera sig för bästa skörd – förnya odlingen var 3–4 år.",
    bra_grannar: ["lok", "graslok", "sallat", "spenat"],
    daliga_grannar: ["vitkal", "kalrabbi", "broccoli"],
  },
  {
    id: "ringblomma", namn: "Ringblomma", familj: "korgblommiga", farg: "#ffa726", symbol: "🌼",
    avstand_i_rad_cm: 25, radavstand_cm: 35,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 60,
    skordeperiod_dagar: 90, skuggtathet: 0.6,
    vattenbehov: "låg", solbehov: "sol", jord: "De flesta jordar", hojd_cm: 40,
    beskrivning: "Ätbar prydnadsblomma som lockar nyttoinsekter och sägs avskräcka flera skadedjur.",
    bra_grannar: ["tomat", "potatis", "vitkal", "gurka"],
    daliga_grannar: [],
  },
  {
    id: "tagetes", namn: "Tagetes", familj: "korgblommiga", farg: "#e65100", symbol: "🏵️",
    avstand_i_rad_cm: 20, radavstand_cm: 30,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 60,
    skordeperiod_dagar: 90, skuggtathet: 0.6,
    vattenbehov: "låg", solbehov: "sol", jord: "De flesta jordar", hojd_cm: 30,
    beskrivning: "Klassisk skadedjursavvisande följeslagare – rötterna motverkar nematoder i jorden.",
    bra_grannar: ["tomat", "potatis", "gurka", "pumpa"],
    daliga_grannar: [],
  },
  {
    id: "solros", namn: "Solros", familj: "korgblommiga", farg: "#fdd835", symbol: "🌻",
    avstand_i_rad_cm: 40, radavstand_cm: 60,
    forsa_veckor_fore_frost: null, direktsadd: true,
    direktsadd_veckor_fore_frost: -1, min_utetemp: 8,
    dagar_till_skord: 80,
    skordeperiod_dagar: 45, skuggtathet: 0.55,
    vattenbehov: "medel", solbehov: "sol", jord: "Näringsrik, djup jord", hojd_cm: 200,
    beskrivning: "Storväxt blickfång som ger eftermiddagsskugga och senare en fröskörd till fåglarna.",
    bra_grannar: ["gurka", "majs"],
    daliga_grannar: ["potatis", "bona"],
  },
  {
    id: "majs", namn: "Majs", familj: "gräsväxter", farg: "#fbc02d", symbol: "🌽",
    avstand_i_rad_cm: 30, radavstand_cm: 70,
    forsa_veckor_fore_frost: 4, direktsadd: false,
    plantera_ut_veckor_efter_frost: 1, min_utetemp: 12,
    dagar_till_skord: 90,
    skordeperiod_dagar: 21, skuggtathet: 0.5,
    vattenbehov: "hög", solbehov: "sol", jord: "Mycket näringsrik, varm", hojd_cm: 200,
    skord_kg_per_m2: 2,
    beskrivning: "Vindpollinerad – odla alltid i ett block med flera rader, aldrig en enda lång rad.",
    bra_grannar: ["bona", "gurka", "zucchini"],
    daliga_grannar: ["tomat"],
  },
];

export const plantById: Record<string, Plant> = Object.fromEntries(PLANTS.map(p => [p.id, p]));

// Ungefärligt antal plantor per m² utifrån avstånd i raden × radavstånd.
export function plantsPerM2(p: Plant): number {
  return 10000 / (p.avstand_i_rad_cm * p.radavstand_cm);
}
