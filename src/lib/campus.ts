// 캠퍼스 지도 데이터 형식과 강의실 검색 (ut 꿀팁 지도 팀원 작업을 옮긴 것)
// 좌표는 OSM 범위 왼쪽 위를 원점으로 한 m 단위(x 오른쪽, y 아래쪽)이고, 지도 그림 public/campus/campus.svg 와 같다.
// 이 파일은 다른 모듈을 가져오지 않는 순수 함수만 둔다. (tests/unit/campus.test.mjs 가 Node 에서 바로 불러온다)

export interface Building {
  code: string;
  name: string;
  x: number;
  y: number;
  approx?: boolean;
}

export interface Route {
  id: string;
  title: string;
  color: string;
  via: string[];
  desc: string;
  line: [number, number][];
  meters: number;
  stops: Building[];
}

// [층, [그 층의 학과·부서·시설]]
export type FloorRow = [string, string[]];

export interface FloorInfo {
  name: string;
  floors: FloorRow[];
  aliases?: string[];
}

export interface CampusData {
  size: { w: number; h: number };
  buildings: Building[];
  busStops: { name: string; x: number; y: number }[];
  routes: Route[];
  floors: { checked: string; source: string; url: string; buildings: Record<string, FloorInfo> } | null;
}

// 건물 이름 → 코드 표. 긴 이름부터 맞춰 본다. ('스마트ICT관'이 'ICT관'보다 먼저)
export function aliasTable(data: CampusData): { key: string; code: string }[] {
  const table = new Map<string, string>();
  const add = (name: string, code: string) => {
    for (const part of name.split("/")) {
      const key = part.replace(/\(.*?\)|\s/g, "").toLowerCase();
      if (key.length >= 2 && !table.has(key)) table.set(key, code);
    }
  };
  for (const b of data.buildings) add(b.name, b.code);
  for (const [code, info] of Object.entries(data.floors?.buildings ?? {})) {
    add(info.name, code);
    for (const alias of info.aliases ?? []) add(alias, code);
  }
  return [...table].map(([key, code]) => ({ key, code })).sort((a, b) => b.key.length - a.key.length);
}

export interface RoomQuery {
  code: string;
  room?: string;
  // '2', '10', '지하 1'
  floor?: string;
}

// 'E5-213', 'e5 213', '테크노관 213', '도서관 지하 105' 같은 검색어에서 건물과 층을 찾는다.
export function parseRoomQuery(query: string, data: CampusData, aliases = aliasTable(data)): RoomQuery | null {
  let q = query.normalize("NFC").toLowerCase().trim();
  if (!q) return null;
  const codes = new Set(data.buildings.map((b) => b.code));
  let code = "";

  const m = q.match(/(?:^|[^a-z0-9])([ew])\s?(\d{1,2})(-1(?!\d))?/);
  if (m) {
    const candidate = `${m[1].toUpperCase()}${m[2]}${m[3] ?? ""}`;
    if (codes.has(candidate)) {
      code = candidate;
      q = q.replace(m[0].replace(/^[^a-z0-9]/, ""), " ");
    }
  }
  if (!code) {
    const compact = q.replace(/\s/g, "");
    const hit = aliases.find((a) => compact.includes(a.key));
    if (!hit) return null;
    code = hit.code;
  }

  const r = q.match(/(?:^|[^\d])(b|지하)?\s?(\d{3,4})(?!\d)/);
  if (!r) return { code };
  const digits = r[2];
  const floor = r[1] ? `지하 ${digits[0]}` : digits.length === 4 ? String(Number(digits.slice(0, 2))) : digits[0];
  return { code, room: `${r[1] ? "B" : ""}${digits}`, floor };
}

// 층 표기('3', '1~9')가 찾는 층을 포함하는지
export function floorHas(key: string, floor: string) {
  if (floor.startsWith("지하")) return key.replace(/\s/g, "") === floor.replace(/\s/g, "");
  const range = key.match(/^(\d+)\s*~\s*(\d+)$/);
  if (range) return Number(floor) >= Number(range[1]) && Number(floor) <= Number(range[2]);
  return key === floor;
}

// 학과·시설 이름으로 건물과 층을 찾는다. (최대 8개)
export function searchDepartments(query: string, data: CampusData) {
  const q = query.replace(/\s/g, "").toLowerCase();
  if (q.length < 2 || !data.floors) return [];
  const found: { code: string; building: string; floor: string; name: string }[] = [];
  for (const [code, info] of Object.entries(data.floors.buildings)) {
    for (const [floor, names] of info.floors) {
      for (const name of names) {
        if (name.replace(/\s/g, "").toLowerCase().includes(q)) found.push({ code, building: info.name, floor, name });
        if (found.length >= 8) return found;
      }
    }
  }
  return found;
}

export const buildingName = (data: CampusData, code: string) =>
  data.floors?.buildings[code]?.name ?? data.buildings.find((b) => b.code === code)?.name ?? code;

// 위도·경도 → 캠퍼스 지도 좌표 (scripts/lib/teams.mjs 의 toCampusXY 와 같은 식). 지도 범위 밖이면 null.
const BOUNDS = { minLat: 36.9585, maxLat: 36.9765, minLng: 127.8635 };
const MX = 111320 * Math.cos((((36.9585 + 36.9765) / 2) * Math.PI) / 180);
const MY = 110540;

export function campusXYFromLatLng(lat: number, lng: number, size = { w: 1468, h: 1990 }) {
  const x = (lng - BOUNDS.minLng) * MX;
  const y = (BOUNDS.maxLat - lat) * MY;
  if (x < 0 || y < 0 || x > size.w || y > size.h) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
