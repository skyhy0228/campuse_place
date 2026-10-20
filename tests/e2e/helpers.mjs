// 브라우저 테스트 공통 도구: 빌드 결과(dist)를 Vite preview 로 띄우고 Chrome 으로 접속한다.
// 사용: npm run test:e2e  (먼저 npm run build 가 필요하다)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { preview } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.env.E2E_PORT ?? 4173);
export const BASE = `http://127.0.0.1:${PORT}/campuse_place/`;
export const places = JSON.parse(fs.readFileSync(path.join(root, "public/data/places.json"), "utf8")).places;

export async function startServer() {
  if (!fs.existsSync(path.join(root, "dist/index.html"))) throw new Error("dist 가 없습니다. 먼저 npm run build 를 실행하세요.");
  const server = await preview({ root, preview: { port: PORT, strictPort: true, host: "127.0.0.1" }, logLevel: "error" });
  return { close: () => new Promise((resolve) => server.httpServer.close(resolve)) };
}

export const launchBrowser = () =>
  chromium.launch({
    channel: process.env.E2E_CHANNEL ?? "chrome",
    executablePath: process.env.E2E_CHROME_PATH || undefined,
    headless: true,
  });

// 새 브라우저 컨텍스트에서 테스트 본문을 실행하고, 끝나면 콘솔 오류가 없었는지 확인한다.
export async function withPage(browser, fn, options = {}) {
  const { viewport = { width: 1440, height: 900 }, url = "", serviceWorkers = "block", checkErrors = true, clock, ...rest } = options;
  const context = await browser.newContext({ viewport, locale: "ko-KR", serviceWorkers, permissions: ["clipboard-read", "clipboard-write"], ...rest });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => response.status() >= 400 && errors.push(`${response.status()} ${response.url()}`));
  try {
    // clock: 접속 시각을 고정한다. (영업 중 판단 테스트용)
    if (clock) await page.clock.setFixedTime(clock);
    await page.goto(BASE + url);
    await page.waitForSelector("article.card");
    await fn(page, context);
    if (checkErrors) {
      const real = errors.filter((e) => !/favicon/.test(e));
      if (real.length) throw new Error(`콘솔·네트워크 오류: ${real.slice(0, 3).join(" | ")}`);
    }
  } finally {
    await context.close();
  }
}

export const cards = (page) => page.locator("article.card");
export const resultCount = async (page) => Number((await page.locator(".resultCount strong").textContent()).trim());
export const settle = (page, ms = 350) => page.waitForTimeout(ms);

// 분류 칩 (카드 버튼과 이름이 겹치지 않게 칩 줄 안에서만 찾는다)
export const chip = (page, label) => page.locator(".chipRow .chip").filter({ hasText: new RegExp(`^${label}`) });
