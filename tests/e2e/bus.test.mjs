// 버스 시간표와 다음 버스 알림. 시각은 Playwright 시계로 한국 시간에 고정한다.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import { launchBrowser, settle, startServer, withPage } from "./helpers.mjs";

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

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

const kstTime = (s) => new Date(`${s}+09:00`);
const busPage = (time, extra = {}) => ({ url: "?view=bus", ready: ".busPage", clock: kstTime(time), ...extra });
const run = (fn, options) => withPage(browser, fn, options);

// 브라우저 알림을 가로채 기록한다 (권한은 허용된 것으로).
const stubNotification = (page) =>
  page.addInitScript(() => {
    window.__notes = [];
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title, options) {
        window.__notes.push({ title, body: options?.body });
      }
    }
    window.Notification = FakeNotification;
  });

describe("버스 시간표", () => {
  test("평일 저녁: 다음 버스와 남은 시간, 지난 버스·다음 버스 표시", () =>
    run(async (page) => {
      assert.match(await page.locator(".busStatus").innerText(), /운행일/);
      assert.equal(await page.getByRole("button", { name: "999 교통대 → 시내" }).getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator(".busCountdown strong").innerText(), "7분 후");
      assert.match(await page.locator(".busCountdown").innerText(), /18:47 교통대\(회차지\) 출발/);
      assert.match(await page.locator(".busPath").innerText(), /충주역 19:03 → 터미널 19:05/);
      assert.match(await page.locator(".busNextActions").innerText(), /20:30/);
      assert.match(await page.locator(".busTable tr.next").innerText(), /18:47/);
      assert.equal(await page.locator(".busTable tr.past").count(), 18);
      assert.match(await page.locator(".busFoot").innerText(), /충주시청/);
    }, busPage("2026-11-17T18:40:00")));

  test("노선과 타는 곳을 바꾸면 그 정류장의 다음 버스를 보여준다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: "999 시내 → 교통대" }).click();
      assert.equal(await page.locator(".busCountdown strong").innerText(), "25분 후");
      assert.match(await page.locator(".busCountdown").innerText(), /19:05 터미널 출발/);
      assert.match(await page.locator(".busPath").innerText(), /교통대 직행/);
      await page.locator(".busStops").getByRole("button", { name: "충주역" }).click();
      assert.match(await page.locator(".busNext").innerText(), /더 없습니다/);
      await page.getByRole("button", { name: "700 대학순환" }).click();
      assert.equal(await page.locator(".busStops .chip").count(), 6);
      assert.match(await page.locator(".busCountdown").innerText(), /19:25 교통대 출발/);
      // 고른 노선은 다음 방문에도 남는다
      await page.reload();
      await page.waitForSelector(".busPage");
      assert.equal(await page.getByRole("button", { name: "700 대학순환" }).getAttribute("aria-pressed"), "true");
    }, busPage("2026-11-17T18:40:00")));

  test("주말·공휴일에는 운행하지 않는다고 알리고 알림 버튼을 숨긴다", async () => {
    for (const [time, text] of [
      ["2026-11-21T10:00:00", /주말이라 운행하지 않습니다/],
      ["2026-12-25T10:00:00", /공휴일이라 운행하지 않습니다/],
    ]) {
      await run(async (page) => {
        assert.match(await page.locator(".busStatus").innerText(), text);
        assert.equal(await page.locator(".busNext").count(), 0);
        assert.equal(await page.locator(".busTable button").count(), 0);
        assert.equal(await page.locator(".busTable tbody tr").count(), 20);
      }, busPage(time));
    }
  });

  test("출발 5분 전에 알림이 울린다 (브라우저 알림 + 화면 안내)", () =>
    run(async (page) => {
      await page.locator(".busNextActions").getByRole("button", { name: "18:47 · 5분 전 알림" }).click();
      assert.match(await page.locator(".busAlarmList").innerText(), /18:47 · 출발 5분 전/);
      await page.clock.setFixedTime(kstTime("2026-11-17T18:43:30"));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.waitForSelector(".busToast");
      assert.match(await page.locator(".busToast").innerText(), /999 교통대 → 시내 18:47 버스/);
      const notes = await page.evaluate(() => window.__notes);
      assert.equal(notes.length, 1);
      assert.match(notes[0].body, /4분 뒤 교통대\(회차지\)에서 출발/);
      assert.equal(await page.locator(".busAlarmList").count(), 0, "울린 알림은 목록에서 빠진다");
      await page.getByRole("button", { name: "알림 닫기" }).click();
      assert.equal(await page.locator(".busToast").count(), 0);
    }, { ...busPage("2026-11-17T18:30:00"), beforeGoto: stubNotification }));

  test("켜 둔 알림은 새로고침해도 남고, 다른 화면에서도 울린다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: "20:30 버스 5분 전에 알림 받기" }).click();
      await page.reload();
      await page.waitForSelector(".busPage");
      assert.match(await page.locator(".busAlarmList").innerText(), /20:30/);
      await page.locator(".sideNav").getByRole("button", { name: "홈" }).click();
      await page.waitForSelector("article.card");
      await page.clock.setFixedTime(kstTime("2026-11-17T20:26:00"));
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await page.waitForSelector(".busToast");
      assert.match(await page.locator(".busToast").innerText(), /20:30/);
    }, { ...busPage("2026-11-17T19:00:00"), beforeGoto: stubNotification }));

  test("곧 떠나는 버스는 알림 버튼이 꺼져 있다", () =>
    run(async (page) => {
      const btn = page.locator(".busNextActions button");
      assert.equal(await btn.isDisabled(), true);
      assert.equal(await page.getByRole("button", { name: "18:47 · 곧 출발해 알림을 맞출 수 없습니다" }).isDisabled(), true);
      assert.match(await btn.getAttribute("title"), /곧 출발/);
    }, busPage("2026-11-17T18:44:00")));

  test("홈의 다음 버스 카드를 누르면 버스 화면으로 간다", () =>
    run(async (page) => {
      const card = page.locator(".nextBusCard");
      assert.match(await card.innerText(), /7분 후 · 18:47 교통대\(회차지\) 출발/);
      await card.click();
      await page.waitForSelector(".busPage");
      await page.waitForURL(/view=bus/);
    }, { clock: kstTime("2026-11-17T18:40:00") }));

  test("휴대폰 하단 탭바에 버스 탭이 있다", () =>
    run(async (page) => {
      await page.locator(".tabbar").getByRole("button", { name: "버스" }).click();
      await page.waitForSelector(".busPage");
      assert.equal(await page.locator(".tabbar").getByRole("button", { name: "버스" }).getAttribute("aria-current"), "page");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, "가로로 넘치지 않는다");
    }, { viewport: { width: 375, height: 812 }, clock: kstTime("2026-11-17T18:40:00") }));

  test("중국어 화면", () =>
    run(async (page) => {
      await page.getByRole("button", { name: /中文|언어/ }).first().click();
      await settle(page);
      assert.match(await page.locator(".busCountdown strong").innerText(), /7分钟后/);
    }, busPage("2026-11-17T18:40:00")));

  for (const scheme of ["light", "dark"]) {
    test(`접근성(axe) ${scheme}`, () =>
      run(async (page) => {
        await page.addScriptTag({ path: axePath });
        const violations = await page.evaluate(async () => {
          const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
          return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")}`);
        });
        assert.deepEqual(violations, []);
      }, { ...busPage("2026-11-17T18:40:00"), colorScheme: scheme }));
  }
});
