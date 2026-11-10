// 팀원 데이터(data/teams/*.json)를 우리 장소에 연결하는 순수 함수 모음. (scripts/convert-data.mjs 와 tests/unit 에서 사용)
// - 교통여지도(gyotong): 구역, 별점, 혼밥, 휴무일, 거리, 네이버 리뷰 키워드, 정리된 설명, 좌표
// - knut 가이드: 중국어 번역, 유학생 팁
// - ut 꿀팁 지도: 캠퍼스 지도 좌표(x/y, 건물 코드)
// 팀원 값은 원본 XLSX 를 덮어쓰지 않고 별도 필드로만 붙인다.

// ---------- 이름 매칭 ----------
const PUNCT = /[\s·.,'"!?~\-_/:;&+()[\]{}<>「」『』“”‘’]/g;
// 지점 표기('충주교통대점', '교통대점', '호암점' 등)는 같은 가게를 다르게 적은 경우가 많아 두 번째 키에서 뗀다.
const BRANCH = /(충주)?(한국)?(교통대(학교)?|호암|연수|칠금|중앙탑)?(본)?점$/;

export function normName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\(.*?\)/g, "")
    .replace(PUNCT, "")
    .toLowerCase();
}

// '한국교통대학교 충주캠퍼스대원생활관'처럼 학교 이름이 붙은 교내 시설 이름.
const SCHOOL_PREFIX = /^(국립)?한국교통대학교(충주캠퍼스)?/;

// 비교에 쓸 키: 정규화한 이름, 지점 표기를 뗀 이름, 학교 이름을 뗀 이름 (뗀 결과가 3글자 이상일 때만).
// 주소는 같은 건물의 다른 가게를 잘못 잇는 경우가 많아 쓰지 않고, 예외는 별칭 파일로 연결한다.
export function nameKeys(value) {
  const base = normName(value);
  const keys = base ? [base] : [];
  for (const stripped of [base.replace(BRANCH, ""), base.replace(SCHOOL_PREFIX, "")]) {
    if (stripped !== base && stripped.length >= 3 && !keys.includes(stripped)) keys.push(stripped);
  }
  return keys;
}

const CAMPUS_ADDRESS = /대학로\s*50(?!\d)/;

// entries 중 우리 장소와 같은 것을 찾는 함수를 만든다.
// - names(entry): 그 항목의 이름들(별칭 포함)
// - aliases: { "팀원 이름": "우리 원본 이름" } (data/team-aliases.json)
export function createMatcher(entries, { names, aliases = {} }) {
  const byKey = new Map();
  const forced = new Map();
  for (const entry of entries) {
    for (const n of names(entry)) {
      for (const key of nameKeys(n)) if (!byKey.has(key)) byKey.set(key, entry);
      const target = aliases[n];
      if (target) forced.set(normName(target), entry);
    }
  }
  const used = new Set();

  // ourNames: 우리 원본 이름과 정리한 이름
  function match(ourNames) {
    let hit = null;
    for (const n of ourNames) hit ??= forced.get(normName(n)) ?? null;
    for (const n of ourNames) for (const key of nameKeys(n)) hit ??= byKey.get(key) ?? null;
    // 한 팀원 항목은 우리 장소 하나에만 붙인다.
    if (!hit || used.has(hit)) return null;
    used.add(hit);
    return hit;
  }

  const unmatched = () => entries.filter((e) => !used.has(e));
  return { match, unmatched };
}

// ---------- 교통여지도 ----------
// 상세 설명 문장에 들어 있는 네이버 리뷰 키워드와 건수를 꺼낸다.
//   '"가성비가 좋아요"(70건)', '"혼밥하기 좋아요" 키워드가 500건이 넘으며'
const KEYWORD_COUNT = /["“]([^"”]{2,30})["”]\s*\(\s*(\d[\d,]*)\s*건\s*\)/g;
const KEYWORD_OVER = /["“]([^"”]{2,30})["”]\s*키워드가\s*(\d[\d,]*)\s*건이?\s*(넘|이상)/g;

export function extractReviewKeywords(detail) {
  const found = [];
  const add = (label, raw, over) => {
    const count = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(count) || found.some((k) => k.label === label)) return;
    found.push(over ? { label, count, over: true } : { label, count });
  };
  for (const m of String(detail ?? "").matchAll(KEYWORD_COUNT)) add(m[1].trim(), m[2], false);
  for (const m of String(detail ?? "").matchAll(KEYWORD_OVER)) add(m[1].trim(), m[2], true);
  return found.sort((a, b) => b.count - a.count);
}

const SOLO = { 좋음: "good", 보통: "ok", "혼밥이 힘듦": "hard" };
const ZONE = { "교통대 앞": "front", "충주 시내": "city", "충주 교외 맛집": "suburb" };

const clean = (v) => (v == null || v === "확인 필요" || v === "확인 안 됨" ? "" : String(v).trim());

export function gyotongFields(g) {
  const fields = {};
  if (ZONE[g.zone]) fields.zone = ZONE[g.zone];
  if (Number.isFinite(g.rating)) fields.baseRating = g.rating;
  if (SOLO[g.soloDining]) fields.solo = SOLO[g.soloDining];
  if (clean(g.closedDays)) fields.closedDays = clean(g.closedDays);
  if (Number.isFinite(g.distanceKm)) fields.distanceKm = g.distanceKm;
  const keywords = extractReviewKeywords(g.detail);
  if (keywords.length) fields.reviewKeywords = keywords;
  if (clean(g.summary) || clean(g.detail)) fields.review = { summary: clean(g.summary), detail: clean(g.detail) };
  return fields;
}

// 교통여지도 좌표: 학교 대표 주소로 바뀐 좌표는 쓰지 않는다.
export function gyotongCoordinate(g) {
  if (CAMPUS_ADDRESS.test(String(g.address ?? ""))) return null;
  if (!Number.isFinite(g.lat) || !Number.isFinite(g.lng)) return null;
  return { lat: Math.round(g.lat * 1e7) / 1e7, lng: Math.round(g.lng * 1e7) / 1e7 };
}

// ---------- knut (중국어) ----------
const NA_ZH = new Set(["", "未确认", "확인 안 됨"]);
const zhText = (v) => (NA_ZH.has(String(v ?? "").trim()) ? "" : String(v).trim());

export function knutFields(k) {
  const zh = {
    name: zhText(k.name_zh),
    location: zhText(k.address_zh),
    menu: zhText(k.menu_zh),
    hours: zhText(k.hours_zh),
    note: zhText(k.note_zh).replace(/^【留学生亲测】\s*/, ""),
  };
  const fields = {};
  if (zh.name) fields.zh = Object.fromEntries(Object.entries(zh).filter(([, v]) => v));
  if (k.intlPick && (k.intlTipKo || k.intlTipZh)) fields.intl = { ko: String(k.intlTipKo ?? ""), zh: String(k.intlTipZh ?? "") };
  return fields;
}

// knut 유학생 생활 꿀팁 5개를 우리 장소 형식으로 바꾼다. (id 는 호출하는 쪽에서 붙인다)
export function knutTipPlace(tip) {
  return {
    name: tip.title_ko,
    category: "유학생",
    location: tip.loc_ko,
    hours: tip.hours_ko,
    price: tip.price_ko,
    summary: tip.badge_ko,
    details: tip.desc_ko,
    mapUrl: tip.map,
    zh: { name: tip.title_zh, location: tip.loc_zh, hours: tip.hours_zh, price: tip.price_zh, summary: tip.badge_zh, note: tip.desc_zh },
  };
}

// ---------- ut 캠퍼스 지도 ----------
// tools/build.py 와 같은 등장방형 투영. 단위는 m, 원점은 OSM 범위의 왼쪽 위(y 는 아래로).
export const CAMPUS_BOUNDS = { minLat: 36.9585, maxLat: 36.9765, minLng: 127.8635, maxLng: 127.88 };
const MX = 111320 * Math.cos((((CAMPUS_BOUNDS.minLat + CAMPUS_BOUNDS.maxLat) / 2) * Math.PI) / 180);
const MY = 110540;
export const CAMPUS_SIZE = {
  w: Math.round((CAMPUS_BOUNDS.maxLng - CAMPUS_BOUNDS.minLng) * MX),
  h: Math.round((CAMPUS_BOUNDS.maxLat - CAMPUS_BOUNDS.minLat) * MY),
};

export function toCampusXY(lat, lng) {
  const x = (lng - CAMPUS_BOUNDS.minLng) * MX;
  const y = (CAMPUS_BOUNDS.maxLat - lat) * MY;
  if (x < 0 || y < 0 || x > CAMPUS_SIZE.w || y > CAMPUS_SIZE.h) return null;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// 건물 코드가 있으면 건물 위치(가장 정확), 없으면 우리 좌표를 투영, 그것도 없으면 ut 가 주소로 추정한 위치.
export function campusPosition(ut, coord) {
  if (ut?.b && Number.isFinite(ut.x)) return { x: ut.x, y: ut.y, building: ut.b };
  const projected = coord ? toCampusXY(coord.lat, coord.lng) : null;
  if (projected) return projected;
  if (ut && Number.isFinite(ut.x)) return { x: ut.x, y: ut.y, approx: true };
  return null;
}
