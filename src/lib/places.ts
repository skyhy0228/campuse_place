import type { Filters, Place, PlacesFile, SortKey } from "../types";
import { toChoseong, isChoseongQuery } from "./choseong";
import { openStatus } from "./hours";

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

// 카드와 상세 화면에서 반복해 쓰는 파생 값을 한 번만 계산해 둔다.
export interface PlaceView extends Place {
  categoryLabel: string;
  isFood: boolean;
  isRecent: boolean;
  menuItems: string[];
  hoursItems: string[];
  priceItems: string[];
  detailItems: string[];
  safeMapUrl: string;
  haystack: string;
  choseong: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  식당: "맛집",
  카페: "카페",
  학교시설: "교내 시설",
  숨은장소: "숨은 장소",
  생활꿀팁: "생활 꿀팁",
  관광지: "관광지",
  자유: "자유 정보",
};
const CATEGORY_ORDER = ["식당", "카페", "학교시설", "숨은장소", "생활꿀팁", "관광지", "자유"];
// '최근 확인'은 데이터에서 가장 최근에 확인한 날짜의 항목이다. (대부분이 같은 주에 확인돼 기간을 넓히면 표시가 의미를 잃는다)
const RECENT_DAYS = 0;

export const categoryLabel = (category: string) => CATEGORY_LABELS[category] ?? category;

export function normalizeText(value: string) {
  return value.normalize("NFC").toLowerCase();
}

function uniq(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(item);
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const splitBy = (value: string, pattern: RegExp) =>
  uniq(value.split(pattern).map((part) => part.trim()).filter(Boolean));

export function isNaverMapUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "naver.me" || url.hostname === "map.naver.com");
  } catch {
    return false;
  }
}

const dayMs = 24 * 60 * 60 * 1000;

export function toView(place: Place, recentFrom: string): PlaceView {
  const label = categoryLabel(place.category);
  const detailItems = splitBy(place.details, /\s\/\s/).filter(
    (item) => normalizeText(item) !== normalizeText(place.summary),
  );
  const menuItems = splitBy(place.menu, /\s*\|\s*|,\s+/);
  return {
    ...place,
    categoryLabel: label,
    isFood: place.category === "식당" || place.category === "카페",
    isRecent: Boolean(place.checkedSort) && place.checkedSort >= recentFrom,
    menuItems,
    hoursItems: splitBy(place.hours, /\s*\|\s*/),
    priceItems: splitBy(place.price, /\s*\|\s*/),
    detailItems,
    safeMapUrl: isNaverMapUrl(place.mapUrl) ? place.mapUrl : "",
    haystack: normalizeText(
      [place.name, place.location, ...place.locationNotes, place.category, label, place.menu, place.summary, place.details].join("\n"),
    ),
    choseong: toChoseong([place.name, place.menu].join(" ")),
  };
}

export async function loadPlaces(signal?: AbortSignal): Promise<PlaceView[]> {
  const response = await fetch(assetUrl("data/places.json"), { signal });
  if (!response.ok) throw new Error(`데이터를 불러오지 못했습니다 (${response.status})`);
  const data = (await response.json()) as PlacesFile;
  if (!Array.isArray(data.places)) throw new Error("데이터 형식이 올바르지 않습니다");

  const latest = data.places.map((p) => p.checkedSort).filter(Boolean).sort().at(-1);
  const recentFrom = latest ? new Date(new Date(latest).getTime() - RECENT_DAYS * dayMs).toISOString().slice(0, 10) : "9999";
  return data.places.map((place) => toView(place, recentFrom));
}

export interface CategoryOption {
  value: string;
  label: string;
  count: number;
}

export function buildCategories(places: PlaceView[]): CategoryOption[] {
  const counts = new Map<string, number>();
  for (const place of places) counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  const known = CATEGORY_ORDER.filter((c) => counts.has(c));
  const extra = [...counts.keys()].filter((c) => !CATEGORY_ORDER.includes(c) && c).sort((a, b) => a.localeCompare(b, "ko"));
  return [...known, ...extra].map((value) => ({ value, label: categoryLabel(value), count: counts.get(value) ?? 0 }));
}

// 공백으로 나눈 검색어가 모두 포함된 항목만 남긴다. 'ㄱㅌㄷ' 같은 초성 검색어는 이름과 메뉴의 초성에서 찾는다.
export function matchesQuery(place: PlaceView, query: string) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => (isChoseongQuery(token) ? place.choseong.includes(token) : place.haystack.includes(token)));
}

const byName = (a: PlaceView, b: PlaceView) => a.name.localeCompare(b.name, "ko");

export function sortPlaces(places: PlaceView[], key: SortKey) {
  const sorted = [...places];
  if (key === "name") return sorted.sort(byName);
  if (key === "checked") {
    // 날짜가 없거나 해석할 수 없는 항목은 맨 뒤로 보낸다.
    return sorted.sort((a, b) => {
      if (a.checkedSort && b.checkedSort) {
        return b.checkedSort.localeCompare(a.checkedSort) || b.recommendations - a.recommendations || byName(a, b);
      }
      if (a.checkedSort) return -1;
      if (b.checkedSort) return 1;
      return b.recommendations - a.recommendations || byName(a, b);
    });
  }
  return sorted.sort((a, b) => b.recommendations - a.recommendations || byName(a, b));
}

// listIds: 선택한 내 목록(즐겨찾기·컬렉션)에 담긴 장소 ID. 목록을 고르지 않았으면 null.
export function filterPlaces(places: PlaceView[], filters: Filters, listIds: Set<string> | null, now: Date) {
  const filtered = places.filter(
    (place) =>
      (!filters.category || place.category === filters.category) &&
      (!listIds || listIds.has(place.id)) &&
      (!filters.campus || place.campus === filters.campus) &&
      (!filters.price || place.priceBand === filters.price) &&
      (!filters.openNow || openStatus(place.schedule, now) === "open") &&
      matchesQuery(place, filters.query),
  );
  return sortPlaces(filtered, filters.sort);
}
