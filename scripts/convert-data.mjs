// XLSX(정규화데이터 시트) → public/data/places.json 변환
// 사용법: npm run data
// 원본 XLSX 는 수정하지 않는다. 정리 규칙은 scripts/lib/derive.mjs 에 있으며, 적용 결과는 변환 보고서로 출력한다.
// 원본에 없는 사실(운영시간, 가격, 주소 등)은 만들지 않는다. 공란과 '없음'은 빈 문자열로 둔다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  classifyCampus,
  cleanMenu,
  cleanName,
  cleanSummary,
  longText,
  parseChecked,
  parseHours,
  parsePrice,
  priceBand,
  splitLocation,
  text,
} from "./lib/derive.mjs";
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
  const allNames = new Set(rows.map((r) => text(r[COLUMNS.name])));

  const report = {
    renamed: [],
    summaryReplaced: 0,
    summaryCleared: 0,
    menuCleaned: 0,
    dateFixed: [],
    dateUnresolved: [],
    hoursParsed: 0,
    hoursUnparsed: [],
    pricesBanded: 0,
    campusIn: 0,
    campusOut: 0,
    campusUnknown: 0,
  };

  const places = [];
  const seenIds = new Set();
  const usedNames = new Set();
  let skippedNoName = 0;

  for (const row of rows) {
    const originalName = text(row[COLUMNS.name]);
    if (!originalName) {
      skippedNoName += 1;
      continue;
    }
    // ID와 이미지 연결은 원본 이름 기준이라, 표시 이름을 정리해도 즐겨찾기가 유지된다.
    const id = placeId(originalName);
    if (seenIds.has(id)) throw new Error(`중복 이름/ID: ${originalName}`);
    seenIds.add(id);

    let name = cleanName(originalName);
    if (name !== originalName) {
      // 정리한 이름이 다른 항목과 겹치면 원본 이름을 그대로 쓴다.
      if (allNames.has(name) || usedNames.has(name)) name = originalName;
      else report.renamed.push(`${originalName} → ${name}`);
    }
    usedNames.add(name);

    const details = longText(row[COLUMNS.details]);
    const rawSummary = text(row[COLUMNS.summary]);
    const summary = cleanSummary(rawSummary, details, originalName);
    if (summary !== rawSummary) {
      if (summary) report.summaryReplaced += 1;
      else report.summaryCleared += 1;
    }

    const rawMenu = text(row[COLUMNS.menu]);
    const menu = cleanMenu(rawMenu);
    if (menu !== rawMenu) report.menuCleaned += 1;

    const rawChecked = text(row[COLUMNS.checked]);
    const checked = parseChecked(rawChecked);
    if (rawChecked && checked.display !== rawChecked) report.dateFixed.push(`${rawChecked} → ${checked.display}`);
    if (rawChecked && !checked.sort) report.dateUnresolved.push(`${originalName}: ${rawChecked}`);

    const { location, locationNotes } = splitLocation(row[COLUMNS.location]);
    const campus = classifyCampus(location, locationNotes);
    if (campus === "in") report.campusIn += 1;
    else if (campus === "out") report.campusOut += 1;
    else report.campusUnknown += 1;

    const hours = text(row[COLUMNS.hours]);
    const schedule = parseHours(hours);
    if (hours) {
      if (schedule) report.hoursParsed += 1;
      else report.hoursUnparsed.push(`${originalName}: ${hours.slice(0, 60)}`);
    }

    const price = text(row[COLUMNS.price]);
    const { priceMin, free } = parsePrice(price);
    const band = priceBand(priceMin, free);
    if (band) report.pricesBanded += 1;

    places.push({
      id,
      name,
      category: text(row[COLUMNS.category]),
      location,
      locationNotes,
      campus,
      mapUrl: pickNaverMapUrl(row[COLUMNS.map]),
      hours,
      schedule,
      price,
      priceBand: band,
      menu,
      summary,
      details,
      recommendations: parseRecommendations(row[COLUMNS.recommendations]),
      checkedAt: checked.display,
      checkedSort: checked.sort,
      images: imageMap[originalName.normalize("NFC")] ?? [],
    });
  }

  if (places.length + skippedNoName !== rows.length) throw new Error("행 수 검증 실패");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ count: places.length, places }) + "\n", "utf8");

  console.log(`XLSX 행 수: ${rows.length}`);
  console.log(`JSON 장소 수: ${places.length} (이름 없어 제외: ${skippedNoName})`);
  console.log(`추천수 합계: ${places.reduce((s, p) => s + p.recommendations, 0)}`);
  console.log(`지도 링크 보유: ${places.filter((p) => p.mapUrl).length}, 이미지 연결: ${places.filter((p) => p.images.length).length}`);
  console.log("--- 정리 보고 ---");
  console.log(`이름 정리: ${report.renamed.length}건 ${report.renamed.map((r) => `[${r}]`).join(" ")}`);
  console.log(`자동 문구 한줄설명 → 상세 첫 문단으로 대체 ${report.summaryReplaced}건, 비움 ${report.summaryCleared}건`);
  console.log(`대표메뉴 중복 정리: ${report.menuCleaned}건`);
  console.log(`확인한날 보정: ${report.dateFixed.length}건, 해석 불가: ${report.dateUnresolved.length}건`);
  console.log(`교내 ${report.campusIn} / 교외 ${report.campusOut} / 구분 불가 ${report.campusUnknown}`);
  console.log(`운영시간 해석: ${report.hoursParsed}곳 (해석 못 한 ${report.hoursUnparsed.length}곳은 '영업 중' 필터에서 제외)`);
  console.log(`가격 구간 분류: ${report.pricesBanded}곳`);
  if (process.argv.includes("--verbose")) {
    console.log("\n해석하지 못한 운영시간:\n" + report.hoursUnparsed.join("\n"));
    console.log("\n해석하지 못한 날짜:\n" + report.dateUnresolved.join("\n"));
  }
}

main();
