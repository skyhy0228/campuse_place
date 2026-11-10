import type { Filters, Place, PlacesFile, SortKey } from "../types";
import { toChoseong, isChoseongQuery } from "./choseong";
import { openStatus } from "./hours";
import { DICTS, type Lang } from "./i18n";

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
  const food = place.foodType ? [DICTS.ko.foodNames[place.foodType], DICTS.zh.foodNames[place.foodType]] : [];
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
    // 한국어·중국어 어느 쪽으로 검색해도 찾을 수 있게 번역과 팀원 정리 문구도 넣는다.
    haystack: normalizeText(
      [
        place.name,
        place.location,
        ...place.locationNotes,
        place.category,
        label,
        DICTS.zh.categoryNames[place.category] ?? "",
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

// ---------- 표시 (언어별) ----------
// knut 번역의 이름은 '中文名 (한국어)' 형식이라, 중국어 화면에서는 괄호 속 한국어를 떼고 따로 보여준다.
const KOREAN_SUFFIX = /\s*\([^)]*[가-힣][^)]*\)\s*$/;

export interface PlaceText {
  name: string;
  // 중국어 화면에서 함께 보여 줄 한국어 원래 이름
  nameKo: string;
  translated: boolean;
  category: string;
  location: string;
  menu: string[];
  hours: string[];
  price: string[];
  summary: string;
  note: string;
  food: string;
}

export function placeText(place: PlaceView, lang: Lang): PlaceText {
  const t = DICTS[lang];
  const zh = lang === "zh" ? place.zh : undefined;
  const zhName = zh?.name?.replace(KOREAN_SUFFIX, "").trim();
  return {
    name: zhName || place.name,
    nameKo: zhName ? place.name : "",
    translated: lang === "ko" || Boolean(zhName),
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

export function sortPlaces(places: PlaceView[], key: SortKey) {
  const sorted = [...places];
  if (key === "name") return sorted.sort(byName);
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

// listIds: 선택한 내 목록(즐겨찾기·컬렉션)에 담긴 장소 ID. 목록을 고르지 않았으면 null.
export function filterPlaces(places: PlaceView[], filters: Filters, listIds: Set<string> | null, now: Date) {
  const filtered = places.filter(
    (place) =>
      passesFilters(place, filters, listIds, now) &&
      (!filters.food || place.foodType === filters.food) &&
      matchesQuery(place, filters.query),
  );
  return sortPlaces(filtered, filters.sort);
}
