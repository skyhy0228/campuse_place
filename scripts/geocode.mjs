// 장소의 '위치'(주소)를 카카오 로컬 API로 좌표로 변환해 data/place-coordinates.json 에 저장한다.
// 사용법: npm run geocode            (이미 변환된 항목은 건너뜀)
//         npm run geocode -- --force (전체를 다시 변환)
// 이후 npm run data 로 places.json 에 반영한다.
// - 주소가 아닌 값(건물 이름·층수만 있는 경우 등)은 추측하지 않고 변환 대상에서 제외한다.
// - KAKAO_REST_KEY 는 이 스크립트에서만 쓰고 사이트에는 포함되지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { loadEnv } from "./load-env.mjs";

loadEnv();

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsxPath = path.join(root, "data", "recommendations_normalized.xlsx");
const coordsPath = path.join(root, "data", "place-coordinates.json");
const unresolvedPath = path.join(root, "data", "place-coordinates-unresolved.json");
const force = process.argv.includes("--force");

const KEY = process.env.KAKAO_REST_KEY;
if (!KEY) {
  console.error("KAKAO_REST_KEY 가 없습니다. .env.local 에 설정하세요.");
  process.exit(1);
}

const REGION = /(충북|충청북도|충주|충남|서울|경기|강원|경북|경남|전북|전남|대구|부산|인천|대전|광주|울산|세종)/;
const ROAD = /^(.*?(?:로|길)\s?\d+(?:-\d+)?)(?!\d)/;
const JIBUN = /^(.*?[동리가읍면]\s?\d+(?:-\d+)?)(?!\d)/;

// '주소 | 설명 | 설명' 형태에서 주소처럼 보이는 조각만 골라 검색어 후보를 만든다.
function queryCandidates(location) {
  const out = [];
  for (const segment of location.split(/\s*\|\s*/)) {
    const text = segment.trim();
    if (!REGION.test(text)) continue;
    const road = text.match(ROAD)?.[1];
    const jibun = text.match(JIBUN)?.[1];
    for (const q of [road, jibun, text]) if (q && !out.includes(q)) out.push(q);
  }
  return out;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchAddress(query) {
  const url = `https://dapi.kakao.com/v2/local/search/address.json?size=1&query=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`카카오 API 오류 ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const doc = data.documents?.[0];
  if (!doc) return null;
  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, matched: doc.address_name ?? "" };
}

async function main() {
  const workbook = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["정규화데이터"], { defval: "", raw: false });
  const existing = !force && fs.existsSync(coordsPath) ? JSON.parse(fs.readFileSync(coordsPath, "utf8")) : {};

  const coords = { ...existing };
  const unresolved = [];
  let requested = 0;
  let skippedNoAddress = 0;

  for (const row of rows) {
    const name = String(row["이름"] ?? "").trim().normalize("NFC");
    const location = String(row["위치"] ?? "").trim();
    if (!name || !location || location === "없음") continue;
    if (coords[name]) continue;

    const candidates = queryCandidates(location);
    if (!candidates.length) {
      skippedNoAddress += 1;
      unresolved.push({ name, location, reason: "주소 형식이 아니어서 변환하지 않음" });
      continue;
    }

    let found = null;
    let usedQuery = "";
    for (const query of candidates) {
      requested += 1;
      found = await searchAddress(query);
      await sleep(80);
      if (found) {
        usedQuery = query;
        break;
      }
    }
    if (found) coords[name] = { lat: found.lat, lng: found.lng, query: usedQuery, matched: found.matched };
    else unresolved.push({ name, location, reason: "카카오 주소 검색 결과 없음", tried: candidates });
  }

  const sorted = Object.fromEntries(Object.entries(coords).sort(([a], [b]) => a.localeCompare(b, "ko")));
  fs.writeFileSync(coordsPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  fs.writeFileSync(unresolvedPath, JSON.stringify(unresolved, null, 2) + "\n", "utf8");

  const withAddress = rows.filter((r) => String(r["위치"] ?? "").trim() && String(r["위치"]).trim() !== "없음").length;
  console.log(`위치가 있는 항목: ${withAddress}`);
  console.log(`좌표 변환 성공(누적): ${Object.keys(sorted).length}`);
  console.log(`변환하지 못한 항목: ${unresolved.length} (주소 형식 아님 ${skippedNoAddress})`);
  console.log(`이번 API 호출: ${requested}회`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
