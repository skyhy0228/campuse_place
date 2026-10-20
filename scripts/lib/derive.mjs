// XLSX 원본 값을 사이트용으로 정리하는 순수 함수 모음. (scripts/convert-data.mjs 와 tests/unit 에서 사용)
// 원칙: 원본에 있는 정보만 다듬는다. 새로운 사실(운영시간, 가격, 주소 등)을 만들지 않는다.

const pad = (n) => String(n).padStart(2, "0");

export const EMPTY_MARKERS = new Set(["없음", "null", "undefined", "nan", "n/a", "-"]);

export function text(value) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return EMPTY_MARKERS.has(s.toLowerCase()) ? "" : s;
}

export function longText(value) {
  const s = String(value ?? "").replace(/[ \t]+/g, " ").trim();
  return EMPTY_MARKERS.has(s.toLowerCase()) ? "" : s;
}

// ---------- 이름 ----------
// '3_생활꿀팁_동아리 신청' 처럼 폴더명이 앞에 붙은 이름에서 폴더명을 제거한다.
export function cleanName(name) {
  const hasFolderPrefix = /^\d+_[가-힣]+_\s*/.test(name);
  const stripped = name
    .replace(/^\d+_[가-힣]+_\s*/, "")
    // 폴더명을 뗀 뒤 남은 밑줄은 '제목 · 부제', 원래 이름의 밑줄은 공백으로 바꾼다.
    .replace(/_+/g, hasFolderPrefix ? " · " : " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || name;
}

// ---------- 한줄설명 ----------
const FILLER_SUMMARY = [
  /에 관한 (생활|참고|자유) 정보$/,
  /이용에 참고할 수 있는 장소 정보$/,
  /^식사 메뉴를 제공하는 (식당|카페)$/,
];

export const isFillerSummary = (summary) => !summary || FILLER_SUMMARY.some((re) => re.test(summary));

// 자동 생성된 문구는 쓰지 않고, 원본 자세한 설명의 첫 문단을 요약으로 대신한다. 없으면 비운다.
// 요약으로 쓰기에 부적절한 조각: 날짜만 있는 줄('확인날짜 2026-10-06'), 제목 표시('<영화관 팁>'), 너무 짧은 단어('중식').
const DATE_LINE = /^(확인\s*(한\s*)?(날짜|날)?\s*[:：]?\s*)?\d{2,4}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}\.?$/;
const TITLE_MARK = /^[<\[(].*[>\])]$/;
const MIN_SUMMARY_LENGTH = 5;

export function cleanSummary(summary, details, name) {
  if (!isFillerSummary(summary)) return summary;
  const first = details
    .split(/\s\/\s/)
    .map((part) => part.trim())
    .find(
      (part) =>
        part.length >= MIN_SUMMARY_LENGTH &&
        part !== name &&
        !DATE_LINE.test(part) &&
        !TITLE_MARK.test(part) &&
        !isFillerSummary(part),
    );
  return first ?? "";
}

// ---------- 대표메뉴 ----------
// 다른 항목에 완전히 포함되는 항목('플레이트' ⊂ '밍거스 플레이트')과 중복을 제거한다.
export function cleanMenu(menu) {
  const items = menu
    .split(/\s*\|\s*|,\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const key = (s) => s.replace(/\s+/g, "").toLowerCase();
  const unique = items.filter((item, i) => items.findIndex((other) => key(other) === key(item)) === i);
  return unique.filter((item) => !unique.some((other) => key(other) !== key(item) && key(other).includes(key(item)))).join(", ");
}

// ---------- 확인한날 ----------
function isRealDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// 완전한 날짜는 YYYY-MM-DD, 연월만 있으면 YYYY-MM(정렬은 해당 월 1일).
// 연도가 두 자리(26-10-06)이면 20xx 년으로 해석한다.
export function parseChecked(raw) {
  const value = text(raw);
  if (!value) return { display: "", sort: "" };
  const full = value.match(/^(\d{2}|\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (full) {
    let [y, m, d] = full.slice(1).map(Number);
    if (y < 100) y += 2000;
    if (isRealDate(y, m, d)) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      return { display: iso, sort: iso };
    }
  }
  const month = value.match(/^(\d{4})\s*-\s*(\d{1,2})$/);
  if (month) {
    const [y, m] = month.slice(1).map(Number);
    if (m >= 1 && m <= 12) return { display: `${y}-${pad(m)}`, sort: `${y}-${pad(m)}-01` };
  }
  return { display: value, sort: "" };
}

// ---------- 위치 ----------
// '주소 | 설명 | 설명' 을 주소(첫 조각)와 부가 설명으로 나눈다.
export function splitLocation(raw) {
  const parts = String(raw ?? "")
    .split(/\s*\|\s*/)
    .map((part) => text(part))
    .filter(Boolean);
  return { location: parts[0] ?? "", locationNotes: parts.slice(1) };
}

const CAMPUS_ADDRESS = /대학로\s?50(?!\d)/;
const CAMPUS_WORDS = /(교내|캠퍼스\s?내)/;
const CAMPUS_NEAR = /(인근|근처|앞|맞은편|건너)/;
const BUILDING_WORDS =
  /(종합강의[관동]|학생회관|대학본부|중앙도서관|도서관|복지관|휴스퀘어관|인문사회[관대]|건축관|건설환경관|스마트ICT관|ICT관|IT관|테크노관|경영항공관|체육관|국원생활관|대원생활관|증원생활관|예성생활관|국제청년협력센터|동아리관|\b[EW]\d{1,2}동?\b)/;
const HAS_ADDRESS = /(시|군)\s/;

// 교내/교외를 위치 문자열만으로 판단한다. 근거가 없으면 빈 값(분류 안 함).
export function classifyCampus(location, notes = []) {
  const whole = [location, ...notes].join(" ");
  if (!location) return "";
  if (CAMPUS_ADDRESS.test(location) || CAMPUS_WORDS.test(location)) return "in";
  if (/충주캠퍼스/.test(location) && !CAMPUS_NEAR.test(location)) return "in";
  if (HAS_ADDRESS.test(location)) return "out";
  if (BUILDING_WORDS.test(whole)) return "in";
  return "";
}

// ---------- 가격 ----------
// 표기된 가격 중 가장 낮은 금액으로 구간을 나눈다. 숫자가 없으면 '무료'만 따로 인식한다.
export function parsePrice(price) {
  const amounts = [...price.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (amounts.length) return { priceMin: Math.min(...amounts), free: false };
  if (/^무료$/.test(price.trim())) return { priceMin: 0, free: true };
  return { priceMin: null, free: false };
}

export function priceBand(priceMin, free) {
  if (priceMin === null) return "";
  if (free || priceMin === 0) return "free";
  if (priceMin < 10000) return "under10";
  if (priceMin < 20000) return "10to20";
  return "over20";
}

// ---------- 운영시간 ----------
// 요일(0=일 … 6=토)별 [열림분, 닫힘분, 쉬는시작분?, 쉬는끝분?] 또는 null(휴무).
// 요일과 시간을 모두 명확히 읽을 수 있을 때만 값을 만들고, 애매하면 null 을 돌려준다.
const DAY_INDEX = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const DAY_CHARS = "월화수목금토일";
const TIME = String.raw`(\d{1,2}):(\d{2})`;
const RANGE = new RegExp(String.raw`${TIME}\s*[~\-–]\s*${TIME}`, "g");

const minutes = (h, m) => Number(h) * 60 + Number(m);

function expandDays(spec) {
  const days = new Set();
  for (const token of spec.split(/[·,]/)) {
    const t = token.trim().replace(/요일$/, "");
    const range = t.match(/^([월화수목금토일])\s*~\s*([월화수목금토일])$/);
    if (range) {
      const a = DAY_CHARS.indexOf(range[1]);
      const b = DAY_CHARS.indexOf(range[2]);
      if (a > b) return null;
      for (let i = a; i <= b; i += 1) days.add(DAY_INDEX[DAY_CHARS[i]]);
    } else if (/^[월화수목금토일]$/.test(t)) {
      days.add(DAY_INDEX[t]);
    } else {
      return null;
    }
  }
  return days;
}

function parseSegment(segment) {
  if (/(영업\s*안\s*하는|불규칙|변동|시험기간|방학)/.test(segment)) return null;
  const ranges = [...segment.matchAll(RANGE)];
  if (!ranges.length) return null;

  const main = ranges[0];
  const open = minutes(main[1], main[2]);
  const close = minutes(main[3], main[4]);
  if (close <= open || close > 24 * 60) return null;

  // 브레이크타임: '브레이크타임 15:00~17:00', '14:30 - 16:30 브레이크타임' 두 형태를 읽는다.
  let brk = null;
  if (/브레이크/.test(segment)) {
    const after = segment.match(new RegExp(String.raw`브레이크\s*타임\s*${TIME}\s*[~\-–]\s*${TIME}`));
    const before = segment.match(new RegExp(String.raw`${TIME}\s*[~\-–]\s*${TIME}\s*브레이크`));
    const hit = after ?? before;
    if (!hit) return null;
    brk = [minutes(hit[1], hit[2]), minutes(hit[3], hit[4])];
    if (!(brk[0] > open && brk[1] <= close && brk[0] < brk[1])) return null;
  }

  // 영업 요일
  const head = segment.slice(0, main.index);
  const closedStatement = /[월화수목금토일](?:[·,][월화수목금토일])*\s*요일\s*(?:정기\s*)?휴무/.test(segment);
  let days;
  if (/매일|연중무휴/.test(segment) || (closedStatement && !/[월화수목금토일]\s*[~·]/.test(head))) {
    // '11:00~21:00, 일요일 정기휴무'처럼 휴무 요일만 적힌 경우 그 외 요일은 영업으로 읽는다.
    days = new Set([0, 1, 2, 3, 4, 5, 6]);
  } else {
    const spec = head.match(/([월화수목금토일](?:\s*[~·,]\s*[월화수목금토일])*)\s*(?:요일)?\s*$/);
    if (!spec) return null;
    days = expandDays(spec[1].replace(/\s+/g, ""));
    if (!days || days.size === 0) return null;
  }

  // 휴무 요일 ('일요일 정기휴무', '월·화요일 휴무')
  for (const m of segment.matchAll(/([월화수목금토일](?:[·,][월화수목금토일])*)\s*요일\s*(?:정기\s*)?휴무/g)) {
    const closed = expandDays(m[1]);
    if (!closed) return null;
    closed.forEach((d) => days.delete(d));
  }

  const entry = brk ? [open, close, brk[0], brk[1]] : [open, close];
  return Object.fromEntries([...days].map((d) => [d, entry]));
}

export function parseHours(hours) {
  const value = hours.trim();
  if (!value) return null;
  if (/확인\s*필요/.test(value)) return null;

  const week = Array(7).fill(null);
  if ((/^(매일\s*)?24시간/.test(value) || /매일\s*24시간/.test(value)) && !/(시험기간|응급|급하면)/.test(value)) {
    return week.map(() => [0, 24 * 60]);
  }

  // '월~목 09:00~21:00 / 금 09:00~18:00' 처럼 ' / '로 요일별 구간이 나뉜 경우
  // 시간이 없는 조각('온라인 후기 기준, 방문 전 확인 권장' 같은 안내문)은 건너뛴다.
  const segments = value.split(/\s\/\s/).filter((s) => /\d{1,2}:\d{2}/.test(s));
  if (!segments.length) return null;
  const parsed = segments.map(parseSegment);
  if (parsed.some((p) => p === null)) return null;
  for (const entries of parsed) {
    for (const [day, entry] of Object.entries(entries)) {
      if (week[day]) return null; // 같은 요일이 두 번 정의되면 해석하지 않는다.
      week[day] = entry;
    }
  }
  return week.some(Boolean) ? week : null;
}
