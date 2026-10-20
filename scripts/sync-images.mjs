// 원본 프로젝트의 사진을 장소와 연결해 public/images/places 로 복사(리사이즈)한다.
// 사용법: npm run images [-- <이미지 폴더> ...]   이후 npm run data 로 places.json 에 반영
// - 파일명이 '<장소 이름>_<번호>.<확장자>' 이고 이름이 XLSX의 장소 이름과 정확히 일치할 때만 연결한다.
// - 장소당 최대 2장. 원본 파일은 수정하지 않는다.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import XLSX from "xlsx";
import { placeId } from "./place-id.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsxPath = path.join(root, "data", "recommendations_normalized.xlsx");
const imageMapPath = path.join(root, "data", "place-images.json");
const outDir = path.join(root, "public", "images", "places");

const DRAFT = String.raw`F:\vibecoding\campus-place-recommender-draft`;
const defaultSources = [
  path.join(DRAFT, "1_맛집"),
  path.join(DRAFT, "추천 데이터", "_normalization_work", "extracted"),
];
const sources = process.argv.slice(2).length ? process.argv.slice(2) : defaultSources;

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const MAX_PER_PLACE = 2;
const MAX_WIDTH = 960;

// 공백, 구두점, 대소문자 차이만 무시하고 이름을 비교한다.
const nameKey = (s) => s.normalize("NFC").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// '달천러닝코스_1.jpg.png' 처럼 확장자가 겹친 파일도 처리한다.
function parseImageName(file) {
  let stem = path.basename(file).normalize("NFC");
  if (!IMAGE_EXT.test(stem)) return null;
  while (IMAGE_EXT.test(stem)) stem = stem.replace(IMAGE_EXT, "");
  const m = stem.match(/^(.+)_(\d)$/);
  return m ? { name: m[1], index: Number(m[2]) } : null;
}

async function main() {
  const workbook = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["정규화데이터"], { defval: "", raw: false });
  const placeByKey = new Map();
  for (const row of rows) {
    const name = String(row["이름"] ?? "").trim().normalize("NFC");
    if (name) placeByKey.set(nameKey(name), name);
  }

  const candidates = new Map(); // 장소 이름 → [{ file, index, order, hash }]
  const unmatched = new Set();
  let scanned = 0;
  sources.forEach((source, order) => {
    if (!fs.existsSync(source)) {
      console.warn(`경로 없음, 건너뜀: ${source}`);
      return;
    }
    for (const file of walk(source)) {
      const parsed = parseImageName(file);
      if (!parsed) continue;
      scanned += 1;
      const place = placeByKey.get(nameKey(parsed.name));
      if (!place) {
        unmatched.add(parsed.name);
        continue;
      }
      const hash = createHash("sha1").update(fs.readFileSync(file)).digest("hex");
      if (!candidates.has(place)) candidates.set(place, []);
      candidates.get(place).push({ file, index: parsed.index, order, hash });
    }
  });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const imageMap = {};
  let copied = 0;
  for (const [place, list] of [...candidates].sort(([a], [b]) => a.localeCompare(b, "ko"))) {
    const seenHash = new Set();
    const picked = list
      .sort((a, b) => a.index - b.index || a.order - b.order || a.file.localeCompare(b.file))
      .filter((c) => !seenHash.has(c.hash) && seenHash.add(c.hash))
      .slice(0, MAX_PER_PLACE);
    const files = [];
    for (const [i, c] of picked.entries()) {
      const rel = `images/places/${placeId(place)}-${i + 1}.webp`;
      await sharp(c.file)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(root, "public", rel));
      files.push(rel);
      copied += 1;
    }
    imageMap[place] = files;
  }

  fs.writeFileSync(imageMapPath, JSON.stringify(imageMap, null, 2) + "\n", "utf8");
  console.log(`스캔한 이미지 파일: ${scanned}, 이름이 일치한 장소: ${candidates.size}곳`);
  console.log(`복사한 이미지: ${copied}장 (${Object.keys(imageMap).length}곳)`);
  console.log(`일치하는 장소가 없어 사용하지 않은 이름: ${[...unmatched].sort().join(", ") || "없음"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
