// 앱 아이콘(PWA)과 링크 공유 미리보기(OG) 이미지를 만든다. 결과 PNG 는 public/ 에 커밋되어 있으므로
// 디자인을 바꿀 때만 실행한다: npm run assets
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public");
const GREEN = "#1f6f5c";
const PIN = "M32 12c-8.8 0-16 6.9-16 15.4C16 38.8 32 52 32 52s16-13.2 16-24.6C48 18.9 40.8 12 32 12Zm0 22a6.6 6.6 0 1 1 0-13.2A6.6 6.6 0 0 1 32 34Z";

// 가장자리까지 채운 아이콘(maskable)은 핀을 안쪽으로 줄여 잘림에 대비한다.
const icon = (scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" ${rounded ? 'rx="12"' : ""} fill="${GREEN}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)"><path d="${PIN}" fill="#fff"/></g></svg>`;

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f6f4ef"/>
  <rect width="1200" height="14" fill="${GREEN}"/>
  <rect x="80" y="120" width="150" height="150" rx="28" fill="${GREEN}"/>
  <g transform="translate(80 120) scale(2.34)"><path d="${PIN}" fill="#fff"/></g>
  <text x="80" y="370" font-family="Malgun Gothic, Noto Sans KR, Apple SD Gothic Neo, sans-serif" font-size="88" font-weight="700" fill="#1f2933">교통대 꿀팁 모음</text>
  <text x="80" y="450" font-family="Malgun Gothic, Noto Sans KR, Apple SD Gothic Neo, sans-serif" font-size="38" fill="#566170">국립한국교통대학교 충주캠퍼스 학생들이 직접 모은</text>
  <text x="80" y="505" font-family="Malgun Gothic, Noto Sans KR, Apple SD Gothic Neo, sans-serif" font-size="38" fill="#566170">맛집 · 숨은 장소 · 생활 꿀팁</text>
</svg>`;

const jobs = [
  ["icons/icon-192.png", icon(1, true), 192],
  ["icons/icon-512.png", icon(1, true), 512],
  ["icons/maskable-512.png", icon(0.72, false), 512],
  ["icons/apple-touch-icon.png", icon(0.85, false), 180],
];

fs.mkdirSync(path.join(out, "icons"), { recursive: true });
for (const [file, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toFile(path.join(out, file));
  console.log("생성:", file);
}
await sharp(Buffer.from(og)).png().toFile(path.join(out, "og.png"));
console.log("생성: og.png");
