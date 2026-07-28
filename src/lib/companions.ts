// Kompanjonregler — vilka växter som inte bör stå tillsammans, och varför.
//
// Orsaken avgör hur långt problemet når. Konkurrens om vatten och näring stannar i
// den egna rutan, medan bladmögel och morotsfluga inte bryr sig om rutkanter. Utan
// den skillnaden skulle allt behandlas som "samma ruta", och grannrutor med tomat och
// potatis skulle passera obemärkt trots att det är just den kombinationen man ska undvika.
//
// Bara växter som står i jorden samtidigt jämförs — potatis som är upptagen i augusti
// kan inte smitta tomater i september.
import { angransande, type Box, type Garden, type PlantRow } from "./model";
import { plantById, type GrannOrsak, type Plant } from "./plants";
import { iJordDatum, urJordDatum } from "./schedule";

/** Når orsaken utanför den egna rutan? */
const NAR_GRANNRUTA: Record<GrannOrsak, boolean> = {
  vatten: false,
  konkurrens: false,
  rot: false,
  sjukdom: true,
  skadedjur: true,
};

export const ORSAK_TEXT: Record<GrannOrsak, string> = {
  vatten: "de vill ha olika mycket vatten",
  sjukdom: "de delar sjukdomar",
  skadedjur: "de drar till sig samma skadedjur",
  konkurrens: "de hämmar varandras tillväxt",
  rot: "rötterna kommer i vägen för varandra",
};

const ORSAK_RAD: Record<GrannOrsak, string> = {
  vatten: "Vattna dem inte i samma ruta – den ena ruttnar eller den andra torkar.",
  sjukdom: "Håll dem isär, och helst inte i intilliggande rutor: smittan sprids lätt.",
  skadedjur: "Skadedjuren hittar lätt från den ena till den andra, även mellan rutor.",
  konkurrens: "Ge dem varsin ruta så båda får växa ostört.",
  rot: "Ge dem varsin ruta så rötterna får plats.",
};

export interface GrannKonflikt {
  id: string;
  aNamn: string;
  bNamn: string;
  orsak: GrannOrsak;
  sammaRuta: boolean;
  rowId: number;
}

export interface GrannPlus {
  id: string;
  aNamn: string;
  bNamn: string;
  rowId: number;
}

function perioderKrockar(a: Plant, b: Plant, frost: string, hostfrost?: string): boolean {
  const aStart = iJordDatum(a, frost).getTime();
  const aSlut = urJordDatum(a, frost, hostfrost).getTime();
  const bStart = iJordDatum(b, frost).getTime();
  const bSlut = urJordDatum(b, frost, hostfrost).getTime();
  return aStart <= bSlut && bStart <= aSlut;
}

function boxAv(garden: Garden, row: PlantRow): Box | undefined {
  return garden.boxes.find(b => b.id === row.boxId);
}

export function grannKonflikter(garden: Garden): GrannKonflikt[] {
  const frost = garden.sistaFrostDatum || "2026-05-15";
  const hostfrost = garden.forstaHostfrostDatum;
  const sedda = new Map<string, GrannKonflikt>();

  for (const ra of garden.rows) {
    const pa = plantById[ra.plantId];
    if (!pa) continue;
    for (const rb of garden.rows) {
      if (rb.id <= ra.id) continue;
      const pb = plantById[rb.plantId];
      if (!pb || pa.id === pb.id) continue;
      if (!perioderKrockar(pa, pb, frost, hostfrost)) continue;

      // relationen kan stå angiven hos endera växten
      const traff =
        pa.daliga_grannar.find(d => d.id === pb.id) ??
        pb.daliga_grannar.find(d => d.id === pa.id);
      if (!traff) continue;

      const sammaRuta = ra.boxId === rb.boxId;
      if (!sammaRuta) {
        if (!NAR_GRANNRUTA[traff.orsak]) continue;
        const ba = boxAv(garden, ra), bb = boxAv(garden, rb);
        if (!ba || !bb || !angransande(ba, bb)) continue;
      }

      // ett par rapporteras en gång, och samma ruta väger tyngre än grannruta
      const nyckel = [pa.id, pb.id].sort().join("-");
      const fore = sedda.get(nyckel);
      if (fore && (fore.sammaRuta || !sammaRuta)) continue;
      sedda.set(nyckel, {
        id: `granne-${nyckel}`,
        aNamn: pa.namn, bNamn: pb.namn, orsak: traff.orsak, sammaRuta, rowId: rb.id,
      });
    }
  }
  return [...sedda.values()];
}

/** Bra kombinationer i samma ruta — en uppmuntran, inte en varning. */
export function grannPlus(garden: Garden): GrannPlus[] {
  const frost = garden.sistaFrostDatum || "2026-05-15";
  const hostfrost = garden.forstaHostfrostDatum;
  const sedda = new Map<string, GrannPlus>();

  for (const ra of garden.rows) {
    const pa = plantById[ra.plantId];
    if (!pa) continue;
    for (const rb of garden.rows) {
      if (rb.id <= ra.id || ra.boxId !== rb.boxId) continue;
      const pb = plantById[rb.plantId];
      if (!pb || pa.id === pb.id) continue;
      if (!perioderKrockar(pa, pb, frost, hostfrost)) continue;
      if (!pa.bra_grannar.includes(pb.id) && !pb.bra_grannar.includes(pa.id)) continue;

      const nyckel = [pa.id, pb.id].sort().join("-");
      if (sedda.has(nyckel)) continue;
      sedda.set(nyckel, { id: `plus-${nyckel}`, aNamn: pa.namn, bNamn: pb.namn, rowId: rb.id });
    }
  }
  return [...sedda.values()];
}

export function konfliktText(k: GrannKonflikt): string {
  const var_ = k.sammaRuta ? "i samma odlingsruta" : "i intilliggande odlingsrutor";
  return `${k.aNamn} och ${k.bNamn} står ${var_}, men ${ORSAK_TEXT[k.orsak]}. ` +
    ORSAK_RAD[k.orsak];
}
