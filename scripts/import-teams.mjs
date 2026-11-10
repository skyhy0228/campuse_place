// 팀원 저장소(clone 한 폴더)에서 데이터와 이미지를 가져와 data/teams/, public/ 에 복사한다.
// 사용법: node scripts/import-teams.mjs <팀원 저장소들을 clone 한 폴더>
//   <폴더>/ut-campus-tips, <폴더>/gyotong-yeojido, <폴더>/knut-campus-guide 가 있어야 한다.
// 팀원 코드는 실행하지 않는다. window.X = {...} 형식의 JS 데이터 파일도 텍스트로만 읽어 JSON 으로 바꾼다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.error("사용법: node scripts/import-teams.mjs <팀원 저장소 폴더>");
  process.exit(1);
}

const teamsDir = path.join(root, "data", "teams");
fs.mkdirSync(teamsDir, { recursive: true });
const read = (...p) => fs.readFileSync(path.join(src, ...p), "utf8");
const writeJson = (name, value) => fs.writeFileSync(path.join(teamsDir, name), JSON.stringify(value, null, 1) + "\n", "utf8");

// "window.X = { ... };" 에서 객체 부분만 꺼낸다. 따옴표 없는 키는 따옴표를 붙여 JSON 으로 읽는다.
function parseWindowObject(source) {
  const body = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  const json = body
    .slice(body.indexOf("{"), body.lastIndexOf("}") + 1)
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":');
  return JSON.parse(json);
}

// ut-campus-tips: 캠퍼스 지도
const campus = parseWindowObject(read("ut-campus-tips", "data", "places.js"));
writeJson("campus.json", {
  size: campus.size,
  builtAt: campus.builtAt,
  buildings: campus.buildings,
  busStops: campus.busStops,
  routes: campus.routes,
  places: campus.places.map(({ id, name, loc, link, x, y, b, approx, aka }) => ({ id, name, loc, link, x, y, b, approx, aka })),
});
writeJson("floors.json", parseWindowObject(read("ut-campus-tips", "data", "floors.js")));
fs.mkdirSync(path.join(root, "public", "campus"), { recursive: true });
fs.copyFileSync(path.join(src, "ut-campus-tips", "map", "campus.svg"), path.join(root, "public", "campus", "campus.svg"));

// gyotong-yeojido: 맛집 정보와 AI 음식 사진
writeJson("gyotong.json", JSON.parse(read("gyotong-yeojido", "data", "places.json")));
const foodSrc = path.join(src, "gyotong-yeojido", "img", "food");
const foodDst = path.join(root, "public", "images", "food");
fs.mkdirSync(foodDst, { recursive: true });
let photos = 0;
for (const file of fs.readdirSync(foodSrc)) {
  if (!/^[a-z0-9-]+\.webp$/.test(file) && file !== "CREDITS.md") continue;
  fs.copyFileSync(path.join(foodSrc, file), path.join(foodDst, file));
  if (file.endsWith(".webp")) photos += 1;
}

// knut-campus-guide: 중국어 번역과 유학생 꿀팁
writeJson("knut.json", JSON.parse(read("knut-campus-guide", "src", "data.json")));

console.log(`캠퍼스: 건물 ${campus.buildings.length}, 동선 ${campus.routes.length}, 장소 ${campus.places.length}`);
console.log(`음식 사진 ${photos}장`);
console.log("완료: data/teams/, public/campus/campus.svg, public/images/food/");
