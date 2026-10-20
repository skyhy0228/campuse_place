// XLSX(정규화데이터 시트) → public/data/places.json 변환
// 사용법: npm run data
// 원본에 없는 값은 만들지 않는다. 공란과 '없음'은 빈 문자열로 둔다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { placeId } from "./place-id.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsxPath = path.join(root, "data", "recommendations_normalized.xlsx");
const imageMapPath = path.join(root, "data", "place-images.json");
const outDir = path.join(root, "public", "data");
const outPath = path.join(outDir, "places.json");
const SHEET = "정규화데이터";

const COLUMNS = {
  name: "이름",
  location: "위치",
  map: "지도",
  category: "분류",
  checked: "확인한날",
  hours: "운영시간",
  price: "가격대",
  menu: "대표메뉴",
  summary: "한줄설명",
  details: "자세한 설명",
  recommendations: "추천수",
};

const EMPTY_MARKERS = new Set(["없음", "null", "undefined", "nan", "n/a", "-"]);

function text(value) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return EMPTY_MARKERS.has(s.toLowerCase()) ? "" : s;
}

// 자세한 설명은 ' / ' 구분자를 쓰므로 줄바꿈만 보존하고 공백은 그대로 둔다.
function longText(value) {
  const s = String(value ?? "").replace(/[ \t]+/g, " ").trim();
  return EMPTY_MARKERS.has(s.toLowerCase()) ? "" : s;
}

const pad = (n) => String(n).padStart(2, "0");

function isRealDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// 완전한 날짜는 YYYY-MM-DD, 연월만 있으면 YYYY-MM으로 표시하고 정렬에는 해당 월 1일을 쓴다.
// 연도가 두 자리인 값 등 해석이 불확실한 값은 원본을 그대로 보여주고 정렬에서는 뒤로 보낸다.
function parseChecked(raw) {
  const value = text(raw);
  if (!value) return { display: "", sort: "" };
  const full = value.match(/^(\d{4})\s*-\s*(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (full) {
    const [y, m, d] = full.slice(1).map(Number);
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

// 여러 링크가 ' | '로 합쳐져 있거나 끝에 불필요한 문자가 붙은 경우를 정리한다.
// naver.me 단축 링크를 우선하고, 없으면 map.naver.com 링크를 쓴다.
function pickNaverMapUrl(raw) {
  const candidates = [];
  for (const part of String(raw ?? "").split(/\s*\|\s*|\s+/)) {
    const shortLink = part.match(/^https:\/\/naver\.me\/[A-Za-z0-9]+/);
    const mapLink = part.match(/^https:\/\/map\.naver\.com\/[^\s|\\()]+/);
    const hit = shortLink?.[0] ?? mapLink?.[0];
    if (!hit) continue;
    try {
      const url = new URL(hit);
      if (url.protocol === "https:" && (url.hostname === "naver.me" || url.hostname === "map.naver.com")) {
        candidates.push(url.href);
      }
    } catch {
      // 해석할 수 없는 링크는 버린다.
    }
  }
  return candidates.find((u) => u.startsWith("https://naver.me/")) ?? candidates[0] ?? "";
}

function parseRecommendations(raw) {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function main() {
  if (!fs.existsSync(xlsxPath)) throw new Error(`XLSX 파일이 없습니다: ${xlsxPath}`);
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[SHEET];
  if (!sheet) throw new Error(`'${SHEET}' 시트가 없습니다. 시트: ${workbook.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const header = Object.keys(rows[0] ?? {});
  const missingColumns = Object.values(COLUMNS).filter((c) => !header.includes(c));
  if (missingColumns.length) throw new Error(`누락된 컬럼: ${missingColumns.join(", ")}`);

  const imageMap = fs.existsSync(imageMapPath) ? JSON.parse(fs.readFileSync(imageMapPath, "utf8")) : {};

  const places = [];
  const seen = new Set();
  let skippedNoName = 0;
  for (const row of rows) {
    const name = text(row[COLUMNS.name]);
    if (!name) {
      skippedNoName += 1;
      continue;
    }
    const id = placeId(name);
    if (seen.has(id)) throw new Error(`중복 이름/ID: ${name}`);
    seen.add(id);

    const checked = parseChecked(row[COLUMNS.checked]);
    places.push({
      id,
      name,
      category: text(row[COLUMNS.category]),
      location: text(row[COLUMNS.location]),
      mapUrl: pickNaverMapUrl(row[COLUMNS.map]),
      hours: text(row[COLUMNS.hours]),
      price: text(row[COLUMNS.price]),
      menu: text(row[COLUMNS.menu]),
      summary: text(row[COLUMNS.summary]),
      details: longText(row[COLUMNS.details]),
      recommendations: parseRecommendations(row[COLUMNS.recommendations]),
      checkedAt: checked.display,
      checkedSort: checked.sort,
      images: imageMap[name.normalize("NFC")] ?? [],
    });
  }

  if (places.length + skippedNoName !== rows.length) throw new Error("행 수 검증 실패");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ count: places.length, places }, null, 2) + "\n", "utf8");

  const withImages = places.filter((p) => p.images.length).length;
  const withMap = places.filter((p) => p.mapUrl).length;
  console.log(`XLSX 행 수: ${rows.length}`);
  console.log(`JSON 장소 수: ${places.length} (이름 없어 제외: ${skippedNoName})`);
  console.log(`추천수 합계: ${places.reduce((s, p) => s + p.recommendations, 0)}`);
  console.log(`지도 링크 보유: ${withMap}, 이미지 연결: ${withImages}`);
  console.log(`출력: ${path.relative(root, outPath)}`);
}

main();
