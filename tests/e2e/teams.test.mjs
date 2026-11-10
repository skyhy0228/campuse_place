// 팀원 작업을 합친 기능: 중국어(유학생) 모드, 캠퍼스 지도·강의실 찾기, 교통여지도의 음식 종류·리뷰 키워드, 반응형 레이아웃
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { cards, launchBrowser, places, resultCount, settle, startServer, withPage } from "./helpers.mjs";

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
const nav = (page) => page.getByRole("navigation", { name: /화면 이동|页面切换/ }).first();

describe("중국어(유학생) 모드", () => {
  const translated = places.find((p) => p.zh?.name && p.recommendations >= 5);

  test("전환하면 화면 문구와 장소 이름이 중국어로 바뀌고 새로고침해도 유지된다", () =>
    run(async (page) => {
      await page.getByRole("button", { name: /^언어/ }).click();
      await settle(page);
      assert.equal(await page.evaluate(() => document.documentElement.lang), "zh-CN");
      assert.equal(await page.locator("h1").innerText(), "交大校园指南");
      assert.equal(await page.title(), "交大校园指南");

      const zhName = translated.zh.name.replace(/\s*\([^)]*[가-힣][^)]*\)\s*$/, "").trim();
      const card = cards(page).filter({ has: page.getByRole("button", { name: zhName, exact: true }) }).first();
      assert.equal(await card.locator(".cardAlt").innerText(), translated.name);

      await page.reload();
      await page.waitForSelector("article.card");
      assert.equal(await page.evaluate(() => document.documentElement.lang), "zh-CN");
      await page.getByRole("button", { name: /^语言/ }).click();
      await settle(page);
      assert.equal(await page.locator("h1").innerText(), "교통대 꿀팁 모음");
    }));

  test("중국어로도 검색되고, 유학생 추천만 걸러 볼 수 있다", () =>
    run(async (page) => {
      await page.fill("#search", "留学生");
      await settle(page);
      assert.ok((await resultCount(page)) > 0);
      await page.fill("#search", "");
      await page.getByRole("button", { name: /^필터/ }).click();
      await page.getByRole("group", { name: "추가 필터" }).getByRole("button", { name: "유학생 추천" }).click();
      await settle(page);
      assert.equal(await resultCount(page), places.filter((p) => p.intl || p.category === "유학생").length);
    }));
});

describe("교통여지도: 음식 종류와 리뷰 키워드", () => {
  test("음식 칩으로 종류별로 거른다", () =>
    run(async (page) => {
      const expected = places.filter((p) => p.foodType === "burrito").length;
      await page.locator(".foodChips").getByRole("button", { name: /^부리또·바비큐/ }).click();
      await settle(page);
      assert.equal(await resultCount(page), expected);
      assert.match(page.url(), /[?&]food=burrito/);
    }, { viewport: { width: 390, height: 844 } }));

  test("상세에 네이버 리뷰 키워드와 건수, 출처가 보인다", () =>
    run(async (page) => {
      const target = places.find((p) => p.reviewKeywords?.length);
      await page.fill("#search", target.name);
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.waitForSelector("dialog[open]");
      const items = await page.locator("dialog .keywordList li").allInnerTexts();
      assert.equal(items.length, target.reviewKeywords.length);
      assert.ok(items[0].includes(target.reviewKeywords[0].label));
      assert.ok(await page.getByText("네이버 플레이스 리뷰 키워드 (교통여지도 정리)").isVisible());
    }));

  test("AI 예시 사진에는 안내 문구를 붙인다", () =>
    run(async (page) => {
      const target = places.find((p) => p.foodPhoto && p.images.length === 0);
      await page.fill("#search", target.name);
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.waitForSelector("dialog[open]");
      assert.ok(await page.locator("dialog .aiNote").isVisible());
      assert.match(await page.locator("dialog .heroImage").getAttribute("src"), /images\/food\//);
    }));
});

describe("캠퍼스 지도 (ut 꿀팁 지도)", () => {
  test("캠퍼스 지도에 건물 라벨과 장소 핀이 표시되고 주소에 남는다", () =>
    run(async (page) => {
      await nav(page).getByRole("button", { name: "캠퍼스", exact: true }).click();
      await page.waitForSelector(".campusCanvas .blabel");
      assert.equal(await page.locator(".campusCanvas .blabel").count(), 37);
      assert.ok((await page.locator(".campusCanvas .cpin").count()) > 20);
      assert.ok(await page.getByText("OpenStreetMap").first().isVisible());
      await settle(page);
      assert.match(page.url(), /[?&]view=campus/);
    }));

  test("건물을 누르면 층별 안내가 열린다", () =>
    run(async (page) => {
      await page.waitForSelector(".campusCanvas .blabel");
      await page.locator(".leaflet-marker-icon[title='E5 테크노관']").click();
      const panel = page.getByRole("region", { name: "테크노관" });
      await panel.waitFor();
      assert.ok((await panel.locator(".floorList li").count()) >= 2);
    }, { url: "?view=campus", ready: ".campusCanvas" }));

  test("학생 추천 동선을 고르면 경로가 그려진다", () =>
    run(async (page) => {
      await page.waitForSelector(".campusCanvas .blabel");
      await page.locator(".routeItem").first().click();
      await page.waitForSelector(".campusCanvas .routeStop");
      assert.ok((await page.locator(".campusCanvas path.leaflet-interactive, .campusCanvas svg path").count()) >= 2);
      assert.equal(await page.locator(".routeItem").first().getAttribute("aria-pressed"), "true");
    }, { url: "?view=campus", ready: ".campusCanvas" }));

  test("강의실을 검색하면 건물과 층을 알려주고, 캠퍼스 지도에서 그 층을 강조한다", () =>
    run(async (page) => {
      await page.fill("#search", "테크노관 213");
      const card = page.locator(".roomCard");
      await card.waitFor();
      assert.match(await card.locator("h2").innerText(), /E5 테크노관 2층/);
      await card.getByRole("button", { name: "캠퍼스 지도에서 보기" }).click();
      await page.locator(".floorList li.hit").waitFor();
      assert.match(await page.locator(".floorList li.hit").innerText(), /^2층/);
      assert.equal(await page.locator(".notice.empty").count(), 0);
    }));

  test("상세의 '캠퍼스 지도에서 보기'는 그 장소의 핀을 강조한다", () =>
    run(async (page) => {
      // 좌표가 있으면 '지도에서 보기'(네이버 지도)가 먼저 나오므로, 캠퍼스 위치만 있는 장소를 고른다.
      const target = places.find((p) => p.campusXY && typeof p.lat !== "number");
      await page.fill("#search", target.name);
      await settle(page);
      await cards(page).first().locator(".cardLink").click();
      await page.getByRole("button", { name: "캠퍼스 지도에서 보기" }).click();
      await page.waitForSelector(".campusCanvas .cpin.sel");
    }));
});

describe("반응형 레이아웃", () => {
  test("PC: 왼쪽 사이드바와 화면 메뉴, 하단 탭바 없음", () =>
    run(async (page) => {
      assert.equal(await page.locator(".side").evaluate((el) => getComputedStyle(el).position), "fixed");
      assert.ok(await nav(page).isVisible());
      assert.ok(!(await page.locator(".tabbar").isVisible()));
    }));

  test("휴대폰: 하단 탭바로 화면을 바꾸고, 사이드바 메뉴는 숨긴다", () =>
    run(async (page) => {
      assert.ok(await page.locator(".tabbar").isVisible());
      assert.ok(!(await page.locator(".sideNav").isVisible()));
      await page.locator(".tabbar").getByRole("button", { name: "캠퍼스" }).click();
      await page.waitForSelector(".campusCanvas .blabel");
      assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
      await page.locator(".tabbar").getByRole("button", { name: "홈" }).click();
      await page.waitForSelector("article.card");
    }, { viewport: { width: 390, height: 844 } }));
});
