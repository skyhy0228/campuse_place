import type { Filters, Place, PlacesFile, SortKey } from "../types";
import { latLngFromCampusXY } from "./campus";
import { toChoseong, isChoseongQuery } from "./choseong";
import { isStaleDate, latestDate } from "./dates";
import { openStatus } from "./hours";
import { DICTS, type Lang } from "./i18n";
import { compareDistance, distanceMeters, type LatLng } from "./nearby";
import { applyChanges, groupOverrides, type Override } from "./overrides";

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
  // 교통여지도 기본 별점에 회원 별점을 합친 값 (applyRatings)
  rating?: number;
  ratingCount: number;
  // 회원이 '아직 맞아요'로 확인한 마지막 날과 사람 수 (applyConfirms, 최근 1년)
  confirmedAt?: string;
  confirmCount: number;
}

const CATEGORY_LABELS: Record<string, string> = DICTS.ko.categoryNames;
const CATEGORY_ORDER = ["식당", "카페", "학교시설", "숨은장소", "생활꿀팁", "유학생", "관광지", "자유", "제보"];
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
  const food = place.foodType ? [DICTS.ko.foodNames[place.foodType], DICTS.zh.foodNames[place.foodType], DICTS.en.foodNames[place.foodType]] : [];
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
    // 한국어·중국어·영어 어느 쪽으로 검색해도 찾을 수 있게 번역과 팀원 정리 문구도 넣는다.
    haystack: normalizeText(
      [
        place.name,
        place.location,
        ...place.locationNotes,
        place.category,
        label,
        DICTS.zh.categoryNames[place.category] ?? "",
        DICTS.en.categoryNames[place.category] ?? "",
        place.menu,
        place.summary,
        place.details,
        ...food,
        place.review?.summary ?? "",
        ...(place.reviewKeywords ?? []).map((k) => k.label),
        ...Object.values(place.zh ?? {}),
        place.intl?.ko ?? "",
        place.intl?.zh ?? "",
      ].join("\n"),
    ),
    choseong: toChoseong([place.name, place.menu].join(" ")),
    rating: place.baseRating,
    ratingCount: 0,
    confirmCount: 0,
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

// ---------- 별점 ----------
// 교통여지도와 같은 규칙: 기본 별점을 한 표로 치고, 평가한 사람이 3명 미만이면 기본 별점을 그대로 쓴다.
export const MIN_RATERS = 3;

export function blendRating(base: number | undefined, count: number, total: number): number | undefined {
  const raters = count + (base ? 1 : 0);
  if (raters < MIN_RATERS) return base;
  return Math.round(((total + (base ?? 0)) / raters) * 10) / 10;
}

export type RatingStats = Map<string, { count: number; total: number }>;

export function applyRatings(places: PlaceView[], stats: RatingStats): PlaceView[] {
  if (!stats.size) return places;
  return places.map((place) => {
    const s = stats.get(place.id);
    if (!s) return place;
    return { ...place, rating: blendRating(place.baseRating, s.count, s.total), ratingCount: s.count };
  });
}

// ---------- 운영자가 승인한 정보 수정 ----------
export function applyOverrides(places: PlaceView[], rows: Override[]): PlaceView[] {
  if (!rows.length) return places;
  const grouped = groupOverrides(rows);
  return places.map((place) => {
    const list = grouped.get(place.id);
    if (!list) return place;
    const changed = list.reduce<Place>((current, item) => applyChanges(current, item.changes, item.reviewedAt), place);
    // 파생 값(메뉴 목록, 검색어 등)을 다시 만든다. '최근 확인' 표시는 원래 값을 그대로 쓴다.
    return { ...toView(changed, "9999"), isRecent: place.isRecent };
  });
}

// ---------- '아직 맞아요' 확인 ----------
export type ConfirmStats = Map<string, { count: number; last: string }>;

export function applyConfirms(places: PlaceView[], stats: ConfirmStats): PlaceView[] {
  if (!stats.size) return places;
  return places.map((place) => {
    const s = stats.get(place.id);
    return s ? { ...place, confirmedAt: s.last, confirmCount: s.count } : place;
  });
}

// 원본의 확인한날과 회원이 확인한 날 중 늦은 쪽을 기준으로 오래됐는지 본다.
export const lastChecked = (place: PlaceView) => latestDate(place.checkedSort, place.confirmedAt);
export const isPlaceStale = (place: PlaceView, now: Date) => isStaleDate(lastChecked(place), now);

// ---------- 거리 ----------
// 주소 좌표가 있으면 그것을, 없으면 캠퍼스 지도 위치(건물)를 위도·경도로 바꿔 쓴다.
export function placeLatLng(place: Place): LatLng | null {
  if (typeof place.lat === "number" && typeof place.lng === "number") return { lat: place.lat, lng: place.lng };
  if (place.campusXY) return latLngFromCampusXY(place.campusXY.x, place.campusXY.y);
  return null;
}

export function distancesFrom(places: PlaceView[], origin: LatLng): Map<string, number> {
  const map = new Map<string, number>();
  for (const place of places) {
    const at = placeLatLng(place);
    if (at) map.set(place.id, distanceMeters(origin, at));
  }
  return map;
}

// ---------- 표시 (언어별) ----------
// knut 번역의 이름은 '中文名 (한국어)' 형식이라, 중국어 화면에서는 괄호 속 한국어를 떼고 따로 보여준다.
const KOREAN_SUFFIX = /\s*\([^)]*[가-힣][^)]*\)\s*$/;

export interface PlaceText {
  name: string;
  // 중국어 화면에서 함께 보여 줄 한국어 원래 이름
  nameKo: string;
  translated: boolean;
  // 화면 언어와 달리 한국어 원문을 보여줄 때 'ko' (화면 읽기 프로그램이 한국어로 읽게 lang 속성에 쓴다)
  srcLang: "ko" | undefined;
  category: string;
  location: string;
  menu: string[];
  hours: string[];
  price: string[];
  summary: string;
  note: string;
  food: string;
}

// 영어 화면은 화면 문구·분류·음식 종류만 번역하고, 장소 이름과 설명은 한국어 원문을 보여준다. (영어 데이터가 없다)
export function placeText(place: PlaceView, lang: Lang): PlaceText {
  const t = DICTS[lang];
  const zh = lang === "zh" ? place.zh : undefined;
  const zhName = zh?.name?.replace(KOREAN_SUFFIX, "").trim();
  return {
    name: zhName || place.name,
    nameKo: zhName ? place.name : "",
    translated: lang === "ko" || Boolean(zhName),
    srcLang: lang !== "ko" && !zhName ? "ko" : undefined,
    category: t.categoryNames[place.category] ?? place.categoryLabel,
    location: zh?.location || place.location,
    menu: zh?.menu ? splitBy(zh.menu, /\s*[,，、|]\s*/) : place.menuItems,
    hours: zh?.hours ? [zh.hours] : place.hoursItems,
    price: zh?.price ? [zh.price] : place.priceItems,
    // 중국어 화면에서는 knut 가 중국어로 다시 쓴 비고(note_zh)를 한줄설명으로 먼저 쓴다.
    summary: zh?.summary || zh?.note || place.summary,
    note: zh?.note ?? "",
    food: place.foodType ? (t.foodNames[place.foodType] ?? "") : "",
  };
}

// ---------- 분류·검색·정렬 ----------
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

// distances: 가까운 순(near)일 때 장소 ID → 거리(m). 위치를 모르는 항목은 맨 뒤로 보낸다.
export function sortPlaces(places: PlaceView[], key: SortKey, distances?: Map<string, number> | null) {
  const sorted = [...places];
  if (key === "name") return sorted.sort(byName);
  if (key === "near") {
    return sorted.sort(
      (a, b) => compareDistance(distances?.get(a.id), distances?.get(b.id)) || b.recommendations - a.recommendations || byName(a, b),
    );
  }
  if (key === "rating") {
    // 별점이 없는 항목은 맨 뒤로 보낸다.
    return sorted.sort(
      (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || b.recommendations - a.recommendations || byName(a, b),
    );
  }
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

export const isIntl = (place: PlaceView) => Boolean(place.intl) || place.category === "유학생";

// 분류·검색어 이외의 조건. 음식 칩의 개수를 셀 때도 쓴다.
export function passesFilters(place: PlaceView, filters: Filters, listIds: Set<string> | null, now: Date) {
  return (
    (!filters.category || place.category === filters.category) &&
    (!listIds || listIds.has(place.id)) &&
    (!filters.campus || place.campus === filters.campus) &&
    (!filters.price || place.priceBand === filters.price) &&
    (!filters.zone || place.zone === filters.zone) &&
    (!filters.intl || isIntl(place)) &&
    (!filters.openNow || openStatus(place.schedule, now) === "open")
  );
}

// listIds: 선택한 내 목록(즐겨찾기·컬렉션·공유받은 목록)에 담긴 장소 ID. 목록을 고르지 않았으면 null.
export function filterPlaces(places: PlaceView[], filters: Filters, listIds: Set<string> | null, now: Date, distances?: Map<string, number> | null) {
  const filtered = places.filter(
    (place) =>
      passesFilters(place, filters, listIds, now) &&
      (!filters.food || place.foodType === filters.food) &&
      matchesQuery(place, filters.query),
  );
  return sortPlaces(filtered, filters.sort, distances);
}
