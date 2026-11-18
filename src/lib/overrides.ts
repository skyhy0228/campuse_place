// 운영자가 승인한 '정보가 달라요' 제보의 바뀐 값을 장소에 덮어쓴다.
// 원본 XLSX 와 places.json 은 그대로 두고, 화면에서만 최신 값으로 보여준다. (운영자가 나중에 원본을 고치면 제보를 내려도 된다)
// 운영시간·가격은 변환 스크립트와 같은 규칙(scripts/lib/derive.mjs)으로 다시 해석한다. 해석할 수 없으면 '영업 중' 판단을 하지 않는다.
// 이 파일은 tests/unit 에서 바로 불러오므로 타입 외에는 derive.mjs 만 가져온다.
import { parseHours, parsePrice, priceBand } from "../../scripts/lib/derive.mjs";
import type { Place, PlaceChanges } from "../types";

export const CHANGE_FIELDS = ["hours", "closedDays", "price", "menu", "location"] as const;
export type ChangeField = (typeof CHANGE_FIELDS)[number];
export const MAX_CHANGE_LENGTH = 200;

// 서버(clean_changes)와 같은 규칙으로 받을 수 있는 값만 남긴다. 남는 값이 없으면 null.
export function cleanChanges(raw: unknown): PlaceChanges | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const out: PlaceChanges = {};
  for (const key of CHANGE_FIELDS) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, MAX_CHANGE_LENGTH);
  }
  if (obj.closed === true) out.closed = true;
  return Object.keys(out).length ? out : null;
}

// reviewedAt: 운영자가 승인한 시각(ISO). 고친 정보는 그날 확인한 것으로 본다.
export function applyChanges(place: Place, changes: PlaceChanges, reviewedAt: string): Place {
  const day = reviewedAt.slice(0, 10);
  const next: Place = { ...place, changedAt: day };
  // 바뀐 칸의 중국어 번역은 옛 내용이라 지우고 한국어로 보여준다.
  const zh = place.zh ? { ...place.zh } : undefined;

  if (changes.hours !== undefined) {
    next.hours = changes.hours;
    next.schedule = parseHours(changes.hours);
    if (zh) delete zh.hours;
  }
  if (changes.closedDays !== undefined) next.closedDays = changes.closedDays;
  if (changes.price !== undefined) {
    next.price = changes.price;
    const { priceMin, free } = parsePrice(changes.price);
    next.priceBand = priceBand(priceMin, free);
    if (zh) delete zh.price;
  }
  if (changes.menu !== undefined) {
    next.menu = changes.menu;
    if (zh) delete zh.menu;
  }
  if (changes.location !== undefined) {
    // 지도 좌표는 그대로 둔다. 가게가 옮겨 갔다면 data/place-coordinates.json 을 고쳐야 한다.
    next.location = changes.location;
    next.locationNotes = [];
    if (zh) delete zh.location;
  }
  if (changes.closed) next.closed = true;
  if (zh) next.zh = zh;
  if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day > (place.checkedSort || "")) {
    next.checkedAt = day;
    next.checkedSort = day;
  }
  return next;
}

export interface Override {
  place_id: string;
  changes: unknown;
  reviewed_at: string | null;
}

// 같은 장소의 제보가 여러 개면 승인한 순서대로 차례로 덮어쓴다.
export function groupOverrides(rows: Override[]): Map<string, { changes: PlaceChanges; reviewedAt: string }[]> {
  const map = new Map<string, { changes: PlaceChanges; reviewedAt: string }[]>();
  const sorted = [...rows].sort((a, b) => (a.reviewed_at ?? "").localeCompare(b.reviewed_at ?? ""));
  for (const row of sorted) {
    const changes = cleanChanges(row.changes);
    if (!changes || !row.place_id) continue;
    const list = map.get(row.place_id) ?? [];
    list.push({ changes, reviewedAt: row.reviewed_at ?? "" });
    map.set(row.place_id, list);
  }
  return map;
}
