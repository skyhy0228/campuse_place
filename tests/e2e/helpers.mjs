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

// 네이버 지도 API 대신 쓰는 가짜 스크립트. 실제 키·네트워크 없이 핀 구성과 화면 동작을 확인한다.
// 지도는 컨테이너 안의 .fakeMap 으로, 핀은 aria-label 이 붙은 .fakeMarker 버튼으로 그린다.
export const FAKE_NAVER_MAPS = `(() => {
  const Event = {
    addListener(target, name, fn) { const l = { target, name, fn }; (target.__listeners ??= []).push(l); return l; },
    removeListener(l) { l.target.__listeners = (l.target.__listeners || []).filter((x) => x !== l); },
    trigger(target, name) { (target.__listeners || []).filter((l) => l.name === name).forEach((l) => l.fn()); },
  };
  class LatLng { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }
  class LatLngBounds { constructor(sw, ne) { this.sw = sw; this.ne = ne; } }
  class Point { constructor(x, y) { this.x = x; this.y = y; } }
  class Size { constructor(w, h) { this.width = w; this.height = h; } }
  class Map {
    constructor(container, options) {
      this.el = document.createElement("div");
      this.el.className = "fakeMap";
      this.el.style.cssText = "position:absolute;inset:0";
      this.el.addEventListener("click", () => Event.trigger(this, "click"));
      container.appendChild(this.el);
      this.center = options.center;
      this.zoom = options.zoom;
    }
    setCenter(c) { this.center = c; }
    setZoom(z) { this.zoom = z; }
    fitBounds(b) { this.bounds = b; }
    autoResize() {}
    destroy() { this.el.remove(); }
  }
  class Marker {
    constructor(o) {
      this.el = document.createElement("button");
      this.el.type = "button";
      this.el.className = "fakeMarker";
      this.el.setAttribute("aria-label", o.title);
      this.el.addEventListener("click", (e) => { e.stopPropagation(); Event.trigger(this, "click"); });
      this.setMap(o.map);
    }
    setMap(map) { this.el.remove(); if (map) map.el.appendChild(this.el); }
  }
  window.naver = { maps: { Map, Marker, LatLng, LatLngBounds, Point, Size, Event, Position: { TOP_RIGHT: 3 } } };
})();`;
export const NAVER_MAPS_URL = /^https:\/\/oapi\.map\.naver\.com\//;

// 새 브라우저 컨텍스트에서 테스트 본문을 실행하고, 끝나면 콘솔 오류가 없었는지 확인한다.
export async function withPage(browser, fn, options = {}) {
  const { viewport = { width: 1440, height: 900 }, url = "", serviceWorkers = "block", checkErrors = true, clock, ...rest } = options;
  const context = await browser.newContext({ viewport, locale: "ko-KR", serviceWorkers, permissions: ["clipboard-read", "clipboard-write"], ...rest });
  await context.route(NAVER_MAPS_URL, (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_NAVER_MAPS }));
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
