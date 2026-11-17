// 내 위치 기준 가까운 순 정렬. 위치는 Playwright 로 가짜 좌표를 넣는다.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { cards, launchBrowser, places, settle, startServer, withPage } from "./helpers.mjs";

let server;
let browser;
before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const run = (fn, options) => withPage(browser, fn, options);
const located = places.filter((p) => p.lat !== undefined && p.lng !== undefined);
const rad = (d) => (d * Math.PI) / 180;
const meters = (a, b) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};
// 좌표가 있는 장소 하나 바로 앞에 서 있다고 가정한다.
const here = located[Math.floor(located.length / 2)];
const atHere = { permissions: ["geolocation"], geolocation: { latitude: here.lat, longitude: here.lng } };

describe("내 위치에서 가까운 순", () => {
  test("가까운 순을 고르면 위치를 받아 거리 순으로 정렬하고 카드에 거리를 보여준다", () =>
    run(async (page) => {
      await page.selectOption("#sort", "distance");
      await page.waitForSelector(".geoNote >> text=내 위치 기준");
      await settle(page);
      const first = cards(page).first();
      assert.equal(await first.locator(".cardTitle").innerText(), here.name);
      assert.match(await first.locator(".fromMe [aria-hidden=true]").last().innerText(), /^\d+m$/);
      assert.match(await first.locator(".fromMe .srOnly").innerText(), /내 위치에서 \d+m · 걸어서 약 \d+분/);
      // 위치가 확인된 장소들은 거리가 줄지 않는 순서다.
      const titles = await page.$$eval("article.card .cardTitle", (els) => els.map((e) => e.textContent));
      const byName = new Map(located.map((p) => [p.name, p]));
      const ds = titles.slice(0, located.length).map((n) => meters(here, byName.get(n)));
      assert.ok(ds.every((d, i) => i === 0 || d >= ds[i - 1] - 0.5), "거리 순서");
      // 좌표 없는 장소는 거리 표시 없이 뒤에 온다.
      assert.equal(await page.locator("article.card .fromMe").count(), located.length);
      assert.match(page.url(), /sort=distance/);
      assert.doesNotMatch(page.url(), /lat|lng|36\.\d/, "위치는 주소에 남기지 않는다");
    }, atHere));

  test("주소에 sort=distance 가 있으면 바로 위치를 묻는다", () =>
    run(async (page) => {
      await page.waitForSelector(".geoNote >> text=내 위치 기준");
      assert.equal(await cards(page).first().locator(".cardTitle").innerText(), here.name);
    }, { ...atHere, url: "?sort=distance" }));

  test("멀리 있으면 안내를 덧붙인다", () =>
    run(async (page) => {
      await page.waitForSelector(".geoNote >> text=충주에서 멀어");
    }, { permissions: ["geolocation"], geolocation: { latitude: 37.5663, longitude: 126.9779 }, url: "?sort=distance" }));

  test("위치 권한이 없으면 추천수 순으로 보여주고 안내한다", () =>
    run(async (page) => {
      await page.waitForSelector(".geoNote >> text=위치 권한이 꺼져");
      assert.equal(await page.locator("article.card .fromMe").count(), 0);
      const max = Math.max(...places.map((p) => p.recommendations));
      const counts = await page.$$eval("article.card .recommend", (els) => els.map((e) => Number(e.textContent.replace(/\D/g, ""))));
      assert.equal(counts[0], max);
      assert.ok(counts.every((c, i) => i === 0 || c <= counts[i - 1]), "추천수 순서");
    }, { permissions: [], url: "?sort=distance" }));
});
